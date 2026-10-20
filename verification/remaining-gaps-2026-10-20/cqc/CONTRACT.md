# CQC adult-social-care assessment cohort — 20 October 2026

Written before the runtime module for the separately authorised remaining-gap
pass. Proposed source is `england/care_assessment_cohort`. This contract covers
only State of Care 2024/25's adult-social-care **overall ratings** published under
CQC's single assessment framework as at **1 August 2025**, in the report
published **24 October 2025**. It does not select the newest edition dynamically.

## Exact population and measure

The unit is **ratings**, for individual adult-social-care services at a location
in England, not unique locations, providers, patients or the whole population.
Under the new framework a care home and homecare agency at one location can
receive two ratings. Previous-framework location ratings must not be combined
with or compared with this service-level cohort.

CQC prioritised assessment by risk. The cohort is not representative of all
adult-social-care services and is not comparable with previous years. No
England-wide quality rate, trend, patient outcome, capacity, access or provider
recommendation follows from these counts. No percentage is added.

Read only this public, no-key original workbook:
`https://www.cqc.org.uk/system/files/2025-10/20251024_stateofcare2425_ratingsdata.xlsx`.
Require the exact Guidance snapshot/framework and risk/methodology statements,
the table-of-contents edition and worksheet identity, and sheet `1`'s title,
publication date, source and `Rating / Value / Percentage` headers.

| Measure | Exact row label | Numeric cell | Independent specimen |
| --- | --- | --- | --- |
| inadequate | Inadequate | 1!B7 | 125 |
| requires_improvement | Requires improvement | 1!B8 | 809 |
| good | Good | 1!B9 | 2,063 |
| outstanding | Outstanding | 1!B10 | 65 |
| total | Total | 1!B11 | 3,062 |

Only these five rows in this order are supported. Counts must be native finite,
safe, nonnegative integers. Missing cells, text numbers, booleans, suppression,
fractional/negative values and duplicate/relabelled/reordered categories fail.
The four categories must sum exactly to the published total. The original
3,062 is an independently checked specimen, not a hardcoded runtime value.
A genuine numeric zero remains valid if the remaining categories still
reconcile to the published total. Another snapshot, edition, framework or
assessment-unit definition requires a new reviewed contract.

Corrections within the same historical cohort, including a revised total, are
structurally possible but require fresh exact-version independent evidence;
changed values do not inherit the retained independent verification. Native
output must preserve the fixed historical period, separate publication date
and explicit revision caveat; acquisition time is not publication time.

## Evidence, reuse and boundaries

The original workbook and request/hash record are already retained in
`../prior-audit/cqc/original/`. Their independent Python ZIP/XML extraction
matches all four counts to the separately presented official SVG; the four sum
exactly to the workbook total. Shared CQC inspection lineage remains explicit.
Runtime code must not import that extracted comparison as its numeric reader.
The exact zero-tolerance comparison covers this specimen only, not future
editions or changed historical values.

CQC's retained public data guidance permits attributed Open Government Licence
reuse. Retain Care Quality Commission attribution, source/publication links and
the OGL link. No authenticated API, provider records, credentials, signup or
contact with CQC is involved.

One original fetch is bounded to **131,072 compressed bytes** and **20 seconds**.
Reject bad HTTP, unexpected redirects, missing body, excessive declared or
streamed length, corrupt archives and the existing workbook parser's ZIP/XML
limits. Do not evaluate formulas or follow workbook relationships externally.
Only cached numeric cells are read. Retrieval failure throws to the caller's
existing source-isolation boundary; no retained-data fallback is served.

The parser accepts the existing `openWorkbook` model. Native validation checks
all fixed semantic fields, row identities, values and arithmetic, and optional
bounded acquisition provenance. Retrieval-only changes must not change the
statistical meaning. Unknown extra fields cannot introduce a contradictory
current-population or percent claim.

## Falsifiable acceptance

The exact original must parse to all five specimen counts, with independently
reproduced Python references and a separately presented SVG comparison. Controls
must reject wrong edition/date/framework/unit/category/order, missing or
suppressed cells, invalid numbers, broken totals, malformed/oversized archives
and contradictory public metadata. A zero with a reconciled total must remain
zero. Test changed valid category values separately from independent acceptance.

Local implementation, original-byte parsing and offline controls do not prove
Cloudflare execution, current publication transport, deployment, scheduled
observation or delivery. Actual protected preview, integration/schema selectors,
release identity, both-domain regressions and reviewed monitoring activation
remain parent-owned gates. Existing nine desks, clocks, incidents, outbox and
credentials remain untouched by this module.
