import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REGISTRY,REMAINING_SCOPE,REMAINING_CONTRACTS,REMAINING_CONTRACT_KEYS,REMAINING_ELIGIBLE_CONTRACT_KEYS,ORIGINS,validateRemainingSourceKeys} from '../lib/monitor-contracts.js';
import {applyRun,reviewedReleasePlan,remainingShadowStatus,dailyHistoryShadowStatus} from '../lib/monitor-state.js';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {collect} from '../scripts/monitor.mjs';
import {buildMonitorRegistry} from '../scripts/monitor-registry.mjs';
import {catalogue} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';

// All new releases, clocks and runs below are constructed controls. Neither
// phase-one nor phase-two production acceptance is inferred from these tests.
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const original=decodeCheckpoint(read('verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json')).state;
const acceptedFour=JSON.parse(read('verification/statcan-gdp-2026-10-20/proposed-review.json'));
const acceptedKeys=[...REMAINING_ELIGIBLE_CONTRACT_KEYS];
const clone=structuredClone,at=minute=>new Date(Date.parse('2026-10-20T12:00:00Z')+minute*60000).toISOString();
const identity=letter=>({source_revision:letter.repeat(40),source_dirty:false,worker_version:letter.repeat(8)+'-'+letter.repeat(4)+'-4'+letter.repeat(3)+'-a'+letter.repeat(3)+'-'+letter.repeat(12),build_fingerprint:letter.repeat(16)});
const dailyTarget=identity('e'),target=identity('f'),dailyScope='nine-desks-plus-claimants-rent-and-daily-history';
const priorReview={...clone(acceptedFour),continuations:[...clone(acceptedFour.continuations),{from:clone(acceptedFour.continuations.at(-1).to),to:dailyTarget,scope:dailyScope,evidence:'CONSTRUCTED-phase-one-control'}]};
const review=(keys=[...acceptedKeys])=>({...clone(priorReview),continuations:[...clone(priorReview.continuations),{from:clone(dailyTarget),to:clone(target),scope:REMAINING_SCOPE,source_contracts:[...keys],evidence:'CONSTRUCTED-phase-two-control'}]});
const run=(minute=0,changes={})=>({id:'CONSTRUCTED-remaining-'+minute,finished_at:at(minute),scheduled:false,complete:true,scope:REMAINING_SCOPE,source_contracts:[...acceptedKeys],identities:Object.fromEntries(ORIGINS.map(origin=>[origin,clone(target)])),requests:Array.from({length:24},()=>({constructed:true})),results:{},probe_errors:[],...changes});

test('five additions stay outside every historical registry and only exact accepted keys activate',()=>{
 assert.equal(REGISTRY.length,108);assert.equal(REMAINING_CONTRACTS.length,5);
 assert.deepEqual(REMAINING_CONTRACTS.map(c=>[c.key,c.observation_count]),[['canada/rental_benchmark',2],['england/bedroom_rent',4],['england/care_assessment_cohort',5],['northern-ireland/electricity_balance',5],['scotland/college_activity',5]]);
 assert.ok(REMAINING_CONTRACTS.every(c=>!REGISTRY.some(old=>old.key===c.key)));
 for(const [activation,expected]of [[{enabled:false},108],[{...clone(acceptedFour),continuations:[]},109],[{...clone(acceptedFour),continuations:clone(acceptedFour.continuations.slice(0,1))},114],[acceptedFour,115],[priorReview,116]]){
  const built=buildMonitorRegistry(activation);assert.equal(built.sources.length,expected);assert.ok(REMAINING_CONTRACT_KEYS.every(key=>built.staged_sources.some(c=>c.key===key)));
 }
 for(const keys of [[acceptedKeys[0]],[acceptedKeys[1]],[...acceptedKeys]]){
  const built=buildMonitorRegistry(review(keys));assert.equal(built.sources.length,116+keys.length);assert.equal(built.staged_sources.length,6-keys.length);
  assert.deepEqual(built.sources.filter(c=>REMAINING_CONTRACT_KEYS.includes(c.key)).map(c=>c.key),keys);
  assert.deepEqual(built.staged_sources.map(c=>c.key),['australia/grid_day',...REMAINING_CONTRACT_KEYS.filter(key=>!keys.includes(key))]);
 }
 const eligible=buildMonitorRegistry(review());
 assert.equal(eligible.sources.length,118);assert.deepEqual(eligible.staged_sources.map(c=>c.key),['australia/grid_day','england/bedroom_rent','england/care_assessment_cohort','northern-ireland/electricity_balance']);
});
test('unknown, duplicate, unsorted or empty activation sets and same-scope set changes fail closed',()=>{
 for(const keys of [undefined,null,true,'all',[],['unknown/source'],['england/bedroom_rent'],['england/care_assessment_cohort'],['northern-ireland/electricity_balance'],[REMAINING_CONTRACT_KEYS[0],REMAINING_CONTRACT_KEYS[0]],[...REMAINING_CONTRACT_KEYS].reverse()]){
  assert.throws(()=>validateRemainingSourceKeys(keys));
  const invalid=review();invalid.continuations.at(-1).source_contracts=keys;assert.throws(()=>reviewedReleasePlan(invalid));
 }
 const oldMutation=clone(priorReview);oldMutation.source_contracts=[REMAINING_CONTRACT_KEYS[0]];assert.throws(()=>reviewedReleasePlan(oldMutation));
 const changed=review();changed.continuations.push({from:clone(target),to:identity('d'),scope:REMAINING_SCOPE,source_contracts:[REMAINING_CONTRACT_KEYS[0]],evidence:'CONSTRUCTED-set-change'});assert.throws(()=>reviewedReleasePlan(changed));
 const skipped=clone(acceptedFour);skipped.continuations.push(review().continuations.at(-1));assert.throws(()=>reviewedReleasePlan(skipped));
});
test('the exact sixth release applies one remaining suffix from every durable prefix, preserving all original state',()=>{
 const approval=review(),plan=reviewedReleasePlan(approval);assert.equal(plan.reviews.length,6);assert.equal(plan.includeDailyHistory,true);assert.deepEqual(plan.remainingSourceKeys,acceptedKeys);
 for(let prefix=0;prefix<=5;prefix++){
  const before=clone(original);
  if(prefix){before.approved_identity=clone(plan.reviews[prefix-1].to);before.release_reviews=[{constructed_prior_review:prefix}];before.us_started_shadow_at=at(-90);}
  if(prefix>=2)before.claimants_started_shadow_at=at(-80);
  if(prefix>=3)before.market_rent_started_shadow_at=at(-70);
  if(prefix>=5)before.daily_history_started_shadow_at=at(-60);
  const saved=clone(before),after=applyRun(before,run(prefix),{approvedRelease:approval});
  assert.deepEqual(before,saved);assert.equal(after.sequence,before.sequence+1);assert.deepEqual(after.incidents,before.incidents);assert.deepEqual(after.repairs,before.repairs);assert.deepEqual(after.outbox,before.outbox);assert.deepEqual(after.sources,before.sources);assert.deepEqual(after.runs.slice(0,-1),before.runs);assert.equal(after.runs.at(-1).scheduled,false);
  assert.equal(after.started_shadow_at,before.started_shadow_at);assert.deepEqual(after.approved_identity,target);assert.deepEqual(after.remaining_source_contracts,acceptedKeys);assert.equal(after.remaining_started_shadow_at,undefined);
  for(const field of ['us_started_shadow_at','claimants_started_shadow_at','market_rent_started_shadow_at','daily_history_started_shadow_at'])assert.equal(after[field],before[field]);
  assert.equal(after.release_reviews.at(-1).reviewed_chain.length,6-prefix);assert.deepEqual(after.release_reviews.at(-1).reviewed_chain.map(edge=>edge.observed_in_collection),Array.from({length:6-prefix},(_,index)=>index===5-prefix));
  assert.deepEqual(after.release_reviews.slice(0,-1),before.release_reviews||[]);
  assert.deepEqual(applyRun(after,run(prefix),{approvedRelease:approval}),after);
 }
});
test('only actual scheduled exact-set observations start the new window, never earlier daily-history days',()=>{
 const before=clone(original);before.daily_history_started_shadow_at=at(-60);
 const manual=applyRun(before,run(0),{approvedRelease:review()});assert.equal(manual.remaining_started_shadow_at,undefined);assert.equal(remainingShadowStatus(manual,at(0)).complete_runs,0);
 const scheduled=applyRun(manual,run(1,{scheduled:true}),{approvedRelease:review()});
 assert.equal(scheduled.remaining_started_shadow_at,at(1));assert.equal(scheduled.daily_history_started_shadow_at,at(-60));assert.equal(scheduled.started_shadow_at,before.started_shadow_at);
 const status=remainingShadowStatus(scheduled,at(1));assert.equal(status.started_at,at(1));assert.equal(status.elapsed_hours,0);assert.equal(status.complete_runs,1);assert.equal(status.operating_window_pass,false);assert.deepEqual(status.source_contracts,acceptedKeys);
 for(const changes of [{complete:false},{scope:dailyScope},{source_contracts:[REMAINING_CONTRACT_KEYS[0]]},{source_contracts:undefined},{identities:{[ORIGINS[0]]:target}}]){
  const failed=applyRun(manual,run(2,{scheduled:true,...changes}),{approvedRelease:review()});assert.equal(failed.remaining_started_shadow_at,undefined);
 }
});
test('a changed durable set cannot borrow days; bad reviewed identity makes the expanded-window sample incomplete',()=>{
 const before=clone(original);before.remaining_source_contracts=[REMAINING_CONTRACT_KEYS[0]];before.remaining_started_shadow_at=at(-1440);const saved=clone(before);
 assert.throws(()=>applyRun(before,run(0,{scheduled:true}),{approvedRelease:review()}),/days cannot transfer/);assert.deepEqual(before,saved);
 const first=applyRun(original,run(0,{scheduled:true}),{approvedRelease:review()});
 const changed=applyRun(first,run(1,{scheduled:true,identities:Object.fromEntries(ORIGINS.map(origin=>[origin,identity('d')]))}),{approvedRelease:review()});
 assert.equal(changed.runs.at(-1).reviewed_scope_observed,false);assert.equal(remainingShadowStatus(changed,at(1)).incomplete_runs,1);assert.equal(dailyHistoryShadowStatus(changed,at(1)).incomplete_runs,1);
});
test('one or two eligible obligations preserve the24probe budget and blocked opt-ins are refused before reading',async()=>{
 let count=0;
 for(const options of [{remainingSourceKeys:[REMAINING_CONTRACT_KEYS[0]]},{remainingSourceKeys:true},{remainingSourceKeys:[...REMAINING_CONTRACT_KEYS].reverse()},...REMAINING_CONTRACT_KEYS.filter(key=>!acceptedKeys.includes(key)).map(key=>({includeUs:true,includeClaimants:true,includeRent:true,includeDailyHistory:true,remainingSourceKeys:[key]}))])await assert.rejects(collect({...options,read:async()=>{count++;}}));
 assert.equal(count,0);
 const read=async url=>{count++;const path=new URL(url).pathname;if(path==='/health.json')return {status:200,data:target};if(path==='/catalog.json')return {status:200,data:catalogue()};if(path==='/catalog.v2.json')return {status:200,data:catalogueV2()};const desk=path.slice(1,-5),country=desk==='united-states'?'United States':REGISTRY.find(c=>c.desk===desk).country;return {status:200,data:{country,sources:{}}};};
 for(const keys of [[],[REMAINING_CONTRACT_KEYS[0]],[...acceptedKeys]]){
  count=0;const report=await collect({includeUs:true,includeClaimants:true,includeRent:true,includeDailyHistory:true,remainingSourceKeys:keys,read,now:()=>at(0),id:'CONSTRUCTED-remaining-count-'+keys.length});
  assert.equal(report.complete,true);assert.equal(count,24);assert.equal(report.requests.length,24);assert.equal(Object.keys(report.results).length,116+keys.length);
  assert.equal(report.scope,keys.length?REMAINING_SCOPE:dailyScope);assert.deepEqual(report.source_contracts,keys.length?keys:undefined);
 }
});
