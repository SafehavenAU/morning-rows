# Canada GDP semantics and validation repair — 20 October 2026

This bounded repair covers the existing Canada `product` source. The sampled
figures were numerically correct: Q1 2026 was 2,503,604 and Q2 was 2,524,127,
in millions of chained (2017) dollars, seasonally adjusted at annual rates.
The gap was that the response omitted those meanings and trusted positional,
unqualified data. The repair preserves `period`, `level` and `quarter_change`,
adds explicit quarter boundaries and statistical metadata, and validates the
exact current series before exposing it.

**Released and accepted on both domains.** Clean source
`a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b`, Worker
`775bfe2d-491b-4bf5-a257-4d3465003351`, fingerprint `fc27e14328f2c397`,
was promoted to 100% by deployment `5b9bb834-4aef-4f2f-8dd5-bc5d6614951e`
at `2026-10-20T08:11:15.420461Z`. The source and evidence are reviewed in
[PR14](https://github.com/SafehavenAU/morning-rows/pull/14). Its later evidence
and merge commits are not the deployed source. The rollback target is the accepted
rent Worker `b2a562a7-d137-4376-a6ca-54f29f1415ad`, source
`f85224e6a9ee601d9e706ffab2cd133d3697c272`, fingerprint `d06c032d78d73a12`.
Scheduled observation of this stronger GDP contract is pending.

## Contract and original evidence

The [pre-code contract](CONTRACT.md) fixes table 36-10-0104-01, coordinate
`1.1.1.30.0.0.0.0.0.0`, vector `62305752`, Canada, real expenditure-based GDP at
market prices. The annual-rate **level** and ordinary, nonannualized **growth**
are different concepts: `quarter_change=0.82` percent is calculated from the two
reported levels; the separately published annualized rate rounds to 3.3 percent.
`period=2026-04` remains a compatibility alias for the quarter-start month,
not an April monthly observation. Exact selection uses `2026-Q1` or `2026-Q2`.

[Original evidence](ORIGINAL-EVIDENCE.md), the [manifest](original-manifest.json)
and [independent report](independent-report.json) retain the dated 28 August
release, original WDS data and metadata, selected table presentation, corrected
two-row CSV and minimal Daily tables. Six exact level comparisons and the two
distinct growth calculations pass. A separate Python method performs extraction;
it does not call the JavaScript reader. All presentations share Statistics
Canada's national-accounts lineage. This checks interpretation and selection,
not an independent statistical recomputation of GDP.

The first CSV request selected overlapping hierarchy levels and returned extra
rows. That request failure remains in the acquisition record. The accepted
specimen is the corrected exact two-row export; no silent deduplication occurs.
Mutable current tables cannot certify a different vintage. Raw publication time
`2026-08-28T08:30` has no UTC offset and remains unnormalized. Publication,
retrieval and independent verification times are separate.

## Runtime and interfaces

Three bounded parallel requests obtain the existing two observations, selected
series metadata and current cube metadata. Two small metadata requests are added,
with no extra statistical series, desk, infrastructure or collector probe. The
reader verifies identities, dimensions, units, quarter adjacency, cube latest
quarter and release, flags and numeric validity. Reversed valid points normalize
correctly. It refuses stale pairs, silent rebases, suppression, invalid units,
unknown symbols, missing observations and failed metadata. Preliminary/revised
symbols are retained explicitly. Unchanged quarterly values are not stale merely
because time has passed.

`/canada.json?source=product` exposes two reported level observations and one
derived growth observation. `measure=level` selects the two quarters;
`measure=quarter_change` selects the latest growth and its two input levels.
Unsupported or unretained selections return explicit refusals. Observation
versions reflect statistical corrections and qualifications; retrieval timestamps
and byte hashes alone do not create statistical revisions. Healthy Canadian
siblings survive a product-source failure.

## Reproduction

```sh
python3 verification/statcan-gdp-2026-10-20/verify-retained.py verification/statcan-gdp-2026-10-20
npm run check
```

Network acquisition programs in this directory are explicit separate operations.
They write into a new temporary directory and must not overwrite the retained
specimen. The combined local build passes 429 tests. The GDP structural schema passes
10 positive and 65 negative cases, including attempts to evade the contract by
changing its source identity. Protected Cloudflare remote dev passes 23 actual
reader/selector scenarios; code hashes are unchanged across that run. See
`local-validation.json`, `fault-preview.json` and `IMPLEMENTATION-REVIEW.md`.
The exact candidate measured 15 ms cold USA CPU, 26 ms Canada CPU and 170 ms
maximum across the eight legacy desks, below the separate 100/500 ms gates.
The Worker ceiling remains 1,000 ms; this is not a billing cap or sustained-load
measurement. The three observed GDP acquisition payloads total about 12.8 KB.
Metadata and data share one bounded 20-second deadline. Failure of required
metadata intentionally withholds GDP while preserving successful siblings.
No credentials, key registration, infrastructure or automatic Builds changed.

## Actual release checks

| Gate | Result | Retained evidence |
| --- | --- | --- |
| Source/build | 429 tests and dry run; clean source PR check passed | `local-validation.json`, `candidate.json` |
| Protected actual reader | 23 scenarios, code hashes unchanged | `fault-preview.json` |
| Cold candidate CPU | USA 15 ms; Canada 26 ms; legacy maximum 170 ms | `usa-cold-cpu.json`, `legacy-cold-cpu.json` |
| Staged interfaces/core | 137 assertions, 50 semantics, nine desk schemas | `staged-core/`, `staged-offline-validation-summary.json` |
| Staged GDP | 103 assertions / 19 requests; 3 native and 11 selected comparisons; 9 schemas / 18 negative controls | `staged-gdp-final/`, `staged-gdp-validation.json` |
| Production interfaces | 151 assertions / 104 requests; 24 existing schemas / 26 exact BLS slots | `production-core/`, `production-core-validation.json` |
| Production GDP | 205 assertions / 38 requests; 6 native and 22 selected comparisons; 18 schemas / 36 negative controls | `production-gdp/`, `production-gdp-validation.json` |
| Production core semantics | 50 per domain | `production-apex-semantic.json`, `production-www-semantic.json` |
| Claimants | 366 assertions / 112 requests; 130 cells; 50 schemas / 370 negative controls | `production-claimants/`, `production-claimant-comparison.json`, `production-claimant-schemas.json` |
| NZ rent | 224 assertions / 62 requests; 232 native cells and 268 selected cells; 42 schemas / 48 negative controls | `production-rent/`, `production-rent-comparison.json` |
| Smoke | 18 apex / 17 www, including explicit GDP gate | `production-apex-smoke.json`, `production-www-smoke.json` |
| Final repository | 429 tests and dry run; deployed runtime unchanged; accepted GDP smoke gate enabled | `final-repository-check.json` |

GDP native comparison counts include the derived growth value alongside the two
reported levels per domain. They are not six independently reported quarters.
Each domain's exact level/growth/period selectors, rejected geography/date/unknown
measure/old quarter, HEAD and conditional GET are retained. The actual September
claimant reference from the rent release remains pinned: a later vintage cannot
silently certify these captures. Rent retains its exact March–August specimen.

The comparison of 230 source states found only known intermittent TfL changes
and ongoing ONS access-error detail changes; no unexpected regression. These are
release-regression comparisons, not new monitoring incidents or sustained recovery
claims. The ordinary source outbox remains quiet.

Failed or limited validation attempts remain visible:

- The first `staged-gdp/` capture stopped at the cache check because the new
  checker incorrectly copied rent's 120-second bound. Canada preserves its
  existing 3,600-second cache. Only the checker/verifier were corrected; controls
  accept 3,600 and reject 3,601. `cache-tooling-correction.json` and the original
  failed capture remain. `staged-gdp-final/` is the successful new capture.
- The extra `staged-core-claimant-comparison.json` reports 65 matching cells but
  fails an assumption of one health GET: staged core legitimately includes both
  imported CPU and later health responses. It is not a passing report. The
  dedicated claimant capture and its independent comparison pass.
- `production-semantic-derivation-initial.json` records a local copy precondition
  that rejected repeated identical-metadata `/llms.txt` GETs. The completed
  derivation validates every matching record, retains multiplicity and copies
  exact bytes. Original captures were never changed.
- The initial staged source classifier did not recognize the existing TfL
  `service`/`rail` key names. The initial unclassified result and explicit review
  are both retained; previous 429 and current successful responses are known
  source fluctuations, not a new runtime regression.

The first schema review also found an identity-discriminator bypass, fixed before
protected preview/source freeze. Either the canonical GDP id or source now
activates the strict schema and requires both correct identities. The local
schema suite includes 10 positive and 65 negative cases. Runtime meaning checks
and independent numerical checks remain necessary beyond schema validity.

For fresh capture reproduction (explicit network operations), use a **new output
directory** and the exact source/Worker IDs above:

```sh
node scripts/check-statcan-gdp.mjs NEW_CAPTURE SOURCE_SHA WORKER_ID
python3 scripts/verify-statcan-gdp-captures.py NEW_CAPTURE verification/statcan-gdp-2026-10-20/independent-report.json NEW_RESULT --expected-revision SOURCE_SHA --expected-version WORKER_ID --domains both
python3 verification/statcan-gdp-2026-10-20/reproduce-verifier-controls.py NEW_CONTROL_RESULT
node verification/statcan-gdp-2026-10-20/replay-helper-controls.mjs
```

The first two commands only pass while the current response matches the pinned
vintage and exact deployed identity. Never overwrite previous captures or use a
newer response to backfill this record. Constructed controls synthesize data only
in temporary directories and clearly separate it from actual publisher evidence.
The offline capture verifier imports no runtime reader and binds file bytes,
request status, route coverage, source identity, semantic values and schema.

## Operational boundary

This repair does not change SHADOW cadence, notification policy or durable state.
The existing 115 obligations use the same 24 public probes. GDP receives stronger
semantic checks in its existing obligation; new evidence approval is exact to its
observed content version. The fourth reviewed release edge preserves the three
previous edges and all 14 earlier observation approvals. Both captured production
domains pass offline replay from the actual sequence-5 predecessor, including
each possible remaining reviewed suffix. All 33 incidents, 36 repairs, outbox,
notification history and actual scheduled observations are preserved. See
`monitor-activation-verification.json` and `monitor-transition-replay*.json`.
These constructed replays are preservation evidence only. The hosted production
workflow reads the accepted `statcan_gdp_release` ledger entry to enable its GDP
smoke gate.

The actual checkpoint remains sequence 5, run `39341442350`, completed
`2026-10-19T23:26:10.163Z`; two legacy scheduled observations exist, with no actual
USA, claimant, rent or strengthened-GDP scheduled observation yet. No delivery receipt exists.
NZ-PRICES stays blocked on its selected 17 October specimen; UK CPI stays parked.
No completion of those gates or the broader maintenance plan is implied.
