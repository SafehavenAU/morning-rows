import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogue, DESKS, digest, finishResponse, INFORMATION_SCHEMA, measuresFor, selectedResponse, validateSelection} from '../lib/information.js';
import {NZ_RENT_LOCATIONS, readNzMarketRent, validateNzRentRepresentation} from '../lib/nz-market-rent.js';

const evidence=new URL('../verification/nz-market-rent-2026-10-20/',import.meta.url);
const official=JSON.parse(readFileSync(new URL('independent-report.json',evidence),'utf8'));
const fragments=Object.fromEntries(Object.values(NZ_RENT_LOCATIONS).map(l=>[l.id,readFileSync(new URL(`original/${l.suburb.toLowerCase()}-ajax.html`,evidence),'utf8')]));
const fetchedAt='2026-10-20T10:00:00Z';
async function acquire(failed) {
  return readNzMarketRent({now:()=>fetchedAt,fetcher:async url=>{
    const location=Object.values(NZ_RENT_LOCATIONS).find(l=>l.source_url===url);
    assert.ok(location,'Only the two explicit publisher requests are permitted');
    if(failed?.includes(location.id)) throw new Error('Publisher timeout');
    return Response.json({Finder:'',Table:fragments[location.id]});
  }});
}
const native=await acquire();
function bodyFor(value=native) {
  const market_rent=structuredClone(value);
  return {country:'New Zealand',market_rent,sources:{market_rent:{status:market_rent.status,fetched_at:fetchedAt}}};
}
function selection(measure,observation) {
  const url=new URL('https://morningrows.com/new-zealand.json?source=market_rent');
  if(measure!==undefined)url.searchParams.set('measure',measure);
  if(observation!==undefined)url.searchParams.set('observation',observation);
  return validateSelection(url);
}
const select=(measure,observation,body=bodyFor())=>selectedResponse(body,selection(measure,observation));
const statKeys=['active_bonds','lower_quartile','median','upper_quartile'];
const measureId=(row,statistic)=>`${row.location_id}.${row.dwelling_key}.${row.bedroom_key}.${statistic}`;

test('rent catalogue is finite, city qualified and explicit about absent tuples and separate units',()=>{
  assert.equal(Object.keys(DESKS).length,8);
  for(const desk of Object.keys(DESKS)) {
    const card=catalogue(desk).sources.find(s=>s.key==='market_rent');
    if(desk!=='new-zealand'){assert.equal(card,undefined);continue;}
    assert.equal(card.measure_count,200);
    assert.equal(new Set(card.measures.map(m=>m.id)).size,200);
    assert.match(card.limits,/not the quartile denominator/);
    assert.match(card.locality_identifier_authority,/not a publisher geography code/);
    assert.match(card.selection,/not_reported/);
    for(const m of card.measures) {
      assert.equal(validateSelection(new URL(m.records)).measure,m.id);
      assert.equal(m.unit,m.dimensions.statistic==='active_bonds'?'bonds':'NZD per week');
      assert.equal(m.observation_selector,'YYYY-MM-DD/YYYY-MM-DD');
    }
  }
  const count=measuresFor('new-zealand','market_rent').find(d=>d.id.endsWith('active_bonds'));
  assert.match(count.population,/current bonds/);
  assert.match(count.definition,/not all lodged bonds/);
  assert.match(measuresFor('new-zealand','market_rent').find(d=>d.id.endsWith('median')).population,/bonds lodged/);
});

test('source reconciles every one of 116 independently extracted cells without inventing absent rows',async()=>{
  assert.equal(validateNzRentRepresentation(native),true);
  const result=await select();
  assert.equal(result.status,200);
  const {body}=result;
  assert.equal(body.data.length,29);assert.equal(body.observations.length,116);
  assert.equal(new Set(body.observations.map(o=>o.id)).size,116);
  assert.deepEqual(body.unavailable_measures,[]);
  assert.deepEqual(body.context.provenance,native.provenance);
  for(const locality of official.localities)for(const row of locality.rows)for(const statistic of statKeys) {
    const id=`${locality.id}.${row.dwelling_key}.${row.bedrooms}.${statistic}`;
    const observation=body.observations.find(o=>o.definition.id===id);
    assert.ok(observation,id);
    assert.equal(observation.value,row[statistic],id);
    assert.equal(observation.period,`${locality.period.start}/${locality.period.end}`);
    assert.equal(observation.definition.geography,locality.publisher_label);
    assert.deepEqual(observation.definition.dimensions,{location:locality.id,dwelling:row.dwelling_key,bedrooms:row.bedrooms,statistic});
    assert.equal(observation.definition.unit,statistic==='active_bonds'?'bonds':'NZD per week');
    assert.equal(observation.qualifications.bedrooms,row.bedroom_label);
    assert.equal(observation.value_state,'observed');
    assert.equal(observation.published_at,null);assert.equal(observation.publisher_updated_at,null);
    assert.deepEqual(observation.publisher_status,{revision_status:'provisional'});
    assert.equal(observation.source_url,NZ_RENT_LOCATIONS[locality.id].source_url);
    const {version,native_pointer,...versioned}=observation;
    assert.equal(version,await digest(versioned));
    for(const other of statKeys)assert.equal(Object.hasOwn(observation.qualifications,other),false,'Only selected statistic qualifies its own version');
  }
});

test('all reported measures and exact six-month windows are addressable; 5-plus retains five-or-more meaning',async()=>{
  for(const row of native.rows)for(const statistic of statKeys) {
    for(const period of [undefined,row.period]) {
      const result=await select(measureId(row,statistic),period);
      assert.equal(result.status,200);assert.equal(result.body.observations.length,1);
      assert.equal(result.body.data.statistic,statistic);
      assert.equal(result.body.data.value,row[statistic]);
      assert.equal(result.body.data.bedrooms,row.bedrooms);
      assert.equal(result.body.data.bedroom_key,row.bedroom_key);
      for(const other of statKeys)assert.equal(Object.hasOwn(result.body.data,other),false);
    }
  }
  const result=await select('nz-wellington-kelburn.house.5-plus.median');
  assert.equal(result.body.data.bedrooms,'5+ bedrooms');
  assert.equal(result.body.observations[0].definition.dimensions.bedrooms,'5-plus');
});

test('known absent, unsupported and unretained selections are distinct and never substituted',async()=>{
  const absent=await select('nz-auckland-avondale.apartment.4.median');
  assert.equal(absent.status,404);assert.equal(absent.body.error,'not_reported');assert.equal(absent.body.data,null);assert.deepEqual(absent.body.observations,[]);
  for(const period of ['2026-02-01/2026-07-31','2026-08','2026','2026-03-01','2026-3-1/2026-8-31']) {
    const result=await select('nz-auckland-avondale.apartment.2.median',period);
    assert.equal(result.status,404);assert.equal(result.body.error,'observation_not_retained');assert.equal(result.body.data,null);
  }
  for(const id of ['nz-wellington-avondale.apartment.2.median','nz-auckland-avondale.apartment.5.median','nz-auckland-avondale.apartment.2.mean','nz-auckland-avondale.unknown.2.median'])assert.equal(selection(id).code,'unknown_measure');
  for(const query of ['source=market_rent&city=Auckland','source=market_rent&geography=Avondale','source=market_rent&date=2026-08','source=market_rent&bedrooms=2','source=market_rent&source=market_rent','source=market_rent&observation=2026-08','measure=nz-auckland-avondale.apartment.2.median']) {
    assert.equal(validateSelection(new URL('https://morningrows.com/new-zealand.json?'+query)).status,400);
  }
});

test('one locality failure preserves successful cells with degraded health and isolates failed measures',async()=>{
  for(const failed of Object.keys(NZ_RENT_LOCATIONS)) {
    const partial=await acquire([failed]),body=bodyFor(partial);
    assert.equal(validateNzRentRepresentation(partial),true);
    const result=await select(undefined,undefined,body);
    assert.equal(result.status,200);assert.equal(result.body.retrieval.status,'degraded');
    assert.equal(result.body.observations.length,partial.rows.length*4);
    assert.ok(result.body.observations.every(o=>o.qualifications.location_id!==failed));
    assert.deepEqual(result.body.unavailable_measures,[]);
    const failedMeasure=await select(`${failed}.apartment.2.median`,undefined,body);
    assert.equal(failedMeasure.status,503);assert.equal(failedMeasure.body.error,'retrieval_failed');
    const row=partial.rows[0],healthy=await select(measureId(row,'median'),undefined,body);
    assert.equal(healthy.status,200);assert.equal(healthy.body.retrieval.status,'degraded');
    const original=(await select(measureId(row,'median'))).body.observations[0];
    assert.equal(healthy.body.observations[0].version,original.version);
  }
});

test('all failed or mismatched healthy windows yield no selected observations',async()=>{
  const failed=await select(undefined,undefined,bodyFor(await acquire(Object.keys(NZ_RENT_LOCATIONS))));
  assert.equal(failed.status,503);assert.equal(failed.body.data,null);assert.deepEqual(failed.body.observations,[]);
  const body=bodyFor(),n=body.market_rent;
  for(const row of n.rows.filter(r=>r.location_id==='nz-wellington-kelburn')) Object.assign(row,{period:'2026-04-01/2026-09-30',period_start:'2026-04-01',period_end:'2026-09-30'});
  Object.assign(n.locations[1],{period_start:'2026-04-01',period_end:'2026-09-30'});
  Object.assign(n.metadata,{period_start:null,period_end:null,window_consistent:false});
  n.status=body.sources.market_rent.status='degraded';
  const result=await select(undefined,undefined,body);
  assert.equal(result.status,503);assert.equal(result.body.error,'representation_validation_failed');
  assert.deepEqual(result.body.data,n);assert.deepEqual(result.body.observations,[]);
});

test('semantic corruption and unsupported missing markers fail closed while literal zero remains observed',async()=>{
  const mutations=[
    n=>n.rows[0].geography='New Zealand',
    n=>n.rows[0].city='Wellington',
    n=>n.rows[0].bedroom_key='5',
    n=>n.rows[0].bedrooms='Studio',
    n=>n.rows[0].source_url=NZ_RENT_LOCATIONS['nz-wellington-kelburn'].source_url,
    n=>n.rows[0].median=null,
    n=>n.rows[0].median='..',
    n=>n.rows[0].median='0',
    n=>n.rows[0].active_bonds=-1,
    n=>n.rows[0].upper_quartile=n.rows[0].median-1,
    n=>n.rows[0].period='2026-08',
    n=>n.rows.pop(),
    n=>n.rows.push({...n.rows[0]}),
    n=>n.definition.population='All current tenancies',
    n=>n.metadata.publication_time='2026-09-01',
    n=>n.locations[1].id=n.locations[0].id,
  ];
  for(const mutate of mutations) {
    const body=bodyFor();mutate(body.market_rent);
    const result=await select(undefined,undefined,body);
    assert.equal(result.status,503,mutate.toString());assert.deepEqual(result.body.observations,[]);
  }
  const body=bodyFor(),row=body.market_rent.rows[0];row.active_bonds=0;
  const zero=await select(measureId(row,'active_bonds'),row.period,body);
  assert.equal(zero.status,200);assert.equal(zero.body.data.value,0);assert.equal(zero.body.data.value_state,'observed');
});

test('source acquisition and row offsets do not revise observations; a single median revision changes one identity version',async()=>{
  const body=bodyFor(),before=(await select(undefined,undefined,body)).body;
  body.sources.market_rent.fetched_at='2026-10-20T11:00:00Z';
  body.market_rent.provenance.forEach(p=>{p.retrieved_at='2026-10-20T11:00:00Z';p.sha256='b'.repeat(64);p.bytes++;});
  const acquired=(await select(undefined,undefined,body)).body;
  assert.deepEqual(acquired.observations,before.observations);assert.equal(acquired.content_version,before.content_version);
  const changed=body.market_rent.rows.find(r=>r.dwelling_key==='apartment'&&r.bedroom_key==='2'&&r.location_id==='nz-auckland-avondale');
  changed.median++;
  const after=(await select(undefined,undefined,body)).body;
  assert.deepEqual(after.observations.map(o=>o.id),before.observations.map(o=>o.id));
  assert.deepEqual(after.observations.filter((o,i)=>o.version!==before.observations[i].version).map(o=>o.definition.id),[measureId(changed,'median')]);
  body.market_rent.rows.reverse();
  const reordered=(await select(undefined,undefined,body)).body;
  let moved=0;
  for(const observation of reordered.observations) {
    const previous=after.observations.find(o=>o.id===observation.id);
    assert.equal(observation.version,previous.version);
    if(observation.native_pointer!==previous.native_pointer)moved++;
  }
  assert.equal(moved,112,'All but the middle wide row changed offsets');
});

test('new six-month window changes identities without mislabelling it as a same-period revision',async()=>{
  const body=bodyFor(),before=(await select()).body;
  const window={period_start:'2026-04-01',period_end:'2026-09-30'};
  Object.assign(body.market_rent.metadata,window);
  for(const row of body.market_rent.rows) Object.assign(row,window,{period:'2026-04-01/2026-09-30'});
  for(const location of body.market_rent.locations)Object.assign(location,window);
  const after=await select(undefined,undefined,body);
  assert.equal(after.status,200);
  assert.ok(after.body.observations.every(o=>!before.observations.some(old=>old.id===o.id)));
});

test('rent failure cannot hide an unrelated successful Stats NZ selection',async()=>{
  const historical=JSON.parse(readFileSync(new URL('../verification/structure-2026-10-17/selected-snapshot.json',import.meta.url),'utf8'))['new-zealand'];
  const withFailure={...historical,...bodyFor(await acquire(Object.keys(NZ_RENT_LOCATIONS))),sources:{...historical.sources,market_rent:{status:'error',error:'publisher timeout',fetched_at:fetchedAt}}};
  const stats=validateSelection(new URL('https://morningrows.com/new-zealand.json?source=stats'));
  assert.deepEqual(await selectedResponse(withFailure,stats),await selectedResponse(historical,stats));
});

test('conditional GET and HEAD isolate selected identities and never turn missing or failed selections into 304',async()=>{
  const result=await select('nz-auckland-avondale.apartment.2.median');
  const url=result.body.id;
  const first=await finishResponse(new Request(url),Response.json(result.body),url);
  assert.equal((await finishResponse(new Request(url,{headers:{'If-None-Match':first.headers.get('etag')}}),Response.json(result.body),url)).status,304);
  const head=await finishResponse(new Request(url,{method:'HEAD'}),Response.json(result.body),url);
  assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),first.headers.get('etag'));
  const other=await select('nz-wellington-kelburn.apartment.2.median');
  assert.equal((await finishResponse(new Request(other.body.id,{headers:{'If-None-Match':first.headers.get('etag')}}),Response.json(other.body),other.body.id)).status,200);
  for(const failed of [await select('nz-auckland-avondale.apartment.4.median'),await select(undefined,undefined,bodyFor(await acquire(Object.keys(NZ_RENT_LOCATIONS))))]) {
    assert.equal((await finishResponse(new Request(failed.body.id,{headers:{'If-None-Match':'*'}}),Response.json(failed.body,{status:failed.status}),failed.body.id)).status,failed.status);
  }
});

test('published schema contains strict rent definitions and bounded native, cell and observation representations',()=>{
  const defs=INFORMATION_SCHEMA.$defs;
  assert.equal(defs.marketRentDefinition.oneOf.length,200);
  assert.equal(defs.marketRentDefinition.additionalProperties,false);
  assert.equal(defs.marketRentNative.properties.metadata.properties.location_count.const,2);
  assert.equal(defs.marketRentNative.properties.licence.const,'Creative Commons Attribution 3.0 New Zealand');
  assert.equal(defs.marketRentCell.properties.value_state.const,'observed');
  assert.equal(defs.marketRentWideRow.properties.active_bonds.type,'integer');
  assert.equal(defs.marketRentNative.properties.rows.maxItems,50);
  assert.equal(defs.selected.allOf.length,5,'Existing claimant national contracts remain intact');
  assert.ok(Buffer.byteLength(JSON.stringify(INFORMATION_SCHEMA))<1_000_000);
  assert.ok(Buffer.byteLength(JSON.stringify(catalogue('new-zealand')))<1_000_000);
});
