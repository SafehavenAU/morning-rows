import test from 'node:test';
import assert from 'node:assert/strict';
import {shadowStatus} from '../lib/monitor-state.js';
const start=Date.parse('2026-10-18T23:22:22.161Z');
const at=hours=>new Date(start+hours*3600000).toISOString();
const state=(times=[0,24,48,72,96,120,144,168])=>({
 policy:{collection_interval_minutes:1440,watchdog_grace_minutes:120},started_shadow_at:at(0),last_complete_collection_at:at(times.at(-1)),
 runs:times.map((h,i)=>({id:'scheduled-'+i,at:at(h),scheduled:true,complete:true})),
});
test('seven days must be spanned by actual scheduled completions',()=>{
 assert.equal(shadowStatus(state(),at(168)).operating_window_pass,true);
 const dense=state([0,23,46,69,92,115,138,161]);
 const result=shadowStatus(dense,at(168));
 assert.equal(result.elapsed_hours,161);assert.equal(result.seven_days_elapsed,false);assert.equal(result.operating_window_pass,false);
});
test('manual collections neither count nor refresh the scheduled deadline',()=>{
 const s=state();s.runs.push({id:'manual',scheduled:false,complete:true,at:at(195)});s.last_complete_collection_at=at(195);
 assert.equal(shadowStatus(s,at(195)).operating_window_pass,false);
 assert.equal(shadowStatus(state(),at(194)).operating_window_pass,true);
 assert.equal(shadowStatus(state(),at(194.001)).operating_window_pass,false);
 const manual=state();manual.runs[4].scheduled=false;assert.equal(shadowStatus(manual,at(168)).operating_window_pass,false);
});
test('bad chronology, duplicate IDs, missing anchor, future and invalid times fail closed',()=>{
 for(const change of [s=>s.runs[1].id=s.runs[0].id,s=>s.runs.reverse(),s=>s.runs[2].at=s.runs[1].at,s=>s.runs[2].at='invalid',s=>s.started_shadow_at=at(-24),s=>s.runs.at(-1).at=at(169)]){
  const s=state();change(s);assert.equal(shadowStatus(s,at(168)).operating_window_pass,false);
 }
 assert.equal(shadowStatus(state(),'invalid').operating_window_pass,false);
});
test('failed runs, excessive gaps and invalid cadence cannot pass',()=>{
 const failed=state();failed.runs[4].complete=false;assert.equal(shadowStatus(failed,at(168)).operating_window_pass,false);
 assert.equal(shadowStatus(state([0,24,48,75,98,121,144,168]),at(168)).operating_window_pass,false);
 for(const policy of [{collection_interval_minutes:0,watchdog_grace_minutes:120},{collection_interval_minutes:1440,watchdog_grace_minutes:-1},{}]){
  const s=state();s.policy=policy;assert.equal(shadowStatus(s,at(168)).operating_window_pass,false);
 }
});
test('historical failed schedule before the preserved shadow start does not reset the window',()=>{
 const s=state();s.runs.unshift({id:'old-failure',at:at(-24),scheduled:true,complete:false});
 assert.equal(shadowStatus(s,at(168)).operating_window_pass,true);
 const unchanged=structuredClone(s);shadowStatus(s,at(170));assert.deepEqual(s,unchanged);
});
