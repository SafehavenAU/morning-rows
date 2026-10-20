import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INVENTORY} from '../lib/inventory.js';
import {bocHistoryWindow,parseBocHistory} from '../lib/boc-history.js';
import {STATCAN_HEADLINE_SOURCES,parseStatcanHeadline} from '../lib/statcan-headlines.js';
import {walesTax} from '../lib/fiscal-observations.js';
import {isGapSource,gapDefinitions,validateGapRepresentation,gapCells,gapSelectionFailure,gapSelectedData,gapSemanticRow,gapSemanticContext} from '../lib/gap-information.js';

const clock='2026-10-20T10:00:00Z',acquisition={retrieved_at:clock};
const root=new URL('../verification/gap-pass-2026-10-20/',import.meta.url);
const json=path=>JSON.parse(readFileSync(new URL(path,root)));
const boc=parseBocHistory(json('boc/original/window.json'),json('boc/original/latest.json'),bocHistoryWindow(clock));
const statcan=Object.fromEntries(STATCAN_HEADLINE_SOURCES.map(source=>[source,parseStatcanHeadline(source,...['wds-selected.json','series-metadata.json','cube-metadata.json'].map(file=>json(`statcan/${source}/original/${file}`)))]));
const wra=walesTax(readFileSync(new URL('./fixtures/wra-tax.csv',import.meta.url),'utf8'),new Date(clock));
const samples=[['canada','exchange_history',boc,38],...STATCAN_HEADLINE_SOURCES.map(key=>['canada',key,statcan[key],key==='jobs'?11:1]),['wales','land_transaction_tax',wra,4]];
const select=(desk,key,value,options={})=>gapSelectedData(desk,key,value,{...acquisition,...options});
const failure=(desk,key,value,options={})=>gapSelectionFailure(desk,key,value,{...acquisition,...options});

test('inventory exposes the reviewed daily AEMO source while keeping legacy grid and dated FX',()=>{
 for(const [desk,oldKey,newKey] of [['canada','exchange','exchange_history']]){
  for(const key of [oldKey,newKey])assert.deepEqual(INVENTORY[desk].filter(x=>x[0]===key),[[key,key,'sources.'+key]]);
 }
 assert.ok(INVENTORY.australia.some(x=>x[0]==='grid'));
 assert.ok(INVENTORY.australia.some(x=>x[0]==='grid_day'));
 assert.equal(isGapSource('australia','grid_day'),true);
 for(const [desk,key] of [['canada','grid_day'],['australia','exchange_history'],['england','land_transaction_tax'],['canada','product']]){
  assert.equal(isGapSource(desk,key),false);assert.equal(gapDefinitions(desk,key),null);
  assert.equal(gapCells(desk,key,{},acquisition),null);assert.equal(gapSelectionFailure(desk,key,{},acquisition),null);
  assert.equal(gapSelectedData(desk,key,{},acquisition),undefined);
 }
});
for(const [desk,key,native,count] of samples){
 test(`${desk}/${key}: definitions, cells and selected rows retain exact source identities`,()=>{
  assert.equal(isGapSource(desk,key),true);
  assert.equal(validateGapRepresentation(desk,key,native,acquisition),true);
  const cells=gapCells(desk,key,native,acquisition),definitions=gapDefinitions(desk,key);
  assert.equal(cells.length,count);assert.equal(new Set(definitions.map(d=>d.id)).size,definitions.length);
  for(const cell of cells){
   assert.ok(cell.definition);assert.equal(cell.definition.unit,cell.row.unit);
   assert.equal(cell.value,cell.row.value);assert.equal(cell.period,cell.row.period);assert.equal(cell.value_state,'observed');
   assert.deepEqual(select(desk,key,native,{measure:cell.definition.id,observation:cell.period}),cell.row);
  }
  assert.equal(failure(desk,key,native),null);
  assert.equal(failure(desk,key,native,{measure:'outside-the-reviewed-contract'}).error,'unknown_measure');
  assert.equal(failure(desk,key,native,{observation:cells[0].period}).status,400);
 });
 test(`${desk}/${key}: missing or invalid public clocks cannot bypass native validation`,()=>{
  for(const bad of [undefined,{}, {retrieved_at:undefined},{retrieved_at:null},{retrieved_at:'2026-02-30T10:00:00Z'},{retrieved_at:'2026-10-20T10:00:00'},{retrieved_at:'bad'}]){
   assert.equal(validateGapRepresentation(desk,key,native,bad),false);
   assert.throws(()=>gapCells(desk,key,native,bad),/representation validation failed/);
  }
  assert.equal(failure(desk,key,native,{retrieved_at:undefined}).error,'representation_validation_failed');
 });
}
test('FX source and measure arrays preserve every published pair; exact date is one row',()=>{
 assert.equal(select('canada','exchange_history',boc),boc.rows);
 const usd=select('canada','exchange_history',boc,{measure:'FXUSDCAD'});
 assert.equal(usd.length,19);assert.ok(usd.every(row=>row.series==='FXUSDCAD'&&row.unit==='CAD per USD'));
 assert.equal(select('canada','exchange_history',boc,{measure:'FXGBPCAD',observation:'2026-10-19'}).value,1.8767);
 const missing=failure('canada','exchange_history',boc,{measure:'FXUSDCAD',observation:'2026-10-12'});
 assert.equal(missing.status,404);assert.equal(missing.error,'not_published_on_date');assert.match(missing.message,/No holiday, zero or carry-forward/);
 assert.equal(failure('canada','exchange_history',boc,{measure:'FXUSDCAD',observation:'2026-09-19'}).error,'observation_not_retained');
 assert.equal(failure('canada','exchange_history',boc,{measure:'FXUSDCAD',observation:'2026-09-31'}).error,'invalid_observation');
 assert.equal(failure('canada','exchange_history',boc,{retrieved_at:'2026-10-21T00:00:00Z'}).error,'representation_validation_failed');
});
test('FX latest-anchor mismatch is refused before any selected rows are returned',()=>{
 const changed=structuredClone(boc);changed.rows.splice(-2);changed.metadata.date_count--;changed.metadata.observation_count-=2;changed.metadata.latest_period=changed.rows.at(-1).period;
 assert.equal(failure('canada','exchange_history',changed,{measure:'FXUSDCAD'}).status,503);
 assert.throws(()=>select('canada','exchange_history',changed,{measure:'FXUSDCAD'}));
});
test('StatCan source data and original row qualifiers remain intact with stable native pointers',()=>{
 for(const key of STATCAN_HEADLINE_SOURCES){
  const native=statcan[key];assert.equal(select('canada',key,native),native);
  for(const cell of gapCells('canada',key,native,acquisition)){
   assert.equal(cell.pointer.split('/').slice(1).reduce((value,key)=>value[key],native),cell.row);
   assert.equal(select('canada',key,native,{measure:cell.definition.id}),cell.row);
   assert.equal(cell.row.release_timezone,null);assert.ok(cell.row.release_timestamp_raw);
  }
 }
 const jobs=gapCells('canada','jobs',statcan.jobs,acquisition);
 assert.equal(jobs.length,11);assert.equal(jobs[1].row.geography,'Newfoundland and Labrador');assert.equal(jobs[1].value,9.1);
 assert.equal(jobs[1].row.rate,9.1);assert.ok(jobs[1].row.metadata);assert.ok(jobs[1].row.provenance);
 assert.match(gapCells('canada','shop',statcan.shop,acquisition)[0].row.quality,/excellent/);
 assert.match(gapCells('canada','homes',statcan.homes,acquisition)[0].row.licence_notice.source_notice,/2026-Q3/);
 assert.equal(validateGapRepresentation('canada','jobs',statcan.jobs,{retrieved_at:'2026-01-01T00:00:00Z'}),false);
 const changed=structuredClone(statcan.jobs);changed[1].geography='Canada';
 assert.equal(failure('canada','jobs',changed,{measure:jobs[1].definition.id}).status,503);
});
test('WRA overlapping coverage is selected by identity even after native row reordering',()=>{
 const reversed={...wra,rows:wra.rows.toReversed()},cells=gapCells('wales','land_transaction_tax',reversed,acquisition);
 assert.equal(cells.length,4);assert.equal(select('wales','land_transaction_tax',reversed),reversed);
 for(const cell of cells){
  const original=cell.pointer.split('/').slice(1).reduce((value,key)=>value[key],reversed);
  assert.equal(original.coverage,cell.row.coverage);assert.equal(original.transaction_type,cell.row.transaction_type);assert.equal(original.value,cell.value);
  assert.equal(select('wales','land_transaction_tax',reversed,{measure:cell.definition.id}).coverage,cell.row.coverage);
 }
 const suppressed=structuredClone(wra);suppressed.rows[0].notes='Confidential';
 assert.equal(failure('wales','land_transaction_tax',suppressed).status,503);
});
test('semantic content excludes acquisition-only changes but preserves release and revision qualifiers',()=>{
 const original=structuredClone(statcan.jobs[0]);
 original.provenance=[{retrieved_at:clock,sha256:'a'.repeat(64)}];
 original.metadata.provenance=[{retrieved_at:clock}];
 const reacquired=structuredClone(original);reacquired.provenance=[{retrieved_at:'2026-10-20T11:00:00Z',sha256:'b'.repeat(64)}];reacquired.metadata.provenance=[{retrieved_at:'2026-10-20T11:00:00Z'}];
 for(const fn of [gapSemanticRow,gapSemanticContext]){
  assert.deepEqual(fn('canada','jobs',original),fn('canada','jobs',reacquired));
  assert.equal(Object.hasOwn(fn('canada','jobs',original),'provenance'),false);
  assert.equal(fn('canada','jobs',original).release_timestamp_raw,original.release_timestamp_raw);
  for(const edit of [v=>v.value+=.1,v=>v.release_timestamp_raw='2026-10-20T08:30',v=>v.quality='E — use with caution',v=>v.symbol='revised']){
   const revised=structuredClone(original);edit(revised);assert.notDeepEqual(fn('canada','jobs',original),fn('canada','jobs',revised));
  }
  assert.equal(fn('canada','unrelated',original),original);
 }
 assert.equal(original.provenance.length,1);assert.equal(original.metadata.provenance.length,1);
 const wraRow=gapCells('wales','land_transaction_tax',wra,acquisition)[0].row,revised={...wraRow,notes:wraRow.notes+'; publisher correction'};
 assert.notDeepEqual(gapSemanticRow('wales','land_transaction_tax',wraRow),gapSemanticRow('wales','land_transaction_tax',revised));
});
