import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCpi,CPI_SERIES,CPI_DEFINITION,CPI_URLS} from '../lib/us-cpi.js';
import {digest,semantic} from '../lib/information.js';
import {selectedUsResponse,observationUrl,US_MEASURE_URL} from '../lib/information-v2.js';
import {handleUsRequest} from '../lib/us-desk.js';
import {parseCpiTable} from '../lib/us-cpi-table.js';
const files=JSON.parse(readFileSync(new URL('./fixtures/us-cpi.json',import.meta.url))).files;
const body=()=>({site:'https://morningrows.com',country:'United States',cpi:parseCpi(files),sources:{cpi:{status:'ok',fetched_at:'2026-10-20T00:00:00Z'}}});
async function verify(input,selection){
 const selected=await selectedUsResponse(input,selection);assert.equal(selected.status,200);
 const result=selected.body;
 for(const observation of result.observations){
  const raw=input.cpi.rows.find(r=>r.period===observation.period);
  // The public record contract, hashed by the independent existing generic
  // implementation. Additional properties remain part of the observation.
  const expected={...raw,id:observationUrl(raw.period),measure:US_MEASURE_URL,definition:CPI_DEFINITION,source_url:CPI_URLS.data,licence:CPI_DEFINITION.licence,published_at:null,publisher_updated_at:null,next_expected_update:null};
  assert.equal(observation.version,await digest(expected));
 }
 assert.equal(result.content_version,await digest({data:result.data,context:result.context,retrieval:result.retrieval,observations:result.observations}));
 assert.equal(selected.canonical,JSON.stringify(semantic(result)));
 const path='/united-states.json?source=cpi'+(selection.measure?'&measure='+CPI_SERIES:'')+(selection.observation?'&observation='+selection.observation:'');
 const response=await handleUsRequest(new Request('https://morningrows.com'+path),{read:async()=>input,cache:null});
 assert.equal(response.headers.get('etag'),'W/"'+await digest(result)+'"');
}
test('cold fragments preserve hashes for additional row properties, nested qualifications and arbitrary provenance',async()=>{
 for(const mutate of [
  b=>{},
  b=>{Object.assign(b.cpi.rows.at(-1),{zz:'later than version',aaa:'earlier',2:'numeric',10:'numeric',version:'publisher-addition',retrieved_at:'excluded'});},
  b=>{b.cpi.rows.at(-1).footnotes=[{code:'R',text:'Revised',zz:{z:[1,null,{b:2,a:1}],a:'quote" and \\ escape',retrieved_at:'excluded'}}];},
  b=>{b.cpi.provenance=[{z:{z:3,a:1,retrieved_at:'excluded'},a:'😀\n',bytes:123},null,{10:'ten',2:'two'}];},
  b=>{b.cpi.timing_note={z:1,a:2,retrieved_at:'excluded',nested:[{z:3,a:4}]};},
  b=>{b.cpi.timing_note=['a',{z:1,a:2,fetched_at:'excluded'}];},
 ]){
  const input=body();mutate(input);
  for(const selection of [{source:'cpi'},{source:'cpi',measure:CPI_SERIES},{source:'cpi',measure:CPI_SERIES,observation:'2025-10'},{source:'cpi',measure:CPI_SERIES,observation:input.cpi.rows.at(-1).period}])await verify(input,selection);
 }
});
test('target-table slicing rejects ambiguous identity and broken boundaries while ignoring unrelated tables',()=>{
 const {table}=JSON.parse(readFileSync(new URL('./fixtures/us-cpi-table.json',import.meta.url)));
 const expected=parseCpi(files);
 assert.deepEqual(parseCpiTable('<table id="unrelated"><tr><td>not CPI</td></tr></table>'+table,'2026-09'),expected);
 for(const html of [
  table+table,
  table.replace('id="table0"','id="table0" id="catalog0"'),
  table.replace('id="catalog0"','id="catalog0" id="catalog0"'),
  table.replace(/<\/table>/gi,''),
  table.replace('id="catalog0"','id="other"'),
  table.replace('id="table0"','id="other"'),
 ])assert.throws(()=>parseCpiTable(html,'2026-09'));
});
