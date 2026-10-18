import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const dir=fileURLToPath(new URL('.',import.meta.url));
const root=resolve(dir,'../..');
const producer=resolve(process.env.PRODUCER_ROOT||root);
const read=name=>JSON.parse(readFileSync(resolve(dir,name),'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const manifest=read('manifest.json');
for(const [path,digest]of Object.entries(manifest.retained_file_sha256))assert.equal(sha(resolve(dir,path)),digest,path);
for(const [path,digest]of Object.entries(manifest.producer_file_sha256))assert.equal(sha(resolve(producer,path)),digest,'Producer file changed: '+path);
// Verify archive members byte for byte, not only their compressed-archive hashes.
execFileSync('python',['-c',`import zipfile,pathlib,sys
p=pathlib.Path(sys.argv[1])
for archive,members in [('checkpoint.zip',{'checkpoint.json':'checkpoint.json'}),('evidence.zip',{'morning-rows-monitor-output/report.json':'report.json','morning-rows-monitor-output/summary.json':'summary.json','morning-rows-monitor/restored.json':'restored.json'})]:
 with zipfile.ZipFile(p/archive) as z:
  assert set(z.namelist())==set(members)
  assert sum(i.file_size for i in z.infolist())<4194304
  for member,target in members.items(): assert z.read(member)==(p/target).read_bytes()
`,dir]);
const {decodeCheckpoint}=await import(pathToFileURL(resolve(producer,'lib/monitor-store.js')));
const {applyRun,shadowStatus,watchdog}=await import(pathToFileURL(resolve(producer,'lib/monitor-state.js')));
const {fingerprint,REGISTRY,ORIGINS}=await import(pathToFileURL(resolve(producer,'lib/monitor-contracts.js')));
const run=read('attempt.json'),listing=read('runs.json'),jobs=read('jobs.json').jobs;
const artifacts=read('artifacts.json').artifacts,restored=read('restored.json');
assert.equal(listing.total_count,listing.workflow_runs.length,'Incomplete pagination');
const executions=listing.workflow_runs.filter(r=>r.path==='.github/workflows/monitor.yml'&&r.head_branch==='main').sort((a,b)=>b.run_number-a.run_number||b.run_attempt-a.run_attempt);
assert.equal(executions[0].id,run.id);assert.equal(executions[1].id,39083249445);
assert.equal(run.id,39176195113);assert.equal(run.run_number,9);assert.equal(run.run_attempt,1);
assert.equal(run.path,'.github/workflows/monitor.yml');assert.equal(run.workflow_id,388034330);
assert.equal(run.event,'schedule');assert.equal(run.head_branch,'main');assert.equal(run.conclusion,'success');assert.equal(run.status,'completed');
assert.equal(run.head_sha,manifest.producer_revision);assert.equal(read('main.json').commit.sha,run.head_sha);
assert.equal(run.created_at,'2026-10-18T23:21:47Z');assert.equal(run.run_started_at,run.created_at);
assert(Date.parse(executions[1].updated_at)<Date.parse(run.created_at));
assert(Date.parse(run.updated_at)-Date.parse(run.run_started_at)<12*60*1000);
assert.equal(jobs.length,1);assert.equal(jobs[0].conclusion,'success');assert.equal(jobs[0].run_id,run.id);
for(const name of ['Restore existing checkpoint','Preserve restored checkpoint before collection','Collect public observations in shadow mode','Checkpoint','Evidence'])assert.equal(jobs[0].steps.find(s=>s.name===name)?.conclusion,'success',name);
for(const name of ['Explicit first bootstrap','Queue authorized notification-path test','Persist an authorized delivery receipt'])assert.equal(jobs[0].steps.find(s=>s.name===name)?.conclusion,'skipped',name);
for(const [name,id,file]of [['morning-rows-monitor-checkpoint',12154666619,'checkpoint.zip'],['morning-rows-monitor-evidence',12154532315,'evidence.zip']]){
 const a=artifacts.filter(a=>a.name===name);assert.equal(a.length,1);assert.equal(a[0].id,id);assert.equal(a[0].expired,false);
 assert.equal(a[0].workflow_run.id,run.id);assert.equal(a[0].workflow_run.head_sha,run.head_sha);assert.equal(a[0].workflow_run.head_branch,'main');
 assert.equal(a[0].digest,'sha256:'+sha(resolve(dir,file)));
}
const prior=decodeCheckpoint(readFileSync(resolve(root,'verification/checkpoint-recovery-2026-10-18/manual-collection/checkpoint.json'),'utf8'));
const next=decodeCheckpoint(readFileSync(resolve(dir,'checkpoint.json'),'utf8'));
assert.equal(prior.digest,'644b38393bbd76e98ad77f4cf9dcb97595f273d2a9c0ed730a72e558f1bd93d9');
assert.equal(next.digest,'aba5cf8b893790843e6d92468cb6d09c67b286c90edc2f70443d8fcf977f68a0');
assert.equal(next.previous_digest,prior.digest);assert.equal(prior.state.sequence,3);assert.equal(next.state.sequence,4);
assert.equal(restored.digest,prior.digest);assert.equal(restored.previous_digest,prior.previous_digest);assert.equal(restored.state_sequence,3);
assert.equal(restored.artifact_id,12120081333);assert.equal(restored.producer_run,39083249445);assert.equal(restored.producer_attempt,1);
assert.equal(restored.producer_revision,executions[1].head_sha);assert.equal(restored.producer_run_number,8);
assert.equal(restored.current_run,run.id);assert.equal(restored.current_attempt,1);assert.equal(restored.recovery,null);
const report=read('report.json'),summary=read('summary.json');
assert.equal(report.producer.revision,run.head_sha);assert.equal(report.producer.workflow_run,String(run.id));assert.equal(report.producer.kind,'github-actions');
assert.equal(report.scheduled,true);assert.equal(report.complete,true);assert.deepEqual(report.probe_errors,[]);
assert(Date.parse(report.started_at)>=Date.parse(restored.restored_at));assert(Date.parse(report.finished_at)<Date.parse(run.updated_at));
const desks=[...new Set(REGISTRY.map(r=>r.desk))];assert.equal(desks.length,8);assert.equal(REGISTRY.length,108);
const expected=ORIGINS.flatMap(o=>['/health.json','/catalog.json',...desks.map(d=>'/'+d+'.json')].map(p=>o+p)).sort();
assert.deepEqual(report.requests.map(r=>r.url).sort(),expected);assert(report.requests.every(r=>r.status===200));
assert.deepEqual(Object.keys(report.results).sort(),REGISTRY.map(r=>r.key).sort());
for(const v of Object.values(report.results))assert.deepEqual(Object.keys(v).sort(),[...ORIGINS].sort());
assert.deepEqual(Object.keys(report.identities).sort(),[...ORIGINS].sort());
for(const identity of Object.values(report.identities))assert.deepEqual(identity,prior.state.approved_identity);
const approvals=JSON.parse(readFileSync(resolve(producer,'operations/approved-observations.json'),'utf8'));
assert.deepEqual(applyRun(prior.state,report,{approvedVersions:approvals}),next.state,'Full state transition must match exactly');
assert.deepEqual(next.state.outbox,prior.state.outbox);
assert.equal(next.state.outbox.length,1);assert.equal(next.state.outbox[0].id,'12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6');
assert.equal(next.state.outbox[0].status,'pending');assert.equal(next.state.outbox[0].receipt,undefined);
for(const section of ['incidents','repairs'])assert.deepEqual(Object.keys(next.state[section]).sort(),Object.keys(prior.state[section]).sort());
for(const [key,incident]of Object.entries(prior.state.incidents)){
 const n=next.state.incidents[key];for(const field of ['id','opened_at','acknowledged','severity','kind'])assert.deepEqual(n[field],incident[field],key+'/'+field);
}
const changedRepairs=Object.keys(next.state.repairs).filter(k=>fingerprint(next.state.repairs[k])!==fingerprint(prior.state.repairs[k]));
assert.deepEqual(changedRepairs,['verify:new-zealand/prices']);
assert.equal(next.state.repairs[changedRepairs[0]].kind,'new_period');assert.equal(next.state.repairs[changedRepairs[0]].state,'evidence_review');
const perDesk=Object.fromEntries(desks.map(d=>[d,{success:0,failure:0}]));
for(const [k,v]of Object.entries(report.results))perDesk[k.split('/')[0]][Object.values(v).every(x=>x.kind==='success')?'success':'failure']++;
assert(Object.values(perDesk).every(v=>v.success>0));
assert.equal(next.state.started_shadow_at,report.finished_at);assert.equal(next.state.last_complete_collection_at,report.finished_at);
assert.equal(next.state.runs.filter(r=>r.scheduled).length,1);
assert.equal(summary.run_id,report.id);assert.equal(summary.complete,true);assert.equal(summary.requests,20);assert.equal(summary.sequence,4);
assert.equal(summary.open_incidents,33);assert.equal(summary.pending_notifications,1);
assert.deepEqual(summary.shadow,shadowStatus(next.state,report.finished_at));
const wake=read('watchdog.json');assert.equal(wake.id,'6ad2f1fd41e481918b13871769eedd0f');assert.equal(wake.is_enabled,true);
assert.equal(wake.last_run_time,manifest.verification_wake);assert(Date.parse(wake.last_run_time)>Date.parse(run.updated_at));
assert.equal(watchdog(next.state,wake.last_run_time),'monitor_recent');
const comparison={scheduled_gate_passed:true,run_id:run.id,attempt:1,producer_revision:run.head_sha,scheduled_run_started_at:run.run_started_at,shadow_started_at:next.state.started_shadow_at,sequence:4,previous_digest:next.previous_digest,digest:next.digest,full_state_replay_match:true,open_incidents:33,pending_repairs:Object.values(next.state.repairs).filter(r=>r.state!=='resolved').length,changed_repairs:changedRepairs,outbox_unchanged:true,delivery_receipt_present:false,production_identity_unchanged:true,per_desk:perDesk,watchdog_wake:wake.last_run_time,watchdog_status:watchdog(next.state,wake.last_run_time),shadow:shadowStatus(next.state,wake.last_run_time),next_complete_checkpoint_deadline:new Date(Date.parse(report.finished_at)+26*3600000).toISOString(),bounded_contract:'NZ-PRICES',bounded_contract_accepted:false};
if(process.argv.includes('--write'))writeFileSync(resolve(dir,'comparison.json'),JSON.stringify(comparison,null,2)+'\n');
else assert.deepEqual(read('comparison.json'),comparison);
console.log(JSON.stringify(comparison,null,2));
