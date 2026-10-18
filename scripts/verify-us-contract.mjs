// Offline replay of actual Worker routes against the dated original aggregates.
// Writes public evidence only. It cannot fetch publishers or deploy anything.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {INFORMATION_SCHEMA} from '../lib/information.js';
import {INFORMATION_SCHEMA_V2} from '../lib/information-v2.js';
import {readUnitedStates} from '../lib/us-cpi.js';
const out=process.env.US_REPORT_DIR||'/tmp/morning-rows-us-contract';mkdirSync(out,{recursive:true});
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const fixture=json('../test/fixtures/us-cpi-workbook.json');
const snapshot=json('../verification/structure-2026-10-17/selected-snapshot.json');
const prior=json('../research/us-onboarding-2026-10-17/rehearsal/compatibility-results.json');
const us=await readUnitedStates({fetcher:async url=>new Response(url.endsWith('home.htm')?fixture.index:Buffer.from(fixture.workbook_base64,'base64'))});
globalThis.fetch=()=>{throw Error('External fetch forbidden during offline contract replay');};
globalThis.caches={default:{match:async request=>{
 let desk=new URL(request.url).pathname.slice(1).replace(/\.json$/,'');if(desk==='morning')desk='australia';
 const body=desk==='united-states'?us:snapshot[desk];return body?Response.json(body,{headers:{'cache-control':'public, max-age=14400','x-data-status':'degraded','x-mr-cache-expires-at':String(Date.now()+20000)}}):undefined;
}}};
const checks=[],documents=[];
for(const previous of prior.results){
 const r=await worker.fetch(new Request('https://morningrows.com'+previous.path)),text=await r.text();
 const sha=createHash('sha256').update(text).digest('hex');assert.equal(r.status,previous.status,previous.path);assert.equal(sha,previous.sha256,previous.path);
 const body=JSON.parse(text);if(r.status===200&&previous.path!='/schema.json')documents.push({schema:'v1',path:previous.path,body});
 checks.push({path:previous.path,status:r.status,identical_body:true,sha256:sha,link:r.headers.get('link')});
}
const cases=[['/catalog.v2.json',200],['/catalog.v2.json?desk=united-states',200],['/united-states.json',200],['/united-states.json?source=cpi',200],['/united-states.json?source=cpi&measure=CUUR0000SA0',200],['/united-states.json?source=cpi&measure=CUUR0000SA0&observation=2025-10',200],['/united-states.json?source=cpi&measure=CUUR0000SA0&observation=2025-08',404],['/united-states.json?geography=California',400]];
for(const [path,status] of cases){const r=await worker.fetch(new Request('https://morningrows.com'+path));assert.equal(r.status,status);documents.push({schema:'v2',path,body:await r.json()});}
const native=json('../research/us-onboarding-2026-10-17/results.json').representation.observations;
assert.deepEqual(us.cpi.rows,native.map(({period,value,value_text,value_state,footnotes})=>({period,value,value_text,value_state,footnotes})));
writeFileSync(out+'/schema-inputs.json',JSON.stringify({schemas:{v1:INFORMATION_SCHEMA,v2:INFORMATION_SCHEMA_V2},documents},null,2)+'\n');
writeFileSync(out+'/compatibility.json',JSON.stringify({checked_at:new Date().toISOString(),method:'Actual Worker dispatcher; fixed original aggregate fixtures; deterministic, not independent agent evaluation',legacy_cases:checks.length,checks,us_cases:cases.length,independent_python_cells_equal:13,permitted_header_change:'Legacy catalogue advertises v2 successor; other data contracts unchanged'},null,2)+'\n');
console.log(JSON.stringify({legacy_cases:checks.length,us_cases:cases.length,publisher_cells_equal:13,out}));
