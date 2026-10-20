# Remaining gaps: phase-two evidence boundary

As of 20 October 2026, **two additions have passed protected actual-reader
verification**: Scotland `college_activity` (five FTE observations) and Canada
`rental_benchmark` (two annual two-bedroom rent observations). Their exact
source sets are `scotland/college_activity` and `canada/rental_benchmark`.
This is a pre-release source-access and numerical-evidence result. The final
integrated version, CPU, both-domain interfaces and monitoring review remain
separate acceptance gates.

The [joined protected proof](preview/accepted-reader-proof.json) preserves the
original failed attempts, the one corrected workbook attempt, exact code hashes,
actual clocks, provenance and seven exact independent-reference comparisons.
No failed or blocked source is counted as accepted.

| Bounded contract | Actual Worker result | Activation boundary |
| --- | --- | --- |
| [SFC college activity](sfc/CONTRACT.md) | Exact original workbook and five FTE cells pass | Eligible for final integrated validation |
| [CMHC rental benchmark](cmhc-rent/CONTRACT.md) | Two exact 2025 cells and metadata pass | Eligible with retained CMHC licence conditions and notices |
| [CQC historical assessment cohort](cqc/CONTRACT.md) | Publisher HTTP 403 | Blocked; local parser/evidence does not establish access |
| [ONS Manchester bedroom rent](ons-rent/CONTRACT.md) | Publisher HTTP 429 | Blocked; no fixture fallback or additional attempt |
| [NI electricity balance](ni-energy/CONTRACT.md) | Report reader refused access page; bounded diagnosis confirms `Request Rejected` | Blocked; no activation or more requests |

SFC uses the fixed 2024–25 academic-year edition published 4 February 2026.
Its values measure all-funding Scottish college learning volume, not students
or Scottish residents. CMHC uses the 2025 October survey benchmark for Victoria
CMA and Victoriaville CA, combined row and apartment structures with three or
more units, two bedrooms. It is not a current asking-rent or apartment-only
measure. Conditional redistribution notices are retained; no individual
recipient agreement or receipt is asserted.

The separate SFC Parliament presentation shares SFC FES lineage, and the CMHC
CSV/WDS outputs share CMHC survey lineage. Exact independent extraction and
presentation checks do not provide independent statistical measurements.
The three held modules retain their pre-code contracts, originals and meaningful
failure tests for a later specifically reviewed continuation.

No monitoring schedule, durable checkpoint, historical incident, pending
notification or delivery state was changed by these source proofs. Existing
NZ-PRICES and UK CPI evidence restrictions continue unchanged. Nothing here
establishes sustained scheduled operation or completes the broader plan.
