// Diagnostic equivalence against the pinned baseline; never a production test.
import assert from 'node:assert/strict';
import {handleUsRequest as original} from './baseline/us-desk.js';
import {handleUsRequest as combined} from './fragment-desk.mjs';
import {readUnitedStates,CPI_DEFINITION,CPI_URLS} from './baseline/us-cpi.js';
import {readSections} from './baseline/sources.js';
import {readUsCpiTable} from './table-candidate.mjs';
import {fixtures} from './prepare.mjs';
const {index,table}=fixtures();
const fetcher=async url=>new Response(url.endsWith('home.htm')?index:table);
const readCandidate=async()=>({
  site:'https://morningrows.com',country:'United States',
  ...await readSections({cpi:()=>readUsCpiTable({fetcher})},{
    cpi:{name:CPI_DEFINITION.publisher,source_url:CPI_URLS.data,licence:CPI_DEFINITION.licence},
  }),
});
async function invoke(route,read) {
  const response=await route(new Request('https://morningrows.com/united-states.json?source=cpi&measure=CUUR0000SA0'),{
    cache:null,now:()=>1792454400000,
    read:async()=>{
      const body=await read();body.sources.cpi.fetched_at='2026-10-20T00:00:00Z';return body;
    },
  });
  assert.equal(response.status,200);
  return {body:await response.text(),headers:[...response.headers]};
}
const baseline=await invoke(original,()=>readUnitedStates({fetcher}));
const candidate=await invoke(combined,readCandidate);
assert.deepEqual(candidate,baseline);
assert.equal(JSON.parse(candidate.body).observations.length,13);
console.log(JSON.stringify({status:'equal',route_body_headers_and_etag_equal:true,observations:13}));
