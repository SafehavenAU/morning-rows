# Fiscal justice exact-cell follow-up

This evidence-only follow-up retains two existing selections. It does not
authorize a new series, reader change, release, credential use, monitoring write
or replacement of fiscal data with calendar-year data.

| Selection | Exact target | Dimensions |
| --- | --- | --- |
| `CORR_FIS_005` | Fiscal 2024/2025 (`2025`), 8,199 sentenced people | Offence, sex, ethnicity, duration and age all `X` |
| `JUS_FIS_001` | Fiscal 2024/2025 (`2025`), 50,741 adults convicted | Court cluster `T`, main offence `00`, age/gender/ethnicity/sentence all `T` |

These are national New Zealand person counts, not charges, convictions per
person, imprisonment receptions, average daily population or a 30 June prison
stock. Confirm the selected table's counting rule, age scope, fiscal boundary,
rounding and revisions from original official metadata before accepting a
numerical comparison. Do not infer those semantics from a matching number.

The comparison target is the earlier SHA-bound `reader-targets.json` in
`verification/gap-pass-2026-10-20/statsnz/`, which records accepted-reader output;
it is not independent publisher evidence. New evidence must identify its own
publication date, retrieval time, table/cell and vintage. An annual unchanged
value is valid, but equal numbers in a later release do not establish identical
revision history.

Acceptance requires a separately presented original official table/export for
the exact selection and fiscal period, independently extracted without the
runtime reader. Compare at zero tolerance in the publisher's stated units and
precision. If the publisher applies random rounding, certify only the published
rounded cell, never an underlying unrounded person count. Suppression, absence
and unavailable cells are not zero. Rounded headlines, related populations,
later calendar years, differently counted Ministry tables and third-party
republications cannot close the exact-cell gate.

Retain minimal permitted official excerpts, original response size/SHA-256 and
retained-excerpt SHA-256. Exclude contact details and unrelated footer metadata.
State any shared Ministry of Justice or Corrections administrative lineage.
Independent extraction/presentation does not independently audit the underlying
administrative records.

Both fiscal-release discontinuation notices dated 11 September 2026 remain
relevant. Continued calendar-year releases do not revise the period convention
of these two retained fiscal selections. If the exact evidence remains
unavailable, record the observed route and specific semantic/vintage blocker
without claiming completion or a reader defect.
