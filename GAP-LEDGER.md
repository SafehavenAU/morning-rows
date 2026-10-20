# Bounded build and verification queue

Local audit: **20 October 2026, 07:17 UTC**, checkout `cfca419`.
This is a prioritisation record, not release approval or a new production audit.
It uses repository code, dated original specimens, the [handoff](HANDOFF.md),
[acceptance ledger](operations/acceptance.json) and retained research. Historical
research checks were not rerun for this audit. Publisher access, demand frequency
and readiness must be checked under each next contract.

## Current boundary across nine desks

| Desk | Existing boundary and next useful depth |
| --- | --- |
| Australia | Current five-region AEMO snapshot cannot answer a completed day's price history. AEMO completed-day summaries are the next build. Preserve AIHW and other existing sources. |
| New Zealand | Two-locality market rent is **in progress**, under its [own contract](verification/nz-market-rent-2026-10-20/CONTRACT.md); this ledger does not mark it released. Stats NZ's 23-series independent reconciliation remains open. Selected NZ-PRICES verification remains blocked. |
| Canada | Four latest BoC currency pairs are released and qualified. Bounded dated FX history is next after AEMO; preserve the existing latest response. |
| United Kingdom | Thirteen-month national claimant history is released. UK CPI remains parked. No additional UK series is selected here. |
| England | National claimant history and pharmacy measures are established. UK-wide series already labelled as such must not become England-specific answers. CQC remains an unvalidated aggregate-task lead. |
| Scotland | Claimant history and national insolvency counts are established. Traffic uses an explicitly named annual edition; later edition discovery is a bounded maintenance option. SFC remains research only. |
| Wales | Claimant history and population projection are established. Four existing WRA annual tax-due measures could receive typed selection and additional independent evidence. PHW's reuse exclusion remains. |
| Northern Ireland | Claimant history, BMI and insolvency contracts are established. Energy remains a research lead requiring denominator and workbook validation. |
| United States | One national urban CPI-U series, `CUUR0000SA0`, is released with thirteen calendar slots. Observe this scope; no additional US series is selected here. |

USA and claimant releases remain subject to actual expanded-scope scheduled
observation. The actual checkpoint boundary, receipt and SHADOW state remain in
the acceptance ledger; constructed tests or additional releases cannot complete
those gates. Preserve the hourly watchdog, daily collector, disabled ordinary
source alerts, disconnected Builds and serialized reviewed release lineage.

## Ranked next contracts

1. **AEMO completed-day wholesale prices — medium effort, highest next build
   value.** Begin with SA1 and VIC1, one explicitly selected calendar day in fixed
   AEST/UTC+10, exactly 288 unique contiguous interval-ending `TRADE` prices from
   00:05 through following 00:00. Retain AUD/MWh, equal-interval decimal mean,
   minimum/maximum, negative and zero counts, completeness and mutable-file
   provenance. Preserve the existing `grid` snapshot. Fail wrong regions,
   forecasts, missing/duplicate/nonfinite cells and partial days. Calendar day,
   NEM trading day, moving 24 hours and local daylight-saving clocks are distinct.
   This does not support retail bills or future cheap-hour advice.
   [Research contract](research/project-demand-2026-10-17/CONTRACTS.md)
   and [evidence](research/project-demand-2026-10-17/README.md) retain 576 monthly
   CSV prices and four separately presented dispatch comparisons. Those four
   comparisons are not full-window independent verification; both presentations
   share market lineage. The prototype hardcodes October 2026, so dynamic date
   selection, file/month boundaries and actual Worker limits remain build gates.

2. **BoC dated FX — small-to-medium effort, ready evidence but modest incremental
   value.** Start with the two demonstrated history series `FXUSDCAD` and
   `FXGBPCAD`, a bounded recent window and exact-date selection. Preserve all
   four existing latest pairs. Require CAD per foreign unit, unique dates,
   positive finite values and complete selected-series cells; never invert or
   carry forward. Distinguish a date absent from a complete successful response
   from a transport failure; do not call every absent date a holiday.
   [Contract](research/project-demand-2026-10-17/CONTRACTS.md) and
   [specimens](research/project-demand-2026-10-17/manifest.json) retain eight
   matching JSON/CSV/official-table values and explicit 12 October holiday
   evidence. All share publisher lineage. The dated prototype is not a general
   business calendar. Existing Valet access is already compact, so the benefit
   is reliable selection and semantics rather than a new provider.

3. **Stats NZ income verification — high existing correctness priority,
   evidence-dependent effort.** The acceptance ledger still lacks a fresh
   independent reconciliation of all 23 selected series. A useful first bounded
   option is `INC_INC_011`, key `.98.98.MED_INC_ALL_SOUR`: median household income
   from all sources, total regions and household types, currently represented
   as NZD per week. Before code changes, establish exact survey population,
   period convention, adjustment and revision/vintage semantics from official
   metadata and a separately presented dated publication. Compare the exact
   selected period/value; a newer release cannot certify an older specimen.
   [Series definitions](lib/stats-nz-series.js) and
   [existing verification limits](verification/structure-2026-10-17/README.md)
   document the boundary. Both retained claimant-release production captures
   report period `202606`, label `2026`, value **2,438 NZD per week** at
   `2026-10-20T05:07:22.441Z` (apex) and `05:07:37.326Z` (www), in
   `verification/claimant-count-2026-10-20/production-{apex,www}-capture/_new-zealand.json.response`.
   These are reader outputs, not independent publisher evidence. A
   public-evidence lookup is pending at this audit timestamp. No reader defect
   or completed 23-series verification is claimed.

4. **Wales WRA typed depth — small implementation, separate evidence gate.**
   Define stable measures for the four existing completed-financial-year cells
   in [the reader](lib/fiscal-observations.js). Inclusive and restricted-detail
   totals overlap; these are GBP million tax due, not receipts or property
   values. Retain rounding/revisions and suppression refusal. The
   [fixture](test/fixtures/wra-tax.csv) supports deterministic checks; additional
   independent publisher presentation is required before stronger assurance.

5. **NZ fleet and Scottish traffic edition discovery — bounded maintenance.**
   Check for replacement editions for the same eight fleet and four traffic
   measures in [the existing readers](lib/transport-observations.js). Preserve
   the old named-release evidence and revise only after matching table,
   geography, period and units. Unchanged annual observations are not stale
   merely because time has elapsed.

## Held or lower-priority gaps

- **NZ-PRICES:** retain the selected 17 October specimen and
  `blocked_external_evidence` phase. Resume only with usable dated official
  CLA3WR report/export or new permitted evidence. A different release cannot
  certify it. See [the selected contract](verification/nz-prices-2026-10-19/CONTRACT.md).
- **UK CPI:** parked under [its access contract](operations/UK-CPI-CONTRACT.md).
  Do not restart preview attempts or change credentials without the documented
  new evidence/review condition.
- **ONS bedroom-only rental benchmark:** later option, not a joint
  bedroom-by-property estimate. The [retained research](research/rent-demand-2026-10-17/README.md)
  records an approximately 18.6 MB workbook, separate bedroom/property margins,
  Scotland comparability caveats, NI lag and unresolved revision policy. It
  exceeds the existing small-workbook path unchanged.
- **NI energy / SFC / CQC / AER / CMHC:** retain the
  [research queue](research/project-demand-2026-10-17/README.md) and
  [source-pass evidence](SOURCE_PASSES.md). Denominator validation, demonstrated
  aggregate-task demand, direct dataset evidence, or transport/reuse questions
  remain unresolved. Access to a convenient endpoint alone does not determine
  priority.

Each next build needs a separate falsifiable contract, dated permitted original
evidence, appropriate independent extraction, actual Worker validation and
both-domain regression checks. This queue does not activate monitoring scope,
approve a release, create publisher credentials or authorise silent checkpoint
replacement.
