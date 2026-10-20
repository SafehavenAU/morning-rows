import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
process.env.WRANGLER_LOG='error';
const root=fileURLToPath(new URL('.',import.meta.url));
const output=process.argv[2];if(!output||existsSync(output))throw Error('New output directory required');mkdirSync(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=['preview.js','integration.toml','check-preview.mjs','../../../lib/ni-energy-summary.js','../../../lib/sources.js','../../../package-lock.json','../access-review/ni-article/statistical-article.excerpt.html','../access-review/ni-article/comparison.json','../../remaining-gaps-2026-10-20/ni-energy/independent-report.json'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,hash(readFileSync(root+f))]));
const ref=JSON.parse(readFileSync(root+'../access-review/ni-article/comparison.json')),original=JSON.parse(readFileSync(root+'../../remaining-gaps-2026-10-20/ni-energy/independent-report.json'));
if(!ref.pass||ref.comparisons?.length!==5||!ref.comparisons.every(x=>x.pass)||!original.pass||original.observations.length!==5)throw Error('Independent reference invalid');
const expected=ref.comparisons.map(x=>({id:x.measure,value:x.original_workbook}));
if(expected.some(x=>original.observations.find(y=>y.measure===x.id)?.value!==x.value))throw Error('Independent references disagree');
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',purpose:'One actual live article acquisition plus constructed faults through unchanged reader; no production release or schedule claim',production_version:null,live_publisher_request_budget:1,code_before:hashes(),requests:[],checks:[]};
const quote=s=>'"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
function request(url,headers){return new Promise((ok,fail)=>{const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let text='',bytes=0;child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>524288){child.kill();fail(Error('response_bound'));}else text+=chunk;});child.on('error',()=>fail(Error('transport_failed')));child.on('close',code=>{if(code!==0)return fail(Error('transport_failed'));const at=text.lastIndexOf('\n');ok({status:Number(text.slice(at+1)),body:text.slice(0,at)});});child.stdin.on('error',()=>{});child.stdin.end(['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(headers).filter(([,v])=>v!==undefined).map(([k,v])=>`header = ${quote(k+': '+v)}`)].join('\n'));});}
const dev=new unstable_DevEnv();let timer;
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});ready.catch(()=>{});
const cases=['live','none','wrong-edition','wrong-window','wrong-method','wrong-geography','missing','suppression','prior-imports','duplicate','conflicting-total','denominator','redirect','http','timeout','oversize','bad-clock','zero-imports','negative-imports'];
try{
 await dev.startWorker({config:root+'integration.toml',entrypoint:root+'preview.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8823}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 for(const fault of cases){
  const path=fault==='live'?'/live':'/case?fault='+fault,url=new URL(path,'https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
  const started_at=new Date().toISOString(),result=await request(url,proxyData.headers),completed_at=new Date().toISOString();
  const file=String(report.requests.length+1).padStart(2,'0')+'-'+fault+'.json';writeFileSync(resolve(output,file),result.body,{flag:'wx'});
  report.requests.push({path,status:result.status,started_at,completed_at,file,sha256:hash(result.body),bytes:Buffer.byteLength(result.body)});
  if(result.status!==200)throw Error('wrapper_status');const value=JSON.parse(result.body),native=value.body?.electricity_balance,health=value.body?.sources?.electricity_balance;
  const positive=['live','none','zero-imports','negative-imports'].includes(fault);
  let pass=value.fixture===(fault!=='live')&&value.body.sibling.value===7&&value.body.sources.sibling.status==='ok'&&value.calls.length===(fault==='live'||fault==='bad-clock'?0:1)&&value.calls.every(x=>x.redirect==='manual'&&x.accept==='text/html');
  pass&&=positive?health?.status==='ok'&&native?.rows?.length===5:health?.status==='error'&&native===null;
  if(positive){
   pass&&=native.edition==='fixed_2026-09-03'&&native.period==='2025-07-01/2026-06-30'&&native.publication_date==='2026-09-03'&&native.metadata.fixed_edition===true&&native.metadata.history_month_count===undefined&&native.provenance.length===1&&native.provenance[0].role==='article';
   if(['live','none'].includes(fault))pass&&=expected.every(x=>native.rows.find(r=>r.measure_id===x.id)?.value===x.value);
   if(fault==='zero-imports')pass&&=native.rows.at(-1).value===0;
   if(fault==='negative-imports')pass&&=native.rows.at(-1).value===-286;
  }
  report.checks.push({fault,positive,source_health:health,observations:native?.rows?.length||0,pass});
  if(fault==='live'){
   report.live_comparisons=original.observations.map(x=>{const r=native?.rows?.find(r=>r.measure_id===x.measure);return {measure:x.measure,expected:x.value,actual:r?.value??null,pass:!!r&&r.value===x.value&&r.unit===x.unit&&r.period===x.period&&r.period_start===x.period_start&&r.period_end===x.period_end&&r.publication_date===x.publisher_date&&r.geography===x.geography&&r.value_state==='observed'};});
   report.original_wire_sha256=ref.original_acquisition.wire_sha256;report.same_original_article=native?.provenance?.[0]?.sha256===report.original_wire_sha256;
   report.live_provenance=native?.provenance||[];report.live_pass=pass&&report.same_original_article&&report.live_comparisons.every(x=>x.pass);
   if(!report.live_pass)throw Error('live_reader_failed');
  }
  console.log(JSON.stringify({fault,pass,source_status:health?.status,observations:native?.rows?.length||0}));
 }
 report.pass=report.live_pass&&report.checks.length===cases.length&&report.checks.every(x=>x.pass);
}catch(e){report.error=['preview_start_failed','preview_start_timeout','transport_failed','response_bound','wrapper_status','live_reader_failed'].includes(e.message)?e.message:'preview_validation_failed';report.pass=false;}
finally{clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_after=hashes();report.code_unchanged=JSON.stringify(report.code_before)===JSON.stringify(report.code_after);report.pass=!!report.pass&&report.code_unchanged;writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,code_unchanged:report.code_unchanged,live_pass:report.live_pass,error:report.error}));if(!report.pass)process.exitCode=1;}
