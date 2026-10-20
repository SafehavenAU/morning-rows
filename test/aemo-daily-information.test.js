import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {AEMO_DAILY_INDEX,readAemoDailyBundles} from '../lib/aemo-daily-bundles.js';
import {catalogue,measuresFor,selectedResponse,validateSelection} from '../lib/information.js';
import {INVENTORY} from '../lib/inventory.js';
import {gapCells,validateGapRepresentation} from '../lib/gap-information.js';
const root=new URL('../verification/gap-followup-2026-10-20/aemo-daily/original/',import.meta.url),now='2026-10-20T12:30:00.000Z';
const names=['PUBLIC_PRICES_202610180000_20261019040502.zip','PUBLIC_PRICES_202610190000_20261020040503.zip'];
const index=readFileSync(new URL('directory-listing-excerpt.html',root),'utf8');
const zip=names.map(n=>readFileSync(new URL(n,root)));
async function fixture(mode){
 const inputs=zip.map((b,i)=>{if(i||!mode)return b;const member=names[0].replace('.zip','.CSV'),text=strFromU8(unzipSync(b)[member]);const lines=text.split(/\r?\n/).map(line=>{const row=line.split(',');if(row[0]==='D'&&row[6]==='SA1'&&row[4].replaceAll('"','')==='2026/10/19 00:05:00')row[8]=mode==='failure'?'..':'1002.09';return row.join(',');});return zipSync({[member]:strToU8(lines.join('\r\n'))},{level:6});});
 return readAemoDailyBundles({now:()=>now,fetcher:async url=>url===AEMO_DAILY_INDEX?new Response(index):new Response(inputs[names.indexOf(url.slice(AEMO_DAILY_INDEX.length))])});
}
const native=await fixture();
async function select(value,{measure,observation,clock=now,status=value.status,healthClock=now}={}){
 const url=new URL('https://morningrows.com/australia.json?source=grid_day');if(measure)url.searchParams.set('measure',measure);if(observation)url.searchParams.set('observation',observation);
 const selection=validateSelection(url);if(selection.status)return {status:selection.status,body:{error:selection.code}};
 return selectedResponse({grid_day:value,sources:{grid_day:{status,fetched_at:healthClock}}},selection,{now:clock});
}
test('AEMO directory has ten bounded definitions alongside original grid',()=>{
 assert.deepEqual(INVENTORY.australia.filter(x=>x[0]==='grid_day'),[['grid_day','grid_day','sources.grid_day']]);assert.ok(INVENTORY.australia.some(x=>x[0]==='grid'));
 const card=catalogue('australia').sources.find(s=>s.key==='grid_day');assert.equal(card.measure_count,10);assert.match(card.limits,/288|Two NEM/);assert.match(card.selection,/latest|Latest/);
 assert.equal(new Set(card.measures.map(m=>m.id)).size,10);assert.ok(card.measures.every(m=>m.observation_selector==='YYYY-MM-DD'&&m.definition.dimensions.dataset==='DREGION'));
 assert.equal(measuresFor('canada','grid_day').length,0);
});
test('native source, measure and exact selectors resolve all ten numeric summary pointers',async()=>{
 const all=await select(native);assert.equal(all.status,200);assert.deepEqual(all.body.data,native);assert.deepEqual(all.body.context,native);assert.equal(all.body.observations.length,10);assert.deepEqual(all.body.unavailable_measures,[]);
 const cells=gapCells('australia','grid_day',native,{retrieved_at:now});assert.equal(cells.length,10);
 for(const cell of cells){assert.equal(cell.pointer.split('/').slice(1).reduce((v,k)=>v[k],native),cell.value);const one=await select(native,{measure:cell.definition.id,observation:native.calendar_day});assert.equal(one.status,200);assert.equal(one.body.observations.length,1);const obs=one.body.observations[0];assert.equal(obs.value,cell.value);assert.equal(obs.native_pointer,'/grid_day'+cell.pointer);assert.equal(obs.id,`https://morningrows.com/australia.json?source=grid_day&measure=${cell.definition.id}&observation=2026-10-19`);assert.equal(obs.publisher_status,null);assert.equal(obs.qualifications.dataset,'DREGION');assert.equal(Object.hasOwn(obs.qualifications,'period_type'),false);assert.deepEqual(one.body.data,cell.row);assert.equal((await select(native,{measure:cell.definition.id})).body.observations[0].version,obs.version);}
});
test('exact dates refuse adjacent/current/future periods and invalid dates distinctly',async()=>{
 for(const observation of ['2026-10-18','2026-10-20','2027-01-01'])assert.equal((await select(native,{measure:'SA1.mean',observation})).body.error,'observation_not_retained');
 for(const observation of ['2026-02-30','2026-10','2026-10-19T00:00:00+10:00']){const result=await select(native,{measure:'SA1.mean',observation});assert.equal(result.status,400);assert.equal(result.body.error,'invalid_observation');}
 assert.equal((await select(native,{measure:'NSW1.mean'})).body.error,'unknown_measure');assert.equal((await select(native,{observation:'2026-10-19'})).body.error,'incomplete_selection');
 for(const query of ['source=grid_day&geography=VIC1','source=grid_day&measure=SA1.mean&measure=VIC1.mean','source=grid_day&day=2026-10-19'])assert.equal(validateSelection(new URL('https://morningrows.com/australia.json?'+query)).status,400);
});
test('public adapters use current request clock and reject stale cache even if acquisition was valid',async()=>{
 const stale=await select(native,{measure:'SA1.mean',clock:'2026-10-20T14:00:00.000Z'});assert.equal(stale.status,503);assert.equal(stale.body.data,null);assert.deepEqual(stale.body.observations,[]);
 assert.equal(validateGapRepresentation('australia','grid_day',native,{retrieved_at:now}),true);assert.equal(validateGapRepresentation('australia','grid_day',native,{}),false);
});
test('failed SA region keeps all five VIC observations and explicit missing-measure records',async()=>{
 const partial=await fixture('failure'),all=await select(partial);assert.equal(partial.status,'degraded');assert.equal(all.status,200);assert.equal(all.body.retrieval.status,'degraded');assert.equal(all.body.observations.length,5);assert.ok(all.body.observations.every(o=>o.definition.dimensions.region==='VIC1'));assert.equal(all.body.unavailable_measures.length,5);assert.ok(all.body.unavailable_measures.every(u=>u.definition.dimensions.region==='SA1'&&u.state==='unavailable'&&!Object.hasOwn(u,'value')&&!Object.hasOwn(u,'period')));
 const good=await select(partial,{measure:'VIC1.mean',observation:'2026-10-19'});assert.equal(good.status,200);assert.equal(good.body.retrieval.status,'degraded');assert.deepEqual(good.body.unavailable_measures,[]);
 const bad=await select(partial,{measure:'SA1.mean',observation:'2026-10-19'});assert.equal(bad.status,503);assert.equal(bad.body.error,'retrieval_failed');assert.equal(bad.body.data,null);assert.deepEqual(bad.body.observations,[]);
 assert.equal((await select(partial,{status:'ok'})).status,503,'health mismatch is not promoted');
});
test('bad native metadata and source failures never produce selected observations',async()=>{
 for(const mutate of [v=>v.regions[0].summary.mean++,v=>v.regions[0].intervals.pop(),v=>v.regions[0].geography='Australia',v=>v.provenance=[],v=>v.definitions[0].unit='AUD/kWh']){const v=structuredClone(native);mutate(v);const r=await select(v);assert.equal(r.status,503);assert.equal(r.body.data,null);assert.deepEqual(r.body.observations,[]);}
 const result=await select(native,{status:'error'});assert.equal(result.status,503);assert.equal(result.body.data,null);
});
test('reacquisition is not a statistical revision; price revision changes only affected derived values',async()=>{
 const all=await select(native),again=structuredClone(native);for(const p of again.provenance){p.requested_at='2026-10-20T12:31:00.000Z';p.retrieved_at='2026-10-20T12:31:00.000Z';p.sha256='a'.repeat(64);}
 const reacquired=await select(again,{clock:'2026-10-20T12:31:00.000Z',healthClock:'2026-10-20T12:31:00.000Z'});assert.equal(reacquired.status,200);assert.equal(all.body.content_version,reacquired.body.content_version);assert.deepEqual(all.body.observations.map(o=>o.version),reacquired.body.observations.map(o=>o.version));
 const revised=await select(await fixture('revision'));assert.equal(revised.status,200);assert.notEqual(revised.body.content_version,all.body.content_version);
 const byId=new Map(all.body.observations.map(o=>[o.definition.id,o]));for(const row of revised.body.observations){const old=byId.get(row.definition.id);if(row.value===old.value)assert.equal(row.version,old.version);else assert.notEqual(row.version,old.version);}
});
