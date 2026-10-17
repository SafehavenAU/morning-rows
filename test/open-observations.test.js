import test from 'node:test';
import assert from 'node:assert/strict';
import { rfsIncidentSummary, absenceSelection, pupilAbsence, sepaRiverLevel, readPupilAbsence } from '../lib/open-observations.js';
import worker, { readEngland, readOnsNation } from '../worker.js';

const now = new Date('2026-10-17T05:30:00Z');
const item = id => `<item><title>Private incident label</title><guid>https://incidents.rfs.nsw.gov.au/api/v1/incidents/${id}</guid><description><![CDATA[ALERT LEVEL: Advice <br />LOCATION: Not copied <br />TYPE: Bush Fire]]></description></item>`;
const rss = items => `<rss><channel><title>NSW Rural Fire Service Current Incidents</title><pubDate>Sat, 17 Oct 2026 05:00:00 GMT</pubDate><copyright>State of New South Wales</copyright>${items}</channel></rss>`;
test('RFS aggregates without incident names or addresses and retains real zero', () => {
  const result = rfsIncidentSummary(rss(item(1) + item(2)), now);
  assert.equal(result.value, 2); assert.equal(result.by_alert_level[0].value, 2);
  assert.equal(result.status, 'ok'); assert.match(result.geography, /ACT/);
  assert.ok(!JSON.stringify(result).includes('Private incident'));
  assert.ok(!JSON.stringify(result).includes('Not copied'));
  assert.equal(rfsIncidentSummary(rss(''), now).value, 0);
});
test('RFS exposes delayed publication, rejects malformed, duplicated and future snapshots', () => {
  assert.equal(rfsIncidentSummary(rss(''), new Date('2026-10-18')).status, 'degraded');
  assert.throws(() => rfsIncidentSummary(rss(item(1) + item(1)), now), /duplicate/);
  assert.throws(() => rfsIncidentSummary(rss(''), new Date('2026-10-16')), /timestamp/);
  assert.throws(() => rfsIncidentSummary('<!DOCTYPE rss>' + rss(''), now), /Invalid/);
  assert.throws(() => rfsIncidentSummary(rss(item(1)).replace('TYPE:', 'UNKNOWN:'), now), /classification/);
});
const meta = {
  filters: [
    { id: 'school', column: 'phase_type_grouping', options: [{ id: 'total', label: 'Total' }] },
    { id: 'absence', column: 'absence_type', options: [{ id: 'all', label: 'Total pupils' }, { id: 'persistent', label: 'Persistent absence' }, { id: 'severe', label: 'Severe absence' }] },
  ],
  indicators: [{ id: 'count', column: 'enrolment_count', label: 'Count of pupil enrolments' }, { id: 'percent', column: 'enrolment_percent', label: 'Percentage of pupil enrolments' }],
  locations: [{ level: { code: 'NAT' }, options: [{ id: 'eng', label: 'England', code: 'E92000001' }] }],
  timePeriods: [{ code: 'AY', period: '2024/2025', label: '2024/25' }, { code: 'AY', period: '2023/2024', label: '2023/24' }],
};
const dataset = { id: '019d209c-08dc-74b6-9edb-52d521406fcf', title: 'Absence for persistent and severe absentees', status: 'Published', latestVersion: { version: '1.0', published: '2026-03-26T09:30:00Z' } };
const page = results => ({ warnings: [], paging: { page: 1, totalPages: 1, totalResults: results.length }, results });
const observations = () => page(['all', 'persistent', 'severe'].map((category, i) => ({
  geographicLevel: 'NAT', locations: { NAT: 'eng' }, timePeriod: { code: 'AY', period: '2024/2025' },
  filters: { school: 'total', absence: category }, values: { count: ['1000', '100', '0'][i], percent: ['z', '10', '0'][i] },
})));
const parse = body => pupilAbsence(body, absenceSelection(meta), dataset);
test('education selects latest academic year, England and total schools; never adds overlapping categories', () => {
  const selected = absenceSelection(meta);
  assert.equal(selected.period.label, '2024/25');
  assert.equal(selected.query.criteria.and[1].filters.eq, 'total');
  const result = parse(observations());
  assert.equal(result.rows.length, 5); assert.equal(result.period, '2024/25');
  assert.equal(result.rows.at(-1).value, 0); assert.equal(result.rows.at(-1).status, 'ok');
  assert.ok(result.rows.every(r => r.geography === 'England' && r.period_code === 'AY'));
});
test('education preserves suppression and unavailable symbols as null, rejecting blank and invalid values', () => {
  const data = observations(); data.results[1].values.percent = 'c';
  const result = parse(data);
  assert.equal(result.rows[2].value, null); assert.equal(result.rows[2].publisher_symbol, 'c');
  assert.equal(result.status, 'degraded');
  for (const value of ['', 'NaN', '101', '-1']) {
    data.results[1].values.percent = value;
    assert.throws(() => parse(data), /education/);
  }
});
test('education refuses truncated pages, unexpected dimensions, wrong geography and duplicates', () => {
  const data = observations(); data.paging.totalPages = 2;
  assert.throws(() => parse(data), /Incomplete/);
  const wrong = observations(); wrong.results[0].locations.NAT = 'wales';
  assert.throws(() => parse(wrong), /geography/);
  const dup = observations(); dup.results[2] = dup.results[1];
  assert.throws(() => parse(dup), /ambiguous/);
  assert.throws(() => absenceSelection({ ...meta, filters: [...meta.filters, { column: 'sex' }] }), /dimension/);
});
test('education reader follows the current dataset and sends explicit query selection without credentials', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options]);
    if (url.includes('/publications/')) return Response.json(page([dataset]));
    if (url.includes('/meta?')) return Response.json(meta);
    return Response.json(observations());
  });
  assert.equal((await readPupilAbsence()).rows.length, 5);
  assert.equal(calls.length, 3); assert.equal(calls[2][1].method, 'POST');
  assert.ok(calls[1][0].endsWith('dataSetVersion=1.0'));
  assert.ok(calls[2][0].endsWith('dataSetVersion=1.0'));
  assert.equal(JSON.parse(calls[2][1].body).criteria.and[0].locations.eq.code, 'E92000001');
  assert.equal(calls[2][1].headers.authorization, undefined);
});
const station = () => [{ ts_id: '61573010', station_no: '9683', station_name: 'Galashiels', ts_unitname: 'meter', ts_unitsymbol: 'm', columns: 'Timestamp,Value,Quality Code', rows: '1', data: [['2026-10-17T05:00:00.000Z', 0, 254]] }];
test('SEPA preserves gauge geography, zero, timestamp and publisher quality code', () => {
  const result = sepaRiverLevel(station());
  assert.equal(result.value, 0); assert.equal(result.quality_code, 254);
  assert.equal(result.geography, 'Galashiels, Scotland'); assert.equal(result.unit, 'metres');
});
test('SEPA rejects missing values, sentinel values, wrong station and changed units', () => {
  for (const value of [null, '', -999, -9999]) {
    const data = station(); data[0].data[0][1] = value;
    assert.throws(() => sepaRiverLevel(data), /observation/);
  }
  const data = station(); data[0].ts_unitsymbol = 'ft';
  assert.throws(() => sepaRiverLevel(data), /units/);
  data[0].ts_unitsymbol = 'm'; data[0].station_no = 'another';
  assert.throws(() => sepaRiverLevel(data), /series/);
});
test('new sources integrate into their desks and failed neighbours remain isolated', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('/publications/')) return Response.json(page([dataset]));
    if (url.includes('/meta?')) return Response.json(meta);
    if (url.includes('/query?')) return Response.json(observations());
    if (url.includes('timeseries.sepa')) return Response.json(station());
    if (url.includes('rfs.nsw.gov.au')) return new Response(rss(item(1)));
    return new Response('blocked', { status: 403 });
  });
  const england = await readEngland();
  assert.equal(england.pupil_absence.rows.length, 5); assert.equal(england.sources.pupil_absence.status, 'ok');
  assert.equal(england.sources.food_establishments.status, 'error');
  const scotland = await readOnsNation('Scotland', 'scotland', '/people', '/job', 'scotland');
  assert.equal(scotland.river_level.value, 0); assert.equal(scotland.sources.river_level.status, 'ok');
  const response = await worker.fetch(new Request('https://example.com/australia.json'));
  const au = await response.json();
  assert.equal(au.rfs_incidents.value, 1); assert.notEqual(au.sources.rfs_incidents.status, 'error');
  assert.equal(au.sources.hospital.status, 'error');
});
