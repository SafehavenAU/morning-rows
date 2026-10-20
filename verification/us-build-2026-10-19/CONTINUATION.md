# Current continuation — user confirmed Workers upgrade

The user replied “worker upgraded” on20October2026. The same USA CPI reader now
continues under the [paid-plan contract](../us-paid-2026-10-20/CONTRACT.md):100ms
USA acceptance,1,000ms whole-Worker ceiling, three fresh captures and complete
release validation. Billing API access remains403; operational Paid entitlement
will be checked through the staged custom limit. USA is not yet released.
Prior Free measurements below remain historical failures under10ms.

---

# USA CPI continuation — release blocked by measured Free CPU budget

The user confirmed Workers Free, 10 ms CPU. The original BLS access failure is
resolved with truthful Morning Rows identification and `Accept: */*`. The final
candidate reads BLS's original series database table plus its latest-publication
index; it presents the same CUUR0000SA0 statistical contract. It does not use the
quota-limited API, a proxy, an older edition, or an embedded specimen.

## Result and evidence boundary

Implementation and data/interface verification pass. **Production release does
not pass.** The user explicitly chose **“Keep Free; pursue further optimization”**.
The same one-series candidate remains blocked. No plan upgrade is requested or
authorized.

The latest clean experimental candidate `0447e490` / Worker
`61bb5ada-00cb-48b9-b6b5-fc173fbcf082` measured **21 ms cold CPU** on20October.
Its exact canonical-fragment/table-boundary optimizations are removed after the
failed gate. The previous simplified clean candidate `e48695d` / Worker
`b8c7eb23-bade-40d0-a35d-5496165ecde1` measured **29 ms cold CPU**, with complete
version/path/time-correlated traces and a confirmed fresh publisher retrieval.
The best earlier sample was12ms. These sparse, variable observations do not prove
a reliable reduction. No measured cold sample met the10ms gate. Cached full
output measured5ms in the latest trial; it is not cold-budget evidence.

[All measurements and file hashes](runtime-budget/optimization-summary.json)
retain16 captures, including incomplete results. Main experiments:

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
| Exact canonical fragments + guarded table boundaries |21ms|Removed; release still blocked|

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
**sole active version at100%**, deploymentbaebe78f-5094-41c8-aa46-8a96d2b131cf,
2026-10-20T03:42:38.694344Z. Both domains independently match source7d614e2,
clean build44967a5319167783
([identity proof](runtime-budget/cold-fragments-production-restored.json)).
No plan, credential, binding, route, automatic Builds or collector checkpoint
change. No whole-site sweep or ordinary source alert was triggered by these tests.

## Verification

- 180 Node tests and dry-run build pass. The latest separate Python extractions
  each match all13 slots; the earlier20 independent Python tests remain retained.
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

## CPU evidence guard — 20 October 2026 Brisbane

The next build pass strengthened the verifier without changing the reader. The
probe now reads actual deployment metadata before any HTTP probe, requires the
exact candidate at 0% alongside approved production at 100%, and rechecks the
same deployment afterward. Both domains must match the approved clean identity in the health body and
emitted version/revision headers before and after testing. Every candidate response must
match one clean build; negative/nonfinite CPU, exceptions, missing/duplicate
traces and future or cached retrieval timestamps fail.

A live read-only preflight against the former candidate correctly returned
`candidate_not_staged_at_zero`: deployment 99833025 contains only approved
production. No candidate HTTP requests, uploads or deployments were made.
`runtime-budget/guard-preflight.json` retains that bounded result. Mutation tests
exercise synthetic passing evidence and rejection cases. This is verifier
validation, not a new CPU measurement; the 29 ms release blocker remains.

## Further cold-path investigation — 20 October 2026 Brisbane

A distinct canonical-string reuse experiment preserved the tested response bytes
and hashes. Local repeated-route median CPU fell from 2.731 to 2.514 ms, but
fresh-process first-request median regressed from 44.409 to 46.294 ms. After
initializing Node HTTP support first, the first CPI request changed only from
16.928 to 16.478 ms with overlapping ranges. These are local diagnostic numbers,
not Cloudflare CPU evidence. The complexity is rejected; no reader change,
version upload or edge trial follows from it. Inputs, prototype and measurements
are retained in `runtime-budget/serialization-experiment/`.

Independent review also caught a false rejection in the new CPU verifier:
production does not emit dirty/fingerprint headers. The verifier now checks those
fields in the health body, binds requests through the actual version/revision
headers, and rejects conflicting optional headers if present. A retained actual
production response is a regression fixture, so fabricated headers cannot hide
this error again. The corrected verifier is not a new successful CPU capture.

PR10's scheduled-span arithmetic and offline audit are merged at936e552; its main
build and production verification passed. This branch includes that merge.
Operational SHADOW, delivery acknowledgment and data-verification gates remain
independent of these implementation checks.

## Exact fragments and table boundaries — 20 October 2026 UTC

[Contract](runtime-budget/COLD-PATH-CONTRACT.md) preceded runtime edits.
The [portable diagnostic bundle](runtime-budget/cold-path-2026-10-20/README.md)
pins the baseline source, retained inputs, candidate prototypes, direct workerd
profiles and equivalence checks. Node and local workerd results differ; sampling
deltas include descheduling and cannot establish edge CPU. The combined prototype
reduced repeated-read non-idle sample count by about21%, supporting one bounded
edge investigation. It did not establish reliable cold performance.

Independent review found and fixed three canonical-construction traps: nested
footnote keys, additional row keys sorting after `version`, and object-valued
timing notes.104 pinned-baseline fragment comparisons and38 structural comparisons
pass. Two new repository tests independently reconstruct public fingerprints and
exercise table identity/coverage; they remain useful after removing the experiment.

The corrected experimental reader passed180 Node tests, a dry-run build,
315 unchanged legacy cases, eight US interface cases,221 schema-valid responses
and three negative schemas. Separate Python extractions matched13 publisher
slots. The final protected Cloudflare preview passed22 scenarios
([report](runtime-budget/integration-cold-fragments.json)).

The clean pushed candidate `0447e490` was uploaded and staged at0%, with approved
production at100%. The [complete actual capture](runtime-budget/version-cold-fragments-probe.json)
ran2026-10-20T03:42:10.098Z–03:42:18.749Z. Health/cold selection/cached full
desk/catalogue CPU was4/21/5/1ms. All four version/path/time-correlated traces,
fresh retrieval, clean candidate identity, unchanged staging and both-domain
approved production identity passed. The21ms cold request failed the10ms gate.
There were no unchanged retries or confirmation attempts after that failure.

The three experimental runtime modules are restored byte-identically tobb41f961.
The prototype and failed result remain retained. Approved production is the sole
active version again, with both-domain identity verified at03:43:26.449Z.
No USA release, wider source verification, monitoring mutation or completion claim.
