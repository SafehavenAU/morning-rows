# Bounded build and verification queue

## Current full gap-list disposition

The user's 20 October full-list request has received a bounded pass across all
six ranked items and eight held candidates. The
[phase-one release](verification/gap-pass-2026-10-20/README.md) and
[SFC/CMHC release](verification/remaining-gaps-2026-10-20/README.md) are accepted.
Current LIVE is source `3ae91ac1ce163008f05377acefc27cce488fbbed`, Worker
`ff344629-f392-44ec-b816-92d14f52bd07`. Every currently actionable item in this
bounded queue has been handled; **blocked contracts and sustained operational
acceptance remain incomplete**. The older ranking below is historical and does
not override these actual outcomes. Documenting a blocker is not completing it.

| Ranked item | Current disposition |
| --- | --- |
| 1 AEMO completed day | Reader and all 576 price-cell comparisons retained, but disconnected: repeated actual production HTTP 406 caused the first promotion to be rolled back. Requires new permitted usable access evidence and a separate reviewed release; no further retry in this pass. Existing `grid` snapshot remains. |
| 2 BoC dated FX | **Released:** two series, 31-calendar-day history and exact-date selection. 38 original JSON/CSV cells, ten official-table cells and two latest anchors reconciled; four existing latest pairs preserved. |
| 3 Stats NZ | **Metadata fixes released; numerical verification incomplete.** Eleven exact dated comparisons, twelve specific evidence gaps below. No credential access or future-vintage approval. |
| 4 StatCan headlines | **Released:** all four existing readers strengthened; proven ten-province unemployment mislabels repaired by identity join. Fourteen selected values independently reconciled. GDP remains a separate accepted contract. |
| 5 WRA typed depth | **Released:** four existing financial-year tax-due measures, four separate official-table matches; overlapping totals and honest suppression/missingness retained. |
| 6 Transport editions | **Dated evidence/discovery pass complete:** eight NZ fleet and four Scottish traffic cells reconciled, no replacement edition or reader correction indicated. Unchanged annual observations remain valid. |

| Held item | Current disposition and condition for resumption |
| --- | --- |
| NZ-PRICES | Still `blocked_external_evidence` for the selected **17 October Interim** specimen. The new official CLA3WR export's 48 matching OTA2201 numbers are **Final**, so they cannot certify it. Need the exact held version and selected coverage; later releases are not substitutes. |
| UK CPI | Parked, not retried. Require the documented new-evidence/access-review condition and permissible actual Worker access; retain UK-wide D7BT/D7G7 semantics, never England-only CPI. |
| AER | Exact quarterly regional CSV identified but original transport returned 503. Need usable original data, independent numerical comparison and applicable upstream reuse/attribution conditions; AER CC BY exceptions do not imply blanket AEMO/third-party permission. |
| NI electricity | Local candidate and five original comparisons retained; actual Worker returned a `Request Rejected` access page. Disconnected; new permitted usable report access and actual/integrated release proof required. |
| CQC | Local five-count historical cohort implementation retained; actual Worker returned 403. Disconnected; need permitted workbook access and release proof, preserving the risk-prioritised single-assessment-framework cohort rather than an all-England quality claim. |
| ONS bedroom rent | Local Manchester bedroom-only candidate and four exact cells retained; actual Worker returned 429. Disconnected; new permitted access plus exact-vintage and release proof required. Not a bedroom-by-property joint estimate. |
| SFC | **Released:** five fixed 2024–25 college FTE observations passed exact integrated/CPU/both-domain and reviewed-release gates. Retain all-funding Scottish-college learning volume, academic dates, overlapping total, nearest-five rounding and SFC attribution permission; not students or domiciled residents. |
| CMHC rental | **Released:** two 2025 Victoria CMA / Victoriaville CA combined row-and-apartment two-bedroom averages passed integrated and both-domain release gates. Retain annual October survey, CAD/month and conditional HMIP notices in every representation; no invented recipient assent, apartment-only/asking-rent inference or future-vintage approval. |

The second release activates only SFC and CMHC. The other local candidates remain
disconnected; ten actual production requests confirmed held-source discovery and
selection refusal. These outcomes supersede the earlier [held-queue research
readiness](verification/gap-pass-2026-10-20/held-queue/README.md). PHW's reuse
exclusion remains; no extra US series or desk is selected. No source alert,
credential, infrastructure or schedule change follows from this ledger.

### Remaining Stats NZ exact-cell evidence

These are pinned reader targets, not independently certified values. The
[complete 23-cell record](verification/gap-pass-2026-10-20/statsnz/coverage-23.json)
retains source files, dimensions, period conventions and precise requirements.

| Exact ID / target | Remaining requirement |
| --- | --- |
| `AGR_AGR_001` — 2018, 8,293 ha | Official table rounds to 8,300 for year ended 31 March; need exact-precision national forestry export and metadata. |
| `AGR_AGR_002` — 2024, 9,522 ha | Official final table rounds to 9,520 at 30 June; need exact national apple-area export, coverage and vintage. |
| `AGR_AGR_003` — 2025, 23,252,463 sheep | Official final graph rounds to 23,252,000; need the exact-precision final count. |
| `CORR_FIS_005` — fiscal 2024/25, 8,199 people | Public release links ADE but lacks the exact sentenced-prisoners cell. Need fiscal counting/rounding semantics; not calendar year or quarterly stock. Fiscal releases were discontinued in September 2026. |
| `INC_INC_001` — 202606, 1,391 NZD/week | Separate wage/salary headline is 1,419; exact ADE earnings population/measure/vintage unresolved. Need original exact table and metadata; no replacement value or defect inferred. |
| `INC_INC_011` — 202606, 2,438 NZD/week | Household population and June-quarter metadata established, exact separate cell unavailable. Need total LGR/HHTYPE / MED_INC_ALL_SOUR export and household basis/revision semantics. |
| `JUS_FIS_001` — fiscal 2024/25, 50,741 people | Need exact adult-convictions export and counting/rounding; public release links ADE only. Not charges, prosecutions or calendar year; fiscal releases discontinued. |
| `LEED_AP1_001` — 2024, 4,091,334 people | Need exact March-year IZ/AZ/XZ/RZ taxable-income population export and tax-source definitions. |
| `LEED_AP1_002` — 2024, 57,610 NZD/year | Need exact total-earnings median export, income scope and March-year convention; taxable income is not interchangeable. |
| `LEED_Q1W_001` — 202506, 18,100 NZD/quarter | Need full-quarter-job MEDIAN_EARN export and gross/tax/coverage conventions; jobs are not people or all/new-hire jobs. |
| `POPPR_LAB_003` — 2026, 3,144,100 people | Workbook rounds P50 to 3,144 thousand; need exact P50/SEX3/total-ages export. Projection, not observed workforce. |
| `POPPR_FHH_003` — 2028, 2,087,100 households | Acquired workbook has B scenarios; need exact **Medium A** export, base and assumptions. Medium B cannot be substituted. |

The 11 matched cells and all independent presentations retain shared statistical
lineage. Neither a metadata repair nor rounded numerical agreement completes
all 23 cells. NZ-PRICES's original bounded task remains incomplete separately.

The actual durable checkpoint and SHADOW/delivery gates are unchanged: two
legacy scheduled cycles, zero expanded-scope cycles, no receipt. The accepted
release's constructed six-edge replay is not a collection. Its 23 exact approvals
and 118 obligations retain the existing 24 public probes. Preserve every
intervening write, all 33 incidents / 36 repairs and the pending delivery event;
keep the hourly watchdog and daily collector unchanged, with ordinary source
alerts disabled. See the
[current handoff](HANDOFF.md) for exact identity, deadline and acceptance gates.

## Historical ranking and evidence boundary

Initial audit: **20 October 2026, 07:17 UTC**, checkout `cfca419`.
Updated after the Canada GDP release on 20 October; dated evidence below remains
separate from the original discovery pass.
This is a prioritisation record, not release approval or a new production audit.
It uses repository code, dated original specimens, the [handoff](HANDOFF.md),
[acceptance ledger](operations/acceptance.json) and retained research. Historical
research checks were not rerun for this audit. Publisher access, demand frequency
and readiness must be checked under each next contract.

## Historical boundary across nine desks

| Desk | Existing boundary and next useful depth |
| --- | --- |
| Australia | Current five-region AEMO snapshot cannot answer a completed day's price history. AEMO completed-day summaries are the next build. Preserve AIHW and other existing sources. |
| New Zealand | Two-locality market rent is **released and awaiting scheduled observation**, under its [own contract](verification/nz-market-rent-2026-10-20/CONTRACT.md); both-domain release evidence is retained with that contract. Stats NZ's 23-series independent reconciliation remains open. Selected NZ-PRICES verification remains blocked. |
| Canada | The existing GDP source now has verified real-GDP/annual-rate/quarter semantics, two typed quarterly levels and ordinary growth. Four latest BoC currency pairs remain qualified. Other StatCan headline readers still need their own semantic contracts; dated FX remains a later bounded addition. |
| United Kingdom | Thirteen-month national claimant history is released. UK CPI remains parked. No additional UK series is selected here. |
| England | National claimant history and pharmacy measures are established. UK-wide series already labelled as such must not become England-specific answers. CQC remains an unvalidated aggregate-task lead. |
| Scotland | Claimant history and national insolvency counts are established. Traffic uses an explicitly named annual edition; later edition discovery is a bounded maintenance option. SFC remains research only. |
| Wales | Claimant history and population projection are established. Four existing WRA annual tax-due measures could receive typed selection and additional independent evidence. PHW's reuse exclusion remains. |
| Northern Ireland | Claimant history, BMI and insolvency contracts are established. Energy remains a research lead requiring denominator and workbook validation. |
| United States | One national urban CPI-U series, `CUUR0000SA0`, is released with thirteen calendar slots. Observe this scope; no additional US series is selected here. |

USA, claimant and rent releases, and the strengthened GDP contract, remain
subject to actual scheduled observation under their released semantics. The actual checkpoint boundary, receipt and SHADOW state remain in
the acceptance ledger; constructed tests or additional releases cannot complete
those gates. Preserve the hourly watchdog, daily collector, disabled ordinary
source alerts, disconnected Builds and serialized reviewed release lineage.

## Historical ranked next contracts

Priority update: the existing Canada GDP correctness repair is implemented and
deployed, with [exact release evidence](verification/statcan-gdp-2026-10-20/README.md).
The original numbers were correct; explicit semantics, metadata/flag/coverage
validation and selectors close the bounded gap. This does not certify the other
StatCan readers. AEMO remains the next new coverage candidate; its sampled
independent dispatch comparison covers 16/576 cells and its midnight cache
boundary requires implementation. No new coverage contract is marked complete.


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

4. **Recovered StatCan headline readers — high existing correctness priority,
   currently unverified semantics.** The four remaining `jobs`, `price_index`,
   `shop` and `homes` readers in [worker.js](worker.js) use fixed
   coordinates and positional API results. They do not currently validate the
   returned series identity, units/scalar factors, status flags or all selected
   period relationships. The jobs reader labels results by response-array
   position. A healthy response could therefore produce a plausible but wrongly
   labelled value. This is a code-supported risk, **not a demonstrated wrong
   current observation**. Monitor recovery proves transport resumed, not
   numerical or semantic correctness: these four sections still receive
   native-availability checks without independently approved observation versions.
   The separate GDP repair now validates exactly one existing series and adds
   its own approved observation version; it does not transfer assurance to the
   other coordinates. Before the next repair, choose one remaining measure by
   correctness risk, establish exact geography/population/units/adjustment/period
   and revision behavior from official metadata, reconcile the selected values
   against an independent presentation, and test identity/order/flag failures.
   Preserve successful Canadian siblings and every earlier release specimen.

5. **Wales WRA typed depth — small implementation, separate evidence gate.**
   Define stable measures for the four existing completed-financial-year cells
   in [the reader](lib/fiscal-observations.js). Inclusive and restricted-detail
   totals overlap; these are GBP million tax due, not receipts or property
   values. Retain rounding/revisions and suppression refusal. The
   [fixture](test/fixtures/wra-tax.csv) supports deterministic checks; additional
   independent publisher presentation is required before stronger assurance.

6. **NZ fleet and Scottish traffic edition discovery — bounded maintenance.**
   Check for replacement editions for the same eight fleet and four traffic
   measures in [the existing readers](lib/transport-observations.js). Preserve
   the old named-release evidence and revise only after matching table,
   geography, period and units. Unchanged annual observations are not stale
   merely because time has elapsed.

## Historical held or lower-priority gaps

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
