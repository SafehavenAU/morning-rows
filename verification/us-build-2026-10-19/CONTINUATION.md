# USA CPI continuation — release blocked by measured Free CPU budget

The user confirmed Workers Free, 10 ms CPU. The original BLS access failure is
resolved with truthful Morning Rows identification and `Accept: */*`. The final
candidate reads BLS's original series database table plus its latest-publication
index; it presents the same CUUR0000SA0 statistical contract. It does not use the
quota-limited API, a proxy, an older edition, or an embedded specimen.

## Result and evidence boundary

Implementation and data/interface verification pass. **Production release does
not pass**: the latest clean candidate `31efe08` / Worker
`08940f49-9a42-4329-8609-5d04aeb5545d` measured **27 ms cold CPU** against the
confirmed 10 ms budget. Cached full output measured 7 ms. HTTP 200 and an `ok`
execution do not override the budget; transient allowance is not a capacity plan.

| Transport | Clean source | Worker | Cold selected CPU |
|---|---|---|---:|
| Bulk TSV, targeted row allocation | 6a16977 | 658e23e9-6533-4510-983d-b73c35c2a99d | 87 ms |
| Original historical XLSX | 5fcd880 | ac67c559-6b09-4f7b-98b0-c479d63a2d00 | 38 ms |
| XLSX with native inflation | ade9553 | 72060dc7-06ad-4345-a155-5108f3e53c8b | 50 ms |
| Original database table + index | 31efe08 | 08940f49-9a42-4329-8609-5d04aeb5545d | 27 ms |

Reports: `runtime-budget/version-*-probe.json`. Each used an uploaded clean
version at 0% alongside the approved version at 100%, an explicit per-request
version override and a version-filtered Wrangler tail. Each report preserves
version IDs, event timestamps, CPU/wall time, outcomes and public responses.
Requests ran serially; the second event is the first USA selected read with a new
build-specific cache key. No repeated cold observation is inferred from a cached
read. These are bounded samples, not percentiles or a sustained load test.

The native ZIP experiment is removed from runtime. The workbook remains retained
as independent evidence. Normal traffic stayed on approved Worker
739b9031-305c-4bc7-afc5-79a82c654ac7 throughout. Testing ended with only that version
in deployment 360597ed-1238-4cb0-bedb-981a6140fc38 at 2026-10-18T23:24:00.114563Z.
Uploaded test versions are inactive. No change to plan, credentials, bindings,
routes, automatic Builds or collector checkpoint. No production source alert.

## Verification

- 168 Node tests and dry-run build pass.
- Latest actual Cloudflare table-reader preview: 22/22 integration scenarios.
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
- Staged monitor replay preserves all 33 real prior incidents, all 35 existing
  repair records and the exact outbox; no acknowledgment, checkpoint or scheduled
  start is written. This is explicitly constructed transition evidence.

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

Resume this same one-series candidate after a reviewed resource-budget decision
or further measured optimization. Do not upgrade billing, waive the limit or
repeat releases automatically. Any future release still requires final-version
validation, both-domain acceptance, all eight established desks/core contracts
and the exact reviewed monitor identity transition. The staged release review
remains disabled, so main's eight-desk monitoring is untouched.

Scheduled-cycle proof, seven actual scheduled days, real delivery acknowledgment,
UK CPI access and NZ-PRICES independent report evidence remain separate gates.
The existing hourly watchdog remains enabled; this build work neither dispatches
the daily collector nor restarts incidents or the SHADOW clock.
