# homes: falsifiable verification contract — 20 October 2026

Written from freshly acquired official metadata before implementation. This is one existing Canada source, with no additional series coverage. Acquisition time is separate from the publisher release and subsequent independent verification times.

## Exact selection

- Publisher: Statistics Canada; table `34-10-0136-01`, product `34100136`.
- Coordinate: `1.1.1.0.0.0.0.0.0.0`; vector `15817836`; exact series title `Canada;Housing starts;Total units`.
- Exact cube title: `Canada Mortgage and Housing Corporation, housing starts, under construction and completions in all centres of 10,000 and over for Canada and provinces`.
- Geography: Canada, explicitly verified from selected Geography member and classification, never inferred from the desk.
- Measure/population: Housing starts, total units. Housing starts in all centres of 10,000 population and over in Canada; excludes the interpretation of all Canadian centres or all rural areas.
- Frequency code `9`; units `dwellings`, publisher UOM `300`, scalar `0`, decimals `0`.
- Adjustment: not specified by the retained series/cube metadata; no seasonal-adjustment claim is permitted without supporting official evidence.
- Latest selected specimen: `2026-Q3` = `57947`; publisher release `2026-10-19T08:30` (timezone unspecified by the payload; do not append Z).
- Exact dimensions, member labels, geography classification/vintage and codes are machine-readable in `selected-config.json`.

This is a quarterly level. Typed period is YYYY-Qn with explicit quarter boundaries. A legacy YYYY-MM alias denotes the quarter start, not a monthly observation. The retained Q3 value has refPer 2026-07-01 and refPerRaw 2026-09-01. Do not conflate it with monthly or annualized/seasonally adjusted housing starts.

## Structural validity

Require one successful data object for the exact product/coordinate/vector, one latest observation, exact metadata identities and titles, all selected dimension member IDs/labels/UOMs/geography classification, current nonterminated series/cube, and the prescribed frequency/scalar/decimals. Validate legal canonical dates and exact current cube end anchor. Reject wrong geography, substituted series/vector, extra/partial dimensions, duplicate periods, wrong units or adjustment, an older-release fallback, nonfinite/string values, inconsistent raw-period conventions and data released after actual acquisition. A successful HTTP response alone is insufficient.

## Numerical and semantic correctness

Reconcile the exact selected WDS value against the separately extracted official CSV row with its full dimension labels, vector, coordinate, period, UOM/scalar, decimals and flags. Use Python CSV/JSON extraction independent of the JavaScript reader. Require exact equality at the publisher precision: no rounding tolerance for the published integer or one-decimal value, and no invented scale conversion. Require all one selected observations, not a passing subset. Separately reconcile an official HTML table or dated publication when it presents the same selected vintage; never use another release to certify this specimen. Same-publisher CSV and WDS share statistical lineage and do not constitute independent statistical measurement.

Accept numeric status codes only `[0]`; symbols only 0 (normal), 1 (preliminary), 3 (revised), with explicit preservation of applicable qualifications; security must be 0 (public). Reject missing/unavailable, rounded-to-zero sentinel, suppression, F/unreliable, not applicable and detection-limit statuses as numeric results. Never turn suppression into zero. Symbols/statuses must be interpreted from retained official code sets, not treated as arbitrary nonzero failures. Retail quality A–E must retain letter and description; E must say use with caution.

Revisions are allowed only as a newly retrieved official value/metadata/release with retained provenance; changed release, revision symbol, quality or observations must alter semantic version. Acquisition timestamps and response byte hashes alone must not change semantic version. Unchanged monthly/quarterly observations remain valid; no age-since-value-change staleness rule.

## Required failure evidence and acceptance

Before acceptance, test realistic wrong Canada/member, wrong period/frequency, unit/scalar errors, wrong selected population or adjustment, malformed metadata, old-release substitution, future release, duplicate/partial coverage, all disallowed numeric flags, suppression converted to zero and revised/preliminary/quality handling. Validate actual output and preserve unrelated Canada sources and other desks. Structural success, numerical agreement and source reuse permission are separate gates. The source passes only when every required gate succeeds; a missing independent presentation or unclear reuse condition must remain explicitly unresolved, not silently waived.

## Reuse and evidence

Official CMHC terms were subsequently retrieved successfully from Statistics Canada at https://www.statcan.gc.ca/en/reference/agreement_CMHC and retained as `original/cmhc-licence-statcan.html`; the original CMHC link remains a retained HTTP 403 attempt. The agreement expressly covers CMHC data/time series and permits accurate reproduction, publication, distribution and value-added products. It requires the relevant source or adaptation notice, no endorsement/misrepresentation, and recipients to agree to the same terms. It states that use of the Information constitutes agreement; it does not prescribe a click-through. Runtime output must preserve the CMHC terms link, source/adaptation notice and explicit downstream terms condition. This evidence does not establish any actual recipient agreement and does not substitute attribution for the downstream condition. Exact notice templates and the observed terms boundary are retained in `selected-config.json`. Do not label the selected CMHC data solely as Statistics Canada Open Licence. Terms interpretation and recipient-assent mechanics remain distinct from factual numerical validation.

`original/wds-selected.json`, `original/series-metadata.json`, `original/cube-metadata.json`, and `original/selected-series.csv` are the exact acquired publisher bytes. `acquisition.json` records request payload/URL, HTTP result, retrieval time, byte length and SHA-256. Supporting code sets are retained at `../price_index/original/codes.json`. Any failed presentation acquisition is evidence of a limit, not passing comparison evidence. An `independent-report.json` will distinguish value/dimension reconciliation and any separately presented official corroboration.

## Independent comparison precision and retained outcome

The selected official table-view presentation explicitly labels the observed 57,947 housing starts as **Q3 2026**, Total units, Canada, under the cube title specifying centres of 10,000 and over. It reconciles exactly with independently extracted CSV/WDS. This satisfies a separate official presentation comparison; it still shares the same statistical lineage and table service. No separate dated CMHC publication was compared, and no seasonal-adjustment or annualization assertion was established.
