import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chooseCheckpoint,selectProducer,readPages,validateArchive,validateRestoredText,validateRecoveryEvidence,assertFirstBootstrap} from '../lib/monitor-artifact.js';
import {chooseCheckpoint as defective} from '../verification/checkpoint-recovery-2026-10-18/original/lib/monitor-artifact.js';
const fixture=JSON.parse(await readFile(new URL('../verification/checkpoint-recovery-2026-10-18/github-evidence.json',import.meta.url)));
const review=JSON.parse(await readFile(new URL('../operations/checkpoint-recovery-review.json',import.meta.url)));
const specimen=id=>readFile(new URL(`../verification/checkpoint-recovery-2026-10-18/${id}.json`,import.meta.url),'utf8');
const now=Date.parse('2026-10-18T00:00:00Z');
// Constructed next execution; never evidence of a real scheduled run.
const next={...fixture.runs[0],id:99,run_number:7,run_started_at:'2026-10-18T00:00:00Z',updated_at:'2026-10-18T00:00:01Z',event:'workflow_dispatch',status:'in_progress',conclusion:null};
const runs=[...fixture.runs,next];
const options={recovery:review,now};
const choose=(artifacts=fixture.artifacts,history=runs,opts=options)=>chooseCheckpoint(artifacts,history,99,opts);
const clone=x=>structuredClone(x);

test('observed ID inversion fails original implementation and selects delivery-test producer after repair',()=>{
 assert.throws(()=>defective(fixture.artifacts,fixture.runs,39078664324),/later monitor/);
 const actual=chooseCheckpoint(fixture.artifacts,fixture.runs,39078664324,{now});
 assert.equal(actual.artifact.id,12117561506);assert.equal(actual.producer.id,39077529097);
 assert.ok(12117945370>actual.artifact.id);
});
test('newer failed run without checkpoint blocks normal restoration',()=>{
 assert.throws(()=>choose(fixture.artifacts,runs,{now}),/Latest producer has no checkpoint/);
 assert.throws(()=>choose([],fixture.runs,{now}),/Current execution/);
});
test('only exact reviewed failure can be crossed by explicit manual recovery',()=>{
 assert.equal(choose().artifact.id,12117561506);
 for(const key of ['id','head_sha','run_attempt','conclusion','updated_at']){
  const changed=clone(runs);const r=changed.find(x=>x.id===39078664324);r[key]=key==='run_attempt'?2:'changed';
  assert.throws(()=>choose(fixture.artifacts,changed),/recovery|identity|Rerun|timestamps/i);
 }
 const scheduled=clone(runs);scheduled.at(-1).event='schedule';assert.throws(()=>choose(fixture.artifacts,scheduled),/manual dispatch/);
 const later={...next,id:100,run_number:8,run_started_at:'2026-10-18T00:02:00Z',updated_at:'2026-10-18T00:02:01Z'};
 assert.throws(()=>selectProducer([...runs.map(r=>r.id===99?{...r,status:'completed'}:r),later],100,options),/exact failed execution/);
});
test('failed-attempt evidence must still show no state-producing step or artifacts',()=>{
 validateRecoveryEvidence(review,fixture.failed_jobs,[]);
 for(const name of ['Collect public observations in shadow mode','Persist an authorized delivery receipt','Queue authorized notification-path test','Explicit first bootstrap']){
  const jobs=clone(fixture.failed_jobs);jobs[0].steps.find(s=>s.name===name).conclusion='success';
  assert.throws(()=>validateRecoveryEvidence(review,jobs,[]),/step evidence/);
 }
 assert.throws(()=>validateRecoveryEvidence(review,fixture.failed_jobs,[fixture.artifacts[0]]),/now has artifacts/);
 assert.throws(()=>validateRecoveryEvidence(review,[{...fixture.failed_jobs[0],run_attempt:2}],[]),/attempt evidence/);
});
test('unrelated branches, workflows and PR runs cannot select an artifact',()=>{
 const noise=[{...next,id:100,run_number:100,path:'.github/workflows/check.yml'},{...next,id:101,run_number:101,head_branch:'feature'},{...next,id:102,run_number:102,event:'pull_request'}];
 assert.equal(choose([...fixture.artifacts,{...fixture.artifacts[0],id:999999999999,workflow_run:{id:100}}],[...runs,...noise]).artifact.id,12117561506);
});
test('run IDs and artifact IDs do not define execution order; conflicting chronology fails',()=>{
 const changed=clone(fixture.runs);changed.find(r=>r.id===39077460651).id=999999999999;
 const artifacts=clone(fixture.artifacts);artifacts.find(a=>a.workflow_run.id===39077460651).workflow_run.id=999999999999;
 assert.equal(chooseCheckpoint(artifacts,changed,39078664324,{now}).producer.id,39077529097);
 for(const mutate of [r=>r.run_number=5,r=>r.run_started_at='2026-10-17T23:03:33Z',r=>r.run_attempt=2,r=>r.workflow_id=1]){
  const h=clone(runs);mutate(h.find(r=>r.id===39078664324));assert.throws(()=>choose(fixture.artifacts,h));
 }
});
test('all history pages are read; incomplete or changing history fails closed',async()=>{
 const hidden=clone(runs);const pages=[hidden.slice(0,2),hidden.slice(2)];let calls=0;
 const all=await readPages(async()=>({total_count:hidden.length,workflow_runs:pages[calls++]}),'runs?branch=main','workflow_runs');
 assert.equal(calls,2);assert.equal(choose(fixture.artifacts,all).producer.id,39077529097);
 await assert.rejects(readPages(async()=>({total_count:2,artifacts:[]}),'a','artifacts'),/Incomplete/);
 let p=0;await assert.rejects(readPages(async()=>({total_count:++p===1?2:3,artifacts:[{id:p}]}),'a','artifacts'),/changed/);
 await assert.rejects(readPages(async()=>({total_count:1001,artifacts:[]}),'a','artifacts'),/ceiling/);
 await assert.rejects(readPages(async()=>({total_count:2,artifacts:[{id:1},{id:1}]}),'a','artifacts'),/Duplicate/);
});
test('an older incomplete execution cannot be hidden by a newer completed producer',()=>{
 const history=clone(runs);history.find(r=>r.id===39077382567).status='in_progress';
 assert.throws(()=>choose(fixture.artifacts,history),/Incomplete or overlapping/);
});
test('expired, missing, duplicate, wrong-revision and wrong-attempt artifacts never fall back',()=>{
 for(const mutate of [a=>a.expired=true,a=>a.digest=null,a=>a.workflow_run.head_sha='a'.repeat(40),a=>a.workflow_run.head_repository_id=1,a=>a.created_at='2026-10-17T22:00:00Z',a=>a.size_in_bytes=5000000]){
  const a=clone(fixture.artifacts);mutate(a.find(x=>x.id===12117561506));assert.throws(()=>choose(a));
 }
 assert.throws(()=>choose(fixture.artifacts.filter(x=>x.id!==12117561506)),/no checkpoint/);
 assert.throws(()=>choose([...fixture.artifacts,fixture.artifacts.find(x=>x.id===12117561506)]),/Ambiguous/);
});
test('archive corruption and uncompressed malformed state are rejected before restoration',async()=>{
 assert.throws(()=>validateArchive(Buffer.from('damaged'),fixture.artifacts[0]),/digest or size/);
 const text=await specimen(12117561506);const e=JSON.parse(text);e.state.sequence=3;
 assert.throws(()=>validateRestoredText(JSON.stringify(e),review),/corrupt/);
 assert.throws(()=>validateRestoredText(text,{...review,predecessor:{...review.predecessor,previous_digest:'0'.repeat(64)}}),/lineage/);
 assert.throws(()=>validateRestoredText('partial'),/not JSON/);
});
test('real checkpoint chain preserves notification-only change at unchanged collection sequence',async()=>{
 const first=validateRestoredText(await specimen(12117109140));
 const collect=validateRestoredText(await specimen(12117945370));
 const notified=validateRestoredText(await specimen(12117561506),review);
 assert.equal(collect.previous_digest,first.digest);assert.equal(notified.previous_digest,collect.digest);
 assert.equal(collect.state.sequence,notified.state.sequence);assert.notEqual(collect.digest,notified.digest);
 const before=clone(collect.state),after=clone(notified.state);delete before.outbox;delete after.outbox;assert.deepEqual(after,before);
 assert.equal(notified.state.outbox.length,1);assert.equal(notified.state.outbox[0].status,'pending');assert.equal(notified.state.outbox[0].receipt,undefined);
});
test('recovery rehearsal copies every field without acknowledging or resetting; existing file cannot be overwritten',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mr-recovery-'));try{
  const text=await specimen(12117561506);validateRestoredText(text,review);
  await writeFile(join(dir,'state.json'),text,{flag:'wx',mode:0o600});
  const copy=await readFile(join(dir,'state.json'),'utf8');assert.equal(copy,text);assert.deepEqual(JSON.parse(copy),JSON.parse(text));
  await assert.rejects(writeFile(join(dir,'state.json'),'reset',{flag:'wx'}),{code:'EEXIST'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('bootstrap cannot bypass existing incidents or interrupted upload history',()=>{
 assert.throws(()=>assertFirstBootstrap([],runs,99),/history/);
 assert.throws(()=>assertFirstBootstrap(fixture.artifacts,[],99),/history/);
});

test('actual restoration adapter rehearses recovery with mocked GitHub and original ZIP, without state changes',async()=>{
 const {rehearse}=await import('../scripts/rehearse-checkpoint-recovery.mjs');
 const r=await rehearse();assert.equal(r.checkpoint_byte_identical,true);assert.deepEqual(r.changed_fields,[]);assert.equal(r.outbox[0].status,'pending');
});
