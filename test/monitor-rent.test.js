import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readNzMarketRent, validateNzRentRepresentation, NZ_RENT_LOCATIONS} from '../lib/nz-market-rent.js';
import {parseClaimantTime, parseClaimantCounts} from '../lib/claimant-count.js';
import {REGISTRY, US_CONTRACT, CLAIMANT_CONTRACTS, RENT_CONTRACT, ORIGINS, inspectSource} from '../lib/monitor-contracts.js';
import {initialState, applyRun} from '../lib/monitor-state.js';
import {catalogue} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';
import {collect} from '../scripts/monitor.mjs';
import {buildMonitorRegistry} from '../scripts/monitor-registry.mjs';

// All acquisition and collection responses below are injected local fixtures.
// Constructed runs are not publication, release or scheduled-operation evidence.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const original = '../verification/nz-market-rent-2026-10-20/original/';
const tables = {
  'nz-auckland-avondale': read(original + 'avondale-ajax.html'),
  'nz-wellington-kelburn': read(original + 'kelburn-ajax.html'),
};
const at = minute => new Date(Date.parse('2026-10-20T05:20:00Z') + minute * 60000).toISOString();
const snapshot = JSON.parse(read('../verification/structure-2026-10-17/selected-snapshot.json'));
const usBody = JSON.parse(read('../verification/us-paid-2026-10-20/replay-us-body.json'));
const claimantPath = '../verification/claimant-count-2026-10-20/original/';
const claimants = parseClaimantCounts(read(claimantPath + 'nomis-national.csv'),
  parseClaimantTime(JSON.parse(read(claimantPath + 'nomis-time.json'))));
const claimantReview = JSON.parse(read('../verification/claimant-count-2026-10-20/proposed-review.json'));
const finalIdentity = {
  source_revision: 'd'.repeat(40), source_dirty: false, build_fingerprint: 'd'.repeat(16),
  worker_version: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
};
const review = () => ({
  ...structuredClone(claimantReview),
  continuations: [
    ...structuredClone(claimantReview.continuations),
    {from: structuredClone(claimantReview.continuations.at(-1).to),
      to: structuredClone(finalIdentity), scope: 'nine-desks-plus-claimants-and-nz-rent',
      evidence: 'CONSTRUCTED-test/nz-rent-evidence.json'},
  ],
});
async function rentFixture({failed = [], minute = 0, transform = (_, html) => html} = {}) {
  const requests = [];
  const native = await readNzMarketRent({
    now: () => at(minute),
    fetcher: async url => {
      const location = Object.values(NZ_RENT_LOCATIONS).find(place => place.source_url === url);
      assert.ok(location, 'No publisher URL beyond the two fixed fixture locations');
      requests.push(location.id);
      if (failed.includes(location.id)) return new Response('constructed upstream failure', {status: 503});
      return new Response(JSON.stringify({Finder: '', Table: transform(location.id, tables[location.id])}), {
        headers: {'content-type': 'application/json'},
      });
    },
  });
  assert.deepEqual(requests.sort(), Object.keys(tables).sort());
  return native;
}
const native = await rentFixture();
const rentBody = (value = native, minute = 0) => ({
  ...structuredClone(snapshot['new-zealand']),
  market_rent: structuredClone(value),
  sources: {...structuredClone(snapshot['new-zealand'].sources), market_rent: {
    status: value.status, fetched_at: at(minute),
    ...(value.status === 'error' ? {error: 'All fixed rent locations failed', locations: value.locations} : {}),
  }},
});
const inspect = value => inspectSource(rentBody(value), RENT_CONTRACT);
function fixtureReader(mutate = () => {}) {
  const urls = [];
  return {urls, reader: async url => {
    urls.push(url);
    const parsed = new URL(url), desk = parsed.pathname.slice(1, -5);
    let body;
    if (parsed.pathname === '/health.json') body = structuredClone(finalIdentity);
    else if (parsed.pathname === '/catalog.json') body = catalogue();
    else if (parsed.pathname === '/catalog.v2.json') body = catalogueV2();
    else if (desk === 'united-states') body = structuredClone(usBody);
    else if (desk === 'new-zealand') body = rentBody();
    else {
      body = structuredClone(snapshot[desk]);
      if (claimants[desk]) {
        body.claimant_count = structuredClone(claimants[desk]);
        body.sources.claimant_count = {status: 'ok', fetched_at: at(0)};
      }
    }
    mutate(body, parsed);
    return {status: 200, bytes: JSON.stringify(body).length, data: body};
  }};
}
const stateRun = (minute, outcomes) => ({
  id: `CONSTRUCTED-rent-state-${minute}`, finished_at: at(minute), complete: true,
  scheduled: false, requests: [], probe_errors: [],
  results: Object.fromEntries(Object.entries(outcomes).map(([key, result]) => [
    key, Object.fromEntries(ORIGINS.map(origin => [origin, structuredClone(result)])),
  ])),
});

test('one staged rent source describes possible measures but monitors only the 29 actually reported tuples', async () => {
  assert.equal(REGISTRY.length, 108);
  assert.ok(!REGISTRY.some(contract => contract.key === RENT_CONTRACT.key));
  assert.equal(RENT_CONTRACT.key, 'new-zealand/market_rent');
  assert.equal(RENT_CONTRACT.described_measures, 200);
  assert.equal(RENT_CONTRACT.observations_per_row, 4);
  assert.equal(validateNzRentRepresentation(native), true);
  assert.equal(native.rows.length, 29);
  const result = await inspect(native);
  assert.equal(result.kind, 'success', result.reason);
  assert.equal(result.observations.length, 116);
  assert.equal(new Set(result.observations.map(row => row.id)).size, 116);
  assert.equal(result.nonnumeric.length, 0);
  assert.match(result.version, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.periods, ['2026-03-01/2026-08-31']);
  for (const row of native.rows) {
    for (const statistic of ['lower_quartile', 'median', 'upper_quartile', 'active_bonds']) {
      const measure = `${row.location_id}.${row.dwelling_key}.${row.bedroom_key}.${statistic}`;
      const observation = result.observations.find(item =>
        new URL(item.id).searchParams.get('measure') === measure);
      assert.ok(observation, measure);
      assert.equal(observation.value, row[statistic]);
      assert.equal(observation.value_state, 'observed');
      assert.equal(observation.period, row.period);
      assert.equal(observation.definition.unit, statistic === 'active_bonds' ? 'bonds' : 'NZD per week');
      assert.equal(observation.definition.geography, row.geography);
    }
  }
});

test('rent observation identities and semantic version survive retrieval and acquisition-only provenance changes', async () => {
  const originalResult = await inspect(native);
  const refreshed = await rentFixture({minute: 10});
  refreshed.provenance = refreshed.provenance.map((entry, index) => ({
    ...entry, sha256: (index ? 'b' : 'a').repeat(64), bytes: entry.bytes + 1,
  }));
  assert.equal(validateNzRentRepresentation(refreshed), true);
  const result = await inspectSource(rentBody(refreshed, 10), RENT_CONTRACT);
  assert.equal(result.kind, 'success', result.reason);
  assert.equal(result.retrieved_at, at(10));
  assert.equal(result.version, originalResult.version);
  assert.deepEqual(result.observations, originalResult.observations);
  const reordered = structuredClone(refreshed);
  reordered.rows.reverse();
  assert.equal((await inspect(reordered)).version, originalResult.version);
});

test('real value, published tuple coverage and reference-window changes revise the rent monitor version', async () => {
  const originalResult = await inspect(native);
  const revised = structuredClone(native);
  revised.rows[0].active_bonds++;
  const changedValue = await inspect(revised);
  assert.equal(changedValue.kind, 'success', changedValue.reason);
  assert.notEqual(changedValue.version, originalResult.version);
  assert.deepEqual(changedValue.observations.map(row => row.id), originalResult.observations.map(row => row.id));

  // A changed publisher tuple set is meaningful; the unused 200-definition
  // matrix must not fabricate rows or turn an absent tuple into four zeros.
  const fewerTuples = structuredClone(native), removed = fewerTuples.rows.shift();
  const location = fewerTuples.locations.find(place => place.id === removed.location_id);
  location.row_count--;
  location.table_counts[removed.dwelling_key]--;
  fewerTuples.metadata.count--;
  const changedTuples = await inspect(fewerTuples);
  assert.equal(changedTuples.kind, 'success', changedTuples.reason);
  assert.equal(changedTuples.observations.length, 112);
  assert.notEqual(changedTuples.version, originalResult.version);

  const newerWindow = await rentFixture({transform: (_, html) =>
    html.replace('01 Mar 2026 - 31 Aug 2026', '01 Apr 2026 - 30 Sep 2026')});
  const changedWindow = await inspect(newerWindow);
  assert.equal(changedWindow.kind, 'success', changedWindow.reason);
  assert.equal(changedWindow.observations.length, 116);
  assert.deepEqual(changedWindow.periods, ['2026-04-01/2026-09-30']);
  assert.notEqual(changedWindow.version, originalResult.version);
  assert.ok(changedWindow.observations.every(row =>
    !originalResult.observations.some(previous => previous.id === row.id)));
});

test('wrong locality, mixed windows and inconsistent reported-tuple metadata fail semantically', async () => {
  const mutations = [
    ['wrong city', value => { value.rows[0].city = 'Wellington'; }],
    ['wrong suburb', value => { value.rows[0].suburb = 'Kelburn'; }],
    ['wrong geography', value => { value.rows[0].geography = 'Wellington - Kelburn'; }],
    ['unmatched tuple removal', value => { value.rows.pop(); }],
    ['duplicate tuple', value => { value.rows[1] = structuredClone(value.rows[0]); }],
  ];
  for (const [label, mutate] of mutations) {
    const value = structuredClone(native);
    mutate(value);
    const result = await inspect(value);
    assert.equal(result.kind, 'semantic', label);
    assert.equal(result.version, undefined, label);
  }
  const mixed = await rentFixture({transform: (id, html) => id === 'nz-wellington-kelburn'
    ? html.replace('01 Mar 2026 - 31 Aug 2026', '01 Apr 2026 - 30 Sep 2026') : html});
  assert.equal(mixed.rows.length, 29);
  assert.equal(mixed.locations.every(place => place.status === 'ok'), true);
  assert.equal(mixed.metadata.window_consistent, false);
  assert.equal((await inspect(mixed)).kind, 'semantic');
});

test('one locality failure retains successful rows as degraded without inventing missing-place observations', async () => {
  for (const [failed, healthy, count] of [
    ['nz-wellington-kelburn', 'nz-auckland-avondale', 52],
    ['nz-auckland-avondale', 'nz-wellington-kelburn', 64],
  ]) {
    const partial = await rentFixture({failed: [failed]});
    assert.equal(partial.status, 'degraded');
    assert.equal(validateNzRentRepresentation(partial), true);
    const result = await inspect(partial);
    assert.equal(result.kind, 'degraded', result.reason);
    assert.equal(result.reason, 'publisher_partial_or_delayed');
    assert.equal(result.observations.length, count);
    assert.ok(result.observations.every(row => row.definition.dimensions.location === healthy));
    assert.ok(result.observations.every(row => row.value_state === 'observed'));
    assert.equal(result.nonnumeric.length, 0);
  }
});

test('partial rent retrieval keeps the prior validated contract while successful siblings continue', async () => {
  const good = await inspect(native);
  const statsContract = REGISTRY.find(contract => contract.key === 'new-zealand/stats');
  const stats = await inspectSource(rentBody(), statsContract);
  assert.equal(stats.kind, 'success');
  const base = applyRun(initialState(at(0), {}), stateRun(0, {
    [RENT_CONTRACT.key]: good, [statsContract.key]: stats,
  }), {approvedVersions: {
    [RENT_CONTRACT.key]: {version: good.version, evidence: 'CONSTRUCTED-retained-rent-reference'},
    [statsContract.key]: {version: stats.version, evidence: 'CONSTRUCTED-existing-stats-reference'},
  }});
  const partial = await inspect(await rentFixture({failed: ['nz-wellington-kelburn'], minute: 20}));
  const after = applyRun(base, stateRun(20, {[RENT_CONTRACT.key]: partial, [statsContract.key]: stats}));
  assert.deepEqual(after.sources[RENT_CONTRACT.key].last_contract_validated,
    base.sources[RENT_CONTRACT.key].last_contract_validated);
  assert.deepEqual(after.sources[RENT_CONTRACT.key].last_independently_verified,
    base.sources[RENT_CONTRACT.key].last_independently_verified);
  assert.equal(after.sources[RENT_CONTRACT.key].last_attempt.outcomes[ORIGINS[0]].kind, 'degraded');
  assert.equal(after.sources[statsContract.key].last_successful_retrieval_at, at(20));
  assert.equal(after.incidents[statsContract.key], undefined);
  const confirmed = applyRun(after, stateRun(40, {[RENT_CONTRACT.key]: partial, [statsContract.key]: stats}));
  assert.equal(confirmed.incidents[RENT_CONTRACT.key].kind, 'availability');
  assert.equal(confirmed.incidents[RENT_CONTRACT.key].severity, 'P2');
  assert.deepEqual(confirmed.sources[RENT_CONTRACT.key].last_contract_validated,
    base.sources[RENT_CONTRACT.key].last_contract_validated);
});

test('all-locality failure is a source transport error and cannot erase unrelated NZ results', async () => {
  const failed = await rentFixture({failed: Object.keys(tables)});
  assert.equal(failed.status, 'error');
  const body = rentBody(failed);
  const result = await inspectSource(body, RENT_CONTRACT);
  assert.equal(result.kind, 'transport');
  assert.equal(result.version, undefined);
  assert.equal(result.observations, undefined);
  assert.equal((await inspectSource(body, REGISTRY.find(c => c.key === 'new-zealand/stats'))).kind, 'success');
});

test('rent collection requires explicit compatible boolean scope before any public read', async () => {
  for (const flags of [
    {includeRent: true},
    {includeUs: true, includeRent: true},
    {includeClaimants: true, includeRent: true},
    {includeUs: true, includeClaimants: true, includeRent: 'true'},
    {includeUs: true, includeClaimants: true, includeRent: 1},
    {includeUs: true, includeClaimants: true, includeRent: null},
  ]) {
    let reads = 0;
    await assert.rejects(collect({...flags, read: async () => { reads++; throw Error('No read permitted'); }}));
    assert.equal(reads, 0);
  }
});

test('rent adds one obligation and no public probes while preserving all legacy, USA and claimant results', async () => {
  for (const [flags, count, requestCount] of [
    [{}, 108, 20],
    [{includeUs: true}, 109, 24],
    [{includeUs: true, includeClaimants: true}, 114, 24],
    [{includeUs: true, includeClaimants: true, includeRent: true}, 115, 24],
  ]) {
    const {reader, urls} = fixtureReader();
    const report = await collect({...flags, read: reader, now: () => at(0), id: `CONSTRUCTED-rent-scope-${count}`});
    assert.equal(report.complete, true);
    assert.equal(report.requests.length, requestCount);
    assert.equal(urls.length, requestCount);
    assert.equal(new Set(urls).size, requestCount);
    assert.equal(Object.keys(report.results).length, count);
    assert.ok(urls.every(url => !new URL(url).search), 'Obligations reuse full desk responses');
    assert.deepEqual(report.probe_errors, []);
    if (!flags.includeRent) assert.equal(report.results[RENT_CONTRACT.key], undefined);
    else {
      assert.equal(report.scope, 'nine-desks-plus-claimants-and-nz-rent');
      for (const origin of ORIGINS) {
        assert.equal(report.results[RENT_CONTRACT.key][origin].kind, 'success');
        assert.equal(report.results[RENT_CONTRACT.key][origin].observations.length, 116);
        for (const contract of CLAIMANT_CONTRACTS)
          assert.equal(report.results[contract.key][origin].observations.length, 13);
        for (const key of [US_CONTRACT.key, 'new-zealand/stats', 'wales/projection', 'australia/hospital'])
          assert.equal(report.results[key][origin].kind, 'success', key);
      }
    }
  }
});

test('collector retains partial rent observations without turning a source failure into a failed collection', async () => {
  const partial = await rentFixture({failed: ['nz-wellington-kelburn']});
  const priceContract = REGISTRY.find(contract => contract.key === 'new-zealand/prices');
  const retainedPrices = await inspectSource(rentBody(), priceContract);
  const {reader, urls} = fixtureReader((body, url) => {
    if (url.origin === ORIGINS[0] && url.pathname === '/new-zealand.json') {
      body.market_rent = structuredClone(partial);
      body.sources.market_rent.status = 'degraded';
    }
  });
  const report = await collect({includeUs: true, includeClaimants: true, includeRent: true,
    read: reader, now: () => at(0), id: 'CONSTRUCTED-partial-rent-collection'});
  assert.equal(report.complete, true);
  assert.equal(urls.length, 24);
  assert.equal(Object.keys(report.results).length, 115);
  assert.equal(report.results[RENT_CONTRACT.key][ORIGINS[0]].kind, 'degraded');
  assert.equal(report.results[RENT_CONTRACT.key][ORIGINS[0]].observations.length, 52);
  assert.equal(report.results[RENT_CONTRACT.key][ORIGINS[1]].kind, 'success');
  assert.equal(report.results[RENT_CONTRACT.key][ORIGINS[1]].observations.length, 116);
  for (const key of ['new-zealand/stats', 'england/claimant_count', US_CONTRACT.key])
    for (const origin of ORIGINS) assert.equal(report.results[key][origin].kind, 'success', key);
  for (const origin of ORIGINS)
    assert.deepEqual(report.results[priceContract.key][origin], retainedPrices,
      'The dated fixture has a known price transport error; preserve it without inventing recovery');
  assert.deepEqual(report.probe_errors, []);
});

test('registry stages rent behind its own reviewed edge and retains earlier contract evidence paths', () => {
  const existing = buildMonitorRegistry(claimantReview);
  assert.equal(existing.sources.length, 114);
  assert.equal(existing.staged_sources.length, 1);
  assert.equal(existing.staged_sources[0].key, RENT_CONTRACT.key);
  const approved = review(), saved = structuredClone(approved), expanded = buildMonitorRegistry(approved);
  assert.deepEqual(approved, saved);
  assert.equal(expanded.sources.length, 115);
  assert.equal(expanded.staged_sources.length, 0);
  assert.equal(new Set(expanded.sources.map(contract => contract.key)).size, 115);
  const rent = expanded.sources.find(contract => contract.key === RENT_CONTRACT.key);
  assert.equal(rent.evidence, approved.continuations[1].evidence);
  assert.equal(rent.definitions.length, 200);
  assert.equal(rent.monitor_interval_minutes, 1440);
  assert.equal(expanded.sources.find(contract => contract.key === US_CONTRACT.key).evidence, approved.evidence);
  for (const contract of CLAIMANT_CONTRACTS) {
    const entry = expanded.sources.find(source => source.key === contract.key);
    assert.equal(entry.evidence, approved.continuations[0].evidence);
    assert.notEqual(entry.evidence, rent.evidence);
  }
});
