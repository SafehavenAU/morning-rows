# Canada GDP semantics and validation repair — 20 October 2026

This bounded repair covers the existing Canada `product` source. The sampled
figures were numerically correct: Q1 2026 was 2,503,604 and Q2 was 2,524,127,
in millions of chained (2017) dollars, seasonally adjusted at annual rates.
The gap was that the response omitted those meanings and trusted positional,
unqualified data. The repair preserves `period`, `level` and `quarter_change`,
adds explicit quarter boundaries and statistical metadata, and validates the
exact current series before exposing it.

Implementation validation is in progress. No GDP release or scheduled acceptance
is claimed by this draft. The approved rent release remains production until a
specific tested Worker is promoted and recorded here.

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
Exact-version CPU and production capture results remain pending.

## Operational boundary

This repair does not change SHADOW cadence, notification policy or durable state.
The existing 115 obligations use the same 24 public probes. GDP receives stronger
semantic checks in its existing obligation; new evidence approval is exact to its
observed content version. A reviewed release edge must preserve every previous
identity edge and all incidents, repairs, notification history and actual scheduled
observations. A constructed replay is preservation evidence only.

The actual checkpoint remains sequence 5, run `39341442350`, completed
`2026-10-19T23:26:10.163Z`; two legacy scheduled observations exist, with no actual
USA, claimant or rent scheduled observation yet. No delivery receipt exists.
NZ-PRICES stays blocked on its selected 17 October specimen; UK CPI stays parked.
No completion of those gates or the broader maintenance plan is implied.
