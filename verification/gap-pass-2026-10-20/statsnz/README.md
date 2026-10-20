# Stats NZ exact-cell evidence and remaining gaps — 20 October 2026

The bounded pass independently reconciles **11 of 23 retained reader cells** with
original dated Stats NZ publications/workbooks/CSV. Twelve remain unresolved.
This is not complete 23-series acceptance and approves no future vintage.
[Coverage](coverage-23.json) states an individual result or concrete missing
requirement for every selection. [Results](comparison-results.json) identify the
exact table, column or publication block for each match.

The target is the accepted GDP-release NZ capture, SHA-bound in
[reader-targets.json](reader-targets.json). It is a comparison target, not
independent evidence. Python stdlib independently reads publication CSV/table
fragments, an original XLSX, and selected original injury CSV lines; it never
imports the runtime reader. All presentations share Stats NZ statistical lineage;
this does not independently re-estimate a survey, administrative count or
projection.

## Reconciled cells

| Selection | Period | Exact published value | Original official presentation |
|---|---:|---:|---|
| BDS_BDS_004 | February 2025 | 617334 enterprises | [Business demography publication graph](https://www.stats.govt.nz/information-releases/new-zealand-business-demography-statistics-at-february-2025/) |
| HES_HES_001 | year ended June 2023 | 1597.5 NZD/week | [Household expenditure publication graph](https://www.stats.govt.nz/information-releases/household-expenditure-statistics-year-ended-june-2023/) |
| INC_INC_010 | June quarter 2026 | 5.3% | [Gender pay gap publication graph](https://www.stats.govt.nz/information-releases/labour-market-statistics-income-june-2026-quarter/) |
| IWI18_GRP_001 | 2018 | 75393 estimated people | [Ngāi Tahu Whānui grouping table](https://www.stats.govt.nz/reports/iwi-affilation-estimated-counts-2018-data-sources-and-quality-by-iwi/) |
| POPES_SUB_001 | 30 June 2025 | 5324700 people | [Original subnational workbook](https://www.stats.govt.nz/assets/Uploads/Subnational-population-estimates/Subnational-population-estimates-At-30-June-2025/Download-data/subnational-population-estimates-at-30-june-2025-provisional.xlsx), Table 1 D25 |
| POPES_ERP_005 | 30 June 2023 | 5200000 people | Same workbook, national all-person estimated resident population Table 1 B25; does not verify ethnic disaggregation |
| POPPR_NAT_007 | 30 June 2026 | 5387700 people | [2024-base population projection graph](https://www.stats.govt.nz/information-releases/national-population-projections-2024base2078/), 50th percentile |
| PRD_PRD_001 | year ended March 2025 | 1391 | [Productivity publication](https://www.stats.govt.nz/information-releases/productivity-statistics-1978-2025/), measured sector; index 1996=1000 |
| PRD_PRD_002 | year ended March 2025 | 0.8% | Same publication, latest annual labour productivity column |
| PRD_PRD_003 | year ended March 2025 | −1.5% | Same publication, latest annual value-added/output column |
| INJ_INJ_001 | 2021 | 15525 injuries | [Updated 2000–2024 release CSV](https://www.stats.govt.nz/assets/Uploads/Serious-injury-outcome-indicators/Serious-injury-outcome-indicators-2000-2024/Download-data/serious-injury-outcome-indicators-2000-2024-updated.csv), W_I21; not the newer nonfatal-only year |

Exact matches use zero tolerance at the publisher's recorded precision. They
retain population, period and scenario differences. Productivity and 2025
population estimates are provisional. The injury publication's 2021 mortality
component remains subject to change, independently of its CSV indicator
validation label. Census-derived iwi estimates differ from official Census counts.

## Supported metadata corrections

[Recommendations](metadata-recommendations.json) identify additive runtime
metadata for the implementation owner; this evidence worker made no runtime
changes. The clearest correctness gap is household income: its
[official collection metadata](https://datainfoplus.stats.govt.nz/item/example.org/8d1f8525-746e-43cd-ad82-81a96f46225f)
excludes households whose members are all outside ages 18–64. Weekly income is a
June-quarter snapshot, and conversion into annual income is discouraged. A
household with only older retired members is outside the selected table's
population. The retained 2438 value has no separate exact official cell here.
The release's gross-before-tax statement concerns individual income, so this
pass does not promote it into an independently proven household-tax-basis claim.

[Prison](sources/prison.json) and [justice](sources/justice.json) public releases
now carry notices dated 11 September 2026 discontinuing fiscal-year releases.
Calendar-year releases continue. The existing fiscal 2024/25 observations must
retain their period and cannot silently become calendar-year counts. Legitimately
unchanged annual observations are not new monitoring failures.

## Why twelve cells remain unresolved

- Forestry, apples, sheep and labour-force projections have acquired original
  official tables/graphs at coarser precision. Rounded agreement cannot certify
  the additional target digits.
- Household projections select Medium A, whereas the acquired workbook presents
  B living-arrangement-rate scenarios. A different scenario is not a substitute.
- The two annual LEED rows, quarterly LEED, fiscal prison and fiscal justice
  releases point to ADE/Infoshare without independently presenting the exact
  selected cells in acquired publications.
- Household income 2438 lacks an exact separate household cell. Individual weekly
  earnings 1391 remains unresolved against a 1419 wage/salary headline until the
  exact table population/measure and vintage are established. No numerical defect
  or replacement value is asserted.

All 23 definitions were examined against relevant original public releases or
workbooks. No key was read, registered, changed or used outside the existing
Worker. No code, release, schedules, checkpoint, approval ledger or source-alert
state was changed by this evidence pass.

## NZ-PRICES remains held

A new usable official CLA3WR CSV path was discovered and acquired for 17 October
2026, OTA2201. Its 48 numbers match the retained specimen, but **every acquired
row is now Final**; the fixed original specimen is Interim. The other four nodes
were not rerun after this decisive status mismatch. A search-cached Interim
snippet is not an acquired versioned report.
[Status-aware comparison](nz-prices/comparison.json) retains the dated report and
zero numeric mismatches without claiming acceptance. The original
`blocked_external_evidence` phase remains: neither a later status/revision nor a
new date certifies the held release. No notification or repeat release occurred.

## Reproduce

From this directory:

```sh
python verify-retained.py
```

The script checks retained artifact SHA-256 values before matching exact periods,
row identities, cells and decimals. It reports 11 exact comparisons and 12
unresolved targets. `extract-publications.py` documents the separate acquisition
extraction from original downloaded HTML and adjacent acquisition JSON. Public
pages can be revised; a newly downloaded different hash is new evidence, not a
silent replacement. `sources/rounded-workbook-excerpts.json` explicitly labels
openpyxl selected-cell extracts; those are supporting blockers, not passes.

Original public data/graphs credit Statistics New Zealand under its public data
reuse terms. The general income DataInfo+ text explicitly carries CC BY 3.0 NZ;
that specific notice is retained separately from the public site's CC BY 4.0
footer. No personal contact details are retained as evidence.

## Actual capture verifier

After acquiring a real preview or production native `/new-zealand.json` response:

```sh
python scripts/verify-gap-statsnz.py CAPTURE_JSON OUTPUT_JSON
```

Run that command from the repository root. It checks all 23 unique row identities,
fixed dimensions, kind, unit, geography and selection against the SHA-pinned
metadata target. Values never come from that target: the 11 numerical references
are independently extracted again from the retained original official evidence.
It requires all 11 exact periods and values and the nine newly supported metadata
fields across the four affected selections. Changed periods/scenarios, rounded
substitutes, missing fields and missing or duplicate row identities fail.

A passing report is expressly limited to those 11 numerical cells and fixed
metadata; `all_23_numeric_acceptance`, `future_vintages_approved` and
`scheduled_or_release_acceptance` remain false. The other 12 values are not
numerically certified. Native rows lack a publisher release-vintage identifier,
so even an equal-valued later response is only agreement with the dated reference
cells, never approval of a future or unspecified statistical vintage.

`test-capture-verifier.py` exercises a labelled synthetic positive fixture, 24
negative controls, and CLI success/failure/NaN report paths. The separate
`historical-capture-control.json` intentionally rejects the retained old GDP-release
capture because its nine new metadata fields are absent. Its numerical comparison
coverage remains 11 cells. This expected historical rejection is neither a new
production incident nor validation of the staged build. The implementation owner
must run the verifier on the actual new preview and production captures.
