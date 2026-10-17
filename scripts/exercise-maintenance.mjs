// Constructed failure drill using real retained aggregates. Never live evidence.
import {readFile,writeFile,mkdtemp,rm}from 'node:fs/promises';
import {tmpdir}from 'node:os';import {join}from 'node:path';import assert from 'node:assert/strict';
import {REGISTRY,ORIGINS,inspectSource}from '../lib/monitor-contracts.js';
import {initialState,applyRun,acknowledge,watchdog}from '../lib/monitor-state.js';
import {saveCheckpoint,loadCheckpoint}from '../lib/monitor-store.js';
const snapshot=JSON.parse(await readFile('verification/structure-2026-10-17/selected-snapshot.json'));
const source=REGISTRY.find(r=>r.key==='australia/hospital'),sibling=REGISTRY.find(r=>r.key==='canada/exchange');
const good=await inspectSource(snapshot.australia,source),other=await inspectSource(snapshot.canada,sibling);
const base=Date.parse('2026-10-18T00:00:00Z'),at=m=>new Date(base+m*60000).toISOString();
const report=(m,r)=>({id:`constructed-${m}`,finished_at:at(m),complete:true,scheduled:false,requests:[],probe_errors:[],results:{[source.key]:Object.fromEntries(ORIGINS.map(o=>[o,r])),[sibling.key]:Object.fromEntries(ORIGINS.map(o=>[o,other]))}});
const approval={approvedVersions:{[source.key]:{version:good.version,evidence:'verification/structure-2026-10-17/publisher-reference.json'}}};
let state=applyRun(initialState(at(0),{}),report(0,good),approval);const trace=[];
const broken=structuredClone(snapshot.australia);broken.hospital.measure_code='INJECTED-WRONG-MEASURE';
const bad=await inspectSource(broken,source);assert.equal(bad.kind,'semantic');
state=applyRun(state,report(1,bad));const incident=state.incidents[source.key];
assert.equal(state.sources[source.key].last_independently_verified.at,at(0));assert.equal(state.sources[sibling.key].last_successful_retrieval_at,at(1));
trace.push({step:'detect and diagnose',at:at(1),incident_id:incident.id,reason:bad.reason,repair:state.repairs[incident.id],sibling_preserved:true,prior_verified_timestamp_preserved:true});
const dir=await mkdtemp(join(tmpdir(),'mr-drill-')),path=join(dir,'state.json');
try{
 const saved=await saveCheckpoint(path,state,null);await writeFile(path+'.interrupted.tmp','injected interrupted write');
 state=(await loadCheckpoint(path)).state;assert.equal(state.outbox[0].status,'pending');
 trace.push({step:'restart after injected interrupted write and notification-delivery failure',state_digest:saved.digest,event_status:state.outbox[0].status,incident_preserved:true});
 // Repair preparation is the bounded incident record. The selected correct
 // specimen is the candidate, separately replayed against original publisher cells.
 state=applyRun(state,report(20,good),approval);assert.ok(state.incidents[source.key]);
 state=applyRun(state,report(40,good),approval);assert.equal(state.incidents[source.key],undefined);
 const failure=state.outbox.find(e=>e.type==='failure'),recovery=state.outbox.find(e=>e.type==='recovery');assert.ok(failure&&recovery);
 trace.push({step:'candidate verification and simulated release checks',publisher_reference:approval.approvedVersions[source.key].evidence,checks:'Restored exact measure, dimensions and values; both simulated domain results healthy twice, 20 minutes apart',incident_closed_at:at(40),production_release_executed:false});
 state=acknowledge(state,failure.id,'CONSTRUCTED fake destination receipt; not a delivered user message',at(41));
 const end=await saveCheckpoint(path,state,saved.digest);assert.equal((await loadCheckpoint(path)).state.outbox.find(e=>e.id===failure.id).status,'delivered');
 trace.push({step:'simulated acknowledgment persisted',event_id:failure.id,receipt_kind:'constructed test only',recovery_event_pending:recovery.status==='pending',state_digest:end.digest});
 assert.equal(watchdog(state,at(300)),'monitor_overdue');assert.equal(state.started_shadow_at,null);
 trace.push({step:'independent-check predicate',at:at(300),result:'monitor_overdue',scheduled_check_executed:false});
}finally{await rm(dir,{recursive:true,force:true});}
await writeFile('verification/operations-2026-10-18/operating-cycle-drill.json',JSON.stringify({kind:'constructed fault injection and simulated transitions; not scheduled operation, live release or actual notification',original_aggregate:'verification/structure-2026-10-17/publisher-reference.json',trace,limitations:'Actual GitHub restart has separate evidence. Actual notification receipt and independent scheduled watchdog remain separate gates. No simulated time counts toward shadow days.'},null,2)+'\n');
console.log('Constructed complete operating-cycle drill passed; no production change or real notification.');
