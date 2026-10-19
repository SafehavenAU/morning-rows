# USA CPI continuation — release blocked by measured Free CPU budget

The user confirmed Workers Free, 10 ms CPU. The original BLS access failure is
resolved with truthful Morning Rows identification and `Accept: */*`. The final
candidate reads BLS's original series database table plus its latest-publication
index; it presents the same CUUR0000SA0 statistical contract. It does not use the
quota-limited API, a proxy, an older edition, or an embedded specimen.

## Result and evidence boundary

Implementation and data/interface verification pass. **Production release does
not pass.** The user explicitly chose **“Keep Free; pursue further optimization”**.
This additional optimization pass is complete, with the same one-series candidate
still blocked. No plan upgrade is requested or authorized.

The final clean candidate `e48695d` / Worker
`b8c7eb23-bade-40d0-a35d-5496165ecde1` measured **29 ms cold CPU**, with complete
version/path/time-correlated traces and a confirmed fresh publisher retrieval.
The best earlier sample was12ms; the later29ms confirmation prevents claiming a
reliable27→12ms reduction. No measured cold sample met the10ms gate. Cached full
output measured2ms in the final capture; it is not cold-budget evidence.

[All measurements and file hashes](runtime-budget/optimization-summary.json)
retain15 captures, including incomplete results. Main experiments:

| Candidate | Cold selected CPU | Disposition |
|---|---:|---|
| Bulk TSV |87ms|Replaced by original table|
| Historical XLSX / native inflate |38 /50ms|Evidence retained; not runtime|
| Initial original table + index |27ms|Baseline before optimization|
| Lexical YYYY-MM ordering |18ms|Retained; avoids locale initialization|
| JSON response fast path |17 /29ms|Retained; removes text/parse roundtrip|
| Bounded native byte read |12ms|Retained; strict cap and fatal UTF-8|
| Bounded-year acquisition |29ms|Removed|
| Minified build |12ms|Retained|
| Generic hash helper / direct byte hashing |14 /17ms|Removed|
| Composed response fingerprints |19ms|Removed; later override traces incomplete|
| Final simplified runtime confirmation |29ms|Release still blocked|

The runtime keeps the original all-years table/index acquisition, published
statistical semantics and fingerprint algorithm. Official CSV formatting was
investigated but omits required catalogue dimensions, so no CSV runtime change
was made. Local Node sampling is diagnostic only, not edge acceptance. The
production profiler request returned404; no actual edge function profile exists.

Each CPU version was staged at0% with approved production at100%, explicit
per-request version overrides and a version-filtered Wrangler tail. The verifier
now requires exactly one correlated trace for every requested route and a fresh
cold retrieval. Missing traces or wrong-version responses cannot pass. A CLI
sampling-rate setting of1 was rejected before collection and removed. Samples
are not percentiles or a sustained load test; all outcomes are retained.

Testing ended with approved Worker739b9031-305c-4bc7-afc5-79a82c654ac7 as the
**sole active version at100%**, deployment99833025-0360-45e2-9a2f-700de2c1c4b3,
2026-10-19T00:07:43.583441Z. Both domains independently match source7d614e2,
clean build44967a5319167783 ([identity proof](runtime-budget/final-production-identity.json)).
No plan, credential, binding, route, automatic Builds or collector checkpoint
change. No whole-site sweep or ordinary source alert was triggered by these tests.

## Verification

- 169 Node tests and20 independent Python tests and dry-run build pass.
- Final actual Cloudflare table-reader preview:22/22 integration scenarios
  (`runtime-budget/integration-final-preview.json`).
  Correct original data, cached/expired/conditional/HEAD responses, exact missing
  month, revision, new month, refusal, timeout, oversize and recovery are tested.
- Actual Worker replay: 315 legacy cases unchanged, eight US interface cases,
  221 schema-valid responses and three negative schema checks.
- Separate Python HTMLParser extraction reconciles all 13 slots with separate
  Python ZIP/XML/Decimal workbook extraction and original TSV/API/release evidence.
  Exact published cells 324.800, 334.980, 336.940 and rounded annual 3.7% match.
  All presentations share BLS statistical lineage; this is extraction/presentation
  independence, not a separate statistical estimate.
- Earlier complete nine-desk preview passed. Established contracts: Stats NZ23,
  NZ prices5, AIHW40, Wales1, NISRA4. Those checks precede later USA-only transport
  edits; no final production acceptance is claimed from them.
- Staged monitor replay preserves all33 real incidents, all35 repair records and the exact
  outbox from independently verified scheduled checkpoint sequence4. The real
  SHADOW start2026-10-18T23:22:22.161Z is preserved; no acknowledgment, checkpoint
  or USA scheduled start is written. This is explicitly constructed transition evidence.

Contracts were written before each transport correction:
`workbook/CONTRACT.md`, then `workbook/TABLE-CONTRACT.md`. Tests reject wrong
geography/population/base/adjustment, period mismatch, partial coverage, older
release substitution, invalid zero, unknown flags and missing-value confusion.
Original retrieval, publication and independent verification times stay distinct.
The one-hour cache is per location; it is not a global quota guarantee.

## Reproduce and resume

```sh
npm run build
python verification/us-build-2026-10-19/workbook/verify.py
python verification/us-build-2026-10-19/workbook/verify-table.py
US_REPORT_DIR=/tmp/us-contract node scripts/verify-us-contract.mjs
python scripts/verify-us-schema.py /tmp/us-contract
node verification/us-build-2026-10-19/replay-monitor-transition.mjs
```

Protected integration uses the configured Wrangler authentication with
`US_PREVIEW_REPORT=/tmp/us-preview.json node verification/us-build-2026-10-17/check-preview.mjs`.
For an explicitly staged 0% version, `node scripts/verify-us-version-cpu.mjs VERSION
/tmp/cpu-result.json` collects sanitized actual CPU evidence and fails if it
exceeds 10 ms. This helper never uploads/deploys. Remote dev disables CPU limits;
its successful responses and server wall time are not resource acceptance.

Resume this same one-series candidate with a measured CPU bottleneck and a
justified correction, rather than repeated unchanged uploads seeking a lucky
passing sample. Keep Free; no further billing decision is pending. Require a
complete final cold capture plus two fresh confirmation captures at<=10ms; each
must have a unique clean build cache key, exact routing and complete traces. Do not upgrade billing, waive the limit or
repeat releases automatically. Any future release still requires final-version
validation, both-domain acceptance, all eight established desks/core contracts
and the exact reviewed monitor identity transition. The staged release review
remains disabled, so main's eight-desk monitoring is untouched.

The first scheduled-cycle proof passed and was merged in PR9. Seven actual
scheduled days, real delivery acknowledgment,
UK CPI access and NZ-PRICES independent report evidence remain separate gates.
The existing hourly watchdog remains enabled; this build work neither dispatches
the daily collector nor restarts incidents or the SHADOW clock.
