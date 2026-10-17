// Public, read-only post-release checks. No credentials and no production writes.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {DESKS} from '../lib/information.js';
const run=promisify(execFile),out=process.env.INFORMATION_REPORT_DIR||'/tmp/mr-information-production';
const baseline=JSON.parse(await readFile(new URL('../verification/structure-2026-10-17/before.json',import.meta.url)));
const records=[],bodies={};
async function request(origin,path,headers={}) {
 const {stdout}=await run('curl',['-sS','--max-time','90','-i',...Object.entries(headers).flatMap(([k,v])=>['-H',`${k}: ${v}`]),new URL(path,origin).href],{maxBuffer:2097152});
 let text=stdout,status,publicHeaders={};
 while(text.startsWith('HTTP/')) {
  const end=text.indexOf('\r\n\r\n');if(end<0)throw Error('Invalid HTTP response');
  const lines=text.slice(0,end).split('\r\n');status=Number(lines[0].split(' ')[1]);
  for(const l of lines.slice(1)){const i=l.indexOf(':'),key=l.slice(0,i).toLowerCase();if(['etag','cache-control','content-type','content-location','link','x-retrieved-at','x-source-revision','x-worker-version'].includes(key))publicHeaders[key]=l.slice(i+1).trim();}
  text=text.slice(end+4);
 }
 const record={origin,path,status,bytes:Buffer.byteLength(text),headers:publicHeaders};records.push(record);
 let data;try{data=JSON.parse(text);}catch{}
 if(status!==304) {
  bodies[origin+path]=data;
  await writeFile(`${out}/${origin.includes('www.')?'www':'apex'}-${encodeURIComponent(path)}.body`,text);
 }
 return {record,data,text};
}
const checks=[];
function check(name,ok,detail){checks.push({name,pass:Boolean(ok),...(detail?{detail}:{})});}
await mkdir(out,{recursive:true});
for(const origin of ['https://morningrows.com','https://www.morningrows.com']) {
 const health=await request(origin,'/health.json');check(`${origin} clean identity`,health.data?.source_dirty===false&&(!process.env.EXPECTED_REVISION||health.data.source_revision===process.env.EXPECTED_REVISION));
 const catalog=await request(origin,'/catalog.json');check(`${origin} eight desks`,catalog.data?.countries?.length===8);
 const schema=await request(origin,'/schema.json');check(`${origin} documented schema`,schema.data?.$schema&&schema.data?.oneOf?.length===3);
 for(const desk of Object.keys(DESKS)) {
  const [{data,record},directory]=await Promise.all([request(origin,`/${desk}.json`),request(origin,`/catalog.json?desk=${desk}`)]);
  check(`${origin} ${desk} full desk`,record.status===200&&data?.country===DESKS[desk]&&data?._meta?.schema_version==='1.0'&&Object.values(data.sources||{}).some(s=>s.status==='ok'));
  const get=pointer=>pointer.slice(1).split('/').reduce((v,k)=>v?.[k],data);
  check(`${origin} ${desk} inventory matches response`,directory.data?.sources?.every(s=>get(s.health_pointer)&&get(s.data_pointer)!==undefined));
  const expectedHealth=[...Object.keys(data.sources||{}).map(k=>`/sources/${k}`),...Object.keys(data.also?.sources||{}).map(k=>`/also/sources/${k}`)];
  check(`${origin} ${desk} every source discoverable`,expectedHealth.every(p=>directory.data?.sources?.some(s=>s.health_pointer===p)));
  const missing=(baseline.fields?.[`${desk}.json`]||[]).filter(k=>!Object.hasOwn(data||{},k));check(`${origin} ${desk} legacy fields retained`,!missing.length,missing.length?missing:undefined);
 }
 const tasks=[['canada','exchange','FXUSDCAD'],['wales','projection','population-2024-based'],['new-zealand','stats','CORR_FIS_005'],['australia','hospital','WA.MYH-RM0037'],['northern-ireland','childhood_bmi','Y8BMIOwOb'],['scotland','company_insolvencies','total-company-insolvencies'],['england','pharmacies','total']];
 for(const [desk,source,measure] of tasks) {
  const path=`/${desk}.json?`+new URLSearchParams({source,measure});const selected=await request(origin,path);
  const o=selected.data?.observations?.[0];check(`${origin} ${desk} selected measure`,selected.record.status===200&&selected.data.observations.length===1&&Number.isFinite(o.value)&&o.definition.unit&&o.definition.geography&&o.period&&o.source_url&&o.version&&o.id.startsWith('https://morningrows.com/'));
  const ttl=Number(selected.record.headers['cache-control']?.match(/max-age=(\d+)/)?.[1]);check(`${origin} ${desk} bounded TTL`,Number.isFinite(ttl)&&ttl<=({canada:3600,'new-zealand':120,australia:300}[desk]||600));
  const repeat=await request(origin,path,{'If-None-Match':selected.record.headers.etag});check(`${origin} ${desk} unchanged revisit`,repeat.record.status===304&&repeat.record.bytes===0);
 }
 const bad=await request(origin,'/canada.json?date=2026-10-12');check(`${origin} unsupported date rejected`,bad.record.status===400&&bad.data?.error==='unsupported_query');
 const old=await request(origin,'/canada.json?source=exchange&measure=FXUSDCAD&observation=2026-10-12');check(`${origin} no date substitution`,old.record.status===404&&old.data?.data===null);
 const site=await request(origin,'/sitemap.xml');check(`${origin} sitemap`,site.record.status===200&&Object.keys(DESKS).every(d=>site.text.includes(`/${d}.json`)));
 for(const agent of ['OAI-SearchBot','ChatGPT-User','Claude-SearchBot','Claude-User']) {const r=await request(origin,'/llms.txt',{'User-Agent':agent});check(`${origin} ${agent} fetch`,r.record.status===200&&r.text.includes('/catalog.json'));}
 const robots=await request(origin,'/robots.txt');check(`${origin} robots retrieval guidance`,robots.record.status===200&&robots.text.includes('ai-input=yes')&&robots.text.includes('Sitemap: https://morningrows.com/sitemap.xml'));
}
const apex=bodies['https://morningrows.com/health.json'],www=bodies['https://www.morningrows.com/health.json'];check('domains have identical release',apex?.worker_version===www?.worker_version&&apex?.source_revision===www?.source_revision);
const status={};for(const [key,body] of Object.entries(bodies))if(body?.sources&&!Array.isArray(body.sources))status[key]={...body.sources,...Object.fromEntries(Object.entries(body.also?.sources||{}).map(([k,v])=>['also.'+k,v]))};
const release_mismatches=process.env.EXPECTED_REVISION?records.filter(r=>r.headers['x-source-revision']!==process.env.EXPECTED_REVISION).map(r=>({origin:r.origin,path:r.path,observed_revision:r.headers['x-source-revision']})):[];
const report={checked_at:new Date().toISOString(),pass:checks.every(c=>c.pass)&&release_mismatches.length===0,identity:apex,checks,requests:records,source_status:status,release_mismatches};
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failures:checks.filter(c=>!c.pass),release_mismatches,identity:apex},null,2));
if(!report.pass)process.exitCode=1;
