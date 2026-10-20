# Revised release gates, separately retained

These are the audited gate tools prepared after the failed first production
attempt. They are separate from the unchanged original staged tools and
`../failed-production/` snapshots. They do not retroactively turn any failed
production invocation into a pass, approve a production identity, or restore
AEMO activation.

The core semantic wrapper retains the strict 50-check report. Its only
availability exception is the single SEPA Galashiels check, with the native
value explicitly null and the source status `error`: either exact publisher
HTTP 503 (`timeseries.sepa.org.uk returned HTTP 503`) or exact
`Source request timed out` with the `http_status` property absent. A generic
parse error, another HTTP status, a non-null failed observation or an unrelated
semantic failure does not qualify.

The production health wrapper applies that same narrow condition and checks
source-state changes separately. It also accepts a genuine all-pass strict gate
without inventing an exception. Both wrappers require the accepted GDP SEPA
baseline, its hash-bound null body, a six-hour evidence window and unchanged
`lib/open-observations.js` / `lib/sources.js` blobs. The working files were
compared against the accepted GDP commit during this read-only audit.

[audit-confirmation.json](audit-confirmation.json) records the exact file hashes,
static-review boundary, unchanged blobs, and verified binding between the
production helper and its 11 passing **constructed** v3 controls. The retained
final offline timeout review still has `strict_semantics_pass: false` and a
separate `release_gate_pass: true`; its earlier failed offline review is also
preserved. Neither is a new HTTP acquisition or accepted production run.

No captured evidence, old helper, runtime file, operations ledger, checkpoint,
receipt or schedule was changed by this packaging task. The tools contain their
original absolute paths; no file was rewritten to relocate them.
