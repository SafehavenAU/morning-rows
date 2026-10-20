// One fresh selected rent-source acquisition on the untouched www cache key.
// Usage: node scripts/verify-rent-source-cpu.mjs VERSION OUTPUT EXPECTED_REVISION
// Run after apex CPU captures and before any www candidate NZ desk request.
// Importing this module only exposes the pure evaluator; it performs no I/O.
import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {latestDeployment,stagingMatches,identityMatches,PRODUCTION_ORIGINS} from './lib/us-cpu-evidence.mjs';
import {NZ_RENT_LOCATIONS,nzRentDefinitions,validateNzRentRepresentation} from '../lib/nz-market-rent.js';

export const RENT_CPU_PATHS=Object.freeze(['/health.json','/new-zealand.json?source=market_rent']);
const origin='https://www.morningrows.com';
const source='https://morningrows.com/new-zealand.json?source=market_rent';
const budget=500;
const validVersion=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const validRevision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const correlations=(report,check)=>report.events.filter(event=>event.request_path===check.path&&event.script_version?.id===report.version&&Number.isFinite(event.event_timestamp)&&event.event_timestamp>=Date.parse(check.started_at)-1000&&event.event_timestamp<=Date.parse(check.at));
const timestampWithin=(value,check)=>{
 const at=Date.parse(value);
 return Number.isFinite(at)&&at>=Date.parse(check?.started_at)&&at<=Date.parse(check?.at);
};

function rentObservationsMatch(body,native) {
 if(body?.source!==source||body.id!==source||body.schema_version!=='1.0'||!Array.isArray(body.observations)||body.observations.length!==116||!Array.isArray(native?.rows)||native.rows.length!==29)return false;
 const definitions=new Map(nzRentDefinitions().map(d=>[d.id,d]));
 const expected=new Map(native.rows.flatMap(row=>['active_bonds','lower_quartile','median','upper_quartile'].map(statistic=>{
  const id=`${row.location_id}.${row.dwelling_key}.${row.bedroom_key}.${statistic}`;
  return [id,{row,statistic,definition:definitions.get(id)}];
 })));
 if(expected.size!==116)return false;
 const seen=new Set();
 for(const observation of body.observations) {
  const id=observation?.definition?.id,entry=expected.get(id);
  if(!entry||seen.has(id))return false;seen.add(id);
  const {row,statistic,definition}=entry;
  const measure=new URL(source);measure.searchParams.set('measure',id);
  const observationUrl=new URL(measure);observationUrl.searchParams.set('observation',row.period);
  const {active_bonds,lower_quartile,median,upper_quartile,...dimensions}=row;
  const qualification={...dimensions,statistic,value:row[statistic],unit:definition.unit,value_state:'observed',revision_status:'provisional'};
  if(observation.measure!==measure.href||observation.id!==observationUrl.href||!isDeepStrictEqual(observation.definition,definition)||observation.value!==row[statistic]||observation.value_state!=='observed'||observation.period!==row.period||!isDeepStrictEqual(observation.qualifications,qualification)||observation.source_url!==row.source_url||observation.licence!==native.licence||!/^[a-f0-9]{64}$/.test(observation.version||'')||observation.published_at!==null||observation.publisher_updated_at!==null||observation.next_expected_update!==null||!isDeepStrictEqual(observation.publisher_status,{revision_status:'provisional'}))return false;
 }
 return seen.size===116;
}

export function evaluateRentSourceCpuEvidence(report,approved,version,expectedRevision) {
 const checks=Array.isArray(report?.checks)?report.checks:[],events=Array.isArray(report?.events)?report.events:[];
 const evaluation={...report,checks,events},target=checks.filter(c=>c.override),health=target.find(c=>c.path===RENT_CPU_PATHS[0]),rent=target.find(c=>c.path===RENT_CPU_PATHS[1]);
 const candidate={...health?.body,worker_version:version,source_revision:expectedRevision};
 const candidate_identity_confirmed=Boolean(validVersion(version)&&validRevision(expectedRevision)&&report?.version===version&&report.expected_source_revision===expectedRevision&&/^[a-f0-9]{16}$/.test(candidate.build_fingerprint||'')&&identityMatches(health||{},candidate)&&target.length===2&&target.every(c=>c.origin===origin&&c.status===200&&c.json_valid===true&&c.headers?.['x-worker-version']===version&&c.headers?.['x-source-revision']===expectedRevision&&(c.headers?.['x-source-dirty']===undefined||c.headers['x-source-dirty']==='false')&&(c.headers?.['x-build-fingerprint']===undefined||c.headers['x-build-fingerprint']===candidate.build_fingerprint)));
 const production_identity_confirmed=['before','after'].every(phase=>PRODUCTION_ORIGINS.every(productionOrigin=>{
  const matches=checks.filter(c=>!c.override&&c.phase===phase&&c.origin===productionOrigin&&c.path==='/health.json');
  return matches.length===1&&matches[0].json_valid===true&&identityMatches(matches[0],approved);
 }));
 const deployment_unchanged=Boolean(stagingMatches(report?.deployment_before,version,approved)&&stagingMatches(report?.deployment_after,version,approved)&&report.deployment_before.id===report.deployment_after.id);
 const complete_event_coverage=target.length===2&&events.length===2&&RENT_CPU_PATHS.every(path=>target.filter(c=>c.path===path).length===1)&&target.every(c=>correlations(evaluation,c).length===1);
 const events_valid=events.length===2&&events.every(e=>e.outcome==='ok'&&Number.isFinite(e.cpu_ms)&&e.cpu_ms>=0&&e.cpu_ms<=budget&&Array.isArray(e.exception_names)&&e.exception_names.length===0);
 const body=rent?.body,native=plain(body?.context)&&Array.isArray(body?.data)?{...body.context,rows:body.data}:null;
 const native_valid=Boolean(native?.status==='ok'&&validateNzRentRepresentation(native)&&native.rows.length===29&&native.locations.length===2&&native.locations.every(l=>l.status==='ok')&&new Set(native.locations.map(l=>l.id)).size===2);
 const selected_observations_valid=native_valid&&rentObservationsMatch(body,native);
 const acquisitions=native?.provenance;
 const fresh_publisher_acquisitions=Boolean(Array.isArray(acquisitions)&&acquisitions.length===2&&new Set(acquisitions.map(p=>p?.location_id)).size===2&&acquisitions.every(p=>{
  const location=Object.hasOwn(NZ_RENT_LOCATIONS,p?.location_id)&&NZ_RENT_LOCATIONS[p.location_id];
  return location&&p.url===location.source_url&&timestampWithin(p.retrieved_at,rent)&&/^[a-f0-9]{64}$/.test(p.sha256||'')&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=131072;
 }));
 const cold_retrieval_confirmed=Boolean(native_valid&&selected_observations_valid&&body?.retrieval?.status==='ok'&&timestampWithin(body.retrieval.retrieved_at,rent)&&fresh_publisher_acquisitions);
 const cpu_by_path=Object.fromEntries(RENT_CPU_PATHS.map(path=>[path,events.filter(e=>e.request_path===path).map(e=>e.cpu_ms)]));
 const budget_pass=Boolean(report?.cpu_limit_ms===budget&&!report.error&&!report.tail_command_error&&!report.tail_parse_error&&candidate_identity_confirmed&&production_identity_confirmed&&deployment_unchanged&&complete_event_coverage&&events_valid&&cold_retrieval_confirmed);
 return {candidate_identity_confirmed,production_identity_confirmed,deployment_unchanged,complete_event_coverage,events_valid,native_valid,selected_observations_valid,fresh_publisher_acquisitions,cold_retrieval_confirmed,cpu_by_path,budget_pass};
}

async function main() {
 const repo=fileURLToPath(new URL('..',import.meta.url));
 const wrangler='/workspace/.morning-rows-tools/node_modules/.bin/wrangler';
 const env={...process.env,XDG_CONFIG_HOME:'/workspace/.morning-rows-tools/config',WRANGLER_LOG:'log'};
 const [version,output,expectedRevision]=process.argv.slice(2);
 if(process.argv.length!==5||!validVersion(version)||!output||!validRevision(expectedRevision))throw Error('Usage: VERSION OUTPUT EXPECTED_REVISION');
 const approved=JSON.parse(await readFile(repo+'/verification/monitoring-baseline.json','utf8')).identity;
 const report={
  started_at:new Date().toISOString(),kind:'Fresh selected rent-source acquisition on www, actual zero-percent candidate',version,
  expected_source_revision:expectedRevision,cpu_limit_ms:budget,approved_identity:approved,checks:[],events:[],
  limitations:[
   'One selected-source acquisition and one health request at the observed edge; no percentile, sustained-load or broader latency claim.',
   'Fresh source retrieval and both distinct locality acquisition timestamps must lie within the selected request interval; no inferred cache freshness.',
   'The selected rent source is backed by the existing complete New Zealand desk request, so its CPU includes that route work.',
   'The 29-row and 116-observation counts are this release specimen, not permanent runtime coverage rules.',
   'This budget capture does not replace independent publisher reconciliation, full-desk regression acceptance or sustained operation.'
  ],
 };
 const save=()=>writeFile(output,JSON.stringify(report,null,2)+'\n');
 const deployment=async()=>{
  const {stdout}=await promisify(execFile)(wrangler,['deployments','list','--name','morning-rows','--json'],{cwd:repo,env,timeout:30000,maxBuffer:1048576});
  return latestDeployment(JSON.parse(stdout));
 };
 const read=(path,override=true,requestOrigin=origin,phase=null)=>new Promise((resolveRead,reject)=>{
  const started_at=new Date().toISOString();
  const child=spawn('curl',['--silent','--show-error','--max-time','90','--proto','=https','--include',...(override?['-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${version}"`]:[]),requestOrigin+path],{stdio:['ignore','pipe','ignore']});
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
   let body,json_valid=true;try{body=JSON.parse(text);}catch{json_valid=false;body=null;}
   resolveRead({path,override,origin:requestOrigin,phase,status,headers,body,json_valid,bytes:Buffer.byteLength(text),started_at,at:new Date().toISOString()});
  });
 });
 try{
  report.deployment_before=await deployment();
  if(!stagingMatches(report.deployment_before,version,approved))throw Error('candidate_not_staged_at_zero');
  for(const productionOrigin of PRODUCTION_ORIGINS)report.checks.push(await read('/health.json',false,productionOrigin,'before'));
  if(!report.checks.every(check=>check.json_valid&&identityMatches(check,approved)))throw Error('production_preflight_identity_mismatch');
 }catch(error){
  report.error=['candidate_not_staged_at_zero','production_preflight_identity_mismatch'].includes(error.message)?error.message:'preflight_failed';
  report.budget_pass=false;report.finished_at=new Date().toISOString();await save();console.error(report.error);process.exitCode=1;return;
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
   if(current.length>1048576){report.tail_parse_error=true;tail.kill('SIGINT');return;}
   if(escape){escape=false;continue;}
   if(inString&&c==='\\'){escape=true;continue;}
   if(c==='"'){inString=!inString;continue;}
   if(inString)continue;
   if(c==='{')depth++;
   if(c==='}')depth--;
   if(depth!==0)continue;
   try{
    const event=JSON.parse(current);let request_path=null;
    try{const url=new URL(event.event?.request?.url),path=url.pathname+url.search;if(url.origin===origin&&RENT_CPU_PATHS.includes(path))request_path=path;}catch{}
    report.events.push({request_path,outcome:event.outcome,cpu_ms:event.cpuTime,wall_ms:event.wallTime,event_timestamp:event.eventTimestamp,script_version:{id:event.scriptVersion?.id},exception_names:Array.isArray(event.exceptions)?event.exceptions.map(e=>typeof e?.name==='string'&&/^[A-Za-z0-9_. -]{1,80}$/.test(e.name)?e.name:'UnknownException'):null});
   }catch{report.tail_parse_error=true;}
   current='';
  }
 });
 const pause=ms=>new Promise(resolvePause=>setTimeout(resolvePause,ms));
 try{
  await pause(4000);
  for(const path of RENT_CPU_PATHS){
   if(report.tail_command_error||report.tail_parse_error)throw Error('tail_command_failed');
   const check=await read(path);report.checks.push(check);
   if(path==='/health.json'){
    const expected={...check.body,worker_version:version,source_revision:expectedRevision};
    if(!check.json_valid||!/^[a-f0-9]{16}$/.test(expected.build_fingerprint||'')||!identityMatches(check,expected))throw Error('candidate_preflight_identity_mismatch');
    const until=Date.now()+10000;
    while(correlations(report,check).length===0&&Date.now()<until&&!report.tail_command_error&&!report.tail_parse_error)await pause(250);
    if(correlations(report,check).length!==1)throw Error('tail_not_ready');
   }
   console.log(JSON.stringify({path,status:check.status,version:check.headers['x-worker-version'],source_revision:check.headers['x-source-revision'],bytes:check.bytes}));
  }
  const until=Date.now()+12000;
  while(!report.checks.filter(c=>c.override).every(c=>correlations(report,c).length===1)&&Date.now()<until&&!report.tail_command_error&&!report.tail_parse_error)await pause(250);
 }catch(error){
  report.error=['tail_command_failed','candidate_preflight_identity_mismatch','tail_not_ready','response_too_large','request_failed','request_start_failed','invalid_response_headers'].includes(error.message)?error.message:'capture_failed';
 }finally{
  stopping=true;tail.kill('SIGINT');
  try{
   for(const productionOrigin of PRODUCTION_ORIGINS)report.checks.push(await read('/health.json',false,productionOrigin,'after'));
   report.deployment_after=await deployment();
  }catch{report.error ||= 'production_postflight_failed';}
  report.finished_at=new Date().toISOString();
  Object.assign(report,evaluateRentSourceCpuEvidence(report,approved,version,expectedRevision));
  await save();
  console.log(JSON.stringify({output,cpu_limit_ms:budget,cpu_by_path:report.cpu_by_path,cold_retrieval_confirmed:report.cold_retrieval_confirmed,complete_event_coverage:report.complete_event_coverage,candidate_identity_confirmed:report.candidate_identity_confirmed,production_identity_confirmed:report.production_identity_confirmed,deployment_unchanged:report.deployment_unchanged,budget_pass:report.budget_pass}));
  if(!report.budget_pass)process.exitCode=1;
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
