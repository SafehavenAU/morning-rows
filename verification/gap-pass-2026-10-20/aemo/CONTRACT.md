# AEMO completed calendar-day price contract — 20 October 2026

Written before the new runtime module. This closes the first build gap only:
`australia/grid_day`, SA1 and VIC1. The existing five-region `grid` snapshot stays
unchanged. No national average, retail bill, forecast, moving 24-hour window,
other region, arbitrary history or market credential is introduced.

## Fixed statistical and date contract

Use official AEMO `PRICE_AND_DEMAND_YYYYMM_{SA1,VIC1}.csv`, required columns
`REGION,SETTLEMENTDATE,TOTALDEMAND,RRP,PERIODTYPE`. `TOTALDEMAND` is not used.
Select the latest **fully elapsed calendar day in fixed AEST (UTC+10)** from the
acquisition clock, not Adelaide/Melbourne civil time and not the NEM trading-day
boundary. Exactly 288 unique, contiguous five-minute interval-ending prices
must run from 00:05 on that calendar date through 00:00 the following date.
The actual requested date is exposed; if the monthly file has not published a
complete day, return an explicit source/region failure. Never substitute an
older complete day or average an incomplete window.

`RRP` is the regional wholesale reference price in AUD/MWh, nominal, without
seasonal/inflation adjustment. Require `PERIODTYPE=TRADE`, exact selected
region, finite signed decimal prices at the demonstrated cent precision, no
blank/coerced/suppressed/nonfinite cells. Negative and explicitly published zero
are valid. A zero after publisher cent rounding does not establish that the
higher-precision dispatch price was exactly zero. Never infer finality from
`TRADE` or transfer a sampled `FIRM` status to the full window.

The five derived daily statistics per region are `mean`, `minimum`, `maximum`,
`negative_count`, and `zero_count`. Stable measure IDs are `SA1.mean`, etc.,
with exactly ten definitions. Mean is an equal-duration mean of all 288
published cent prices; use integer-cent accumulation and half-away-from-zero
rounding to two decimal AUD/MWh. This is not demand-weighted. Min/max retain
publisher cents; counts have unit `five-minute intervals`. Independent Python
Decimal extraction must reproduce all summaries and preserve all 576 raw cells.
An exact observation selector is the requested `YYYY-MM-DD`, not an interval
ending timestamp. Native interval evidence remains available for inspection.

## Acquisition and cache boundaries

Read the selected day's month file for each region: exactly two requests.
Fresh September/October originals establish interval-start month ownership:
September starts 1 September 00:05 and includes 1 October 00:00; October begins
1 October 00:05. Therefore a 30 September calendar day is completely in the
September file, including its closing October midnight. Never pick the month
from the closing timestamp or fetch a substitute month for missing cells.
Record every actual source URL/hash/byte count and acquisition instant. Each
request is bounded to 1 MiB and 20 seconds; no archive fanout, storage,
registration or key. A month file may contain other dates; those do not become
served history. Duplicate selected rows fail closed. Validate full CSV framing
and selected records; do not coerce forecasts into prices.

The latest elapsed day advances at **14:00 UTC**, fixed AEST midnight. Expose a
date-clock helper and clip any existing Australia cache lifetime to the next
such boundary. A cache hit from the old day after the boundary must not be
served as the latest completed day. A request spanning midnight must either
finish under one pinned date before the boundary or fail/retry under the new
date; it may not return mixed dates. Root owns Worker/cache integration.

## Failure isolation and semantics

Each region is independent. One failed region yields `degraded` source health,
its explicit failure and the complete successful sibling; a selected failed
region must return 503 with no substituted observations. Both failures are an
error. A successful region always has the exact requested 288 intervals.
Definitions retain geography, period convention, units, derivation, source and
reuse terms. Unavailable numeric cells are never zero. Wrong region, duplicate
or missing intervals, malformed dates, daylight-saving offsets, frequency or
forecast contamination, non-cent numbers, malformed/oversized data, HTTP and
timeout failures must be rejected. Changed values revise dependent statistics;
retrieval clocks alone do not establish a statistical revision.

## Evidence, reuse and acceptance

Historical research has 576 original monthly CSV cells for 16 October and only
selected independent dispatch comparisons. Fresh evidence must state its actual
calendar day and extent of reconciliation. Prefer a bounded official dispatch
daily/archive presentation to reconcile all 576 cells at AUD0.005/MWh tolerance
because monthly CSV prices round dispatch values to cents. All presentations
share AEMO market lineage: this tests extraction, selection and rounding, not
an independent electricity-market calculation. If full-window separate evidence
cannot be retrieved, retain the exact checked count and concrete limitation;
do not turn a sample into full independent verification.

AEMO copyright permissions permit accurate attributed use; this is not an OGL
or Creative Commons claim. Source: Australian Energy Market Operator.
https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions
Retain only public aggregate rows and necessary dated metadata, no contact or
footer records. Publication/finality and mutable-file correction timing remain
unknown unless established by official evidence; retrieval is not publication.

Acceptance additionally requires actual protected Worker validation, bounded
CPU/bandwidth, midnight/month-boundary and error controls, both-domain release
checks and preservation of existing desk contracts. Local fixtures alone do
not establish deployment or scheduled monitoring acceptance. Root owns those
gates, releases, monitoring and handoff updates.
