// Offline actual-reader comparison with independently extracted original references.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openWorkbook} from '../../../lib/workbook.js';
import {parseCqcCohort,validateCqcCohort} from '../../../lib/cqc-cohort.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=new URL('./',import.meta.url),file=new URL('../prior-audit/cqc/original/ratings.xlsx',root);
const [original,request,reference]=await Promise.all([
  readFile(file),
  readFile(new URL('../prior-audit/cqc/original/ratings.xlsx.request.json',root),'utf8').then(JSON.parse),
  readFile(new URL('independent-reference.json',root),'utf8').then(JSON.parse),
]);
if(!reference.passed||sha(original)!==request.sha256)throw Error('Original/reference evidence mismatch');
const at=new Date(request.retrieved_at).toISOString();
const native=parseCqcCohort(openWorkbook(new Uint8Array(original)),{
  now:at,provenance:[{url:request.url,retrieved_at:at,bytes:original.length,sha256:sha(original)}],
});
const comparisons=reference.references.map(ref=>{
  const rows=native.rows.filter(row=>row.measure===ref.measure);
  return {measure:ref.measure,period:ref.period,expected:ref.value,actual:rows[0]?.value,
    passed:rows.length===1&&Object.entries(ref).every(([key,value])=>rows[0][key]===value)};
});
const report={
  passed:validateCqcCohort(native,at)&&comparisons.length===5&&comparisons.every(row=>row.passed),
  environment:'Offline actual-reader replay of original retained publisher bytes',
  compared_at:new Date().toISOString(),native,comparisons,
  source_sha256:sha(await readFile(new URL('../../../lib/cqc-cohort.js',root))),
  parser_sha256:sha(await readFile(new URL('../../../lib/workbook.js',root))),
  reference_sha256:sha(await readFile(new URL('independent-reference.json',root))),
  actual_worker_tested:false,production_or_scheduled_acceptance:false,future_vintages_approved:false,
};
await writeFile(new URL('reader-reference-comparison.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,exact_values:comparisons.length,actual_worker_tested:false}));
if(!report.passed)process.exitCode=1;
