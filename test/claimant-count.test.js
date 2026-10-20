import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SourceError,readSections} from '../lib/sources.js';
import {
  CLAIMANT_DATASET,CLAIMANT_GEOGRAPHIES,CLAIMANT_TIME_URL,CLAIMANT_DATA_URL,
  claimantDefinition,claimantWindow,parseClaimantTime,parseClaimantCounts,
  validateClaimantRepresentation,readClaimantCount,
} from '../lib/claimant-count.js';

const directory=new URL('../verification/claimant-count-2026-10-20/original/',import.meta.url);
const csv=readFileSync(new URL('nomis-national.csv',directory),'utf8');
const timeText=readFileSync(new URL('nomis-time.json',directory),'utf8');
const timeJson=JSON.parse(timeText),time=parseClaimantTime(timeJson);
const officialJson=JSON.parse(readFileSync(new URL('nomis-national.excerpt.json',directory),'utf8'));
const fixture=()=>parseClaimantCounts(csv,time);
// Only the retained specimen is transformed here. Production uses its strict parser.
const lines=csv.trimEnd().split(/\r?\n/),columns=lines[0].split(',').map(x=>x.slice(1,-1));
const cells=line=>line.match(/"(?:[^"]|"")*"|[^,]+|(?<=,)(?=,|$)/g).map(x=>x.startsWith('"')?x.slice(1,-1).replaceAll('""','"'):x);
const encode=values=>values.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',');
function change(field,value,selected=1) {
  const rows=[...lines],row=cells(rows[selected]);row[columns.indexOf(field)]=value;rows[selected]=encode(row);return rows.join('\r\n')+'\r\n';
}
function newerTime() {
  const value=structuredClone(timeJson),list=value.structure.codelists.codelist[0],next=structuredClone(list.code.at(-1));
  next.value='2026-09';next.description.value='September 2026';
  for(const a of next.annotations.annotation) {
    if(a.annotationtitle==='taken on')a.annotationtext='2026-09-10';
    if(a.annotationtitle==='CurrentRevisionReleased')a.annotationtext='2026-10-20 07:00:00';
  }
  list.code.push(next);return value;
}
const fetcher=async url=>new Response(url===CLAIMANT_TIME_URL?timeText:csv);

test('claimant definition fixes the actual national geography, administrative population and count unit',()=>{
  assert.equal(Object.keys(CLAIMANT_GEOGRAPHIES).length,5);
  assert.deepEqual(Object.values(CLAIMANT_GEOGRAPHIES).map(g=>g.code),['K02000001','E92000001','S92000003','W92000004','N92000002']);
  for(const [desk,g] of Object.entries(CLAIMANT_GEOGRAPHIES)) {
    const d=claimantDefinition(desk);
    assert.equal(d.id,'claimants');assert.equal(d.geography,g.name);assert.equal(d.geography_code,g.code);
    assert.equal(d.unit,'persons');assert.equal(d.adjustment,'not seasonally adjusted');
    assert.equal(d.dimensions.dataset,'NM_162_1');assert.equal(d.dimensions.age,'0');assert.match(d.population,/16 and over/);
    assert.match(d.limitations,/not ILO unemployment/);assert.match(d.limitations,/Northern Ireland/);
  }
  assert.throws(()=>claimantDefinition('britain'),SourceError);
  assert.throws(()=>claimantDefinition('toString'),SourceError);
});

test('latest live publisher metadata anchors thirteen months and retains unzoned revisions',()=>{
  assert.equal(time.latest_period,'2026-08');assert.equal(time.first_period,'2025-08');
  assert.deepEqual(time.periods,claimantWindow('2026-08'));
  assert.equal(time.by_period['2026-08'].reference_date,'2026-08-13');
  assert.equal(time.by_period['2026-08'].release_timestamp_raw,'2026-09-15 07:00:00');
  assert.equal(time.by_period['2026-08'].release_timezone,null);
  assert.equal(time.by_period['2026-08'].revision_version,0);
  assert.equal(time.by_period['2026-07'].revision_version,1);
  assert.equal(time.publisher_prepared_raw,undefined);
  const pending=newerTime();
  pending.structure.codelists.codelist[0].code.at(-1).annotations.annotation.find(a=>a.annotationtitle==='CurrentRevisionStatus').annotationtext='Pending';
  assert.equal(parseClaimantTime(pending).latest_period,'2026-08','A pending scheduled month is not observed');
  assert.throws(()=>claimantWindow('2026-13'),SourceError);
});

test('all sixty-five independently acquired official JSON cells equal the CSV reader',()=>{
  const result=fixture();
  assert.equal(officialJson.obs.length,65);
  for(const [desk,value] of Object.entries(result)) {
    assert.equal(validateClaimantRepresentation(value,desk),true);
    assert.equal(value.rows.length,13);assert.equal(value.metadata.count,13);
    assert.equal(value.metadata.acquisition_record_count,65);
    assert.equal(value.rows[0].period,'2025-08');assert.equal(value.rows.at(-1).period,'2026-08');
    for(const row of value.rows) {
      const original=officialJson.obs.find(o=>o.geography.geogcode===row.geography_code&&o.time.value===row.period);
      assert(original);assert.equal(row.value,original.obs_value.value);
      assert.equal(original.unit.value,'PER');assert.equal(original.obs_round.value,5);
      assert.equal(original.obs_status.value,row.obs_status);assert.equal(original.obs_conf.value,row.obs_conf);
    }
  }
  assert.equal(result['northern-ireland'].rows.at(-1).value,34155);
});

test('wrong dimensions, population, geography, flags, record counts and malformed counts fail closed',()=>{
  const mutations=[
    ['GEOGRAPHY','K03000001'],['GEOGRAPHY_CODE','E92000001'],['GEOGRAPHY_NAME','Great Britain'],
    ['GEOGRAPHY_TYPE','local authorities'],['GEOGRAPHY_TYPECODE','480'],['GEOGRAPHY_SORTORDER','1'],
    ['GENDER','1'],['GENDER_NAME','Male'],['GENDER_CODE','1'],['GENDER_TYPE','Sexes'],
    ['AGE','1'],['AGE_NAME','All ages'],['AGE_CODE','1'],['AGE_TYPE','Age'],
    ['MEASURE','2'],['MEASURE_NAME','Claimant rate'],['MEASURE_CODE','2'],['MEASURES','20203'],
    ['MEASURES_NAME','Rate'],['OBS_STATUS','P'],['OBS_STATUS_NAME','Provisional'],
    ['OBS_CONF','C'],['OBS_CONF_NAME','Confidential'],['OBS_VALUE',''],['OBS_VALUE','-'],
    ['OBS_VALUE','0 (suppressed)'],['OBS_VALUE','-5'],['OBS_VALUE','1'],['OBS_VALUE','1.5'],
    ['OBS_VALUE','1,000'],['OBS_VALUE','1e5'],['OBS_VALUE','9007199254740995'],
    ['OBS_VALUE','NaN'],['RECORD_COUNT','64'],['RECORD_OFFSET','65'],
    ['URN','Nm-163d1d32408e1d2092957697d0d0d0d1d20100'],
    ['URN','Nm-162d1d32408e0d2092957697d0d0d0d1d20100'],
  ];
  for(const [field,value] of mutations)assert.throws(()=>parseClaimantCounts(change(field,value),time),SourceError,field+'='+value);
});

test('wrong month labels, stale releases, duplicate and partial cells never substitute',()=>{
  for(const [field,value] of [['DATE','2025-07'],['DATE_CODE','2025-07'],['DATE_NAME','July 2025'],['DATE_TYPE','annual'],['DATE_TYPECODE','1'],['DATE_SORTORDER','1']])assert.throws(()=>parseClaimantCounts(change(field,value),time),SourceError,field);
  assert.throws(()=>parseClaimantCounts(csv,parseClaimantTime(newerTime())),/Stale|substituted|month/);
  const duplicate=[...lines];duplicate[2]=duplicate[1];assert.throws(()=>parseClaimantCounts(duplicate.join('\n'),time),/Duplicate|duplicate/);
  assert.throws(()=>parseClaimantCounts(lines.slice(0,-1).join('\n'),time),/record count/);
  assert.throws(()=>parseClaimantCounts(csv+lines[1]+'\n',time),/record count/);
  assert.throws(()=>parseClaimantCounts(change('RECORD_OFFSET','0',2),time),/offset/);
});

test('swapped equally revised monthly URNs cannot contradict otherwise complete labels',()=>{
  const rows=[...lines],first=cells(rows[1]),second=cells(rows[6]),urn=columns.indexOf('URN');
  assert.equal(first[columns.indexOf('GEOGRAPHY')],second[columns.indexOf('GEOGRAPHY')]);
  assert(first[urn].includes('e1d')&&second[urn].includes('e1d'));
  [first[urn],second[urn]]=[second[urn],first[urn]];
  rows[1]=encode(first);rows[6]=encode(second);
  assert.throws(()=>parseClaimantCounts(rows.join('\r\n'),time),/month identity mismatch/);
});

test('malformed CSV headers, quoting, UTF field content and truncated records are rejected',()=>{
  const bad=[csv.replace('"DATE_NAME"','"OTHER"'),csv.replace('"DATE_NAME"','"DATE"'),csv.replace('"DATE"','"DATE'),csv.replace('"2025-08"','"2025-08"x'),csv.replace('"2025-08"','2025-"08'),lines[0]+'\n'+lines[1].slice(0,-4),csv.replace(',"DATE_NAME"',''),csv.replace('1663580','1663580\u0000'),csv.replace('\n','\n\n')];
  for(const text of bad)assert.throws(()=>parseClaimantCounts(text,time),SourceError);
});

test('invalid, incomplete or inconsistent authoritative metadata cannot approve values',()=>{
  const variants=[
    x=>x.structure.header.id='NM_1_1',
    x=>x.structure.codelists.codelist[0].id='CL_1_1_TIME',
    x=>x.structure.codelists.codelist[0].name.value='year',
    x=>x.structure.codelists.codelist[0].code.push(x.structure.codelists.codelist[0].code.at(-1)),
    x=>x.structure.codelists.codelist[0].code.at(-1).description.value='July 2026',
    x=>x.structure.codelists.codelist[0].code.at(-2).annotations.annotation.find(a=>a.annotationtitle==='CurrentRevisionStatus').annotationtext='Suppressed',
    x=>x.structure.codelists.codelist[0].code.at(-1).annotations.annotation.find(a=>a.annotationtitle==='taken on').annotationtext='2026-07-13',
    x=>x.structure.codelists.codelist[0].code.at(-1).annotations.annotation.find(a=>a.annotationtitle==='CurrentRevisionReleased').annotationtext='2026-09-15T07:00:00Z',
    x=>x.structure.codelists.codelist[0].code.at(-1).annotations.annotation.find(a=>a.annotationtitle==='CurrentRevisionVersion').annotationtext='0',
    x=>x.structure.codelists.codelist[0].code.at(-1).annotations.annotation.push({annotationtitle:'taken on',annotationtext:'2026-08-13'}),
  ];
  for(const mutate of variants){const value=structuredClone(timeJson);mutate(value);assert.throws(()=>parseClaimantTime(value),SourceError);}
});

test('real published zero and a rounded revision remain observed without changing other cells',()=>{
  const original=fixture(),zero=parseClaimantCounts(change('OBS_VALUE','0'),time);
  assert.equal(zero['united-kingdom'].rows[0].value,0);assert.equal(zero['united-kingdom'].rows[0].value_state,'observed');
  const revised=parseClaimantCounts(change('OBS_VALUE','1663585'),time);
  const differences=[];
  for(const desk of Object.keys(original))for(let i=0;i<13;i++)if(original[desk].rows[i].value!==revised[desk].rows[i].value)differences.push([desk,i]);
  assert.deepEqual(differences,[['united-kingdom',0]]);
});

test('native representation validation rejects drift after parsing and preserves exact definition',()=>{
  const original=fixture().wales;
  for(const mutate of [
    v=>v.rows.pop(),v=>v.rows[0].period='2025-07',v=>v.rows[0].geography='United Kingdom',
    v=>v.rows[0].geography_code='K02000001',v=>v.rows[0].unit='percent',v=>v.rows[0].value=null,
    v=>v.rows[0].value=-5,v=>v.rows[0].value=1,v=>v.rows[0].value_state='suppressed',
    v=>v.rows[0].obs_conf='C',v=>v.rows[0].obs_status='P',v=>v.rows[0].dimensions.age='1',
    v=>v.definition.population='All residents',v=>v.metadata.latest_period='2026-09',
    v=>v.metadata.reference_date='2026-08-12',v=>v.metadata.release_timezone='UTC',
    v=>v.rows[0].release_timezone='UTC',v=>v.published_at='2026-09-15T07:00:00Z',
    v=>v.metadata.count=12,v=>v.metadata.acquisition_record_count=64,
  ]){const value=structuredClone(original);mutate(value);assert.equal(validateClaimantRepresentation(value,'wales'),false);}
  assert.equal(validateClaimantRepresentation(original,'scotland'),false);
  assert.equal(validateClaimantRepresentation(null,'wales'),false);
});

test('actual reader uses two fixed bounded requests, keeps raw provenance and no generated clock',async()=>{
  const calls=[];const retrieved='2026-10-20T08:00:00.000Z';
  const result=await readClaimantCount('northern-ireland',{now:()=>retrieved,fetcher:async(url,options)=>{calls.push({url,options});return fetcher(url);}});
  assert.deepEqual(calls.map(c=>c.url),[CLAIMANT_TIME_URL,CLAIMANT_DATA_URL]);
  assert(calls.every(c=>c.options.signal instanceof AbortSignal));assert.equal(calls[0].options.signal,calls[1].options.signal);
  assert.equal(result.provenance.length,2);assert.equal(result.metadata.publisher_prepared_raw,undefined);
  assert.equal(result.metadata.release_timestamp_raw,'2026-09-15 07:00:00');
  assert.equal(result.publisher_updated_at,null);assert.equal(result.published_at,null);
  for(const [i,content] of [timeText,csv].entries()) {
    assert.equal(result.provenance[i].sha256,createHash('sha256').update(content).digest('hex'));
    assert.equal(result.provenance[i].bytes,Buffer.byteLength(content));assert.equal(result.provenance[i].retrieved_at,retrieved);
  }
  assert.equal(validateClaimantRepresentation(result,'northern-ireland'),true);
});

test('transport failures, oversize bodies, invalid UTF-8 and partial data remain source errors',async()=>{
  await assert.rejects(()=>readClaimantCount('wales',{fetcher:async()=>new Response('blocked',{status:429})}),e=>e instanceof SourceError&&e.status===429);
  await assert.rejects(()=>readClaimantCount('wales',{fetcher:async()=>new Response('x',{headers:{'content-length':'9999999'}})}),/byte bound/);
  await assert.rejects(()=>readClaimantCount('wales',{fetcher:async url=>new Response(url===CLAIMANT_TIME_URL?timeText:'x'.repeat(131073))}),/byte bound/);
  await assert.rejects(()=>readClaimantCount('wales',{fetcher:async()=>new Response(new Uint8Array([255]))}),/UTF-8/);
  await assert.rejects(()=>readClaimantCount('wales',{fetcher:async url=>new Response(url===CLAIMANT_TIME_URL?'{}':csv)}),/metadata dataset/);
  await assert.rejects(()=>readClaimantCount('wales',{fetcher:async url=>new Response(url===CLAIMANT_TIME_URL?timeText:lines.slice(0,-1).join('\n'))}),/record count/);
  await assert.rejects(()=>readClaimantCount('wales',{fetcher:async()=>{throw new DOMException('timed out','TimeoutError');}}),/timed out/);
});

test('readSections isolates claimant failure and retains a successful sibling',async t=>{
  t.mock.method(console,'warn',()=>{});
  const result=await readSections({
    claimant_count:()=>readClaimantCount('wales',{fetcher:async()=>new Response('blocked',{status:403})}),
    successful_sibling:async()=>({value:123,period:'2026'}),
  });
  assert.equal(result.claimant_count,null);assert.equal(result.sources.claimant_count.status,'error');
  assert.equal(result.sources.claimant_count.http_status,403);
  assert.equal(result.successful_sibling.value,123);assert.equal(result.sources.successful_sibling.status,'ok');
});
