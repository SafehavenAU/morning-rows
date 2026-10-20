# Existing transport edition evidence — 20 October 2026

All **12 retained original cells** match the actual existing readers. Independent
Python ZIP/XML extraction passes74 checks; actual-reader comparison passes12 cells
and12 negative cases. No runtime correction or edition replacement was indicated.
This record does not claim production deployment or scheduled acceptance.

NZ retains the named **2024 annual fleet** release, version4.0 published in
October/November2025. The eight counts are Light passenger3,534,392;
Light commercial775,441;Motorcycles209,417;Trucks174,787;Bus12,057;Other39,005;
Total4,745,099;Total light4,309,833. Counts describe the published national annual
fleet, with licensing/restoration exclusions and Ministry category definitions.
Total and Total light overlap components.

Scotland retains **Scottish Transport Statistics2025**, published25March2026,
with calendar-year2024 road distance: Motorways8,742;All A roads22,937;
All minor roads17,633;All roads49,313 **million vehicle kilometres**. The values
are Not Accredited Official Statistics. The chapter independently corroborates
all four at its displayed rounding; minor-road benchmarking/revisions and
approximate year-to-year comparisons remain material.

Reproduce offline from the repository root:

```sh
python verification/gap-pass-2026-10-20/transport/verify-original.py
node verification/gap-pass-2026-10-20/transport/verify-readers.mjs
```

`original/acquisition.json` preserves exact original request URLs, retrieval
times, byte counts and SHA-256. The two workbook binaries are the exact downloaded
publisher files. `minimal-cells.json` retains the12 cells and header context.
`independent-report.json` records independent Python results; `reader-comparison.json`
records actual reader values, source-code hashes and negative controls.

The fresh Scottish index lists2025 as its newest named STS entry and the edition
page links the exact retained workbook. The separate NZ raw index download is
an Incapsula challenge despiteHTTP200. A direct browser-tool open of the official
index resolved the2024 workbook and official embedded tool; that named tool was
then directly downloaded and confirmed its2024 version. This route, its source
links and its limitations are recorded in `nz-edition-discovery.json`. It is not
an assertion that a search result alone or the challenged raw page proves freshness.
No newer named release was identified; unchanged annual observations remain valid.

Python XML and JavaScript readers use the same publisher workbooks. Separate
extraction catches parser/selection errors but is not independent statistical
measurement. Scotland adds a separately edited rounded chapter presentation,
still derived from the same Department for Transport estimates. NZ's static
official tool confirms edition/licence/coverage; it does not independently
present all eight numerical cells. This limitation remains explicit.
