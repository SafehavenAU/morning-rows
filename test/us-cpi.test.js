import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCpi, readCpiText, readUsCpi, readUnitedStates, CPI_URLS} from '../lib/us-cpi.js';
import {selectedUsResponse} from '../lib/information-v2.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/us-cpi.json',import.meta.url))).files;
const change=(file,from,to)=>({...fixture,[file]:fixture[file].replace(from,to)});
const fetchFiles=files=>async url=>new Response(files[Object.keys(CPI_URLS).find(k=>CPI_URLS[k]===url)]);

test('original aggregate rows reconcile to official release and retain the real October gap',()=>{
 const d=parseCpi(fixture);assert.equal(d.rows.length,13);assert.equal(d.rows.filter(r=>r.value!==null).length,12);
 assert.equal(d.rows[0].value_text,'324.800');assert.equal(d.rows.at(-2).value_text,'334.980');assert.equal(d.rows.at(-1).value_text,'336.940');
 assert.deepEqual(d.window,{first:'2025-09',last:'2026-09',slots:13});assert.equal(d.rows[1].value,null);assert.equal(d.rows[1].value_state,'unavailable');assert.match(d.rows[1].footnotes[0].text,/2025 lapse in appropriations/);
 assert.equal(((336.940/324.800-1)*100).toFixed(1),'3.7');assert.equal(d.published_at,null);assert.equal(d.next_expected_update,null);assert.match(d.definition.population,/All urban consumers/);assert.match(d.definition.boundary,/50 states and DC/);
});
test('wrong measure/geography/adjustment/base/title cannot masquerade as this national CPI',()=>{
 for(const [from,to] of [['\t0000\t','\t0400\t'],['\tSA0\t','\tSA0L1E\t'],['\tU\t','\tS\t'],['1982-84=100','2000=100'],['all urban consumers','urban wage earners']])assert.throws(()=>parseCpi(change('series',from,to)),/definition_changed/);
 assert.throws(()=>parseCpi(change('series','CUUR0000SA0','CUSR0000SA0')),/metadata_coverage/);
});
test('incomplete, duplicate and future-metadata windows fail without older-release substitution',()=>{
 assert.throws(()=>parseCpi(change('data','2025\tM11','2024\tM11')),/incomplete_window/);
 assert.throws(()=>parseCpi({...fixture,data:fixture.data+'CUUR0000SA0\t2026\tM09\t336.940\t\n'}),/duplicate_period/);
 assert.throws(()=>parseCpi(change('series','2026\tM09','2026\tM10')),/metadata_release_mismatch/);
 assert.throws(()=>parseCpi(change('data','2026\tM09','2026\tQ03')),/invalid_period/);
});
test('M13 is not December; December must exist for metadata ending M13',()=>{
 assert.throws(()=>parseCpi(change('series','2026\tM09','2026\tM13')),/metadata_release_mismatch/);
 const files=change('series','2026\tM09','2026\tM13');files.data+='CUUR0000SA0\t2026\tM10\t337.000\t\nCUUR0000SA0\t2026\tM11\t338.000\t\nCUUR0000SA0\t2026\tM12\t339.000\t\nCUUR0000SA0\t2026\tM13\t330.000\t\n';
 const d=parseCpi(files);assert.equal(d.latest_period,'2026-12');assert.equal(d.rows.at(-1).value,339);assert.equal(d.rows[0].period,'2025-12');assert.ok(!d.rows.some(r=>r.period.endsWith('-13')));
});
test('missing, unavailable, suppression, revision and zero stay distinct',()=>{
 assert.equal(parseCpi(change('data','\tX','\t')).rows[1].value_state,'missing');
 assert.throws(()=>parseCpi(change('data','           -\tX','     325.000\tX')),/numeric_with_unavailable_flag/);
 assert.throws(()=>parseCpi(change('footnotes','lapse in appropriations','confidential suppression')),/unavailable_definition_changed/);
 assert.throws(()=>parseCpi(change('data','\tX','\tS')),/unknown_footnote/);
 assert.throws(()=>parseCpi(change('data','336.940','0')),/nonpositive_index_anomaly_2026-09/);
 const revised=change('data','336.940\t','336.941\tR');assert.equal(parseCpi(revised).rows.at(-1).footnotes[0].text,'Revised');
 assert.throws(()=>parseCpi({...revised,footnotes:fixture.footnotes.replace('Revised','Removed')}),/revision_definition_changed/);
});
test('malformed columns, body, numeric cells and ambiguous notes fail closed',()=>{
 for(const raw of ['','NaN','Infinity','336,940','<b>336.940</b>'])assert.throws(()=>parseCpi(change('data','336.940',raw)));
 for(const [file,from,to] of [['data','year\tperiod','year\tyear'],['data','336.940\t','336.940'],['series','2026\tM09','2026'],['footnotes','X\tData','R\tData']])assert.throws(()=>parseCpi(change(file,from,to)));
 assert.throws(()=>parseCpi({...fixture,data:'<html>Maintenance</html>'}),/unexpected_columns/);
});
test('bounded transport rejects HTTP, empty, declared/chunked oversize, invalid UTF-8 and abort',async()=>{
 for(const status of [403,406,429,500])await assert.rejects(()=>readCpiText(new Response('error',{status})),new RegExp(`HTTP ${status}`));
 await assert.rejects(()=>readCpiText(new Response(null)),/empty_source/);
 await assert.rejects(()=>readCpiText(new Response('123456789'),8),/body_limit/);
 await assert.rejects(()=>readCpiText(new Response('1',{headers:{'content-length':'100'}}),8),/body_limit/);
 await assert.rejects(()=>readCpiText(new Response(new Uint8Array([0xff]))));
 let aborted=0;await assert.rejects(()=>readUsCpi({deadline:10,fetcher:(url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted++;reject(Error('abort'));}))}),/source_deadline/);assert.equal(aborted,3);
});
test('real fetch/parser path preserves decimal text and original-file hashes',async()=>{
 let calls=0;const d=await readUsCpi({fetcher:async(...args)=>{calls++;return fetchFiles(fixture)(...args);}});assert.equal(calls,3);assert.equal(d.rows.at(-1).value_text,'336.940');assert.equal(d.provenance.length,3);assert.ok(d.provenance.every(r=>/^[a-f0-9]{64}$/.test(r.sha256)&&r.bytes>0));
});
test('reader failure remains a failed source with no snapshot fallback',async t=>{
 t.mock.method(console,'warn',()=>{});const d=await readUnitedStates({fetcher:async()=>new Response('blocked',{status:403})});
 assert.equal(d.sources.cpi.status,'error');assert.equal(d.sources.cpi.http_status,403);assert.equal(d.cpi,null);
 const selected=await selectedUsResponse(d,{source:'cpi'});assert.equal(selected.status,503);assert.deepEqual(selected.body.observations,[]);
});
test('bulk selection keeps exact identifiers, reordered fields and malformed selected records',()=>{
 const expected=parseCpi(fixture);
 const extra={...fixture,data:fixture.data+'CUUR0000SA01\t2026\tM10\t999.000\t\nXCUUR0000SA0\t2026\tM10\t999.000\t\n'};
 assert.deepEqual(parseCpi(extra),expected);
 const reordered={...fixture};
 for(const kind of ['data','series'])reordered[kind]=fixture[kind].trimEnd().split(/\r?\n/).map(line=>{const cells=line.split('\t');return [cells[1],cells[0],...cells.slice(2)].join('\t');}).join('\n')+'\n';
 // Keep the empty last footnote field on the final data row.
 reordered.data=fixture.data.split(/\r?\n/).filter(Boolean).map(line=>{const c=line.split('\t');return [c[1],c[0],...c.slice(2)].join('\t');}).join('\n')+'\n';
 assert.deepEqual(parseCpi(reordered),expected);
 assert.throws(()=>parseCpi({...fixture,data:fixture.data+'CUUR0000SA0\n'}),/truncated_record/);
 assert.deepEqual(parseCpi({...fixture,data:fixture.data.replaceAll('\n','\r\n')}),expected);
});

test('native bounded reader hashes the same decoded UTF-8 including BOM and Unicode',async()=>{
 for(const text of ['plain CPI text','é index 😀','\ufeffé index','\ufeff\ufeffdata']){
  const input=new TextEncoder().encode(text);let cancelled=false,released=false;
  const reader={readAtLeast:async(n,view)=>{assert.equal(n,65);assert.equal(view.length,65);return {value:input};},cancel:async()=>{cancelled=true;},releaseLock:()=>{released=true;}};
  const response={ok:true,headers:new Headers(),body:{getReader:()=>reader}};
  const got=await readCpiText(response,64);
  assert.equal(got.bytes,input.length);assert.equal(cancelled&&released,true);
  assert.deepEqual(got.hashBytes,new TextEncoder().encode(got.text));
 }
 for(const input of [new Uint8Array([0xff]),new Uint8Array(65),new Uint8Array(0)]){
  let cancelled=false;
  const reader={readAtLeast:async()=>({value:input}),cancel:async()=>{cancelled=true;},releaseLock:()=>{}};
  await assert.rejects(()=>readCpiText({ok:true,headers:new Headers(),body:{getReader:()=>reader}},64));
  assert.equal(cancelled,true);
 }
});
