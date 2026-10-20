import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REMAINING_CONTRACTS,REMAINING_ELIGIBLE_CONTRACT_KEYS,ORIGINS,inspectSource} from '../lib/monitor-contracts.js';
import {remainingCells} from '../lib/remaining-information.js';
import {readSfcActivity} from '../lib/sfc-activity.js';
import {CMHC_RENT_URLS,readCmhcRent} from '../lib/cmhc-rent.js';
import {applyRun} from '../lib/monitor-state.js';
import {decodeCheckpoint} from '../lib/monitor-store.js';

// Injected retained original bytes only. These controls are not public
// availability, independent publisher reconciliation or scheduled evidence.
const directory='../verification/remaining-gaps-2026-10-20/';
const bytes=path=>readFileSync(new URL(directory+path,import.meta.url));
const text=path=>bytes(path).toString('utf8');
const clone=structuredClone,clock='2026-10-20T12:00:00.000Z',later='2026-10-20T12:01:00.000Z';
const supportedContracts=REMAINING_CONTRACTS.filter(contract=>REMAINING_ELIGIBLE_CONTRACT_KEYS.includes(contract.key));
const c=key=>REMAINING_CONTRACTS.find(contract=>contract.key===key);
const sources={
 'scotland/college_activity':await readSfcActivity({now:()=>clock,fetcher:async()=>new Response(bytes('prior-audit/sfc/original/tables.xlsx'))}),
 'canada/rental_benchmark':await readCmhcRent({now:()=>clock,fetcher:async url=>{
  const role=Object.keys(CMHC_RENT_URLS).find(role=>CMHC_RENT_URLS[role]===url);
  return new Response(text('cmhc-rent/original/'+{data:'points.json',series:'series.json',cube:'cube-response-excerpt.json'}[role]));
 }}),
};
const body=(contract,value=sources[contract.key],at=clock)=>({country:contract.country,[contract.data]:clone(value),sources:{[contract.source]:{status:'ok',fetched_at:at}}});
const original=decodeCheckpoint(readFileSync(new URL('../verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json',import.meta.url),'utf8')).state;

for(const contract of supportedContracts){
 test(contract.key+': exact publisher-qualified IDs and values survive source inspection',async()=>{
  const native=sources[contract.key],result=await inspectSource(body(contract),contract),cells=remainingCells(contract.desk,contract.source,native,{retrieved_at:clock});
  assert.equal(result.kind,'success',result.reason);assert.equal(result.observations.length,contract.observation_count);
  assert.deepEqual(result.observations.map(row=>row.id).sort(),cells.map(cell=>contract.canonical_url+'&measure='+cell.definition.id+'&observation='+cell.period).sort());
  for(const row of result.observations){
   const cell=cells.find(cell=>row.id===contract.canonical_url+'&measure='+cell.definition.id+'&observation='+cell.period);
   assert.equal(row.value,cell.value);assert.equal(row.value_state,'observed');assert.deepEqual(row.definition,cell.definition);assert.ok(row.source_url&&row.licence);
  }
  assert.match(result.assurance,/independent reference approval separate/);
 });
 test(contract.key+': acquisition hashes and clocks do not manufacture a statistical revision',async()=>{
  const before=await inspectSource(body(contract),contract),changed=clone(sources[contract.key]);
  for(const item of changed.provenance){item.sha256='b'.repeat(64);item.retrieved_at=later;}
  const after=await inspectSource(body(contract,changed,later),contract);
  assert.equal(after.kind,'success',after.reason);assert.equal(after.version,before.version);assert.deepEqual(after.observations,before.observations);assert.equal(after.metadata.semantic_context_version,before.metadata.semantic_context_version);
 });
 test(contract.key+': healthy transport cannot hide missing, suppressed, duplicate or semantically altered data',async()=>{
  for(const mutate of [
   value=>{value.rows.pop();},value=>{value.rows[1]=clone(value.rows[0]);},
   value=>{value.rows[0].value=null;},value=>{value.rows[0].value=NaN;},
   value=>{value.rows[0].value_state='suppressed';},value=>{value.rows[0].unit='wrong unit';},
   value=>{value.rows[0].geography='Wrong geography';},value=>{value.rows[0].period='1900';},
   value=>{value.licence='Public domain';},
  ]){
   const changed=clone(sources[contract.key]);mutate(changed);
   assert.equal((await inspectSource(body(contract,changed),contract)).kind,'semantic');
  }
  for(const malformed of [null,{},[],{rows:[null]}])assert.equal((await inspectSource(body(contract,malformed),contract)).kind,'semantic');
 });
 test(contract.key+': retained public acquisition is required and a failed source stays local',async()=>{
  for(const invalid of [undefined,null,'bad','2026-02-30T00:00:00Z','2020-01-01T00:00:00Z']){
   const sample=body(contract);sample.sources[contract.source].fetched_at=invalid;
   assert.equal((await inspectSource(sample,contract,{now:clock})).kind,'semantic','the request clock cannot substitute a missing or prepublication source clock');
  }
  const sample=body(contract);sample.sources[contract.source]={status:'error',fetched_at:clock,error:'CONSTRUCTED publisher failure',http_status:403};
  assert.equal((await inspectSource(sample,contract)).kind,'transport');
 });
}
test('valid numerical corrections revise the monitored source while retaining exact observation identities',async()=>{
 for(const key of Object.keys(sources)){
  const contract=c(key),changed=clone(sources[key]);
  if(key==='scotland/college_activity'){changed.rows[0].value+=5;changed.rows.at(-1).value+=5;}
  else changed.rows[0].value++;
  const before=await inspectSource(body(contract),contract),after=await inspectSource(body(contract,changed),contract);
  assert.equal(after.kind,'success',key+': '+after.reason);assert.notEqual(after.version,before.version);assert.deepEqual(after.observations.map(row=>row.id),before.observations.map(row=>row.id));
 }
});
test('fixed historical snapshots and annual observations do not expire merely because time passed',async()=>{
 for(const contract of supportedContracts){
  const before=await inspectSource(body(contract),contract),after=await inspectSource(body(contract,sources[contract.key],'2027-03-01T12:00:00.000Z'),contract);
  assert.equal(after.kind,'success',after.reason);assert.equal(after.version,before.version);
 }
});
test('new source assurance requires its exact separate approval; successful siblings and prior durable state survive failure',async()=>{
 const success=c('canada/rental_benchmark'),failed=c('scotland/college_activity');
 const result=await inspectSource(body(success),success),before=clone(original);
 const run={id:'CONSTRUCTED-remaining-contract-control',finished_at:clock,scheduled:false,complete:true,requests:[],identities:{},probe_errors:[],results:{
  [success.key]:Object.fromEntries(ORIGINS.map(origin=>[origin,result])),
  [failed.key]:Object.fromEntries(ORIGINS.map(origin=>[origin,{kind:'transport',reason:'CONSTRUCTED publisher failure',retrieved_at:clock}])),
 }};
 const after=applyRun(before,run);
 assert.ok(after.sources[success.key].pending_verification);assert.equal(after.repairs['verify:'+success.key].state,'evidence_review');
 assert.deepEqual(after.incidents,before.incidents);assert.deepEqual(after.outbox,before.outbox);assert.equal(after.remaining_started_shadow_at,undefined);
 assert.ok(Object.keys(before.repairs).every(key=>JSON.stringify(before.repairs[key])===JSON.stringify(after.repairs[key])));
 const verified=applyRun(after,{...run,id:run.id+'-approved',finished_at:later},{approvedVersions:{[success.key]:{version:result.version,evidence:'CONSTRUCTED original reference approval control'}}});
 assert.equal(verified.sources[success.key].pending_verification,undefined);assert.equal(verified.repairs['verify:'+success.key].state,'resolved');
 assert.equal(verified.sequence,before.sequence+2);assert.equal(verified.remaining_started_shadow_at,undefined);
});
