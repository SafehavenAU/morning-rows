import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REGISTRY,ORIGINS,REMAINING_ELIGIBLE_CONTRACT_KEYS,NI_ELECTRICITY_SCOPE,NI_ELECTRICITY_SOURCE_KEYS,AEMO_CQC_SCOPE,CQC_SCOPE,FOLLOWUP_SCOPES,FOLLOWUP_SOURCE_KEYS,validateFollowupSourceKeys} from '../lib/monitor-contracts.js';
import {applyRun,reviewedReleasePlan,remainingShadowStatus,dailyHistoryShadowStatus,niElectricityShadowStatus,followupShadowStatus} from '../lib/monitor-state.js';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {collect} from '../scripts/monitor.mjs';
import {buildMonitorRegistry} from '../scripts/monitor-registry.mjs';
import {catalogue} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const priorReview=JSON.parse(read('verification/gap-followup-2026-10-20/aemo-cqc-monitor/accepted-ni-review.json'));
const original=decodeCheckpoint(read('verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json')).state;
const clone=structuredClone;
// All identities/executions below are CONSTRUCTED controls, never release evidence.
const target={source_revision:'f'.repeat(40),worker_version:'ffffffff-ffff-4fff-afff-ffffffffffff',build_fingerprint:'f'.repeat(16),source_dirty:false};
const at=minute=>new Date(Date.parse('2026-10-21T12:00:00Z')+minute*60000).toISOString();
const review=scope=>({...clone(priorReview),continuations:[...clone(priorReview.continuations),{from:clone(priorReview.continuations.at(-1).to),to:clone(target),scope,source_contracts:[...FOLLOWUP_SOURCE_KEYS[scope]],evidence:'CONSTRUCTED eighth-edge release control'}]});
const run=(scope,minute=0,changes={})=>({id:'CONSTRUCTED-followup-'+minute,finished_at:at(minute),scheduled:false,complete:true,scope,source_contracts:[...FOLLOWUP_SOURCE_KEYS[scope]],identities:Object.fromEntries(ORIGINS.map(origin=>[origin,clone(target)])),requests:Array.from({length:24},()=>({constructed:true})),results:{},probe_errors:[],...changes});
const starts=['started_shadow_at','us_started_shadow_at','claimants_started_shadow_at','market_rent_started_shadow_at','daily_history_started_shadow_at','remaining_started_shadow_at','ni_electricity_started_shadow_at'];

for(const scope of FOLLOWUP_SCOPES){
 test(`${scope}: eighth edge adds only its exact sources; historical registry and prior reviews stay intact`,()=>{
  assert.equal(REGISTRY.length,108);const plan=reviewedReleasePlan(review(scope));
  assert.equal(plan.reviews.length,8);assert.equal(plan.includeNiElectricity,true);assert.equal(plan.includeCqc,true);assert.equal(plan.includeAemoDaily,scope===AEMO_CQC_SCOPE);
  assert.deepEqual(plan.reviews.slice(0,7),reviewedReleasePlan(priorReview).reviews);
  const before=buildMonitorRegistry(priorReview),after=buildMonitorRegistry(review(scope));
  assert.equal(before.sources.length,119);assert.equal(after.sources.length,scope===AEMO_CQC_SCOPE?121:120);
  assert.deepEqual(after.sources.filter(c=>!['australia/grid_day','england/care_assessment_cohort'].includes(c.key)),before.sources);
  assert.deepEqual(after.staged_sources.map(c=>c.key),scope===AEMO_CQC_SCOPE?['england/bedroom_rent']:['australia/grid_day','england/bedroom_rent']);
  assert.equal(after.sources.find(c=>c.key==='england/care_assessment_cohort').validator_version,'monitor-cqc-original-pdf-v1');
  if(scope===AEMO_CQC_SCOPE)assert.equal(after.sources.find(c=>c.key==='australia/grid_day').activation,'reviewed_daily_bundles');
 });
 test(`${scope}: rejects mismatched sets, missing NI, earlier terminal, extra edge and identity/evidence defects`,()=>{
  const keys=FOLLOWUP_SOURCE_KEYS[scope];
  for(const bad of [undefined,null,true,[],[...keys].reverse(),[...keys,keys[0]],[...keys,'england/bedroom_rent'].sort(),keys.slice(1),FOLLOWUP_SOURCE_KEYS[scope===AEMO_CQC_SCOPE?CQC_SCOPE:AEMO_CQC_SCOPE]]){
   assert.throws(()=>validateFollowupSourceKeys(scope,bad));const r=review(scope);r.continuations.at(-1).source_contracts=bad;assert.throws(()=>reviewedReleasePlan(r));
  }
  for(const mutate of [
   r=>{r.continuations.at(-1).from.source_revision='0'.repeat(40);},r=>{r.continuations.at(-1).evidence=' ';},
   r=>{r.continuations.at(-1).to=clone(r.to);},r=>{r.continuations.at(-1).to.source_dirty=true;},
   r=>{r.continuations.splice(-2,1);r.continuations.at(-1).from=clone(r.continuations.at(-2).to);},
   r=>{r.continuations.at(-2).scope=scope;r.continuations.at(-2).source_contracts=[...keys];},
   r=>{r.continuations.push(clone(r.continuations.at(-1)));},
  ]){const r=review(scope);mutate(r);assert.throws(()=>reviewedReleasePlan(r));}
 });
 test(`${scope}: every durable prefix applies one exact suffix and preserves durable history/state`,()=>{
  const approval=review(scope),plan=reviewedReleasePlan(approval);
  for(let count=0;count<=7;count++){
   let before=clone(original);
   if(count){const prefix={...clone(priorReview),continuations:clone(priorReview.continuations.slice(0,count-1))},p=reviewedReleasePlan(prefix);
    before=applyRun(before,run(scope,-100+count,{id:'CONSTRUCTED-prefix-'+count,scope:p.scope,source_contracts:count===7?[...NI_ELECTRICITY_SOURCE_KEYS]:count===6?[...REMAINING_ELIGIBLE_CONTRACT_KEYS]:undefined,identities:Object.fromEntries(ORIGINS.map(origin=>[origin,clone(p.target)]))}),{approvedRelease:prefix});}
   const saved=clone(before),after=applyRun(before,run(scope,count),{approvedRelease:approval});
   assert.deepEqual(before,saved);assert.equal(after.sequence,before.sequence+1);
   for(const field of ['incidents','repairs','outbox','sources'])assert.deepEqual(after[field],before[field]);
   assert.deepEqual(after.runs.slice(0,-1),before.runs);assert.deepEqual(after.release_reviews.slice(0,-1),before.release_reviews||[]);
   for(const field of starts)assert.equal(after[field],before[field],field);
   assert.equal(after.followup_started_shadow_at,undefined);assert.equal(after.followup_scope_first_complete_at,at(count));assert.equal(after.followup_scope,scope);
   assert.deepEqual(after.followup_source_contracts,FOLLOWUP_SOURCE_KEYS[scope]);assert.deepEqual(after.approved_identity,target);
   const applied=after.release_reviews.at(-1).reviewed_chain;
   assert.deepEqual(applied.map(({observed_in_collection,...edge})=>edge),plan.reviews.slice(count));
   assert.deepEqual(applied.map(edge=>edge.observed_in_collection),Array.from({length:8-count},(_,i)=>i===7-count));
   assert.deepEqual(applyRun(after,run(scope,count),{approvedRelease:approval}),after);
  }
 });
 test(`${scope}: previous seven days are not inherited; exact scheduled runs continue old windows`,()=>{
  const priorPlan=reviewedReleasePlan(priorReview);let before=clone(original);
  for(let day=0;day<8;day++)before=applyRun(before,run(scope,day*1440,{id:'CONSTRUCTED-prior-'+day,scheduled:true,scope:NI_ELECTRICITY_SCOPE,source_contracts:[...NI_ELECTRICITY_SOURCE_KEYS],identities:Object.fromEntries(ORIGINS.map(origin=>[origin,clone(priorPlan.target)]))}),{approvedRelease:priorReview});
  assert.equal(niElectricityShadowStatus(before,at(7*1440)).operating_window_pass,true);
  const manual=applyRun(before,run(scope,7*1440+1),{approvedRelease:review(scope)});
  assert.equal(followupShadowStatus(manual,at(7*1440+1)).complete_runs,0);assert.equal(manual.followup_started_shadow_at,undefined);
  for(const field of ['scheduled','complete'])for(const value of ['true','false',0,1,null,undefined])assert.throws(()=>applyRun(manual,run(scope,7*1440+2,{[field]:value}),{approvedRelease:review(scope)}));
  const observed=applyRun(manual,run(scope,8*1440,{scheduled:true}),{approvedRelease:review(scope)});
  for(const field of starts)assert.equal(observed[field],before[field],field);
  const status=followupShadowStatus(observed,at(8*1440));assert.equal(status.started_at,at(8*1440));assert.equal(status.complete_runs,1);assert.equal(status.elapsed_hours,0);assert.equal(status.operating_window_pass,false);
  for(const getStatus of [niElectricityShadowStatus,remainingShadowStatus,dailyHistoryShadowStatus]){assert.equal(getStatus(observed,at(8*1440)).complete_runs,9);assert.equal(getStatus(observed,at(8*1440)).operating_window_pass,true);}
  assert.equal(followupShadowStatus(observed,at(15*1440)).complete_runs,1);assert.equal(followupShadowStatus(observed,at(15*1440)).operating_window_pass,false);
 });
 test(`${scope}: unreviewed, wrong-identity, incomplete or wrong-set executions cannot start`,()=>{
  const manual=applyRun(original,run(scope),{approvedRelease:review(scope)});
  for(const changes of [{complete:false},{source_contracts:[...NI_ELECTRICITY_SOURCE_KEYS]},{source_contracts:undefined},{identities:{[ORIGINS[0]]:target}},{identities:Object.fromEntries(ORIGINS.map(origin=>[origin,{...target,build_fingerprint:'0'.repeat(16)}]))}]){
   const result=applyRun(manual,run(scope,1,{scheduled:true,...changes}),{approvedRelease:review(scope)});assert.equal(result.followup_started_shadow_at,undefined);assert.equal(result.runs.at(-1).reviewed_scope_observed,false);
  }
  const unreviewed=applyRun(original,run(scope,1,{scheduled:true}));assert.equal(unreviewed.followup_started_shadow_at,undefined);
  const first=applyRun(manual,run(scope,1,{scheduled:true}),{approvedRelease:review(scope)});
  const bad=applyRun(first,run(scope,2,{scheduled:true,source_contracts:[...NI_ELECTRICITY_SOURCE_KEYS]}),{approvedRelease:review(scope)});
  for(const getStatus of [followupShadowStatus,niElectricityShadowStatus,remainingShadowStatus,dailyHistoryShadowStatus])assert.equal(getStatus(bad,at(2)).incomplete_runs,1);
  const mixed=clone(manual);mixed.followup_scope=scope===AEMO_CQC_SCOPE?CQC_SCOPE:AEMO_CQC_SCOPE;assert.throws(()=>applyRun(mixed,run(scope,2),{approvedRelease:review(scope)}),/days cannot transfer/);
  const badKeys=clone(manual);badKeys.followup_source_contracts=[...NI_ELECTRICITY_SOURCE_KEYS];assert.throws(()=>applyRun(badKeys,run(scope,2),{approvedRelease:review(scope)}),/days cannot transfer/);
 });
 test(`${scope}: explicit collector flags add obligations within the same 24 probes`,async()=>{
  let count=0;const flags={includeUs:true,includeClaimants:true,includeRent:true,includeDailyHistory:true,remainingSourceKeys:[...REMAINING_ELIGIBLE_CONTRACT_KEYS],includeNiElectricity:true,followupScope:scope};
  for(const options of [{followupScope:scope},{...flags,includeNiElectricity:false},{...flags,followupScope:true},{...flags,followupScope:'unknown'},{...flags,includeDailyHistory:false}])await assert.rejects(collect({...options,read:async()=>{count++;}}));assert.equal(count,0);
  const reader=async url=>{count++;const path=new URL(url).pathname;if(path==='/health.json')return {status:200,data:target};if(path==='/catalog.json')return {status:200,data:catalogue()};if(path==='/catalog.v2.json')return {status:200,data:catalogueV2()};const desk=path.slice(1,-5);return {status:200,data:{country:desk==='united-states'?'United States':REGISTRY.find(c=>c.desk===desk).country,sources:{}}};};
  const report=await collect({...flags,read:reader,now:()=>at(0),id:'CONSTRUCTED-eighth-collector'});
  assert.equal(report.complete,true);assert.equal(count,24);assert.equal(report.requests.length,24);assert.equal(report.scope,scope);assert.equal(Object.keys(report.results).length,scope===AEMO_CQC_SCOPE?121:120);assert.deepEqual(report.source_contracts,FOLLOWUP_SOURCE_KEYS[scope]);
  assert.equal(Object.hasOwn(report.results,'australia/grid_day'),scope===AEMO_CQC_SCOPE);assert.ok(Object.hasOwn(report.results,'england/care_assessment_cohort'));assert.ok(!Object.hasOwn(report.results,'england/bedroom_rent'));
 });
}
