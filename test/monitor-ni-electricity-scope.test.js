import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 REGISTRY,ORIGINS,REMAINING_SCOPE,REMAINING_ELIGIBLE_CONTRACT_KEYS,
 NI_ELECTRICITY_SCOPE,NI_ELECTRICITY_CONTRACT_KEY,NI_ELECTRICITY_SOURCE_KEYS,
 validateRemainingSourceKeys,validateNiElectricitySourceKeys,
} from '../lib/monitor-contracts.js';
import {applyRun,reviewedReleasePlan,remainingShadowStatus,dailyHistoryShadowStatus,niElectricityShadowStatus} from '../lib/monitor-state.js';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {collect} from '../scripts/monitor.mjs';
import {buildMonitorRegistry} from '../scripts/monitor-registry.mjs';
import {catalogue} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';

// Retained accepted inputs are pinned independently of future active reviews.
// Every new identity, execution and clock below is CONSTRUCTED test evidence.
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const priorReview=JSON.parse(read('verification/remaining-gaps-2026-10-20/release-validation/monitoring/proposal/review.json'));
const original=decodeCheckpoint(read('verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json')).state;
const clone=structuredClone,baseKeys=[...REMAINING_ELIGIBLE_CONTRACT_KEYS],keys=[...NI_ELECTRICITY_SOURCE_KEYS];
const target={source_revision:'e'.repeat(40),worker_version:'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',build_fingerprint:'e'.repeat(16),source_dirty:false};
const at=minute=>new Date(Date.parse('2026-10-21T12:00:00Z')+minute*60000).toISOString();
const review=()=>({...clone(priorReview),continuations:[...clone(priorReview.continuations),{from:clone(priorReview.continuations.at(-1).to),to:clone(target),scope:NI_ELECTRICITY_SCOPE,source_contracts:[...keys],evidence:'CONSTRUCTED NI fixed-edition release control'}]});
const run=(minute=0,changes={})=>({id:'CONSTRUCTED-ni-scope-'+minute,finished_at:at(minute),scheduled:false,complete:true,scope:NI_ELECTRICITY_SCOPE,source_contracts:[...keys],identities:Object.fromEntries(ORIGINS.map(origin=>[origin,clone(target)])),requests:Array.from({length:24},()=>({constructed:true})),results:{},probe_errors:[],...changes});
const starts=['started_shadow_at','us_started_shadow_at','claimants_started_shadow_at','market_rent_started_shadow_at','daily_history_started_shadow_at','remaining_started_shadow_at'];

test('NI requires its dedicated scope; the historical remaining set and registry stay exact',()=>{
 assert.equal(REGISTRY.length,108);assert.equal(reviewedReleasePlan(priorReview).reviews.length,6);
 assert.equal(reviewedReleasePlan(priorReview).includeNiElectricity,false);
 assert.throws(()=>validateRemainingSourceKeys(keys));
 assert.deepEqual(validateNiElectricitySourceKeys(keys),keys);
 const before=buildMonitorRegistry(priorReview),after=buildMonitorRegistry(review());
 assert.equal(before.sources.length,118);assert.equal(after.sources.length,119);
 assert.deepEqual(after.sources.filter(c=>c.key!==NI_ELECTRICITY_CONTRACT_KEY),before.sources);
 assert.deepEqual(after.staged_sources,before.staged_sources.filter(c=>c.key!==NI_ELECTRICITY_CONTRACT_KEY));
 assert.deepEqual(after.staged_sources.map(c=>c.key),['australia/grid_day','england/bedroom_rent','england/care_assessment_cohort']);
 const ni=after.sources.find(c=>c.key===NI_ELECTRICITY_CONTRACT_KEY);
 assert.equal(ni.described_measures,5);assert.equal(ni.observation_count,5);
 assert.equal(ni.evidence,'verification/gap-followup-2026-10-20/ni-energy-summary/CONTRACT.md');
});

test('NI rejects missing, reordered, duplicated, expanded or reduced sets and malformed reviewed transitions',()=>{
 for(const invalid of [undefined,null,true,'all',[],baseKeys,[NI_ELECTRICITY_CONTRACT_KEY],[...keys].reverse(),[...keys,keys[0]],[...keys,'england/bedroom_rent'].sort(),['canada/rental_benchmark',NI_ELECTRICITY_CONTRACT_KEY]]){
  assert.throws(()=>validateNiElectricitySourceKeys(invalid));
  const candidate=review();candidate.continuations.at(-1).source_contracts=invalid;assert.throws(()=>reviewedReleasePlan(candidate));
 }
 for(const mutate of [
  r=>{r.continuations.at(-1).scope=REMAINING_SCOPE;},
  r=>{r.continuations.at(-1).from.source_revision='0'.repeat(40);},
  r=>{r.continuations.at(-1).evidence=' ';},
  r=>{r.continuations.at(-1).to=clone(r.to);},
  r=>{r.continuations.at(-2).source_contracts=[baseKeys[0]];},
  r=>{r.continuations.splice(-2,1);r.continuations.at(-1).from=clone(r.continuations.at(-2).to);},
  r=>{r.continuations.at(-1).to.source_dirty=true;},
 ]){
  const candidate=review();mutate(candidate);assert.throws(()=>reviewedReleasePlan(candidate));
 }
});

test('one collection applies the exact seventh-edge suffix from every durable prefix without rewriting history',()=>{
 const approval=review(),plan=reviewedReleasePlan(approval);
 assert.equal(plan.reviews.length,7);assert.equal(plan.includeNiElectricity,true);assert.deepEqual(plan.remainingSourceKeys,baseKeys);
 assert.deepEqual(plan.reviews.slice(0,6),reviewedReleasePlan(priorReview).reviews);
 for(let count=0;count<=6;count++){
  let before=clone(original);
  if(count){
   const prefixReview={...clone(priorReview),continuations:clone(priorReview.continuations.slice(0,count-1))},prefixPlan=reviewedReleasePlan(prefixReview);
   before=applyRun(before,run(-100+count,{id:'CONSTRUCTED-prefix-'+count,scope:prefixPlan.scope,source_contracts:count===6?baseKeys:undefined,identities:Object.fromEntries(ORIGINS.map(origin=>[origin,clone(prefixPlan.target)]))}),{approvedRelease:prefixReview});
  }
  const saved=clone(before),after=applyRun(before,run(count),{approvedRelease:approval});
  assert.deepEqual(before,saved);assert.equal(after.sequence,before.sequence+1);
  for(const field of ['incidents','repairs','outbox','sources'])assert.deepEqual(after[field],before[field]);
  assert.deepEqual(after.runs.slice(0,-1),before.runs);assert.deepEqual(after.release_reviews.slice(0,-1),before.release_reviews||[]);
  for(const field of starts)assert.equal(after[field],before[field],field);
  assert.equal(after.ni_electricity_started_shadow_at,undefined);
  assert.equal(after.ni_electricity_scope_first_complete_at,at(count));
  assert.deepEqual(after.remaining_source_contracts,baseKeys);assert.deepEqual(after.approved_identity,target);
  const applied=after.release_reviews.at(-1).reviewed_chain;
  assert.deepEqual(applied.map(({observed_in_collection,...edge})=>edge),plan.reviews.slice(count));
  assert.deepEqual(applied.map(edge=>edge.observed_in_collection),Array.from({length:7-count},(_,index)=>index===6-count));
  assert.equal(after.runs.at(-1).scheduled,false);
  assert.deepEqual(applyRun(after,run(count),{approvedRelease:approval}),after);
 }
});

test('NI starts only from an exact reviewed scheduled observation and does not borrow the earlier window',()=>{
 const priorPlan=reviewedReleasePlan(priorReview);
 let before=clone(original);
 for(let day=0;day<8;day++)before=applyRun(before,run(day*1440,{id:'CONSTRUCTED-prior-scheduled-'+day,scheduled:true,scope:REMAINING_SCOPE,source_contracts:baseKeys,identities:Object.fromEntries(ORIGINS.map(origin=>[origin,clone(priorPlan.target)]))}),{approvedRelease:priorReview});
 assert.equal(remainingShadowStatus(before,at(7*1440)).operating_window_pass,true);
 const manual=applyRun(before,run(7*1440+1),{approvedRelease:review()});
 assert.equal(manual.ni_electricity_started_shadow_at,undefined);
 assert.equal(niElectricityShadowStatus(manual,at(7*1440+1)).complete_runs,0);
 assert.equal(niElectricityShadowStatus(manual,at(7*1440+1)).operating_window_pass,false);
 for(const scheduled of ['true','false',1,null,undefined])assert.throws(()=>applyRun(manual,run(7*1440+2,{scheduled}),{approvedRelease:review()}),/scheduled provenance/);
 const observed=applyRun(manual,run(8*1440,{scheduled:true}),{approvedRelease:review()});
 for(const field of starts)assert.equal(observed[field],before[field],field);
 assert.deepEqual(observed.remaining_source_contracts,baseKeys);
 const ni=niElectricityShadowStatus(observed,at(8*1440));
 assert.equal(ni.started_at,at(8*1440));assert.equal(ni.complete_runs,1);assert.equal(ni.elapsed_hours,0);assert.equal(ni.operating_window_pass,false);
 assert.equal(remainingShadowStatus(observed,at(8*1440)).complete_runs,9);
 assert.equal(remainingShadowStatus(observed,at(8*1440)).operating_window_pass,true);
 assert.equal(dailyHistoryShadowStatus(observed,at(8*1440)).operating_window_pass,true);
 // Even seven more observer days cannot manufacture a second scheduled run.
 assert.equal(niElectricityShadowStatus(observed,at(15*1440)).complete_runs,1);
 assert.equal(niElectricityShadowStatus(observed,at(15*1440)).operating_window_pass,false);
});

test('incomplete, unreviewed, wrong-set or wrong-identity NI executions cannot start or pass a window',()=>{
 const manual=applyRun(original,run(0),{approvedRelease:review()});
 for(const changes of [{complete:false},{scope:REMAINING_SCOPE,source_contracts:baseKeys},{source_contracts:baseKeys},{source_contracts:undefined},{identities:{[ORIGINS[0]]:target}},{identities:Object.fromEntries(ORIGINS.map(origin=>[origin,{...target,source_revision:'0'.repeat(40)}]))}]){
  const result=applyRun(manual,run(1,{scheduled:true,...changes}),{approvedRelease:review()});
  assert.equal(result.ni_electricity_started_shadow_at,undefined);
  assert.equal(niElectricityShadowStatus(result,at(1)).operating_window_pass,false);
 }
 const unreviewed=applyRun(original,run(1,{scheduled:true}));
 assert.equal(unreviewed.ni_electricity_started_shadow_at,undefined);
 assert.equal(unreviewed.runs.at(-1).reviewed_scope_observed,false);
 const first=applyRun(manual,run(1,{scheduled:true}),{approvedRelease:review()});
 const failed=applyRun(first,run(2,{scheduled:true,source_contracts:baseKeys}),{approvedRelease:review()});
 assert.equal(niElectricityShadowStatus(failed,at(2)).incomplete_runs,1);
 assert.equal(remainingShadowStatus(failed,at(2)).incomplete_runs,1);
 assert.equal(dailyHistoryShadowStatus(failed,at(2)).incomplete_runs,1);
 const changed=clone(original);changed.remaining_source_contracts=[baseKeys[0]];changed.remaining_started_shadow_at=at(-1440);
 assert.throws(()=>applyRun(changed,run(0,{scheduled:true}),{approvedRelease:review()}),/days cannot transfer/);
});

test('explicit NI opt-in adds one obligation and no public probes; malformed scope is refused before reading',async()=>{
 let count=0;
 const flags={includeUs:true,includeClaimants:true,includeRent:true,includeDailyHistory:true,remainingSourceKeys:baseKeys,includeNiElectricity:true};
 for(const options of [{includeNiElectricity:true},{...flags,includeNiElectricity:'true'},{...flags,remainingSourceKeys:[baseKeys[0]]},{...flags,remainingSourceKeys:keys},{...flags,includeDailyHistory:false}]){
  await assert.rejects(collect({...options,read:async()=>{count++;}}));
 }
 assert.equal(count,0);
 const reader=async url=>{
  count++;const path=new URL(url).pathname;
  if(path==='/health.json')return {status:200,data:target};
  if(path==='/catalog.json')return {status:200,data:catalogue()};
  if(path==='/catalog.v2.json')return {status:200,data:catalogueV2()};
  const desk=path.slice(1,-5),country=desk==='united-states'?'United States':REGISTRY.find(c=>c.desk===desk).country;
  return {status:200,data:{country,sources:{}}};
 };
 const report=await collect({...flags,read:reader,now:()=>at(0),id:'CONSTRUCTED-ni-collector'});
 assert.equal(report.complete,true);assert.equal(count,24);assert.equal(report.requests.length,24);
 assert.equal(Object.keys(report.results).length,119);assert.equal(report.scope,NI_ELECTRICITY_SCOPE);assert.deepEqual(report.source_contracts,keys);
 assert.ok(Object.hasOwn(report.results,NI_ELECTRICITY_CONTRACT_KEY));
 assert.ok(!Object.hasOwn(report.results,'australia/grid_day'));
 assert.ok(!Object.hasOwn(report.results,'england/bedroom_rent'));
 assert.ok(!Object.hasOwn(report.results,'england/care_assessment_cohort'));
});
