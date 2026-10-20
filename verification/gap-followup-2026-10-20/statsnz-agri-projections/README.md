# Five Stats NZ gaps: dated evidence follow-up

Three exact numerical gaps are closed for the retained specimen. Two projection gaps remain blocked. No runtime code, source selection, credentials, production settings or monitoring state changed.

| Contract | Exact public export | Separate official publication | Result |
| --- | --- | --- | --- |
| AGR_AGR_001, national new exotic forest area, year ended 31 March 2018 | Infoshare AGR001AA: **8,293 hectares** | 2018 final workbook, Table 8 D34: **8,300 hectares**, rounded to nearest 100 | Exact numeric match, zero tolerance; separate rounded corroboration |
| AGR_AGR_002, national apple area, at 30 June 2024 | Infoshare AGR001AA: **9,522 hectares** | 2024 final workbook, Table 9 D29: **9,520 hectares**, rounded to nearest 10 | Exact numeric match, zero tolerance; separate rounded corroboration |
| AGR_AGR_003, national total sheep, at 30 June 2025 | Infoshare AGR001AA: **23,252,463 animals** | 2025 final workbook, Table 1 D29: **23,252 thousand** | Exact numeric match, zero tolerance; separate rounded corroboration |
| POPPR_LAB_003, P50 / total sex / total ages, 2026 | Direct total only **3,144 thousand**; broad-age graph values sum to 3,144,100 | Publisher explicitly exempts the median from percentile non-additivity, but warns rounded components need not sum to totals | Blocked: no direct total at required precision |
| POPPR_FHH_003, Medium A / households, 2028 | No exact selected 2018-base Medium A total obtained | Precise 2018-base Medium B is 2,028,700; public Infoshare Medium A is **2013-base**, 2,021 thousand | Blocked: different scenario or base cannot substitute |

The three agriculture matches validate the stated integers at the export's precision, not the accuracy of the underlying survey estimates. **Status flags were not displayed in the CSV. No per-cell final/provisional/revised-status verification is claimed.** The CSV's symbol legend is retained; `..` means unavailable, never zero. The dated 2025 release is described as final in publisher methodology, but that does not manufacture a missing per-cell flag. All three exported variables show the raw update timestamp **16 April 2026 10:45am** without a timezone. No UTC suffix is inferred.

## Evidence boundary and crosswalk

The production reader uses Stats NZ ADE/SDMX dimensions. This follow-up independently extracted a separate original public Infoshare export with Python's standard-library CSV parser. Its public table file is `AGR075501.px`, table reference `AGR001AA`, title `Variable by Total New Zealand (Annual-Jun)`. The geography is explicitly `Total New Zealand`; each selected series has magnitude **Units**. These are annual survey/census estimates with no seasonal adjustment indicated by the export. No seasonally adjusted series or annualized rate is substituted.

The semantic crosswalk is:

- `FORESTRY_AGR_AGR_001=6050`, `AREA_AGR_AGR_001=20` → `New Area Planted in Production Forest`, national; workbook binds **new exotic area**, not replanting, and year ended **31 March**. The generic Infoshare annual-June table label does not override that series-specific convention.
- `HORTICULTURE_AGR_AGR_002=8500`, `AREA_AGR_AGR_002=20` → `Apples`, national; workbook binds area at **30 June 2024**.
- `LIVESTOCK_AGR_AGR_003=6731`, `AREA_AGR_AGR_003=20` → `Total Sheep`, national; workbook binds animals at **30 June 2025**.

The ADE codes above come from the previously pinned selected contract, not an invented claim that Infoshare publishes those same machine codes. The new export names, units and geography are reconciled with separately published workbook headings and cells. The workbooks were extracted independently through `zipfile` and XML, without the production reader or the earlier `openpyxl` extraction. The 2018 and 2024 workbook hashes also match the prior retained acquisitions. All presentations share Stats NZ agricultural survey/census lineage; this is independent extraction and presentation, not an independent statistical sample.

Publisher methodology identifies a GST-based business frame with agricultural activities, including relevant secondary activities, and limitations in coverage below the compulsory-registration threshold. It distinguishes its survey/census estimates from other industry collections; none is substituted here. From 2025, a single final agricultural release is published in April. Horticultural fruit/vine area was not collected in 2025, so the unchanged 2024 apple reference remains valid. Selected original methodology paragraphs and source hashes are retained in `original/methodology-excerpts.json`.

## Public acquisition and limitations

The successful CSV acquisition completed **2026-10-20T12:11:59.405298Z**. `acquisitions.json` binds the original full response hash/size and the separate minimal excerpt hash via `manifest.json`. The CSV excerpt preserves original lines 1–12 and 26–44 byte-identically; it removes unrelated historical footnotes and all contact details. It retains selected data, units, the complete symbol legend, the undisplayed-flags warning, table ID and update timestamps. Methodology excerpts preserve relevant survey qualifications separately.

The ordinary no-key public form path was:

1. Open [Stats NZ Infoshare](https://infoshare.stats.govt.nz/), linked by the [official tool page](https://www.stats.govt.nz/tools/stats-infoshare/).
2. Expand **Industry sectors**, select **Agriculture – AGR**, then **Variable by Total New Zealand (Annual-Jun)** (`AGR075501.px`).
3. Select geography **Total New Zealand**, years **2018, 2024, 2025**, and the three named variables; choose **Comma delimited (.csv)** and Go.

`public-selection.json` records the visible controls and selected labels/values at acquisition. Dynamic hidden form values, session paths/query IDs, cookies and contact details are not retained. This was normal public UI navigation, not an authenticated API retry, key registration or workaround for an access restriction.

A later ordinary Options request returned HTTP 200 with a generic application error. The following on-screen-table attempt returned HTTP 200 with an explicit session-expired page after the driver process boundary. Both are recorded in `original/infoshare-follow-on-errors.json` and the acquisition ledger. Neither response is treated as table evidence; no further retry was made. Separate official workbook presentation remains available, at its honestly stated rounded precision. The successful and failed interactions are distinguished from the earlier exploratory navigation; only the retained successful sequence and the explicitly recorded follow-on sequence are claimed as fully logged.

## Reproduce

From this directory, with no network or runtime imports:

```sh
python verify.py --output /tmp/statsnz-agriculture-result.json
python projections/verify-projections.py /tmp/statsnz-projection-result.json
```

The agriculture verifier checks three exact matches, three rounded reconciliations and 12 meaningful negative controls covering wrong geography, period, measure, units, rounding substitution, missing/suppressed-to-zero conversion, release, table identity, coverage, flag claims and replanting. These are **evidence controls, not additional production tests**. The projection verifier checks 19 retained-evidence assertions and seven refusal boundaries; passing those checks does not close either projection gap.

To independently reproduce workbook extraction from the original hash-pinned downloads:

```sh
python verify.py --original-dir /path/to/original-downloads --output /tmp/statsnz-original-replay.json
```

That directory must contain the three public XLSX bodies under the filenames documented by `verify.py`. Each body hash must match before XML extraction. `prepare-agriculture.py RAW_DIRECTORY FRESH_OUTPUT_DIRECTORY` reproduces the minimal CSV, workbook cell excerpts, methodology excerpts and sanitized acquisition ledger from the original public acquisition files; it makes no requests. The retained report records that all three original workbooks were successfully replayed. Projection raw-to-excerpt reproduction is documented separately in `projections/README.md`.

[Stats NZ](https://www.stats.govt.nz/about-us/copyright/) is the source and publisher; retained material consists of minimal licence-permitted aggregate cells and supporting metadata under the publisher's reuse terms. Publication time, series update time, acquisition time and verification time remain distinct. These closures apply only to the stated dated agriculture specimen. They approve no future release, undisplayed flag, new source, delivery receipt, scheduled checkpoint or broader maintenance completion.
