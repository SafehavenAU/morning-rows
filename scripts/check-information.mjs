// Public, read-only post-release checks. No credentials and no production writes.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {DESKS} from '../lib/information.js';
import {validateCpiRepresentation,US_MEASURE_URL} from '../lib/information-v2.js';
const run=promisify(execFile),out=process.env.INFORMATION_REPORT_DIR||'/tmp/mr-information-production';
const baseline=JSON.parse(await readFile(new URL('../verification/structure-2026-10-17/before.json',import.meta.url)));
const records=[],bodies={};
async function request(origin,path,headers={},method='GET') {
 const {stdout}=await run('curl',['-sS','--max-time','90','-i',...(method==='HEAD'?['--head']:[]),...Object.entries(headers).flatMap(([k,v])=>['-H',`${k}: ${v}`]),new URL(path,origin).href],{maxBuffer:2097152});
 let text=stdout,status,publicHeaders={};
 while(text.startsWith('HTTP/')) {
  const end=text.indexOf('\r\n\r\n');if(end<0)throw Error('Invalid HTTP response');
  const lines=text.slice(0,end).split('\r\n');status=Number(lines[0].split(' ')[1]);
  for(const l of lines.slice(1)){const i=l.indexOf(':'),key=l.slice(0,i).toLowerCase();if(['etag','cache-control','content-type','content-location','link','x-retrieved-at','x-source-revision','x-worker-version'].includes(key))publicHeaders[key]=l.slice(i+1).trim();}
  text=text.slice(end+4);
 }
 const record={origin,path,method,status,bytes:Buffer.byteLength(text),headers:publicHeaders};records.push(record);
 let data;try{data=JSON.parse(text);}catch{}
 if(status!==304&&method!=='HEAD') {
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
 if(process.env.CHECK_US==='1') {
  const current=await request(origin,'/catalog.v2.json');const entries=current.data?.countries||[];
  check(`${origin} nine versioned desks`,current.record.status===200&&entries.length===9&&new Set(entries.map(c=>c.id)).size===9&&entries.filter(c=>c.resource_schema_version==='1.0').length===8&&entries.find(c=>c.name==='United States')?.resource_schema_version==='2.0');
  const directory=await request(origin,'/catalog.v2.json?desk=united-states'),usSchema=await request(origin,'/schema.v2.json');
  check(`${origin} US definition discoverable`,directory.data?.sources?.[0]?.measures?.[0]?.records===US_MEASURE_URL&&usSchema.data?.$id==='https://morningrows.com/schema.v2.json');
  const full=await request(origin,'/united-states.json');check(`${origin} US exact native contract`,full.data?.country==='United States'&&full.data?._meta?.schema_version==='2.0'&&full.data?.sources?.cpi?.status==='ok'&&validateCpiRepresentation(full.data?.cpi));
  if(process.env.EXPECTED_US_LATEST)check(`${origin} US reconciled release`,full.data?.cpi?.latest_period===process.env.EXPECTED_US_LATEST);
  const path='/united-states.json?source=cpi&measure=CUUR0000SA0',measure=await request(origin,path),obs=measure.data?.observations||[];
  check(`${origin} US 13-month selection`,measure.record.status===200&&obs.length===13&&new Set(obs.map(o=>o.period)).size===13&&measure.record.headers.link?.includes('/schema.v2.json'));
  if(measure.record.status===200){
   const repeat=await request(origin,path,{'If-None-Match':measure.record.headers.etag});check(`${origin} US unchanged conditional`,repeat.record.status===304&&repeat.record.bytes===0);
   const head=await request(origin,path,{},'HEAD');check(`${origin} US HEAD`,head.record.status===200&&head.record.bytes===0&&head.record.headers.etag===measure.record.headers.etag);
   for(const o of obs.filter(o=>o.value_state!=='observed')){const exact=await request(origin,path+'&observation='+encodeURIComponent(o.period));check(`${origin} US ${o.period} retained null`,exact.record.status===200&&exact.data?.observations?.length===1&&exact.data.observations[0].value===null&&exact.data.observations[0].value_state===o.value_state);}
  }
  for(const [bad,status] of [['/united-states.json?geography=California',400],[path+'&observation=1900-01',404],['/catalog.json?desk=united-states',404]]){const r=await request(origin,bad);check(`${origin} US explicit refusal ${bad}`,r.record.status===status);}
 }
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
