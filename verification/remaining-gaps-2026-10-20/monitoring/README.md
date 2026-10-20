# Constructed monitoring controls

The 130 focused monitor tests passed using retained publisher specimens and
constructed releases/runs. See `focused-tests.log` and `local-controls.json`.
This is implementation evidence only: no publisher request, release activation,
checkpoint write, user delivery or scheduled observation occurred.

The prospective scope is `nine-desks-plus-verified-remaining-contracts`.
Its reviewed edge must contain a sorted, unique, nonempty `source_contracts`
array naming only implemented eligible public contracts. The present candidates
are Canada `rental_benchmark` and Scotland `college_activity`. Accepting both
would give 118 obligations using the existing 24 public probes.

AEMO `grid_day` remains held after repeated actual Worker HTTP 406 and rollback
of the rejected AEMO-active candidate. That attempt received no review edge or
observation approval. The revised six-contract phase-one release is accepted at
source `bf3110e3bcbbc7db6d629254a886356e80f4c24a`, Worker
`7f93e660-666c-435a-9b8b-bc37c060ac02`: five reviewed edges, 21 exact observation
approvals and 116 active obligations. The `before-aemo-runtime-hold-*` files
preserve earlier local controls; they do not establish release acceptance.

Northern Ireland `electricity_balance`, England `bedroom_rent` and England
`care_assessment_cohort` remain staged descriptors. Actual Worker retrievals
were blocked (NI access rejection, ONS 429 and CQC 403). This implementation
rejects attempts to activate any of these keys, even if an adapter is present.
Reader specimen tests do not establish Worker accessibility. Initial local inspection controls included all five
descriptors; the four NI success assertions failed after its public adapter was
correctly withheld. That earlier passing 140-test run is retained in the
`before-final-access-gates-*` files. The current passing suite tests only the
two eligible source contracts and explicitly asserts that all three held
candidates cannot activate.

Historical registries retain 108, 109, 114, 115 and 116 active obligations.
No inventory entry can silently add a new obligation to an old scope. The exact
accepted set can be smaller than two if a release gate fails; changing that set
later within this same review scope is refused and requires a separately
implemented/reviewed scope.

The release plan preserves each approved identity edge and applies only the
contiguous remaining suffix. Its audit marks only the actual destination as
observed; intermediate reviewed releases are not invented collections. Tests
start from the original sequence-5 state and every hypothetical accepted
prefix, preserve all 33 incidents, 36 repairs, pending delivery/history and
original shadow start, increment once per constructed input, and check replay
idempotence.

`remaining_started_shadow_at` is set only by an actual complete scheduled input
with both exact final identities, the approved scope and exact accepted set.
Earlier legacy or daily-history elapsed time does not transfer. Manual proofs
have no scheduled start. Later incomplete, mismatched-set or unreviewed-identity
samples cannot count as complete expanded-scope observations.

Each eligible source uses its reader's strict native validator and the common
typed adapter, then checks the exact qualified observation IDs, values and
definitions. Missing rows, duplicate identities, suppression, invalid
geography/units/periods, stripped licences and missing or prepublication
acquisition clocks fail semantically despite healthy HTTP. A transport failure
stays local. Numerical corrections change versions; acquisition hashes/clocks
do not. Publication, edition and other semantic context remain in the source
version. Fixed historical and annual observations do not expire simply because
their values have not changed.

Successful structure/semantics remain separate from independent numerical
approval. Only an exact separately reconciled version can clear its
verification repair. These controls do not create such approvals.

## Deferred production replay

`scripts/replay-remaining-release.mjs` is an offline proof helper. Syntax checking
passed; no complete phase-two production replay has run. It refuses any
checkpoint except the retained exact sequence-5 bytes and requires the accepted
five-edge phase-one review and 21 approvals pinned by separately retained
SHA-256 digests. Those accepted phase-one inputs are not created by this helper.

After both releases pass their actual gates, run from the repository root:

```text
node scripts/replay-remaining-release.mjs \
  CHECKPOINT OLD_REPORT PRIOR_REVIEW PRIOR_APPROVALS \
  PRIOR_REVIEW_SHA256 PRIOR_APPROVALS_SHA256 \
  FINAL_REVIEW FINAL_APPROVALS REMAINING_CAPTURE GAP_CAPTURE \
  CORE_APEX CORE_WWW NEW_OUTPUT CAPTURED_AT
```

The remaining and gap capture directories must contain their complete actual
both-domain interface manifests and body files; both independent capture
verifiers must pass. The core directories contain the retained health and full
desk `.json.response` files. All three health captures must match the exact
reviewed clean identity. `CAPTURED_AT` is an actual retained capture-completion
UTC timestamp, at or after every retained request completion.

The helper requires unchanged prior review fields and approvals, adds only
SFC and CMHC, compares exact approved semantic versions on both domains, and
checks one-step direct and all five hypothetical-prefix suffix transitions.
It saves only a new, explicitly constructed evidence report. It never saves a
checkpoint, makes a network request or creates scheduled acceptance. An actual
intervening collector run requires a separately reviewed lineage proof; this
helper does not silently substitute a later checkpoint.
