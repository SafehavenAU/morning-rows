// Read-only capture for an already reviewed, staged 0%-traffic candidate.
// Usage: node scripts/verify-legacy-version-cpu.mjs VERSION OUTPUT EXPECTED_REVISION
// Run once before any request warms these eight candidate desk cache keys.
// A successful result is sampled CPU/cold-fetch evidence, not semantic acceptance.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {latestDeployment,stagingMatches,identityMatches,PRODUCTION_ORIGINS} from './lib/us-cpu-evidence.mjs';

const repo='/workspace/morning-rows-us';
const wrangler='/workspace/.morning-rows-tools/node_modules/.bin/wrangler';
const env={...process.env,XDG_CONFIG_HOME:'/workspace/.morning-rows-tools/config',WRANGLER_LOG:'log'};
const [version,output,expectedRevision]=process.argv.slice(2);
if(process.argv.length!==5||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(version||'')||!output||!/^[a-f0-9]{40}$/.test(expectedRevision||''))throw Error('Usage: VERSION OUTPUT EXPECTED_REVISION');
const approved=JSON.parse(await readFile(repo+'/verification/monitoring-baseline.json','utf8')).identity;
const countries={
 '/australia.json':'Australia',
 '/new-zealand.json':'New Zealand',
 '/canada.json':'Canada',
 '/united-kingdom.json':'United Kingdom',
 '/england.json':'England',
 '/scotland.json':'Scotland',
 '/wales.json':'Wales',
 '/northern-ireland.json':'Northern Ireland',
};
const paths=['/health.json',...Object.keys(countries)];
const report={
 started_at:new Date().toISOString(),kind:'Actual staged-version legacy cold CPU capture',version,
 expected_source_revision:expectedRevision,cpu_limit_ms:500,approved_identity:approved,
 checks:[],events:[],limitations:[
  'One observed location and one request per legacy desk; no percentile or sustained-load claim.',
  'Fresh source-health timestamps prove fresh retrieval attempts, including truthful publisher failures.',
  'This budget capture does not replace semantic/core-contract and source-regression acceptance.'
 ]
};
const save=()=>writeFile(output,JSON.stringify(report,null,2)+'\n');
const deployment=async()=>{
 const {stdout}=await promisify(execFile)(wrangler,['deployments','list','--name','morning-rows','--json'],{cwd:repo,env,timeout:30000,maxBuffer:1048576});
 return latestDeployment(JSON.parse(stdout));
};
const read=(path,override=true,origin='https://morningrows.com',phase=null)=>new Promise((resolve,reject)=>{
 const started_at=new Date().toISOString();
 const child=spawn('curl',['--silent','--show-error','--max-time','90','--proto','=https','--include',...(override?['-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${version}"`]:[]),origin+path],{stdio:['ignore','pipe','ignore']});
 let text='',bytes=0,overflow=false;
 child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>2097152){overflow=true;child.kill();}else text+=chunk.toString();});
 child.on('error',()=>reject(Error('request_start_failed')));
 child.on('close',code=>{
  if(code!==0||overflow)return reject(Error(overflow?'response_too_large':'request_failed'));
  const headers={};let status;
  while(text.startsWith('HTTP/')){
   const end=text.indexOf('\r\n\r\n');if(end<0)return reject(Error('invalid_response_headers'));
   const block=text.slice(0,end);status=Number(block.split(' ')[1]);
   for(const line of block.split('\r\n').slice(1)){
    const index=line.indexOf(':');if(index<0)continue;
    const name=line.slice(0,index).toLowerCase();
    if(['x-worker-version','x-source-revision','x-source-dirty','x-build-fingerprint','etag','cache-control','age','x-data-status','content-type'].includes(name))headers[name]=line.slice(index+1).trim();
   }
   text=text.slice(end+4);
  }
  let body,json_valid=true;try{body=JSON.parse(text);}catch{json_valid=false;body={response_text:text};}
  resolve({path,override,origin,phase,status,headers,body,json_valid,bytes:Buffer.byteLength(text),started_at,at:new Date().toISOString()});
 });
});

try{
 report.deployment_before=await deployment();
 if(!stagingMatches(report.deployment_before,version,approved))throw Error('candidate_not_staged_at_zero');
 for(const origin of PRODUCTION_ORIGINS)report.checks.push(await read('/health.json',false,origin,'before'));
 if(!report.checks.every(check=>identityMatches(check,approved)))throw Error('production_preflight_identity_mismatch');
}catch(error){
 report.error=['candidate_not_staged_at_zero','production_preflight_identity_mismatch'].includes(error.message)?error.message:'preflight_failed';
 report.budget_pass=false;report.finished_at=new Date().toISOString();await save();console.error(report.error);process.exit(1);
}

const tail=spawn(wrangler,['tail','morning-rows','--format','json','--version-id',version],{cwd:repo,env,stdio:['ignore','pipe','pipe']});
let depth=0,inString=false,escape=false,current='',stopping=false;
tail.on('error',()=>{report.tail_command_error=true;});
tail.on('close',()=>{if(!stopping)report.tail_command_error=true;});
tail.stderr.on('data',chunk=>{if(chunk.toString().includes('[ERROR]'))report.tail_command_error=true;});
tail.stdout.on('data',chunk=>{
 for(const c of chunk.toString()){
  if(depth===0){if(c!=='{')continue;current='';}
  current+=c;
  if(escape){escape=false;continue;}
  if(inString&&c==='\\'){escape=true;continue;}
  if(c==='"'){inString=!inString;continue;}
  if(inString)continue;
  if(c==='{')depth++;
  if(c==='}')depth--;
  if(depth!==0)continue;
  try{
   const event=JSON.parse(current);let request_path=null;
   try{const url=new URL(event.event?.request?.url);if(url.origin==='https://morningrows.com'&&paths.includes(url.pathname)&&url.search==='')request_path=url.pathname;}catch{}
   report.events.push({request_path,outcome:event.outcome,cpu_ms:event.cpuTime,wall_ms:event.wallTime,event_timestamp:event.eventTimestamp,script_version:event.scriptVersion,exception_names:event.exceptions?.map(e=>e.name)});
  }catch{report.tail_parse_error=true;}
  current='';
 }
});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const correlations=check=>report.events.filter(event=>event.request_path===check.path&&event.script_version?.id===version&&Number.isFinite(event.event_timestamp)&&event.event_timestamp>=Date.parse(check.started_at)-1000&&event.event_timestamp<=Date.parse(check.at));
try{
 await pause(4000);
 for(const path of paths){
  if(report.tail_command_error)throw Error('tail_command_failed');
  const check=await read(path);report.checks.push(check);
  if(path==='/health.json'){
   const healthExpected={...check.body,worker_version:version,source_revision:expectedRevision};
   if(!/^[a-f0-9]{16}$/.test(healthExpected.build_fingerprint||'')||!identityMatches(check,healthExpected))throw Error('candidate_preflight_identity_mismatch');
   const until=Date.now()+10000;while(correlations(check).length===0&&Date.now()<until&&!report.tail_command_error)await pause(250);
   if(correlations(check).length!==1)throw Error('tail_not_ready');
  }
  console.log(JSON.stringify({path,status:check.status,version:check.headers['x-worker-version'],source_revision:check.headers['x-source-revision'],bytes:check.bytes}));
 }
 const until=Date.now()+12000;
 while(report.events.length<paths.length&&Date.now()<until&&!report.tail_command_error)await pause(250);
}catch(error){
 report.error=['tail_command_failed','candidate_preflight_identity_mismatch','tail_not_ready','response_too_large','request_failed','request_start_failed','invalid_response_headers'].includes(error.message)?error.message:'capture_failed';
}finally{
 stopping=true;tail.kill('SIGINT');
 try{
  for(const origin of PRODUCTION_ORIGINS)report.checks.push(await read('/health.json',false,origin,'after'));
  report.deployment_after=await deployment();
 }catch{report.error ||= 'production_postflight_failed';}
 report.finished_at=new Date().toISOString();
 const target=report.checks.filter(check=>check.override);
 const health=target.find(check=>check.path==='/health.json');
 const identity={...health?.body,worker_version:version,source_revision:expectedRevision};
 report.candidate_identity_confirmed=Boolean(/^[a-f0-9]{16}$/.test(identity.build_fingerprint||'')&&identityMatches(health||{},identity)&&target.length===paths.length&&target.every(check=>check.status===200&&check.json_valid&&check.headers['x-worker-version']===version&&check.headers['x-source-revision']===expectedRevision&&(check.headers['x-source-dirty']===undefined||check.headers['x-source-dirty']==='false')&&(check.headers['x-build-fingerprint']===undefined||check.headers['x-build-fingerprint']===identity.build_fingerprint)));
 report.production_identity_confirmed=['before','after'].every(phase=>PRODUCTION_ORIGINS.every(origin=>{
  const checks=report.checks.filter(check=>!check.override&&check.phase===phase&&check.origin===origin&&check.path==='/health.json');
  return checks.length===1&&identityMatches(checks[0],approved);
 }));
 report.deployment_unchanged=Boolean(stagingMatches(report.deployment_before,version,approved)&&stagingMatches(report.deployment_after,version,approved)&&report.deployment_before.id===report.deployment_after.id);
 report.complete_event_coverage=target.length===paths.length&&report.events.length===paths.length&&paths.every(path=>target.filter(check=>check.path===path).length===1)&&target.every(check=>correlations(check).length===1);
 report.events_valid=report.events.length===paths.length&&report.events.every(event=>Number.isFinite(event.cpu_ms)&&event.cpu_ms>=0&&event.cpu_ms<=500&&event.outcome==='ok'&&Array.isArray(event.exception_names)&&event.exception_names.length===0);
 report.desk_freshness=Object.entries(countries).map(([path,country])=>{
  const checks=target.filter(check=>check.path===path),check=checks[0],body=check?.body;
  const groups=[['sources',body?.sources],...(body?.also===undefined?[]:[['also.sources',body?.also?.sources]])];
  const groups_valid=groups.every(([,sources])=>sources&&typeof sources==='object'&&!Array.isArray(sources)&&Object.keys(sources).length>0);
  const sources=groups.flatMap(([group,values])=>Object.entries(values||{}).map(([name,value])=>{
   const at=Date.parse(value?.fetched_at);
   return {source:group+'.'+name,status:value?.status,fetched_at:value?.fetched_at,fresh:Number.isFinite(at)&&at>=Date.parse(check?.started_at)&&at<=Date.parse(check?.at)};
  }));
  return {path,country,source_count:sources.length,sources,pass:checks.length===1&&body?.country===country&&body?._meta?.schema_version==='1.0'&&groups_valid&&sources.length>0&&sources.every(source=>source.fresh&&['ok','degraded','error'].includes(source.status))&&sources.some(source=>source.status==='ok')};
 });
 report.cold_retrieval_confirmed=report.desk_freshness.length===8&&report.desk_freshness.every(desk=>desk.pass);
 report.budget_pass=Boolean(!report.error&&!report.tail_command_error&&!report.tail_parse_error&&report.candidate_identity_confirmed&&report.production_identity_confirmed&&report.deployment_unchanged&&report.complete_event_coverage&&report.events_valid&&report.cold_retrieval_confirmed);
 report.cpu_by_path=Object.fromEntries(paths.map(path=>[path,report.events.filter(event=>event.request_path===path).map(event=>event.cpu_ms)]));
 await save();
 console.log(JSON.stringify({output,cpu_limit_ms:500,cpu_by_path:report.cpu_by_path,cold_retrieval_confirmed:report.cold_retrieval_confirmed,complete_event_coverage:report.complete_event_coverage,candidate_identity_confirmed:report.candidate_identity_confirmed,production_identity_confirmed:report.production_identity_confirmed,deployment_unchanged:report.deployment_unchanged,budget_pass:report.budget_pass}));
 if(!report.budget_pass)process.exitCode=1;
}
