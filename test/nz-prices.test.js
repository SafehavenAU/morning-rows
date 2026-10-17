import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRICE_DIRECTORY, PRICE_NODES, priceRelease, tradingDay, nzPrices, readNzPrices } from '../lib/nz-prices.js';
import { parseCsv } from '../lib/stats-nz.js';
import worker from '../worker.js';
const now=new Date('2026-10-17T08:00:00Z');
const fixture=name=>readFileSync(new URL(`../verification/nz-prices-2026-10-17/${name}`,import.meta.url),'utf8');
const csv=fixture('source-selected.csv');
const directory=(files=['20261016_FinalEnergyPrices_I.csv'])=>`<html><h1>Final and interim energy prices</h1>${files.map(f=>`<a href="${PRICE_DIRECTORY}/${f}">${f}</a>`).join('')}</html>`;
const release=()=>priceRelease(directory(),now);

test('all five prices agree with separately presented official report, including interim status',()=>{
 const actual=nzPrices(csv,release()),[header,...reported]=parseCsv(fixture('report-selected.csv'));
 assert.deepEqual(header,['Point of connection','Trading date','Trading period','$/MWh','Price status']);
 assert.equal(actual.length,5);
 for(const row of actual){
  const r=reported.filter(r=>r[0]===row.code&&Number(r[2])===row.period);assert.equal(r.length,1);
  assert.equal(row.price,Number(r[0][3]));assert.equal(row.price_status,r[0][4].toLowerCase());
  assert.equal(row.date,'2026-10-16');assert.equal(row.period,48);assert.equal(row.unit,'NZD per megawatt hour');
  assert.equal(row.period_start,'2026-10-16T10:30:00.000Z');assert.equal(row.period_end,'2026-10-16T11:00:00.000Z');
  assert.equal(row.publication_lag_days,0);assert.ok(row.source_url.endsWith('_I.csv'));
 }
 // Compare all retained cells, not only the five terminal observations.
 for(const r of parseCsv(csv).slice(1))assert.equal(reported.find(p=>p[0]===r[2]&&p[2]===r[1])?.[3],r[3]);
});
test('rejects missing, suppressed and non-finite prices but preserves numeric zero and negative values',()=>{
 for(const marker of ['', ' ', '[x]', '..', 'null', 'NaN', 'Infinity','1e2','101.3801'])assert.throws(()=>nzPrices(csv.replace('101.38',marker),release()));
 assert.equal(nzPrices(csv.replace('101.38','0'),release())[0].price,0);
 assert.equal(nzPrices(csv.replace('101.38','-12.34'),release())[0].price,-12.34);
});
test('rejects incomplete nodes, missing final/interior periods, duplicate cells and wrong dates',()=>{
 for(const broken of [csv.split('\n').filter(l=>!l.includes('OTA2201')).join('\n'),csv.replace(/^2026-10-16,48,OTA2201.*\n/m,''),csv.replace(/^2026-10-16,7,OTA2201.*\n/m,''),csv+'2026-10-16,48,OTA2201,101.38\n',csv.replace('2026-10-16','2026-10-15'),csv.replace(',48,OTA2201',',49,OTA2201')])assert.throws(()=>nzPrices(broken,release()));
});
test('validates named columns and release identity, allowing quoted and reordered fields',()=>{
 const rows=parseCsv(csv);const order=[2,0,3,1];const reordered=rows.map(r=>order.map(i=>`"${r[i]}"`).join(',')).join('\n');
 assert.deepEqual(nzPrices(reordered,release()),nzPrices(csv,release()));
 for(const bad of [csv.replace('DollarsPerMegawattHour','CentsPerKilowattHour'),csv.replace('TradingPeriod','TradingDate'),csv.replace('101.38','101.38,extra')])assert.throws(()=>nzPrices(bad,release()));
 assert.throws(()=>nzPrices(csv,{...release(),price_status:'final'}));
});
test('latest listed completed day wins, final beats interim on that date, with visible publication lag',()=>{
 const files=['20261015_FinalEnergyPrices.csv','20261016_FinalEnergyPrices_I.csv','20261016_FinalEnergyPrices.csv','20261017_FinalEnergyPrices_I.csv'];
 const r=priceRelease(directory(files),now);assert.equal(r.date,'2026-10-16');assert.equal(r.price_status,'final');
 assert.equal(priceRelease(directory(files)+'<script>/* publisher footer */</script>',now).source_url,r.source_url);
 assert.equal(priceRelease(directory([...files].reverse()),now).source_url,r.source_url);
 assert.equal(priceRelease(directory(['20261015_FinalEnergyPrices.csv']),now).publication_lag_days,1);
 // 11:30 UTC is already 00:30 on 18 October in New Zealand.
 assert.equal(priceRelease(directory(files),new Date('2026-10-17T11:30:00Z')).date,'2026-10-17');
 for(const bad of [directory([]),directory(['20261018_FinalEnergyPrices.csv']),directory(['20260230_FinalEnergyPrices.csv']),directory().replace('</html>',''),directory().replaceAll('www.emi.ea.govt.nz','example.com')])assert.throws(()=>priceRelease(bad,now));
});
test('NZ daylight saving yields 46 or 50 sequential periods without assuming UTC dates',()=>{
 for(const [date,periods,end] of [['2026-09-27',46,'2026-09-27T11:00:00.000Z'],['2026-04-05',50,'2026-04-05T12:00:00.000Z']]){
  assert.equal(tradingDay(date).periods,periods);assert.equal(tradingDay(date).period_end,end);
  const body='TradingDate,TradingPeriod,PointOfConnection,DollarsPerMegawattHour\n'+PRICE_NODES.flatMap(([code])=>Array.from({length:periods},(_,i)=>`${date},${i+1},${code},1.00`)).join('\n');
  const r={...release(),date,source_url:`${PRICE_DIRECTORY}/${date.replaceAll('-','')}_FinalEnergyPrices_I.csv`};
  assert.ok(nzPrices(body,r).every(x=>x.period===periods));
  assert.throws(()=>nzPrices(body+`\n${date},${periods+1},OTA2201,1.00`,r));
 }
});
test('a failed or invalid newest file never silently falls back to an older release',async t=>{
 let urls=[],mode='404';t.mock.method(globalThis,'fetch',async url=>{urls.push(url);return url===PRICE_DIRECTORY?new Response(directory(['20261016_FinalEnergyPrices_I.csv','20261015_FinalEnergyPrices.csv'])):new Response(mode==='404'?'not found':'bad csv',{status:mode==='404'?404:200});});
 await assert.rejects(readNzPrices(now));assert.equal(urls.length,2);assert.ok(urls[1].includes('20261016'));
 mode='invalid';urls=[];await assert.rejects(readNzPrices(now));assert.equal(urls.length,2);
});
test('oversized price bodies are rejected without publishing a partial file',async t=>{
 t.mock.method(globalThis,'fetch',async url=>new Response(url===PRICE_DIRECTORY?directory():csv+' '.repeat(1048576)));
 await assert.rejects(readNzPrices(now),/bounded/);
});
test('price failure preserves other successful NZ desk sources',async t=>{
 t.mock.method(globalThis,'fetch',async url=>String(url).includes('api.geonet.org.nz/quake?')?Response.json({features:[]}):new Response('unavailable',{status:503}));
 const response=await worker.fetch(new Request('https://example.com/new-zealand.json'),{});const desk=await response.json();
 assert.equal(desk.sources.prices.status,'error');assert.deepEqual(desk.prices,[]);assert.equal(desk.sources.quakes.status,'ok');assert.deepEqual(desk.quakes,[]);
});
