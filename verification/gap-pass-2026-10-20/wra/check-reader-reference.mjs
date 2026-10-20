import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {walesTax} from '../../../lib/fiscal-observations.js';
import {wraObservationRows,validateWraRepresentation} from '../../../lib/wra-depth.js';
const here=new URL('./',import.meta.url);
const now='2026-10-20T09:29:58.069Z';
const reference=JSON.parse(await readFile(new URL('independent-report.json',here),'utf8'));
const native=walesTax(await readFile(new URL('original/wra-data.csv',here),'utf8'),new Date(now));
assert.ok(validateWraRepresentation(native,{retrieved_at:now}));
const rows=wraObservationRows(native);
for(const cell of reference.comparisons){
  const actual=rows.find(row=>row.measure_id===cell.measure);
  assert.equal(actual.value,cell.value);
  assert.equal(actual.period,cell.period);
  assert.equal(actual.coverage,cell.coverage);
  assert.equal(actual.transaction_type,cell.transaction_type);
  assert.equal(actual.notes,cell.notes);
}
const report={passed:true,compared_cells:4,scope:'Existing four 2025-26 WRA tax-due cells',native};
await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,compared_cells:4}));
