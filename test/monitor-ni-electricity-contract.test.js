import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REMAINING_CONTRACTS,NI_ELECTRICITY_CONTRACT_KEY,ORIGINS,inspectSource} from '../lib/monitor-contracts.js';
import {readNiEnergySummary} from '../lib/ni-energy-summary.js';
import {applyRun} from '../lib/monitor-state.js';
import {decodeCheckpoint} from '../lib/monitor-store.js';

// Injected publisher excerpt and constructed clocks only; these tests neither
// fetch a publisher nor assert production, numerical or scheduled acceptance.
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const article=read('verification/gap-followup-2026-10-20/access-review/ni-article/statistical-article.excerpt.html');
const reference=JSON.parse(read('verification/gap-followup-2026-10-20/access-review/ni-article/comparison.json'));
const contract=REMAINING_CONTRACTS.find(c=>c.key===NI_ELECTRICITY_CONTRACT_KEY);
const clock='2026-10-20T12:30:00.000Z',later='2026-10-20T12:31:00.000Z',clone=structuredClone;
const native=await readNiEnergySummary({now:()=>clock,fetcher:async()=>new Response(article,{headers:{'content-type':'text/html'}})});
const body=(value=native,at=clock)=>({country:'Northern Ireland',electricity_balance:clone(value),sources:{electricity_balance:{status:'ok',fetched_at:at}}});
const original=decodeCheckpoint(read('verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json')).state;

test('NI monitor retains all five exact fixed-edition definitions and values',async()=>{
 const result=await inspectSource(body(),contract);
 assert.equal(result.kind,'success',result.reason);assert.equal(result.observations.length,5);
 for(const comparison of reference.comparisons){
  const row=result.observations.find(row=>row.id===contract.canonical_url+'&measure='+comparison.measure+'&observation=2025-07-01%2F2026-06-30');
  assert.equal(row.value,comparison.original_workbook);assert.equal(row.value_state,'observed');
  assert.equal(row.definition.geography,'Northern Ireland');assert.equal(row.definition.edition,'fixed_2026-09-03');
  assert.equal(row.definition.metadata_evidence.live_retrieved,false);assert.match(row.definition.limitations,/does not claim the newest/);
 }
 assert.match(result.assurance,/independent reference approval separate/);
});

test('article acquisition hash and retrieval clocks do not manufacture revisions or expire fixed observations',async()=>{
 const before=await inspectSource(body(),contract),changed=clone(native);
 changed.provenance[0].sha256='f'.repeat(64);changed.provenance[0].retrieved_at=later;changed.provenance[0].bytes++;
 const after=await inspectSource(body(changed,later),contract),historical=await inspectSource(body(native,'2027-06-01T00:00:00.000Z'),contract);
 for(const result of [after,historical]){
  assert.equal(result.kind,'success',result.reason);assert.equal(result.version,before.version);
  assert.deepEqual(result.observations,before.observations);assert.deepEqual(result.metadata,before.metadata);
 }
});

test('NI monitor rejects healthy HTTP with wrong edition, meaning, missingness or public acquisition',async()=>{
 for(const mutate of [
  value=>{value.rows.pop();},value=>{value.rows[1]=clone(value.rows[0]);},
  value=>{value.rows[0].value=null;},value=>{value.rows[0].value_state='suppressed';},
  value=>{value.rows[0].unit='GWh';},value=>{value.rows[0].geography='United Kingdom';},
  value=>{value.rows[0].period='2026-06';},value=>{value.edition='latest';},
  value=>{value.metadata.fixed_edition=false;},value=>{value.licence='Public domain';},
  value=>{value.metadata.metadata_evidence.live_retrieved=true;},value=>{value.provenance=[];},
 ]){
  const changed=clone(native);mutate(changed);assert.equal((await inspectSource(body(changed),contract)).kind,'semantic');
 }
 for(const malformed of [null,{},[],{rows:[null]}])assert.equal((await inspectSource(body(malformed),contract)).kind,'semantic');
 for(const invalid of [undefined,null,'bad','2026-02-30T00:00:00Z','2026-09-02T23:59:59Z']){
  const sample=body();sample.sources.electricity_balance.fetched_at=invalid;
  assert.equal((await inspectSource(sample,contract,{now:clock})).kind,'semantic','outer capture time cannot replace invalid source acquisition');
 }
});

test('a consistent publisher correction changes its version without silently approving it or its future edition',async()=>{
 const before=await inspectSource(body(),contract),changed=clone(native);
 changed.rows.find(row=>row.measure_id==='gross_final_consumption').value++;
 const after=await inspectSource(body(changed),contract);
 assert.equal(after.kind,'success',after.reason);assert.notEqual(after.version,before.version);
 assert.deepEqual(after.observations.map(row=>row.id),before.observations.map(row=>row.id));
 const run={id:'CONSTRUCTED-ni-source-revision',finished_at:clock,scheduled:false,complete:true,requests:[],identities:{},probe_errors:[],results:{[contract.key]:Object.fromEntries(ORIGINS.map(origin=>[origin,after]))}};
 const saved=clone(original),pending=applyRun(original,run,{approvedVersions:{[contract.key]:{version:before.version,evidence:'CONSTRUCTED older exact-version evidence'}}});
 assert.deepEqual(original,saved);assert.equal(pending.sources[contract.key].pending_verification.version,after.version);
 assert.equal(pending.repairs['verify:'+contract.key].state,'evidence_review');
 assert.deepEqual(pending.incidents,original.incidents);assert.deepEqual(pending.outbox,original.outbox);
 assert.equal(pending.ni_electricity_started_shadow_at,undefined);
 const approved=applyRun(pending,{...run,id:run.id+'-explicit-approval',finished_at:later},{approvedVersions:{[contract.key]:{version:after.version,evidence:'CONSTRUCTED separately reconciled exact correction'}}});
 assert.equal(approved.sources[contract.key].pending_verification,undefined);
 assert.equal(approved.repairs['verify:'+contract.key].state,'resolved');
 assert.equal(approved.ni_electricity_started_shadow_at,undefined);
});

test('a publisher retrieval failure remains local and cannot erase retained incidents or delivery history',async()=>{
 const sample=body();sample.sources.electricity_balance={status:'error',fetched_at:clock,error:'CONSTRUCTED publisher failure',http_status:403};
 const failed=await inspectSource(sample,contract);assert.equal(failed.kind,'transport');
 const run={id:'CONSTRUCTED-ni-source-failure',finished_at:clock,scheduled:false,complete:true,requests:[],identities:{},probe_errors:[],results:{[contract.key]:Object.fromEntries(ORIGINS.map(origin=>[origin,failed]))}};
 const state=applyRun(original,run);
 assert.deepEqual(state.incidents,original.incidents);assert.deepEqual(state.repairs,original.repairs);assert.deepEqual(state.outbox,original.outbox);
 assert.equal(state.ni_electricity_started_shadow_at,undefined);
});
