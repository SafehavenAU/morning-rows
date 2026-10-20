import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AEMO_DAILY_BUNDLE_CONTRACT,GRID_DAY_CONTRACT,REMAINING_CONTRACTS,inspectSource} from '../lib/monitor-contracts.js';
import {validateAemoDailyBundlesRepresentation} from '../lib/aemo-daily-bundles.js';
const load=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const aemo=load('verification/gap-followup-2026-10-20/aemo-daily/protected-preview/live-native.json');
const cqc=load('verification/gap-followup-2026-10-20/cqc-pdf/worker-reader.json').live.native;
const now='2026-10-20T13:10:00.000Z';
const cqcContract=REMAINING_CONTRACTS.find(c=>c.key==='england/care_assessment_cohort');
const body=(contract,native,clock=now)=>({country:contract.country,[contract.source]:structuredClone(native),sources:{[contract.source]:{status:'ok',fetched_at:clock}}});

test('AEMO daily ZIP contract verifies ten derived cells while historical monthly route stays held',async()=>{
 const b=body(AEMO_DAILY_BUNDLE_CONTRACT,aemo),current=await inspectSource(b,AEMO_DAILY_BUNDLE_CONTRACT,{now});
 assert.equal(current.kind,'success',current.reason);assert.equal(current.observations.length,10);assert.deepEqual(current.periods,['2026-10-19']);
 assert.equal((await inspectSource(b,GRID_DAY_CONTRACT,{now})).reason,'source_contract_not_activated');
});

test('AEMO public acquisition/current-day clocks independently fail closed at the 14:00 UTC boundary',async()=>{
 for(const clock of [undefined,null,'','2026-02-30T00:00:00Z','2026-10-20T13:11:00.000Z','2026-10-20T12:00:00.000Z']){
  const b=body(AEMO_DAILY_BUNDLE_CONTRACT,aemo);b.sources.grid_day.fetched_at=clock;
  assert.equal((await inspectSource(b,AEMO_DAILY_BUNDLE_CONTRACT,{now})).kind,'semantic',String(clock));
 }
 assert.equal((await inspectSource(body(AEMO_DAILY_BUNDLE_CONTRACT,aemo),AEMO_DAILY_BUNDLE_CONTRACT,{now:'2026-10-20T14:00:00.000Z'})).kind,'semantic');
});

test('AEMO acquisition changes preserve versions; balanced input revisions change source evidence',async()=>{
 const original=await inspectSource(body(AEMO_DAILY_BUNDLE_CONTRACT,aemo),AEMO_DAILY_BUNDLE_CONTRACT,{now});
 const reacquired=structuredClone(aemo);for(const [i,p]of reacquired.provenance.entries()){p.requested_at=`2026-10-20T13:00:0${i*2}.000Z`;p.retrieved_at=`2026-10-20T13:00:0${i*2+1}.000Z`;p.sha256='a'.repeat(64);} // Constructed metadata-only control.
 assert.equal((await inspectSource(body(AEMO_DAILY_BUNDLE_CONTRACT,reacquired),AEMO_DAILY_BUNDLE_CONTRACT,{now})).version,original.version);
 const revised=structuredClone(aemo),r=revised.regions[0];
 const candidates=r.intervals.filter(i=>i.price>Math.max(1,r.summary.minimum+1)&&i.price<r.summary.maximum-1).slice(0,2);
 assert.equal(candidates.length,2);for(const [i,row]of candidates.entries()){row.price=Number((row.price+(i?-0.01:0.01)).toFixed(2));row.price_raw=row.layout2_price_raw=row.price.toFixed(5);}
 assert.equal(validateAemoDailyBundlesRepresentation(revised,{now}),true);
 const result=await inspectSource(body(AEMO_DAILY_BUNDLE_CONTRACT,revised),AEMO_DAILY_BUNDLE_CONTRACT,{now});
 assert.equal(result.kind,'success',result.reason);assert.deepEqual(result.observations,original.observations);assert.notEqual(result.version,original.version);
});

test('AEMO incomplete/wrong summaries are semantic failures; transport state is not numeric success',async()=>{
 for(const mutate of [v=>v.regions[0].intervals.pop(),v=>v.regions[0].summary.mean++,v=>v.regions[0].region='NSW1',v=>v.provenance=[]]){
  const b=body(AEMO_DAILY_BUNDLE_CONTRACT,aemo);mutate(b.grid_day);assert.equal((await inspectSource(b,AEMO_DAILY_BUNDLE_CONTRACT,{now})).kind,'semantic');
 }
 const b=body(AEMO_DAILY_BUNDLE_CONTRACT,aemo);b.sources.grid_day.status='error';assert.equal((await inspectSource(b,AEMO_DAILY_BUNDLE_CONTRACT,{now})).kind,'transport');
});

test('CQC fixed historical PDF keeps exact five values and does not age into a daily freshness failure',async()=>{
 const current=await inspectSource(body(cqcContract,cqc),cqcContract,{now});assert.equal(current.kind,'success',current.reason);assert.equal(current.observations.length,5);assert.deepEqual(current.observations.map(o=>o.value).sort((a,b)=>a-b),[65,125,809,2063,3062]);assert.deepEqual(current.periods,['2025-08-01']);
 const later=structuredClone(cqc);later.provenance[0].retrieved_at='2027-10-20T13:00:00.000Z';
 const next=await inspectSource(body(cqcContract,later,'2027-10-20T13:10:00.000Z'),cqcContract,{now:'2027-10-20T13:10:00.000Z'});assert.equal(next.kind,'success',next.reason);assert.equal(next.version,current.version);
});

test('CQC wrong cohort, changed bytes, partial rows, bad units and missing clock cannot become approved values',async()=>{
 for(const mutate of [v=>v.rows[0].value++,v=>v.rows.pop(),v=>v.rows[0].unit='locations',v=>v.rows[0].period='2025-08-02',v=>v.geography='United Kingdom',v=>v.provenance[0].sha256='0'.repeat(64),v=>v.provenance=[]]){
  const b=body(cqcContract,cqc);mutate(b.care_assessment_cohort);assert.equal((await inspectSource(b,cqcContract,{now})).kind,'semantic');
 }
 const b=body(cqcContract,cqc);delete b.sources.care_assessment_cohort.fetched_at;assert.equal((await inspectSource(b,cqcContract,{now})).kind,'semantic');
});
