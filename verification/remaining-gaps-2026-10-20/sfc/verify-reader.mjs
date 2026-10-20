import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readSfcActivity,validateSfcActivity,sfcActivityDefinitions,sfcActivityRows} from '../../../lib/sfc-activity.js';
const root=new URL('./',import.meta.url),original=new URL('../prior-audit/sfc/original/',root);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(new URL('tables.xlsx',original));
const request=JSON.parse(await readFile(new URL('tables.xlsx.request.json',original),'utf8'));
const refBytes=await readFile(new URL('independent-report.json',root)),reference=JSON.parse(refBytes);
assert.equal(reference.pass,true);
assert.equal(reference.observations_compared,5);
assert.equal(hash(bytes),reference.source_sha256['tables.xlsx']);
const acquisition=new Date(request.retrieved_at).toISOString();
let requests=0;
const actual=await readSfcActivity({fetcher:async url=>{requests++;assert.equal(url,request.url);return new Response(bytes);},now:()=>acquisition});
assert.equal(requests,1);
assert.equal(validateSfcActivity(actual,{retrieved_at:acquisition}),true);
const rows=sfcActivityRows(actual);
const comparisons=reference.observations.map(reference=>{
  const row=rows.find(row=>row.measure_id===reference.measure);
  return {measure_id:reference.measure,period:row?.period,expected:reference.value,actual:row?.value,pass:row?.period==='2024-25'&&row?.unit==='full-time equivalents'&&row?.value===reference.value&&row?.value_state==='observed'};
});
assert.equal(comparisons.length,5);assert.ok(comparisons.every(row=>row.pass));
const report={
  pass:true,verified_at:new Date().toISOString(),
  method:'Actual readSfcActivity code with an injected Response of retained original bytes; offline replay, not a live publisher or Cloudflare request.',
  original_acquisition:request.retrieved_at,replay_acquisition_clock:acquisition,requests_to_injected_fetcher:requests,
  reference_sha256:hash(refBytes),
  reader_sha256:hash(await readFile(new URL('../../../lib/sfc-activity.js',root))),
  workbook_reader_sha256:hash(await readFile(new URL('../../../lib/workbook.js',root))),
  cells_compared:5,comparisons,definitions:sfcActivityDefinitions(),native:actual,
  runtime_or_release_acceptance:false,
};
await writeFile(new URL('reader-reference.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,cells_compared:5,offline_replay:true}));
