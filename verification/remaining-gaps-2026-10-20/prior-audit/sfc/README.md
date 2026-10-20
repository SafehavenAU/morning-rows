# Scottish Funding Council queue reassessment — 20 October 2026

**Decision: concrete, modest implementation candidate; not externally blocked.**
A useful bounded answer is Scotland's college teaching volume by mode and level,
with five FTE cells for one published academic year. This is an education-sector
briefing task; AI-agent usage frequency remains unmeasured. Do not call the lack
of measured adoption an access or data-quality blocker.

The [4 February 2026 College Statistics release](https://www.sfc.ac.uk/publications/college-statistics-2024-25/)
provides a 70,694-byte [workbook](https://www.sfc.ac.uk/wp-content/uploads/2026/01/College-Statistics-2024-25-Background-Tables.xlsx)
and [methodology annex](https://www.sfc.ac.uk/wp-content/uploads/2026/01/College-Statistics-2024-25-Annex.pdf).
All return HTTP 200 without credentials. `Table 1!B16:G16` is academic year
2024–25, all funding sources, colleges in Scotland:

| FTE measure | Value |
| --- | ---: |
| Part-time FE | 39,655 |
| Full-time FE | 47,405 |
| Part-time HE | 4,595 |
| Full-time HE | 24,400 |
| Total | 116,055 |

The five values match Table 1 of the separately published
[10 September 2026 Scottish Parliament briefing](https://www.parliament.scot/chamber-and-committees/research-prepared-for-parliament/research-briefings/2026/9/10/sb-2654)
exactly. That presentation cites SFC and shares its FES lineage. The parliament
briefing also demonstrates an actual public-policy task, not measured agent use.

The proposed contract must distinguish FTE from students and enrolments. One
FTE represents 600 learning hours; the national college activity scope is not
all Scotland residents or universities. Counts are rounded to fives and totals
come from unrounded data. This edition reports actual zeros as blanks and
suppresses small-base changes/percentages; retain those edition-specific rules.
The [current rounding policy](https://www.sfc.ac.uk/data-and-analysis/) is dated
September 2026 and must not silently overwrite the February specimen's method.
The annex records a 20 April correction to a separate female-enrolment statement;
retain release hashes and do not treat all named-edition bytes as immutable.

The [SFC publication scheme](https://www.sfc.ac.uk/wp-content/uploads/2024/03/SFC-Publication-Scheme.pdf)
permits accurate reproduction of SFC-owned information with attribution and
without misleading context. No third-party restriction was identified for these
SFC FES totals. Do not falsely label this permission OGL solely because other
public authorities use OGL.

Next implementation requires a pre-code five-cell contract, exact table/header/
period identity, wrong-unit/headcount and missing-marker controls, independently
reproducible HTML comparison, actual Worker cost, all existing regressions and
release approval. No reader or monitoring activation occurred here.

Retained: `original/` bytes with request/hash records, `workbook-cells.json`,
`selected-comparison.json`, and extracted PDF text. Reproduce XML inspection:

```sh
python verification/gap-pass-2026-10-20/held-queue/inspect-xlsx.py \
  verification/gap-pass-2026-10-20/held-queue/sfc/original/tables.xlsx
```
