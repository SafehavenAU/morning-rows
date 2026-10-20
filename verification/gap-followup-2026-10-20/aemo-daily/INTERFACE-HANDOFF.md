# AEMO daily-bundle interface candidate

Implementation only; production/resource/monitoring acceptance remains
parent-owned. The frozen reader is
`151a0eba192cac883a5f156fbafad077bfe3e8d989d78dfc6a1fb1fcbb15c4a6`.
Its protected correctness proof is
[RESULT.json](protected-preview/RESULT.json). No reader or publisher request was
repeated during integration.

## Public selection

- Full native section: `/australia.json`, `grid_day`; alias `/morning.json`.
- Catalogue: `/catalog.json?desk=australia`; one `grid_day` source, ten measures.
- Source: `/australia.json?source=grid_day`.
- Measure: `&measure=SA1.mean`, and the same five suffixes for `VIC1`.
- Exact observation: `&observation=YYYY-MM-DD`.
- Suffixes: `mean`, `minimum`, `maximum`, `negative_count`, `zero_count`.
- IDs are case sensitive. Only the latest fully elapsed fixed-AEST calendar day
  may be returned. The source is not a history service.

The fixed 19 October specimen has these independently derived values:

| Region | mean | minimum | maximum | negative_count | zero_count |
|---|---:|---:|---:|---:|---:|
| SA1 | 6.73 | -169.96 | 95.76 | 189 | 2 |
| VIC1 | -7.80 | -44.47 | 75.18 | 206 | 9 |

The first three columns are AUD/MWh; counts are five-minute intervals after
rounding each raw RRP to cents, half away from zero. Each successful region
contains exactly 288 interval-ending raw/cents observations. Both DREGION
layouts must agree; RUNNO=1, INTERVENTION=0, APCFLAG=0 and
MARKETSUSPENDEDFLAG=0 are explicit restrictions. No TRADE, FIRM or finality
field is invented.

## Native and typed binding

`grid_day` contains status, calendar_day, fixed timezone/day policy,
next_rollover_at, two ordered `regions` (SA1 then VIC1), two `bundles`, three
public acquisition `provenance` records, ten `definitions`, publisher, licence,
limitations and unknown publication/update fields set to null.

Source-selected `data` and `context` are both the complete native object.
Measure/exact `data` is the single typed row; its `context` remains native.
Rows include measure/measure_id, period/value/value_state, region/geography,
statistic/unit/kind, interval count/length, bounds/timezone, protocol flags,
rounding, actual source URLs and explicit revision uncertainty.

Each typed observation resolves to a numeric native summary:
`/grid_day/regions/0/summary/{statistic}` for SA1 and
`/grid_day/regions/1/summary/{statistic}` for VIC1. Observation versions include
the statistic's own value and qualifications, excluding the locator and
acquisition provenance. Statistical content versions also exclude provenance.
The public context retains that acquisition evidence.

`/schema.json` installs `aemoDailyNative`, `aemoDailyDefinition0`–`9`,
`aemoDailyRow0`–`9`, `aemoDailyObservation0`–`9` and health-specific schemas.
The schema is structural: the reader separately checks cross-field equality,
actual dates, contiguous coverage, source ownership and decimal arithmetic.
Offline Python validation must load JSON numeric tokens as Decimal for exact
`multipleOf: 0.01` semantics.

## Refusals and partial health

| Condition | HTTP / code |
|---|---|
| Unsupported source/measure identity | 404 `unknown_source` / `unknown_measure` |
| Invalid calendar date | 400 `invalid_observation` |
| Valid unretained date | 404 `observation_not_retained` |
| Observation without measure | 400 `incomplete_selection` |
| Unknown or duplicate query parameter | 400 `unsupported_query` |
| Failed requested region | 503 `retrieval_failed` |
| Incoherent native/health, stale day or absent public provenance | 503 `representation_validation_failed` |

A region-specific failure leaves five healthy sibling observations and five
explicit `unavailable_measures` on the source selection, with degraded health.
Healthy sibling measure/exact selection remains 200 with degraded retrieval.
Unavailable entries have no fabricated value, period or observation identity.
A global acquisition failure returns null native data with source error.
No refusal substitutes another day, region or zero. The legacy five-region grid
snapshot is separately fetched and remains unchanged.

## Request and cache boundary

One complete Australia acquisition adds exactly three shared publisher requests:
directory index plus its two advertised ZIPs. It makes no monthly CSV request.
The two ZIPs jointly cover the selected calendar day across NEM trading days.

Full desk and all selections use the existing complete-desk cache. Its internal
expiry and boundary marker must agree with the current fixed-AEST day; missing
or stale markers are cache misses even if ordinary TTL is extended. Public
cache lifetimes end no later than 14:00 UTC (fixed-AEST midnight).

The reader checks midnight after acquisition, parsing and hashing. The Worker
also checks the whole-desk completion and checks again after response hashing.
A final crossing returns explicit daily-source refusal and no-store; it cannot
produce an old-day conditional 304. Public TTL is clipped once more at response
completion, so time spent hashing cannot extend cache life beyond midnight.

The independently owned interface checker uses 34 routes per domain: native,
catalogue, source, all ten measure/exact pairs, HEAD/304, identity/schema and
seven refusal controls. Its exact original-value comparison is valid only for
19 October before 20 October 14:00 UTC; the next day needs new evidence.
