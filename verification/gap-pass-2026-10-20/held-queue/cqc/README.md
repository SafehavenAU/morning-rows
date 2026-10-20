# CQC queue reassessment — 20 October 2026

**Decision: no-key aggregate option exists; the API is explicitly authenticated.**
A bounded historical cohort briefing is implementable, but cannot be sold as
current England-wide care quality. No API call, registration or provider-record
harvest was made.

[CQC's current data guidance](https://www.cqc.org.uk/about-us/transparency/using-cqc-data)
requires API authentication and permits attributed OGL reuse. Its large monthly
location files are not needed for an aggregate-only reader. Those files also
carry cancellation-update delays and changed location/service rating levels.

Instead, [State of Care 2024/25's ratings appendix](https://www.cqc.org.uk/publications/major-report/state-care/2024-2025/charts)
links a working [56,969-byte aggregate workbook](https://www.cqc.org.uk/system/files/2025-10/20251024_stateofcare2425_ratingsdata.xlsx).
The [current edition index](https://www.cqc.org.uk/publications/major-report/state-care)
still links 2024/25 and describes 2025/26 as forthcoming. Do not infer a newer
release from its expected season.

A defensible initial contract is one cohort: adult social care, overall ratings
under the single assessment framework, published by 1 August 2025. Workbook
sheet `1!B7:B11` reports 125 inadequate, 809 requires improvement, 2,063 good,
65 outstanding and 3,062 total. A [separately laid-out official SVG](https://www.cqc.org.uk/sites/default/files/soc2425_figA01_asc_overall.svg)
contains all four category counts; their sum equals the workbook total. Exact
2-decimal percentages are workbook values; chart percentages are integer-rounded.
Both presentations share CQC inspection records.

**Semantic constraints are material:** assessments were prioritised by risk and
are not representative of every service; other frameworks remain outside this
cohort. There is no safe inference about England-wide quality, year-on-year
improvement, available capacity or individual providers. The workbook's sheet 6
retains 2024 labels while its general guidance says 2025; exclude that sheet
unless publisher evidence resolves it. Do not generalise this five-count
selection to every worksheet.

Next contract must bind the exact framework/date/cohort, enforce rating labels
and total, preserve missing versus numeric zero, reconcile counts to SVG, test
wrong-framework/period/unit cases and require Worker/release evidence. Demand
for this exact compact aggregate in agent workflows remains unmeasured; utility
is an explicit regulatory briefing hypothesis, not an adoption claim.

Retained: original guidance, edition index, appendix, workbook and SVG with
request/hash records; independent XML extraction in `workbook-cells.json` and
`selected-comparison.json`. No health advice or provider-rating recommendation
is proposed.
