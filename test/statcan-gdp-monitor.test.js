import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  parseStatcanGdp, validateStatcanGdpRepresentation, STATCAN_GDP_URLS,
} from '../lib/statcan-gdp.js';
import {
  REGISTRY, US_CONTRACT, CLAIMANT_CONTRACTS, RENT_CONTRACT, ORIGINS, inspectSource,
} from '../lib/monitor-contracts.js';
import {initialState, applyRun} from '../lib/monitor-state.js';
import {selectedResponse} from '../lib/information.js';

// Publisher inputs are the retained original files. Every run and approval
// below is a constructed test, never actual release or scheduled evidence.
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const original = '../verification/statcan-gdp-2026-10-20/original/';
const data = read(original + 'wds-selected.json');
const series = read(original + 'series-metadata.json');
const cube = read(original + 'cube-metadata.json');
const snapshot = read('../verification/structure-2026-10-17/selected-snapshot.json');
const contract = REGISTRY.find(item => item.key === 'canada/product');
const exchange = REGISTRY.find(item => item.key === 'canada/exchange');
const at = minute => new Date(Date.parse('2026-10-20T08:00:00Z') + minute * 60000).toISOString();
const native = () => parseStatcanGdp(structuredClone(data), structuredClone(series), structuredClone(cube));
const bodyFor = (value = native(), minute = 0) => ({
  ...structuredClone(snapshot.canada),
  product: value,
  sources: {...structuredClone(snapshot.canada.sources), product: {status: 'ok', fetched_at: at(minute)}},
});
const inspect = value => inspectSource(bodyFor(value), contract);
const observationId = (measure, period) => `${contract.canonical_url}&measure=${measure}&observation=${period}`;
const stateRun = (minute, outcomes) => ({
  id: `CONSTRUCTED-GDP-state-${minute}`, finished_at: at(minute), complete: true,
  scheduled: false, requests: [], probe_errors: [],
  results: Object.fromEntries(Object.entries(outcomes).map(([key, outcome]) => [
    key, Object.fromEntries(ORIGINS.map(origin => [origin, structuredClone(outcome)])),
  ])),
});
const approval = result => ({approvedVersions: {
  [contract.key]: {version: result.version, evidence: 'CONSTRUCTED-test/exact-GDP-reference'},
}});
const revised = (mutateData, mutateCube = () => {}) => {
  const changedData = structuredClone(data), changedCube = structuredClone(cube);
  mutateData(changedData[0].object);
  mutateCube(changedCube[0].object);
  return parseStatcanGdp(changedData, structuredClone(series), changedCube);
};

test('GDP strengthens its existing obligation without changing the 108 or expanded 115 source counts', () => {
  assert.equal(REGISTRY.length, 108);
  assert.equal(new Set(REGISTRY.map(item => item.key)).size, 108);
  assert.equal(REGISTRY.filter(item => item.key === contract.key).length, 1);
  assert.equal(contract.described_measures, 2);
  assert.equal(contract.observation_count, 3);
  assert.equal(contract.data, 'product');
  assert.equal(contract.health, 'sources.product');
  const expanded = [...REGISTRY, US_CONTRACT, ...CLAIMANT_CONTRACTS, RENT_CONTRACT];
  assert.equal(expanded.length, 115);
  assert.equal(new Set(expanded.map(item => item.key)).size, 115);
});

test('original GDP specimen yields exactly two quarterly levels and ordinary derived growth', async () => {
  const value = native(), result = await inspect(value);
  assert.equal(validateStatcanGdpRepresentation(value), true);
  assert.equal(result.kind, 'success', result.reason);
  assert.equal(result.observations.length, 3);
  assert.deepEqual(result.periods, ['2026-Q1', '2026-Q2']);
  assert.equal(result.nonnumeric.length, 0);
  assert.match(result.version, /^[a-f0-9]{64}$/);
  const expected = new Map([
    [observationId('level', '2026-Q1'), 2503604],
    [observationId('level', '2026-Q2'), 2524127],
    [observationId('quarter_change', '2026-Q2'), 0.82],
  ]);
  assert.deepEqual(result.observations.map(row => row.id).sort(), [...expected.keys()].sort());
  for (const row of result.observations) {
    assert.equal(row.value, expected.get(row.id));
    assert.equal(row.value_state, 'observed');
    assert.equal(row.definition.geography, 'Canada');
    assert.equal(row.definition.unit, row.id.includes('measure=level&') ? 'millions of chained (2017) dollars' : 'percent');
    assert.ok(row.source_url);
    assert.equal(row.licence, 'Statistics Canada Open Licence');
  }
  const growth = result.observations.find(row => row.id.includes('measure=quarter_change&'));
  assert.equal(growth.definition.kind, 'derived');
  assert.equal(growth.qualifications.annualized, false);
  assert.deepEqual(growth.qualifications.inputs.map(row => row.value), [2503604, 2524127]);
  assert.equal(value.period, '2026-04', 'Legacy alias remains explicitly distinct from a monthly observation');
  assert.ok(result.provenance_fields.includes('unit'));
  assert.ok(result.provenance_fields.includes('geography'));
});

test('legacy numeric GDP body cannot pass the new contract merely because transport succeeded', async () => {
  const result = await inspect({period: '2026-04', level: 2524127, quarter_change: 0.82});
  assert.equal(result.kind, 'semantic');
  assert.match(result.reason, /StatCan GDP/);
  assert.equal(result.version, undefined);
  assert.equal(result.observations, undefined);
});

test('wrong metadata, geography, periods, flags and derived meanings fail before numeric acceptance', async () => {
  const mutations = [
    ['geography', value => { value.rows[0].geography = 'Ontario'; }],
    ['unit', value => { value.rows[0].unit = 'dollars'; }],
    ['scale', value => { value.rows[0].scalar_code = 0; }],
    ['price basis', value => { value.price_basis = 'Current prices'; }],
    ['seasonal adjustment', value => { value.rows[0].adjustment = 'Unadjusted'; }],
    ['coordinate', value => { value.metadata.coordinate = '1.2.1.30.0.0.0.0.0.0'; }],
    ['vector', value => { value.metadata.vector_id++; }],
    ['dimension', value => { value.rows[0].dimensions.estimates = '1'; }],
    ['monthly alias', value => { value.rows[1].period = '2026-04'; }],
    ['quarter boundary', value => { value.rows[1].period_end = '2026-06-01'; }],
    ['raw period contradiction', value => { value.rows[1].ref_per_raw = '2026-04-01'; }],
    ['duplicate period', value => { value.rows[1] = structuredClone(value.rows[0]); }],
    ['missing quarter', value => { value.rows.pop(); }],
    ['extra quarter', value => { value.rows.push(structuredClone(value.rows[0])); }],
    ['reversed quarters', value => { value.rows.reverse(); }],
    ['wrong count', value => { value.metadata.count = 1; }],
    ['stale cube anchor', value => { value.metadata.cube_end_date = '2026-07-01'; }],
    ['incompatible cube release', value => { value.metadata.release_timestamp_raw = '2026-09-28T08:30'; }],
    ['false release timezone', value => { value.metadata.release_timezone = 'UTC'; }],
    ['wrong definition', value => { value.definitions[0].population = 'Canadian households'; }],
    ['terminated cube', value => { value.metadata.cube_archive_status = '1'; }],
    ['unestablished metadata key', value => { value.metadata.unknown_semantic_override = true; }],
    ['missing metadata', value => { delete value.metadata; }],
    ['missing definition', value => { delete value.definitions; }],
    ['null numeric', value => { value.rows[0].value = null; }],
    ['string numeric', value => { value.rows[0].value = '2503604'; }],
    ['suppressed zero', value => { value.rows[0].value = 0; value.rows[0].symbol_code = 2; }],
    ['suppressed status', value => { value.rows[0].status_code = 1; }],
    ['confidential level', value => { value.rows[0].security_level_code = 1; }],
    ['unknown symbol', value => { value.rows[0].symbol_code = 9; }],
    ['inconsistent symbol label', value => { value.rows[0].symbol = 'revised'; }],
    ['annualized growth', value => { value.growth.annualized = true; }],
    ['annualized numeric substitution', value => { value.quarter_change = value.growth.value = 3.32; }],
    ['stale derived input', value => { value.growth.previous_value++; }],
    ['latest level disagreement', value => { value.level++; }],
  ];
  for (const [label, mutate] of mutations) {
    const value = native();
    mutate(value);
    const result = await inspect(value);
    assert.equal(result.kind, 'semantic', label);
    assert.equal(result.version, undefined, label);
    assert.equal(result.observations, undefined, label);
  }
});

test('acquisition timestamps and hashes cannot create revisions; raw input ordering is normalized', async () => {
  const value = native();
  value.provenance = Object.entries(STATCAN_GDP_URLS).map(([role, url], index) => ({
    role, url, retrieved_at: at(0), bytes: 1000 + index, sha256: String(index + 1).repeat(64),
  }));
  const first = await inspectSource(bodyFor(value), contract);
  assert.equal(first.kind, 'success', first.reason);
  const refreshed = structuredClone(value);
  refreshed.provenance = refreshed.provenance.map((entry, index) => ({
    ...entry, retrieved_at: at(60), bytes: entry.bytes + 10, sha256: String(index + 4).repeat(64),
  }));
  const later = await inspectSource(bodyFor(refreshed, 60), contract);
  assert.equal(later.kind, 'success', later.reason);
  assert.equal(later.retrieved_at, at(60));
  assert.equal(later.version, first.version);
  assert.deepEqual(later.observations, first.observations);
  const reordered = await inspect(revised(value => value.vectorDataPoint.reverse()));
  assert.equal(reordered.kind, 'success', reordered.reason);
  assert.equal(reordered.version, first.version);
});

test('public GDP validation requires a real retrieval clock and refuses future quarters even without acquisition entries', async () => {
  const future = revised(
    value => {
      for (const point of value.vectorDataPoint) {
        point.refPer = point.refPer.replace('2026', '2027');
        point.refPerRaw = point.refPerRaw.replace('2026', '2027');
        point.releaseTime = point.releaseTime.replace('2026', '2027');
      }
    },
    value => {
      value.cubeEndDate = value.cubeEndDate.replace('2026', '2027');
      value.releaseTime = value.releaseTime.replace('2026', '2027');
    },
  );
  assert.deepEqual(future.provenance, []);
  assert.equal((await inspect(future)).kind, 'semantic');
  for (const timestamp of [undefined, null, '', 'not-a-date', '2026-10-20T08:00:00']) {
    const body = bodyFor();
    if (timestamp === undefined) delete body.sources.product.fetched_at;
    else body.sources.product.fetched_at = timestamp;
    const result = await inspectSource(body, contract);
    assert.equal(result.kind, 'semantic', String(timestamp));
    assert.equal(result.version, undefined);
  }
});

test('publisher release and revision symbols change versions even when the numeric levels stay identical', async () => {
  const first = await inspect(native());
  const symbols = await inspect(revised(value => { value.vectorDataPoint[0].symbolCode = 3; }));
  assert.equal(symbols.kind, 'success', symbols.reason);
  assert.notEqual(symbols.version, first.version);
  assert.equal(symbols.observations.find(row => row.period === '2026-Q1').qualifications.symbol, 'revised');
  const release = await inspect(revised(
    value => { value.vectorDataPoint[1].releaseTime = '2026-09-28T08:30'; },
    value => { value.releaseTime = '2026-09-28T08:30'; },
  ));
  assert.equal(release.kind, 'success', release.reason);
  assert.notEqual(release.version, first.version);
  assert.deepEqual(release.observations.map(row => row.value), first.observations.map(row => row.value));
});

test('a prior-quarter revision changes source and growth evidence even when growth still rounds to 0.82', async () => {
  const initial = native(), changed = revised(value => { value.vectorDataPoint[0].value++; });
  assert.equal(initial.quarter_change, 0.82);
  assert.equal(changed.quarter_change, 0.82);
  const first = await inspect(initial), second = await inspect(changed);
  assert.equal(second.kind, 'success', second.reason);
  assert.notEqual(second.version, first.version);
  assert.deepEqual(second.periods, first.periods);
  const selection = {desk: 'canada', source: 'product', entry: ['product', 'product', 'sources.product']};
  const before = (await selectedResponse(bodyFor(initial), selection)).body.observations;
  const after = (await selectedResponse(bodyFor(changed), selection)).body.observations;
  for (const id of [observationId('level', '2026-Q1'), observationId('quarter_change', '2026-Q2')])
    assert.notEqual(after.find(row => row.id === id).version, before.find(row => row.id === id).version, id);
  const retained = observationId('level', '2026-Q2');
  assert.equal(after.find(row => row.id === retained).version, before.find(row => row.id === retained).version);
});

test('a structurally valid revision remains pending until its exact independent approval exists', async () => {
  const first = await inspect(native());
  const changed = await inspect(revised(value => { value.vectorDataPoint[0].value++; }));
  let state = applyRun(initialState(at(0), {}), stateRun(0, {[contract.key]: first}), approval(first));
  const independentlyVerified = structuredClone(state.sources[contract.key].last_independently_verified);
  state = applyRun(state, stateRun(20, {[contract.key]: changed}), approval(first));
  assert.equal(state.sources[contract.key].change, 'revision');
  assert.equal(state.sources[contract.key].pending_verification.version, changed.version);
  assert.equal(state.repairs['verify:' + contract.key].state, 'evidence_review');
  assert.deepEqual(state.sources[contract.key].last_independently_verified, independentlyVerified);
  assert.equal(state.started_shadow_at, null);
  assert.ok(state.runs.every(run => run.scheduled === false));
});

test('GDP metadata failure preserves validated evidence and deduplicates its incident while Canadian exchange succeeds', async () => {
  const first = await inspect(native());
  let state = applyRun(initialState(at(0), {}), stateRun(0, {[contract.key]: first}), approval(first));
  const before = structuredClone(state.sources[contract.key]);
  const body = bodyFor();
  body.product.metadata.cube_end_date = '2026-07-01';
  const failed = await inspectSource(body, contract), sibling = await inspectSource(body, exchange);
  assert.equal(failed.kind, 'semantic');
  assert.equal(sibling.kind, 'success', sibling.reason);
  state = applyRun(state, stateRun(20, {[contract.key]: failed, [exchange.key]: sibling}));
  assert.deepEqual(state.sources[contract.key].last_contract_validated, before.last_contract_validated);
  assert.deepEqual(state.sources[contract.key].last_independently_verified, before.last_independently_verified);
  assert.equal(state.sources[exchange.key].last_successful_retrieval_at, at(20));
  assert.equal(state.incidents[contract.key].severity, 'P1');
  assert.equal(state.outbox.length, 1);
  const eventId = state.outbox[0].id;
  state = applyRun(state, stateRun(40, {[contract.key]: failed, [exchange.key]: sibling}));
  assert.equal(state.outbox.length, 1);
  assert.equal(state.outbox[0].id, eventId);
  assert.equal(state.sources[exchange.key].last_successful_retrieval_at, at(40));
});

test('metadata retrieval failures are transport failures and retain earlier GDP without invented numeric success', async () => {
  const first = await inspect(native());
  let state = applyRun(initialState(at(0), {}), stateRun(0, {[contract.key]: first}), approval(first));
  const before = structuredClone(state.sources[contract.key]);
  const body = bodyFor();
  body.sources.product = {status: 'error', http_status: 503, error: 'CONSTRUCTED cube metadata retrieval failure', fetched_at: at(1)};
  body.product = null;
  const failure = await inspectSource(body, contract);
  assert.equal(failure.kind, 'transport');
  assert.equal(failure.http_status, 503);
  assert.equal(failure.version, undefined);
  assert.equal(failure.observations, undefined);
  state = applyRun(state, stateRun(1, {[contract.key]: failure}));
  assert.equal(state.outbox.length, 0);
  state = applyRun(state, stateRun(20, {[contract.key]: failure}));
  assert.equal(state.incidents[contract.key].severity, 'P2');
  assert.equal(state.outbox.length, 1);
  assert.deepEqual(state.sources[contract.key].last_contract_validated, before.last_contract_validated);
  assert.deepEqual(state.sources[contract.key].last_independently_verified, before.last_independently_verified);
});

test('unchanged quarterly observations remain valid without an age-since-change rule or renewed independent verification', async () => {
  const first = await inspect(native());
  let state = applyRun(initialState(at(0), {}), stateRun(0, {[contract.key]: first}), approval(first));
  const before = structuredClone(state.sources[contract.key]);
  const minute = 30 * 1440, later = await inspectSource(bodyFor(native(), minute), contract);
  assert.equal(later.kind, 'success', later.reason);
  assert.equal(later.version, first.version);
  state = applyRun(state, stateRun(minute, {[contract.key]: later}));
  assert.equal(state.sources[contract.key].change, 'unchanged');
  assert.deepEqual(state.sources[contract.key].last_contract_validated, before.last_contract_validated);
  assert.deepEqual(state.sources[contract.key].last_independently_verified, before.last_independently_verified);
  assert.equal(state.sources[contract.key].last_successful_retrieval_at, at(minute));
  assert.equal(state.outbox.length, 0);
});
