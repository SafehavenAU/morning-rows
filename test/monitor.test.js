import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {REGISTRY,ORIGINS,inspectSource,fingerprint,validateNativeTask} from '../lib/monitor-contracts.js';
import {initialState,importAcknowledged,applyRun,acknowledge,shadowStatus,watchdog} from '../lib/monitor-state.js';
import {envelope,decodeCheckpoint,loadCheckpoint,saveCheckpoint,withLock} from '../lib/monitor-store.js';
import {collect} from '../scripts/monitor.mjs';
const snap=JSON.parse(await readFile(new URL('../verification/structure-2026-10-17/selected-snapshot.json',import.meta.url)));
const at=m=>new Date(Date.parse('2026-10-18T00:00:00Z')+m*60000).toISOString();
const result={kind:'success',retrieved_at:at(0),version:'one',periods:['2024-25'],observations:[{id:'a',period:'2024-25',value:0,value_state:'observed'}],metadata:{licence:'OGL'},nonnumeric:[]};
const run=(m,r=result,id=String(m))=>({id,finished_at:at(m),complete:true,requests:[],results:{'australia/hospital':Object.fromEntries(ORIGINS.map(o=>[o,r]))},probe_errors:[]});
const baseline=()=>applyRun(initialState(at(0),{}),run(0));
test('registry covers all 108 unique source obligations including nested England health',()=>{assert.equal(REGISTRY.length,108);assert.equal(new Set(REGISTRY.map(x=>x.key)).size,108);assert.equal(REGISTRY.find(x=>x.key==='england/also.roads').health,'also.sources.roads');});
test('all described snapshot sections preserve their actual contracts',async()=>{for(const c of REGISTRY.filter(x=>x.described_measures)){const r=await inspectSource(snap[c.desk],c);assert.equal(r.kind,'success',c.key+': '+r.reason);assert.equal(r.observations.length,c.described_measures);}});
test('wrong geography, units and partial coverage are semantic failures',async()=>{const c=REGISTRY.find(x=>x.key==='northern-ireland/childhood_bmi');for(const mutate of [d=>d.childhood_bmi.rows[0].geography='England',d=>d.childhood_bmi.rows[0].unit='people',d=>d.childhood_bmi.rows.pop()]){const d=structuredClone(snap[c.desk]);mutate(d);assert.equal((await inspectSource(d,c)).kind,'semantic');}});
test('annual unchanged observations remain valid without advancing independent verification',()=>{const s=applyRun(baseline(),run(30*1440));assert.equal(s.sources['australia/hospital'].change,'unchanged');assert.equal(s.sources['australia/hospital'].last_contract_validated.at,at(0));assert.equal(s.sources['australia/hospital'].last_independently_verified,undefined);assert.equal(s.outbox.length,0);});
test('revisions are pending until exact evidence approval, retrieval alone cannot approve',()=>{let s=applyRun(baseline(),run(20,{...result,version:'revised'}));assert.equal(s.sources['australia/hospital'].change,'revision');assert.ok(s.sources['australia/hospital'].pending_verification);s=applyRun(s,run(40,{...result,version:'revised'}),{approvedVersions:{'australia/hospital':{version:'revised',evidence:'official-table-reconciliation'}}});assert.equal(s.sources['australia/hospital'].last_independently_verified.evidence,'official-table-reconciliation');});
test('new period and projection selection rollover are different from a correction',()=>{let s=applyRun(baseline(),run(20,{...result,version:'new',periods:['2025-26']}));assert.equal(s.sources['australia/hospital'].change,'new_period');const first=run(0);first.results['wales/projection']=first.results['australia/hospital'];delete first.results['australia/hospital'];s=applyRun(initialState(at(0),{}),first);const next=run(20,{...result,version:'next',periods:['2027']});next.results['wales/projection']=next.results['australia/hospital'];delete next.results['australia/hospital'];s=applyRun(s,next);assert.equal(s.sources['wales/projection'].change,'selection_rollover');});
test('429 confirmation deduplicates changing transport errors; recovery needs two spaced good probes',()=>{let s=applyRun(baseline(),run(1,{kind:'transport',reason:'429'}));assert.equal(s.outbox.length,0);s=applyRun(s,run(17,{kind:'transport',reason:'403'}));assert.equal(s.outbox.length,1);s=applyRun(s,run(40,{kind:'transport',reason:'timeout'}));assert.equal(s.outbox.length,1);s=applyRun(s,run(60));assert.equal(s.outbox.length,1);s=applyRun(s,run(80));assert.equal(s.outbox.length,2);assert.equal(s.outbox[1].type,'recovery');});
test('failed refresh preserves earlier evidence and a successful sibling',()=>{let s=baseline();const before=s.sources['australia/hospital'].last_contract_validated;const r=run(1,{kind:'semantic',reason:'wrong unit'});r.results['canada/exchange']=Object.fromEntries(ORIGINS.map(o=>[o,result]));s=applyRun(s,r);assert.deepEqual(s.sources['australia/hospital'].last_contract_validated,before);assert.equal(s.sources['canada/exchange'].last_successful_retrieval_at,at(1));assert.equal(s.outbox[0].severity,'P1');});
test('valid suppression stays null, numeric coverage loss persists until reviewed',()=>{let s=baseline();const suppressed={...result,version:'suppressed',observations:[{id:'a',period:'2024-25',value:null,value_state:'suppressed'}],nonnumeric:[{id:'a',state:'suppressed'}]};s=applyRun(s,run(1,suppressed));assert.equal(s.sources['australia/hospital'].candidate.observations[0].value,null);s=applyRun(s,run(20,suppressed));assert.equal(s.outbox.length,1);assert.equal(s.sources['australia/hospital'].last_contract_validated.observations[0].value,0);});
test('import honors later recovered NZ state and does not emit old acknowledged failures',()=>{const b={checked_at:at(0),last_notified_state:{nz_prices:{state:'ok'},known_degradations:[{desk:'/australia.json',source:'hospital'}]}};let s=importAcknowledged(initialState(at(0),{}),b,at(0));assert.equal(s.incidents['new-zealand/prices'],undefined);s=applyRun(s,run(20,{kind:'transport',reason:'403'}));assert.equal(s.outbox.length,0);});
test('one missing domain cannot close an incident or become 108 false outages',()=>{let s=applyRun(baseline(),run(1,{kind:'semantic',reason:'bad'}));const r=run(20);delete r.results['australia/hospital'][ORIGINS[1]];r.complete=false;s=applyRun(s,r);assert.equal(s.sources['australia/hospital'].not_fully_checked,true);assert.ok(s.incidents['australia/hospital']);assert.equal(s.outbox.length,1);});
test('duplicate run and persisted notification receipts are idempotent',()=>{let s=applyRun(baseline(),run(1,{kind:'semantic',reason:'bad'}));const id=s.outbox[0].id;s=acknowledge(s,id,'receipt-1',at(2));s=applyRun(s,run(1,{kind:'semantic',reason:'bad'}));assert.equal(s.outbox.length,1);assert.equal(s.outbox[0].status,'delivered');assert.throws(()=>acknowledge(s,id,'different',at(3)),/Conflicting/);assert.throws(()=>acknowledge(s,id,'',at(3)));});
test('checkpoint integrity and atomic predecessor protect restarts and stale writers',async()=>{const dir=await mkdtemp(join(tmpdir(),'mr-monitor-')),path=join(dir,'state.json');try{const s=baseline(),first=await saveCheckpoint(path,s,null);assert.deepEqual((await loadCheckpoint(path)).state,s);await assert.rejects(saveCheckpoint(path,s,'wrong'),/predecessor/);const second=await saveCheckpoint(path,applyRun(s,run(20)),first.digest);assert.equal(second.previous_digest,first.digest);const broken=envelope(s);broken.state.sequence++;assert.throws(()=>decodeCheckpoint(JSON.stringify(broken)),/corrupt/);await writeFile(path,'bad');await assert.rejects(saveCheckpoint(path,s,null),/refusing reset/);}finally{await rm(dir,{recursive:true,force:true});}});
test('live process lock rejects overlaps; interrupted temp file does not replace checkpoint',async()=>{const dir=await mkdtemp(join(tmpdir(),'mr-lock-')),path=join(dir,'state.json');try{await saveCheckpoint(path,baseline(),null);await writeFile(path+'.crashed.tmp','partial');await withLock(path,async()=>{await assert.rejects(withLock(path,async()=>{}),/lock exists/);assert.equal((await loadCheckpoint(path)).state.sequence,1);});}finally{await rm(dir,{recursive:true,force:true});}});
test('elapsed seven days cannot be manufactured by dense fixture runs',()=>{let s=initialState(at(0),{});for(let m=0;m<200;m++)s=applyRun(s,run(m));assert.equal(shadowStatus(s,at(200)).seven_days_elapsed,false);assert.equal(watchdog(s,at(400)),'monitor_overdue');});
test('collector HTTP-200 HTML failure is a probe error and preserves other desks',async()=>{
 const read=async url=>{const u=new URL(url);if(u.hostname.startsWith('www')&&u.pathname==='/canada.json')return {status:200,data:undefined,bytes:30};if(u.pathname==='/health.json')return {status:200,data:{worker_version:'v',source_revision:'a'.repeat(40),source_dirty:false}};if(u.pathname==='/catalog.json')return {status:200,data:{schema_version:'1.0',countries:[...new Set(REGISTRY.map(c=>c.desk))].map(d=>({records:`/${d}.json`}))}};return {status:200,data:snap[u.pathname.slice(1,-5)]};};
 const r=await collect({read,now:()=>at(0),id:'injected'});assert.equal(r.requests.length,20);assert.equal(r.complete,false);assert.equal(r.probe_errors.length,1);assert.equal(Object.keys(r.results['canada/exchange']).length,1);assert.equal(Object.keys(r.results['wales/projection']).length,2);
});

test('native sources retain observed provenance even without a described semantic contract',async()=>{
 const c=REGISTRY.find(x=>x.key==='canada/rate'),body={sources:{rate:{status:'ok',fetched_at:at(0)}},rate:{value:4,source:'Bank of Canada',unit:'percent'}};
 const source=await inspectSource(body,c);assert.ok(source.provenance_fields.includes('source'));
 let s=applyRun(initialState(at(0),{}),run(0,source));
 s=applyRun(s,run(20,{...source,provenance_fields:[]}));
 assert.equal(s.outbox[0].severity,'P1');
});
test('persistent domain divergence opens one incident without validating either candidate',()=>{
 let s=baseline();const r=run(1);r.results['australia/hospital'][ORIGINS[1]]={...result,version:'other'};s=applyRun(s,r);
 const again={...r,id:'later',finished_at:at(20)};s=applyRun(s,again);assert.equal(s.outbox.length,1);assert.equal(s.sources['australia/hospital'].last_contract_validated.version,'one');
});
test('clean but unreviewed deployment identity is a release incident',()=>{
 const s=initialState(at(0),{source_revision:'a'.repeat(40),worker_version:'approved'}),r=run(0);
 r.identities=Object.fromEntries(ORIGINS.map(o=>[o,{source_revision:'b'.repeat(40),worker_version:'other',source_dirty:false}]));
 assert.equal(applyRun(s,r).incidents['service/release'].severity,'P1');
});
test('an interrupted checkpoint upload and expired storage cannot silently reset history',async()=>{
 const {chooseCheckpoint,assertFirstBootstrap}=await import('../lib/monitor-artifact.js');
 const producer={id:10,path:'.github/workflows/monitor.yml',head_branch:'main',event:'schedule',status:'completed'};
 const artifact={id:5,workflow_run:{id:10},size_in_bytes:100,expired:false};
 assert.equal(chooseCheckpoint([artifact],[producer],11).producer.id,10);
 assert.throws(()=>chooseCheckpoint([{...artifact,expired:true}],[producer],11),/expired/);
 assert.throws(()=>chooseCheckpoint([artifact],[producer,{...producer,id:11}],12),/later monitor/);
 assert.throws(()=>assertFirstBootstrap([], [producer],11),/history/);
 assertFirstBootstrap([], [{...producer,id:11}],11);
});
test('undelivered event survives restart and no delivery claim is manufactured',()=>{
 const s=applyRun(baseline(),run(1,{kind:'semantic',reason:'injected wrong period'}));
 const restarted=decodeCheckpoint(JSON.stringify(envelope(s))).state;
 assert.equal(restarted.outbox[0].status,'pending');assert.equal(restarted.outbox[0].receipt,undefined);
 assert.equal(applyRun(restarted,run(20,{kind:'semantic',reason:'still wrong'})).outbox.length,1);
});
test('wrong desk country cannot pass transport success',async()=>{
 const read=async url=>{const p=new URL(url).pathname;if(p==='/health.json')return {status:200,data:{worker_version:'v',source_revision:'a'.repeat(40),source_dirty:false}};if(p==='/catalog.json')return {status:200,data:{schema_version:'1.0',countries:[...new Set(REGISTRY.map(c=>c.desk))].map(d=>({records:`/${d}.json`}))}};const data=structuredClone(snap[p.slice(1,-5)]);if(p==='/canada.json')data.country='Australia';return {status:200,data};};
 const r=await collect({read,now:()=>at(0),id:'wrong-country'});assert.equal(r.complete,false);assert.equal(r.results['canada/exchange'],undefined);assert.equal(r.probe_errors.length,2);
});
test('daily fallback shadow requires seven real elapsed days and scheduled checkpoints',()=>{
 let s=initialState(at(0),{}, {collection_interval_minutes:1440,watchdog_grace_minutes:120});
 for(let day=0;day<=7;day++)s=applyRun(s,{...run(day*1440),scheduled:true});
 assert.equal(shadowStatus(s,at(7*1440)).operating_window_pass,true);
 assert.equal(watchdog(s,at(7*1440+1561)),'monitor_overdue');
});
test('invalid non-main workflow installation does not masquerade as prior monitor state',async()=>{
 const {assertFirstBootstrap}=await import('../lib/monitor-artifact.js');
 assertFirstBootstrap([],[{id:1,path:'.github/workflows/monitor.yml',head_branch:'feature',event:'push'}],2);
 assert.throws(()=>assertFirstBootstrap([],[{id:1,path:'.github/workflows/monitor.yml',head_branch:'main',event:'schedule'}],2),/history/);
});
