import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../lib/monitor-state.js';
import {envelope} from '../lib/monitor-store.js';
test('offline audit validates the digest, distinguishes missing receipt and never claims independent acceptance',()=>{
 const dir=mkdtempSync(join(tmpdir(),'shadow-audit-')),file=join(dir,'checkpoint.json');
 const at=i=>new Date(Date.UTC(2026,9,18+i)).toISOString();
 const s=initialState(at(0),{},{collection_interval_minutes:1440,watchdog_grace_minutes:120});
 s.started_shadow_at=at(0);s.last_complete_collection_at=at(7);
 s.runs=Array.from({length:8},(_,i)=>({id:String(i),at:at(i),scheduled:true,complete:true}));
 s.outbox=[{id:'fixture-delivery',type:'delivery_test',created_at:at(0),status:'pending'}];
 const run=()=>spawnSync(process.execPath,['scripts/audit-shadow-window.mjs',file,at(7)],{encoding:'utf8'});
 try{
  writeFileSync(file,JSON.stringify(envelope(s)));let r=run();assert.equal(r.status,1);
  let body=JSON.parse(r.stdout);assert.equal(body.window.operating_window_pass,true);assert.equal(body.recorded_gates_satisfied,false);
  s.outbox[0]={...s.outbox[0],status:'delivered',receipt:'SIMULATED TEST RECEIPT ONLY',delivered_at:at(6)};
  writeFileSync(file,JSON.stringify(envelope(s)));r=run();assert.equal(r.status,0);body=JSON.parse(r.stdout);
  assert.equal(body.recorded_gates_satisfied,true);assert.equal(body.independent_verification_required.length,3);assert.match(body.scope,/Does not establish operational acceptance/);
  assert.equal(r.stdout.includes('SIMULATED TEST RECEIPT'),false);
  const corrupt=envelope(s);corrupt.state.sequence++;writeFileSync(file,JSON.stringify(corrupt));r=run();assert.equal(r.status,2);assert.match(r.stderr,/corrupt/);
 }finally{rmSync(dir,{recursive:true});}
});
