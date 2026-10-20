import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseClaimantTime, parseClaimantCounts} from '../lib/claimant-count.js';
import {
  REGISTRY, US_CONTRACT, CLAIMANT_CONTRACTS, ORIGINS, inspectSource, fingerprint,
} from '../lib/monitor-contracts.js';
import {initialState, applyRun} from '../lib/monitor-state.js';
import {catalogue} from '../lib/information.js';
import {catalogueV2} from '../lib/information-v2.js';
import {collect} from '../scripts/monitor.mjs';
import {buildMonitorRegistry} from '../scripts/monitor-registry.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const original = '../verification/claimant-count-2026-10-20/original/';
const native = parseClaimantCounts(
  read(original + 'nomis-national.csv'),
  parseClaimantTime(JSON.parse(read(original + 'nomis-time.json'))),
);
const snapshot = JSON.parse(read('../verification/structure-2026-10-17/selected-snapshot.json'));
const usBody = JSON.parse(read('../verification/us-paid-2026-10-20/replay-us-body.json'));
const usaReview = JSON.parse(read('../verification/us-paid-2026-10-20/release-review.json'));
const desks = ['united-kingdom', 'england', 'scotland', 'wales', 'northern-ireland'];
const at = minute => new Date(Date.parse('2026-10-20T05:00:00Z') + minute * 60000).toISOString();
const finalIdentity = {
  source_revision: 'd'.repeat(40),
  source_dirty: false,
  build_fingerprint: 'd'.repeat(16),
  worker_version: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
};
const review = () => ({
  ...structuredClone(usaReview),
  continuations: [{
    from: structuredClone(usaReview.to),
    to: structuredClone(finalIdentity),
    scope: 'nine-desks-plus-claimants',
    evidence: 'constructed-test/claimant-release-evidence.json',
  }],
});
const bodyFor = desk => ({
  ...structuredClone(snapshot[desk]),
  claimant_count: structuredClone(native[desk]),
  sources: {
    ...structuredClone(snapshot[desk].sources),
    claimant_count: {status: 'ok', fetched_at: at(0)},
  },
});
const claimantContract = desk => CLAIMANT_CONTRACTS.find(contract => contract.desk === desk);
function fixtureReader(mutate = () => {}) {
  const urls = [];
  const reader = async url => {
    urls.push(url);
    const {pathname} = new URL(url);
    let data;
    if (pathname === '/health.json') data = structuredClone(finalIdentity);
    else if (pathname === '/catalog.json') data = catalogue();
    else if (pathname === '/catalog.v2.json') data = catalogueV2();
    else if (pathname === '/united-states.json') data = structuredClone(usBody);
    else {
      const desk = pathname.slice(1, -5);
      data = desks.includes(desk) ? bodyFor(desk) : structuredClone(snapshot[desk]);
    }
    mutate(data, new URL(url));
    return {status: 200, bytes: JSON.stringify(data).length, data};
  };
  return {reader, urls};
}
const stateRun = (minute, key, outcome) => ({
  id: `CONSTRUCTED-claimant-state-${minute}`,
  finished_at: at(minute),
  complete: true,
  scheduled: false,
  requests: [],
  probe_errors: [],
  results: {[key]: Object.fromEntries(ORIGINS.map(origin => [origin, structuredClone(outcome)]))},
});

test('five explicit claimant obligations do not silently expand the original or USA monitoring registries', () => {
  assert.equal(REGISTRY.length, 108);
  assert.equal(new Set(REGISTRY.map(contract => contract.key)).size, 108);
  assert.ok(REGISTRY.every(contract => contract.source !== 'claimant_count'));
  assert.equal(CLAIMANT_CONTRACTS.length, 5);
  assert.deepEqual(CLAIMANT_CONTRACTS.map(contract => contract.desk).sort(), [...desks].sort());
  assert.equal(new Set(CLAIMANT_CONTRACTS.map(contract => contract.key)).size, 5);
  for (const contract of CLAIMANT_CONTRACTS) {
    assert.equal(contract.key, `${contract.desk}/claimant_count`);
    assert.equal(contract.health, 'sources.claimant_count');
    assert.equal(contract.described_measures, 1);
    assert.equal(contract.observation_count, 13);
  }

  for (const [activation, active, staged] of [
    [{enabled: false}, 108, 6],
    [usaReview, 109, 5],
    [review(), 114, 0],
  ]) {
    const registry = buildMonitorRegistry(activation);
    assert.equal(registry.sources.length, active);
    assert.equal(registry.staged_sources.length, staged);
    const keys = [...registry.sources, ...registry.staged_sources].map(contract => contract.key);
    assert.equal(keys.length, 114);
    assert.equal(new Set(keys).size, 114);
    assert.deepEqual(keys.sort(), [...REGISTRY, US_CONTRACT, ...CLAIMANT_CONTRACTS].map(c => c.key).sort());
  }
});

test('each original national specimen yields 13 exact monthly observations with retrieval-independent versions', async () => {
  for (const desk of desks) {
    const body = bodyFor(desk), contract = claimantContract(desk);
    const first = await inspectSource(body, contract);
    assert.equal(first.kind, 'success', `${desk}: ${first.reason}`);
    assert.equal(first.observations.length, 13);
    assert.equal(new Set(first.observations.map(row => row.id)).size, 13);
    assert.equal(new Set(first.observations.map(row => row.period)).size, 13);
    assert.equal(first.periods.length, 13);
    assert.match(first.version, /^[a-f0-9]{64}$/);
    assert.ok(first.observations.every(row =>
      row.id.startsWith(`https://morningrows.com/${desk}.json?source=claimant_count&`) &&
      row.value_state === 'observed' && Number.isSafeInteger(row.value)));
    body.sources.claimant_count.fetched_at = at(10);
    const later = await inspectSource(body, contract);
    assert.equal(later.retrieved_at, at(10));
    assert.equal(later.version, first.version);
    assert.deepEqual(later.observations, first.observations);
  }
});

test('acquisition metadata cannot create a claimant revision but changed counts and publisher revision metadata do', async () => {
  for (const desk of desks) {
    const body = bodyFor(desk), contract = claimantContract(desk);
    body.claimant_count.provenance = [
      {kind: 'publisher_time_codelist', url: body.claimant_count.metadata.time_codelist_url, sha256: 'a'.repeat(64), bytes: 100, retrieved_at: at(0)},
      {kind: 'publisher_national_counts', url: body.claimant_count.source_url, sha256: 'b'.repeat(64), bytes: 200, retrieved_at: at(0)},
    ];
    const originalResult = await inspectSource(body, contract);
    assert.equal(originalResult.kind, 'success', desk);
    const refreshed = structuredClone(body);
    refreshed.sources.claimant_count.fetched_at = at(10);
    refreshed.claimant_count.metadata.publisher_prepared_raw = at(10);
    refreshed.claimant_count.provenance[0] = {
      ...refreshed.claimant_count.provenance[0], sha256: 'c'.repeat(64), bytes: 101, retrieved_at: at(10),
    };
    refreshed.claimant_count.provenance[1] = {
      ...refreshed.claimant_count.provenance[1], sha256: 'd'.repeat(64), bytes: 201, retrieved_at: at(10),
    };
    const same = await inspectSource(refreshed, contract);
    assert.equal(same.kind, 'success', desk);
    assert.equal(same.version, originalResult.version, `${desk}: acquisition-only metadata`);
    assert.deepEqual(same.observations, originalResult.observations);

    const corrected = structuredClone(refreshed);
    corrected.claimant_count.rows[0].value += 5;
    const changedValue = await inspectSource(corrected, contract);
    assert.equal(changedValue.kind, 'success', desk);
    assert.notEqual(changedValue.version, originalResult.version, `${desk}: revised count`);
    const newRevision = structuredClone(refreshed);
    newRevision.claimant_count.rows[0].revision_version++;
    const changedRevision = await inspectSource(newRevision, contract);
    assert.equal(changedRevision.kind, 'success', desk);
    assert.notEqual(changedRevision.version, originalResult.version, `${desk}: publisher revision metadata`);
  }
});

test('wrong national data and partial calendar coverage fail semantically despite healthy transport', async () => {
  for (const desk of desks) {
    const swapped = bodyFor(desk);
    swapped.claimant_count = structuredClone(native[desk === 'england' ? 'scotland' : 'england']);
    assert.equal((await inspectSource(swapped, claimantContract(desk))).kind, 'semantic', desk);
    const partial = bodyFor(desk);
    partial.claimant_count.rows.pop();
    assert.equal((await inspectSource(partial, claimantContract(desk))).kind, 'semantic', desk);
  }
});

test('a claimant transport error stays local and does not reclassify a successful existing source', async () => {
  const body = bodyFor('wales');
  const projectionContract = REGISTRY.find(contract => contract.key === 'wales/projection');
  const before = await inspectSource(body, projectionContract);
  assert.equal(before.kind, 'success');
  body.claimant_count = null;
  body.sources.claimant_count = {status: 'error', http_status: 429, error: 'Publisher rate limit', fetched_at: at(0)};
  const claimant = await inspectSource(body, claimantContract('wales'));
  assert.equal(claimant.kind, 'transport');
  assert.equal(claimant.http_status, 429);
  assert.equal(claimant.version, undefined);
  assert.deepEqual(await inspectSource(body, projectionContract), before);
});

test('collector rejects incompatible or nonboolean scope before making any read', async () => {
  for (const options of [
    {includeUs: false, includeClaimants: true},
    {includeUs: 'true', includeClaimants: false},
    {includeUs: true, includeClaimants: 'true'},
  ]) {
    let reads = 0;
    await assert.rejects(collect({...options, read: async () => { reads++; throw Error('No reads permitted'); }}));
    assert.equal(reads, 0);
  }
});

test('reviewed claimant collection retains nine desks and 24 probes while checking 114 obligations', async () => {
  for (const [options, requests, obligations, scope] of [
    [{}, 20, 108, undefined],
    [{includeUs: true}, 24, 109, 'eight-legacy-plus-us-cpi'],
    [{includeUs: true, includeClaimants: true}, 24, 114, 'nine-desks-plus-claimants'],
  ]) {
    const {reader, urls} = fixtureReader();
    const report = await collect({...options, read: reader, now: () => at(0), id: `CONSTRUCTED-scope-${obligations}`});
    assert.equal(report.complete, true);
    assert.equal(report.requests.length, requests);
    assert.equal(urls.length, requests);
    assert.equal(new Set(urls).size, requests);
    assert.equal(Object.keys(report.results).length, obligations);
    assert.ok(Object.values(report.results).every(result => Object.keys(result).length === 2));
    assert.equal(report.scope, scope);
    assert.deepEqual(report.probe_errors, []);
    assert.ok(urls.every(url => !url.includes('?source=')), 'Reuse full desk bodies for every source obligation');
    if (options.includeClaimants) {
      for (const contract of CLAIMANT_CONTRACTS) for (const origin of ORIGINS) {
        assert.equal(report.results[contract.key][origin].kind, 'success');
        assert.equal(report.results[contract.key][origin].observations.length, 13);
      }
      assert.equal(report.results[US_CONTRACT.key][ORIGINS[0]].kind, 'success');
    }
  }
});

test('partial claimant rows are recorded as a semantic source failure while collection and sibling checks survive', async () => {
  const {reader} = fixtureReader((body, url) => {
    if (url.hostname === 'morningrows.com' && url.pathname === '/wales.json') body.claimant_count.rows.pop();
  });
  const report = await collect({
    includeUs: true, includeClaimants: true, read: reader, now: () => at(0), id: 'CONSTRUCTED-partial-claimants',
  });
  assert.equal(report.complete, true, 'Every probe completed even though one source contract failed');
  assert.equal(report.requests.length, 24);
  assert.equal(Object.keys(report.results).length, 114);
  assert.equal(report.results['wales/claimant_count'][ORIGINS[0]].kind, 'semantic');
  assert.equal(report.results['wales/claimant_count'][ORIGINS[1]].kind, 'success');
  for (const key of ['wales/projection', 'england/claimant_count', 'new-zealand/stats', US_CONTRACT.key]) {
    for (const origin of ORIGINS) assert.equal(report.results[key][origin].kind, 'success', key);
  }
  assert.deepEqual(report.probe_errors, []);
});

test('claimant missingness is compared with the same exact month, not numeric values in other retained months', async () => {
  for (const desk of desks) {
    const contract = claimantContract(desk);
    const originalResult = await inspectSource(bodyFor(desk), contract);
    assert.equal(originalResult.kind, 'success');
    // Construct an explicit previously known unavailable month. This exercises
    // transition semantics; it is not a publisher claim or reader acceptance.
    const known = structuredClone(originalResult);
    Object.assign(known.observations[1], {value: null, value_state: 'unavailable'});
    known.nonnumeric = [{id: known.observations[1].id, state: 'unavailable'}];
    known.version = fingerprint(known.observations);
    const base = applyRun(initialState(at(0), {}), stateRun(0, contract.key, known), {
      approvedVersions: {[contract.key]: {version: known.version, evidence: 'constructed-known-missing-month'}},
    });

    const revision = structuredClone(known);
    revision.observations[2].value += 5;
    revision.version = fingerprint(revision.observations);
    const after = applyRun(base, stateRun(10, contract.key, revision));
    assert.equal(after.sources[contract.key].candidate, undefined, desk);
    assert.equal(after.sources[contract.key].change, 'revision', desk);
    assert.equal(after.sources[contract.key].last_contract_validated.version, revision.version);
    assert.equal(after.incidents[contract.key], undefined);

    const loss = structuredClone(revision);
    Object.assign(loss.observations[0], {value: null, value_state: 'unavailable'});
    loss.nonnumeric.push({id: loss.observations[0].id, state: 'unavailable'});
    loss.version = fingerprint(loss.observations);
    const failed = applyRun(after, stateRun(20, contract.key, loss));
    assert.equal(failed.sources[contract.key].candidate.version, loss.version, desk);
    assert.equal(failed.sources[contract.key].last_contract_validated.version, revision.version);
    assert.equal(failed.sources[contract.key].last_contract_validated.observations[0].value_state, 'observed');
  }
});
