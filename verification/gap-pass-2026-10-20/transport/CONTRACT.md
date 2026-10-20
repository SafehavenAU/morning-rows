# Existing transport edition review

Written before any reader change on 20 October 2026. This is a bounded review of
the existing eight NZ fleet and four Scottish road-traffic cells, not a new
transport series or a claim that unchanged annual data are stale.

Check the original official publication indexes and their actual workbook
links. Retain retrieval time, URL, file hash and named edition. A search result
alone does not establish the latest edition. If the linked current release is
unchanged, record that discovery result without unnecessary runtime changes.
If a replacement exists, verify exact table, geography, period, units,
definitions, notes and independent presentation before adapting the reader.

NZ: Ministry of Transport annual fleet table 1.1, national counts of Light
passenger, Light commercial, Motorcycles, Trucks, Bus, Other, Total and Total
light. Counts are vehicles in the published annual fleet definition, not a live
register. Components reconcile; Total light overlaps two components. Preserve
licensing/restoration exclusions and category differences from NZTA.

Scotland: Transport Scotland's named Scottish Transport Statistics release,
table 5.1, Motorways, All A roads Total, All minor roads, All roads; calendar-year
million vehicle kilometres, not vehicles or road lengths. Retain the explicit
statistical status and revision/benchmarking notes. Total overlaps components;
allow only displayed rounding tolerance.

Acceptance requires directly retrieved official edition pages and workbook
links, independent standard-library workbook XML extraction of all twelve
retained cells, exact agreement with the actual readers for that edition, and
clear distinction between discovery, numeric comparison and shared-lineage
independence. Wrong geography/year/unit/table, missing/suppressed cells and
duplicate periods must not pass. No automated publisher contact or credentials.


## Pinned specimen and precise comparison rules

The independently extracted 2024 NZ table1.1 row is worksheet `1.1, 1.2`,
`B27:I27`: 3,534,392;775,441;209,417;174,787;12,057;39,005;4,745,099;4,309,833.
Every count must match the actual reader exactly. The first six categories sum
to Total and the first two sum to Total light; subtotals must never be double-counted.

The 2024 Scotland table5.1 cells are `AE6=8742`, `AE15=22937`,
`AE19=17633`, `AE23=49313`, in million vehicle kilometres. Exact original-cell
comparison has zero tolerance. The displayed whole-million components differ
from Total by1 million, within the existing2-million sum tolerance. The
independently edited chapter presents the first three as8.7,22.9,17.6 billion:
require nearest-one-decimal rounding with absolute tolerance0.05 billion. Its
all-roads headline says around49 billion: require nearest-whole-billion rounding
with absolute tolerance0.5 billion. No wider tolerance applies to source cells.

The NZ raw index challenge and the separate browser-tool official-link discovery
are different evidence and both remain explicit. `nz-edition-discovery.json`
records the exact resolved publisher workbook/tool links and tool limitations.
The named official tool was directly downloaded and identifies2024; a search
result alone was not used to establish the edition. Scottish index and edition
originals directly establish2025 as the newest named STS entry in that index,
published25March2026 and linking the exact workbook. Discovery is dated, not a
promise that a later release cannot exist.
