# Proposed first US contract — defined before demonstration implementation

Decision date: 17 October 2026. Research only; these proposed URLs are not live.

## Task and boundary

Supply exact monthly reference indexes for a recurring annual price review that explicitly specifies **CPI-U, all items, U.S. city average, not seasonally adjusted, 1982–84=100**. Calculate an index ratio only when both requested months exist with numeric published indexes. This is a statistical input to an agreement, not a contract interpreter or authority to change a payment. Dates, floors, caps, currencies, rounding and substitution clauses belong to the caller.

One measure, one national urban geography, a rolling **13 calendar-month window ending at the latest published monthly period**. Thirteen months is the minimum for a latest-month/year-earlier comparison. The dated demonstration covers September 2025–September 2026. A missing month stays in the window; do not select thirteen numeric readings instead. Older agreements, local inflation and arbitrary history are unsupported. October 2025 is a real unavailable observation, not a reason to choose a different task or interpolate.

This supports one latest-period annual pair at a time. A contract that requires an earlier, lagged annual comparison may need more than 13 months and is explicitly unsupported in release one. Other exact two-month comparisons inside the retained window are possible, but are not labelled annual unless the months are twelve apart.

## Source-to-output contract

| Dimension | Required definition |
| --- | --- |
| Original publisher | US Bureau of Labor Statistics (BLS), CPI survey `cu` |
| Series | `CUUR0000SA0`; `cu.series` fields: area `0000`, item `SA0`, seasonal `U`, periodicity `R`, base code `S`, base period `1982-84=100` |
| Population | All urban consumers; excludes rural nonmetropolitan residents, farm households, military installations, religious communities and institutions as specified by BLS. Not all US residents and not CPI-W wage earners alone. |
| Geography | BLS **U.S. city average**, national urban target in the 50 states and DC; territories excluded. DC is included in the national target, not offered as a separate series. No state/county/metro output. Retain publisher area code; do not imply a Census geographic crosswalk. |
| Boundary/sample vintage | Current handbook describes the 2018 geographic redesign based on 2010 Census population and 2013 OMB CBSA definitions. Record that as sample-design metadata, not an assertion that each observation uses frozen 2010 expenditure weights or a county boundary vintage. National boundary vintage is not a subnational lookup. |
| Measure/unit | Published weighted consumer price **index level**, three decimal places, index points with 1982–84=100; neither USD nor a percentage. It is not an additive total. |
| Period | Calendar month `YYYY-MM`; accept publisher `M01`–`M12` only. `M13` is an annual average and must never become December or the latest month. FRED's first-of-month date denotes a month, not a daily observation. |
| Adjustment | Not seasonally adjusted. `CUSR0000SA0`, CPI-W, chained CPI, core CPI, PCE and local CPI are different measures. Reject them instead of treating them as fallback sources. |
| Uncertainty | Survey-derived estimate with sampling and nonsampling error. The chosen index response supplies no confidence interval: `uncertainty: null` with explanation, never zero. No significance claim from a small difference. |
| Cadence/time | Monthly, normally published the following month at 08:30 America/New_York. Use the actual BLS release calendar, including rescheduling. September 2026 release: 2026-10-14T08:30:00-04:00. Next scheduled release: 2026-11-10T08:30:00-05:00, subject to change. Do not copy that release timestamp onto all historical observations. |
| Revisions | NSA CPI-U has no routine seasonal revision; errors/corrections remain possible. Latest publisher values only, not a vintage archive. Detect changes in value, status, footnote or definition for the same observation ID. A changed retrieval timestamp alone is not a revision. |
| Reuse | BLS aggregate data are public domain; cite BLS. Do not retain logos, photographs or other excluded material. FRED alternative requires attribution to BLS via FRED under its series-specific terms. |
| Provenance | Original transport URL, exact series/dimensions, original period/value text/footnotes, selected-file hash and retrieval time; separately dated official release URL for reconciliation. Preserve full precision for calculations. |

The geography interpretation is supported by the current sample-design and sample-area material; BLS's hurricane notice explicitly excludes Puerto Rico and US Virgin Islands from CPI price collection. It is not a claim that every state has a separately sampled/published index. The follow-up [primary frame derivation](rehearsal/geography-evidence.json) establishes the selected 381 metropolitan / 536 micropolitan US frame, separated by OMB from Puerto Rico, with all 50 states/DC represented in its frame list. This resolves the earlier exhaustive-frame gate through derivation, not a fabricated single publisher quote.

## Value states and failure

- `observed`: finite published number, including a literal zero if present. For this positive-base CPI series a zero or negative index is a semantic anomaly: preserve its literal value/state in diagnostic evidence and reject calculations/publication pending review; never silently map it to missing.
- `unavailable`: publisher explicitly identifies unavailability. `-` plus footnote `X` in October 2025 means unavailable because of the lapse in appropriations; retain the footnote. Future/not-yet-published periods are not fabricated observations.
- `missing`: documented missing marker without a more specific explanation; retain a null value and original marker. An absent expected month, empty malformed cell or unknown marker causes validation failure, not silent imputation.
- `suppressed`: requires an explicit publisher suppression flag and explanation. Not expected in this national series; an unexplained change to suppression is a review gate. A dash alone is not proof of confidentiality suppression.
- Failed retrieval: HTTP/API error, timeout, invalid envelope or incomplete required selection is `retrieval.status=error`, HTTP 503 for a selected source, no invented observation or fresh-success timestamp. Other sources/desks remain independent. Do not silently fall back to FRED or an older release.

## Identity, answers and revisits

Proposed canonical desk: `https://morningrows.com/united-states.json`; human view `/united-states`. Source key `cpi`, measure ID `CUUR0000SA0`, source URL `?source=cpi`, measure URL `?source=cpi&measure=CUUR0000SA0`, observation URL adds `&observation=YYYY-MM`. Match existing URL conventions; values and array positions never enter identifiers. These are rolling selections, not permanent archives. An expired/out-of-window period returns explicit 404, never a substitute.

Measure selection returns 13 monthly observations and native rows. Exact observation returns one, including an explicitly unavailable observation. Caller computes `target_index / base_index`; percent change is `(ratio - 1) * 100`. Decimal arithmetic; round only the requested final display. A money example must be labelled constructed and must state its assumed rounding rule. Do not derive a new official series ID for an arithmetic answer.

Cite both observation IDs and content versions, the BLS series and archived release, reference months, NSA qualification and index base. The caller retains the response for historical audit. Output distinguishes per-observation publication time (null if unverified), release publication time, source modification time and actual retrieval attempt time.

Same ID and semantic version: unchanged valid observation. New period: newly available period, subject to release evidence. Same ID with changed value/status/footnote: revision or metadata correction, not necessarily a statistical revision. Changed transport health: retrieval failure/recovery even when stored values are unchanged. ETag must include health and caveats; failures must never produce success 304. No daily-change staleness rule. Client-held previous responses enable comparison; no server-side historical revision database is promised.

## Exact acceptance criteria for the isolated demonstration

1. Parse original BLS bulk rows for the exact series, validate its metadata, exclude annual averages explicitly, and retain 13 unique consecutive calendar slots. For the dated window: 12 positive numeric indexes and one unavailable `2025-10` with footnote X.
2. Independently parse BLS API and FRED CSV and reconcile all 13 selected slots (numeric equality to 0.001; null equality with FRED's loss of reason disclosed). Do not count these as independent statistical estimation.
3. Extract BLS official release Table 1 all-items NSA cells: September 2025 324.800, August 2026 334.980, September 2026 336.940. Reconcile exact decimal levels; derived year change must round to the published 3.7% within 0.05 percentage points. Verify release date and scheduled next release.
4. Exact-month lookup and index-ratio examples must cite definitions and preserve the real October gap. Requests for other geography, adjustment, units, daily/annual periods or unretained months must explicitly fail. Missing/duplicate/malformed rows cannot generate a believable numeric answer.
5. Constructed revision, unchanged retrieval, new-period, suppression and failed-retrieval cases must be distinguishable without altering real specimens. Every constructed case is labelled; no fabricated user query or publisher revision.
6. Record byte/call counts for the specific retrievals, separately from correctness. If an independent agent client cannot run, report deterministic tests only. No inference of adoption or return visits.

Production acceptance and compatibility are separate gates in PLAN.md; success here is not release approval.
