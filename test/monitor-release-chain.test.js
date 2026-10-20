import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRun, reviewedReleasePlan} from '../lib/monitor-state.js';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {ORIGINS} from '../lib/monitor-contracts.js';

// These are constructed unit-test runs, never scheduled operational evidence.
// Retain the actual durable predecessor and its original pending USA review.
const checkpointText = readFileSync(new URL(
  '../verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json',
  import.meta.url), 'utf8');
const checkpoint = decodeCheckpoint(checkpointText);
const usaReview = JSON.parse(readFileSync(new URL(
  '../verification/us-paid-2026-10-20/release-review.json', import.meta.url), 'utf8'));
const finalIdentity = {
  source_revision: 'd'.repeat(40),
  source_dirty: false,
  build_fingerprint: 'd'.repeat(16),
  worker_version: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
};
const unknownIdentity = {
  source_revision: 'e'.repeat(40),
  source_dirty: false,
  build_fingerprint: 'e'.repeat(16),
  worker_version: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
};
const identityKeys = ['source_revision', 'source_dirty', 'build_fingerprint', 'worker_version'];
const identity = value => Object.fromEntries(identityKeys.map(key => [key, value?.[key]]));
const prior = () => structuredClone(checkpoint.state);
const chain = () => ({
  ...structuredClone(usaReview),
  continuations: [{
    from: structuredClone(usaReview.to),
    to: structuredClone(finalIdentity),
    scope: 'nine-desks-plus-claimants',
    evidence: 'constructed-test/claimant-release-evidence.json',
  }],
});
const at = minute => new Date(Date.parse('2026-10-20T05:00:00Z') + minute * 60000).toISOString();
const run = (minute = 0, changes = {}) => ({
  id: `CONSTRUCTED-release-chain-${minute}`,
  finished_at: at(minute),
  complete: true,
  scheduled: false,
  scope: 'nine-desks-plus-claimants',
  identities: Object.fromEntries(ORIGINS.map(origin => [origin, structuredClone(finalIdentity)])),
  requests: Array.from({length: 24}, () => ({constructed: true})),
  results: {},
  probe_errors: [],
  ...changes,
});
const usaRun = (minute = 0, changes = {}) => run(minute, {
  scope: usaReview.scope,
  identities: Object.fromEntries(ORIGINS.map(origin => [origin, structuredClone(usaReview.to)])),
  ...changes,
});
const assertNoScopeStarts = state => {
  assert.equal(state.us_scope_first_complete_at, undefined);
  assert.equal(state.us_started_shadow_at, undefined);
  assert.equal(state.claimants_scope_first_complete_at, undefined);
  assert.equal(state.claimants_started_shadow_at, undefined);
};
const assertPreserved = (before, after) => {
  assert.deepEqual(after.incidents, before.incidents);
  assert.deepEqual(after.repairs, before.repairs);
  assert.deepEqual(after.outbox, before.outbox);
  assert.equal(after.started_shadow_at, before.started_shadow_at);
  assert.deepEqual(after.runs.slice(0, -1), before.runs);
  assert.equal(after.runs.length, before.runs.length + 1);
  assert.equal(after.sequence, before.sequence + 1);
  assert.deepEqual(after.policy, {...before.policy, max_public_requests_per_collection: 24});
};
const assertEdge = (actual, expected, observed) => {
  assert.deepEqual(identity(actual.from), identity(expected.from));
  assert.deepEqual(identity(actual.to), identity(expected.to));
  assert.equal(actual.scope, expected.scope);
  assert.equal(actual.evidence, expected.evidence);
  assert.equal(actual.observed_in_collection, observed);
};

test('retained checkpoint and USA-only review remain exact and independently distinct from constructed runs', () => {
  assert.equal(checkpoint.state.sequence, 5);
  assert.equal(checkpoint.digest, '665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f');
  assert.equal(Object.keys(checkpoint.state.incidents).length, 33);
  assert.equal(Object.keys(checkpoint.state.repairs).length, 36);
  assert.deepEqual(identity(checkpoint.state.approved_identity), identity(usaReview.from));
  assert.equal(checkpoint.state.started_shadow_at, '2026-10-18T23:22:22.161Z');
  assert.equal(checkpoint.state.outbox.find(event =>
    event.id === '12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6').status, 'pending');
  assertNoScopeStarts(checkpoint.state);

  const plan = reviewedReleasePlan(usaReview);
  assert.equal(plan.reviews.length, 1);
  assert.deepEqual(identity(plan.target), identity(usaReview.to));
  assert.equal(plan.scope, 'eight-legacy-plus-us-cpi');
  assert.equal(plan.includeUs, true);
  assert.equal(plan.includeClaimants, false);
});

test('one explicitly connected continuation selects the final scope without mutating its review or predecessor', () => {
  const review = chain(), saved = structuredClone(review), before = prior();
  const plan = reviewedReleasePlan(review);
  assert.equal(plan.reviews.length, 2);
  assert.deepEqual(identity(plan.reviews[0].from), identity(usaReview.from));
  assert.deepEqual(identity(plan.reviews[0].to), identity(usaReview.to));
  assert.deepEqual(identity(plan.reviews[1].from), identity(usaReview.to));
  assert.deepEqual(identity(plan.target), finalIdentity);
  assert.equal(plan.scope, 'nine-desks-plus-claimants');
  assert.equal(plan.includeUs, true);
  assert.equal(plan.includeClaimants, true);
  assert.deepEqual(review, saved);
  assert.deepEqual(prior(), before);
  assertNoScopeStarts(before);
});

test('malformed, disconnected, cyclic and nested release continuations fail closed', () => {
  const mutations = [
    ['disabled initial review', r => { r.enabled = false; }],
    ['nonboolean initial activation', r => { r.enabled = 'true'; }],
    ['missing initial evidence', r => delete r.evidence],
    ['blank initial evidence', r => { r.evidence = '  '; }],
    ['dirty initial identity', r => { r.from.source_dirty = true; }],
    ['invalid initial revision', r => { r.from.source_revision = 'not-a-revision'; }],
    ['invalid initial Worker', r => { r.to.worker_version = 'not-a-worker-version'; }],
    ['missing initial fingerprint', r => delete r.from.build_fingerprint],
    ['wrong initial scope', r => { r.scope = 'arbitrary-new-sources'; }],
    ['initial self-edge', r => { r.to = structuredClone(r.from); r.continuations[0].from = structuredClone(r.from); }],
    ['non-array continuation', r => { r.continuations = {}; }],
    ['null continuation collection', r => { r.continuations = null; }],
    ['null continuation edge', r => { r.continuations = [null]; }],
    ['multiple continuations', r => { r.continuations.push(structuredClone(r.continuations[0])); }],
    ['disconnected revision', r => { r.continuations[0].from.source_revision = 'a'.repeat(40); }],
    ['disconnected Worker', r => { r.continuations[0].from.worker_version = unknownIdentity.worker_version; }],
    ['disconnected fingerprint', r => { r.continuations[0].from.build_fingerprint = 'a'.repeat(16); }],
    ['continuation cycle to durable predecessor', r => { r.continuations[0].to = structuredClone(r.from); }],
    ['continuation self-edge', r => { r.continuations[0].to = structuredClone(r.to); }],
    ['missing final evidence', r => delete r.continuations[0].evidence],
    ['blank final evidence', r => { r.continuations[0].evidence = '\n'; }],
    ['wrong final scope', r => { r.continuations[0].scope = 'eight-legacy-plus-us-cpi'; }],
    ['invalid final revision', r => { r.continuations[0].to.source_revision = 'f'.repeat(39); }],
    ['invalid final fingerprint', r => { r.continuations[0].to.build_fingerprint = 'z'.repeat(16); }],
    ['invalid final Worker', r => { r.continuations[0].to.worker_version = null; }],
    ['dirty final identity', r => { r.continuations[0].to.source_dirty = true; }],
    ['missing clean marker', r => delete r.continuations[0].to.source_dirty],
    ['separately enabled continuation', r => { r.continuations[0].enabled = true; }],
    ['disabled continuation', r => { r.continuations[0].enabled = false; }],
    ['nested continuation', r => { r.continuations[0].continuations = []; }],
  ];
  for (const [label, mutate] of mutations) {
    const review = chain(); mutate(review);
    assert.throws(() => reviewedReleasePlan(review), undefined, label);
    assert.throws(() => applyRun(prior(), run(), {approvedRelease: review}), undefined, label);
  }
});

test('direct durable-old to final release records both reviewed edges but only one actual collection', () => {
  const before = prior(), untouched = structuredClone(before), review = chain();
  const after = applyRun(before, run(), {approvedRelease: review});
  assert.deepEqual(before, untouched);
  assertPreserved(before, after);
  assert.deepEqual(identity(after.approved_identity), finalIdentity);
  assert.equal(after.release_reviews.length, (before.release_reviews?.length || 0) + 1);
  const audit = after.release_reviews.at(-1);
  assert.deepEqual(identity(audit.from), identity(before.approved_identity));
  assert.deepEqual(identity(audit.to), finalIdentity);
  assert.equal(audit.at, at(0));
  assert.equal(audit.scope, 'nine-desks-plus-claimants');
  assert.equal(audit.reviewed_chain.length, 2);
  assertEdge(audit.reviewed_chain[0], usaReview, false);
  assertEdge(audit.reviewed_chain[1], review.continuations[0], true);
  assert.equal(after.runs.at(-1).id, run().id);
  assert.equal(after.runs.at(-1).scheduled, false);
  assert.equal(after.runs.at(-1).scope, 'nine-desks-plus-claimants');
  assert.equal(after.us_scope_first_complete_at, at(0));
  assert.equal(after.claimants_scope_first_complete_at, at(0));
  assert.equal(after.us_started_shadow_at, undefined);
  assert.equal(after.claimants_started_shadow_at, undefined);
});

test('an actual scheduled final-scope run starts both new scopes at its own completion only', () => {
  const before = prior();
  const after = applyRun(before, run(0, {scheduled: true}), {approvedRelease: chain()});
  assertPreserved(before, after);
  assert.equal(after.us_scope_first_complete_at, at(0));
  assert.equal(after.us_started_shadow_at, at(0));
  assert.equal(after.claimants_scope_first_complete_at, at(0));
  assert.equal(after.claimants_started_shadow_at, at(0));
  assert.equal(after.started_shadow_at, before.started_shadow_at);
  assert.equal(after.runs.at(-1).scheduled, true);
});

test('manual final transition followed by scheduled observation does not repeat its release audit', () => {
  const review = chain();
  const manual = applyRun(prior(), run(), {approvedRelease: review});
  const scheduled = applyRun(manual, run(10, {scheduled: true}), {approvedRelease: review});
  assert.equal(scheduled.sequence, manual.sequence + 1);
  assert.deepEqual(scheduled.release_reviews, manual.release_reviews);
  assert.equal(scheduled.us_scope_first_complete_at, at(0));
  assert.equal(scheduled.claimants_scope_first_complete_at, at(0));
  assert.equal(scheduled.us_started_shadow_at, at(10));
  assert.equal(scheduled.claimants_started_shadow_at, at(10));
  const later = applyRun(scheduled, run(20, {scheduled: true}), {approvedRelease: review});
  assert.deepEqual(later.release_reviews, scheduled.release_reviews);
  assert.equal(later.us_started_shadow_at, at(10));
  assert.equal(later.claimants_started_shadow_at, at(10));
  assert.deepEqual(applyRun(later, run(20, {scheduled: true}), {approvedRelease: review}), later);
});

test('already-USA predecessor applies only the suffix and preserves existing USA observation history', () => {
  const original = prior();
  const usa = applyRun(original, usaRun(0, {scheduled: true}), {approvedRelease: usaReview});
  assert.deepEqual(identity(usa.approved_identity), identity(usaReview.to));
  assert.equal(usa.us_started_shadow_at, at(0));
  assert.equal(usa.claimants_scope_first_complete_at, undefined);
  const review = chain(), after = applyRun(usa, run(10), {approvedRelease: review});
  assertPreserved(usa, after);
  assert.equal(usa.runs.at(-1).scope, 'eight-legacy-plus-us-cpi');
  assert.equal(after.runs.at(-1).scope, 'nine-desks-plus-claimants');
  assert.equal(after.release_reviews.length, usa.release_reviews.length + 1);
  assert.deepEqual(after.release_reviews.slice(0, -1), usa.release_reviews);
  const audit = after.release_reviews.at(-1);
  assert.deepEqual(identity(audit.from), identity(usaReview.to));
  assert.deepEqual(identity(audit.to), finalIdentity);
  assert.equal(audit.reviewed_chain.length, 1);
  assertEdge(audit.reviewed_chain[0], review.continuations[0], true);
  assert.equal(after.us_scope_first_complete_at, at(0));
  assert.equal(after.us_started_shadow_at, at(0));
  assert.equal(after.claimants_scope_first_complete_at, at(10));
  assert.equal(after.claimants_started_shadow_at, undefined);
  const scheduled = applyRun(after, run(20, {scheduled: true}), {approvedRelease: review});
  assert.equal(scheduled.us_started_shadow_at, at(0));
  assert.equal(scheduled.claimants_started_shadow_at, at(20));
});

test('USA-only review retains its original transition behavior without starting claimant observation', () => {
  const before = prior();
  const after = applyRun(before, usaRun(), {approvedRelease: usaReview});
  assertPreserved(before, after);
  assert.deepEqual(identity(after.approved_identity), identity(usaReview.to));
  assert.equal(after.release_reviews.length, (before.release_reviews?.length || 0) + 1);
  assert.equal(after.runs.at(-1).scope, 'eight-legacy-plus-us-cpi');
  assert.equal(after.us_scope_first_complete_at, at(0));
  assert.equal(after.us_started_shadow_at, undefined);
  assert.equal(after.claimants_scope_first_complete_at, undefined);
  assert.equal(after.claimants_started_shadow_at, undefined);
});

test('incomplete, wrong-scope, missing-domain and nonexact identity evidence cannot authorize the chain', () => {
  const mutations = [
    ['incomplete collection', r => { r.complete = false; }],
    ['missing scope', r => delete r.scope],
    ['intermediate scope', r => { r.scope = usaReview.scope; }],
    ['missing one domain', r => delete r.identities[ORIGINS[1]]],
    ['mixed versions', r => { r.identities[ORIGINS[1]] = structuredClone(usaReview.to); }],
    ['wrong final revision', r => { r.identities[ORIGINS[0]].source_revision = 'a'.repeat(40); }],
    ['wrong final fingerprint', r => { r.identities[ORIGINS[0]].build_fingerprint = 'a'.repeat(16); }],
    ['dirty final response', r => { r.identities[ORIGINS[0]].source_dirty = true; }],
    ['unapproved final Worker', r => { r.identities = Object.fromEntries(ORIGINS.map(o => [o, structuredClone(unknownIdentity)])); }],
  ];
  for (const [label, mutate] of mutations) {
    const before = prior(), candidate = run(0, {scheduled: true});
    mutate(candidate);
    const after = applyRun(before, candidate, {approvedRelease: chain()});
    assert.deepEqual(after.approved_identity, before.approved_identity, label);
    assert.deepEqual(after.release_reviews, before.release_reviews, label);
    assertNoScopeStarts(after);
    assert.equal(after.started_shadow_at, before.started_shadow_at, label);
  }
});

test('an enabled continuation cannot certify the intermediate USA release as the final target', () => {
  const before = prior();
  const after = applyRun(before, usaRun(0, {scheduled: true}), {approvedRelease: chain()});
  assert.deepEqual(after.approved_identity, before.approved_identity);
  assert.deepEqual(after.release_reviews, before.release_reviews);
  assertNoScopeStarts(after);
});

test('unknown durable identity cannot skip into the approved release chain', () => {
  const before = prior();
  before.approved_identity = structuredClone(unknownIdentity);
  const after = applyRun(before, run(0, {scheduled: true}), {approvedRelease: chain()});
  assert.deepEqual(after.approved_identity, unknownIdentity);
  assert.deepEqual(after.release_reviews, before.release_reviews);
  assertNoScopeStarts(after);
  assert.equal(after.started_shadow_at, before.started_shadow_at);
});

test('incomplete collection at the final identity cannot invent new-scope timestamps or another audit', () => {
  const before = applyRun(prior(), run(), {approvedRelease: chain()});
  const after = applyRun(before, run(10, {complete: false, scheduled: true}), {approvedRelease: chain()});
  assert.deepEqual(after.release_reviews, before.release_reviews);
  assert.equal(after.us_scope_first_complete_at, at(0));
  assert.equal(after.claimants_scope_first_complete_at, at(0));
  assert.equal(after.us_started_shadow_at, undefined);
  assert.equal(after.claimants_started_shadow_at, undefined);
});
