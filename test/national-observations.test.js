import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyDeaths, isoWeekDates, giltsInIssue, previousMonth, assemblyDivisions, influenzaPositivity, FLU_METRIC } from '../lib/national-observations.js';
import { readSections } from '../lib/sources.js';

const now = new Date('2026-10-17T09:00:00Z');
const header = 'GeographyCode,GeographyName,GeographyType,DateCode,Measurement,Units,Value,Cause Of Death';
const causes = ['All causes', 'COVID-19', 'COVID-19 mentions', 'Flu', 'Flu mentions'];
const csv = (period = '2026-W41') => header + '\n' + causes.map((cause, i) => `S92000003,Scotland,Country,${period},Count,Deaths,${[100, 0, 2, 3, 5][i]},${cause}`).join('\n');
test('NRS selects complete latest week with correct ISO boundaries and genuine zeros', () => {
  const d = weeklyDeaths(csv(), now);
  assert.equal(d.rows.length, 5); assert.equal(d.rows[1].value, 0);
  assert.deepEqual(d.dates, { start: '2026-10-05', end: '2026-10-11' });
  assert.deepEqual(isoWeekDates('2020-W53'), { start: '2020-12-28', end: '2021-01-03' });
  assert.throws(() => isoWeekDates('2021-W53'), /ISO week/);
});
test('NRS rejects partial latest periods, duplicate rows, wrong geography and future weeks', () => {
  const partial = csv('2026-W40') + '\n' + csv().split('\n')[1];
  assert.throws(() => weeklyDeaths(partial, now), /Latest NRS/);
  assert.throws(() => weeklyDeaths(csv() + '\n' + csv().split('\n')[1], now), /Duplicate/);
  assert.throws(() => weeklyDeaths(csv().replace('S92000003', 'E92000001'), now), /geography/);
  assert.throws(() => weeklyDeaths(csv().replace('Deaths,0', 'Deaths,'), now), /unavailable/);
  assert.throws(() => weeklyDeaths(csv('2026-W43'), now), /not complete/);
});
const types = ['Conventional ', 'Index-linked 3 months', 'Index-linked 8 months'];
const gilt = (type, i, date = '2026-10-16') => `<View_GILTS_IN_ISSUE CLOSE_OF_BUSINESS_DATE="${date}T00:00:00" INSTRUMENT_TYPE="${type}" ISIN_CODE="GB000000000${i}"/>`;
const xml = '<Data>' + types.map((t, i) => gilt(t, i)).join('') + '</Data>';
test('DMO counts unique instruments by class and rejects duplicates, mixed dates and malformed XML', () => {
  const d = giltsInIssue(xml, now); assert.equal(d.value, 3); assert.equal(d.by_type[0].type, 'Conventional');
  assert.throws(() => giltsInIssue(xml.replace('</Data>', gilt(types[0], 0) + '</Data>'), now), /duplicate/);
  assert.throws(() => giltsInIssue(xml.replace('2026-10-16', '2026-10-15'), now), /Mixed/);
  assert.throws(() => giltsInIssue(xml.replace('Conventional ', 'Other'), now), /Unexpected/);
  assert.throws(() => giltsInIssue(xml.slice(0, -5), now), /Invalid/);
});
const division = { EventID: '1', DocumentID: '2', DivisionDate: '2026-09-28T21:40:14.33+01:00', DivisionSubject: 'A member name never copied', MemberVoting: 'not copied' };
test('NI counts monthly divisions without personal fields and distinguishes zero from missing response', () => {
  const month = previousMonth(now);
  assert.equal(month.period, '2026-09');
  const d = assemblyDivisions({ DivisionList: { Division: [division] } }, month);
  assert.equal(d.value, 1); assert.equal(d.sitting_dates_with_divisions, 1);
  assert.ok(!JSON.stringify(d).includes(division.DivisionSubject)); assert.ok(!JSON.stringify(d).includes('MemberVoting'));
  assert.equal(assemblyDivisions({ DivisionList: null }, month).value, 0);
  assert.throws(() => assemblyDivisions({}, month), /missing/);
  assert.throws(() => assemblyDivisions({ DivisionList: {} }, month), /missing/);
  assert.throws(() => assemblyDivisions({ DivisionList: { Division: [division, division] } }, month), /duplicate/);
  assert.throws(() => assemblyDivisions({ DivisionList: { Division: { ...division, DivisionDate: '2026-10-01T00:00:00+01:00' } } }, month), /outside/);
});
test('NI calendar uses London at month rollover and handles leap years', () => {
  assert.equal(previousMonth(new Date('2026-09-30T23:30:00Z')).period, '2026-09');
  assert.equal(previousMonth(new Date('2024-03-01')).end, '2024-02-29');
  assert.equal(previousMonth(new Date('2026-01-15')).period, '2025-12');
});
const flu = { theme: 'infectious_disease', sub_theme: 'respiratory', topic: 'Influenza', metric: FLU_METRIC, geography_type: 'Nation', geography: 'England', geography_code: 'E92000001', age: 'all', sex: 'all', stratum: 'default', year: 2026, date: '2026-09-28', metric_value: 5.64, in_reporting_delay_period: false };
const page = results => ({ results, count: results.length, next: null, previous: null });
const parseFlu = rows => influenzaPositivity([page([]), page(rows)], [2025, 2026], now);
test('UKHSA selects latest across complete years and keeps reporting delay and valid zero', () => {
  const d = parseFlu([flu, { ...flu, date: '2026-10-05', metric_value: 0, in_reporting_delay_period: true }]);
  assert.equal(d.value, 0); assert.equal(d.in_reporting_delay_period, true); assert.equal(d.geography, 'England');
  assert.equal(influenzaPositivity([page([]), page([flu])], [2025, 2026], new Date('2026-11-05')).status, 'degraded');
});
test('UKHSA rejects partial pages, wrong dimensions and null latest value without substituting older data', () => {
  assert.throws(() => influenzaPositivity([page([]), { ...page([flu]), count: 2, next: 'page2' }], [2025, 2026], now), /Incomplete/);
  assert.throws(() => parseFlu([{ ...flu, geography: 'United Kingdom' }]), /mismatch/);
  assert.throws(() => parseFlu([flu, { ...flu, date: '2026-10-05', metric_value: null }]), /Latest UKHSA/);
  assert.throws(() => parseFlu([flu, flu]), /duplicate/);
  assert.throws(() => parseFlu([{ ...flu, metric_value: 101 }]), /unavailable/);
});
test('a new national source failure preserves an unrelated successful observation', async () => {
  const d = await readSections({ deaths: async () => weeklyDeaths('bad', now), working: async () => ({ value: 12 }) });
  assert.equal(d.deaths, null); assert.equal(d.sources.deaths.status, 'error'); assert.equal(d.working.value, 12);
});
