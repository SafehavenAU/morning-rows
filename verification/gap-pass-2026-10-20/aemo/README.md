# Completed-day AEMO prices — bounded implementation evidence

The new `grid_day` reader supports one latest fully elapsed fixed-AEST calendar
day for **SA1 and VIC1**. It preserves the existing `grid` snapshot and adds no
other region, forecast, retail calculation, credential or retained history.
The [contract](CONTRACT.md) was written before implementation.

Fresh originals for **19 October 2026** contain 288 five-minute interval-ending
TRADE prices per region, from 00:05 through 20 October 00:00 in fixed UTC+10.
The [independent CSV/Decimal report](independent-report.json), reproduced by
[verify-original.py](verify-original.py), compares the separately acquired
official daily DREGION presentation against all
**576 prices** within AUD0.005/MWh, reflecting the monthly CSV's cent rounding.
The largest differences are AUD0.00493 for SA1 and AUD0.00478 for VIC1. All
compared daily records are run 1, intervention 0; this is not a claim that all
prices are final. The daily presentation has no FIRM field. Both presentations
share AEMO's market calculation lineage; different extraction verifies selection
and rounding, not an independent market calculation.

| Region | Equal-interval mean, AUD/MWh | Negative intervals | Zero intervals |
| --- | ---: | ---: | ---: |
| SA1 | 6.73 | 189 | 2 |
| VIC1 | -7.80 | 206 | 9 |

Counts concern published rounded prices. The mean uses all 288 equal-duration
intervals and integer-cent summation, with half-away-from-zero cent rounding;
it is not demand-weighted. Minima and maxima retain the published cent values.
The public daily bundles use a NEM trading-day window, so the evidence extractor
combines the necessary portions of the 18 and 19 October bundles to compare the
19 October calendar day. Runtime does not fetch those comparison bundles.

Actual September and October monthly files establish file ownership: September
starts 1 September 00:05 and includes 1 October 00:00; October starts 1 October
00:05. The runtime therefore requests exactly **two monthly files**, selected
by the target day's month, even on month end. Each is capped at 1 MiB and
20 seconds. A day missing its closing midnight interval fails; no following
month, older date, partial mean or zero is substituted.

`aemoDayClock` selects the day from a real UTC acquisition clock and exposes the
next rollover at 14:00 UTC. `aemoDayCacheSeconds` clips a maximum lifetime to
that boundary. A read spanning midnight fails explicitly. The public
representation validator can reject a previously valid body from the earlier
day. Root integration must apply the clock to the Australia cache and selected
responses; these helpers alone do not prove cache behavior in production.

The [offline reader comparison](reader-reference.json) matches all 576 interval
values and all ten derived daily summaries to the independent report. It is
reproduced by `check-reader-reference.mjs`, which imports the reader but uses the
separately extracted report as the comparison oracle. The isolated module's
28 tests pass, including fresh and historical originals,
calendar/DST/month/year/leap-day boundaries, missing/duplicate/non-five-minute
intervals, forecast and wrong-region refusal, malformed values and dates,
positive/negative half-cent ties, source failure isolation, response bounds,
HTTP/timeout/UTF-8 failures, stale representation refusal, explicitly missing public clocks and midnight crossing.
One failed region retains the complete successful sibling; selections for the
failed region must return an explicit failure without substituted observations.

```sh
node --test test/aemo-day.test.js
python verification/gap-pass-2026-10-20/aemo/verify-original.py \
  verification/gap-pass-2026-10-20/aemo/original NEW-ORIGINAL-REPORT.json
node verification/gap-pass-2026-10-20/aemo/check-reader-reference.mjs \
  NEW-READER-COMPARISON.json
```

The first full-Worker live preview returned HTTP 406 for both monthly files.
One bounded [protected diagnostic](cloudflare-access-diagnostic.json) then
retrieved a valid SA1 CSV prefix with the same URL and `accept: text/csv`;
it did not establish complete-day acceptance or a persistent access restriction.
The explicitly authorized [complete live reader follow-up](cloudflare-reader-live.json)
ran once at 2026-10-20T09:49:09.871Z using the actual clock and unchanged
`readAemoDay`. Both regions succeeded, with all **576 interval prices and ten
summaries** exactly matching the independent report. Full native responses,
provenance, errors/health, comparison rows and unchanged code hashes are retained.
No header or route change, fallback, automatic retry or production write occurred.
The earlier refusals remain evidence of access variability.

This is implementation, publisher and protected-reader evidence, **not release
acceptance**. Exact-version CPU/bandwidth measurements, cache integration,
both-domain regressions and deployment remain root-owned gates. It does not
complete scheduled-observation, delivery-receipt, NZ-PRICES or other held gates.
AEMO's mutable-file publication/correction schedule and finality remain unknown.
Reuse retains Australian Energy Market Operator attribution under its
[copyright permissions](https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions),
not an OGL or Creative Commons label.
