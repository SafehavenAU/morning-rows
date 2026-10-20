// Join existing genuine captures only; this script performs no remote requests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateSfcActivity,sfcActivityRows} from '../../../lib/sfc-activity.js';
import {validateCmhcRentRepresentation} from '../../../lib/cmhc-rent.js';
const base=new URL('./',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const captures={};
for(const file of ['cloudflare-reader-live.json','cloudflare-workbooks-live.json','../ni-energy/cloudflare-reader-live.json','../ni-energy/cloudflare-report-diagnostic.json']){
  const bytes=await readFile(new URL(file,base));
  captures[file]={file,sha256:hash(bytes),bytes:bytes.length,report:JSON.parse(bytes)};
}
const accepted=[
  {key:'canada/rental_benchmark',source:'rental_benchmark',file:'cloudflare-reader-live.json',module:'../../../lib/cmhc-rent.js',ref:'../cmhc-rent/independent-report.json',count:2,validate:validateCmhcRentRepresentation,rows:n=>n.rows},
  {key:'scotland/college_activity',source:'college_activity',file:'cloudflare-workbooks-live.json',module:'../../../lib/sfc-activity.js',ref:'../sfc/independent-report.json',count:5,validate:validateSfcActivity,rows:sfcActivityRows},
];
const sources=[];
for(const spec of accepted){
  const capture=captures[spec.file],r=capture.report,c=r.sources[spec.source],native=r.live.body[spec.source],completion=r.live.timings[spec.source].finished_at;
  assert.equal(r.code_unchanged,true);assert.equal(r.references_unchanged,true);assert.equal(r.actual_clock,true);assert.equal(r.injected_failure_isolated,true);
  assert.equal(r.live.fixture,false);assert.equal(c.pass,true);assert.equal(c.comparisons.length,spec.count);
  assert.equal(spec.validate(native,{retrieved_at:completion}),true);
  const currentHash=hash(await readFile(new URL(spec.module,base)));
  assert.equal(currentHash,r.code_before[spec.module]);assert.equal(currentHash,r.code_after[spec.module]);
  for(const dependency of ['../../../lib/sources.js',...(spec.source==='college_activity'?['../../../lib/workbook.js']:[])]){
    assert.equal(hash(await readFile(new URL(dependency,base))),r.code_before[dependency]);
  }
  const refBytes=await readFile(new URL(spec.ref,base)),reference=JSON.parse(refBytes);
  assert.equal(reference.pass,true);assert.equal(hash(refBytes),r.references[spec.source].sha256);
  const actual=spec.rows(native),expected=spec.source==='college_activity'?reference.observations.map(x=>({measure_id:x.measure,period:reference.period,value:x.value,unit:reference.unit})):reference.rows;
  assert.equal(actual.length,spec.count);assert.equal(expected.length,spec.count);
  for(const want of expected){
    const matches=actual.filter(row=>row.measure_id===want.measure_id&&row.period===want.period);
    assert.equal(matches.length,1);assert.equal(matches[0].value,want.value);assert.equal(matches[0].unit,want.unit);assert.equal(matches[0].value_state,'observed');
  }
  sources.push({key:spec.key,source:spec.source,protected_reader_pass:true,capture:spec.file,capture_sha256:capture.sha256,actual_started_at:r.live.timings[spec.source].started_at,actual_completed_at:completion,module:spec.module,module_sha256:currentHash,reference:spec.ref,reference_sha256:hash(refBytes),cells:spec.count,comparisons:c.comparisons,provenance:native.provenance,cpu_ms:null});
}
const first=captures['cloudflare-reader-live.json'].report,workbooks=captures['cloudflare-workbooks-live.json'].report;
assert.equal(first.sources.bedroom_rent.health.http_status,429);
assert.equal(workbooks.sources.care_assessment_cohort.health.http_status,403);
const ni=captures['../ni-energy/cloudflare-report-diagnostic.json'].report.diagnosis;
assert.equal(ni.status,200);assert.deepEqual(ni.titles,['Request Rejected']);assert.equal(ni.contains_expected_title,false);
const blocked=[
  {key:'england/bedroom_rent',activation:'blocked',reason:'Actual protected official read returned HTTP 429; fixture agreement is not live acceptance.',capture:'cloudflare-reader-live.json',retry_performed:false},
  {key:'england/care_assessment_cohort',activation:'blocked',reason:'After fixing the pre-HTTP Request constructor error, the actual protected official read returned HTTP 403.',capture:'cloudflare-workbooks-live.json',retry_after_publisher_failure:false},
  {key:'northern-ireland/electricity_balance',activation:'blocked',reason:'Actual reader refused changed report identity; one bounded diagnosis found a 247-byte HTTP 200 Request Rejected access page.',capture:'../ni-energy/cloudflare-reader-live.json',diagnostic:'../ni-energy/cloudflare-report-diagnostic.json',further_attempts:false},
];
const proof={
  pass:true,scope:'Protected source-reader proof for exactly two eligible additions; not final deployment acceptance',
  recorded_at:new Date().toISOString(),source_contracts:sources.map(s=>s.key),cells_compared:7,sources,blocked,
  captures:Object.values(captures).map(({report,...entry})=>entry),
  all_five_sources_pass:false,production_deployment_accepted:false,monitoring_activation_accepted:false,
  cpu_ms:null,cpu_gate:'Unmeasured here. Root must verify the exact integrated Worker version; wall time is not CPU.',
  preserved_initial_failure:'cloudflare-reader-live.json plus initial-inputs/ retain the original pre-HTTP redirect:error failures and the CMHC success. The failure was diagnosed without publisher requests using check-request-options.mjs.',
  isolation:'Each genuine capture retained the actual reader source outcomes alongside a deliberate harness-only error. The error was never a collector or user-source incident.',
  statistical_independence:'SFC Parliament and workbook presentations share FES lineage. CMHC CSV and WDS share the same CMHC survey. These are exact extraction/presentation comparisons, not independent statistical measurement.',
};
await writeFile(new URL('accepted-reader-proof.json',base),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({pass:true,source_contracts:proof.source_contracts,cells_compared:7,blocked:blocked.map(b=>b.key),requests_performed:0}));
