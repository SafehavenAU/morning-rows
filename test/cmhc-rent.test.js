import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceError} from '../lib/sources.js';
import {CMHC_RENT_URLS, CMHC_RENT_SERIES, cmhcRentDefinitions, cmhcRentObservationRows, parseCmhcRent, readCmhcRent, validateCmhcRentRepresentation} from '../lib/cmhc-rent.js';

const clock = '2026-10-20T10:00:00Z';
const directory = '../verification/remaining-gaps-2026-10-20/cmhc-rent/original/';
const fixture = () => Object.fromEntries(Object.entries({data: 'points.json', series: 'series.json', cube: 'cube-response-excerpt.json'})
  .map(([role, file]) => [role, JSON.parse(readFileSync(new URL(directory + file, import.meta.url)))]));
const parse = (f = fixture()) => parseCmhcRent(f.data, f.series, f.cube);
const point = f => f.data[0].object.vectorDataPoint[0];
const cube = f => f.cube[0].object;
const member = (f, position, id) => cube(f).dimension.find(d => d.dimensionPositionId === position).member.find(m => m.memberId === id);
const mock = (f, transform = response => response, observed = []) => async (url, options) => {
  const role = Object.keys(CMHC_RENT_URLS).find(k => CMHC_RENT_URLS[k] === url);
  assert.ok(role); assert.equal(options.method, 'POST'); assert.ok(options.signal instanceof AbortSignal);
  const query = JSON.parse(options.body);
  assert.deepEqual(query, role === 'cube' ? [{productId: 34100133}] : CMHC_RENT_SERIES.map(s => ({productId: 34100133, coordinate: s.coordinate, ...(role === 'data' ? {latestN: 1} : {})})));
  observed.push(role);
  return transform(new Response(JSON.stringify(f[role])), role);
};

test('retained WDS values match independent CSV, exact geography, annual October convention and definitions', async () => {
  const value = parse(), reference = JSON.parse(readFileSync(new URL(directory + '../independent-report.json', import.meta.url)));
  assert.equal(reference.pass, true);
  assert.deepEqual(value.rows.map(r => ({measure_id: r.measure_id, period: r.period, value: r.value, geography: r.geography, dguid: r.dguid, survey_month: r.survey_month})),
    reference.rows.map(r => ({measure_id: r.measure_id, period: r.period, value: r.value, geography: r.geography, dguid: r.geography_code, survey_month: r.survey_month})));
  assert.deepEqual(reference.comparisons.map(r => [r.csv, r.wds, r.match]), [['2121', '2121.0', true], ['991', '991.0', true]]);
  assert.deepEqual(reference.missingness_control, {coordinate: '66.2.3', value: null, status: 'F', converted_to_zero: false});
  assert.deepEqual(value.rows.map(r => [r.period, r.reference_date, r.ref_per_raw, r.survey_month, r.period_start, r.period_end]),
    Array(2).fill(['2025', '2025-01-01', '2025-10-01', '2025-10', '2025-10-01', '2025-10-31']));
  assert.deepEqual(value.rows.map(r => [r.geography_type, r.dguid]), [['Census metropolitan area', '2011S0503935'], ['Census agglomeration', '2011S0504440']]);
  assert.deepEqual(value.rows.map(r => r.measure_id), cmhcRentDefinitions().map(d => d.id));
  assert.equal(cmhcRentObservationRows(value), value.rows);
  assert.equal(value.metadata.latest_period, '2025'); assert.equal(value.metadata.count, 2);
  assert.equal(validateCmhcRentRepresentation(value), true);
  const acquired = await readCmhcRent({fetcher: mock(fixture()), now: () => clock});
  assert.equal(validateCmhcRentRepresentation(acquired, {retrieved_at: clock}), true);
  assert.equal(validateCmhcRentRepresentation(value, {retrieved_at: clock}), false);
  assert.equal(value.rows[0].release_timestamp_raw, '2025-12-17T08:30');
  assert.equal(value.rows[0].release_timezone, null);
  assert.match(value.rows[0].definition.population, /vacant and occupied/);
  assert.match(value.rows[0].definition.period_convention, /not an average over twelve/);
  assert.match(value.limitations, /not a current asking-rent quote/);
});
test('all returned results and individual observations retain conditional licence notices without claiming consent', () => {
  const value = parse();
  for (const notice of [value.licence_notice, ...value.rows.map(r => r.licence_notice)]) {
    assert.match(notice.source_notice, /2025/); assert.match(notice.source_notice, /"as is"/);
    assert.match(notice.adaptation_notice, /does not constitute an endorsement/);
    assert.equal(notice.terms_url, 'https://www.cmhc-schl.gc.ca/about-us/terms-conditions/hmip-terms-conditions');
    assert.match(notice.conditions, /Using these CMHC data constitutes agreement/);
    assert.match(notice.conditions, /recipients to agree/);
    assert.match(notice.conditions, /No recipient acceptance is recorded/);
  }
  assert.ok(value.definitions.every(d => d.licence === value.licence && d.licence_url === value.licence_url && d.licence_conditions === value.licence_notice.conditions));
});
test('publisher row, dimension and member ordering cannot swap values between similar place names', () => {
  const f = fixture(); f.data.reverse(); f.series.reverse(); cube(f).dimension.reverse();
  for (const d of cube(f).dimension) d.member.reverse();
  assert.deepEqual(parse(f), parse());
});
const mutations = {
  'data product identity': f => { f.data[0].object.productId++; },
  'coordinate identity': f => { f.data[0].object.coordinate = '186.2.3.0.0.0.0.0.0.0'; },
  'vector identity': f => { f.data[0].object.vectorId++; },
  'missing area': f => { f.data.pop(); },
  'extra area': f => { f.data.push(structuredClone(f.data[0])); },
  'duplicate area': f => { f.data[1] = structuredClone(f.data[0]); },
  'failed data envelope': f => { f.data[0].status = 'FAILURE'; },
  'data response code': f => { f.data[0].object.responseStatusCode = 1; },
  'missing series': f => { f.series.pop(); },
  'series product identity': f => { f.series[0].object.productId++; },
  'series coordinate identity': f => { f.series[0].object.coordinate = '186.2.3.0.0.0.0.0.0.0'; },
  'series vector identity': f => { f.series[0].object.vectorId++; },
  'duplicate series': f => { f.series[1] = structuredClone(f.series[0]); },
  'apartment-only title': f => { f.series[0].object.SeriesTitleEn = f.series[0].object.SeriesTitleEn.replace('Row and apartment', 'Apartment'); },
  'series unit': f => { f.series[0].object.memberUomCode = 90; },
  'series scale': f => { f.series[0].object.scalarFactorCode = 3; },
  'series precision': f => { f.series[0].object.decimals = 1; },
  'series frequency': f => { f.series[0].object.frequencyCode = 6; },
  'terminated series': f => { f.series[0].object.terminated = 1; },
  'missing cube': f => { f.cube = []; },
  'failed cube': f => { f.cube[0].status = 'FAILURE'; },
  'cube response code': f => { cube(f).responseStatusCode = 1; },
  'cube title': f => { cube(f).cubeTitleEn += ' changed'; },
  'cube product': f => { cube(f).productId = '34100134'; },
  'cube frequency': f => { cube(f).frequencyCode = 6; },
  'archived cube': f => { cube(f).archiveStatusCode = '1'; },
  'inverted cube years': f => { cube(f).cubeStartDate = '2026-01-01'; },
  'nonannual cube': f => { cube(f).cubeEndDate = '2025-10-01'; },
  'missing cube dimension': f => { cube(f).dimension.pop(); },
  'duplicate cube dimension': f => { cube(f).dimension[1] = structuredClone(cube(f).dimension[0]); },
  'wrong dimension name': f => { cube(f).dimension[2].dimensionNameEn = 'Age'; },
  'wrong dimension unit flag': f => { cube(f).dimension[2].hasUom = false; },
  'geography name': f => { member(f, 1, 186).memberNameEn = 'Victoria municipality'; },
  'geography classification': f => { member(f, 1, 186).classificationCode = '440'; },
  'geography level': f => { member(f, 1, 186).geoLevel = 504; },
  'geography vintage': f => { member(f, 1, 186).vintage = 2021; },
  'geography terminated': f => { member(f, 1, 186).terminated = 1; },
  'structure definition': f => { member(f, 2, 3).memberNameEn = 'Apartment structures of three units and over'; },
  'bedroom definition': f => { member(f, 3, 3).memberNameEn = 'Three bedroom units'; },
  'member unit': f => { member(f, 3, 3).memberUomCode = 90; },
  'duplicate selected member': f => { cube(f).dimension[0].member.push(structuredClone(member(f, 1, 186))); },
  'missing applicable licence': f => { cube(f).footnote = cube(f).footnote.filter(n => n.footnoteId !== 2); },
  'other licence URL': f => { cube(f).footnote.find(n => n.footnoteId === 2).footnotesEn = cube(f).footnote.find(n => n.footnoteId === 2).footnotesEn.replace('hmip-terms-conditions', 'other-terms'); },
  'contradictory licence wording': f => { cube(f).footnote.find(n => n.footnoteId === 2).footnotesEn = 'No licence is required. ' + cube(f).footnote.find(n => n.footnoteId === 2).footnotesEn; },
  'licence restricted to another geography': f => { cube(f).footnote.find(n => n.footnoteId === 2).link.memberId = 66; },
  'missing annual point': f => { f.data[0].object.vectorDataPoint = []; },
  'extra annual point': f => { f.data[0].object.vectorDataPoint.push(structuredClone(point(f))); },
  'previous-year substitution': f => { point(f).refPer = '2024-01-01'; point(f).refPerRaw = '2024-10-01'; },
  'mixed survey years': f => { point(f).refPer = '2026-01-01'; point(f).refPerRaw = '2026-10-01'; },
  'incorrect raw survey month': f => { point(f).refPerRaw = '2025-01-01'; },
  'secondary reference': f => { point(f).refPer2 = '2025-01-01'; },
  'secondary raw reference': f => { point(f).refPerRaw2 = '2025-10-01'; },
  'point frequency': f => { point(f).frequencyCode = 6; },
  'point scale': f => { point(f).scalarFactorCode = 3; },
  'point precision': f => { point(f).decimals = 1; },
  'missing value': f => { delete point(f).value; },
  'null value': f => { point(f).value = null; },
  'string value': f => { point(f).value = '2121'; },
  'nonfinite value': f => { point(f).value = Infinity; },
  'nonpositive value': f => { point(f).value = 0; },
  'negative value': f => { point(f).value = -1; },
  'overprecision value': f => { point(f).value = 2121.1; },
  'unsafe value': f => { point(f).value = Number.MAX_SAFE_INTEGER + 1; },
  'confidential point': f => { point(f).securityLevelCode = 1; },
  'missing status': f => { delete point(f).statusCode; },
  'unavailable point': f => { point(f).statusCode = 1; },
  'unreliable F status': f => { point(f).statusCode = 8; },
  'unknown status': f => { point(f).statusCode = 99; },
  'unknown symbol': f => { point(f).symbolCode = 99; },
  'unreviewed symbol': f => { point(f).symbolCode = 2; },
  'invented release timezone': f => { point(f).releaseTime += 'Z'; },
  'mismatched release': f => { point(f).releaseTime = '2025-12-18T08:30'; },
  'release before survey': f => { cube(f).releaseTime = '2025-09-30T08:30'; for (const d of f.data) d.object.vectorDataPoint[0].releaseTime = cube(f).releaseTime; },
};
for (const [name, mutate] of Object.entries(mutations)) test('parser refuses ' + name, () => {
  const f = fixture(); mutate(f); assert.throws(() => parse(f), SourceError);
});
test('supported preliminary and revised symbols remain numeric but explicitly qualified', async () => {
  for (const [code, label] of [[0, 'none'], [1, 'preliminary'], [3, 'revised']]) {
    const f = fixture(); point(f).symbolCode = code;
    const value = await readCmhcRent({fetcher: mock(f), now: () => clock}); assert.equal(value.rows[0].symbol, label); assert.equal(value.rows[0].value, 2121);
    assert.equal(validateCmhcRentRepresentation(value, {retrieved_at: clock}), true);
  }
});
test('dynamic next annual release is accepted only with matching cube, both points and a sufficient acquisition clock', async () => {
  const f = fixture(); cube(f).cubeEndDate = '2026-01-01'; cube(f).releaseTime = '2026-12-17T08:30';
  for (const d of f.data) Object.assign(d.object.vectorDataPoint[0], {refPer: '2026-01-01', refPerRaw: '2026-10-01', releaseTime: cube(f).releaseTime});
  const value = await readCmhcRent({fetcher: mock(f), now: () => '2026-12-17T12:00:00Z'});
  assert.equal(value.metadata.latest_period, '2026');
  assert.equal(validateCmhcRentRepresentation(value), true);
  assert.equal(validateCmhcRentRepresentation(value, {retrieved_at: clock}), false);
  assert.equal(validateCmhcRentRepresentation(value, {retrieved_at: '2026-12-17T12:00:00Z'}), true);
});
test('native validator is total and explicit missing or malformed clocks cannot disable the future guard', async () => {
  for (const value of [null, undefined, [], {}, {rows: [null, {}], metadata: {}}]) assert.equal(validateCmhcRentRepresentation(value, {retrieved_at: clock}), false);
  const value = await readCmhcRent({fetcher: mock(fixture()), now: () => clock});
  for (const acquisition of [undefined, null, {}, {retrieved_at: undefined}, {retrieved_at: null}, {retrieved_at: 'bad'}, {retrieved_at: '2026-02-30T00:00:00Z'}, {retrieved_at: '2025-10-20T00:00:00Z'}])
    assert.equal(validateCmhcRentRepresentation(value, acquisition), false);
});
test('native validation catches changed semantics, metadata, stale aliases and stripped conditional notices', async () => {
  const original = await readCmhcRent({fetcher: mock(fixture()), now: () => clock});
  for (const mutate of [
    v => { v.rows[0].geography = 'Victoriaville, Quebec'; }, v => { v.rows[0].dguid = '2011S0504440'; },
    v => { v.rows[0].measure_id = v.rows[1].measure_id; }, v => { v.rows[0].period = '2024'; },
    v => { v.rows[0].survey_month = '2025-01'; }, v => { v.rows[0].unit = 'CAD per year'; },
    v => { v.rows[0].dimensions.structure = '2'; }, v => { v.rows[0].release_timezone = 'UTC'; },
    v => { v.rows[0].definition.population = 'Current asking rents'; }, v => { v.rows[0].symbol = 'final'; },
    v => { v.metadata.count = 1; }, v => { v.metadata.latest_period = '2024'; },
    v => { v.metadata.release_timezone = 'UTC'; }, v => { v.licence = 'Public domain'; },
    v => { delete v.rows[0].licence_notice; }, v => { v.rows[0].licence_notice.conditions = 'Recipients agreed'; },
    v => { v.licence_notice.adaptation_notice = ''; }, v => { v.rows.reverse(); },
  ]) {
    const value = structuredClone(original); mutate(value); assert.equal(validateCmhcRentRepresentation(value, {retrieved_at: clock}), false);
  }
});
test('original value and release revisions remain visible; acquisition provenance is separate from rows', async () => {
  const before = parse(), f = fixture(); point(f).value++;
  assert.notDeepEqual(parse(f).rows[0], before.rows[0]); assert.deepEqual(parse(f).rows[1], before.rows[1]);
  const first = await readCmhcRent({fetcher: mock(fixture()), now: () => clock});
  const second = await readCmhcRent({fetcher: mock(fixture()), now: () => '2026-10-20T11:00:00Z'});
  assert.deepEqual(first.rows, second.rows); assert.notDeepEqual(first.provenance, second.provenance);
  assert.ok(first.rows.every(r => !Object.hasOwn(r, 'provenance')));
});
test('reader issues exactly three bounded requests with no fallback or arbitrary selectors', async () => {
  const observed = [];
  const value = await readCmhcRent({fetcher: mock(fixture(), r => r, observed), now: () => clock});
  assert.deepEqual(observed.sort(), ['cube', 'data', 'series']);
  assert.equal(validateCmhcRentRepresentation(value, {retrieved_at: clock}), true);
  assert.equal(value.provenance.length, 3);
  for (const p of value.provenance) { assert.match(p.sha256, /^[0-9a-f]{64}$/); assert.ok(p.bytes > 0); assert.equal(p.retrieved_at, clock); }
});
for (const [name, make] of Object.entries({
  HTTP: () => new Response('unavailable', {status: 503}),
  JSON: () => new Response('{'),
  UTF8: () => new Response(new Uint8Array([255])),
  empty: () => new Response(''),
  length: () => new Response('{}', {headers: {'content-length': '9999999'}}),
  stream: () => new Response(' '.repeat(16385)),
  redirect: () => { const r = new Response('{}'); Object.defineProperty(r, 'url', {value: 'https://example.org/other'}); return r; },
})) test('reader fails closed on ' + name, async () => {
  await assert.rejects(() => readCmhcRent({fetcher: mock(fixture(), (r, role) => role === 'data' ? make() : r), now: () => clock}));
});
test('cube streaming and advertised byte limits are enforced independently of smaller response limits', async () => {
  for (const make of [() => new Response(' '.repeat(131073)), () => new Response('{}', {headers: {'content-length': '131073'}})])
    await assert.rejects(() => readCmhcRent({fetcher: mock(fixture(), (r, role) => role === 'cube' ? make() : r), now: () => clock}));
});
test('timeouts and bad acquisition clocks never yield retained specimen values', async () => {
  await assert.rejects(() => readCmhcRent({fetcher: async () => { throw new DOMException('timed out', 'TimeoutError'); }, now: () => clock}), e => e.name === 'TimeoutError');
  for (const now of [() => 'bad', () => '2025-01-01T00:00:00Z'])
    await assert.rejects(() => readCmhcRent({fetcher: mock(fixture()), now}));
  await assert.rejects(() => readCmhcRent({fetcher: mock(fixture(), (r, role) => role === 'data' ? new Response('denied', {status: 429}) : r), now: () => clock}), e => e instanceof SourceError && e.status === 429);
});
test('public provenance rejects incomplete acquisitions, duplicate roles and false metadata', async () => {
  const original = await readCmhcRent({fetcher: mock(fixture()), now: () => clock});
  for (const mutate of [
    v => { v.provenance = []; }, v => { v.provenance.pop(); }, v => { v.provenance[1] = structuredClone(v.provenance[0]); },
    v => { v.provenance[0].url += 'other'; }, v => { v.provenance[0].sha256 = 'bad'; },
    v => { v.provenance[0].bytes = 0; }, v => { v.provenance[0].bytes = 131073; },
    v => { v.provenance[0].retrieved_at = '2025-01-01T00:00:00Z'; },
    v => { v.provenance[0].retrieved_at = '2026-10-20T10:00:00.001Z'; },
  ]) {
    const value = structuredClone(original); mutate(value);
    assert.equal(validateCmhcRentRepresentation(value, {retrieved_at: clock}), false);
  }
});
