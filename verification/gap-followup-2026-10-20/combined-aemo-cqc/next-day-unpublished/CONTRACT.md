# AEMO 20 October 2026 specimen amendment

Prepared 20 October 2026 at 17:50 UTC, before acquisition of either required
20 October reference bundle. This is evidence preparation for the existing
disconnected PR18 candidate, not a source change or release acceptance.

The exact target is calendar **20 October 2026 in fixed AEST, UTC+10**.
Its 288 interval endings per region run from 20 October 00:05 through
21 October 00:00. SA1 South Australia and VIC1 Victoria are the only regions.
The eligible actual acquisition/capture window is 20 October 14:00 UTC
inclusive through 21 October 14:00 UTC exclusive. No 19 October fallback,
synthetic clock or inherited dated approval can satisfy this target.

Retain the original DREGION layouts 2 and 3, RRP nominal unadjusted AUD/MWh,
RUNNO 1, INTERVENTION 0, APCFLAG 0 and MARKETSUSPENDEDFLAG 0. Both layouts
must supply the exact same decimal RRP for every selected interval. Each
selected region/layout must also have all 288 intervals in each original
trading bundle. Calendar selection must respect the declared bundle ownership.
There is no invented TRADE/FIRM/finality field. Missing, suppressed, malformed,
more precise, partial or wrong-flag values fail instead of becoming zero.

The two required trading dates are 19 and 20 October. Obtain complete filenames
only from the ordinary official PUBLIC_PRICES index. At or after 18:06 UTC,
perform one index GET; if either exact trading date is absent or ambiguous,
retain the failure and stop. If both unique links are present, fetch only those
two ZIPs, once each. No guessed generation suffix, retry, archive crawl,
registration, key or new infrastructure is permitted.
The earlier observed 04:05 AEST generation pattern is not a publication SLA.

Require one bounded 128 KiB index and two bounded 512 KiB ZIPs, each containing
one precisely named flat CSV of at most 2 MiB and 3,000 records. Preserve strict
ZIP framing, CRC and metadata equality, UTF-8, exact CSV headers, record trailer,
generation-header/filename equality and nonfuture generation time.
Retain retrieval times separately from raw generation labels. Publication,
revision schedule and finality remain unknown.

An independent Python stdlib ZIP/CSV/Decimal extractor, importing no runtime
reader, must produce 576 original raw/rounded cells and ten summaries. Round
each raw RRP to cents using ROUND_HALF_UP (half away from zero), then derive
mean/minimum/maximum/negative_count/zero_count. Mean is the exact rounded-cent
sum divided by 288 with another half-away cent rounding. All comparisons have
zero tolerance after the defined rounding. Preserve original decimal tokens,
including valid scientific notation. Explicit and rounded zero remain distinct.

The old 19 October evidence and its 576 monthly presentation comparisons remain
unaltered. They do not certify 20 October. For this new specimen, daily layouts
2/3 are alternate layouts of the same publication and share AEMO market lineage.
The original separate-presentation acceptance gate remains mandatory. A
separately authorized clarification at 17:56 UTC permits one ordinary workspace
GET for each previously retained exact official URL:

- `https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_SA1.csv`
- `https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_VIC1.csv`

These are genuinely new-vintage evidence reads after 18:06 UTC, conditional on
both advertised daily bundles existing. They are not retries of the refused
Worker monthly-reader route. No header impersonation, bypass, retries or
additional URLs are permitted. Retain each full wire hash, size and actual
retrieval clock outside the repository, plus its unmodified original header and
exact 288 complete 20 October interval lines as the minimal specimen.
Require REGION SA1/VIC1, PERIODTYPE TRADE, the exact contiguous calendar endings
and cent values. Reconcile every one of the 576 rounded daily cells and ten
derived summaries with this separately presented official monthly table.
Both presentations share AEMO market lineage, not independent price formation.

If either monthly presentation is unavailable or lacks complete 20 October
coverage, retain the failure and mark the separate-presentation gate unresolved.
Do not lower the gate or label daily-layout agreements as monthly matches.
Independent Python extraction establishes independent reading and calculation;
it alone does not replace the required separate-presentation comparison.

Source attribution is Australian Energy Market Operator (AEMO), NEMweb
PUBLIC_PRICES; summaries are calculated by Morning Rows. Retain the applicable
[AEMO copyright permission](https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions)
and accurate attribution. Do not invent a CC or OGL licence. Original aggregate
ZIPs are retained only for bounded reproducibility; index telemetry is excluded
from any minimal evidence package.

No numerical pass exists until advertised originals are acquired and verified.
Subsequent runtime comparison, protected actual-reader validation, fresh
full-desk CPU evidence, complete staged and both-domain production validation,
and reviewed source/observation approval remain separate gates. This amendment
does not change runtime code, current LIVE identity, monitoring, checkpoints,
schedules, receipts or the eight unfinished Stats NZ numerical contracts.
