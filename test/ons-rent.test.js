import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ONS_RENT_DATA_URL,ONS_RENT_PUBLICATION_URL,ONS_RENT_LIMITS,ONS_RENT_DEFINITIONS,parseOnsRentPublication,parseOnsRent,readOnsRent,validateOnsRent} from '../lib/ons-rent.js';

const root=new URL('../verification/remaining-gaps-2026-10-20/ons-rent/',import.meta.url);
const fixture=JSON.parse(fs.readFileSync(new URL('original/presentation-excerpt.json',root)));
const publication=fs.readFileSync(new URL('original/publication-excerpt.html',root),'utf8');
const original=JSON.parse(fs.readFileSync(new URL('../prior-audit/ons-rent/selected-workbook.json',root)));
const clone=()=>structuredClone(fixture);
const anchor=()=>parseOnsRentPublication(publication);
const hash=text=>createHash('sha256').update(text).digest('hex');
function native() {
  return {...parseOnsRent(clone(),anchor()),provenance:[
    {kind:'publisher_local_presentation',url:ONS_RENT_DATA_URL,sha256:hash(JSON.stringify(fixture)),bytes:Buffer.byteLength(JSON.stringify(fixture)),retrieved_at:'2026-10-20T09:57:30.394Z'},
    {kind:'publisher_publication_index',url:ONS_RENT_PUBLICATION_URL,sha256:hash(publication),bytes:Buffer.byteLength(publication),retrieved_at:'2026-10-20T09:57:30.395Z'},
  ]};
}

test('four independently extracted workbook values match the exact current JSON bedroom categories',()=>{
  const value=native();
  assert.equal(validateOnsRent(value),true);
  const keys=['one_bedroom','two_bedrooms','three_bedrooms','four_or_more_bedrooms'];
  assert.deepEqual(value.rows.map(r=>r.value),keys.map(k=>original.cells[k].value));
  assert.deepEqual(value.rows.map(r=>r.period),Array(4).fill(original.period));
  assert.equal(value.release_date,original.release_date);
  assert.equal(value.rows[3].bedrooms,'4-plus');
  assert.equal(value.published_at,null);
  assert.match(value.aggregation,/Three-month moving average/);
  assert.equal(value.definitions.length,4);
  assert.ok(value.definitions.every(d=>d.dimensions.property_type==='all'));
  assert.equal(value.rows.some(r=>r.value===original.cells.flats_all_bedrooms_control.value),false);
});

const inputMutations=[
  ['wrong local area',d=>{d.place.areacd='E08000025';}],
  ['same name, wrong area code',d=>{d.place.areacd='E08000002';}],
  ['regional substitution',d=>{d.place={...d.place,...d.region};}],
  ['wrong national parent',d=>{d.region.parentcd='W92000004';}],
  ['stale release',d=>{d.sections[0].lastUpdated='2026-08-19';}],
  ['legacy releaseDate cannot override current lastUpdated',d=>{d.sections[0].lastUpdated=undefined;d.sections[0].releaseDate='20260916';}],
  ['duplicate metadata',d=>{d.sections.push(structuredClone(d.sections[0]));}],
  ['wrong header',d=>{d.sections[1].title='Housing prices in Salford';}],
  ['changed adjustment',d=>{d.sections[2].content='<p>Seasonally adjusted.</p>';}],
  ['weekly rents substituted',d=>{const s=d.sections.find(s=>s.id==='rent_price');s.content=s.content.replace('monthly','weekly');}],
  ['newer partial release',d=>{d.place['rental_price_2026-09']=1400;}],
  ['latest category missing',d=>{delete d.place['rental_price_two_bed_2026-08'];}],
  ['all latest values deleted cannot fall back',d=>{for(const k of Object.keys(d.place))if(k.endsWith('2026-08'))delete d.place[k];}],
  ['property type value substituted',d=>{d.place['rental_price_two_bed_2026-08']=1147;}],
  ['string number',d=>{d.place['rental_price_one_bed_2026-08']='1003';}],
  ['null',d=>{d.place['rental_price_one_bed_2026-08']=null;}],
  ['unavailable marker',d=>{d.place['rental_price_one_bed_2026-08']='[x]';}],
  ['not applicable marker',d=>{d.place['rental_price_one_bed_2026-08']='[z]';}],
  ['negative rent',d=>{d.place['rental_price_one_bed_2026-08']=-1003;}],
  ['fractional rent',d=>{d.place['rental_price_one_bed_2026-08']=1003.5;}],
  ['duplicate narrative',d=>{d.sections.push(structuredClone(d.sections.at(-1)));}],
  ['wrong narrative month',d=>{d.sections.at(-1).content=d.sections.at(-1).content.replace('August 2026','July 2026');}],
  ['wrong narrative geography',d=>{d.sections.at(-1).content=d.sections.at(-1).content.replace('in Manchester were:','in Salford were:');}],
  ['duplicate category',d=>{d.sections.at(-1).content=d.sections.at(-1).content.replace('Two bedrooms:','One bedroom:');}],
  ['three versus four-plus conflation',d=>{d.sections.at(-1).content=d.sections.at(-1).content.replace('Four or more bedrooms:','Four bedrooms:');}],
  ['conflicting current structured and narrative values',d=>{d.sections.at(-1).content=d.sections.at(-1).content.replace('£1,003','£1,004');}],
];
for(const [label,mutate] of inputMutations)test('reject '+label,()=>{
  const d=clone();mutate(d);assert.throws(()=>parseOnsRent(d,anchor()),/ONS Manchester rent/);
});

test('publication index requires current dated link, agreeing metadata and valid next release',()=>{
  for(const changed of [
    publication.replace('16 September 2026','15 September 2026'),
    publication.replace('/16september2026/','/19august2026/'),
    publication.replace('2026-09-16T00:00:00Z','2026-08-19T00:00:00Z'),
    publication.replace('21 October 2026','31 February 2026'),
    publication.replace('21 October 2026','15 September 2026'),
    publication+publication,
  ])assert.throws(()=>parseOnsRentPublication(changed),/ONS Manchester rent/);
});

test('whole-source validation rejects semantic, count, identity and provenance corruption',()=>{
  for(const mutate of [
    v=>{v.rows.pop();},v=>{v.rows[1]=v.rows[0];},v=>{v.rows[0].unit='GBP per week';},
    v=>{v.rows[0].definition={...v.rows[0].definition,aggregation:'Raw monthly mean'};},
    v=>{v.rows[0].geography='England';},v=>{v.rows[0].value=null;},v=>{v.rows[0].value=NaN;},
    v=>{v.rows[0].value_state='suppressed';},v=>{v.rows[0].period='2026-07';},
    v=>{v.metadata.latest_period='2026-07';},v=>{v.metadata.workbook_url='https://example.com/data.xlsx';},
    v=>{v.provenance[0].bytes=ONS_RENT_LIMITS.data_bytes+1;},v=>{v.provenance[1].url=ONS_RENT_DATA_URL;},
    v=>{v.provenance[0].sha256='invalid';},v=>{v.published_at='2026-09-16T00:00:00Z';},
    v=>{v.definitions[0]={...ONS_RENT_DEFINITIONS[0],dimensions:{geography:'E08000003',bedrooms:'1',property_type:'flat'}};},
  ]){const v=structuredClone(native());mutate(v);assert.equal(validateOnsRent(v),false);}
  assert.equal(validateOnsRent(native(),{retrieved_at:'2026-09-15T23:59:59Z'}),false);
  for(const acquisition of [undefined,null,{},[],{retrieved_at:undefined},{retrieved_at:'invalid'},{retrieved_at:'2026-02-30T00:00:00Z'}])assert.equal(validateOnsRent(native(),acquisition),false);
  for(const value of [undefined,null,{},[],{rows:[null]}])assert.equal(validateOnsRent(value,{retrieved_at:'2026-10-20T10:00:00Z'}),false);
  assert.equal(validateOnsRent(native(),{retrieved_at:'2026-10-20T10:00:00Z'}),true);
});

test('bounded reader performs two original requests and preserves original response bytes/digests',async()=>{
  const previous=globalThis.fetch,calls=[];
  try {
    globalThis.fetch=async(url,options)=>{
      calls.push([url,options]);
      return new Response(url===ONS_RENT_DATA_URL?JSON.stringify(fixture):publication,{headers:{'content-type':url===ONS_RENT_DATA_URL?'application/json':'text/html'}});
    };
    const value=await readOnsRent();
    assert.equal(validateOnsRent(value),true);
    assert.deepEqual(calls.map(x=>x[0]).sort(),[ONS_RENT_DATA_URL,ONS_RENT_PUBLICATION_URL].sort());
    assert.equal(value.provenance[0].sha256,hash(JSON.stringify(fixture)));
    assert.equal(value.provenance[0].bytes,Buffer.byteLength(JSON.stringify(fixture)));
  } finally {globalThis.fetch=previous;}
});

test('explicit completed acquisition refuses provenance from its future',()=>{
  const value=native(),at=value.provenance[1].retrieved_at;
  assert.equal(validateOnsRent(value,{retrieved_at:at}),true);
  const earlier=new Date(Date.parse(at)-1).toISOString();
  assert.equal(validateOnsRent(value,{retrieved_at:earlier}),false);
  value.provenance[0].retrieved_at='2026-10-21T00:00:00Z';
  assert.equal(validateOnsRent(value,{retrieved_at:'2026-10-20T10:00:00Z'}),false);
});

test('bounded reader refuses HTTP/outage, false content type, oversized body and malformed UTF-8',async()=>{
  const previous=globalThis.fetch;
  try {
    for(const response of [
      ()=>new Response('unavailable',{status:503}),
      ()=>new Response('<html>outage</html>',{headers:{'content-type':'text/html'}}),
      ()=>new Response('x',{headers:{'content-type':'application/json','content-length':String(ONS_RENT_LIMITS.data_bytes+1)}}),
      ()=>new Response('x'.repeat(ONS_RENT_LIMITS.data_bytes+1),{headers:{'content-type':'application/json'}}),
      ()=>new Response(new Uint8Array([0xc3,0x28]),{headers:{'content-type':'application/json'}}),
      ()=>new Response('{"truncated"',{headers:{'content-type':'application/json'}}),
    ]) {
      globalThis.fetch=async url=>url===ONS_RENT_DATA_URL?response():new Response(publication,{headers:{'content-type':'text/html'}});
      await assert.rejects(readOnsRent());
    }
  } finally {globalThis.fetch=previous;}
});
