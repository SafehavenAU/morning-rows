# Existing WRA annual tax-due measures

Written before implementation on 20 October 2026. Scope is the four existing
`wales/land_transaction_tax` cells in StatsWales dataset
`60a57730-166f-486d-9315-69f7fd4c78b1`; no additional tax series.

Required geography is Wales, nominal GBP million tax **due** by effective
financial year, 1 April–31 March. These are not receipts, property values,
counts or seasonally adjusted observations. Select the latest available
completed financial year, retaining its exact `YYYY-YY` label and boundaries.
Do not use age since last change as a freshness rule.

The exact selections are:

| Stable measure ID | Description | Transaction type |
| --- | --- | --- |
| all_inclusive | Annual total | All transactions |
| all_disclosed | Annual total excluding untypical and undisclosed transactions | All transactions |
| residential_disclosed | Annual total excluding untypical and undisclosed transactions | Residential |
| non_residential_disclosed | Annual total excluding untypical and undisclosed transactions | Non-residential |

All four must retain explicit coverage. Inclusive and restricted-detail totals
overlap; never sum all four or infer a confidential residual. Published zero is
valid; missing, confidential, unavailable or unrecognised numeric cells do not
become zero. Preserve revision notes and publisher rounding, including possible
higher-rate refunds. No immutable-vintage promise is made.

Acceptance requires a dated minimal original CSV specimen and metadata, separate
Python extraction of all four exact cells, and a separately presented official
table/publication with matching effective-year/coverage definitions where
available. Reconcile exact displayed CSV values; any comparison with a rounded
publication must use that publication's stated precision. Accounting revenue
and cash collections are not comparable substitutes. Record shared WRA lineage
and every remaining presentation-independence gap.

Typed selection must identify exactly these four measures and the retained
financial year. Unknown measures and unretained periods are refusals, never
latest-value substitutions. Schema validity, numerical reconciliation and
semantic validation are separate gates. Test wrong geography, year boundaries,
units, coverage, duplicate/missing/suppressed cells and revision metadata.
Preserve the existing native response and unrelated Welsh sources.
