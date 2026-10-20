import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCpi} from '../lib/us-cpi.js';
import {catalogueV2} from '../lib/information-v2.js';
import {REGISTRY,US_CONTRACT,ORIGINS,inspectSource,validateUsDiscovery} from '../lib/monitor-contracts.js';
import {initialState,applyRun,queueDeliveryTest} from '../lib/monitor-state.js';
import {collect} from '../scripts/monitor.mjs';
const files=JSON.parse(readFileSync(new URL('./fixtures/us-cpi.json',import.meta.url))).files;
const body={country:'United States',cpi:parseCpi(files),sources:{cpi:{status:'ok',fetched_at:'2026-10-18T22:00:00Z'}}};
const time=m=>new Date(Date.parse('2026-10-18T22:00:00Z')+m*60000).toISOString();
const result=await inspectSource(body,US_CONTRACT);
const from={source_revision:'a'.repeat(40),worker_version:'11111111-1111-1111-1111-111111111111',build_fingerprint:'1'.repeat(16),source_dirty:false};
const to={source_revision:'b'.repeat(40),worker_version:'22222222-2222-2222-2222-222222222222',build_fingerprint:'2'.repeat(16),source_dirty:false};
const review={from,to,evidence:'retained-release-evidence',scope:'eight-legacy-plus-us-cpi'};
const run=(m,value=result)=>({id:'constructed-'+m,finished_at:time(m),complete:true,scheduled:false,scope:review.scope,requests:Array(24).fill({}),identities:Object.fromEntries(ORIGINS.map(o=>[o,to])),results:{[US_CONTRACT.key]:Object.fromEntries(ORIGINS.map(o=>[o,value]))}});
test('US monitor retains 13 months and known unavailable October without a false outage',()=>{
 assert.equal(result.kind,'success');assert.equal(result.observations.length,13);assert.equal(result.nonnumeric.length,1);
 let s=initialState(time(0),to,{collection_interval_minutes:1440,watchdog_grace_minutes:120});
 const approval={approvedVersions:{[US_CONTRACT.key]:{version:result.version,evidence:'independent-original-reconciliation'}}};
 s=applyRun(s,run(1),approval);s=applyRun(s,run(30),approval);
 assert.equal(s.sources[US_CONTRACT.key].change,'unchanged');assert.equal(s.outbox.length,0);assert.equal(s.sources[US_CONTRACT.key].candidate,undefined);
});
test('US monitor distinguishes real revision, new month, same-month loss and transport failure',async()=>{
 let s=applyRun(initialState(time(0),to),run(1));
 const revised=structuredClone(body);revised.cpi.rows.at(-1).value=336.941;revised.cpi.rows.at(-1).value_text='336.941';
 const changed=await inspectSource(revised,US_CONTRACT);assert.equal(applyRun(s,run(2,changed)).sources[US_CONTRACT.key].change,'revision');
 const missing=structuredClone(body);Object.assign(missing.cpi.rows.at(-1),{value:null,value_text:'-',value_state:'missing'});
 const lost=await inspectSource(missing,US_CONTRACT);assert.ok(applyRun(s,run(2,lost)).sources[US_CONTRACT.key].candidate);
 const wrong=structuredClone(body);wrong.cpi.definition.geography='California';assert.equal((await inspectSource(wrong,US_CONTRACT)).kind,'semantic');
 const failure=await inspectSource({...body,cpi:null,sources:{cpi:{status:'error',http_status:429}}},US_CONTRACT);assert.equal(failure.kind,'transport');
 const nextFiles={...files,data:files.data+'CUUR0000SA0\t2026\tM10\t337.000\t\n',series:files.series.replace('2026\tM09','2026\tM10')};
 const next=await inspectSource({...body,cpi:parseCpi(nextFiles)},US_CONTRACT);assert.equal(applyRun(s,run(2,next)).sources[US_CONTRACT.key].change,'new_period');
});
test('reviewed identity transition preserves incidents, repair queue, receipt state and original shadow start',()=>{
 let s=queueDeliveryTest(initialState(time(0),from,{collection_interval_minutes:1440,watchdog_grace_minutes:120}),time(0));
 s.incidents.known={id:'old',acknowledged:true};s.repairs.old={state:'open'};s.started_shadow_at=time(0);
 const before=structuredClone(s),next=applyRun(s,run(1),{approvedRelease:review});
 assert.deepEqual(next.approved_identity,to);assert.deepEqual(next.outbox,before.outbox);assert.deepEqual(next.incidents,before.incidents);assert.deepEqual(next.repairs.old,before.repairs.old);assert.equal(next.started_shadow_at,before.started_shadow_at);assert.equal(next.sequence,1);assert.equal(next.us_scope_first_complete_at,time(1));assert.equal(next.release_reviews.length,1);assert.equal(next.us_started_shadow_at,undefined);
 assert.equal(applyRun(next,run(2),{approvedRelease:review}).release_reviews.length,1);
 for(const mutation of [r=>r.complete=false,r=>r.scope='legacy',r=>r.identities[ORIGINS[1]].source_dirty=true,r=>delete r.identities[ORIGINS[1]]]){const r=structuredClone(run(1));mutation(r);assert.deepEqual(applyRun(s,r,{approvedRelease:review}).approved_identity,from);}
 const wrong={...review,from:{...from,source_revision:'c'.repeat(40)}};assert.deepEqual(applyRun(s,run(1),{approvedRelease:wrong}).approved_identity,from);
 assert.throws(()=>applyRun(s,run(1),{approvedRelease:{...review,evidence:''}}),/reviewed release/);
});
test('staged nine-desk collection preserves every legacy obligation and checks both catalogues',async()=>{
 assert.equal(REGISTRY.length,108);assert.ok(validateUsDiscovery(catalogueV2()));
 const snapshot=JSON.parse(readFileSync(new URL('../verification/structure-2026-10-17/selected-snapshot.json',import.meta.url)));
 const read=async url=>{const p=new URL(url).pathname;return {status:200,data:p==='/health.json'?to:p==='/catalog.v2.json'?catalogueV2():p==='/catalog.json'?{schema_version:'1.0',countries:[...new Set(REGISTRY.map(c=>c.desk))].map(d=>({records:`/${d}.json`}))}:p==='/united-states.json'?body:snapshot[p.slice(1,-5)]};};
 const legacy=await collect({read,now:()=>time(1),id:'legacy'});assert.equal(legacy.requests.length,20);assert.equal(Object.keys(legacy.results).length,108);
 const extended=await collect({read,includeUs:true,now:()=>time(1),id:'extended'});assert.equal(extended.requests.length,24);assert.equal(Object.keys(extended.results).length,109);assert.equal(extended.complete,true);assert.deepEqual(extended.results[US_CONTRACT.key][ORIGINS[0]],result);
 const broken=await collect({read:async url=>url.endsWith('/catalog.v2.json')?{status:200,data:{}}:read(url),includeUs:true,now:()=>time(1),id:'bad-catalogue'});assert.equal(broken.complete,false);assert.equal(broken.probe_errors.length,2);
});
