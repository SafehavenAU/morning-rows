// Deterministic public-only collection. Durable hosting/notifications are adapters.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {REGISTRY,ORIGINS,fingerprint,inspectSource,validateDiscovery} from '../lib/monitor-contracts.js';
import {initialState,importAcknowledged,applyRun,shadowStatus,acknowledge,watchdog,queueDeliveryTest} from '../lib/monitor-state.js';
import {loadCheckpoint,saveCheckpoint,withLock} from '../lib/monitor-store.js';
const exec=promisify(execFile);
export async function publicRead(url){
 const {stdout}=await exec('curl',['--silent','--show-error','--proto','=https','--max-time','45','--max-filesize','2097152','--dump-header','-','--write-out','\n%{http_code}',url],{maxBuffer:2200000,timeout:47000});
 const cut=stdout.lastIndexOf('\n'),status=Number(stdout.slice(cut+1));let body=stdout.slice(0,cut),headers={};
 while(body.startsWith('HTTP/')){const end=body.indexOf('\r\n\r\n');if(end<0)throw Error('Malformed HTTP headers');for(const line of body.slice(0,end).split('\r\n').slice(1)){const p=line.indexOf(':');if(p>0&&['content-type','cache-control','etag','retry-after','age'].includes(line.slice(0,p).toLowerCase()))headers[line.slice(0,p).toLowerCase()]=line.slice(p+1).trim();}body=body.slice(end+4);}
 let data;try{data=JSON.parse(body);}catch{}return {status,headers,bytes:Buffer.byteLength(body),body_digest:fingerprint(body),data};
}
export async function collect({read=publicRead,now=()=>new Date().toISOString(),id=crypto.randomUUID(),deadlineMs=11*60000}={}){
 const run={id,started_at:now(),scheduled:process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_EVENT_NAME==='schedule',producer:{kind:process.env.GITHUB_ACTIONS==='true'?'github-actions':'manual',revision:process.env.GITHUB_SHA||null,workflow_run:process.env.GITHUB_RUN_ID||null},requests:[],results:{},probe_errors:[],identities:{},complete:true};const start=Date.now();
 const desks=[...new Set(REGISTRY.map(r=>r.desk))],tasks=ORIGINS.flatMap(origin=>['/health.json','/catalog.json',...desks.map(d=>`/${d}.json`)].map(path=>({origin,path})));
 let next=0;
 await Promise.all(Array.from({length:2},async()=>{while(next<tasks.length){const {origin,path}=tasks[next++],url=origin+path;
  try{
   if(Date.now()-start>deadlineMs)throw Error('Collection deadline reached; probe not executed');const began=Date.now(),r=await read(url);
   run.requests.push({url,status:r.status,at:now(),duration_ms:Date.now()-began,bytes:r.bytes,body_digest:r.body_digest,headers:r.headers});
   if(r.status!==200||!r.data)throw Error(`HTTP/JSON probe failed (${r.status})`);
   if(path==='/health.json'){if(!r.data.worker_version||!/^[a-f0-9]{40}$/.test(r.data.source_revision||'')||r.data.source_dirty!==false)throw Error('Invalid or dirty release identity');run.identities[origin]=r.data;continue;}
   if(path==='/catalog.json'){if(!validateDiscovery(r.data))throw Error('Eight-desk catalogue contract failed');continue;}
   const desk=path.slice(1,-5),contracts=REGISTRY.filter(c=>c.desk===desk);
   if(r.data.country!==contracts[0].country||!r.data.sources)throw Error('Desk envelope missing or wrong country');
   for(const c of contracts){run.results[c.key] ||= {};run.results[c.key][origin]=await inspectSource(r.data,c);}
  }catch(e){run.probe_errors.push({url,at:now(),reason:e.message});run.complete=false;}
 }}));
 if(Object.keys(run.results).length!==108||Object.values(run.results).some(v=>Object.keys(v).length!==2))run.complete=false;
 const identities=Object.values(run.identities);if(identities.length!==2||identities[0].worker_version!==identities[1].worker_version||identities[0].source_revision!==identities[1].source_revision){run.complete=false;run.probe_errors.push({reason:'Both-domain release identity mismatch or unavailable'});}
 run.finished_at=now();run.elapsed_ms=Date.now()-start;return run;
}
async function main(){
 const [command,...args]=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
 const statePath=option('--state');if(!statePath)throw Error('--state outside repository required');const repoRoot=resolve(new URL('..',import.meta.url).pathname);if(!relative(repoRoot,resolve(statePath)).startsWith('..'))throw Error('Checkpoint must live outside repository');const output=option('--output','/tmp/morning-rows-monitor-run');
 if(!['run','bootstrap','status','ack','test-delivery'].includes(command))throw Error('Use bootstrap, run, status, ack or test-delivery');
 if(command==='status'){const e=await loadCheckpoint(statePath);console.log(JSON.stringify({sequence:e.state.sequence,last_complete_collection_at:e.state.last_complete_collection_at,watchdog:watchdog(e.state,new Date().toISOString()),shadow:shadowStatus(e.state,new Date().toISOString()),incidents:e.state.incidents,pending_events:e.state.outbox.filter(x=>x.status==='pending')},null,2));return;}
 await withLock(statePath,async()=>{
  if(command==='bootstrap'){
   const baselinePath=option('--baseline');if(!baselinePath)throw Error('Explicit --baseline required; no automatic empty reset');
   const baseline=JSON.parse(await readFile(baselinePath,'utf8')),s=importAcknowledged(initialState(new Date().toISOString(),baseline.identity,JSON.parse(await readFile(option('--policy','operations/monitor-policy.json'),'utf8'))),baseline,new Date().toISOString());
   await saveCheckpoint(statePath,s,null);console.log('Acknowledged baseline imported; no notifications.');return;
  }
  const prior=await loadCheckpoint(statePath);
  if(command==='test-delivery'){const s=queueDeliveryTest(prior.state,new Date().toISOString());await saveCheckpoint(statePath,s,prior.digest);console.log('Labeled delivery-test event queued; no notification sent.');return;}
  if(command==='ack'){const s=acknowledge(prior.state,option('--event'),option('--receipt'),new Date().toISOString());await saveCheckpoint(statePath,s,prior.digest);console.log('Delivery receipt persisted.');return;}
  const report=await collect(),approvalPath=option('--approvals'),approvedVersions=approvalPath?JSON.parse(await readFile(approvalPath,'utf8')):{};
  const state=applyRun(prior.state,report,{approvedVersions});await mkdir(output,{recursive:true});
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const saved=await saveCheckpoint(statePath,state,prior.digest);await writeFile(resolve(output,'checkpoint.json'),JSON.stringify(saved)+'\n');
  const summary={run_id:report.id,complete:report.complete,requests:report.requests.length,bytes:report.requests.reduce((n,r)=>n+(r.bytes||0),0),elapsed_ms:report.elapsed_ms,sequence:state.sequence,open_incidents:Object.keys(state.incidents).length,pending_notifications:state.outbox.filter(x=>x.status==='pending').length,shadow:shadowStatus(state,report.finished_at),mode:'shadow; no notifications sent'};
  await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));if(!report.complete)process.exitCode=2;
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(JSON.stringify({monitor_error:e.message,source_state_not_reset:true}));process.exitCode=2;});
