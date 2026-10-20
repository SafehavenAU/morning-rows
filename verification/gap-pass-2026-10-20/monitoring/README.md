# Bounded monitoring integration

This is local implementation and constructed verification, not a collection,
scheduled execution, checkpoint write, notification receipt or release approval.
The existing four-edge review and active approval files were not changed.
Current enabled scope remains 115 obligations; the original registry remains
108. The new explicitly reviewed scope
`nine-desks-plus-claimants-rent-and-daily-history` has 116 obligations and the same
24 public probes.

Five existing source contracts become typed only in that scope: four Canadian
StatCan headlines and Wales land transaction tax. Bank of Canada dated exchange
history adds one obligation. AEMO remains a held descriptor after recurring
actual Worker HTTP 406; no AEMO obligation, approval or public request is added.
Historical
native-source reports retain their old availability-only interpretation.
Structural validity never creates independent numerical approval: each exact
source version still needs its separate original-data evidence.

The frozen four-edge prefix used in the tests is
`verification/statcan-gdp-2026-10-20/proposed-review.json`; it was byte-identical
to the accepted review before this integration. Tests use the retained genuine
sequence-5 checkpoint as input and constructed runs only. Applying the exact
fifth edge from any existing prefix increments the sequence once and preserves
the 33 incidents, 36 repairs, notification outbox, original shadow start and any
earlier scope starts. Reviewed intermediate identities remain explicitly
unobserved. Manual runs cannot set the new scheduled start.

Collection passes each retained HTTP response clock into daily validation.
Replaying retained evidence never reads the current wall clock; a newly
captured response after a daily rollover rejects the old window. The monitor
reconciles FX observations against its validated source geography, since
individual FX rows do not repeat it.

AEMO reader and specimen evidence remain isolated for a future permitted access
review. The proposed candidate was rolled back after both production domains
failed this gate. Local validation cannot establish publisher accessibility.

Status output labels the original eight-desk observation window explicitly and
reports daily-history scheduled evidence separately. A passed legacy window
cannot make the expanded scope ready or manufacture a delivery receipt.

Reproduce the retained 113 passing tests, without HTTP or checkpoint mutation:

```sh
node --test test/monitor*.test.js test/statcan-gdp-monitor.test.js
```

`before-aemo-runtime-hold-monitor-tests.tap` preserves the earlier local run.
Its AEMO fixture checks were never production acceptance. The current controls
assert the held source is absent from collection and cannot be approved through
its healthy-looking specimen. All historical active scopes remain unchanged.

## Actual-capture replay helper

`scripts/replay-gap-release.mjs` is prepared for final retained captures. It was
syntax-checked and refuses missing arguments; it has not yet been run against an
accepted candidate. Its required independent capture validation refuses staged
captures and failed source acquisitions. A blocked publisher therefore remains
a release blocker, even when injected fixture tests pass.

The helper accepts these positional arguments:

```text
CHECKPOINT OLD_REPORT PRIOR_REVIEW PRIOR_APPROVALS REVIEW APPROVALS
GAP_CAPTURE CORE_APEX CORE_WWW NEW_OUTPUT CAPTURED_AT
```

`CHECKPOINT` and `OLD_REPORT` are the original files under
`verification/us-paid-2026-10-20/checkpoint-predecessor/`. `PRIOR_REVIEW` and
`PRIOR_APPROVALS` are the immutable `prior-review.json` and
`prior-approvals.json` retained here. `GAP_CAPTURE` contains the new
`gap-interface-report.json` and original response bodies; the two core
directories contain `_health.json.response` and full desk responses for each
domain. `CAPTURED_AT` must be an actual capture-completion UTC timestamp.

The exact final review and approvals can be explicit proposal files for a
clearly labelled offline proof or accepted operations files after release.
Neither input becomes approved merely by passing this helper. It preserves all
15 earlier approvals, permits only the six exact new approvals, revalidates
the pinned independent references and compares both domains before constructing
direct and four hypothetical-prefix cases. Its only write is a new evidence
JSON file; it cannot overwrite inputs or save a checkpoint.
