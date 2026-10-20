import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SourceError,readSections} from '../lib/sources.js';
import {
  NZ_RENT_LOCATIONS,NZ_RENT_DWELLINGS,NZ_RENT_BEDROOMS,NZ_RENT_STATISTICS,
  nzRentDefinitions,parseNzRentPayload,readNzMarketRent,validateNzRentRepresentation,
} from '../lib/nz-market-rent.js';

const directory=new URL('../verification/nz-market-rent-2026-10-20/',import.meta.url);
const reference=JSON.parse(readFileSync(new URL('independent-report.json',directory),'utf8'));
const ids=Object.keys(NZ_RENT_LOCATIONS),[avondale,kelburn]=ids;
const fixtures=Object.fromEntries(ids.map(id=>[id,readFileSync(new URL('original/'+(id===avondale?'avondale':'kelburn')+'-ajax.html',directory),'utf8')]));
// Retained complete publisher Table fragments are wrapped for transport tests.
// This constructed wrapper is not claimed to preserve the original JSON hash.
const payload=(id=avondale,html=fixtures[id])=>({Finder:'',Table:html});
const body=(id=avondale,html=fixtures[id])=>JSON.stringify(payload(id,html));
const parse=(html=fixtures[avondale],id=avondale)=>parseNzRentPayload(payload(id,html),id);
const fetcher=async url=>new Response(body(ids.find(id=>NZ_RENT_LOCATIONS[id].source_url===url)),{headers:{'content-type':'text/html'}});
const native=()=>readNzMarketRent({fetcher,now:()=> '2026-10-20T07:05:07.000Z'});
const firstRow=fixtures[avondale].match(/<tbody>\s*(<tr>[\s\S]*?<\/tr>)/)[1];
function reconcile(parsed,id) {
  const expected=reference.localities.find(l=>l.id===id);
  assert.equal(parsed.location.period_start,expected.period.start);
  assert.equal(parsed.location.period_end,expected.period.end);
  assert.deepEqual(parsed.rows.map(r=>({
    dwelling_type:r.dwelling_type,dwelling_key:r.dwelling_key,bedrooms:r.bedroom_key,
    bedroom_label:r.bedrooms,active_bonds:r.active_bonds,lower_quartile:r.lower_quartile,median:r.median,upper_quartile:r.upper_quartile,
  })),expected.rows);
}

test('complete AJAX reader reconciles all 29 rows and 116 cells with separately extracted official full-page evidence',async()=>{
  assert.equal(reference.pass,true);
  let total=0;
  for(const id of ids){const result=parse(fixtures[id],id);reconcile(result,id);total+=result.rows.length;}
  assert.equal(total,29);
  const value=await native();assert.equal(validateNzRentRepresentation(value),true);
  assert.equal(value.rows.length,29);assert.equal(value.metadata.count,29);
  assert.deepEqual(value.locations.map(l=>l.row_count),[13,16]);
  assert.equal(value.metadata.period_start,'2026-03-01');assert.equal(value.metadata.period_end,'2026-08-31');
  assert.equal(value.published_at,null);assert.equal(value.publisher_updated_at,null);
  assert.equal(value.metadata.revision_id,null);assert.equal(value.metadata.publication_time,null);
  assert.equal(value.licence_url,'https://creativecommons.org/licenses/by/3.0/nz/');
});

test('finite definitions keep place, bedroom range, weekly rent and active-bond semantics distinct',()=>{
  const definitions=nzRentDefinitions();
  assert.equal(definitions.length,200);assert.equal(new Set(definitions.map(d=>d.id)).size,200);
  assert.equal(Object.keys(NZ_RENT_DWELLINGS).length,5);assert.equal(Object.keys(NZ_RENT_BEDROOMS).length,5);
  assert.deepEqual(Object.keys(NZ_RENT_STATISTICS),['lower_quartile','median','upper_quartile','active_bonds']);
  for(const d of definitions) {
    assert.match(d.period_convention,/six-month/);assert.match(d.population,/Non-government/);
    assert.equal(d.geography,NZ_RENT_LOCATIONS[d.dimensions.location].geography);
    assert.equal(d.unit,d.dimensions.statistic==='active_bonds'?'bonds':'NZD per week');
    if(d.dimensions.bedrooms==='5-plus')assert.match(d.name,/5\+ bedrooms/);
    if(d.dimensions.statistic==='active_bonds') {
      assert.match(d.definition,/not all lodged bonds.*denominator/);
      assert.match(d.population,/current bonds.*complete rent.*not all lodged bonds/);
    } else assert.match(d.population,/bonds lodged/);
  }
  assert.throws(()=>parseNzRentPayload(payload(),'Auckland'),SourceError);
  assert.throws(()=>parseNzRentPayload(payload(),'toString'),SourceError);
});

test('area echo, one heading and exact population dimensions are mandatory',()=>{
  for(const html of [
    fixtures[avondale].replace('Auckland - Avondale','Wellington - Avondale'),
    fixtures[avondale].replace('Auckland - Avondale','Auckland'),
    fixtures[avondale].replace('Auckland - Avondale','Auckland - Avondale West'),
    fixtures[avondale].replace('<h5>Auckland','<h5>Extra</h5><h5>Auckland'),
    fixtures[avondale].replace('Apartment</h5>','Apartments</h5>'),
    fixtures[avondale].replace('Boarding House</h5>','Apartment</h5>'),
    fixtures[avondale].replace('1 bedroom</td>','6 bedrooms</td>'),
    fixtures[avondale].replace('5+ bedrooms</td>','5 bedrooms</td>'),
  ])assert.throws(()=>parse(html),SourceError);
  assert.throws(()=>parse(fixtures[avondale],kelburn),/locality/);
});

test('inclusive six-month dates are dynamic but malformed, partial-month or monthly periods fail',()=>{
  for(const label of [
    '01 Mar 2026 - 31 Mar 2026','02 Mar 2026 - 31 Aug 2026','01 Mar 2026 - 30 Aug 2026',
    '01 Mar 2026 - 31 Sep 2026','00 Mar 2026 - 31 Aug 2026','01 Abc 2026 - 31 Aug 2026',
    '01 Mar 2026 - 31 Aug 2025','01 Mar 2026 - 30 Sep 2026','March–August 2026',
  ])assert.throws(()=>parse(fixtures[avondale].replace('01 Mar 2026 - 31 Aug 2026',label)),SourceError,label);
  const future=parse(fixtures[avondale].replace('01 Mar 2026 - 31 Aug 2026','01 Apr 2026 - 30 Sep 2026'));
  assert.equal(future.location.period_start,'2026-04-01');assert.equal(future.location.period_end,'2026-09-30');
  const leap=parse(fixtures[avondale].replace('01 Mar 2026 - 31 Aug 2026','01 Sep 2023 - 29 Feb 2024'));
  assert.equal(leap.location.period_end,'2024-02-29');
  assert.throws(()=>reconcile(future,avondale),assert.AssertionError,'Acceptance remains tied to independently acquired vintage');
  const older=parse(fixtures[avondale].replace('01 Mar 2026 - 31 Aug 2026','01 Feb 2026 - 31 Jul 2026'));
  assert.throws(()=>reconcile(older,avondale),assert.AssertionError,'A structurally valid older window cannot certify this release');
});

test('strict complete table structure refuses missing tables, truncated rows and extra cells',()=>{
  for(const html of [
    fixtures[avondale].replace(/<table[\s\S]*?<\/table>/,''),
    fixtures[avondale].replace('</tbody>',''),
    fixtures[avondale].replace('</tr>',''),
    fixtures[avondale].replace(firstRow,firstRow.replace('<td>91</td>','')),
    fixtures[avondale].replace(firstRow,firstRow.replace('</tr>','<td>100</td></tr>')),
    fixtures[avondale].replace('Active bonds','Total bonds'),
    fixtures[avondale].replace('Median Rent','Median monthly rent'),
    fixtures[avondale].replace('<td>91</td>','<td><script>91</script></td>'),
    fixtures[avondale].replace('<td>91</td>','<td><span><span>91</span></span></td>'),
    fixtures[avondale].replace('<div class=','<div onclick="bad()" class='),
  ])assert.throws(()=>parse(html),SourceError);
  assert.throws(()=>parse(fixtures[avondale].replace(firstRow,firstRow+firstRow)),/duplicate/);
});

test('removal of a complete publisher row is explicit nonreporting, not fabricated suppression or zero',()=>{
  const changed=parse(fixtures[avondale].replace(firstRow,''));
  assert.equal(changed.rows.length,12);assert.equal(changed.location.table_counts.apartment,2);
  assert(!changed.rows.some(r=>r.dwelling_key==='apartment'&&r.bedroom_key==='1'));
  assert.throws(()=>reconcile(changed,avondale),assert.AssertionError,'Pinned independent acceptance catches missing specimen row');
  const added=firstRow.replace('1 bedroom','4 bedrooms');
  const extended=parse(fixtures[avondale].replace(firstRow,firstRow+added));
  assert.equal(extended.rows.length,14);assert.equal(extended.location.table_counts.apartment,4);
  assert(extended.rows.some(r=>r.dwelling_key==='apartment'&&r.bedroom_key==='4'));
});

test('unknown numeric markers, monthly units, other currencies and invalid grouping fail without zero substitution',()=>{
  for(const token of ['', '-', '..', 'N/A', '*', 'suppressed', '0 (suppressed)', '-1', '1.5', '01', '1e3','9,99','9007199254740992']) {
    assert.throws(()=>parse(fixtures[avondale].replace('<td>91</td>',`<td>${token}</td>`)),SourceError,token);
  }
  for(const token of ['470','NZD470','£470','€470','$470/month','$470.00','$-470','$01','$0 (suppressed)','$9007199254740992']) {
    assert.throws(()=>parse(fixtures[avondale].replace('<td>$470</td>',`<td>${token}</td>`)),SourceError,token);
  }
  assert.throws(()=>parse(fixtures[avondale].replace('<td>$470</td>','<td>$510</td>')),/quartile/);
});

test('literal zero and correctly grouped integer currency stay numeric, including five-or-more categories',()=>{
  const zeroRow=firstRow.replace('<td>91</td>','<td>0</td>').replace(/\$\d+/g,'$0');
  const zeros=parse(fixtures[avondale].replace(firstRow,zeroRow)).rows[0];
  for(const key of Object.keys(NZ_RENT_STATISTICS))assert.equal(zeros[key],0);
  const largeRow=firstRow.replace('>91<','>1,234<').replace('$470','$1,470').replace('$490','$1,490').replace('$505','$1,505');
  const large=parse(fixtures[avondale].replace(firstRow,largeRow)).rows[0];
  assert.deepEqual([large.active_bonds,large.lower_quartile,large.median,large.upper_quartile],[1234,1470,1490,1505]);
  const fivePlus=parse().rows.find(r=>r.bedroom_key==='5-plus');
  assert.equal(fivePlus.bedrooms,'5+ bedrooms');
});

test('unexpected JSON and HTML entities are rejected rather than repaired',()=>{
  for(const value of ['', '<html>error</html>','{',{},null,{Table:fixtures[avondale]},{Finder:null,Table:fixtures[avondale]},{...payload(),other:1}]) {
    assert.throws(()=>parseNzRentPayload(value,avondale),SourceError);
  }
  assert.throws(()=>parse(fixtures[avondale].replace('Auckland','Auck&bogus;land')),SourceError);
  assert.throws(()=>parse(fixtures[avondale].replace('Auckland','Auck&#99999999;land')),SourceError);
  assert.equal(parse(fixtures[avondale].replace('$470','&#36;470')).rows[0].lower_quartile,470);
});

test('fetches use exactly two bounded concurrent public requests with qualified place selectors and raw acquisition evidence',async()=>{
  const calls=[];let inFlight=0,maxInFlight=0;
  const value=await readNzMarketRent({now:()=> '2026-10-20T07:05:07.000Z',fetcher:async(url,options)=>{
    calls.push({url,options});inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
    await new Promise(resolve=>setImmediate(resolve));inFlight--;return fetcher(url);
  }});
  assert.equal(maxInFlight,2);assert.equal(calls.length,2);
  for(const call of calls) {
    assert(ids.some(id=>NZ_RENT_LOCATIONS[id].source_url===call.url));
    assert.equal(call.options.headers.accept,'application/json');assert.equal(call.options.headers['X-Requested-With'],'XMLHttpRequest');
    assert.equal(call.options.headers.Referer,'https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/');
    assert(call.options.signal instanceof AbortSignal);
    assert.equal(call.options.headers.Cookie,undefined);
  }
  for(const record of value.provenance) {
    assert.equal(record.retrieved_at,'2026-10-20T07:05:07.000Z');
    assert.equal(record.bytes,Buffer.byteLength(body(record.location_id)));
    assert.equal(record.sha256,createHash('sha256').update(body(record.location_id)).digest('hex'));
  }
  assert(value.rows.every(r=>!Object.hasOwn(r,'retrieved_at')&&!Object.hasOwn(r,'sha256')));
});

test('one place failing preserves the other and unrelated successful desk sources',async()=>{
  const calls=[],badFetcher=async url=>{
    calls.push(url);
    if(url.includes('Avondale'))return new Response('Unavailable',{status:503});
    return fetcher(url);
  };
  const desk=await readSections({market_rent:()=>readNzMarketRent({fetcher:badFetcher}),other:async()=>({value:42})});
  const value=desk.market_rent;
  assert.equal(calls.length,2);assert.equal(value.status,'degraded');assert.equal(validateNzRentRepresentation(value),true);
  assert.equal(value.rows.length,16);assert(value.rows.every(r=>r.location_id===kelburn));
  assert.equal(value.locations[0].status,'error');assert.equal(value.locations[0].http_status,503);
  assert.equal(desk.sources.market_rent.status,'degraded');assert.equal(desk.sources.other.status,'ok');
  assert.equal(desk.other.value,42);
});

test('unknown marker fails its whole place and never falls back to the other geography',async()=>{
  const result=await readNzMarketRent({fetcher:async url=>url.includes('Avondale')?new Response(body(avondale,fixtures[avondale].replace('<td>91</td>','<td>..</td>'))):fetcher(url)});
  assert.equal(result.rows.length,16);assert.equal(result.locations[0].status,'error');assert.equal(result.locations[1].status,'ok');
  assert.equal(validateNzRentRepresentation(result),true);
});

test('mixed windows retain native diagnostics but cannot validate as one comparison source',async()=>{
  const result=await readNzMarketRent({fetcher:async url=>url.includes('Avondale')?new Response(body(avondale,fixtures[avondale].replace('01 Mar 2026 - 31 Aug 2026','01 Apr 2026 - 30 Sep 2026'))):fetcher(url)});
  assert.equal(result.status,'degraded');assert.equal(result.rows.length,29);
  assert.equal(result.metadata.window_consistent,false);assert.equal(result.metadata.period_start,null);
  assert.equal(validateNzRentRepresentation(result),false);
});

test('acquisition rejects future windows and invalid clocks without inventing a fixed publication lag',async()=>{
  const result=await readNzMarketRent({now:()=> '2026-07-31T07:00:00Z',fetcher});
  assert.equal(result.status,'error');assert.equal(result.rows.length,0);
  assert(result.locations.every(l=>l.error.includes('window ends after retrieval')));
  const exactEnd=await readNzMarketRent({now:()=> '2026-08-31T00:00:00.000Z',fetcher});
  assert.equal(validateNzRentRepresentation(exactEnd),true);
  for(const time of ['yesterday','2026-13-01T00:00:00Z','2026-02-31T00:00:00Z','2026-10-20T07:00:00+00:00',null]) {
    const value=await readNzMarketRent({now:()=>time,fetcher});
    assert.equal(value.status,'error');assert(value.locations.every(l=>l.error==='NZ market rent: Invalid retrieval clock'));
  }
});

test('native semantic validator detects tampering independently of counts and acquisition bytes',async()=>{
  const original=await native();
  const mutations=[
    v=>{v.rows[0].geography='New Zealand';},v=>{v.rows[0].city='Wellington';},
    v=>{v.rows[0].bedrooms='5 bedrooms';},v=>{v.rows[0].unit='NZD per month';},
    v=>{v.rows[0].period='2026-08';},v=>{v.rows[0].active_bonds=null;},
    v=>{v.rows[0].median=100;},v=>{v.rows[0].source_url=NZ_RENT_LOCATIONS[kelburn].source_url;},
    v=>{v.rows[1]={...v.rows[0]};},v=>{v.rows.pop();},
    v=>{v.locations[0].table_counts.apartment=4;},v=>{v.metadata.count=28;},
    v=>{v.definition.rent_unit='NZD per month';},v=>{v.definition.population='All current tenancies';},
    v=>{v.published_at='2026-10-20T07:05:07Z';},v=>{v.licence='unknown';},
  ];
  for(const mutate of mutations){const value=structuredClone(original);mutate(value);assert.equal(validateNzRentRepresentation(value),false);}
  const changed=structuredClone(original);changed.rows[0].median++;
  assert.equal(validateNzRentRepresentation(changed),true,'A valid publisher revision must be retained, not compared to hardcoded values');
});

test('bad statuses, byte bounds, malformed JSON, invalid UTF-8 and redirected selectors fail closed',async()=>{
  const cases=[
    ()=>new Response('unavailable',{status:429}),
    ()=>new Response('{}',{headers:{'content-length':'131073'}}),
    ()=>new Response(' '.repeat(131073)),
    ()=>new Response('{}',{headers:{'content-length':'bogus'}}),
    ()=>new Response('<html>Not JSON</html>'),
    ()=>new Response(new Uint8Array([0xff,0xfe,0xfd])),
    ()=>{const r=new Response(body());Object.defineProperty(r,'url',{value:NZ_RENT_LOCATIONS[avondale].source_url.replace('Avondale','Kelburn')});return r;},
  ];
  for(const make of cases) {
    const result=await readNzMarketRent({fetcher:async()=>make()});
    assert.equal(result.status,'error');assert.equal(result.rows.length,0);
    assert.equal(result.locations.length,2);assert(result.locations.every(l=>l.status==='error'));
    assert.equal(validateNzRentRepresentation(result),false);
  }
});

test('abort timeout is isolated and completes without stale specimen substitution',async()=>{
  const result=await readNzMarketRent({timeoutMs:5,fetcher:(url,{signal})=>new Promise((resolve,reject)=>{
    // Timer keeps the test event loop alive; native fetch owns its I/O lifetime.
    const timer=setTimeout(()=>reject(new Error('Abort did not fire')),100);
    signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
  })});
  assert.equal(result.status,'error');assert.equal(result.rows.length,0);
  assert(result.locations.every(l=>l.error==='Source request timed out'));
  await assert.rejects(()=>readNzMarketRent({timeoutMs:20001}),SourceError);
});
