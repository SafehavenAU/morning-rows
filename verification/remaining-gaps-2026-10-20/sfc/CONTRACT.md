# Scottish college activity — falsifiable implementation contract

Written 20 October 2026 before `lib/sfc-activity.js` or its tests. This contract
selects five existing official aggregate cells; it is not deployment approval.

## Exact source and meaning

Use the explicitly named SFC **College Statistics 2024–25** release issued
4 February 2026, [original workbook](https://www.sfc.ac.uk/wp-content/uploads/2026/01/College-Statistics-2024-25-Background-Tables.xlsx),
[release page](https://www.sfc.ac.uk/publications/college-statistics-2024-25/)
and its reviewed methodology annex. Do not claim this fixed edition is always
latest. Revisions to this named edition are possible; preserve acquisition hash
and report the named publication date rather than inventing an update timestamp.

Population: learning activity delivered by Scottish colleges, all funding
sources. Geography is **Scotland's colleges**, not Scottish-domiciled residents,
universities or a count of individual people. Measure is full-time equivalents
(FTE), with one FTE equivalent to 600 learning hours. The annual accounting period
is academic year 2024–25 (1 August 2024 through 31 July 2025). No seasonal
adjustment or annualisation is performed. Preserve rounded source values.

| Stable measure | Table 1 cells | Unit | Original value |
| --- | --- | --- | ---: |
| part_time_fe | C6 label, C16 value | full-time equivalents | 39,655 |
| full_time_fe | D6, D16 | full-time equivalents | 47,405 |
| part_time_he | E6, E16 | full-time equivalents | 4,595 |
| full_time_he | F6, F16 | full-time equivalents | 24,400 |
| total | G6, G16 | full-time equivalents | 116,055 |

Require B16 academic year, the exact FTE unit and all-funding title, the complete
ordered ten-year Table 1 year axis, and the Scottish college identity in Table
14. Table 3 must independently repeat the current total FTE in E15 with the
matching year; its students/enrolments columns must never be substituted.
Exactly five observations are emitted. The total overlaps all four components.

## Numerical, missingness and revision rules

Require finite nonnegative safe integers in multiples of five. Numeric zero is
valid. A blank, absent, suppression marker, error or numeric-looking string is
not converted to zero: the selected five cells must be numerically explicit for
this initial contract. The annex's blank-as-zero rule is acknowledged, but a new
blank selected cell requires review to distinguish a reported zero from damaged
or incomplete structure. Never reconstruct suppressed values.

The four rounded components and separately rounded total can differ by up to
12.5 FTE under nearest-five rounding. Do not replace the published total with
a sum. The Table 3 total must match exactly. Values and category metadata can
change semantic versions; acquisition time or byte-container changes alone
must not change observational meaning. Changes to edition, academic year,
headcount/FTE semantics or rounding policy require a new reviewed contract.

## Evidence and pass/fail

The retained pre-code specimen is
`../prior-audit/sfc/original/tables.xlsx`, SHA-256
`f4816a63e4ab246799f4cbb6075d3feba78ada67670e34d71e5900826c3b5979`.
Python XML extraction and the separately published official Scottish Parliament
[10 September briefing, Table 1](https://www.parliament.scot/chamber-and-committees/research-prepared-for-parliament/research-briefings/2026/9/10/sb-2654)
match all five cells exactly. The presentation shares SFC FES lineage; this does
not independently measure teaching activity. Preserve that distinction.

Focused tests must cover the original full workbook, cross-table total, changed
edition/year/geography/unit/header, headcount substitution, omitted/duplicate
category or year, suppression, string/nonfinite/fractional/negative values,
rounding residual, zero control, corrupt/oversized archives, HTTP errors and
acquisition before publication. A strict representation validator must reject
changed semantic qualifiers and provenance identity, while allowing legitimate
numeric revisions that retain this contract.

## Transport and delivery

Only the fixed public HTTPS workbook is fetched, without a key, at most 131,072
wire bytes. Retain the existing XLSX safety limits (1 MiB input, 4 MiB per parsed
part, 8 MiB total parsed expansion, 256 entries); do not evaluate formulas or
external links. Use actual numeric cached values. A parser/read failure throws
for the caller to isolate; no other desk source may be dropped.

The [SFC publication scheme](https://www.sfc.ac.uk/wp-content/uploads/2024/03/SFC-Publication-Scheme.pdf)
permits accurate attributed reproduction of SFC-owned information without
misleading context. Expose that permission, not an invented OGL claim. No
registration, personal records or publisher contact is involved. Runtime/schema/
selector integration, actual protected Worker CPU, all existing desk regressions,
both-domain validation, release and monitoring activation remain parent-owned
acceptance gates. Research or local tests do not satisfy them.
