# CQC historical assessment cohort — implementation evidence

The [pre-code contract](CONTRACT.md) is implemented in
`lib/cqc-cohort.js`; Worker integration and release remain separate gates.
This is exactly five counts for adult-social-care overall ratings published
under CQC's single assessment framework as at **1 August 2025**, published
**24 October 2025**. It is not current whole-England care quality or a trend.

The unit is **ratings of individual services at a location**. It must not be
substituted with unique locations, providers or patients, or combined with
previous-framework location ratings. Risk-prioritised assessment and the
nonrepresentative cohort are mandatory native and typed qualifications.

All five original workbook counts match the actual offline reader:
Inadequate **125**, Requires improvement **809**, Good **2,063**, Outstanding
**65**, Total **3,062**. Independent Python ZIP/XML extraction also reconciles
the four categories exactly to the separate official SVG; their sum equals
the workbook total. The **37 independent checks** preserve original SHA-256,
source/title/date/framework and service-level qualifications. All presentations
share CQC inspection-record lineage; they are not an independent survey.

Reproduce from the repository root:

```sh
python verification/remaining-gaps-2026-10-20/cqc/verify-original.py
node verification/remaining-gaps-2026-10-20/cqc/compare-reader.mjs
node --test test/cqc-cohort.test.js
```

`independent-reference.json` contains the source-based comparison.
`reader-reference-comparison.json` records exact reader/parser code hashes and
five matches. The originals and request/hash records are referenced from
`../prior-audit/cqc/original/` without duplicating the workbook.
`reader-tests.tap` retains the local reader, public-validator, helper and
transport controls. No network, credential, Cloudflare, deployment or
scheduled-collection action was performed for this module.

The parser validates fixed workbook titles, edition, dates, framework/risk
guidance, category order and count columns. Native finite nonnegative integers
must reconcile to the explicit total. Numeric zero is preserved; missing,
suppressed, fractional or malformed cells are refused. Coherent corrections
to this same dated cohort are structurally allowed and change the observations,
but do not inherit this specimen's independent approval. There is no
hardcoded-runtime value fallback and no new-edition substitution.

One public original fetch is limited to 128 KiB and 20 seconds; redirects,
HTTP errors, absent/oversized bodies and corrupt or excessively expanded
workbooks fail at the caller's source-isolation boundary. Public validation
checks all fixed meaning, row identity/arithmetic and optional bounded
provenance. An explicit acquisition clock additionally rejects prepublication
or future provenance. Retrieval time is separate from publication date.

API:

- `parseCqcCohort(book, {now, provenance})` accepts the existing `openWorkbook`
  model. `now` is optional ISO or `{retrieved_at}` for offline use; provenance is
  zero or one original acquisition record.
- `readCqcCohort({fetcher, now})` fetches the fixed public workbook and supplies
  URL, bytes, digest and retrieval time. `now` is an injectable ISO clock function.
- `validateCqcCohort(data, acquisition)` returns false safely on malformed shapes.
  Public adapters should supply their explicit `{retrieved_at}` clock.
- `cqcCohortDefinitions()` returns five bounded typed definitions;
  `cqcCohortRows(value)` adds `measure_id` and fixed dimensions to validated
  native rows while preserving native `measure`, period/value/value_state.

An initial inspection expected the table-of-contents worksheet number as text;
the original XLSX stores it as numeric `1`. That preliminary parse failed.
The parser now requires the original numeric type, and a text-number negative
control is retained. The failure is not counted as a passing validation.

Protected Worker execution, source selection/schema integration, CPU,
both-domain regressions, versioned promotion, reviewed monitoring activation,
scheduled observations and the genuine delivery gate remain parent-owned.
This local implementation does not close the broader maintenance plan.

The first protected-reader attempt stopped before HTTP because workerd rejects
`redirect: error`. The transport now uses supported `redirect: manual`; any
redirect HTTP status and any unexpected final URL still fail. A focused 302
refusal control is retained. The original failed protected attempt remains in
the parent evidence; this correction alone is not a successful live read.

The corrected protected actual-reader attempt reached the original publisher but
returned HTTP 403. The root retained that actual Cloudflare failure at
`../preview/cloudflare-workbooks-live.json`; no cells were accepted from it.
CQC is excluded from the active phase-two Worker, adapters and public schemas.
This reader and its original-byte tests remain a disconnected candidate pending
permitted publisher access evidence. No further HTTP retry was performed.
