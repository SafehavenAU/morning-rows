import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {CQC_PDF_CONTRACT} from '../lib/cqc-pdf.js';

test('England routes the fixed PDF once, timestamps its completion and preserves healthy grid on refusal',async t=>{
 const started='2026-10-20T13:00:00.000Z';
 t.mock.timers.enable({apis:['Date'],now:new Date(started)});
 t.mock.method(console,'warn',()=>{});
 const cache=new Map(),calls=[];
 globalThis.caches={default:{match:async request=>cache.get(request.url)?.clone(),put:async(request,response)=>cache.set(request.url,response.clone())}};
 t.after(()=>delete globalThis.caches);
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  url=String(url);calls.push(url);
  if(url===CQC_PDF_CONTRACT.source_url){
   assert.equal(options.redirect,'manual');assert.equal(options.headers.accept,'application/pdf');
   await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(1000);
   return new Response(null,{status:403});
  }
  assert.ok(!url.includes('stateofcare2425_ratingsdata.xlsx'),'The refused workbook is never requested');
  if(url.startsWith('https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices/'))return Response.json({data:[{settlementDate:'2026-10-20',settlementPeriod:12,systemBuyPrice:30}]});
  return new Response(null,{status:403});
 });
 const response=await worker.fetch(new Request('https://example.com/england.json')),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.care_assessment_cohort,null);
 assert.equal(body.sources.care_assessment_cohort.status,'error');
 assert.equal(body.sources.care_assessment_cohort.http_status,403);
 assert.equal(body.sources.care_assessment_cohort.fetched_at,'2026-10-20T13:00:01.000Z');
 assert.equal(body.grid.pounds_per_mwh,30);assert.equal(body.grid.geography,'Great Britain');
 assert.equal(body.sources.grid.status,'ok');assert.equal(body.sources.grid.fetched_at,started);
 assert.equal(calls.filter(url=>url===CQC_PDF_CONTRACT.source_url).length,1);
 const selected=await worker.fetch(new Request('https://example.com/england.json?source=care_assessment_cohort&measure=total'));
 assert.equal(selected.status,503);const failed=await selected.json();assert.equal(failed.data,null);assert.deepEqual(failed.observations,[]);
 assert.equal(calls.filter(url=>url===CQC_PDF_CONTRACT.source_url).length,1,'A selection reuses the complete-desk cache without a hidden retry');
});

test('CQC catalogue exposes exactly five fixed cohort definitions while preserving held workbook access history',async()=>{
 const catalogue=await(await worker.fetch(new Request('https://example.com/catalog.json?desk=england'))).json();
 const card=catalogue.sources.find(source=>source.key==='care_assessment_cohort');
 assert.equal(card.measure_count,5);assert.deepEqual(card.measures.map(m=>m.id),['inadequate','requires_improvement','good','outstanding','total']);
 assert.ok(card.measures.every(m=>m.geography==='England'&&m.unit==='ratings'));
 assert.match(card.limits,/unlikely to represent all adult social care services/);
 const schema=await(await worker.fetch(new Request('https://example.com/schema.json'))).json();
 assert.ok(schema.$defs.remainingCqcNative);assert.ok(schema.$defs.aemoDailyNative);assert.ok(schema.$defs.remainingNiNative);
 const keys=await(await worker.fetch(new Request('https://example.com/keys.json'))).json();
 const history=keys.blocked.find(row=>row.source==='CQC State of Care assessment cohort workbook');
 assert.equal(history.status,403);assert.match(history.note,/workbook route remains disconnected/);assert.match(history.note,/separate official GOV.UK PDF/);
});
