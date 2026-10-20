import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {catalogue, digest, finishResponse, INFORMATION_SCHEMA, measuresFor, selectedResponse, validateSelection} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';
import {STATCAN_GDP_URLS, parseStatcanGdp, validateStatcanGdpRepresentation} from '../lib/statcan-gdp.js';

const evidence=new URL('../verification/statcan-gdp-2026-10-20/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,evidence),'utf8'));
const original=read('original/wds-selected.json');
const series=read('original/series-metadata.json');
const cube=read('original/cube-metadata.json');
// Separate Python extraction reconciles WDS with the selected public table, its
// two-row CSV and the dated Daily release. It is not this runtime reader.
const official=read('independent-report.json');
const fetchedAt='2026-10-20T10:00:00Z';
const native=parseStatcanGdp(original,series,cube);
function bodyFor(value=native) {
  return {country:'Canada',product:structuredClone(value),sources:{product:{status:'ok',fetched_at:fetchedAt}}};
}
function selection(measure,observation) {
  const url=new URL('https://morningrows.com/canada.json?source=product');
  if(measure!==undefined)url.searchParams.set('measure',measure);
  if(observation!==undefined)url.searchParams.set('observation',observation);
  return validateSelection(url);
}
const select=(measure,observation,body=bodyFor())=>selectedResponse(body,selection(measure,observation));
const sourceUrl='https://morningrows.com/canada.json?source=product';
function revised(index,change) {
  const data=structuredClone(original);
  change(data[0].object.vectorDataPoint[index]);
  return bodyFor(parseStatcanGdp(data,series,cube));
}
const versions=body=>Object.fromEntries(body.observations.map(o=>[o.id,o.version]));
const changedIds=(before,after)=>Object.keys(versions(before)).filter(id=>versions(before)[id]!==versions(after)[id]);

test('Canada GDP directory describes two measures and their different units without changing other GDP desks',()=>{
  assert.equal(catalogue().countries.length,8);
  assert.equal(catalogueV2().countries.length,9);
  const card=catalogue('canada').sources.find(s=>s.key==='product');
  assert.equal(card.measure_count,2);
  assert.deepEqual(card.measures.map(m=>m.id),['level','quarter_change']);
  assert.deepEqual(card.measures.map(m=>m.retained_calendar_slots),[2,1]);
  assert.deepEqual(card.measures.map(m=>m.unit),['millions of chained (2017) dollars','percent']);
  assert.deepEqual(card.measures.map(m=>m.kind),['observation','derived']);
  assert.match(card.limits,/annual-rate level is not annualized growth/);
  assert.match(card.limits,/quarter-start-month alias, not monthly GDP/);
  for(const m of card.measures) {
    assert.equal(m.observation_selector,'YYYY-Qn');
    assert.equal(validateSelection(new URL(m.records)).measure,m.id);
  }
  for(const desk of ['united-kingdom','england','australia'])assert.deepEqual(measuresFor(desk,'product'),[]);
});

test('GDP source preserves legacy values while reconciling both quarterly levels and ordinary growth independently',async()=>{
  assert.equal(validateStatcanGdpRepresentation(native),true);
  const result=await select();
  assert.equal(result.status,200);
  const {body}=result;
  assert.deepEqual(body.data,native);
  assert.equal(body.data.period,'2026-04');
  assert.equal(body.data.level,official.levels[1]);
  assert.equal(body.data.quarter_change,Number(official.ordinary_growth_two_decimals));
  assert.equal(body.data.quarter,'2026-Q2');
  assert.equal(body.observations.length,3);
  assert.deepEqual(body.unavailable_measures,[]);
  assert.deepEqual(body.observations.slice(0,2).map(o=>o.value),official.levels);
  assert.deepEqual(body.observations.slice(0,2).map(o=>o.period),official.quarters);
  assert.equal(body.observations[2].value,0.82);
  assert.equal(body.observations[2].qualifications.annualized,false);
  assert.equal(body.observations[2].definition.kind,'derived');
  assert.deepEqual(body.observations[2].qualifications.inputs,native.rows);
  for(const o of body.observations) {
    assert.equal(o.value_state,'observed');
    assert.equal(o.definition.geography,'Canada');
    assert.equal(o.published_at,null);
    assert.equal(o.publisher_updated_at,null);
    assert.equal(o.next_expected_update,null);
    assert.equal(o.licence,'Statistics Canada Open Licence');
    assert.match(o.source_url,/statcan/);
    const {version,native_pointer,...record}=o;
    assert.equal(version,await digest(record));
  }
  for(const o of body.observations.slice(0,2)) {
    assert.equal(o.qualifications.release_timestamp_raw,official.release_timestamp_raw);
    assert.equal(o.qualifications.release_timezone,null);
    assert.equal(o.qualifications.adjustment,official.level_adjustment);
    assert.equal(Object.hasOwn(o.qualifications,'growth'),false);
    assert.equal(Object.hasOwn(o.qualifications,'provenance'),false);
  }
});

test('both exact level quarters and the latest growth comparison have bounded typed selectors',async()=>{
  const levels=await select('level');
  assert.equal(levels.status,200);assert.deepEqual(levels.body.data,native.rows);
  assert.equal(levels.body.observations.length,2);
  for(const [i,quarter] of official.quarters.entries()) {
    const one=await select('level',quarter);
    assert.equal(one.status,200);assert.equal(one.body.observations.length,1);
    assert.deepEqual(one.body.data,native.rows[i]);
    assert.equal(one.body.observations[0].id,`${sourceUrl}&measure=level&observation=${quarter}`);
  }
  for(const period of [undefined,'2026-Q2']) {
    const growth=await select('quarter_change',period);
    assert.equal(growth.status,200);assert.equal(growth.body.observations.length,1);
    assert.equal(growth.body.data.value,0.82);
    assert.deepEqual(growth.body.data.inputs,native.rows);
    assert.equal(growth.body.observations[0].id,`${sourceUrl}&measure=quarter_change&observation=2026-Q2`);
  }
});

test('unretained quarters and monthly aliases never substitute another GDP period',async()=>{
  for(const [measure,period] of [
    ['level','2025-Q4'],['level','2026-Q3'],['level','2026-04'],['level','2026-04-01'],
    ['level','2026'],['level','2026-q2'],['quarter_change','2026-Q1'],
  ]) {
    const result=await select(measure,period);
    assert.equal(result.status,404);assert.equal(result.body.error,'observation_not_retained');
    assert.equal(result.body.data,null);assert.deepEqual(result.body.observations,[]);
  }
  for(const query of ['date=2026-Q2','geography=Ontario','history=all','measure=level&measure=quarter_change']) {
    assert.equal(validateSelection(new URL(`${sourceUrl}&${query}`)).status,400);
  }
  for(const measure of ['annualized_growth','nominal','per_capita'])assert.equal(selection(measure).status,404);
});

test('native GDP drift, alias mismatch and health failure cannot become selected observations',async()=>{
  const mutations=[
    b=>b.product.rows[0].geography='Ontario',
    b=>b.product.rows[0].unit='dollars',
    b=>b.product.rows[0].adjustment='Not seasonally adjusted',
    b=>b.product.rows[0].price_basis='Current prices',
    b=>b.product.rows[0].period='2026-01',
    b=>b.product.rows[0].value=0,
    b=>b.product.rows[0].value=null,
    b=>b.product.rows[0].status_code=2,
    b=>b.product.rows[0].security_level_code=1,
    b=>b.product.rows[0].symbol_code=999,
    b=>b.product.rows.reverse(),
    b=>b.product.rows.pop(),
    b=>b.product.period='2026-06',
    b=>b.product.level++,
    b=>b.product.quarter_change=3.32,
    b=>b.product.growth.annualized=true,
    b=>b.product.growth.previous_period='2026-Q2',
    b=>b.product.metadata.latest_quarter='2025-Q4',
    b=>b.product.metadata.release_timezone='UTC',
    b=>b.sources.product.status='degraded',
    b=>b.sources.product.status='error',
    b=>b.sources.product.fetched_at='2026-05-31T12:00:00Z',
    b=>b.sources.product.fetched_at='invalid',
    b=>delete b.sources.product.fetched_at,
  ];
  for(const mutate of mutations) {
    const body=bodyFor();mutate(body);
    for(const measure of [undefined,'level','quarter_change']) {
      const result=await select(measure,undefined,body);
      assert.equal(result.status,503,mutate.toString());
      assert.equal(result.body.data,null);
      assert.deepEqual(result.body.observations,[]);
    }
  }
});

test('input order normalizes while preliminary and revised flags remain explicit',async()=>{
  const reversed=structuredClone(original);reversed[0].object.vectorDataPoint.reverse();
  assert.deepEqual((await select(undefined,undefined,bodyFor(parseStatcanGdp(reversed,series,cube)))).body,(await select()).body);
  for(const [symbol,label] of [[1,'preliminary'],[3,'revised']]) {
    const result=await select('level','2026-Q1',revised(0,p=>p.symbolCode=symbol));
    assert.equal(result.status,200);
    assert.equal(result.body.observations[0].publisher_status.symbol_code,symbol);
    assert.equal(result.body.observations[0].publisher_status.symbol,label);
  }
});

test('statistical revisions affect only the changed level and its derived comparison',async()=>{
  const before=(await select()).body;
  for(const index of [0,1]) {
    const result=await select(undefined,undefined,revised(index,p=>p.value++));
    assert.equal(result.status,200);
    assert.deepEqual(changedIds(before,result.body),[
      `${sourceUrl}&measure=level&observation=${official.quarters[index]}`,
      `${sourceUrl}&measure=quarter_change&observation=2026-Q2`,
    ]);
    assert.notEqual(before.content_version,result.body.content_version);
  }
  const changedStatus=(await select(undefined,undefined,revised(0,p=>p.symbolCode=3))).body;
  assert.deepEqual(changedIds(before,changedStatus),[
    `${sourceUrl}&measure=level&observation=2026-Q1`,
    `${sourceUrl}&measure=quarter_change&observation=2026-Q2`,
  ]);
  const changedRelease=(await select(undefined,undefined,revised(0,p=>p.releaseTime='2026-07-31T08:30'))).body;
  assert.deepEqual(changedIds(before,changedRelease),[
    `${sourceUrl}&measure=level&observation=2026-Q1`,
    `${sourceUrl}&measure=quarter_change&observation=2026-Q2`,
  ]);
});

test('acquisition provenance and retrieval clocks do not manufacture GDP statistical revisions',async()=>{
  const first=bodyFor();first.product.provenance=Object.entries(STATCAN_GDP_URLS).map(([role,url])=>({role,url,bytes:100,sha256:'a'.repeat(64),retrieved_at:fetchedAt}));
  const second=structuredClone(first);
  second.product.provenance[0].sha256='b'.repeat(64);
  second.product.provenance[0].retrieved_at='2026-10-20T11:00:00Z';
  second.sources.product.fetched_at='2026-10-20T11:00:00Z';
  for(const [measure,period] of [[undefined,undefined],['level',undefined],['level','2026-Q2'],['quarter_change','2026-Q2']]) {
    const before=await select(measure,period,first),after=await select(measure,period,second);
    assert.equal(before.status,200);assert.equal(after.status,200);
    assert.deepEqual(versions(before.body),versions(after.body));
    assert.equal(before.body.content_version,after.body.content_version);
    assert.notDeepEqual(before.body.context.provenance,after.body.context.provenance);
  }
});

test('a new quarter preserves the unchanged retained level version when its native row offset moves',async()=>{
  const before=(await select()).body;
  const data=structuredClone(original),metadata=structuredClone(cube);
  const previous=structuredClone(data[0].object.vectorDataPoint[1]);
  const next={...previous,refPer:'2026-07-01',refPerRaw:'2026-09-01',value:previous.value+10000,releaseTime:'2026-10-15T08:30'};
  data[0].object.vectorDataPoint=[previous,next];
  metadata[0].object.cubeEndDate=next.refPer;
  metadata[0].object.releaseTime=next.releaseTime;
  const result=await select(undefined,undefined,bodyFor(parseStatcanGdp(data,series,metadata)));
  assert.equal(result.status,200);
  const oldQuarter=before.observations.find(o=>o.definition.id==='level'&&o.period==='2026-Q2');
  const retained=result.body.observations.find(o=>o.definition.id==='level'&&o.period==='2026-Q2');
  assert.equal(oldQuarter.id,retained.id);assert.equal(oldQuarter.version,retained.version);
  assert.equal(oldQuarter.native_pointer,'/product/rows/1');assert.equal(retained.native_pointer,'/product/rows/0');
  assert.equal(result.body.observations.find(o=>o.definition.id==='quarter_change').period,'2026-Q3');
  assert.equal((await select('level','2026-Q1',bodyFor(parseStatcanGdp(data,series,metadata)))).status,404);
});

test('equal positive quarterly levels produce observed zero growth and GDP failure preserves Canadian siblings',async()=>{
  const zeroGrowth=await select('quarter_change',undefined,revised(1,p=>p.value=official.levels[0]));
  assert.equal(zeroGrowth.status,200);assert.equal(zeroGrowth.body.data.value,0);
  assert.equal(zeroGrowth.body.observations[0].value_state,'observed');
  const legacy=JSON.parse(readFileSync(new URL('../verification/structure-2026-10-17/selected-snapshot.json',import.meta.url),'utf8')).canada;
  const failed={...legacy,product:null,sources:{...legacy.sources,product:{status:'error',fetched_at:fetchedAt,error:'publisher timeout'}}};
  const fx=validateSelection(new URL('https://morningrows.com/canada.json?source=exchange'));
  assert.deepEqual(await selectedResponse(failed,fx),await selectedResponse(legacy,fx));
});

test('GDP conditional GET and HEAD isolate selection identity and preserve explicit refusal status',async()=>{
  const selected=await select('level','2026-Q2'),url=selected.body.id;
  const first=await finishResponse(new Request(url),Response.json(selected.body),url);
  const etag=first.headers.get('etag');
  assert.equal((await finishResponse(new Request(url,{headers:{'If-None-Match':etag}}),Response.json(selected.body),url)).status,304);
  const head=await finishResponse(new Request(url,{method:'HEAD'}),Response.json(selected.body),url);
  assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);
  for(const other of [await select(),await select('level','2026-Q1'),await select('quarter_change','2026-Q2')]) {
    assert.equal((await finishResponse(new Request(other.body.id,{headers:{'If-None-Match':etag}}),Response.json(other.body),other.body.id)).status,200);
  }
  const invalid=bodyFor();invalid.product.quarter_change=3.32;
  for(const other of [await select('level','2025-Q4'),await select(undefined,undefined,invalid)]) {
    assert.equal((await finishResponse(new Request(other.body.id,{headers:{'If-None-Match':'*'}}),Response.json(other.body,{status:other.status}),other.body.id)).status,other.status);
  }
});

test('published GDP schemas reject wrong meanings, incomplete coverage and invented timezones in real selected responses',async()=>{
  const source=(await select()).body;
  const levels=(await select('level')).body;
  const earliest=(await select('level','2026-Q1')).body;
  const latest=(await select('level','2026-Q2')).body;
  const growth=(await select('quarter_change')).body;
  const full={...bodyFor(),site:'https://morningrows.com',_meta:{schema_version:'1.0',id:'https://morningrows.com/canada.json',catalog:'https://morningrows.com/catalog.json?desk=canada'}};
  const acquired=structuredClone(source);
  const provenance=Object.entries(STATCAN_GDP_URLS).map(([role,url])=>({role,url,bytes:100,sha256:'a'.repeat(64),retrieved_at:fetchedAt}));
  acquired.context.provenance=provenance;acquired.data.provenance=provenance;
  const cases=[
    ...[full,source,levels,earliest,latest,growth,(await select('quarter_change','2026-Q2')).body,acquired].map((value,i)=>({name:`valid ${i}`,valid:true,value})),
    // Full-desk null on source failure and other countries' legacy GDP remain valid.
    {name:'failed Canada product',valid:true,value:{...full,product:null}},
    {name:'untyped UK product',valid:true,value:{...full,country:'United Kingdom',product:{period:'2026-06',level:123}}},
  ];
  function negative(name,input,mutate) {
    const value=structuredClone(input);mutate(value);cases.push({name,valid:false,value});
  }
  for(const [name,mutate] of [
    ['geography',v=>v.data.geography='Ontario'],
    ['unit',v=>v.data.unit='dollars'],
    ['adjustment',v=>v.data.adjustment='Not seasonally adjusted'],
    ['price basis',v=>v.data.price_basis='Current prices'],
    ['monthly period',v=>v.data.period='2026-04'],
    ['invented quarter',v=>v.data.period='2026-Q5'],
    ['non-quarter start',v=>v.data.period_start='2026-02-01'],
    ['impossible end',v=>v.data.period_end='2026-06-31'],
    ['null level',v=>v.data.value=null],
    ['zero level',v=>v.data.value=0],
    ['negative level',v=>v.data.value=-1],
    ['string level',v=>v.data.value='2524127'],
    ['suppression',v=>v.data.security_level_code=1],
    ['rounded zero',v=>v.data.status_code=2],
    ['unknown symbol',v=>v.data.symbol_code=2],
    ['mislabelled symbol',v=>v.data.symbol='revised'],
    ['wrong dimension',v=>v.data.dimensions.estimates='2'],
    ['UTC invention',v=>v.data.release_timezone='UTC'],
    ['raw release offset',v=>v.data.release_timestamp_raw+='Z'],
    ['wrong publisher units',v=>v.observations[0].definition.unit='millions of current dollars'],
    ['wrong geography definition',v=>v.observations[0].definition.geography='Ontario'],
    ['wrong observation definition',v=>v.observations[0].definition.id='quarter_change'],
    ['wrong observation identity',v=>v.observations[0].id=v.observations[0].id.replace('canada.json','england.json')],
    ['wrong source licence',v=>v.observations[0].licence='unknown'],
    ['publisher timestamp invented',v=>v.observations[0].published_at='2026-08-28T08:30:00Z'],
    ['invalid version',v=>v.observations[0].version='version1'],
    ['missing observation',v=>v.observations=[]],
    ['empty context',v=>v.context={}],
    ['wrong contextual adjustment',v=>v.context.adjustment='annualized growth'],
    ['wrong contextual title',v=>v.context.metadata.series_title='Canada nominal GDP'],
    ['wrong contextual scalar',v=>v.context.metadata.scalar_code=0],
    ['wrong contextual frequency',v=>v.context.metadata.frequency_code=6],
    ['wrong contextual vintage',v=>v.context.definitions[0].price_basis='Chained (2012) dollars'],
    ['degraded success',v=>v.retrieval.status='degraded'],
  ])negative(name,latest,mutate);
  for(const [name,mutate] of [
    ['annualized growth',v=>v.data.annualized=true],
    ['growth unit ratio',v=>v.data.unit='ratio'],
    ['growth kind observation',v=>v.data.kind='observation'],
    ['growth availability derived',v=>v.data.value_state='derived'],
    ['annualized formula',v=>v.data.formula='100 * ((current_value / previous_value) ** 4 - 1)'],
    ['growth input missing',v=>v.data.inputs.pop()],
    ['growth input geography',v=>v.data.inputs[0].geography='Ontario'],
    ['growth publisher status',v=>v.observations[0].publisher_status.derived=false],
    ['growth definition kind',v=>v.observations[0].definition.kind='observation'],
    ['growth all quarters invented',v=>v.observations.push(structuredClone(v.observations[0]))],
  ])negative(name,growth,mutate);
  negative('level window incomplete',levels,v=>v.data.pop());
  negative('level observations incomplete',levels,v=>v.observations.pop());
  negative('source observations incomplete',source,v=>v.observations.pop());
  negative('source swaps growth and level',source,v=>v.observations.reverse());
  negative('GDP source discriminator missing',latest,v=>delete v.source);
  negative('missing source cannot hide wrong units',latest,v=>{delete v.source;v.data.unit='USD';});
  negative('changed source cannot hide wrong units',latest,v=>{v.source='https://morningrows.com/canada.json?source=exchange';v.data.unit='USD';});
  negative('foreign selected identity',latest,v=>v.id='https://example.org/?measure=level&observation=2026-Q2');
  negative('wrong desk selected identity',latest,v=>v.id=v.id.replace('canada.json','england.json'));
  negative('unknown query in selected identity',latest,v=>v.id+='&geography=Ontario');
  negative('monthly alias in selected identity',latest,v=>v.id=v.id.replace('2026-Q2','2026-04'));
  negative('reordered selected identity',latest,v=>v.id='https://morningrows.com/canada.json?measure=level&source=product&observation=2026-Q2');
  negative('unrequested growth selector identity',growth,v=>v.id=v.id.replace('quarter_change','annualized_growth'));
  negative('native legacy period monthly',full,v=>v.product.period='2026-06');
  negative('native definition changed',full,v=>v.product.definitions[1].unit='proportion');
  negative('native rows omitted',full,v=>delete v.product.rows);
  negative('partial provenance',acquired,v=>v.context.provenance.pop());
  negative('duplicate provenance role',acquired,v=>v.context.provenance[1]=v.context.provenance[0]);
  negative('untrusted provenance URL',acquired,v=>v.context.provenance[0].url='https://example.com/data');
  negative('malformed provenance clock',acquired,v=>v.context.provenance[0].retrieved_at='not-a-dateZ');
  negative('nonhex provenance hash',acquired,v=>v.context.provenance[0].sha256='x'.repeat(64));
  const check=spawnSync('python',['-c',`
import datetime,json,re,sys
from jsonschema import Draft202012Validator,FormatChecker
data=json.load(sys.stdin)
formats=FormatChecker()
@formats.checks("date",raises=(ValueError,TypeError))
def date(value):
    return not isinstance(value,str) or datetime.date.fromisoformat(value).isoformat()==value
@formats.checks("date-time",raises=(ValueError,TypeError))
def instant(value):
    if not isinstance(value,str): return True
    return bool(re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})",value)) and datetime.datetime.fromisoformat(value.replace("Z","+00:00")).utcoffset() is not None
Draft202012Validator.check_schema(data["schema"])
validator=Draft202012Validator(data["schema"],format_checker=formats)
failures=[]
for case in data["cases"]:
    errors=list(validator.iter_errors(case["value"]))
    if (not errors)!=case["valid"]:
        failures.append({"name":case["name"],"expected":case["valid"],"errors":[e.message[:300] for e in errors[:2]]})
print(json.dumps({"cases":len(data["cases"]),"failures":failures}))
sys.exit(bool(failures))
`],{input:JSON.stringify({schema:INFORMATION_SCHEMA,cases}),encoding:'utf8',maxBuffer:2*1024*1024});
  assert.equal(check.status,0,check.stdout+check.stderr);
  assert.equal(JSON.parse(check.stdout).cases,cases.length);
  assert.equal(INFORMATION_SCHEMA.$defs.selected.allOf.filter(rule=>rule.if?.properties?.source?.const?.endsWith('?source=claimant_count')).length,5,'Existing claimant constraints remain intact');
  assert.ok(Buffer.byteLength(JSON.stringify(INFORMATION_SCHEMA))<1_000_000);
});
