import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {walesTax} from '../lib/fiscal-observations.js';
import {wraDefinitions,wraObservationRows,validateWraRepresentation} from '../lib/wra-depth.js';
const now='2026-10-20T09:00:00.000Z';
const fresh=()=>walesTax(readFileSync(new URL('./fixtures/wra-tax.csv',import.meta.url),'utf8'),new Date(now));
test('four WRA identities preserve overlapping effective-year tax-due coverage independently of row order',()=>{
  const value=fresh();assert.equal(validateWraRepresentation(value,{retrieved_at:now}),true);
  const rows=wraObservationRows(value);assert.equal(rows.length,4);
  assert.deepEqual(wraObservationRows({...value,rows:[...value.rows].reverse()}),rows);
  assert.equal(new Set(wraDefinitions().map(d=>d.id)).size,4);
  assert.equal(rows[0].measure_id,'all_inclusive');assert.equal(rows[1].measure_id,'all_disclosed');
  assert.ok(wraDefinitions().every(d=>d.unit==='GBP million'&&d.geography==='Wales'));
});
test('WRA typed validation refuses plausible geography/unit/coverage/period/substitution and suppression errors',()=>{
  for(const edit of [
    v=>v.geography='United Kingdom',v=>v.period_start='2025-01-01',
    v=>v.period_end='2026-12-31',v=>v.period='2025-27',v=>v.source_url='https://example.org/data',
    v=>v.rows.pop(),v=>v.rows.push(v.rows[0]),v=>v.rows[1]={...v.rows[0]},
    v=>v.rows[0]=null,v=>v.rows[0]=[],v=>v.rows[0]=7,
    v=>v.rows[0].geography='England',v=>v.rows[0].unit='GBP thousand',
    v=>v.rows[0].period='2024-25',v=>v.rows[0].value=null,v=>v.rows[0].value=Infinity,
    v=>v.rows[0].value=-1,v=>v.rows[0].value=371.01,v=>v.rows[0].notes='Confidential',
    v=>v.rows[0].notes='Not Available',v=>v.rows[0].notes='Not Applicable',
    v=>v.rows[2].value+=10,
  ]) {
    const v=fresh();edit(v);
    assert.equal(validateWraRepresentation(v,{retrieved_at:now}),false);
  }
  assert.equal(validateWraRepresentation(fresh(),{retrieved_at:'2025-10-20T09:00:00Z'}),false);
  assert.equal(validateWraRepresentation(fresh(),{retrieved_at:'invalid'}),false);
  assert.equal(validateWraRepresentation(fresh(),{retrieved_at:undefined}),false);
  assert.equal(validateWraRepresentation(fresh(),{retrieved_at:null}),false);
});
test('explicit zero stays observed; revisions and notes remain statistical content',()=>{
  const v=fresh();for(const row of v.rows)row.value=0;
  assert.equal(validateWraRepresentation(v,{retrieved_at:now}),true);
  assert.ok(wraObservationRows(v).every(r=>r.value===0&&r.value_state==='observed'));
  v.rows[0].notes='Revised';assert.equal(wraObservationRows(v)[0].notes,'Revised');
});
