import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {zipSync, unzipSync, strToU8} from 'fflate';
import {openWorkbook} from '../lib/workbook.js';
import {SourceError} from '../lib/sources.js';
import {SFC_ACTIVITY_CONTRACT as C,parseSfcActivity,validateSfcActivity,readSfcActivity,sfcActivityDefinitions,sfcActivityRows} from '../lib/sfc-activity.js';

const bytes=new Uint8Array(readFileSync(new URL('../verification/remaining-gaps-2026-10-20/prior-audit/sfc/original/tables.xlsx',import.meta.url)));
const independent=JSON.parse(readFileSync(new URL('../verification/remaining-gaps-2026-10-20/prior-audit/sfc/selected-comparison.json',import.meta.url),'utf8'));
const now='2026-10-20T10:00:00.000Z';
const expected=[39655,47405,4595,24400,116055];
const digest='f4816a63e4ab246799f4cbb6075d3feba78ada67670e34d71e5900826c3b5979';
function workbook(edits=[]){
  const original=openWorkbook(bytes);
  return {sheet(name){
    const result=new Map(original.sheet(name));
    for(const [sheet,cell,value] of edits)if(sheet===name)value===undefined?result.delete(cell):result.set(cell,value);
    return result;
  }};
}
const native=()=>parseSfcActivity(workbook(),{now});
const clone=value=>structuredClone(value);
const provenance=()=>({role:'workbook',url:C.source_url,bytes:bytes.length,sha256:digest,retrieved_at:now});
const fetched=(body=bytes,init={})=>new Response(body,init);

test('SFC original five FTE cells match separate XML/Parliament evidence exactly',()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),digest);
  assert.equal(independent.pass,true);
  assert.equal(independent.independently_presented_official_table_matches,5);
  const actual=native();
  assert.deepEqual(actual.rows.map(r=>r.value),expected);
  assert.deepEqual(actual.rows.map(r=>r.value),Object.values(independent.values_by_cell));
  assert.equal(actual.rows.length,5);
  assert.equal(actual.unit,'full-time equivalents');
  assert.equal(actual.geography,'Scotland');
  assert.equal(actual.period,'2024-25');
  assert.equal(actual.publication_date,'2026-02-04');
  assert.match(actual.population,/not Scottish-domiciled residents/);
  assert.match(actual.limitations,/total overlaps/);
  assert.equal(validateSfcActivity(actual,now),true);
  assert.equal(Object.isFrozen(C),true);
  assert.equal(Object.isFrozen(C.measures),true);
  assert.equal(C.measures.every(Object.isFrozen),true);
});

test('SFC typed helpers retain all-funding college FTE semantics and reject invalid native data',()=>{
  const definitions=sfcActivityDefinitions(),actual=native(),rows=sfcActivityRows(actual);
  assert.equal(definitions.length,5);
  assert.deepEqual(definitions.map(d=>d.id),rows.map(r=>r.measure_id));
  assert.equal(new Set(rows.map(r=>`${r.measure_id}:${r.period}`)).size,5);
  assert.deepEqual(rows.map(r=>r.value),expected);
  for(const definition of definitions){
    for(const field of ['id','name','geography','population','unit','kind','cadence','dimensions','publisher','licence','licence_url','source_url','period_convention','adjustment','limitations'])assert.ok(definition[field],field);
    assert.equal(definition.dimensions.funding,'all funding sources');
    assert.equal(definition.geography,'Scotland');
    assert.equal(definition.unit,'full-time equivalents');
    assert.equal(definition.kind,'observation');
    assert.match(definition.population,/not Scottish-domiciled/);
    assert.match(definition.limitations,/not people/);
  }
  assert.equal(definitions[0].dimensions.mode,'part-time');
  assert.equal(definitions[0].dimensions.level,'further education');
  assert.equal(definitions[4].dimensions.mode,'all');
  assert.equal(rows.every(r=>r.value_state==='observed'&&r.period==='2024-25'),true);
  rows[0].value=0;definitions[0].dimensions.funding='SFC only';
  assert.equal(actual.rows[0].value,39655);
  assert.equal(sfcActivityDefinitions()[0].dimensions.funding,'all funding sources');
  for(const malformed of [null,{},[],{...actual,unit:'students'}])assert.throws(()=>sfcActivityRows(malformed),SourceError);
});

test('SFC exact source identity refuses plausible wrong geography, unit, year, population and columns',()=>{
  const mutations=[
    ['Table 1','B2','How has student headcount changed?'],
    ['Table 1','B3','Scottish-domiciled students only'],
    ['Table 1','G5','Students'],
    ['Table 1','B6','Calendar Year'],
    ['Table 1','C6','Full-time FE'],
    ['Table 1','D6',undefined],
    ['Table 1','E6','Part-time FE'],
    ['Table 1','B7','2016-17'],
    ['Table 1','B11',undefined],
    ['Table 1','B16','2025-26'],
    ['Table 1','B17','2025-26'],
    ['Table 14','B2','Credit Performance Against Activity Targets in England’s Colleges from 2020-21 to 2024-25'],
    ['Table 3','B2','Count of students, calendar year'],
    ['Table 3','B3','SFC funded provision only'],
    ['Table 3','C5','FTEs'],
    ['Table 3','D5','FTEs'],
    ['Table 3','E5','Students'],
    ['Table 3','B15','2023-24'],
    ['Table 3','E15',209285],
  ];
  for(const mutation of mutations)assert.throws(()=>parseSfcActivity(workbook([mutation]),{now}),SourceError,mutation.join(':'));
});

test('SFC blanks, suppressed and malformed cells never become a zero or an observation',()=>{
  for(const value of [undefined,null,'','*','..','39655',false,NaN,Infinity,-5,39655.5,39656,Number.MAX_SAFE_INTEGER+1]){
    assert.throws(()=>parseSfcActivity(workbook([['Table 1','C16',value]]),{now}),SourceError,String(value));
  }
});

test('SFC explicit zero and coherent same-edition corrections remain distinct from missingness',()=>{
  const zero=parseSfcActivity(workbook([
    ['Table 1','C16',0],['Table 1','G16',76400],['Table 3','E15',76400],
  ]),{now});
  assert.equal(zero.rows[0].value,0);
  assert.equal(zero.rows[0].value_state,'observed');
  assert.equal(validateSfcActivity(zero,now),true);
  const revised=parseSfcActivity(workbook([
    ['Table 1','C16',39660],['Table 1','G16',116060],['Table 3','E15',116060],
  ]),{now});
  assert.equal(validateSfcActivity(revised,now),true);
  assert.notDeepEqual(revised.rows,native().rows);
});

test('SFC permits independent rounding residual without replacing the publisher total',()=>{
  const accepted=parseSfcActivity(workbook([
    ['Table 1','G16',116045],['Table 3','E15',116045],
  ]),{now});
  assert.equal(accepted.rows.at(-1).value,116045);
  assert.equal(validateSfcActivity(accepted,now),true);
  assert.throws(()=>parseSfcActivity(workbook([
    ['Table 1','G16',116040],['Table 3','E15',116040],
  ]),{now}),/rounding tolerance/);
});

test('SFC native validator refuses altered interpretation, duplicate measures and silent additions',()=>{
  const edits=[
    x=>{x.geography='United Kingdom';},
    x=>{x.unit='students';},
    x=>{x.period='2025';},
    x=>{x.population='All people living in Scotland';},
    x=>{x.publication_date='2026-10-20';},
    x=>{x.licence='Open Government Licence';},
    x=>{x.rounding='unrounded';},
    x=>{x.limitations='';},
    x=>{x.status='degraded';},
    x=>{x.rows.reverse();},
    x=>{x.rows[0]=clone(x.rows[1]);},
    x=>{x.rows.pop();},
    x=>{x.rows[0].value_state='suppressed';},
    x=>{x.rows[0].value='39655';},
    x=>{x.rows[0].geography='England';},
    x=>{x.rows[0].period_start='2024-01-01';},
    x=>{x.rows[0].mode='full-time';},
    x=>{x.rows[0].level='higher education';},
    x=>{x.rows[0].rounding='nearest ten';},
    x=>{x.rows[0].unexpected=true;},
    x=>{x.current_release=true;},
    x=>{delete x.provenance;},
  ];
  for(const edit of edits){const changed=native();edit(changed);assert.equal(validateSfcActivity(changed,now),false,edit.toString());}
  for(const value of [null,{},[],{rows:null},'Scotland'])assert.equal(validateSfcActivity(value,now),false);
});

test('SFC acquisition and original identity are strict but equivalent UTC instants are accepted',()=>{
  const withProof=parseSfcActivity(workbook(),{now,provenance:[provenance()]});
  assert.equal(validateSfcActivity(withProof,{retrieved_at:now}),true);
  assert.equal(validateSfcActivity(withProof,'2026-10-20T10:00:00Z'),true);
  const mutations=[
    p=>{p.url='https://example.com/tables.xlsx';},
    p=>{p.role='summary';},
    p=>{p.bytes=0;},
    p=>{p.bytes=C.max_bytes+1;},
    p=>{p.sha256='not-a-hash';},
    p=>{p.retrieved_at='2026-02-03T23:59:59.000Z';},
    p=>{p.retrieved_at='2026-10-20T10:00:01.000Z';},
    p=>{p.token='not-a-supported-field';},
  ];
  for(const mutate of mutations){const changed=clone(withProof);mutate(changed.provenance[0]);assert.equal(validateSfcActivity(changed,now),false);}
  const duplicate=clone(withProof);duplicate.provenance.push(provenance());assert.equal(validateSfcActivity(duplicate,now),false);
  for(const invalid of ['2026-02-03T00:00:00Z','2026-02-30T00:00:00Z','2026-10-20','2026-10-20T10:00:00+00:00',null]){
    assert.throws(()=>parseSfcActivity(workbook(),{now:invalid}),SourceError);
    assert.equal(validateSfcActivity(native(),invalid),false);
  }
  assert.equal(validateSfcActivity(native(),'2026-02-04T00:00:00.000Z'),true);
});

test('SFC injected actual reader requests only the fixed workbook and retains exact bytes and time',async()=>{
  const calls=[];
  const actual=await readSfcActivity({fetcher:async(url,options)=>{calls.push({url,options});return fetched();},now:()=>now});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,C.source_url);
  assert.equal(calls[0].options.headers.accept,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(calls[0].options.redirect,'manual');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.deepEqual(actual.rows,native().rows);
  assert.deepEqual(actual.provenance,[provenance()]);
  assert.equal(validateSfcActivity(actual,now),true);
});

test('SFC acquisition metadata alone cannot alter the five observations',async()=>{
  const first=await readSfcActivity({fetcher:async()=>fetched(),now:()=>now});
  const later=await readSfcActivity({fetcher:async()=>fetched(),now:()=> '2026-10-21T10:00:00.000Z'});
  const {provenance:a,...firstMeaning}=first,{provenance:b,...laterMeaning}=later;
  assert.notDeepEqual(a,b);
  assert.deepEqual(firstMeaning,laterMeaning);
});

test('SFC HTTP, redirects and invalid clock fail without fallback or extra requests',async()=>{
  const cases=[
    ()=>fetched('Unavailable',{status:503}),
    ()=>fetched(null,{status:302,headers:{location:'https://example.com/moved.xlsx'}}),
    ()=>{const r=fetched();Object.defineProperty(r,'url',{value:'https://example.com/moved.xlsx'});return r;},
    ()=>fetched(null,{status:200}),
    ()=>fetched(new Uint8Array()),
    ()=>fetched('<html>Access denied</html>'),
  ];
  for(const response of cases){
    let count=0;
    await assert.rejects(()=>readSfcActivity({fetcher:async()=>{count++;return response();},now}),SourceError);
    assert.equal(count,1);
  }
  await assert.rejects(()=>readSfcActivity({fetcher:async()=>fetched(),now:'2025-01-01T00:00:00Z'}),/clock/);
  await assert.rejects(()=>readSfcActivity({fetcher:async()=>{throw new Error('transport unavailable');},now}),/transport unavailable/);
});

test('SFC wire budget is enforced for advertised and unadvertised oversized workbooks',async()=>{
  for(const length of [String(C.max_bytes+1),'-1','bad','1.5']){
    await assert.rejects(()=>readSfcActivity({fetcher:async()=>fetched(bytes,{headers:{'content-length':length}}),now}),/download limit/);
  }
  let cancelled=false;
  const stream=new ReadableStream({
    start(controller){controller.enqueue(new Uint8Array(C.max_bytes));controller.enqueue(new Uint8Array(1));},
    cancel(){cancelled=true;},
  });
  await assert.rejects(()=>readSfcActivity({fetcher:async()=>fetched(stream),now}),/download limit/);
  assert.equal(cancelled,true);
});

test('SFC compact malicious ZIP parts cannot bypass expanded XML, entity or relationship guards',async()=>{
  const inflate=unzipSync(bytes);
  const huge={...inflate,'xl/worksheets/sheet1.xml':strToU8(' '.repeat(4194305))};
  const tooBig=zipSync(huge,{level:9});
  assert.ok(tooBig.length<C.max_bytes);
  await assert.rejects(()=>readSfcActivity({fetcher:async()=>fetched(tooBig),now}),/expanded data exceeds limit/);
  const badXml={...inflate,'xl/workbook.xml':strToU8('<!DOCTYPE workbook [<!ENTITY x "bad">]><workbook>&x;</workbook>')};
  await assert.rejects(()=>readSfcActivity({fetcher:async()=>fetched(zipSync(badXml)),now}),/XML/);
  const badRel={...inflate,'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="rId1" Type="https://example.com/worksheet" Target="https://example.com/worksheet.xml" TargetMode="External"/></Relationships>')};
  await assert.rejects(()=>readSfcActivity({fetcher:async()=>fetched(zipSync(badRel)),now}),/relationship/);
});
