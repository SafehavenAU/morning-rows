# price_index: falsifiable verification contract — 20 October 2026

Written from freshly acquired official metadata before implementation. This is one existing Canada source, with no additional series coverage. Acquisition time is separate from the publisher release and subsequent independent verification times.

## Exact selection

- Publisher: Statistics Canada; table `18-10-0004-01`, product `18100004`.
- Coordinate: `2.2.0.0.0.0.0.0.0.0`; vector `41690973`; exact series title `Canada;All-items`.
- Exact cube title: `Consumer Price Index, monthly, not seasonally adjusted`.
- Geography: Canada, explicitly verified from selected Geography member and classification, never inferred from the desk.
- Measure/population: All-items Consumer Price Index. Consumer goods and services covered by the Canada all-items CPI fixed basket; not a cost-of-living index.
- Frequency code `6`; units `index (2002=100)`, publisher UOM `17`, scalar `0`, decimals `1`.
- Adjustment: not seasonally adjusted.
- Latest selected specimen: `2026-09` = `170.0`; publisher release `2026-10-19T08:30` (timezone unspecified by the payload; do not append Z).
- Exact dimensions, member labels, geography classification/vintage and codes are machine-readable in `selected-config.json`.

The exact measure is the monthly all-items CPI index, reference base 2002=100. This contract does not derive monthly or annual inflation from one level.

## Structural validity

Require one successful data object for the exact product/coordinate/vector, one latest observation, exact metadata identities and titles, all selected dimension member IDs/labels/UOMs/geography classification, current nonterminated series/cube, and the prescribed frequency/scalar/decimals. Validate legal canonical dates and exact current cube end anchor. Reject wrong geography, substituted series/vector, extra/partial dimensions, duplicate periods, wrong units or adjustment, an older-release fallback, nonfinite/string values, inconsistent raw-period conventions and data released after actual acquisition. A successful HTTP response alone is insufficient.

## Numerical and semantic correctness

Reconcile the exact selected WDS value against the separately extracted official CSV row with its full dimension labels, vector, coordinate, period, UOM/scalar, decimals and flags. Use Python CSV/JSON extraction independent of the JavaScript reader. Require exact equality at the publisher precision: no rounding tolerance for the published integer or one-decimal value, and no invented scale conversion. Require all one selected observations, not a passing subset. Separately reconcile an official HTML table or dated publication when it presents the same selected vintage; never use another release to certify this specimen. Same-publisher CSV and WDS share statistical lineage and do not constitute independent statistical measurement.

Accept numeric status codes only `[0]`; symbols only 0 (normal), 1 (preliminary), 3 (revised), with explicit preservation of applicable qualifications; security must be 0 (public). Reject missing/unavailable, rounded-to-zero sentinel, suppression, F/unreliable, not applicable and detection-limit statuses as numeric results. Never turn suppression into zero. Symbols/statuses must be interpreted from retained official code sets, not treated as arbitrary nonzero failures. Retail quality A–E must retain letter and description; E must say use with caution.

Revisions are allowed only as a newly retrieved official value/metadata/release with retained provenance; changed release, revision symbol, quality or observations must alter semantic version. Acquisition timestamps and response byte hashes alone must not change semantic version. Unchanged monthly/quarterly observations remain valid; no age-since-value-change staleness rule.

## Required failure evidence and acceptance

Before acceptance, test realistic wrong Canada/member, wrong period/frequency, unit/scalar errors, wrong selected population or adjustment, malformed metadata, old-release substitution, future release, duplicate/partial coverage, all disallowed numeric flags, suppression converted to zero and revised/preliminary/quality handling. Validate actual output and preserve unrelated Canada sources and other desks. Structural success, numerical agreement and source reuse permission are separate gates. The source passes only when every required gate succeeds; a missing independent presentation or unclear reuse condition must remain explicitly unresolved, not silently waived.

## Reuse and evidence

Statistics Canada Open Licence permits reuse with attribution, subject to its third-party exceptions. The official licence and attribution links must accompany the source.

`original/wds-selected.json`, `original/series-metadata.json`, `original/cube-metadata.json`, and `original/selected-series.csv` are the exact acquired publisher bytes. `acquisition.json` records request payload/URL, HTTP result, retrieval time, byte length and SHA-256. Supporting code sets are retained at `../price_index/original/codes.json`. Any failed presentation acquisition is evidence of a limit, not passing comparison evidence. An `independent-report.json` will distinguish value/dimension reconciliation and any separately presented official corroboration.

## Independent comparison precision and retained outcome

The dated 19 October 2026 Daily table 1 presents the exact September 2026 Canada all-items index of 170.0, base 2002=100. It reconciles exactly with the retained CSV/WDS and table viewer, with zero tolerance. The independently extracted comparison is retained in `independent-report.json`.
