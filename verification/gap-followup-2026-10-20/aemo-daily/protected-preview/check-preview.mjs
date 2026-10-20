// One protected live acquisition plus constructed cases. Never upload/deploy a version.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {cases} from './cases.mjs';
import {evaluate,independent} from './evaluate.mjs';
process.env.WRANGLER_LOG='error';
if(process.env.XDG_CONFIG_HOME!=='/workspace/.morning-rows-tools/config')throw Error('Required configured authentication directory');
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
const root=fileURLToPath(new URL('.',import.meta.url)),output=process.argv[2];if(!output||process.argv.length!==3||existsSync(output))throw Error('Fresh output directory required');mkdirSync(output,{recursive:true});
const scratch=mkdtempSync(resolve(tmpdir(),'mr-aemo-fixture-'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=['preview.js','integration.toml','check-preview.mjs','cases.mjs','evaluate.mjs','../../../../lib/aemo-daily-bundles.js','../../../../lib/aemo-day.js','../../../../lib/sources.js','../../../../package-lock.json','../review/independent-rounding.json','../review/pure-parser-capture.json','../original/public-prices-definition.yaml'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,hash(readFileSync(resolve(root,file)))]));
const quote=s=>'"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
function request(url,headers,payload){return new Promise((ok,fail)=>{
 const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let body='',length=0;
 child.stdout.on('data',chunk=>{length+=chunk.length;if(length>2097152){child.kill();fail(Error('response_bound'));}else body+=chunk;});
 child.on('error',()=>fail(Error('transport_failed')));child.on('close',code=>{if(code!==0)return fail(Error('transport_failed'));const end=body.lastIndexOf('\n');ok({status:Number(body.slice(end+1)),body:body.slice(0,end)});});child.stdin.on('error',()=>{});
 const commands=['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(headers).filter(([,value])=>value!==undefined).map(([key,value])=>`header = ${quote(key+': '+value)}`)];
 if(payload){const path=resolve(scratch,'request.json');writeFileSync(path,payload);commands.push('request = "POST"','header = "content-type: application/json"',`data-binary = ${quote('@'+path)}`);}
 child.stdin.end(commands.join('\n'));
});}
const plan=[{name:'live',expected:'ok',expected_calls:3},...cases];
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote development',kind:'Actual unchanged daily reader with one live acquisition and constructed transport controls',production_version:null,live_publisher_request_budget:3,planned_cases:plan.length,reference_cells:576,reference_summaries:10,code_before:hashes(),requests:[],checks:[],resource_limits:{index_bytes:131072,zip_bytes_each:524288,expanded_csv_bytes_each:2097152,reader_timeout_ms_per_request:20000},cpu_acceptance:false,cpu_note:'Remote development wall duration is not CPU time; exact staged CPU remains required.'};
const dev=new unstable_DevEnv();let timer;
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});ready.catch(()=>{});
try{
 await dev.startWorker({config:root+'integration.toml',entrypoint:root+'preview.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8833}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 for(const test of plan){
  const path=test.name==='live'?'/live':'/fixture',url=new URL(path,'https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
  const payload=test.payload?JSON.stringify(test.payload):undefined,started_at=new Date().toISOString(),result=await request(url,proxyData.headers,payload),completed_at=new Date().toISOString();
  const file=String(report.requests.length+1).padStart(2,'0')+'-'+test.name+'.json';writeFileSync(resolve(output,file),result.body,{flag:'wx'});
  report.requests.push({case:test.name,path,method:payload?'POST':'GET',status:result.status,started_at,completed_at,file,sha256:hash(result.body),bytes:Buffer.byteLength(result.body),...(payload?{constructed_input_sha256:hash(payload),constructed_input_bytes:Buffer.byteLength(payload)}:{})});
  if(result.status!==200)throw Error('wrapper_status');const value=JSON.parse(result.body),evaluation=evaluate(value,test,{started_at,completed_at});
  report.checks.push({case:test.name,expected:test.expected,source_status:value.body?.sources?.grid_day?.status,...evaluation});
  console.log(JSON.stringify({case:test.name,pass:evaluation.pass,source_status:value.body?.sources?.grid_day?.status}));
  if(test.name==='live'){
   report.live_pass=evaluation.pass;report.live_provenance=value.body?.grid_day?.provenance||[];
   report.live_cells=independent.observations.map(row=>{const actual=value.body?.grid_day?.regions.find(r=>r.region===row.region)?.intervals.find(r=>r.period_end===row.period_end);return {region:row.region,period_end:row.period_end,expected_raw:row.raw,expected:Number(row.rounded),actual:actual?.price??null,pass:actual?.price_raw===row.raw&&actual?.layout2_price_raw===row.layout2_raw&&actual?.price===Number(row.rounded)};});
   report.live_pass&&=report.live_cells.length===576&&report.live_cells.every(x=>x.pass);
   if(!report.live_pass)throw Error('live_reader_failed');
  }
  if(!evaluation.pass)throw Error('constructed_case_failed');
 }
 report.pass=report.live_pass&&report.checks.length===plan.length&&report.checks.every(x=>x.pass);
}catch(error){report.error=['preview_start_failed','preview_start_timeout','transport_failed','response_bound','wrapper_status','live_reader_failed','constructed_case_failed'].includes(error.message)?error.message:'preview_validation_failed';report.pass=false;}
finally{
 clearTimeout(timer);await dev.teardown();rmSync(scratch,{recursive:true,force:true});report.finished_at=new Date().toISOString();report.code_after=hashes();report.code_unchanged=JSON.stringify(report.code_before)===JSON.stringify(report.code_after);report.pass=!!report.pass&&report.code_unchanged;
 writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 writeFileSync(resolve(output,'capture-manifest.json'),JSON.stringify({kind:'Allowlisted body captures; no remote preview URL, token, cookie or header retained',files:[...report.requests.map(({file,bytes,sha256})=>({file,bytes,sha256})),{file:'report.json',bytes:readFileSync(resolve(output,'report.json')).length,sha256:hash(readFileSync(resolve(output,'report.json')))}]},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,live_pass:report.live_pass,code_unchanged:report.code_unchanged,error:report.error}));if(!report.pass)process.exitCode=1;
}
