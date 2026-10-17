import test from 'node:test';
import assert from 'node:assert/strict';
import { statNzFromCsv, parseCsv, readStatsNz } from '../lib/stats-nz.js';
import { STATS_NZ_SERIES } from '../lib/stats-nz-series.js';
const series = { dimensions: { AREA: { code: 'NZ' } }, period_column: 'YEAR', kind: 'observation', period_labels: {} };
const now = new Date('2026-10-17T00:00:00Z');
test('retains DATAFLOW header and selects latest period rather than first row', () => {
 const csv = 'DATAFLOW,YEAR,AREA,OBS_VALUE\r\nX,2023,NZ,12\r\nX,2025,NZ,0\r\nX,2024,NZ,20\r\n';
 assert.deepEqual(statNzFromCsv(csv,series,now), {period:'2025',period_label:'2025',value:0,attributes:{}});
});
test('handles BOM, quoted STRUCTURE header, preamble and escaped quotes', () => {
 const csv = '\uFEFFmetadata\n"STRUCTURE","YEAR","AREA","OBS_VALUE","NOTE"\n"dataflow","2025","NZ","1.5","a, ""note"""';
 assert.equal(statNzFromCsv(csv,series,now).attributes.NOTE,'a, "note"');
 assert.equal(parseCsv('a,"line\nb"')[0][1],'line\nb');
});
test('missing, malformed and mismatched columns cannot become observations', () => {
 for (const csv of ['YEAR,VALUE\n2025,4','YEAR,AREA,OBS_VALUE\n2025,AU,4','YEAR,AREA,OBS_VALUE\n2025,NZ','YEAR,AREA,OBS_VALUE\n2025,NZ,"4']) assert.throws(()=>statNzFromCsv(csv,series,now));
});
test('does not substitute an earlier figure when the latest is suppressed', () => {
 assert.throws(()=>statNzFromCsv('YEAR,AREA,OBS_VALUE\n2024,NZ,10\n2025,NZ,..',series,now),/suppressed/);
});
test('ignores future observations and rejects duplicate periods', () => {
 assert.equal(statNzFromCsv('YEAR,AREA,OBS_VALUE\n2025,NZ,10\n2030,NZ,99',series,now).value,10);
 assert.throws(()=>statNzFromCsv('YEAR,AREA,OBS_VALUE\n2025,NZ,10\n2025,NZ,11',series,now),/Ambiguous/);
});
test('fixed-year iwi observations retain their period and population group', () => {
 const s=STATS_NZ_SERIES.find(s=>s.id==='IWI18_GRP_001');
 assert.equal(statNzFromCsv('DATAFLOW,IWI_IWI18_GRP_001,OBS_VALUE\nX,03,75393',s,now).period,'2018');
});
test('projection selection never presents the end of the horizon as current', () => {
 const csv='YEAR,AREA,OBS_VALUE\n2023,NZ,10\n2028,NZ,11\n2043,NZ,99';
 assert.throws(()=>statNzFromCsv(csv,{...series,kind:'projection'},now),/No observation/);
 assert.equal(statNzFromCsv(csv,{...series,kind:'projection',projection_period:'next_available'},now).period,'2028');
});
test('every Stats NZ query selects all non-time dimensions explicitly', () => {
 assert.equal(STATS_NZ_SERIES.length,23);
 for (const s of STATS_NZ_SERIES) {
  assert.ok(s.unit && s.geography && s.name);
  assert.equal(s.key.split('.').filter(Boolean).length,Object.keys(s.dimensions).length);
  assert.equal(s.key.split('.').filter(c=>!c).length,s.period_column?1:0);
 }
});
test('one failed table does not erase the other Stats NZ tables or leak credentials', async t => {
 t.mock.method(globalThis,'fetch',async url => {
  const s=STATS_NZ_SERIES.find(s=>url.includes(','+s.id+','));
  if(s.id==='AGR_AGR_001')return new Response('blocked',{status:403});
  const columns=['DATAFLOW',...Object.keys(s.dimensions),...(s.period_column?[s.period_column]:[]),'OBS_VALUE'];
  const row=['X',...Object.values(s.dimensions).map(x=>x.code),...(s.period_column?[String(new Date().getUTCFullYear())]:[]),'1'];
  return new Response(columns.join(',')+'\n'+row.join(','));
 });
 const result=await readStatsNz({STATSNZ_KEY:'secret-test-sentinel'});
 assert.equal(result.present,true);assert.equal(result.rows.length,23);
 assert.equal(result.rows.filter(r=>r.status==='ok').length,22);
 assert.equal(result.rows[0].http_status,403);
 assert.ok(!JSON.stringify(result).includes('secret-test-sentinel'));
});
