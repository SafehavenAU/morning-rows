import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseStatcanGdp,readStatcanGdp,validateStatcanGdpRepresentation,statcanGdpDefinitions,STATCAN_GDP_URLS} from '../lib/statcan-gdp.js';
import {readSections} from '../lib/sources.js';

const directory=new URL('../verification/statcan-gdp-2026-10-20/original/',import.meta.url);
const originals=['wds-selected.json','series-metadata.json','cube-metadata.json'].map(name=>JSON.parse(readFileSync(new URL(name,directory))));
const fixture=()=>structuredClone(originals);
const parse=values=>parseStatcanGdp(...values);
const now=()=> '2026-10-20T08:00:00.000Z';
const roles=Object.keys(STATCAN_GDP_URLS);
const fetcherFor=(values=fixture(),override)=>async(url,options)=>{
  const role=roles.find(key=>STATCAN_GDP_URLS[key]===url),index=roles.indexOf(role);
  assert.ok(role,'Only the three fixed publisher endpoints may be requested');
  return override?override(role,values[index],options):new Response(JSON.stringify(values[index]),{headers:{'content-type':'application/json'}});
};

test('retained original GDP specimen preserves legacy values and explicit meanings',()=>{
  const value=parse(fixture());
  assert.equal(validateStatcanGdpRepresentation(value),true);
  assert.equal(value.period,'2026-04');assert.equal(value.level,2524127);assert.equal(value.quarter_change,.82);
  assert.equal(value.quarter,'2026-Q2');assert.equal(value.unit,'millions of chained (2017) dollars');
  assert.equal(value.adjustment,'Seasonally adjusted at annual rates');
  assert.deepEqual(value.rows.map(row=>[row.period,row.value,row.period_start,row.period_end,row.ref_per_raw]),[
    ['2026-Q1',2503604,'2026-01-01','2026-03-31','2026-03-01'],
    ['2026-Q2',2524127,'2026-04-01','2026-06-30','2026-06-01'],
  ]);
  assert.equal(value.growth.unit,'percent');assert.equal(value.growth.annualized,false);assert.equal(value.growth.kind,'derived');assert.equal(value.growth.value_state,'observed');
  assert.equal(value.growth.previous_value,2503604);assert.equal(value.growth.current_value,2524127);
  assert.equal(value.metadata.release_timestamp_raw,'2026-08-28T08:30');assert.equal(value.metadata.release_timezone,null);assert.equal(value.published_at,null);
  assert.notEqual(value.quarter_change,Math.round(((2524127/2503604)**4-1)*10000)/100);
  assert.match(value.limitations,/Symbol none does not establish finality/);
  assert.equal(statcanGdpDefinitions()[1].kind,'derived');
});

test('publisher point order is immaterial and documented preliminary/revised flags survive',()=>{
  const baseline=parse(fixture()),reversed=fixture();reversed[0][0].object.vectorDataPoint.reverse();
  assert.deepEqual(parse(reversed),baseline);
  const revised=fixture();revised[0][0].object.vectorDataPoint[0].symbolCode=1;revised[0][0].object.vectorDataPoint[1].symbolCode=3;
  const value=parse(revised);assert.deepEqual(value.rows.map(row=>row.symbol),['preliminary','revised']);assert.equal(validateStatcanGdpRepresentation(value),true);
  revised[0][0].object.vectorDataPoint[0].releaseTime='2026-05-29T08:30';assert.equal(parse(revised).rows[0].release_timestamp_raw,'2026-05-29T08:30');
});

test('exact identities, metadata and four coordinate meanings fail closed',async t=>{
  const mutations={
    'wrong product':v=>v[0][0].object.productId=36100105,
    'wrong coordinate':v=>v[0][0].object.coordinate='1.2.1.30.0.0.0.0.0.0',
    'wrong vector':v=>v[0][0].object.vectorId=123,
    'metadata wrong product':v=>v[1][0].object.productId=0,
    'metadata wrong coordinate':v=>v[1][0].object.coordinate='1.1.1.31.0.0.0.0.0.0',
    'metadata wrong vector':v=>v[1][0].object.vectorId=123,
    'changed series title':v=>v[1][0].object.SeriesTitleEn='Canada;Current prices;SAAR;GDP',
    'metadata scalar':v=>v[1][0].object.scalarFactorCode=0,
    'metadata units':v=>v[1][0].object.memberUomCode=0,
    'metadata frequency':v=>v[1][0].object.frequencyCode=6,
    'metadata precision':v=>v[1][0].object.decimals=1,
    'terminated series':v=>v[1][0].object.terminated=1,
    'wrong cube product':v=>v[2][0].object.productId='36100105',
    'wrong cube title':v=>v[2][0].object.cubeTitleEn='GDP per capita',
    'archived cube':v=>v[2][0].object.archiveStatusCode='1',
    'cube frequency':v=>v[2][0].object.frequencyCode=6,
    'extra dimension':v=>v[2][0].object.dimension.push(structuredClone(v[2][0].object.dimension[0])),
    'duplicate position':v=>v[2][0].object.dimension[1].dimensionPositionId=1,
    'unknown dimension label':v=>v[2][0].object.dimension[0].dimensionNameEn='Province',
    'wrong geography':v=>v[2][0].object.dimension[0].member[0].memberNameEn='Ontario',
    'geography vintage':v=>v[2][0].object.dimension[0].member[0].vintage=2021,
    'geography classification':v=>v[2][0].object.dimension[0].member[0].classificationCode='11125',
    'different chain year':v=>v[2][0].object.dimension[1].member.find(m=>m.memberId===1).memberNameEn='Chained (2012) dollars',
    'nominal prices':v=>v[2][0].object.dimension[1].member.find(m=>m.memberId===1).memberNameEn='Current prices',
    'wrong price unit':v=>v[2][0].object.dimension[1].member.find(m=>m.memberId===1).memberUomCode=0,
    'no annual rate':v=>v[2][0].object.dimension[2].member[0].memberNameEn='Unadjusted',
    'wrong estimate':v=>v[2][0].object.dimension[3].member.find(m=>m.memberId===30).memberNameEn='Gross domestic income',
    'terminated estimate':v=>v[2][0].object.dimension[3].member.find(m=>m.memberId===30).terminated=1,
    'duplicate selected member':v=>v[2][0].object.dimension[0].member.push(structuredClone(v[2][0].object.dimension[0].member[0])),
  };
  for(const [name,mutate] of Object.entries(mutations))await t.test(name,()=>{const values=fixture();mutate(values);assert.throws(()=>parse(values),{name:'SourceError'});});
});

test('ambiguous or failed envelopes cannot masquerade as selected GDP',async t=>{
  for(let index=0;index<3;index++)for(const kind of ['duplicate','empty','failed','response failure'])await t.test(`${roles[index]} ${kind}`,()=>{
    const values=fixture();if(kind==='duplicate')values[index].push(structuredClone(values[index][0]));
    if(kind==='empty')values[index]=[];if(kind==='failed')values[index][0].status='FAILURE';if(kind==='response failure')values[index][0].object.responseStatusCode=1;
    assert.throws(()=>parse(values),{name:'SourceError'});
  });
});

test('coverage, reference fields and latest release are anchored rather than positional',async t=>{
  const mutatePoint=(values,fn)=>fn(values[0][0].object.vectorDataPoint,values[2][0].object);
  const mutations={
    'missing quarter':p=>p.pop(),
    'third quarter':p=>p.push(structuredClone(p[0])),
    'duplicate quarter':p=>p[1]=structuredClone(p[0]),
    'quarter gap':p=>{p[0].refPer='2025-10-01';p[0].refPerRaw='2025-12-01';},
    'invalid quarter start':p=>p[0].refPer='2026-02-01',
    'not first day':p=>p[0].refPer='2026-01-02',
    'inconsistent raw quarter':p=>p[0].refPerRaw='2026-02-01',
    'range refPer2':p=>p[0].refPer2='2026-04-01',
    'range raw2':p=>p[0].refPerRaw2='2026-06-01',
    'stale internally adjacent pair':p=>{p[0].refPer='2025-10-01';p[0].refPerRaw='2025-12-01';p[1].refPer='2026-01-01';p[1].refPerRaw='2026-03-01';},
    'cube period ahead':(p,c)=>c.cubeEndDate='2026-07-01',
    'mismatched latest release':p=>p[1].releaseTime='2026-08-27T08:30',
    'prior release later':p=>p[0].releaseTime='2026-08-29T08:30',
    'release before quarter ends':p=>p[0].releaseTime='2026-02-28T08:30',
    'invalid date':p=>p[0].releaseTime='2026-02-30T08:30',
    'invented release timezone':p=>p[1].releaseTime+='Z',
    'cube malformed release':(p,c)=>c.releaseTime='tomorrow',
  };
  for(const [name,mutate] of Object.entries(mutations))await t.test(name,()=>{const values=fixture();mutatePoint(values,mutate);assert.throws(()=>parse(values),{name:'SourceError'});});
});

test('unsafe numeric observations and unsupported status codes are rejected',async t=>{
  for(const value of [0,-1,null,undefined,'2524127',Infinity,-Infinity,NaN,1.1,Number.MAX_SAFE_INTEGER+1])await t.test(`value ${String(value)}`,()=>{
    const values=fixture();values[0][0].object.vectorDataPoint[0].value=value;assert.throws(()=>parse(values),{name:'SourceError'});
  });
  for(const [field,value] of [['frequencyCode',6],['scalarFactorCode',3],['decimals',1],['statusCode',1],['statusCode',2],['statusCode',99],['securityLevelCode',1],['securityLevelCode',99],['symbolCode',2],['symbolCode',99],['symbolCode','3']])await t.test(`${field} ${value}`,()=>{
    const values=fixture();values[0][0].object.vectorDataPoint[1][field]=value;assert.throws(()=>parse(values),{name:'SourceError'});
  });
});

test('native validator binds legacy aliases, derived calculation, rows and complete meaning',async t=>{
  const baseline=parse(fixture());
  const mutations={
    'infinite legacy level':v=>v.level=Infinity,
    'wrong legacy period':v=>v.period='2026-06',
    'annualized growth substituted':v=>v.quarter_change=3.32,
    'wrong growth denominator':v=>v.growth.previous_value=2503605,
    'wrong growth period':v=>v.growth.period='2026-Q1',
    'growth claims annualized':v=>v.growth.annualized=true,
    'row missing':v=>v.rows.pop(),
    'row altered but alias unchanged':v=>v.rows[1].value++,
    'row units changed':v=>v.rows[1].unit='USD',
    'row geography changed':v=>v.rows[1].geography='Ontario',
    'row quarter end changed':v=>v.rows[1].period_end='2026-06-01',
    'row symbol label changed':v=>v.rows[1].symbol='final',
    'row dimension changed':v=>v.rows[1].dimensions.prices='2',
    'unit changed':v=>v.unit='dollars',
    'metadata latest changed':v=>v.metadata.latest_quarter='2026-Q1',
    'metadata unit changed':v=>v.metadata.unit_code=0,
    'definition changed':v=>v.definitions[0].population='Households',
    'publication instant invented':v=>v.published_at='2026-08-28T08:30:00Z',
    'unexpected semantic field':v=>v.population='Households',
  };
  for(const [name,mutate] of Object.entries(mutations))await t.test(name,()=>{const value=structuredClone(baseline);mutate(value);assert.equal(validateStatcanGdpRepresentation(value),false);});
  const changed=fixture();changed[0][0].object.vectorDataPoint[1].value+=1000;changed[0][0].object.vectorDataPoint[1].symbolCode=3;
  const revised=parse(changed);assert.equal(validateStatcanGdpRepresentation(revised),true);assert.notEqual(revised.quarter_change,baseline.quarter_change);assert.deepEqual(revised.rows[0],baseline.rows[0]);
});

test('runtime makes only three bounded exact POST requests and retains acquisition separately',async()=>{
  const requests=[];const reader=fetcherFor();
  const value=await readStatcanGdp({fetcher:async(url,options)=>{requests.push({url,options});return reader(url,options);},now});
  assert.equal(validateStatcanGdpRepresentation(value),true);assert.equal(requests.length,3);assert.equal(new Set(requests.map(r=>r.options.signal)).size,1);
  for(const {url,options} of requests){assert.equal(options.method,'POST');assert.equal(options.headers.accept,'application/json');assert.equal(options.headers['content-type'],'application/json');assert.equal(options.signal.aborted,false);assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body),url===STATCAN_GDP_URLS.cube?[{productId:36100104}]:[{productId:36100104,coordinate:'1.1.1.30.0.0.0.0.0.0',...(url===STATCAN_GDP_URLS.data?{latestN:2}:{})}]);}
  assert.deepEqual(value.provenance.map(p=>p.role),roles);assert.ok(value.provenance.every(p=>p.retrieved_at===now()&&/^[a-f0-9]{64}$/.test(p.sha256)));
  const repeated=await readStatcanGdp({fetcher:fetcherFor(),now:()=> '2026-10-20T09:00:00.000Z'});
  assert.notDeepEqual(value.provenance,repeated.provenance);delete value.provenance;delete repeated.provenance;assert.deepEqual(value,repeated);
});

test('runtime rejects HTTP, invalid JSON, UTF-8, oversize, redirects, empty bodies and timeout',async t=>{
  const cases={
    http:()=>new Response('unavailable',{status:503}),
    'invalid JSON':()=>new Response('{'),
    'invalid UTF-8':()=>new Response(new Uint8Array([0xc3,0x28])),
    'declared oversize':()=>new Response('{}',{headers:{'content-length':'16385'}}),
    'stream oversize':()=>new Response(' '.repeat(16385)),
    'empty body':()=>new Response(null),
    'unexpected redirect':()=>{const r=new Response('{}');Object.defineProperty(r,'url',{value:'https://example.org/other'});return r;},
    timeout:()=>{throw new DOMException('timed out','TimeoutError');},
  };
  for(const [name,bad] of Object.entries(cases))await t.test(name,async()=>{
    await assert.rejects(()=>readStatcanGdp({fetcher:fetcherFor(fixture(),(role,value)=>role==='data'?bad():new Response(JSON.stringify(value))),now}));
  });
  await assert.rejects(()=>readStatcanGdp({fetcher:fetcherFor(fixture(),(role,value)=>role==='cube'?new Response(' '.repeat(131073)):new Response(JSON.stringify(value))),now}),/byte bound/);
});

test('runtime uses the actual acquisition date to reject future reference quarters',async()=>{
  const values=fixture();const points=values[0][0].object.vectorDataPoint;
  points[0].refPer='2026-07-01';points[0].refPerRaw='2026-09-01';points[0].releaseTime='2027-02-28T08:30';
  points[1].refPer='2026-10-01';points[1].refPerRaw='2026-12-01';points[1].releaseTime='2027-02-28T08:30';
  values[2][0].object.cubeEndDate='2026-10-01';values[2][0].object.releaseTime='2027-02-28T08:30';
  assert.equal(validateStatcanGdpRepresentation(parse(values)),true,'Pure parsing is reproducible without a clock');
  assert.equal(validateStatcanGdpRepresentation(parse(values),{retrieved_at:now()}),false,'Public retrieval time also rejects future quarters with empty provenance');
  assert.equal(validateStatcanGdpRepresentation(parse(fixture()),{retrieved_at:now()}),true);
  assert.equal(validateStatcanGdpRepresentation(parse(fixture()),{}),false);
  assert.equal(validateStatcanGdpRepresentation(parse(fixture()),{retrieved_at:'bad'}),false);
  await assert.rejects(()=>readStatcanGdp({fetcher:fetcherFor(values),now}),/acquisition period/);
  await assert.rejects(()=>readStatcanGdp({fetcher:fetcherFor(),now:()=> 'bad clock'}),/acquisition clock/);
  assert.equal((await readStatcanGdp({fetcher:fetcherFor(),now})).quarter,'2026-Q2','A valid unchanged quarterly release is not stale by age');
});

test('a GDP failure leaves successful Canadian sibling sections intact',async()=>{
  const warn=console.warn;console.warn=()=>{};
  try {
    const result=await readSections({product:()=>readStatcanGdp({fetcher:fetcherFor(fixture(),()=>new Response('down',{status:503})),now}),prices:async()=>({period:'2026-09',value:1.5})});
    assert.equal(result.product,null);assert.equal(result.sources.product.status,'error');assert.equal(result.sources.product.http_status,503);
    assert.deepEqual(result.prices,{period:'2026-09',value:1.5});assert.equal(result.sources.prices.status,'ok');
  } finally {console.warn=warn;}
});
