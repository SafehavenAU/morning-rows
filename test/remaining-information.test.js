import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import worker from '../worker.js';
import {catalogue,digest,finishResponse,selectedResponse,validateSelection} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';
import {INVENTORY} from '../lib/inventory.js';
import {isRemainingSource,remainingDefinitions} from '../lib/remaining-information.js';

const root=new URL('../verification/remaining-gaps-2026-10-20/preview/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,root)));
const accepted=read('accepted-reader-proof.json');
const fixtures=accepted.sources.map(proof=>{
  const bytes=readFileSync(new URL(proof.capture,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),proof.capture_sha256);
  const capture=JSON.parse(bytes),[desk,key]=proof.key.split('/');
  // The preserved preview wrapper recorded task start in source health. This
  // constructed public envelope uses its separately recorded actual completion,
  // matching readSectionsWithCompletion; original captures are never rewritten.
  return {desk,key,proof,native:capture.live.body[key],clock:proof.actual_completed_at,
    country:desk==='scotland'?'Scotland':'Canada'};
});
const sourceUrl=f=>`https://morningrows.com/${f.desk}.json?source=${f.key}`;
function bodyFor(f){
  return {country:f.country,[f.key]:structuredClone(f.native),sources:{[f.key]:{status:'ok',fetched_at:f.clock}}};
}
function selection(f,measure,observation){
  const url=new URL(sourceUrl(f));
  if(measure!==undefined)url.searchParams.set('measure',measure);
  if(observation!==undefined)url.searchParams.set('observation',observation);
  return validateSelection(url);
}
const select=(f,measure,observation,body=bodyFor(f))=>selectedResponse(body,selection(f,measure,observation));
const versions=body=>body.observations.map(o=>o.version);

test('catalogues preserve accepted SFC/CMHC sources and retain eight/nine desk boundaries',()=>{
  assert.equal(catalogue().countries.length,8);
  assert.equal(catalogueV2().countries.length,9);
  for(const f of fixtures){
    const card=catalogue(f.desk).sources.find(s=>s.key===f.key);
    assert.ok(card);
    assert.equal(card.measure_count,f.proof.cells);
    assert.equal(card.representation,'described_measures');
    assert.equal(card.data_pointer,'/'+f.key);
    assert.equal(card.health_pointer,'/sources/'+f.key);
    assert.deepEqual(card.measures.map(m=>m.id),f.proof.comparisons.map(c=>c.measure_id));
    assert.ok(card.measures.every(m=>m.unit===f.proof.comparisons[0].unit));
    for(const m of card.measures)assert.equal(validateSelection(new URL(m.records)).measure,m.id);
  }
  for(const [desk,key]of [['england','bedroom_rent'],['england','care_assessment_cohort']]){
    assert.equal(isRemainingSource(desk,key),false);
    assert.equal(remainingDefinitions(desk,key),null);
    assert.equal(INVENTORY[desk].some(row=>row[0]===key),false);
    assert.equal(validateSelection(new URL(`https://morningrows.com/${desk}.json?source=${key}`)).code,'unknown_source');
  }
});

for(const f of fixtures){
  test(`${f.key}: actual accepted reader values retain exact measure/period, metadata and selectors`,async()=>{
    const result=await select(f);
    assert.equal(result.status,200);
    assert.deepEqual(result.body.data,f.native);
    assert.deepEqual(result.body.observations.map(o=>o.value),f.proof.comparisons.map(c=>c.expected));
    assert.deepEqual(result.body.observations.map(o=>o.period),f.proof.comparisons.map(c=>c.period));
    assert.equal(result.body.observations.length,f.proof.cells);
    assert.deepEqual(result.body.unavailable_measures,[]);
    assert.equal(result.body.retrieval.retrieved_at,f.clock);
    assert.deepEqual(result.body.context.provenance,f.native.provenance);
    for(const [i,reference]of f.proof.comparisons.entries()){
      for(const period of [undefined,reference.period]){
        const single=await select(f,reference.measure_id,period);
        assert.equal(single.status,200);
        assert.equal(single.body.observations.length,1);
        const observation=single.body.observations[0];
        assert.equal(single.body.data.value,reference.expected);
        assert.equal(single.body.data.measure_id,reference.measure_id);
        assert.equal(observation.id,`${sourceUrl(f)}&measure=${reference.measure_id}&observation=${reference.period}`);
        assert.equal(observation.value_state,'observed');
        assert.equal(observation.definition.unit,reference.unit);
        assert.equal(observation.native_pointer,`/${f.key}/rows/${i}`);
        assert.equal(Object.hasOwn(observation.qualifications,'provenance'),false);
        const {version,native_pointer,...record}=observation;
        assert.equal(version,await digest(record));
        if(f.key==='college_activity'){
          assert.equal(single.body.data.period_start,'2024-08-01');
          assert.equal(single.body.data.period_end,'2025-07-31');
          assert.match(observation.definition.population,/all funding sources/);
          assert.equal(observation.definition.unit,'full-time equivalents');
        }else{
          assert.equal(single.body.data.release_timezone,null);
          assert.deepEqual(single.body.data.licence_notice,f.native.rows[i].licence_notice);
          assert.deepEqual(observation.publisher_status,{
            status_code:f.native.rows[i].status_code,quality:f.native.rows[i].quality,security_level_code:f.native.rows[i].security_level_code,
            symbol_code:f.native.rows[i].symbol_code,symbol:f.native.rows[i].symbol,
          });
        }
      }
    }
  });

  test(`${f.key}: out-of-period and unsupported selectors cannot substitute the retained aggregate`,async()=>{
    const measure=f.proof.comparisons[0].measure_id;
    for(const period of ['2020','2020-21','2025-10','2025-10-01']){
      const result=await select(f,measure,period);
      assert.equal(result.status,404);
      assert.equal(result.body.error,'observation_not_retained');
      assert.equal(result.body.data,null);
      assert.deepEqual(result.body.observations,[]);
    }
    for(const query of ['date=2025','geography=Canada','source=duplicate','measure=x&measure=y']){
      assert.equal(validateSelection(new URL(`${sourceUrl(f)}&${query}`)).status,400);
    }
    assert.equal(selection(f,'unknown_measure').status,404);
    assert.equal(selection(f,undefined,'2025').status,400);
  });

  test(`${f.key}: whole-source, clock and acquisition failures refuse even an unaffected selected row`,async()=>{
    const mutations=[
      body=>{body[f.key].rows.pop();},
      body=>{body[f.key].rows.at(-1).value=null;},
      body=>{body[f.key].rows.at(-1).unit='people';},
      body=>{body[f.key].rows.at(-1).geography='Wrong area';},
      body=>{body[f.key].rows.at(-1).period='2000';},
      body=>{body[f.key].provenance=[];},
      body=>{body[f.key].provenance[0].retrieved_at=new Date(Date.parse(f.clock)+1).toISOString();},
      body=>{body.sources[f.key].status='degraded';},
      body=>{body.sources[f.key].status='error';},
      body=>{delete body.sources[f.key].fetched_at;},
      body=>{body.sources[f.key].fetched_at='2026-02-30T00:00:00Z';},
      body=>{body.sources[f.key].fetched_at='2020-01-01T00:00:00Z';},
    ];
    for(const mutate of mutations){
      const body=bodyFor(f);mutate(body);
      for(const measure of [undefined,f.proof.comparisons[0].measure_id]){
        const result=await select(f,measure,undefined,body);
        assert.equal(result.status,503,mutate.toString());
        assert.equal(result.body.data,null);
        assert.deepEqual(result.body.observations,[]);
      }
    }
  });

  test(`${f.key}: acquisition churn preserves semantic versions and a real value revision changes them`,async()=>{
    const initial=(await select(f)).body;
    const body=bodyFor(f),later='2026-10-20T14:00:00.000Z';
    body.sources[f.key].fetched_at=later;
    for(const p of body[f.key].provenance){p.retrieved_at=later;p.sha256='a'.repeat(64);}
    const reacquired=(await select(f,undefined,undefined,body)).body;
    assert.deepEqual(versions(reacquired),versions(initial));
    assert.equal(reacquired.content_version,initial.content_version);
    body[f.key].rows[0].value+=f.key==='college_activity'?5:1;
    if(f.key==='college_activity')body[f.key].rows[4].value+=5;
    const revised=await select(f,undefined,undefined,body);
    assert.equal(revised.status,200);
    assert.notEqual(revised.body.observations[0].version,initial.observations[0].version);
    assert.equal(revised.body.observations[1].version,initial.observations[1].version);
    assert.notEqual(revised.body.content_version,initial.content_version);
  });

  test(`${f.key}: exact selected response supports ETag/HEAD without converting refusals into 304`,async()=>{
    const {measure_id,period}=f.proof.comparisons[0];
    const good=await select(f,measure_id,period),url=good.body.id;
    const first=await finishResponse(new Request(url),Response.json(good.body),url);
    const etag=first.headers.get('etag');
    const conditional=await finishResponse(new Request(url,{headers:{'If-None-Match':etag}}),Response.json(good.body),url);
    assert.equal(conditional.status,304);
    const head=await finishResponse(new Request(url,{method:'HEAD'}),Response.json(good.body),url);
    assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);
    const missing=await select(f,measure_id,'2000');
    const refusal=await finishResponse(new Request(missing.body.id,{headers:{'If-None-Match':'*'}}),Response.json(missing.body,{status:missing.status}),missing.body.id);
    assert.equal(refusal.status,404);
  });
}

test('failed new source does not discard an unrelated successful native section',async()=>{
  const f=fixtures.find(f=>f.desk==='canada'),body=bodyFor(f);
  body[f.key]=null;body.sources[f.key]={status:'error',fetched_at:f.clock,http_status:503};
  body.rate={date:'2026-10-20',value:2.25,unit:'percent',geography:'Canada'};
  body.sources.rate={status:'ok',fetched_at:f.clock};
  const result=await selectedResponse(body,validateSelection(new URL('https://morningrows.com/canada.json?source=rate')));
  assert.equal(result.status,200);assert.deepEqual(result.body.data,body.rate);
  const failed=await select(f,undefined,undefined,body);
  assert.equal(failed.status,503);assert.equal(failed.body.data,null);
});

test('discovery reports precise held causes and accepted limits without fetching publishers',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw Error('No upstream request is permitted by this offline test');});
  const keys=await (await worker.fetch(new Request('https://morningrows.com/keys.json'),{})).json();
  const held=keys.blocked.filter(x=>x.checked==='2026-10-20'&&/ONS Manchester|CQC State/.test(x.source));
  assert.equal(held.length,2);
  assert.deepEqual(held.map(x=>x.status),[429,403]);
  assert.ok(held.every(x=>/disconnected/.test(x.note)));
  const llms=await (await worker.fetch(new Request('https://morningrows.com/llms.txt'),{})).text();
  assert.match(llms,/College Statistics 2024-25/);
  assert.match(llms,/all funding sources/);
  assert.match(llms,/Victoria CMA and Victoriaville CA/);
  assert.match(llms,/conditional CMHC reuse notices/);
  assert.match(llms,/ONS Manchester bedroom rents and the CQC assessment cohort remain disconnected/);
});
