import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {openWorkbook} from '../lib/workbook.js';
import {CQC_COHORT_CONTRACT as contract,CQC_COHORT_MAX_BYTES,parseCqcCohort,readCqcCohort,validateCqcCohort,cqcCohortDefinitions,cqcCohortRows} from '../lib/cqc-cohort.js';

const original=new Uint8Array(await readFile(new URL('../verification/remaining-gaps-2026-10-20/prior-audit/cqc/original/ratings.xlsx',import.meta.url)));
const originalHash='8b8e87e34b48c8f9e171180afbd41d3abf5db7d5c0ca176eba5a8cc510902523';
const at='2026-10-20T10:00:00.000Z';
const fixture=()=>openWorkbook(original);
const parse=()=>parseCqcCohort(fixture());
function changed(sheetName,change) {
  const book=fixture(),overrides=new Map();
  return {sheet(name) {
    if(!overrides.has(name)){const cells=new Map(book.sheet(name));if(name===sheetName)change(cells);overrides.set(name,cells);}
    return overrides.get(name);
  }};
}
const provenance=()=>[{url:contract.source_url,retrieved_at:at,bytes:original.length,sha256:originalHash}];
const response=(bytes=original,options={})=>new Response(bytes,{status:200,...options});
const read=fetcher=>readCqcCohort({fetcher,now:()=>at});

test('CQC original five-count snapshot matches separate original reference and retains cohort meaning',()=>{
  assert.equal(createHash('sha256').update(original).digest('hex'),originalHash);
  const value=parse();
  assert.deepEqual(value.rows.map(row=>[row.measure,row.value]),[['inadequate',125],['requires_improvement',809],['good',2063],['outstanding',65],['total',3062]]);
  assert.equal(value.period,'2025-08-01');assert.equal(value.publication_date,'2025-10-24');
  assert.equal(value.unit,'ratings');assert.match(value.assessment_unit,/not unique locations/);
  assert.match(value.limitations,/risk/);assert.match(value.limitations,/previous-framework location ratings/);
  assert.match(value.period_convention,/not a current whole-England/);
  assert.equal(validateCqcCohort(value,{retrieved_at:at}),true);
  assert.ok(Object.isFrozen(contract));assert.ok(Object.isFrozen(contract.measures[0]));
});

for(const [name,sheet,cell,value] of [
  ['different snapshot','Guidance','A1','Ratings data for August 2026'],
  ['old edition','Guidance','A9','State of Care 2023/24 can be found on the CQC website and a link is provided below:'],
  ['wrong table-of-contents edition','Table_of_contents','A1','Data sheets for State of Care 2025/2026 ratings appendix, table of contents'],
  ['wrong worksheet identity','Table_of_contents','A3',3],
  ['string worksheet number','Table_of_contents','A3','1'],
  ['wrong contents cohort','Table_of_contents','B3','Worksheet 1: GP services, overall ratings, August 2025'],
  ['wrong target cohort','1','A1','Worksheet 1: GP services, overall ratings, August 2025'],
  ['old publication','1','A4','Date report published: 25 October 2024'],
  ['wrong publisher','1','A3','Source: provider records'],
  ['multiple tables','1','A2','This worksheet contains two tables.'],
  ['wrong rating header','1','A6','Region'],
  ['percent substituted for count','1','B6','Percentage'],
  ['missing percentage context','1','C6',null],
  ['wrong category','1','A7','Unrated'],
  ['duplicate category','1','A8','Inadequate'],
  ['missing category','1','A9',null],
  ['wrong total label','1','A11','All England services'],
  ['missing value','1','B7',null],
  ['text number','1','B7','125'],
  ['suppressed cell','1','B7','[c]'],
  ['boolean count','1','B7',true],
  ['fractional count','1','B7',125.5],
  ['negative count','1','B7',-1],
  ['NaN count','1','B7',NaN],
  ['infinite count','1','B7',Infinity],
  ['unsafe count','1','B7',Number.MAX_SAFE_INTEGER+1],
  ['broken total','1','B11',3063],
])test('CQC rejects '+name,()=>assert.throws(()=>parseCqcCohort(changed(sheet,cells=>cells.set(cell,value)))));

for(const [name,from,to] of [
  ['framework','single assessment framework','previous assessment framework'],
  ['guidance snapshot','1 August 2025','1 August 2024'],
  ['risk qualification','assessment activity during this time has been based on risk','assessment activity represents a census'],
  ['representativeness','unlikely to be representative of all services in a sector','representative of all services in a sector'],
  ['comparability','not directly comparable to previous years','directly comparable to previous years'],
  ['rating-level warning','differences in the levels at which we rate providers','no differences in assessments'],
])test('CQC refuses changed '+name,()=>assert.throws(()=>parseCqcCohort(changed('Guidance',cells=>cells.set('A5',cells.get('A5').replaceAll(from,to))))));

test('CQC refuses reordered categories even when values move with labels',()=>{
  const value=changed('1',cells=>{const a=cells.get('A7'),b=cells.get('B7');cells.set('A7',cells.get('A8'));cells.set('B7',cells.get('B8'));cells.set('A8',a);cells.set('B8',b);});
  assert.throws(()=>parseCqcCohort(value));
});
test('CQC refuses an extra rating row',()=>assert.throws(()=>parseCqcCohort(changed('1',cells=>{cells.set('A12','Unrated');cells.set('B12',1);}))));
test('CQC refuses an absent worksheet',()=>assert.throws(()=>parseCqcCohort({sheet(){throw Error('missing');}})));
test('CQC preserves a genuine zero and coherent publisher revisions without hardcoding specimen values',()=>{
  const value=parseCqcCohort(changed('1',cells=>{cells.set('B7',0);cells.set('B11',2937);}));
  assert.equal(value.rows[0].value,0);assert.equal(value.rows[4].value,2937);
  assert.equal(validateCqcCohort(value),true);
  assert.match(value.revision_policy,/new independent verification/);
  assert.notDeepEqual(value.rows.map(row=>row.value),[125,809,2063,65,3062]);
});
test('CQC rejects category sum above safe integer range',()=>assert.throws(()=>parseCqcCohort(changed('1',cells=>{for(let i=7;i<=11;i++)cells.set('B'+i,Number.MAX_SAFE_INTEGER);}))));
test('CQC tolerates only whitespace differences in labels',()=>{
  assert.equal(parseCqcCohort(changed('1',cells=>cells.set('A1','  Worksheet 1: Adult Social Care, overall ratings,\nAugust 2025 '))).rows.length,5);
});

for(const [name,mutate] of [
  ['wrong public period',x=>x.period='2025-08-02'],
  ['wrong publication date',x=>x.publication_date='2026-10-24'],
  ['wrong geography',x=>x.geography='United Kingdom'],
  ['wrong unit',x=>x.unit='services'],
  ['wrong observation kind',x=>x.kind='projection'],
  ['whole-population substitution',x=>x.population='All England adult social care services'],
  ['location substitution',x=>x.assessment_unit='Locations'],
  ['wrong framework',x=>x.framework='Previous framework'],
  ['missing limitations',x=>delete x.limitations],
  ['missing revision caveat',x=>delete x.revision_policy],
  ['missing source attribution',x=>delete x.publisher],
  ['additional misleading field',x=>x.england_quality_rate=90],
  ['missing row',x=>x.rows.pop()],
  ['duplicate public row',x=>x.rows[1]=structuredClone(x.rows[0])],
  ['reordered public rows',x=>x.rows.reverse()],
  ['public null value',x=>x.rows[0].value=null],
  ['public suppression',x=>x.rows[0].value_state='suppressed'],
  ['public row unit',x=>x.rows[0].unit='percent'],
  ['public row period',x=>x.rows[0].period='2026-08-01'],
  ['public row extra field',x=>x.rows[0].percentage=4.08],
  ['public total mismatch',x=>x.rows.at(-1).value++],
])test('CQC validator rejects '+name,()=>{
  const value=parse();mutate(value);assert.equal(validateCqcCohort(value,{retrieved_at:at}),false);
});

test('CQC validates bounded provenance separately from statistical content',()=>{
  const value=parseCqcCohort(fixture(),{now:at,provenance:provenance()});
  assert.equal(validateCqcCohort(value,at),true);
  const later=structuredClone(value);later.provenance[0].retrieved_at='2026-10-20T11:00:00.000Z';
  assert.equal(validateCqcCohort(later,at),false);
  assert.equal(validateCqcCohort(later,'2026-10-20T12:00:00Z'),true);
  assert.deepEqual(later.rows,value.rows);
});
for(const [name,mutate] of [
  ['wrong acquisition URL',p=>p[0].url='https://example.org/ratings.xlsx'],
  ['excessive acquisition size',p=>p[0].bytes=CQC_COHORT_MAX_BYTES+1],
  ['empty acquisition size',p=>p[0].bytes=0],
  ['fractional acquisition size',p=>p[0].bytes=1.5],
  ['bad hash',p=>p[0].sha256='not-a-hash'],
  ['prepublication provenance',p=>p[0].retrieved_at='2025-10-23T23:59:59Z'],
  ['future provenance',p=>p[0].retrieved_at='2027-01-01T00:00:00Z'],
  ['extra provenance field',p=>p[0].token='not permitted'],
  ['duplicate acquisitions',p=>p.push({...p[0]})],
])test('CQC rejects '+name,()=>{
  const p=provenance();mutate(p);
  assert.throws(()=>parseCqcCohort(fixture(),{now:at,provenance:p}));
  const value=parse();value.provenance=p;assert.equal(validateCqcCohort(value,at),false);
});
for(const at of ['2025-10-23T23:59:59Z','2026-02-30T00:00:00Z','2026-10-20','invalid',null])test('CQC rejects invalid/prepublication clock '+String(at),()=>{
  assert.throws(()=>parseCqcCohort(fixture(),{now:at}));
  assert.equal(validateCqcCohort(parse(),at),false);
});

test('CQC reader acquires exactly one fixed original and hashes its bytes',async()=>{
  const calls=[];
  const value=await read(async(url,options)=>{calls.push({url,options});return response(original,{headers:{'content-length':String(original.length)}});});
  assert.equal(calls.length,1);assert.equal(calls[0].url,contract.source_url);
  assert.equal(calls[0].options.redirect,'manual');assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.deepEqual(value.rows,parse().rows);
  assert.deepEqual(value.provenance,provenance());assert.equal(validateCqcCohort(value,at),true);
});
test('CQC reader refuses HTTP failure without any fallback',async()=>{
  let calls=0;await assert.rejects(read(async()=>{calls++;return new Response('Unavailable',{status:503});}),/HTTP 503/);assert.equal(calls,1);
});
test('CQC reader refuses an HTTP redirect without following it',async()=>{
  await assert.rejects(read(async()=>new Response(null,{status:302,headers:{location:'https://example.org/ratings.xlsx'}})),/HTTP 302/);
});
test('CQC reader refuses unexpected final URL',async()=>{
  await assert.rejects(read(async()=>{const r=response();Object.defineProperty(r,'url',{value:'https://example.org/ratings.xlsx'});return r;}),/redirect/);
});
test('CQC reader refuses missing body',async()=>await assert.rejects(read(async()=>new Response(null)),/Missing workbook body/));
test('CQC reader refuses empty body',async()=>await assert.rejects(read(async()=>response(new Uint8Array())),/Empty workbook/));
for(const length of [String(CQC_COHORT_MAX_BYTES+1),'0','-1','100.5','invalid'])test('CQC reader refuses declared content-length '+length,async()=>{
  await assert.rejects(read(async()=>response(original,{headers:{'content-length':length}})),/workbook size/);
});
test('CQC reader refuses excessive streamed bytes despite no length header',async()=>{
  await assert.rejects(read(async()=>response(new Uint8Array(CQC_COHORT_MAX_BYTES+1))),/download limit/);
});
test('CQC reader refuses corrupt archive',async()=>await assert.rejects(read(async()=>response(new TextEncoder().encode('not a workbook')))));
test('CQC reader respects workbook expanded-data bound',async()=>{
  const bomb=zipSync({'xl/workbook.xml':strToU8('x'.repeat(4194305))},{level:9});
  assert.ok(bomb.length<CQC_COHORT_MAX_BYTES);
  await assert.rejects(read(async()=>response(bomb)),/expanded data exceeds limit/);
});
test('CQC reader preserves timeout/transport failure to caller isolation',async()=>{
  await assert.rejects(read(async()=>{throw new DOMException('timed out','TimeoutError');}),error=>error.name==='TimeoutError');
});
test('CQC reader refuses prepublication clock before fetching',async()=>{
  let calls=0;await assert.rejects(readCqcCohort({fetcher:async()=>{calls++;return response();},now:()=>'2025-01-01T00:00:00Z'}));assert.equal(calls,0);
});
test('CQC reader refuses backwards acquisition clock',async()=>{
  const times=[at,'2026-10-20T09:59:59Z'];
  await assert.rejects(readCqcCohort({fetcher:async()=>response(),now:()=>times.shift()}),/backwards/);
});
test('CQC typed definitions and rows retain all five exact identities and cohort dimensions',()=>{
  const value=parse(),definitions=cqcCohortDefinitions(),rows=cqcCohortRows(value);
  assert.equal(definitions.length,5);assert.equal(rows.length,5);
  assert.deepEqual(definitions.map(d=>d.id),['inadequate','requires_improvement','good','outstanding','total']);
  for(const [i,row] of rows.entries()) {
    assert.equal(row.measure_id,definitions[i].id);
    assert.equal(row.value,value.rows[i].value);assert.equal(row.value_state,'observed');
    assert.equal(row.period,'2025-08-01');assert.equal(row.publication_date,'2025-10-24');
    assert.deepEqual(row.dimensions,definitions[i].dimensions);
    assert.equal(row.dimensions.assessment_unit,'Individual service at a location');
    assert.equal(row.population,contract.population);assert.equal(row.geography,'England');
    assert.equal(row.unit,'ratings');assert.match(definitions[i].limitations,/not be combined/);
  }
  rows[0].dimensions.rating='changed';
  assert.equal(cqcCohortDefinitions()[0].dimensions.rating,'Inadequate');
});
for(const value of [null,undefined,[],{},'invalid',{rows:null}])test('CQC malformed public shapes fail safely '+JSON.stringify(value),()=>{
  assert.equal(validateCqcCohort(value,{retrieved_at:at}),false);
  assert.throws(()=>cqcCohortRows(value));
});
