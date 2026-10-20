import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REGISTRY,DAILY_HISTORY_BASE_REGISTRY,DAILY_HISTORY_CONTRACTS,DAILY_HISTORY_UPGRADES,GRID_DAY_CONTRACT,EXCHANGE_HISTORY_CONTRACT,ORIGINS,inspectSource} from '../lib/monitor-contracts.js';
import {applyRun,reviewedReleasePlan,shadowStatus,dailyHistoryShadowStatus} from '../lib/monitor-state.js';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {buildMonitorRegistry} from '../scripts/monitor-registry.mjs';
import {collect} from '../scripts/monitor.mjs';
import {catalogue} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';
import {parseStatcanHeadline,STATCAN_HEADLINE_SOURCES} from '../lib/statcan-headlines.js';
import {parseBocHistory,bocHistoryWindow} from '../lib/boc-history.js';
import {walesTax} from '../lib/fiscal-observations.js';
// Every collection below is injected/constructed. None is scheduled evidence.
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),json=p=>JSON.parse(text(p)),clone=structuredClone;
const at=minute=>new Date(Date.parse('2026-10-20T10:00:00Z')+minute*60000).toISOString();
const checkpoint=decodeCheckpoint(text('verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json'));
// Frozen accepted four-edge prefix; later activation must not rewrite this
// historical test input. It matched the accepted review before this work.
const priorReview=json('verification/statcan-gdp-2026-10-20/proposed-review.json');
const oldEdges=[priorReview,...priorReview.continuations].map(e=>({from:e.from,to:e.to,scope:e.scope,evidence:e.evidence}));
assert.equal(oldEdges.length,4,'The test pins the four already accepted reviews, before this activation');
const scope='nine-desks-plus-claimants-rent-and-daily-history';
const identity={source_revision:'f'.repeat(40),source_dirty:false,worker_version:'ffffffff-ffff-4fff-8fff-ffffffffffff',build_fingerprint:'f'.repeat(16)};
const review=()=>({...clone(priorReview),continuations:[...clone(priorReview.continuations),{from:clone(oldEdges.at(-1).to),to:clone(identity),scope,evidence:'CONSTRUCTED-test/gap-review-not-activation'}]});
const run=(minute=0,options={})=>({id:'CONSTRUCTED-gap-'+minute,finished_at:at(minute),complete:true,scheduled:false,scope,requests:Array.from({length:24},()=>({constructed:true})),results:{},probe_errors:[],identities:Object.fromEntries(ORIGINS.map(o=>[o,clone(identity)])),...options});
const sourceContract=key=>DAILY_HISTORY_CONTRACTS.find(c=>c.key===key);
const statcan=source=>{const b='verification/gap-pass-2026-10-20/statcan/'+source+'/original/';return parseStatcanHeadline(source,json(b+'wds-selected.json'),json(b+'series-metadata.json'),json(b+'cube-metadata.json'));};
const boc=()=>parseBocHistory(json('verification/gap-pass-2026-10-20/boc/original/window.json'),json('verification/gap-pass-2026-10-20/boc/original/latest.json'),bocHistoryWindow(at(0)));
const wra=()=>walesTax(text('test/fixtures/wra-tax.csv'),new Date(at(0)));
const body=(c,value,minute=0)=>({country:c.country,[c.data]:clone(value),sources:{[c.source]:{status:value?.status==='degraded'?'degraded':'ok',fetched_at:at(minute)}}});

test('original108 retain pre-upgrade native obligations; expanded scope alone exposes six exact contracts with AEMO held',()=>{
 assert.equal(REGISTRY.length,108);assert.equal(DAILY_HISTORY_BASE_REGISTRY.length,108);assert.equal(DAILY_HISTORY_UPGRADES.length,5);
 for(const c of DAILY_HISTORY_UPGRADES){assert.equal(REGISTRY.find(r=>r.key===c.key).described_measures,0);assert.equal(c.semantic_revision,'gap-pass-2026-10-20');assert.ok(c.described_measures>0);}
 assert.ok(REGISTRY.every(c=>!['grid_day','exchange_history'].includes(c.source)));
 assert.equal(buildMonitorRegistry(priorReview).sources.length,115);assert.equal(buildMonitorRegistry(priorReview).staged_sources.length,2);
 const active=buildMonitorRegistry(review());assert.equal(active.sources.length,116);assert.equal(active.staged_sources.length,1);assert.equal(new Set(active.sources.map(s=>s.key)).size,116);
 for(const c of DAILY_HISTORY_UPGRADES)assert.equal(active.sources.find(s=>s.key===c.key).definitions.length,c.described_measures);
 assert.deepEqual([priorReview,...priorReview.continuations].map(e=>({from:e.from,to:e.to,scope:e.scope,evidence:e.evidence})),oldEdges);
});
test('one exact fifth review from any accepted durable prefix consumes only the suffix without resetting ledger or starts',()=>{
 const completeReview=review();assert.equal(reviewedReleasePlan(completeReview).includeDailyHistory,true);assert.equal(reviewedReleasePlan(priorReview).includeDailyHistory,false);
 for(let prefix=0;prefix<=4;prefix++){
  const before=clone(checkpoint.state);if(prefix){before.approved_identity=clone(oldEdges[prefix-1].to);before.release_reviews=[{historical:'constructed prior proof, not collection'}];before.us_started_shadow_at=at(-100);before.claimants_started_shadow_at=at(-90);before.market_rent_started_shadow_at=at(-80);}
  const after=applyRun(before,run(prefix),{approvedRelease:completeReview});assert.equal(after.sequence,before.sequence+1);assert.deepEqual(after.incidents,before.incidents);assert.deepEqual(after.repairs,before.repairs);assert.deepEqual(after.outbox,before.outbox);assert.equal(after.started_shadow_at,before.started_shadow_at);assert.equal(after.daily_history_started_shadow_at,undefined);assert.equal(after.daily_history_scope_first_complete_at,at(prefix));assert.deepEqual(after.approved_identity,identity);
  assert.equal(after.release_reviews.at(-1).reviewed_chain.length,5-prefix);assert.equal(after.release_reviews.at(-1).reviewed_chain.filter(e=>e.observed_in_collection).length,1);assert.equal(after.runs.length,before.runs.length+1);assert.equal(after.runs.at(-1).scheduled,false);if(prefix)assert.equal(after.us_started_shadow_at,at(-100));
 }
});
test('only a complete scheduled final scope sets its own start, never the old seven-day anchor',()=>{
 const before=clone(checkpoint.state),manual=applyRun(before,run(0),{approvedRelease:review()}),scheduled=applyRun(manual,run(1,{scheduled:true}),{approvedRelease:review()});assert.equal(manual.daily_history_started_shadow_at,undefined);assert.equal(scheduled.daily_history_started_shadow_at,at(1));assert.equal(scheduled.daily_history_scope_first_complete_at,at(0));assert.equal(scheduled.started_shadow_at,before.started_shadow_at);assert.equal(shadowStatus(scheduled,at(1)).operating_window_pass,false);
 for(const changes of [{complete:false},{scope:oldEdges.at(-1).scope},{identities:{[ORIGINS[0]]:clone(identity)}}]){const rejected=applyRun(before,run(2,{scheduled:true,...changes}),{approvedRelease:review()});assert.equal(rejected.daily_history_started_shadow_at,undefined);assert.deepEqual(rejected.approved_identity,before.approved_identity);}
});
test('broken chain, skipped rent stage, scope downgrade and ambiguous repeatedidentity fail before state mutation',()=>{
 for(const mutate of [r=>{r.continuations.at(-1).from.source_revision='0'.repeat(40)},r=>{r.continuations[1].scope=scope},r=>{r.continuations.push({from:clone(identity),to:{...clone(identity),worker_version:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'},scope:oldEdges.at(-1).scope,evidence:'test'})},r=>{r.continuations.at(-1).to=clone(r.to)}]){const r=review();mutate(r);assert.throws(()=>reviewedReleasePlan(r));}
});
test('116obligations still use24public probes and prior scope uses115; invalid opt-in fails before read',async()=>{
 let calls=0;for(const options of [{includeDailyHistory:true},{includeUs:true,includeClaimants:true,includeDailyHistory:true},{includeUs:true,includeClaimants:true,includeRent:true,includeDailyHistory:'true'}])await assert.rejects(collect({...options,read:async()=>{calls++;}}));assert.equal(calls,0);
 const reader=async url=>{const p=new URL(url).pathname;calls++;if(p==='/health.json')return {status:200,data:identity};if(p==='/catalog.json')return {status:200,data:catalogue()};if(p==='/catalog.v2.json')return {status:200,data:catalogueV2()};const desk=p.slice(1,-5),contracts=[...REGISTRY,...DAILY_HISTORY_CONTRACTS],country=desk==='united-states'?'United States':contracts.find(c=>c.desk===desk).country;return {status:200,data:{country,sources:{}}};};
 for(const [includeDailyHistory,count] of [[false,115],[true,116]]){calls=0;const report=await collect({includeUs:true,includeClaimants:true,includeRent:true,includeDailyHistory,read:reader,now:()=>at(0),id:'CONSTRUCTED-'+count});assert.equal(calls,24);assert.equal(report.requests.length,24);assert.equal(report.results[GRID_DAY_CONTRACT.key],undefined);assert.equal(Object.keys(report.results).length,count);assert.equal(report.scope,includeDailyHistory?scope:oldEdges.at(-1).scope);}
});
for(const source of STATCAN_HEADLINE_SOURCES)test(source+': exact new monitor contract inspects corrected source while legacy contract stays availability-only',async()=>{
 const c=sourceContract('canada/'+source),native=statcan(source),b=body(c,native),r=await inspectSource(b,c);assert.equal(r.kind,'success',r.reason);assert.equal(r.observations.length,source==='jobs'?11:1);assert.equal((await inspectSource(b,REGISTRY.find(x=>x.key===c.key))).observations.length,0);const changed=clone(b);if(source==='jobs')changed.jobs[0].rate++;else changed[source].rows[0].unit='wrong';assert.equal((await inspectSource(changed,c)).kind,'semantic');const fresh=body(c,native,10);assert.equal((await inspectSource(fresh,c)).version,r.version);assert.equal(r.assurance,'semantic contract checked; independent reference approval separate');
});
test('WRA4 exact completed-year fields validate while native prior scope stays unchanged',async()=>{const c=sourceContract('wales/land_transaction_tax'),b=body(c,wra()),r=await inspectSource(b,c);assert.equal(r.kind,'success',r.reason);assert.equal(r.observations.length,4);const bad=clone(b);bad.land_transaction_tax.rows[0].value=null;assert.equal((await inspectSource(bad,c)).kind,'semantic');const reordered=clone(b);reordered.land_transaction_tax.rows.reverse();assert.equal((await inspectSource(reordered,c)).version,r.version);});
test('repeated Worker refusal keeps AEMO staged and outside every active collector contract',async()=>{
 assert.equal(DAILY_HISTORY_CONTRACTS.length,6);assert.ok(!DAILY_HISTORY_CONTRACTS.some(c=>c.key===GRID_DAY_CONTRACT.key));
 const registry=buildMonitorRegistry(review());assert.ok(!registry.sources.some(c=>c.key===GRID_DAY_CONTRACT.key));
 assert.equal(registry.staged_sources.find(c=>c.key===GRID_DAY_CONTRACT.key).activation,'held_runtime_access');
 assert.equal((await inspectSource({country:'Australia',grid_day:{status:'ok'},sources:{grid_day:{status:'ok',fetched_at:at(0)}}},GRID_DAY_CONTRACT)).reason,'source_contract_not_activated');
});
test('retained daily inspections use their explicit capture clock and reject expired windows without reading wall time',async()=>{
 for(const [contract,native,later]of [[EXCHANGE_HISTORY_CONTRACT,boc(),'2026-10-21T00:00:00.000Z']]){
  const captured=body(contract,native),first=await inspectSource(captured,contract,{now:at(0)});
  assert.equal(first.kind,'success',first.reason);assert.equal((await inspectSource(captured,contract,{now:later})).kind,'semantic');
  assert.equal((await inspectSource(captured,contract,{now:at(0)})).version,first.version);
  assert.equal((await inspectSource(captured,contract)).version,first.version);
  for(const now of [null,'invalid'])assert.equal((await inspectSource(captured,contract,{now})).kind,'semantic');
 }
});
test('the collector passes the retained response clock to daily inspection, independently of old source acquisition time',async()=>{
 const native=boc(),reader=async url=>{const path=new URL(url).pathname;if(path==='/health.json')return {status:200,data:identity};if(path==='/catalog.json')return {status:200,data:catalogue()};if(path==='/catalog.v2.json')return {status:200,data:catalogueV2()};const desk=path.slice(1,-5),country=desk==='united-states'?'United States':REGISTRY.find(c=>c.desk===desk).country;return {status:200,data:desk==='canada'?body(EXCHANGE_HISTORY_CONTRACT,native):{country,sources:{}}};};
 const report=await collect({includeUs:true,includeClaimants:true,includeRent:true,includeDailyHistory:true,read:reader,now:()=> '2026-10-21T00:00:00.000Z',id:'CONSTRUCTED-captured-clock'});
 assert.equal(report.complete,true);for(const origin of ORIGINS){assert.equal(report.results[EXCHANGE_HISTORY_CONTRACT.key][origin].kind,'semantic');assert.equal(report.requests.find(r=>r.url===origin+'/canada.json').at,'2026-10-21T00:00:00.000Z');}
});
test('legacy observation acceptance is labelled and cannot pass the separate daily-history window',()=>{
 const before=clone(checkpoint.state),start=before.started_shadow_at;
 before.runs=Array.from({length:8},(_,index)=>({id:'CONSTRUCTED-legacy-'+index,at:new Date(Date.parse(start)+index*86400000).toISOString(),complete:true,scheduled:true,requests:22}));
 const checked=before.runs.at(-1).at,legacy=shadowStatus(before,checked),expanded=dailyHistoryShadowStatus(before,checked);
 assert.equal(legacy.scope,'original-eight-desks');assert.equal(legacy.operating_window_pass,true);assert.equal(expanded.scope,scope);assert.equal(expanded.complete_runs,0);assert.equal(expanded.scheduled_evidence_pending,true);assert.equal(expanded.operating_window_pass,false);
 before.daily_history_started_shadow_at=checked;before.runs.at(-1).scope=scope;const first=dailyHistoryShadowStatus(before,checked);assert.equal(first.complete_runs,1);assert.equal(first.elapsed_hours,0);assert.equal(first.operating_window_pass,false);
});
test('BoC paired history exactdate IDs and every retained observation survive; no missingdate zero manufactured',async()=>{const c=EXCHANGE_HISTORY_CONTRACT,native=boc(),b=body(c,native),r=await inspectSource(b,c);assert.equal(r.kind,'success',r.reason);assert.equal(r.observations.length,38);assert.ok(r.observations.every(o=>!o.id.endsWith('2026-10-12')));assert.equal((await inspectSource(body(c,native,10),c)).version,r.version);const bad=clone(native);bad.rows[0].value=0;assert.equal((await inspectSource(body(c,bad),c)).kind,'semantic');});
test('new typed successes need their exact separate independent approval and cannot clear unrelated prior repairs',async()=>{const c=sourceContract('canada/jobs'),r=await inspectSource(body(c,statcan('jobs')),c),before=clone(checkpoint.state);const after=applyRun(before,run(0,{results:{[c.key]:Object.fromEntries(ORIGINS.map(o=>[o,r]))}}),{approvedRelease:review()});assert.ok(after.sources[c.key].pending_verification);assert.equal(after.repairs['verify:'+c.key].state,'evidence_review');assert.deepEqual(after.outbox,before.outbox);assert.ok(Object.keys(before.repairs).every(k=>JSON.stringify(before.repairs[k])===JSON.stringify(after.repairs[k])));const approved=applyRun(after,run(1,{results:{[c.key]:Object.fromEntries(ORIGINS.map(o=>[o,r]))}}),{approvedRelease:review(),approvedVersions:{[c.key]:{version:r.version,evidence:'CONSTRUCTED-independent-reference'}}});assert.equal(approved.sources[c.key].pending_verification,undefined);assert.equal(approved.repairs['verify:'+c.key].state,'resolved');assert.equal(approved.daily_history_started_shadow_at,undefined);});
