# Proposed CQC cohort contract — pre-code, 20 October 2026

Status: implementable as an explicitly historical cohort, separately from the
current pass. Proposed source `england/care_assessment_cohort` returns exactly
five counts: four overall-rating categories plus total. Select only State of
Care 2024/25, workbook sheet `1!B7:B11`, labels in column A, framework/date in
Guidance, snapshot 1 August 2025, publication 24 October 2025. Counts are
125 / 809 / 2,063 / 65 / 3,062 in the retained specimen. No percentages,
individual-service lookup, extra cohorts or trend are included initially.

Population: England adult-social-care services with published overall ratings
under the single assessment framework by the snapshot date. Risk-prioritised
inspection means this is not a representative census of all care or a measure
of population health, care capacity or service accessibility. Never collapse
these qualifiers into a generic “England care-quality rate”. Counts are integer
service/assessment-cohort totals, not patients or organisations across all
frameworks. Preserve the publisher's exact assessment-unit terminology.

Acceptance: exactly four mutually exclusive rating categories and their total;
nonnegative integers, numeric zero valid, no blank/suppression-to-zero. Reconcile
four counts exactly to the separately published official SVG; sum exactly to
3,062. If labels/framework/date or totals change, fail or establish a new dated
specimen; never fall back silently. Reject location-versus-service substitution,
2024 sheet labels, mismatched date, missing/duplicate category, nonnumeric or
fractional count, corrupt/oversized archives and stale-edition substitution.
The current edition index must be checked under release validation; a newly
published edition cannot certify this old specimen and requires new evidence.

Use the small no-key aggregate workbook, never the authenticated API or bulk
provider contact records. Preserve OGL attribution and source caveats. Require
native/selector/schema agreement, independent extraction, stable semantic
versions, isolation of failed reads, clean Worker CPU and complete current
nine-desk regressions before a separate versioned release. Parent owns scope
activation. Research does not establish release, delivery or scheduled proof.
