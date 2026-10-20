# Existing Canada GDP correctness contract — preflight, 20 October 2026

Written before any runtime change. Scope is the existing `canada/product`
reader only: table **36-10-0104-01**, WDS product **36100104**, coordinate
**1.1.1.30.0.0.0.0.0.0**, vector **62305752**. No other StatCan readers,
geographies, history, series, infrastructure or publisher contact are selected.
Selected for implementation after independent review on 20 October 2026. This is a pre-code contract, not release acceptance. The correctness risk is plausible misinterpretation of unlabelled annual-rate real GDP and positional parsing; current sampled values are numerically correct. Preserve existing fields, add explicit semantics and fail-closed validation only for this exact existing series.

## Exact statistical meaning

The four coordinate members, verified against current cube and series metadata:

1. Geography member 1: **Canada** (classification 11124, geographic vintage
   2016; CSV DGUID `2016A000011124`).
2. Prices member 1: **Chained (2017) dollars**, active, not current prices and
   not the terminated chained-2012 or chained-2007 alternatives.
3. Seasonal adjustment member 1: **Seasonally adjusted at annual rates**.
4. Estimates member 30: **Gross domestic product at market prices**.

This is expenditure-based real GDP for the Canadian economy, not per-capita
GDP, household income, gross domestic income, a component, nominal GDP or an
additive sum of chained-dollar components. WDS unit code **81** means
**Dollars**; scalar **6** means **millions**; decimals **0** mean the reported
level is an integer number of millions. Preserve the exact publisher unit as
**millions of chained (2017) dollars**. Do not infer a foreign exchange
conversion. Frequency **9** means **quarterly**.

The level is expressed at an annual rate. The existing derived
`quarter_change` is the ordinary percentage change between adjacent quarterly
levels, **not an annualized growth rate**. Multiplying the level by four again,
dividing the ratio by four, treating `0.82` as a proportion, or replacing it
with annualized growth would be wrong.

## Period, latest-release anchor and revision semantics

`refPer` is the first day of the quarter (`YYYY-01-01`, `YYYY-04-01`,
`YYYY-07-01`, `YYYY-10-01`). For these observed quarterly records,
`refPerRaw` is the first day of the quarter's final month, not a second
observation: Q1 has `2026-03-01`, Q2 has `2026-06-01`.
`refPer2` and `refPerRaw2` are empty. Preserve raw fields and expose an explicit
quarter label (`2026-Q2`) and full inclusive quarter boundaries. If compatibility
requires retaining `period: "2026-04"`, label it explicitly as the legacy
quarter-start-month alias, never as an April monthly observation.

Require exactly two unique adjacent quarters, normalized into ascending
chronological order by `refPer`; do not trust response-array position.
Reject duplicates, gaps, malformed dates, unsupported frequencies, inconsistent
raw periods or additional result objects. Latest quarter must equal the
independently fetched cube metadata `cubeEndDate`; series metadata alone lacks
this anchor. A response containing two internally valid older quarters cannot
silently stand in for the current cube.

Proposed bounded runtime acquisition is the existing two-point WDS data request
plus `getSeriesInfoFromCubePidCoord` and `getCubeMetadata` for the same selected
product. This adds **two small metadata requests**, not new statistical coverage.
Current sizes are 619, 473 and 11,686 bytes respectively. The latest point's raw
release time must match the cube release; the prior point may retain its earlier
release time but must not be later. Retain all raw release times independently
from retrieval time. They are currently `2026-08-28T08:30`, without a UTC offset:
**do not append Z or manufacture a UTC instant**. General WDS documentation
mentions 08:30 Eastern Standard Time for service updates; this is not sufficient
to normalize an unzoned summer timestamp without an explicit convention.

The publisher's dated release says Q1 2026 was revised with new/revised inputs
and updated seasonal information. Symbol 0 does not establish finality or mean
that a value was never revised. Keep current values and metadata; do not present
a vintage archive. A future reference quarter ending after retrieval is invalid,
but no age-since-change staleness rule or guessed release deadline is added.

## Numeric and flag rules

Validate envelope status `SUCCESS`, response status 0, exact product,
coordinate, vector and series title. Validate the same frequency/scalar/decimal
contract on both data points and series metadata; validate cube dimension
positions, selected member labels and nonterminated status before interpreting
the coordinate. A rebase, coordinate change, termination or unit drift requires
review, never silent substitution.

Require finite, safe, positive integer levels for this total-GDP contract.
Zero or invalid denominator cannot produce growth. Do not coerce strings,
nulls, missing values, suppressed observations or nonfinite numbers.

Documented flag interpretation from `getCodeSets`:

- `securityLevelCode=0`: public. Code 1 means confidentiality suppression and
  must not be exposed as an observed number.
- `statusCode=0`: normal. Other statuses include unavailable, rounded-to-zero,
  not-applicable and quality flags; this bounded contract fails closed for
  nonzero/unknown status rather than guessing missingness or zero.
- `symbolCode=0/1/3`: no symbol / preliminary / revised. These three documented
  symbols may be accepted with their explicit qualification. Unknown symbols
  fail. A public, normally reported numeric revision remains usable.

Compute `100 * (latest_level / previous_level - 1)`, round the legacy
`quarter_change` to two decimal percentage points using the existing JavaScript
rounding convention, and identify it as derived from the two reported,
publisher-rounded levels. An independent decimal calculation must match the
rounded result; do not claim precision beyond those inputs. Preserve the
unrounded calculation only if clearly labelled derived.

## Pinned observations and independent comparisons

The initial specimen is the **28 August 2026 release**, acquired
20 October 2026. It contains:

| Reference quarter | WDS reference date | Level, millions of chained (2017) dollars, SAAR |
| --- | --- | --- |
| 2026-Q1 | 2026-01-01 | 2,503,604 |
| 2026-Q2 | 2026-04-01 | 2,524,127 |

Independent Python extraction must reconcile both exact values and dimensions
against (a) the explicitly selected original public table presentation, (b) its
minimal two-row CSV export, and (c) dated Daily release Table 4. Require zero
tolerance for reported level integers, exact date/dimension agreement and no
duplicate selected records.

Derived ordinary growth is approximately **0.8197382653%**, rounded **0.82%**.
The dated Daily quarterly-growth presentation reports **0.8%** at one decimal;
comparison tolerance is 0.05 percentage points for that rounded publication.
The independently computed annualized rate is approximately **3.3194920983%**,
which rounds to the dated Daily annualized-growth presentation **3.3%**. That
comparison distinguishes interpretations; annualized growth is not a new
requested output. Daily Table 4's annualized *contribution* column is a
different measure and must not be substituted for growth.

All presentations share Statistics Canada's national-accounts lineage. Different
transport/extraction verifies selection, values and semantics, not an independent
survey or recomputation of GDP. The current WDS and official table are mutable;
the dated Daily release pins the period/vintage comparison. A newer vintage
cannot certify this specimen without a fresh comparison.

The first attempted database-loading export combined selected member 30 with
checked hierarchy level 1. It returned extra aggregates and duplicate GDP rows.
That acquisition is quarantined as a request-selection failure, not silently
deduplicated and not evidence that the WDS series itself contains duplicates.
The corrected export uses the same exact selected members with an empty
`checkedLevels`, yielding precisely two GDP rows.

## Falsifiable failure and acceptance gates

Before any release, constructed tests must cover:

- Wrong product/coordinate/vector/Canada/price basis/chain year/adjustment/
  estimate, metadata response failure, unknown dimensions and termination.
- Reversed point order (correct normalized result), duplicate/gapped quarters,
  same-quarter pairs, stale pair below cube end, inconsistent raw quarter dates,
  future quarter, swapped metadata releases and ambiguous result envelopes.
- Scalar, unit, frequency or decimals drift; missing/string/nonfinite/negative
  levels; zero denominator; security suppression, nonzero status and unknown
  symbols. Preliminary/revised symbols remain qualified, never discarded.
- A real value revision changing the affected observation/content identity;
  acquisition hashes/clocks alone not changing statistical versions.
- HTTP failure, timeout, invalid JSON, UTF-8 and response bounds; no stale
  specimen fallback; unchanged successful Canadian siblings survive failure.

Preserve compatible `period`, `level` and `quarter_change` numeric values while
adding exact semantics and retaining both evidence points. Any typed measure
or monitor contract must enforce the native statistical contract; existing
native-availability success alone is insufficient.

Current release acceptance requires actual reader validation in protected
Cloudflare preview and the established versioned release workflow, both public
domains, all nine desks and established Stats NZ/AIHW/Wales/NISRA/USA/claimant/
rent contracts. Independent preflight evidence and local tests alone are not
release or sustained-operation acceptance. Monitoring scope and evidence
updates require the existing reviewed serialized path; preserve incidents,
repairs, outbox, SHADOW, delivery and parked gates.

## Current finding boundary

The retained rent-release legacy CPU Canada response at
2026-10-20T07:27:20–07:27:31 UTC is `period=2026-04`, `level=2524127`,
`quarter_change=0.82`. Original WDS and separately presented official data
support those numeric values. **No wrong current numeric observation is
demonstrated.** The concrete gap is omitted quarter/unit/SAAR/revision semantics
plus code-supported vulnerabilities to unchecked identities, flags, order,
coverage and revisions. Fix only those gaps; do not change the selected GDP
series or the growth formula to annualized growth.

Reuse is governed by the Statistics Canada Open Licence:
https://www.statcan.gc.ca/en/terms-conditions/open-licence.
Retain Statistics Canada attribution and distinguish derived calculations from
publisher values. This bundle contains public aggregate values and metadata.
