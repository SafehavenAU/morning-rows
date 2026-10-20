import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRun, reviewedReleasePlan, MAX_REVIEWED_RELEASE_EDGES} from '../lib/monitor-state.js';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {ORIGINS} from '../lib/monitor-contracts.js';

// Every run below is constructed test input, including scheduled:true variants.
// These tests do not count as an actual collection, release or observation window.
const checkpoint = decodeCheckpoint(readFileSync(new URL(
  '../verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json',
  import.meta.url), 'utf8'));
const claimantReview = JSON.parse(readFileSync(new URL(
  '../verification/claimant-count-2026-10-20/proposed-review.json',
  import.meta.url), 'utf8'));
const USA_SCOPE = 'eight-legacy-plus-us-cpi';
const CLAIMANT_SCOPE = 'nine-desks-plus-claimants';
const RENT_SCOPE = 'nine-desks-plus-claimants-and-nz-rent';
const identityKeys = ['source_revision', 'source_dirty', 'build_fingerprint', 'worker_version'];
const exactIdentity = value => Object.fromEntries(identityKeys.map(key => [key, value?.[key]]));
const constructedIdentity = number => {
  const hex = number.toString(16);
  return {
    source_revision: hex.padStart(40, '0'),
    source_dirty: false,
    build_fingerprint: hex.padStart(16, '0'),
    worker_version: `00000000-0000-4000-8000-${hex.padStart(12, '0')}`,
  };
};
const prior = () => structuredClone(checkpoint.state);
const at = minute => new Date(Date.parse('2026-10-20T05:10:00Z') + minute * 60000).toISOString();
const usaReview = () => {
  const review = structuredClone(claimantReview);
  delete review.continuations;
  return review;
};
const chain = (length = 3, scopes = []) => {
  assert.ok(length >= 2);
  const review = structuredClone(claimantReview);
  while (review.continuations.length + 1 < length) {
    const number = review.continuations.length + 2;
    review.continuations.push({
      from: structuredClone(review.continuations.at(-1).to),
      to: constructedIdentity(number),
      evidence: `CONSTRUCTED-test/release-${number}.json`,
      scope: scopes[number - 3] ?? RENT_SCOPE,
    });
  }
  return review;
};
const finalEdge = review => review.continuations?.at(-1) || review;
const runFor = (review, minute = 0, changes = {}) => ({
  id: `CONSTRUCTED-release-continuations-${minute}`,
  finished_at: at(minute),
  complete: true,
  scheduled: false,
  scope: finalEdge(review).scope,
  identities: Object.fromEntries(ORIGINS.map(origin => [
    origin, structuredClone(finalEdge(review).to),
  ])),
  requests: Array.from({length: 24}, () => ({constructed: true})),
  results: {},
  probe_errors: [],
  ...changes,
});
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
const assertNoScopeStarts = state => {
  for (const prefix of ['us', 'claimants', 'market_rent']) {
    assert.equal(state[`${prefix}_scope_first_complete_at`], undefined, prefix);
    assert.equal(state[`${prefix}_started_shadow_at`], undefined, prefix);
  }
};
const assertAudit = (after, review, skippedEdges, minute) => {
  const expected = [review, ...review.continuations].slice(skippedEdges);
  const audit = after.release_reviews.at(-1);
  assert.equal(audit.at, at(minute));
  assert.deepEqual(exactIdentity(audit.from), exactIdentity(expected[0].from));
  assert.deepEqual(exactIdentity(audit.to), exactIdentity(expected.at(-1).to));
  assert.equal(audit.scope, expected.at(-1).scope);
  assert.equal(audit.evidence, expected.at(-1).evidence);
  assert.equal(audit.reviewed_chain.length, expected.length);
  for (const [index, edge] of expected.entries()) {
    const actual = audit.reviewed_chain[index];
    assert.deepEqual(exactIdentity(actual.from), exactIdentity(edge.from));
    assert.deepEqual(exactIdentity(actual.to), exactIdentity(edge.to));
    assert.equal(actual.scope, edge.scope);
    assert.equal(actual.evidence, edge.evidence);
    assert.equal(actual.observed_in_collection, index === expected.length - 1);
  }
};

test('bounded continuation uses the retained seq5 and original USA/claimant edges without activating a release', () => {
  assert.equal(checkpoint.digest, '665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f');
  assert.equal(checkpoint.state.sequence, 5);
  assert.equal(Object.keys(checkpoint.state.incidents).length, 33);
  assert.equal(Object.keys(checkpoint.state.repairs).length, 36);
  assert.equal(checkpoint.state.started_shadow_at, '2026-10-18T23:22:22.161Z');
  assert.equal(checkpoint.state.outbox.find(event =>
    event.id === '12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6').status, 'pending');
  assert.deepEqual(exactIdentity(checkpoint.state.approved_identity), claimantReview.from);
  assert.equal(claimantReview.to.worker_version, 'e0224d26-6bcb-4f96-a580-460919a0d195');
  assert.equal(claimantReview.continuations[0].to.worker_version, '21582063-b7df-456b-ba2f-4f629f9cc63d');
  assertNoScopeStarts(checkpoint.state);

  const review = chain(), savedReview = structuredClone(review), before = prior();
  const plan = reviewedReleasePlan(review);
  assert.equal(MAX_REVIEWED_RELEASE_EDGES, 8);
  assert.equal(plan.reviews.length, 3);
  assert.deepEqual(plan.reviews.map(edge => edge.scope), [USA_SCOPE, CLAIMANT_SCOPE, RENT_SCOPE]);
  assert.deepEqual(plan.target, finalEdge(review).to);
  assert.equal(plan.scope, RENT_SCOPE);
  assert.equal(plan.includeUs, true);
  assert.equal(plan.includeClaimants, true);
  assert.equal(plan.includeRent, true);
  assert.deepEqual(review, savedReview);
  assert.deepEqual(prior(), before);
});

test('old USA and claimant plans retain their scopes and do not enable rent', () => {
  for (const [review, scope, includeClaimants] of [
    [usaReview(), USA_SCOPE, false],
    [structuredClone(claimantReview), CLAIMANT_SCOPE, true],
    [chain(5, [CLAIMANT_SCOPE, CLAIMANT_SCOPE, CLAIMANT_SCOPE]), CLAIMANT_SCOPE, true],
  ]) {
    const plan = reviewedReleasePlan(review);
    assert.equal(plan.scope, scope);
    assert.equal(plan.includeUs, true);
    assert.equal(plan.includeClaimants, includeClaimants);
    assert.equal(plan.includeRent, false);
  }
});

test('direct seq5 to a three-edge final release records one real run and only final identity observation', () => {
  const review = chain(), before = prior(), saved = structuredClone(before);
  const after = applyRun(before, runFor(review), {approvedRelease: review});
  assert.deepEqual(before, saved);
  assertPreserved(before, after);
  assert.deepEqual(exactIdentity(after.approved_identity), finalEdge(review).to);
  assert.equal(after.release_reviews.length, (before.release_reviews?.length || 0) + 1);
  assertAudit(after, review, 0, 0);
  assert.equal(after.runs.at(-1).scope, RENT_SCOPE);
  assert.equal(after.runs.at(-1).scheduled, false);
  for (const prefix of ['us', 'claimants', 'market_rent']) {
    assert.equal(after[`${prefix}_scope_first_complete_at`], at(0));
    assert.equal(after[`${prefix}_started_shadow_at`], undefined);
  }
});

test('constructed scheduled final run starts all included scopes at its own completion, never intermediate edges', () => {
  const review = chain(), before = prior();
  const after = applyRun(before, runFor(review, 0, {scheduled: true}), {approvedRelease: review});
  assertPreserved(before, after);
  assertAudit(after, review, 0, 0);
  for (const prefix of ['us', 'claimants', 'market_rent']) {
    assert.equal(after[`${prefix}_scope_first_complete_at`], at(0));
    assert.equal(after[`${prefix}_started_shadow_at`], at(0));
  }
  assert.equal(after.started_shadow_at, '2026-10-18T23:22:22.161Z');
});

test('already-USA durable prefix applies two remaining edges and preserves prior USA scheduled evidence', () => {
  const base = usaReview(), review = chain();
  const usa = applyRun(prior(), runFor(base, 0, {scheduled: true}), {approvedRelease: base});
  const after = applyRun(usa, runFor(review, 10), {approvedRelease: review});
  assertPreserved(usa, after);
  assertAudit(after, review, 1, 10);
  assert.deepEqual(after.release_reviews.slice(0, -1), usa.release_reviews);
  assert.equal(after.us_scope_first_complete_at, at(0));
  assert.equal(after.us_started_shadow_at, at(0));
  for (const prefix of ['claimants', 'market_rent']) {
    assert.equal(after[`${prefix}_scope_first_complete_at`], at(10));
    assert.equal(after[`${prefix}_started_shadow_at`], undefined);
  }
});

test('already-claimant durable prefix applies only rent and preserves both earlier scope timestamps', () => {
  const base = usaReview(), review = chain();
  const usa = applyRun(prior(), runFor(base, 0, {scheduled: true}), {approvedRelease: base});
  const claimants = applyRun(usa, runFor(claimantReview, 5, {scheduled: true}), {
    approvedRelease: claimantReview,
  });
  const after = applyRun(claimants, runFor(review, 10), {approvedRelease: review});
  assertPreserved(claimants, after);
  assertAudit(after, review, 2, 10);
  assert.deepEqual(after.release_reviews.slice(0, -1), claimants.release_reviews);
  assert.equal(after.us_scope_first_complete_at, at(0));
  assert.equal(after.us_started_shadow_at, at(0));
  assert.equal(after.claimants_scope_first_complete_at, at(5));
  assert.equal(after.claimants_started_shadow_at, at(5));
  assert.equal(after.market_rent_scope_first_complete_at, at(10));
  assert.equal(after.market_rent_started_shadow_at, undefined);
});

test('manual prefixes do not acquire scheduled starts from release history', () => {
  const review = chain();
  const claimants = applyRun(prior(), runFor(claimantReview, 0), {approvedRelease: claimantReview});
  const manual = applyRun(claimants, runFor(review, 5), {approvedRelease: review});
  for (const prefix of ['us', 'claimants', 'market_rent'])
    assert.equal(manual[`${prefix}_started_shadow_at`], undefined);
  const scheduled = applyRun(manual, runFor(review, 10, {scheduled: true}), {approvedRelease: review});
  assert.deepEqual(scheduled.release_reviews, manual.release_reviews);
  assert.equal(scheduled.us_scope_first_complete_at, at(0));
  assert.equal(scheduled.claimants_scope_first_complete_at, at(0));
  assert.equal(scheduled.market_rent_scope_first_complete_at, at(5));
  for (const prefix of ['us', 'claimants', 'market_rent'])
    assert.equal(scheduled[`${prefix}_started_shadow_at`], at(10));
});

test('repeated claimant-scope releases are valid and do not invent rent coverage', () => {
  const review = chain(5, [CLAIMANT_SCOPE, CLAIMANT_SCOPE, CLAIMANT_SCOPE]);
  const before = applyRun(prior(), runFor(claimantReview, 0, {scheduled: true}), {
    approvedRelease: claimantReview,
  });
  const after = applyRun(before, runFor(review, 10, {scheduled: true}), {approvedRelease: review});
  assertPreserved(before, after);
  assertAudit(after, review, 2, 10);
  assert.equal(after.us_started_shadow_at, at(0));
  assert.equal(after.claimants_started_shadow_at, at(0));
  assert.equal(after.market_rent_scope_first_complete_at, undefined);
  assert.equal(after.market_rent_started_shadow_at, undefined);
  assert.equal(after.runs.at(-1).scope, CLAIMANT_SCOPE);
});

test('repeated rent-scope releases apply only the unapplied suffix and retain established scope starts', () => {
  const first = chain(3), extended = chain(5);
  const before = applyRun(prior(), runFor(first, 0, {scheduled: true}), {approvedRelease: first});
  const after = applyRun(before, runFor(extended, 10, {scheduled: true}), {approvedRelease: extended});
  assertPreserved(before, after);
  assertAudit(after, extended, 3, 10);
  assert.deepEqual(after.release_reviews.slice(0, -1), before.release_reviews);
  for (const prefix of ['us', 'claimants', 'market_rent']) {
    assert.equal(after[`${prefix}_scope_first_complete_at`], at(0));
    assert.equal(after[`${prefix}_started_shadow_at`], at(0));
  }
});

test('eight total reviewed edges pass as one collection; a ninth fails closed', () => {
  const review = chain(8, [CLAIMANT_SCOPE, CLAIMANT_SCOPE, RENT_SCOPE, RENT_SCOPE, RENT_SCOPE, RENT_SCOPE]);
  const plan = reviewedReleasePlan(review);
  assert.equal(plan.reviews.length, 8);
  const before = prior(), after = applyRun(before, runFor(review), {approvedRelease: review});
  assertPreserved(before, after);
  assertAudit(after, review, 0, 0);
  assert.equal(after.runs.length, before.runs.length + 1);
  const oversized = chain(9);
  assert.throws(() => reviewedReleasePlan(oversized));
  assert.throws(() => applyRun(prior(), runFor(oversized), {approvedRelease: oversized}));
});

test('later malformed edges, broken identity links, reused Workers and scope downgrades fail closed', () => {
  const mutations = [
    ['skip mandatory claimant stage', r => { r.continuations[0].scope = RENT_SCOPE; }],
    ['unknown later scope', r => { r.continuations[2].scope = 'unreviewed-source-expansion'; }],
    ['later USA downgrade', r => { r.continuations[2].scope = USA_SCOPE; }],
    ['rent-to-claimant downgrade', r => { r.continuations[2].scope = CLAIMANT_SCOPE; }],
    ['temporary downgrade then rent', r => { r.continuations[1].scope = RENT_SCOPE; r.continuations[2].scope = CLAIMANT_SCOPE; r.continuations[3].scope = RENT_SCOPE; }],
    ['later missing from', r => { delete r.continuations[2].from; }],
    ['later missing to', r => { delete r.continuations[2].to; }],
    ['later null edge', r => { r.continuations[2] = null; }],
    ['later missing evidence', r => { delete r.continuations[2].evidence; }],
    ['later nonstring evidence', r => { r.continuations[2].evidence = {}; }],
    ['later blank evidence', r => { r.continuations[2].evidence = '\t\n'; }],
    ['later nested chain', r => { r.continuations[2].continuations = []; }],
    ['later explicit activation', r => { r.continuations[2].enabled = true; }],
    ['later disabled edge', r => { r.continuations[2].enabled = false; }],
    ['later missing clean field', r => { delete r.continuations[3].to.source_dirty; }],
    ['later dirty identity', r => { r.continuations[3].to.source_dirty = true; }],
    ['later string clean marker', r => { r.continuations[3].to.source_dirty = 'false'; }],
    ['later malformed revision', r => { r.continuations[3].to.source_revision = 'a'.repeat(39); }],
    ['later malformed fingerprint', r => { r.continuations[3].to.build_fingerprint = 'x'.repeat(16); }],
    ['later malformed Worker', r => { r.continuations[3].to.worker_version = 'not-a-worker'; }],
    ['later disconnected revision', r => { r.continuations[2].from.source_revision = 'a'.repeat(40); }],
    ['later disconnected fingerprint', r => { r.continuations[2].from.build_fingerprint = 'b'.repeat(16); }],
    ['later disconnected Worker', r => { r.continuations[2].from.worker_version = constructedIdentity(99).worker_version; }],
    ['cycle to original durable identity', r => { r.continuations[3].to = structuredClone(r.from); }],
    ['cycle to prior claimant identity', r => { r.continuations[3].to = structuredClone(r.continuations[0].to); }],
    ['reused Worker with different revision', r => { r.continuations[3].to.worker_version = r.to.worker_version; }],
    ['later self edge', r => { r.continuations[3].to = structuredClone(r.continuations[3].from); }],
  ];
  for (const [label, mutate] of mutations) {
    const review = chain(5);
    mutate(review);
    assert.throws(() => reviewedReleasePlan(review), undefined, label);
    assert.throws(() => applyRun(prior(), runFor(chain(5)), {approvedRelease: review}), undefined, label);
  }
});

test('nonidentity metadata remains compatible but all four identity fields must match at a durable prefix', () => {
  const review = chain();
  review.from.note = 'retained explanatory metadata';
  review.continuations[1].from.service = 'morning-rows';
  assert.equal(reviewedReleasePlan(review).includeRent, true);
  const base = usaReview();
  const usa = applyRun(prior(), runFor(base), {approvedRelease: base});
  usa.approved_identity.note = 'existing checkpoint note';
  const after = applyRun(usa, runFor(review, 10), {approvedRelease: review});
  assertAudit(after, review, 1, 10);
  for (const [field, value] of [
    ['source_revision', 'a'.repeat(40)],
    ['source_dirty', true],
    ['build_fingerprint', 'b'.repeat(16)],
    ['worker_version', constructedIdentity(99).worker_version],
  ]) {
    const unknown = structuredClone(usa);
    unknown.approved_identity[field] = value;
    const rejected = applyRun(unknown, runFor(review, 20, {scheduled: true}), {approvedRelease: review});
    assert.deepEqual(rejected.approved_identity, unknown.approved_identity, field);
    assert.deepEqual(rejected.release_reviews, unknown.release_reviews, field);
    assert.equal(rejected.market_rent_scope_first_complete_at, undefined, field);
    assert.equal(rejected.market_rent_started_shadow_at, undefined, field);
  }
});

test('only a complete final-scope collection with both exact domains can consume a longer review chain', () => {
  const review = chain(5);
  const mutations = [
    ['incomplete collection', r => { r.complete = false; }],
    ['missing scope', r => { delete r.scope; }],
    ['prior claimant scope', r => { r.scope = CLAIMANT_SCOPE; }],
    ['one missing domain', r => { delete r.identities[ORIGINS[1]]; }],
    ['intermediate version on one domain', r => { r.identities[ORIGINS[1]] = structuredClone(review.continuations[1].to); }],
    ['wrong final revision', r => { r.identities[ORIGINS[0]].source_revision = 'b'.repeat(40); }],
    ['wrong final fingerprint', r => { r.identities[ORIGINS[0]].build_fingerprint = 'b'.repeat(16); }],
    ['missing clean marker', r => { delete r.identities[ORIGINS[0]].source_dirty; }],
    ['dirty identity', r => { r.identities[ORIGINS[0]].source_dirty = true; }],
    ['unapproved final identity', r => { r.identities = Object.fromEntries(ORIGINS.map(origin => [origin, constructedIdentity(99)])); }],
  ];
  for (const [label, mutate] of mutations) {
    const before = prior(), candidate = runFor(review, 0, {scheduled: true});
    mutate(candidate);
    const after = applyRun(before, candidate, {approvedRelease: review});
    assert.deepEqual(after.approved_identity, before.approved_identity, label);
    assert.deepEqual(after.release_reviews, before.release_reviews, label);
    assertNoScopeStarts(after);
    assert.equal(after.started_shadow_at, before.started_shadow_at, label);
  }
});

test('a historical intermediate claimant or rent identity cannot certify the current final target', () => {
  const review = chain(5);
  for (const prefix of [structuredClone(claimantReview), chain(3)]) {
    const before = prior();
    const after = applyRun(before, runFor(prefix, 0, {scheduled: true}), {approvedRelease: review});
    assert.deepEqual(after.approved_identity, before.approved_identity);
    assert.deepEqual(after.release_reviews, before.release_reviews);
    assertNoScopeStarts(after);
  }
});

test('unknown durable identity cannot enter a valid longer chain at its final target', () => {
  const review = chain(5), before = prior();
  before.approved_identity = constructedIdentity(99);
  const after = applyRun(before, runFor(review, 0, {scheduled: true}), {approvedRelease: review});
  assert.deepEqual(after.approved_identity, before.approved_identity);
  assert.deepEqual(after.release_reviews, before.release_reviews);
  assertNoScopeStarts(after);
});

test('already-final runs do not repeat audit or rewrite starts and duplicate run IDs remain idempotent', () => {
  const review = chain(5);
  const manual = applyRun(prior(), runFor(review), {approvedRelease: review});
  const incomplete = applyRun(manual, runFor(review, 5, {scheduled: true, complete: false}), {
    approvedRelease: review,
  });
  assert.deepEqual(incomplete.release_reviews, manual.release_reviews);
  for (const prefix of ['us', 'claimants', 'market_rent']) {
    assert.equal(incomplete[`${prefix}_scope_first_complete_at`], at(0));
    assert.equal(incomplete[`${prefix}_started_shadow_at`], undefined);
  }
  const scheduled = applyRun(incomplete, runFor(review, 10, {scheduled: true}), {approvedRelease: review});
  const later = applyRun(scheduled, runFor(review, 20, {scheduled: true}), {approvedRelease: review});
  assert.deepEqual(later.release_reviews, manual.release_reviews);
  for (const prefix of ['us', 'claimants', 'market_rent']) {
    assert.equal(later[`${prefix}_scope_first_complete_at`], at(0));
    assert.equal(later[`${prefix}_started_shadow_at`], at(10));
  }
  assert.deepEqual(applyRun(later, runFor(review, 20, {scheduled: true}), {approvedRelease: review}), later);
});
