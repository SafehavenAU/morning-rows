import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';

const json=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url)));
const evidence='verification/gap-pass-2026-10-20/';
const boc={window:json(evidence+'boc/original/window.json'),latest:json(evidence+'boc/original/latest.json')};
const products={14100287:'jobs',18100004:'price_index',20100056:'shop',34100136:'homes',36100104:'product'};
const roles={getDataFromCubePidCoordAndLatestNPeriods:'wds-selected.json',getSeriesInfoFromCubePidCoord:'series-metadata.json',getCubeMetadata:'cube-metadata.json'};
const headlines=Object.fromEntries(Object.values(products).map(source=>[source,Object.fromEntries(Object.values(roles).map(file=>[file,json(source==='product'?`verification/statcan-gdp-2026-10-20/original/${file}`:evidence+`statcan/${source}/original/${file}`)]))]));
const latestExchange={observations:[{d:'2026-10-19',FXUSDCAD:{v:'1.4097'},FXAUDCAD:{v:'0.9100'},FXGBPCAD:{v:'1.8767'},FXNZDCAD:{v:'0.8100'}}]};
const snapshot=json('verification/structure-2026-10-17/selected-snapshot.json');
function setup(t,{at='2026-10-20T10:00:00Z',invalidJobs=false,failBoc=false,delay}={}) {
 t.mock.timers.enable({apis:['Date'],now:new Date(at)});t.mock.method(console,'warn',()=>{});
 const values=new Map(),calls=[];
 globalThis.caches={default:{match:async req=>values.get(req.url)?.clone(),put:async(req,response)=>values.set(req.url,response.clone())}};
 t.after(()=>delete globalThis.caches);
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  url=String(url);calls.push({url,body:options.body});
  if(delay)await delay(url);
  if(url.includes('PRICE_AND_DEMAND_'))throw Error('Held AEMO daily source must not be requested');
  if(url.includes('ELEC_NEM_SUMMARY'))return Response.json({ELEC_NEM_SUMMARY:['NSW1','QLD1','VIC1','SA1','TAS1'].map(REGIONID=>({REGIONID,PRICE:42,TOTALDEMAND:100,PRICE_STATUS:'FIRM',SETTLEMENTDATE:'2026-10-20T20:00:00'}))});
  if(url.includes('/valet/observations/FXUSDCAD,FXAUDCAD,'))return Response.json(latestExchange);
  if(url.includes('/valet/observations/FXUSDCAD,FXGBPCAD/'))return failBoc?new Response('Unavailable',{status:503}):Response.json(boc[url.endsWith('recent=1')?'latest':'window']);
  if(url.includes('/t1/wds/rest/')){
   const product=JSON.parse(options.body)[0].productId,source=products[product],filename=roles[url.split('/').at(-1)];
   assert.ok(source&&filename,'Only reviewed WDS products and endpoints');
   const body=structuredClone(headlines[source][filename]);
   if(invalidJobs&&source==='jobs'&&filename==='wds-selected.json')body[0].object.coordinate='wrong';
   return Response.json(body);
  }
  return new Response('Unrelated fixture source unavailable',{status:403});
 });
 return {calls,values};
}
const request=path=>worker.fetch(new Request('https://example.com'+path));
const maxAge=response=>Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]);

test('Canada handler preserves four latest pairs and legacy fields while validating dated FX and all four headlines',async t=>{
 const h=setup(t);const response=await request('/canada.json');const value=await response.json();
 assert.equal(response.status,200);assert.equal(value.exchange.rows.length,4);assert.deepEqual(value.exchange.rows.map(r=>r.series_id),['FXUSDCAD','FXAUDCAD','FXGBPCAD','FXNZDCAD']);
 assert.equal(value.exchange_history.rows.length,38);assert.equal(value.exchange_history.latest_anchor.length,2);assert.equal(value.sources.exchange_history.status,'ok');
 assert.deepEqual(value.jobs.map(r=>[r.name,r.rate]),[['Canada',6.5],['Newfoundland and Labrador',9.1],['Prince Edward Island',7.3],['Nova Scotia',6.3],['New Brunswick',7.4],['Quebec',6],['Ontario',7],['Manitoba',5],['Saskatchewan',5.4],['Alberta',6.4],['British Columbia',6.4]]);
 assert.equal(value.price_index.index,170);assert.equal(value.shop.thousand_dollars,73696547);assert.equal(value.homes.starts,57947);assert.equal(value.product.level,2524127);
 for(const source of ['jobs','price_index','shop','homes','product'])assert.equal(value.sources[source].status,'ok');
 assert.equal(h.calls.filter(c=>c.url.includes('/t1/wds/rest/')).length,15);assert.equal(h.calls.filter(c=>c.url.includes('/valet/observations/FXUSDCAD,FXGBPCAD/')).length,2);
 assert.equal(response.headers.get('x-mr-calendar-boundary'),null);assert.equal(response.headers.get('x-mr-cache-expires-at'),null);
});

test('wrong jobs identity and dated-FX failure leave legacy FX, GDP and other headline sources intact',async t=>{
 setup(t,{invalidJobs:true,failBoc:true});const value=await(await request('/canada.json')).json();
 assert.equal(value.jobs,null);assert.equal(value.sources.jobs.status,'error');assert.equal(value.exchange_history,null);assert.equal(value.sources.exchange_history.status,'error');
 assert.equal(value.exchange.rows.length,4);assert.equal(value.product.level,2524127);assert.equal(value.price_index.index,170);assert.equal(value.shop.thousand_dollars,73696547);assert.equal(value.homes.starts,57947);
});

test('Australia keeps its five-region snapshot without requesting or advertising the held daily feed',async t=>{
 const h=setup(t,{at:'2026-10-20T13:59:58Z'});const response=await request('/morning.json'),value=await response.json();
 assert.equal(value.grid.length,5);assert.equal(value.sources.grid.status,'ok');assert.equal(value.grid_day,undefined);assert.equal(value.sources.grid_day,undefined);
 assert.equal(h.calls.some(c=>c.url.includes('PRICE_AND_DEMAND_')),false);assert.equal(maxAge(response),30);
 const stored=[...h.values.values()][0];assert.equal(stored.headers.get('x-mr-calendar-boundary'),null);
 const count=h.calls.length;assert.equal((await request('/australia.json?source=grid_day')).status,404);assert.equal(h.calls.length,count);
 const catalogue=await(await request('/catalog.json?desk=australia')).json();assert.ok(!JSON.stringify(catalogue).includes('grid_day'));
 assert.doesNotMatch(catalogue.limits,/AEMO|AEST|daily electricity summaries/i);
 assert.ok(catalogue.sources.some(source=>source.key==='grid'),'The five-region snapshot remains discoverable');
 const schema=await(await request('/schema.json')).json(),usage=schema['x-usage'];
 for(const key of ['revisits','daily_windows'])assert.doesNotMatch(usage[key],/AEMO|AEST|daily electricity summaries/i,`No held daily-electricity claim in ${key}`);
 assert.match(usage.daily_windows,/31-calendar-day request window/);assert.match(usage.daily_windows,/UTC midnight/);
 assert.match(usage.daily_windows,/Absent FX dates are not inferred holidays or carried forward/);
 const llms=await(await request('/llms.txt')).text();assert.ok(!llms.includes('Australia adds SA1/VIC1'));
 const keys=await(await request('/keys.json')).json();assert.ok(keys.blocked.some(r=>r.source==='AEMO completed-day SA1/VIC1 monthly price CSV'&&r.status===406));
});

test('Canada fresh responses and selected-cache responses expire at UTC midnight',async t=>{
 const h=setup(t,{at:'2026-10-20T23:59:58Z'});let response=await request('/canada.json'),value=await response.json();assert.equal(value.exchange_history.window.end,'2026-10-20');assert.equal(maxAge(response),2);
 const [key,stored]=[...h.values.entries()][0];assert.equal(stored.headers.get('x-mr-calendar-boundary'),String(Date.parse('2026-10-21T00:00:00Z')));
 const count=h.calls.length;t.mock.timers.tick(1000);response=await request('/canada.json?source=exchange&measure=FXUSDCAD');assert.equal(response.status,200);assert.equal(maxAge(response),1);assert.equal(h.calls.length,count);
 const extended=stored.clone();extended.headers.set('cache-control','public, max-age=14400');extended.headers.set('x-mr-cache-expires-at',String(Date.parse('2026-10-21T04:00:00Z')));h.values.set(key,extended);
 t.mock.timers.tick(1000);response=await request('/canada.json');value=await response.json();assert.ok(h.calls.length>count);assert.equal(value.exchange_history.window.end,'2026-10-21');
});

test('calendar cache without its explicit boundary is a miss',async t=>{
 const h=setup(t,{at:'2026-10-20T23:59:58Z'});
 globalThis.caches.default.match=async()=>Response.json(snapshot.canada,{headers:{'x-mr-cache-expires-at':String(Date.now()+60000)}});
 const response=await request('/canada.json');const value=await response.json();assert.ok(h.calls.length>0);assert.equal(value.exchange_history.rows.length,38);
});

test('a complete desk crossing its calendar boundary refuses the old daily source and is not cached',async t=>{
 for(const [path,at,trigger,field] of [['/canada.json','2026-10-20T23:59:59Z','api.worldbank.org','exchange_history']])await t.test(path,async child=>{
  let shifted=false;const h=setup(child,{at,delay:async url=>{if(url.includes(trigger)&&!shifted){await new Promise(resolve=>setImmediate(resolve));shifted=true;child.mock.timers.tick(1000);}}});
  const response=await request(path),value=await response.json();assert.equal(shifted,true);assert.equal(value[field],null);assert.equal(value.sources[field].status,'error');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(h.values.size,0);
  assert.equal(path.includes('canada')?value.exchange.rows.length:value.grid.length,path.includes('canada')?4:5);
 });
});
