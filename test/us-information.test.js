import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';
import {parseCpi,CPI_SERIES} from '../lib/us-cpi.js';
import {catalogue,DESKS} from '../lib/information.js';
import {catalogueV2,selectedUsResponse,US_MEASURE_URL,US_DESK_URL} from '../lib/information-v2.js';
import {handleUsRequest} from '../lib/us-desk.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/us-cpi.json',import.meta.url))).files;
const native=()=>({site:'https://morningrows.com',country:'United States',cpi:parseCpi(fixture),sources:{cpi:{status:'ok',fetched_at:'2026-10-17T12:00:00Z'}}});
const get=(path,options={})=>handleUsRequest(new Request('https://morningrows.com'+path),{read:async()=>native(),cache:null,...options});

test('v1 preserves eight directories; v2 adds one explicit resource version without upgrading old desks',async()=>{
 assert.equal(catalogue().countries.length,8);const c=catalogueV2();assert.equal(c.countries.length,9);assert.equal(new Set(c.countries.map(r=>r.id)).size,9);
 for(const [i,legacy] of catalogue().countries.entries()){const{resource_schema,resource_schema_version,...entry}=c.countries[i];assert.deepEqual(entry,legacy);assert.equal(resource_schema_version,'1.0');assert.match(resource_schema,/\/schema.json$/);}
 assert.equal((await worker.fetch(new Request('https://morningrows.com/catalog.json?desk=united-states'))).status,404);
 const current=await worker.fetch(new Request('https://morningrows.com/catalog.v2.json'));assert.equal((await current.json()).countries.length,9);
 const legacy=await worker.fetch(new Request('https://morningrows.com/catalog.json'));assert.match(legacy.headers.get('link'),/successor-version/);assert.equal((await legacy.json()).schema_version,'1.0');
});
test('source/measure/exact observation retain different cardinality and complete qualifications',async()=>{
 const source=await get('/united-states.json?source=cpi');assert.equal(source.status,200);assert.equal((await source.json()).data.rows.length,13);
 const measure=await get('/united-states.json?source=cpi&measure='+CPI_SERIES),m=await measure.json();assert.equal(m.data.length,13);assert.equal(m.observations.length,13);assert.match(measure.headers.get('link'),/schema.v2.json/);
 const month=await get('/united-states.json?source=cpi&measure='+CPI_SERIES+'&observation=2025-10'),o=await month.json();assert.equal(month.status,200);assert.equal(o.observations.length,1);assert.equal(o.data.value,null);assert.equal(o.observations[0].value_state,'unavailable');assert.match(o.observations[0].definition.adjustment,/not seasonally/);assert.match(o.observations[0].source_url,/download.bls.gov/);assert.ok(o.observations[0].version);
});
test('unsupported geography, units, period convention, series and unretained history refuse before substitution',async()=>{
 for(const query of ['geography=California','unit=USD','source=cpi&source=cpi','source=','measure='+CPI_SERIES,'observation=2026-09'])assert.equal((await get('/united-states.json?'+query)).status,400);
 for(const query of ['source=unemployment','source=cpi&measure=CUSR0000SA0','source=cpi&measure='+CPI_SERIES+'&observation=2025-08','source=cpi&measure='+CPI_SERIES+'&observation=2026','source=cpi&measure='+CPI_SERIES+'&observation=2026-Q3'])assert.equal((await get('/united-states.json?'+query)).status,404);
 assert.equal((await get('/catalog.v2.json?desk=canada')).status,404);assert.equal((await get('/united-states?source=cpi')).status,400);
});
test('canonical selectors ignore query ordering and never resolve US as Australia',async()=>{
 const r=await get('/united-states.json?observation=2026-09&measure='+CPI_SERIES+'&source=cpi');assert.equal(r.headers.get('content-location'),US_MEASURE_URL+'&observation=2026-09');
 const full=await get('/united-states.json');assert.equal((await full.json()).country,'United States');assert.equal(full.headers.get('content-location'),US_DESK_URL);
});
test('new retrieval time is unchanged; real value/status correction changes only that observation',async()=>{
 const body=native(),a=(await selectedUsResponse(body,{source:'cpi',measure:CPI_SERIES})).body;
 body.sources.cpi.fetched_at='2026-10-18T12:00:00Z';const b=(await selectedUsResponse(body,{source:'cpi',measure:CPI_SERIES})).body;assert.equal(a.content_version,b.content_version);
 body.cpi.rows.at(-1).value=336.941;body.cpi.rows.at(-1).value_text='336.941';body.cpi.rows.at(-1).footnotes=[{code:'R',text:'Revised'}];const c=(await selectedUsResponse(body,{source:'cpi',measure:CPI_SERIES})).body;assert.deepEqual(c.observations.filter((r,i)=>r.version!==a.observations[i].version).map(r=>r.period),['2026-09']);
});
test('malformed semantic cache data is not published as a selected measure',async()=>{
 for(const mutate of [b=>b.cpi.definition.geography='California',b=>b.cpi.definition.unit='percent',b=>b.cpi.rows[1].value=0,b=>b.cpi.rows.pop(),b=>b.cpi.rows[0].period='2025',b=>b.cpi.rows[1].value_state='suppressed']){const b=native();mutate(b);assert.equal((await selectedUsResponse(b,{source:'cpi',measure:CPI_SERIES})).status,503);}
});
test('US outage preserves another successful desk and full US remains explicit about failure',async t=>{
 const canada=JSON.parse(readFileSync(new URL('../verification/structure-2026-10-17/selected-snapshot.json',import.meta.url))).canada;
 globalThis.caches={default:{match:async req=>new URL(req.url).pathname==='/canada.json'?Response.json(canada,{headers:{'x-mr-cache-expires-at':String(Date.now()+60000)}}):undefined,put:async()=>{}}};t.after(()=>{delete globalThis.caches;});t.mock.method(globalThis,'fetch',async()=>new Response('blocked',{status:403}));t.mock.method(console,'warn',()=>{});
 const us=await worker.fetch(new Request(US_MEASURE_URL));assert.equal(us.status,503);const ca=await worker.fetch(new Request('https://morningrows.com/canada.json?source=exchange&measure=FXUSDCAD'));assert.equal(ca.status,200);assert.equal((await ca.json()).observations[0].value,1.4154);
 const full=await worker.fetch(new Request(US_DESK_URL));assert.equal(full.status,200);const b=await full.json();assert.equal(b.cpi,null);assert.equal(b.sources.cpi.status,'error');
});
test('current discovery, human view, schema and sitemap point to the same bounded US offering',async()=>{
 for(const path of ['/llms.txt','/.well-known/ai-catalog.json','/sitemap.xml','/']){const r=await worker.fetch(new Request('https://morningrows.com'+path));const text=await r.text();assert.match(text,/united-states/);assert.match(text,/catalog.v2.json/);}
 const page=await get('/united-states');assert.match(await page.text(),/2025-10.*unavailable/);const schema=await get('/schema.v2.json');assert.match((await schema.json()).$id,/schema.v2.json/);
 for(const desk of Object.keys(DESKS))assert.ok(catalogue(desk).sources.length);
});
test('JSON response fast path preserves standard ETags, HEAD and failure semantics',async()=>{
 const {finishV2Response}=await import('../lib/information-v2.js');
 const body={retrieved_at:'2026-10-18T00:00:00Z',data:{b:2,a:1},observations:[{value:null,value_state:'unavailable'}]};
 const url='https://morningrows.com/united-states.json';
 const baseline=await finishV2Response(new Request(url),Response.json(body),url);
 for(const status of [200,503])for(const method of ['GET','HEAD'])for(const match of [null,baseline.headers.get('etag'),'*']){
  const req=new Request(url,{method,headers:match?{'If-None-Match':match}:{}});
  const a=await finishV2Response(req,Response.json(body,{status}),url,'2026-10-18T00:00:00Z');
  const b=await finishV2Response(req,Response.json(body,{status}),url,'2026-10-18T00:00:00Z',body);
  assert.equal(b.status,a.status);assert.deepEqual([...b.headers],[...a.headers]);assert.equal(await b.text(),await a.text());
 }
});
test('optimized v2 fingerprints retain the established hash format and semantic changes',async()=>{
 const {usDigest}=await import('../lib/us-fingerprint.js');
 const {digest}=await import('../lib/information.js');
 const {CPI_DEFINITION}=await import('../lib/us-cpi.js');
 const row={period:'2026-09',value:336.94,value_text:'336.940',value_state:'observed',definition:CPI_DEFINITION,footnotes:[],retrieved_at:'2026-10-18T00:00:00Z'};
 for(const value of [row,{rows:[row,{...row,value:null,value_text:'-',value_state:'unavailable',footnotes:[{code:'X',text:'Data unavailable due to the 2025 lapse in appropriations'}]}]},JSON.parse('{"__proto__":{"b":2,"a":1},"constructor":0,"unicode":"£é","2":2,"1":1}'),null,[]])assert.equal(await usDigest(value),await digest(value));
 assert.equal(await usDigest({...row,retrieved_at:'2026-10-19T00:00:00Z'}),await usDigest(row));
 assert.notEqual(await usDigest({...row,value:336.941,value_text:'336.941'}),await usDigest(row));
});

test('composed selected fingerprints bind every payload while preserving observation hashes',async()=>{
 const {digest}=await import('../lib/information.js');
 const base=native(),selection={source:'cpi',measure:CPI_SERIES};
 const original=await selectedUsResponse(base,selection);
 const check=async body=>{
  const r=await selectedUsResponse(body,selection);assert.equal(r.status,200);
  for(const {version,...record} of r.body.observations)assert.equal(version,await digest(record));
  const expected={data:r.body.data,context:r.body.context,retrieval:r.body.retrieval,observations:r.body.observations.map(o=>({id:o.id,version:o.version}))};
  assert.equal(r.body.content_version,await digest(expected));
  const copy={...r.body};for(const k of ['data','context','retrieval','observations'])delete copy[k];
  assert.deepEqual(r.etagMaterial,copy);
  return r;
 };
 await check(base);
 for(const mutate of [b=>{b.cpi.rows[0].value+=.001;b.cpi.rows[0].value_text=b.cpi.rows[0].value.toFixed(3);},b=>{Object.assign(b.cpi.rows[0],{value:null,value_text:'-',value_state:'missing'});},b=>{b.cpi.rows[0].footnotes=[{code:'R',text:'Revised'}];},b=>{b.cpi.provenance=[{url:'https://www.bls.gov/example',sha256:'new-original-response'}];},b=>{b.cpi.timing_note='Publisher timing is unverified; new qualification';}]){
  const changed=structuredClone(base);mutate(changed);const r=await check(changed);
  assert.notEqual(r.body.content_version,original.body.content_version);
  assert.notEqual(await digest(r.etagMaterial),await digest(original.etagMaterial));
  const before=await get('/united-states.json?source=cpi&measure='+CPI_SERIES);
  const after=await handleUsRequest(new Request(US_MEASURE_URL,{headers:{'If-None-Match':before.headers.get('etag')}}),{cache:null,read:async()=>changed});
  assert.equal(after.status,200);assert.notEqual(after.headers.get('etag'),before.headers.get('etag'));
 }
 const later=structuredClone(base);later.sources.cpi.fetched_at='2026-10-19T00:00:00Z';
 const unchanged=await check(later);assert.deepEqual(unchanged.etagMaterial,original.etagMaterial);
});
