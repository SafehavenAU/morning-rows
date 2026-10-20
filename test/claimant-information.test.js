import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INVENTORY} from '../lib/inventory.js';
import {catalogue, DESKS, INFORMATION_SCHEMA, validateSelection, selectedResponse, digest, finishResponse} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';
import {parseClaimantCounts, parseClaimantTime} from '../lib/claimant-count.js';

const original = new URL('../verification/claimant-count-2026-10-20/original/', import.meta.url);
const read = name => readFileSync(new URL(name, original), 'utf8');
const parsed = parseClaimantCounts(read('nomis-national.csv'), parseClaimantTime(JSON.parse(read('nomis-time.json'))));
// Separate official JSON extraction is not the reader's CSV path.
const official = JSON.parse(read('nomis-national.excerpt.json')).obs;
const nations = {
  'united-kingdom':['United Kingdom','K02000001'],
  england:['England','E92000001'],
  scotland:['Scotland','S92000003'],
  wales:['Wales','W92000004'],
  'northern-ireland':['Northern Ireland','N92000002'],
};
const selection = (desk, measure, observation) => validateSelection(new URL(`https://morningrows.com/${desk}.json?`+new URLSearchParams({
  source:'claimant_count', ...(measure ? {measure} : {}), ...(observation ? {observation} : {}),
})));
const bodyFor = desk => ({
  site:'https://morningrows.com', country:nations[desk][0],
  claimant_count:structuredClone(parsed[desk]),
  sources:{claimant_count:{status:'ok',fetched_at:'2026-10-20T04:40:19.324Z'}},
});
const select = (desk, measure, observation, body=bodyFor(desk)) => selectedResponse(body, selection(desk,measure,observation));

test('five national directories disclose thirteen NSA administrative months without adding a desk', () => {
  assert.equal(catalogue().countries.length,8);
  assert.equal(catalogueV2().countries.length,9);
  for(const desk of Object.keys(DESKS)) {
    const entries=INVENTORY[desk].filter(e=>e[0]==='claimant_count');
    const card=catalogue(desk).sources.find(s=>s.key==='claimant_count');
    if(!Object.hasOwn(nations,desk)) {assert.equal(entries.length,0);assert.equal(card,undefined);continue;}
    assert.equal(entries.length,1);
    assert.equal(card.measure_count,1);
    assert.match(card.limits,/administrative claimant counts/);
    assert.match(card.limits,/not unemployment estimates/);
    assert.match(card.limits,/not seasonally adjusted/);
    assert.equal(card.measures[0].id,'claimants');
    assert.equal(card.measures[0].retained_calendar_slots,13);
    assert.equal(card.measures[0].observation_selector,'YYYY-MM');
    assert.equal(card.measures[0].definition.geography_code,nations[desk][1]);
    assert.equal(validateSelection(new URL(card.measures[0].records)).measure,'claimants');
  }
});

test('source and measure retain all 65 official cells, fixed meanings and source provenance', async () => {
  for(const [desk,[name,code]] of Object.entries(nations)) {
    const body=bodyFor(desk);
    body.claimant_count.provenance=[{url:body.claimant_count.source_url,sha256:'a'.repeat(64),retrieved_at:body.sources.claimant_count.fetched_at}];
    const expected=official.filter(r=>r.geography.geogcode===code).map(r=>({period:r.time.value,value:r.obs_value.value})).sort((a,b)=>a.period.localeCompare(b.period));
    for(const measure of [undefined,'claimants']) {
      const {status,body:result}=await select(desk,measure,undefined,body);
      assert.equal(status,200);
      assert.equal(result.data.length,13);
      assert.equal(result.observations.length,13);
      assert.deepEqual(result.observations.map(({period,value})=>({period,value})),expected);
      assert.deepEqual(result.data,body.claimant_count.rows);
      assert.deepEqual(result.context.provenance,body.claimant_count.provenance);
      assert.equal(result.context.metadata.latest_period,'2026-08');
      assert.equal(new Set(result.observations.map(r=>r.id)).size,13);
      for(const observation of result.observations) {
        assert.equal(observation.definition.geography,name);
        assert.equal(observation.definition.geography_code,code);
        assert.equal(observation.definition.unit,'persons');
        assert.equal(observation.definition.adjustment,'not seasonally adjusted');
        assert.equal(observation.definition.dimensions.age,'0');
        assert.equal(observation.definition.dimensions.gender,'0');
        assert.equal(observation.qualifications.reference_date.slice(0,7),observation.period);
        assert.equal(observation.qualifications.release_timezone,null);
        assert.equal(observation.published_at,null);
        assert.equal(observation.publisher_updated_at,null);
        assert.deepEqual(observation.publisher_status,{obs_status:'A',obs_conf:'F'});
        assert.match(observation.licence,/Open Government Licence/);
        assert.match(observation.source_url,/nomisweb\.co\.uk/);
        const {version,native_pointer,...record}=observation;
        assert.equal(version,await digest(record));
      }
    }
  }
});

test('every exact month is independently addressable; unretained or incompatible periods are never substituted', async () => {
  for(const desk of Object.keys(nations)) {
    for(const row of parsed[desk].rows) {
      const {status,body}=await select(desk,'claimants',row.period);
      assert.equal(status,200);
      assert.deepEqual(body.data,row);
      assert.equal(body.observations.length,1);
      assert.equal(body.observations[0].period,row.period);
      assert.equal(body.observations[0].id,`https://morningrows.com/${desk}.json?source=claimant_count&measure=claimants&observation=${row.period}`);
    }
    for(const period of ['2025-07','2026-09','2026','2026-Q3','2026-8','2026-08-13']) {
      const {status,body}=await select(desk,'claimants',period);
      assert.equal(status,404);
      assert.equal(body.error,'observation_not_retained');
      assert.equal(body.data,null);
      assert.deepEqual(body.observations,[]);
    }
  }
});

test('wrong dimensions, geography and ignored date selectors explicitly refuse', () => {
  for(const query of [
    'source=claimant_count&geography=Belfast','source=claimant_count&date=2026-08',
    'source=claimant_count&adjustment=seasonally-adjusted','source=claimant_count&age=16-24',
    'source=claimant_count&measure=claimants&measure=claimants','source=claimant_count&observation=2026-08',
    'source=claimant_count&measure=','measure=claimants',
  ]) assert.equal(validateSelection(new URL('https://morningrows.com/wales.json?'+query)).status,400,query);
  for(const measure of ['unemployment','claimant-rate','claimants-sa']) assert.equal(selection('wales',measure).status,404);
  assert.equal(selection('canada','claimants').status,404);
});

test('partial, drifted or suppressed histories fail before any selected observations are returned', async () => {
  const mutations=[
    n=>n.rows.pop(),
    n=>n.rows[1].period=n.rows[0].period,
    n=>n.rows[1].period='2025-09-01',
    n=>n.rows[0]=null,
    n=>n.rows={},
    n=>n.rows[0].value=null,
    n=>n.rows[0].value='0',
    n=>n.rows[0].value=-5,
    n=>n.rows[0].value=3,
    n=>n.rows[0].value=NaN,
    n=>n.rows[0].value_state='suppressed',
    n=>n.rows[0].obs_conf='C',
    n=>n.rows[0].obs_status='M',
    n=>n.rows[0].geography='England',
    n=>n.rows[0].geography_code='E92000001',
    n=>n.rows[0].unit='percent',
    n=>n.rows[0].dimensions.age='1',
    n=>n.rows[0].dimensions.gender='1',
    n=>n.rows[0].adjustment='seasonally adjusted',
    n=>n.definition.population='Unemployed persons',
    n=>n.metadata.latest_period='2026-09',
  ];
  for(const mutate of mutations) {
    const body=bodyFor('wales');mutate(body.claimant_count);
    const r=await select('wales','claimants',undefined,body);
    assert.equal(r.status,503,mutate.toString());
    assert.equal(r.body.data,null);
    assert.equal(r.body.retrieval.status,'error');
    assert.deepEqual(r.body.observations,[]);
  }
  const body=bodyFor('wales');body.sources.claimant_count.status='degraded';
  assert.equal((await select('wales',undefined,undefined,body)).status,503);
});

test('rounded observed zero is retained; source failure cannot become zero or hide a successful sibling', async () => {
  const body=bodyFor('wales');body.claimant_count.rows[0].value=0;
  const zero=await select('wales','claimants',body.claimant_count.rows[0].period,body);
  assert.equal(zero.status,200);assert.equal(zero.body.data.value,0);
  assert.equal(zero.body.observations[0].value_state,'observed');
  const historical=JSON.parse(readFileSync(new URL('../verification/structure-2026-10-17/selected-snapshot.json',import.meta.url),'utf8')).wales;
  const withFailure={...historical,claimant_count:null,sources:{...historical.sources,claimant_count:{status:'error',error:'timeout',fetched_at:'2026-10-20T04:40:19Z'}}};
  const failed=await select('wales','claimants',undefined,withFailure);
  assert.equal(failed.status,503);assert.equal(failed.body.data,null);assert.deepEqual(failed.body.observations,[]);
  const projection=validateSelection(new URL('https://morningrows.com/wales.json?source=projection'));
  assert.deepEqual(await selectedResponse(withFailure,projection),await selectedResponse(historical,projection));
});

test('acquisition clocks and hashes do not manufacture observation revisions; a revised count changes one stable identity', async () => {
  const body=bodyFor('northern-ireland');
  const before=(await select('northern-ireland','claimants',undefined,body)).body;
  body.sources.claimant_count.fetched_at='2026-10-20T05:40:19Z';
  body.claimant_count.metadata.publisher_prepared_raw='2026-10-20T06:40:19Z';
  body.claimant_count.provenance=[{url:body.claimant_count.source_url,sha256:'b'.repeat(64),retrieved_at:'2026-10-20T05:40:19Z'}];
  const acquired=(await select('northern-ireland','claimants',undefined,body)).body;
  assert.deepEqual(acquired.observations,before.observations);
  assert.equal(acquired.content_version,before.content_version);
  assert.deepEqual(acquired.context.provenance,body.claimant_count.provenance);
  body.claimant_count.rows.at(-1).value+=5;
  const revised=(await select('northern-ireland','claimants',undefined,body)).body;
  assert.deepEqual(revised.observations.map(r=>r.id),before.observations.map(r=>r.id));
  assert.deepEqual(revised.observations.filter((r,i)=>r.version!==before.observations[i].version).map(r=>r.period),['2026-08']);
  body.claimant_count.rows[0].revision_version++;
  const corrected=(await select('northern-ireland','claimants',undefined,body)).body;
  assert.notEqual(corrected.observations[0].version,revised.observations[0].version);
});

test('rolling history preserves unchanged observation versions when native row offsets move', async () => {
  const body=bodyFor('england');
  const before=(await select('england','claimants',undefined,body)).body;
  body.claimant_count.rows.shift();
  const next={...structuredClone(body.claimant_count.rows.at(-1)),period:'2026-09',reference_date:'2026-09-17',release_timestamp_raw:'2026-10-20 07:00:00',revision_version:1};
  body.claimant_count.rows.push(next);
  Object.assign(body.claimant_count.metadata,{first_period:'2025-09',latest_period:'2026-09',reference_date:next.reference_date,release_timestamp_raw:next.release_timestamp_raw,revision_version:next.revision_version});
  const after=await select('england','claimants',undefined,body);
  assert.equal(after.status,200);
  for(const current of after.body.observations.slice(0,-1)) {
    const previous=before.observations.find(r=>r.id===current.id);
    assert.ok(previous);
    assert.notEqual(current.native_pointer,previous.native_pointer);
    assert.equal(current.version,previous.version);
  }
});

test('published schema fixes claimant population, dimensions, rounding, cardinality and national boundaries', () => {
  const def=INFORMATION_SCHEMA.$defs;
  assert.equal(def.claimantDefinition.type,'object');
  assert.equal(def.claimantDefinition.enum.length,5);
  assert.deepEqual(def.claimantDefinition.enum.map(d=>d.geography_code).sort(),Object.values(nations).map(n=>n[1]).sort());
  assert.equal(def.claimantDefinition.properties.dimensions.properties.measures.const,'20100');
  assert.equal(def.claimantRow.properties.value.multipleOf,5);
  assert.equal(def.claimantRow.properties.value.minimum,0);
  assert.equal(def.claimantRow.properties.value_state.const,'observed');
  assert.equal(def.claimantNative.properties.rows.minItems,13);
  assert.equal(def.claimantNative.properties.rows.maxItems,13);
  assert.equal(def.selected.allOf.length,5);
});

test('selected claimant HTTP identities support conditional GET and HEAD without masking failures', async () => {
  const selected=await select('wales','claimants','2026-08');
  const url=selected.body.id;
  const first=await finishResponse(new Request(url),Response.json(selected.body),url);
  const unchanged=await finishResponse(new Request(url,{headers:{'If-None-Match':first.headers.get('etag')}}),Response.json(selected.body),url);
  assert.equal(unchanged.status,304);
  const head=await finishResponse(new Request(url,{method:'HEAD'}),Response.json(selected.body),url);
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  const missing=await select('wales','claimants','2026-09');
  const error=await finishResponse(new Request(missing.body.id,{headers:{'If-None-Match':'*'}}),Response.json(missing.body,{status:404}),missing.body.id);
  assert.equal(error.status,404);
});
