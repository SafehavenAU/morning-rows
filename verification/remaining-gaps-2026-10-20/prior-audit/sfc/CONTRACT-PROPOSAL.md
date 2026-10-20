# Proposed SFC five-measure contract — pre-code, 20 October 2026

Status: implementable in a separate authorised phase; no runtime acceptance.
Source proposal `scotland/college_activity`. Use the latest explicitly named
College Statistics release, one academic year, and exactly five Table 1 FTE
values: part/full-time FE, part/full-time HE and total, all funding sources.
Current exact cells `Table 1!C16:G16`, year `B16=2024-25`; independent comparator
is Scottish Parliament briefing Table 1. Original hashes are retained locally.

Population is learning activity delivered by Scottish colleges, not Scotland
residents, student headcounts or universities. Units are rounded full-time
equivalents (600 learning hours). No seasonal adjustment or extrapolation is
introduced. Preserve academic-year convention, publication date and input hash.
The rounded components happen to sum in this specimen but exact summation is
not a universal rule: four components and independently rounded total permit a
12.5 FTE rounding residual. Counts/changes need source-specific disclosure rules.

Acceptance: five exact publisher numbers, independent XML/HTML comparison,
explicit geography/units/denominator/revision/attribution and stable IDs.
Missing, suppression, unknown marker or damaged numeric cell cannot become zero;
if a selected cell becomes blank, preserve the edition's declared zero semantics
without treating a missing row/header as a reported zero. Do not unround or
reconstruct suppressed detail. Fail wrong table, headcount/enrolment substitution,
missing category, old year fallback, duplicated/mixed year, units, formula error,
corrupt/oversized ZIP, unexpected legend and wrong geography. Acquisition-only
changes must not alter observation version; changed observations must.

Reconcile the declared five cells exactly to `selected-comparison.json`; then
retain actual reader/selector/schema agreement, failure isolation, clean Worker
CPU and nine-desk regressions before versioned release. Current 70 KB workbook
fits the existing size approach, but actual Worker proof remains required.
Use SFC's reproduction permission and accurate attribution; do not claim OGL
without a source-specific basis. Preserve prior releases and all checkpoint,
alert, credential and scope boundaries. Parent owns any monitoring activation.
