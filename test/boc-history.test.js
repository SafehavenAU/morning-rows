import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BOC_HISTORY_SERIES,BOC_HISTORY_MAX_BYTES,bocHistoryDefinitions,bocHistoryWindow,bocHistoryUrls,parseBocHistory,readBocHistory,validateBocHistoryRepresentation} from '../lib/boc-history.js';
import {readSections} from '../lib/sources.js';
const root=new URL('../verification/gap-pass-2026-10-20/boc/',import.meta.url);
const files=['window','latest'].map(name=>JSON.parse(readFileSync(new URL(`original/${name}.json`,root))));
const independent=JSON.parse(readFileSync(new URL('independent-report.json',root)));
const now=()=> '2026-10-20T09:20:00.000Z';
const window=bocHistoryWindow(now());
const fixture=()=>structuredClone(files);
const parse=(data=fixture())=>parseBocHistory(...data,window);
const fetcher=(data=fixture(),override)=>async(url,options)=>{
  const role=url.endsWith('?recent=1')?'latest':'window',index=role==='window'?0:1;
  assert.equal(url,bocHistoryUrls(window)[role]);
  return override?override(role,data[index],options):new Response(JSON.stringify(data[index]),{headers:{'content-type':'application/json'}});
};

test('dated BoC specimen matches every independently extracted reference cell and preserves direction',()=>{
  const value=parse();assert.equal(validateBocHistoryRepresentation(value,{retrieved_at:now()}),true);
  assert.equal(value.rows.length,38);assert.equal(value.metadata.date_count,19);assert.equal(value.metadata.latest_period,'2026-10-19');
  for(const cell of independent.cells){const row=value.rows.find(r=>r.series===cell.series&&r.period===cell.period);assert.equal(row.value_text,cell.value_text);assert.equal(row.value,Number(cell.value_text));}
  assert.deepEqual(value.definitions,bocHistoryDefinitions());assert.equal(value.definitions.length,2);
  assert.deepEqual(value.rows.slice(-2).map(r=>[r.series,r.value,r.unit]),[['FXUSDCAD',1.4097,'CAD per USD'],['FXGBPCAD',1.8767,'CAD per GBP']]);
  assert.equal(value.published_at,null);assert.equal(value.publisher_updated_at,null);assert.equal(value.next_expected_update,null);
  assert.match(value.geography,/quote-currency jurisdiction/);assert.match(value.limitations,/not an inferred holiday/);
});

test('rolling window respects leap, month and year boundaries and rejects invalid clocks',()=>{
  assert.deepEqual(bocHistoryWindow('2027-01-01T00:00:00Z'),{start:'2026-12-02',end:'2027-01-01',calendar_days:31});
  assert.deepEqual(bocHistoryWindow('2028-03-01T23:59:59.999Z'),{start:'2028-01-31',end:'2028-03-01',calendar_days:31});
  assert.deepEqual(bocHistoryWindow('2027-03-01T00:00:00Z'),{start:'2027-01-30',end:'2027-03-01',calendar_days:31});
  for(const clock of [undefined,null,'','tomorrow','2026-02-30T00:00:00Z','2026-10-20','2026-10-20T09:20:00+00:00'])assert.throws(()=>bocHistoryWindow(clock),{name:'SourceError'});
  for(const bounds of [{start:'2026-09-19',end:'2026-10-20'},{start:'2026-09-21',end:'2026-10-20'},{start:'2026-02-30',end:'2026-03-31'}])assert.throws(()=>parseBocHistory(...fixture(),bounds));
});

test('unreported whole dates are absent, never zero/carry-forward/holiday; publisher order does not matter',()=>{
  const value=parse();assert.equal(value.rows.some(r=>r.period==='2026-10-12'),false);assert.equal(value.rows.some(r=>r.period==='2026-10-20'),false);
  const reordered=fixture();reordered[0].observations.reverse();assert.deepEqual(parse(reordered),value);
  const noWholeDate=fixture();noWholeDate[0].observations.splice(3,1);const reduced=parse(noWholeDate);assert.equal(reduced.rows.length,36);
  // The complete-looking omission cannot be detected by an invented calendar. The independent specimen comparison would detect its lost cells.
  assert.equal(validateBocHistoryRepresentation(reduced),true);
});

test('each response must retain exact series meanings and envelope identity',async t=>{
  const mutations={
    'wrong quote label':v=>v.seriesDetail.FXUSDCAD.label='CAD/USD',
    'opposite units':v=>v.seriesDetail.FXUSDCAD.metadata.unit='US dollars per Canadian dollar',
    'wrong description':v=>v.seriesDetail.FXGBPCAD.description='Monthly average',
    'wrong frequency':v=>v.seriesDetail.FXUSDCAD.metadata.frequency='Monthly',
    'wrong period convention':v=>v.seriesDetail.FXUSDCAD.dateFormat='monthly',
    'wrong dimension':v=>v.seriesDetail.FXUSDCAD.dimension.key='month',
    'missing series':v=>delete v.seriesDetail.FXGBPCAD,
    'extra series':v=>v.seriesDetail.FXAUDCAD=structuredClone(v.seriesDetail.FXUSDCAD),
    'wrong terms':v=>v.terms.url='https://example.test/terms',
    'unknown response flags':v=>v.status='partial',
  };
  for(let role=0;role<2;role++)for(const [name,change] of Object.entries(mutations))await t.test(`${role} ${name}`,()=>{const values=fixture();change(values[role]);assert.throws(()=>parse(values),{name:'SourceError'});});
});

test('dates, complete pairs and explicit numerical cells fail closed',async t=>{
  const mutations={
    'missing date':v=>delete v.observations[0].d,
    'invalid calendar date':v=>v.observations[0].d='2026-09-31',
    'timestamp instead of date':v=>v.observations[0].d+='T00:00:00Z',
    'outside lower bound':v=>v.observations[0].d='2026-09-19',
    'future date':v=>v.observations[0].d='2026-10-21',
    'duplicate date':v=>v.observations.push(structuredClone(v.observations[0])),
    'missing pair':v=>delete v.observations[0].FXGBPCAD,
    'extra pair':v=>v.observations[0].FXAUDCAD={v:'1.0'},
    'unknown value flag':v=>v.observations[0].FXUSDCAD.status='preliminary',
    'empty observations':v=>v.observations=[],
  };
  for(const [name,change] of Object.entries(mutations))await t.test(name,()=>{const values=fixture();change(values[0]);assert.throws(()=>parse(values),{name:'SourceError'});});
  for(const bad of [null,undefined,0,1.5,'',' ','0','0.0000','-1','NaN','Infinity','1e2','1,234.5','1.2 ',' 1.2','01.2','..','x','1'.repeat(25)])await t.test(`bad numeric ${String(bad)}`,()=>{const values=fixture();values[0].observations[0].FXUSDCAD.v=bad;assert.throws(()=>parse(values),{name:'SourceError'});});
});

test('latest anchor refuses stale tails, mixed releases, partial anchors and old specimens',async t=>{
  const mutations={
    'stale tail':v=>v[0].observations.pop(),
    'stale anchor':v=>v[1].observations=[structuredClone(v[0].observations.at(-2))],
    'revised latest absent in window':v=>v[1].observations[0].FXUSDCAD.v='1.4100',
    'anchor missing one series':v=>delete v[1].observations[0].FXGBPCAD,
    'anchor multiple dates':v=>v[1].observations.push(structuredClone(v[0].observations.at(-2))),
  };
  for(const [name,change] of Object.entries(mutations))await t.test(name,()=>{const values=fixture();change(values);assert.throws(()=>parse(values),{name:'SourceError'});});
  const historical=JSON.parse(readFileSync(new URL('../research/project-demand-2026-10-17/specimens/boc.json',import.meta.url)));
  assert.throws(()=>parseBocHistory(historical,files[1],window),{name:'SourceError'});
});

test('historical revisions are retained in their exact cell without changing siblings',()=>{
  const initial=parse(),values=fixture();values[0].observations[0].FXUSDCAD.v='1.4022';const changed=parse(values);
  assert.equal(changed.rows.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(initial.rows[i])).length,1);
  assert.equal(changed.rows[0].value,1.4022);assert.equal(changed.rows[1].value,initial.rows[1].value);
});

test('native representation rejects altered meanings, shapes, aliases and clocks',async t=>{
  const mutations={
    'wrong currency':v=>v.rows[0].base_currency='GBP',
    'wrong quote':v=>v.rows[0].quote_currency='USD',
    'inverted numeric alias':v=>v.rows[0].value=1/v.rows[0].value,
    'missing row':v=>v.rows.pop(),
    'missing text':v=>delete v.rows[0].value_text,
    'wrong date count':v=>v.metadata.date_count++,
    'wrong latest date':v=>v.metadata.latest_period='2026-10-20',
    'drop latest pair with internally consistent metadata':v=>{v.rows.splice(-2);v.metadata.date_count--;v.metadata.observation_count-=2;v.metadata.latest_period=v.rows.at(-1).period;},
    'discard latest anchor':v=>delete v.latest_anchor,
    'invented publication':v=>v.published_at=now(),
    'changed definition':v=>v.definitions[0].geography='Ontario',
    'unknown row qualification':v=>v.rows[0].holiday=false,
    'extra native key':v=>v.unknown=true,
    'unsorted rows':v=>v.rows.reverse(),
  };
  for(const [name,change] of Object.entries(mutations))await t.test(name,()=>{const value=parse();change(value);assert.equal(validateBocHistoryRepresentation(value),false);});
  for(const retrieved_at of [undefined,null,'bad','2026-10-19T09:20:00Z','2026-10-21T09:20:00Z'])assert.equal(validateBocHistoryRepresentation(parse(),{retrieved_at}),false);
});

test('reader makes exactly two concurrent bounded requests and retains hashes separately',async()=>{
  const calls=[],signals=[];
  const value=await readBocHistory({now,fetcher:fetcher(fixture(),async(role,data,options)=>{calls.push(role);signals.push(options.signal);await Promise.resolve();return new Response(JSON.stringify(data));})});
  assert.deepEqual(calls,['window','latest']);assert.equal(signals[0],signals[1]);assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(value.provenance.length,2);assert.equal(validateBocHistoryRepresentation(value,{retrieved_at:now()}),true);
  for(const p of value.provenance){assert.match(p.sha256,/^[0-9a-f]{64}$/);assert.ok(p.bytes>0&&p.bytes<BOC_HISTORY_MAX_BYTES);assert.equal(p.retrieved_at,now());}
  assert.deepEqual(value.rows,parse().rows);
  const bad=structuredClone(value);bad.provenance[0].url='https://example.test/';assert.equal(validateBocHistoryRepresentation(bad),false);
});

test('transport failures, bounds, malformed bodies and bad clocks are isolated',async t=>{
  const responses={
    'HTTP429':()=>new Response('busy',{status:429}),
    'malformed JSON':()=>new Response('{'),
    'empty body':()=>new Response(''),
    'oversize declared':()=>new Response('{}',{headers:{'content-length':String(BOC_HISTORY_MAX_BYTES+1)}}),
    'oversize streamed':()=>new Response(' '.repeat(BOC_HISTORY_MAX_BYTES+1)),
    'bad UTF8':()=>new Response(new Uint8Array([0xc3,0x28])),
    'unexpected redirect':()=>{const r=new Response('{}');Object.defineProperty(r,'url',{value:'https://example.test/rates'});return r;},
  };
  for(const [name,response] of Object.entries(responses))await t.test(name,async()=>{await assert.rejects(readBocHistory({now,fetcher:fetcher(fixture(),role=>role==='window'?response():new Response(JSON.stringify(files[1])))}),{name:'SourceError'});});
  await assert.rejects(readBocHistory({now,fetcher:async()=>{throw new DOMException('deadline','TimeoutError');}}),{name:'TimeoutError'});
  await assert.rejects(readBocHistory({now:()=> 'bad',fetcher:fetcher()}),{name:'SourceError'});
  const result=await readSections({exchange:async()=>({existing_four_pairs:'unchanged'}),exchange_history:()=>readBocHistory({now,fetcher:async()=>{throw new Error('transport');}})});
  assert.deepEqual(result.exchange,{existing_four_pairs:'unchanged'});assert.equal(result.exchange_history,null);assert.equal(result.sources.exchange.status,'ok');assert.equal(result.sources.exchange_history.status,'error');
});

test('UTC-midnight acquisition refuses the old requested window before it can be cached',async()=>{
  let calls=0;await assert.rejects(readBocHistory({fetcher:fetcher(),now:()=>calls++<3?'2026-10-20T23:59:59.999Z':'2026-10-21T00:00:00.000Z'}),/crossed UTC midnight/);
});
