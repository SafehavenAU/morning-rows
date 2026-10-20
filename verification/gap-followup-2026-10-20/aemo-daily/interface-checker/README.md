# AEMO public capture gate

The capture script makes 34 bounded requests per domain, using one existing full
Australia response for native comparison. Staged mode requests only the apex;
production mode requests apex and www. It does not directly query publishers,
refresh the oracle or accept a different daily vintage. Run only against the
exact frozen candidate specified by the release owner.

The independent oracle is the retained 19 October 2026 ZIP/CSV/Decimal extraction.
Its hash and all original files are checked before capture or replay. All 576
raw RRP tokens, layout-2 values, rounded cents, interval endings and bundle
ownership must match. The ten summaries are independently recomputed from the
originals. Multiple selectors and domains repeat checks of those same original
cells; they are not additional independent source observations. Daily and monthly
presentations share AEMO market lineage.

The exact selection plan includes the source, all ten measures, all ten exact
YYYY-MM-DD observations, seven refusal cases, HEAD and conditional GET. Native,
context, selected data, complete qualifications, definitions and resolved native
pointers must agree. Observation and content versions are independently replayed;
acquisition metadata must not revise statistical content. Original ZIP and expanded
CSV hashes remain in actual provenance. The separate five-region grid snapshot
must remain present. Cache lifetime must stay within 300 seconds and fixed-AEST
midnight; a capture crossing the specimen's eligible day fails closed.

Commands (all output paths/directories must be new):

```sh
node scripts/check-aemo-daily-bundles.mjs CAPTURE_DIR REVISION VERSION staged
node verification/gap-followup-2026-10-20/aemo-daily/interface-checker/verify-captures.mjs CAPTURE_DIR NUMERICAL_JSON REVISION VERSION staged
python verification/gap-followup-2026-10-20/aemo-daily/interface-checker/verify-numbers.py CAPTURE_DIR ORIGINAL_COMPARISON_JSON REVISION VERSION staged
python verification/gap-followup-2026-10-20/aemo-daily/interface-checker/verify-schemas.py CAPTURE_DIR SCHEMA_JSON REVISION VERSION staged
```

Omit `staged` for a both-domain production capture. `verify-captures.mjs` checks
transport, identities, all retained body hashes, independent values, metadata,
version replay, cache boundaries and refusals. `verify-numbers.py` independently
reopens original ZIP and monthly CSV bytes using Python Decimal; it has no
runtime-reader imports. `verify-schemas.py` uses the captured Draft 2020-12 schema,
explicit date/date-time format checks, no external references, 23 successful
schema documents per domain and eight adversarial schema controls. Schema
validity does not establish numerical correctness.

The offline `check-controls.mjs` creates capture subjects with the actual adapter
and integrated schema, then exercises these independent validators. It also
checks failed-source and partial-region behavior without HTTP. These constructed
captures are not actual Worker or release evidence. Every failed actual attempt
must remain retained; the capture script has no retry behavior. CPU, exact
version promotion, broader contract regressions and monitoring lineage are
separate release gates.

## Offline readiness evidence

`controls.json` records 34 passing constructed controls, including 1,362
semantic/transport assertions for the valid capture, 23 Python numerical
checks, 23 schema documents and eight schema negatives. Source and tooling
hashes were unchanged during the final run. The original failed local schema
attempt is preserved in `initial-decimal-validator-failure.txt`: Python binary
floats incorrectly rejected some valid cent-valued `multipleOf: 0.01` numbers.
The checker now loads both schema and bodies as Decimal, preserving the cents
constraint. No runtime change or remote request was made for that tooling fix.

As of this package, no public candidate or production capture has been made by
this checker. The protected reader proof is a separate retained acquisition.
