# AEMO daily-bundle acquisition amendment — 20 October 2026

Written before `lib/aemo-daily-bundles.js`. This is a disconnected candidate for
the existing SA1/VIC1 completed-calendar-day contract. It neither activates a
source nor certifies a release. The prior monthly reader and its failed 406
production attempts remain unchanged and retained.

## Exact measure and independent acceptance

Retain exactly two NEM regions, SA1 South Australia and VIC1 Victoria, and the
latest fully elapsed **calendar day in fixed AEST (UTC+10)**. This is not civil
DST time, a trading day, a rolling 24 hours, a forecast or a national average.
The required 288 unique contiguous interval endings per region run from 00:05
through the following 00:00. Never substitute an earlier day, omit a missing
interval, or represent an unavailable value as zero.

Read `DREGION` regional reference price `RRP` in AUD/MWh, nominal and unadjusted,
only `RUNNO=1`, `INTERVENTION=0`. Layouts 2 and 3 are separately declared CSV
layouts, not observation revisions: require both selected rows and exact decimal
RRP equality. Require selected `APCFLAG=0` and `MARKETSUSPENDEDFLAG=0`; other flags
are outside this bounded evidenced contract and cause regional refusal. Neither
these flags nor a run number establishes finality. There is no FIRM or PRICESTATUS
field. Do not transfer `TRADE` from the monthly comparison into a purported
original daily field. Retain the actual run, intervention, flags and layouts.

Preserve the prior monthly-cent statistical definition by rounding EACH exact
base-ten RRP to cents, half away from zero, before mean/min/max/sign counts.
Accept the demonstrated decimal precision of up to five places, including
scientific notation such as `3E-05`; preserve the original RRP token. Do not
accept blanks, suppression symbols, NaN, infinities or more precise values.
Mean uses exact integer-cent sum/288 and half-away-from-zero cent rounding;
min/max use those rounded cents, and negative/zero counts count those rounded
prices. An explicit zero is valid; a rounded zero does not prove the raw price
was exactly zero. No demand weighting, inflation or seasonal adjustment.
The ten stable derived measure IDs remain SA1/VIC1 × mean, minimum, maximum,
negative_count and zero_count.

The retained 19 October 2026 specimen must independently match all 576 monthly
cent prices exactly after rounding and all ten summaries with Python CSV/Decimal
extraction. The source values, geography, requested interval coverage and exact
raw rounding—not runtime output alone—are the numerical oracle. Daily/monthly
presentations share AEMO market lineage, not independent price formation. This
exact specimen approval never certifies future vintages automatically.

## Discovery and transport

Use only the publisher-advertised index
`https://nemweb.com.au/Reports/CURRENT/Public_Prices/`. Parse its directory list;
require the expected title/path and exactly one ordinary same-host link for each
of the two required trading dates (calendar day minus one and calendar day).
Use the complete advertised filename `PUBLIC_PRICES_YYYYMMDD0000_YYYYMMDDhhmmss.zip`;
never guess the publication suffix. The filename/report header generation time
is a source-labelled creation timestamp, NOT a guaranteed publication time.
Multiple distinct files for one required trading date are ambiguous and refused,
not silently ordered by an inferred revision convention. Missing files are
explicitly unavailable. Reject future creation times and contradictory headers.

Each bundle spans 04:05 on its trading date through next 04:00. The earlier
bundle contributes calendar-day 00:05–04:00, and the later contributes
04:05–following 00:00. All selected rows must be within their declared bundle;
CSV order is not assumed. Two daily bundles are shared between both regions:
**one index GET plus two ZIP GETs**, with truthful Accept headers, manual redirect
refusal and a 20-second bound each. No monthly requests, retries, archive crawl,
registration, key, extra hosted store, proxy or browser impersonation.

Compressed stream bounds are 128 KiB for the index and 512 KiB per ZIP. Require
one flat, precisely named CSV member, supported ZIP method 0/8, consistent local
and central directory metadata, no encryption, descriptors, extras, comments,
multiple volumes, nested archives or path traversal. Limit actual expansion to
2 MiB, verify CRC32 and byte lengths, strict UTF-8, CSV field counts/headers,
record count/trailer and at most 3,000 rows. Reject changed unsupported framing
rather than guessing a newer format. Incremental deflate output is counted during
expansion, not merely trusted from ZIP metadata.

The two observed bundles were generated around 04:05 AEST. No publication SLA is
inferred. From midnight until the required bundles exist, latest-completed-day
service can be unavailable. The acquisition clock is pinned, and a request
crossing fixed-AEST midnight refuses its result. Cache helpers clip lifetime to
that boundary; root owns actual Worker/cache integration.

## Failures, provenance and gate boundaries

Global discovery/archive/framing failure prevents reconstruction; no older file
or monthly fallback is permitted. Region-specific selected-cell errors preserve
a complete valid sibling and report degraded health. Each successful region
must contain all 288 rows, the exact ten-definition contract and recomputable
summaries. A selected failed region has no numeric observations.

Retain actual index and both ZIP URL/hash/size/retrieval clocks, CSV member
hashes/sizes, report generation labels and raw selected prices. Retrieval is not
publication; `published_at`, publisher update SLA and finality remain unknown.
A changed file may revise statistics, while a retrieval clock alone does not.
Public validation requires an explicit acquisition clock; offline pure parsing
may omit acquisition provenance and cannot count as a public accepted capture.

Reuse remains AEMO's accurate-attribution permission, not CC/OGL. Source:
Australian Energy Market Operator (AEMO), NEMweb PUBLIC_PRICES; daily summaries
calculated by Morning Rows. Original full aggregate ZIPs are retained only to
reproduce bounded archive/framing/reader tests; no private/unit/person records
or public-index telemetry script are needed.

Acceptance still requires actual protected Worker reader/resource checks,
wrong-date/region/run/flag/missingness/precision/ZIP/redirect/future and midnight
controls, independently checked actual staged/both-domain captures, existing
contract regressions, exact version promotion and reviewed monitoring identity.
The separately retained Worker 200/hash probes prove access to two fixed ZIPs
only. They do not prove this reader, discovery, publication availability,
scheduled operation or delivery. Root owns integration/release/monitoring.

## Publisher metadata resolved during implementation

The ordinary AEMO interface advertises
`https://visualisations.aemo.com.au/aemo/nemweb/datasets/public-prices-definition.yaml`.
The retained 20 October HTTP200 original explicitly describes next-day public
daily dispatch reports, separate DREGION layouts2/3 and TREGION layouts1/2,
RRP NUMBER(15,5) after capping/flooring/scaling, and APC/suspension meanings.
Independent review matches all124/134 DREGION field names to each original CSV
header. This resolves the dispatch-versus-forecast/report-family boundary. It
adds no TRADE/FIRM field or finality claim and does not widen the supported flags.
