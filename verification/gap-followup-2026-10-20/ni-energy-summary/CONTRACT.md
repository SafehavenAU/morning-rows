# NI electricity article — fixed 3 September 2026 edition

Written before runtime implementation on 20 October 2026. This narrows the
[reviewed acquisition proposal](../access-review/ni-article/CONTRACT-PROPOSAL.md)
to one explicitly fixed edition, July 2025–June 2026 (inclusive
2025-07-01/2026-06-30), published 2026-09-03. It does not claim the latest
available statistics, a historical series, or automatic support for later editions.

Use one ordinary GET of
https://www.economy-ni.gov.uk/articles/electricity-consumption-and-renewable-generation-statistics
with Accept text/html, manual redirect mode and all redirects refused, 20 seconds and 256 KiB decoded bytes.
No retry, external-link fetch or fallback. Parse the actual article; emit no
values when its title, geography, publication/window, report link, March 2026
GFEC methodology or expected statistical sentences change. Article transport
was independently proven by the parent's protected Worker before this module.

The five stable IDs are renewable_share_gfec (%), gross_final_consumption (GWh),
renewable_generation (GWh), non_renewable_generation (GWh), net_imports (GWh).
They refer to Northern Ireland, unadjusted rolling twelve-month quantities;
renewable_share_gfec divides indigenous renewable generation by GFEC, not total
generation. Net imports are imports minus exports and may be negative. Missing,
blank, suppressed or nonnumeric values must never become zero. Select current
net imports by its explicit year/window sentence; the previous-year 172 is not
the current-year 578. Parse repeated current totals independently and require
agreement. Preserve publisher-rounded observations. GFEC is positive; generation
and renewable percentage are nonnegative with no arbitrary upper100% clamp.
Allow at most 2 GWh residual between GFEC and generation plus net imports, and
0.5 percentage points between the reported renewable ratio and its derived
check. Component generation must reconcile within publisher rounding. Changes
within this edition require new numerical acceptance; do not hardcode values as
a runtime oracle. Genuine zero and signed imports require constructed controls.

## Independently reviewed metadata anchor

The current article omits the full own-use/revision/status definitions. Bind
these explicitly to the retained original **same publication and window**:
[original report excerpt](../../remaining-gaps-2026-10-20/ni-energy/original/report.excerpt.html),
SHA256 `52978d72db205be7d9a146daeaedea467a7c9853304f2d0b43d770ef14c549f3`.
The original title, Coverage, publication date and publication period agree.
It states Statistics in Development; all metered and own-use renewable and
non-renewable generation; GFEC = those generations + imports - exports; revised
March2026 methodology; SONI/NIE supplier data may be revised; percentages rounded
to whole points. Existing original evidence establishes gross-of-losses and
rounded GWh. This is retained documentary evidence, never a new live report fetch.

[Independent workbook/chart comparison](../../remaining-gaps-2026-10-20/ni-energy/independent-report.json),
SHA256 `86b456beeef7b08eb6eb79b0de9e42519f98acf157972f72519ea76573efb9ee`,
and [separate official article extraction](../access-review/ni-article/comparison.json)
agree exactly on 50 / 8865 / 4431 / 3855 / 578. All presentations share
SONI/NIE/DESNZ lineage; extraction/presentation are independently checked,
underlying estimation is not. Metadata provenance must identify this frozen
anchor and the article as different evidence roles. Only the article gets live
retrieval bytes/hash; no invented workbook retrieval or history count.

Definitions and each row disclose fixed edition, the original metadata anchor,
provisional/revisable status, unit and inclusive period. Metadata contains five
observations and edition/report anchor, no unsupported history. Publication time
is unknown: retain the date, leave timestamps null. A real UTC retrieval clock
must not precede publication; explicit missing or invalid public clocks fail.
Unchanged observations remain valid without an age-since-change staleness rule.

## Acceptance and scope

Meaningful refusal controls cover future/old/mixed editions, wrong geography,
denominator, method, units, prior-year imports substitution, repeated/conflicting
values, partial rows, suppression, access pages, bounds, redirects and acquisition
clock/provenance tampering. Actual protected reader/selector success, CPU limits,
all prior contracts on both domains and versioned release remain parent-owned
gates. This isolated implementation does not activate the source. Retain DfE
attribution and its Crown copyright/Open Government Licence policy, no personal
or contact fields, no credentials or notification/checkpoint changes.
