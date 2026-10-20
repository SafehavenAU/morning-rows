# NI electricity: next bounded contract proposal

Prepared 20 October 2026, before runtime work. Root authorised preparation for a
separate second phase after the current release. **Research is not implementation
or release acceptance.** Proposed source: `northern-ireland/electricity_balance`.

## Supported answer and exact scope

Answer how much electricity Northern Ireland generated and consumed during the
latest complete published rolling year, and the renewable share of gross final
consumption. Return exactly five measures for one common 12-month window:

| Measure | Unit | Retained July 2025–June 2026 |
| --- | --- | ---: |
| Gross final electricity consumption | GWh | 8,865 |
| Renewable generation | GWh | 4,431 |
| Non-renewable generation | GWh | 3,855 |
| Net imports (imports minus exports) | GWh | 578 |
| Renewable generation / gross final consumption | % | 50 |

These are Northern Ireland aggregates, including metered and own-use generation.
GFEC equals generation plus imports minus exports; the renewable numerator is
indigenous renewable generation. The report describes Statistics in Development.
The new basis began publication in March 2026. It must not be joined to the
superseded consumption measure. Values are rounded and revisable, not final.
The annual volumes are totals, despite one section heading saying “average”.
The 53% share of generation and June-only 47% are different measures. The
[official report](https://datavis.nisra.gov.uk/Economy/electricity-consumption-and-renewable-generation-report.html)
and [dated release](https://www.economy-ni.gov.uk/news/electricity-consumption-and-renewable-generation-northern-ireland-year-ending-june-2026)
establish these distinctions.

## Acquisition, identity and period rules

Use the official report's explicitly titled Figure 1 and Figure 3 embedded XLSX
exports; require matching worksheet titles, named columns and latest dates.
Current XLSX latest date serial 46174 means June 1, 2026, a month label; normalize
to window start 2025-07-01 and inclusive end 2026-06-30. The retained exact
selection and raw archive hashes are in `independent-report.json`. Validate all
source rows necessary to establish newest date, rejecting duplicates/unordered
or impossible dates and wrong titles. Emit only the five latest-window cells;
no monthly series, fuel breakdown, historical API or annual growth is included.
A latest-window missing cell fails this source; never substitute an older row.

Select the current publication's explicitly stated period/date. Preserve
publication time (date-only), acquisition time and verification time separately.
Do not fabricate an exact publication instant. Report bytes can change under
the same URL; include input digest and revision caveat. An unchanged quarterly
publication is valid and does not become stale because daily values do not move.
The malformed mixed-width CSV exports are not used or silently repaired.

## Numerical and semantic acceptance

Require exactly five finite values, four GWh units and one percentage, with
common geography/window/methodology. Gross final consumption must be positive;
generation nonnegative; net imports may be negative. Preserve numeric zero.
Unknown markers, blanks and suppression must never become zero. Do not clamp a
renewable/GFEC ratio to 100: exports can make generation exceed consumption.

Reconcile each selected XLSX value exactly to an independent Python extraction
and the corresponding official chart, plus all five dated-news values for the
retained vintage. Published integer percentages allow 0.5 percentage-point
rounding; sum of three rounded GWh components versus rounded GFEC allows 2 GWh.
The current component residual is 1 GWh, not a defect. Do not replace publisher
values with recalculated ones. Shared SONI/NIE/DESNZ statistical lineage remains
explicit; format agreement is not an independent electricity measurement.

Failure tests must reject swapped renewable/non-renewable labels, consumption
versus generation denominator, monthly versus rolling figures, old methodology,
wrong country, shifted/mixed periods, incomplete latest rows, unknown/missing
values, duplicate periods, corrupt ZIP/XML and oversized expansion. Negative
imports and zero generation are valid controls. Native, selected and schema
outputs must agree. Changes to retrieval time alone must not alter observation
version; actual value, period, unit or methodology changes must.

## Reuse, integration and release gates

[DfE Crown copyright guidance](https://www.economy-ni.gov.uk/articles/crown-copyright-economy)
permits attributed OGL reuse, with accuracy and no endorsement; retain publisher,
licence and method links. No key or registration is involved. Existing sources
must survive a failed NI energy read. Before approval: small-workbook limits,
actual clean Worker preview and CPU, all nine-desk/core/claimant/rent/current-pass
regressions, both domains and the established versioned release workflow.
Any monitoring obligation or review-chain extension is owned by the parent and
requires separate explicit activation. No scheduled proof or checkpoint is
created by this proposed source or its research.
