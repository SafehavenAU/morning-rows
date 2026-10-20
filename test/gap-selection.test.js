import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBocHistory,bocHistoryWindow} from '../lib/boc-history.js';
import {parseStatcanHeadline} from '../lib/statcan-headlines.js';
import {walesTax} from '../lib/fiscal-observations.js';
import {selectedResponse,validateSelection,measuresFor} from '../lib/information.js';
const root=new URL('../verification/gap-pass-2026-10-20/',import.meta.url);
const text=path=>readFileSync(new URL(path,root),'utf8');
const json=path=>JSON.parse(text(path));
const now='2026-10-20T09:20:00.000Z';
const boc=(clock=now)=>parseBocHistory(json('boc/original/window.json'),json('boc/original/latest.json'),bocHistoryWindow(clock));
const statcan=source=>parseStatcanHeadline(source,...['wds-selected.json','series-metadata.json','cube-metadata.json'].map(f=>json(`statcan/${source}/original/${f}`)));
async function select(desk,key,native,measure,observation,{clock=now,status=native?.status||'ok'}={}){
 const url=new URL(`https://morningrows.com/${desk}.json`);
 for(const [selector,value] of Object.entries({source:key,measure,observation}))if(value!==undefined)url.searchParams.set(selector,value);
 const selection=validateSelection(url);
 if(selection.status)return {status:selection.status,body:{error:selection.code}};
 const body={[key]:native,sources:{[key]:{status,fetched_at:clock}}};
 return selectedResponse(body,selection,{now:clock});
}
test('AEMO selection refuses incomplete unvalidated native data',async()=>{
 assert.equal((await select('australia','grid_day',{})).status,503);
 assert.equal((await select('australia','grid_day',{},'SA1.mean','2026-10-19')).status,503);
});
test('FX selectors distinguish a missing publication date, an unretained date and a failed source',async()=>{
 const native=boc(),all=await select('canada','exchange_history',native);
 assert.equal(all.status,200);assert.equal(all.body.observations.length,38);
 const series=await select('canada','exchange_history',native,'FXUSDCAD');
 assert.equal(series.body.data.length,19);assert.equal(series.body.observations.length,19);
 const one=await select('canada','exchange_history',native,'FXUSDCAD','2026-10-19');
 assert.equal(one.body.observations[0].value,1.4097);assert.equal(one.body.data.period,'2026-10-19');
 assert.equal((await select('canada','exchange_history',native,'FXUSDCAD','2026-10-12')).body.error,'not_published_on_date');
 assert.equal((await select('canada','exchange_history',native,'FXUSDCAD','2020-01-01')).body.error,'observation_not_retained');
 assert.equal((await select('canada','exchange_history',native,'FXUSDCAD','2026-10-12',{status:'error'})).status,503);
 const truncated=structuredClone(native);truncated.rows.splice(-2);truncated.metadata.date_count--;truncated.metadata.observation_count-=2;truncated.metadata.latest_period=truncated.rows.at(-1).period;
 assert.equal((await select('canada','exchange_history',truncated)).status,503);
});
test('rolling FX bounds and acquisition clocks do not revise unchanged individual observations',async()=>{
 const a=await select('canada','exchange_history',boc(),'FXUSDCAD','2026-10-19');
 const clock='2026-10-21T00:00:01.000Z',b=await select('canada','exchange_history',boc(clock),'FXUSDCAD','2026-10-19',{clock});
 assert.equal(b.status,200);
 assert.equal(a.body.observations[0].version,b.body.observations[0].version);
 assert.notEqual(a.body.content_version,b.body.content_version);
});
test('StatCan exact geography identities and quarterly housing remain qualified in selections',async()=>{
 const jobs=statcan('jobs'),selected=await select('canada','jobs',jobs,'newfoundland_and_labrador','2026-09');
 assert.equal(selected.status,200);assert.equal(selected.body.observations[0].value,9.1);
 assert.equal(selected.body.observations[0].definition.geography,'Newfoundland and Labrador');
 assert.equal((await select('canada','jobs',jobs)).body.observations.length,11);
 const homes=await select('canada','homes',statcan('homes'),'starts','2026-Q3');
 assert.equal(homes.status,200);assert.equal(homes.body.observations[0].value,57947);
 assert.match(homes.body.observations[0].definition.population,/10,000/);
 assert.match(homes.body.observations[0].qualifications.licence_notice.source_notice,/CMHC/);
 assert.equal((await select('canada','homes',statcan('homes'),'starts','2026-07')).status,404);
 const drift=structuredClone(jobs);drift[1].geography='Alberta';
 assert.equal((await select('canada','jobs',drift)).status,503);
});
test('WRA exact selection keeps four overlapping identities and refuses altered meaning',async()=>{
 const native=walesTax(text('wra/original/wra-data.csv'),new Date(now));
 const all=await select('wales','land_transaction_tax',native);
 assert.equal(all.status,200);assert.equal(all.body.observations.length,4);
 const one=await select('wales','land_transaction_tax',native,'all_inclusive','2025-26');
 assert.equal(one.body.observations[0].value,371);
 assert.match(one.body.observations[0].definition.limitations,/overlap/);
 assert.equal((await select('wales','land_transaction_tax',native,'all_inclusive','2024-25')).status,404);
 native.rows[0].unit='GBP receipts';
 assert.equal((await select('wales','land_transaction_tax',native)).status,503);
  native.rows[0]=null;
  assert.equal((await select('wales','land_transaction_tax',native)).status,503);
});
test('Stats NZ metadata retains exact selected codes while exposing household and fiscal boundaries',()=>{
 const defs=measuresFor('new-zealand','stats'),income=defs.find(d=>d.id==='INC_INC_011');
 assert.match(income.population,/18–64/);assert.match(income.period_convention,/June-quarter/);
 assert.equal(income.unit,'NZD per week');assert.equal(income.adjustment,null);
 const paid=defs.find(d=>d.id==='INC_INC_001');
 assert.match(paid.name,/paid employment/);assert.match(paid.population,/self-employment/);
 assert.match(paid.population,/15 years and over/);assert.match(paid.period_convention,/June-quarter/);
 assert.match(paid.limitations,/wages-and-salaries-only/);assert.match(paid.limitations,/52/);
 for(const id of ['CORR_FIS_005','JUS_FIS_001']){
  const d=defs.find(d=>d.id===id);assert.match(d.period_convention,/Fiscal year/);assert.match(d.publication_status,/discontinued/);
 }
 assert.match(defs.find(d=>d.id==='PRD_PRD_001').index_reference,/1996 = 1000/);
});
