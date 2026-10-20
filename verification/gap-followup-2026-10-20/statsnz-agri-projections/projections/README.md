# Two projection cells: follow-up evidence, 20 October 2026

Neither gap is closed. This record strengthens the semantic boundary without changing the reader, switching scenarios, manufacturing precision, or approving a later release.

| Existing reader target | New permitted evidence | Remaining blocker |
| --- | --- | --- |
| `POPPR_LAB_003` / P50 / SEX3 / TOTALALLAGES / 2026 = 3,144,100 people | Original 2024-base workbook gives **3,144 thousand** directly. The release’s separately presented broad-age graph gives four numbers whose sum is 3,144,100. The workbook explicitly makes the median an exception to its percentile non-additivity warning, but also warns that rounded components need not sum to totals. | No direct total at the target’s hundred-person precision was obtained. The component sum is qualified corroboration, not acceptance of the exact total. |
| `POPPR_FHH_003` / MEDIUMA / HH / 2028 = 2,087,100 households | Official 2018-base methodology explicitly defines A as constant 2018 living-arrangement rates; Medium uses medium fertility, mortality and migration. The workbook’s Medium B national total is 2,028,700, a different scenario. Public Infoshare supplies a 2013-base Medium A 2028 total of 2,021 thousand, a different vintage. | No exact Medium A 2028/2018-base total was obtained. Neither Medium B nor the older Infoshare series can substitute. |

The 2024-base labour-force projections have a 30 June reference date, apply assumed labour-force participation rates to the resident population, and include unemployed people in the labour force; they are not observed employment. They were released on 25 June 2025. The 2018-base household release is dated 15 December 2021 and projects five-year intervals at 30 June. Its population and household assumptions are conditional scenarios, not forecasts. The native target’s base is not explicit in its displayed dimensions, so an exact export must also bind the base/release before acceptance.

New public metadata:

- [2018-base household methodology](https://datainfoplus.stats.govt.nz/item/nz.govt.stats/09012fc6-ff7f-483b-8be5-e4afdef49baf) defines all six combinations, constant-A and modelled-B assumptions, and aggregation from territorial authorities. The publisher considered Medium B most suitable at release; this is not permission to change the requested Medium A contract.
- [2024-base labour-force methodology](https://datainfoplus.stats.govt.nz/item/nz.govt.stats/1c1c608f-0f86-406c-94b4-b4c723d52fa2) binds the annual reference period, base and cohort-component/LFPR method.
- [Labour-force release](https://www.stats.govt.nz/information-releases/national-labour-force-projections-2024base-2078/) contains the broad-age graph and rounded workbook.
- [Household release](https://www.stats.govt.nz/information-releases/family-and-household-projections-2018base-2043/) contains the B-scenario workbook and legacy NZ.Stat links.

The public ADE URL returned its application shell, with no selected observations. The legacy `TABLECODE8602` request was refused by the execution environment’s HTTP tunnel before any publisher response; it is not evidence that the publisher returned HTTP 403. Its first fetcher did not preserve the exact failed-request timestamp, which is explicitly recorded as unavailable. No retry, authenticated API request, key registration or credential use occurred.

Public Infoshare was browsed through its normal form interface. The inspected Population/DNH group offered only 2013-base household tables; Population and Work income/spending did not expose the current labour projection in the inspected groups. This is a bounded search, not proof that no other permissible publisher export exists. The retained export `DNH009AA` states 29 October 2015, 10:45am, without a timezone; none is invented. Raw form/session values are excluded from this package. The contact trailer is excluded from the CSV excerpt.

## Reproduce offline

```sh
python verify-projections.py /tmp/projection-evidence-result.json
```

This uses Python’s standard-library XML and CSV parsers, separate from the production SDMX reader. It checks 19 retained-evidence assertions and seven explicit refusal boundaries. A passing result means the evidence record is internally verified; `gap_completion` stays false and exact gaps closed stays zero. These are evidence controls, not additional production tests.

Minimal original worksheet row nodes and corresponding shared strings retain source cell references and numeric text. Graph data retains only the original labels and 2026 column. Metadata retains the exact relevant public text sections. Each mapping identifies the original public URL, acquisition timestamp, full-source hash and transformation. Original source hashes describe the acquired files, not the smaller transformed fragments. `manifest.json` binds the retained fragments themselves.

`prepare-excerpts.py RAW_DIRECTORY OUTPUT_DIRECTORY` reproduces those fragments from a directory containing the original named public acquisitions and normal Infoshare export. It performs no HTTP requests. Full page chrome, unrelated regions/years, contact details, transient session paths and hidden form state are not retained in this package. Acquisition and publication times remain distinct; no projected reference year is treated as publication or retrieval time.

Stats NZ is the publisher and source of all retained aggregate cells and metadata; see its [copyright terms](https://www.stats.govt.nz/about-us/copyright/). The separate presentation and extraction share the publisher’s statistical lineage. This work establishes no independent statistical sample and no future-vintage approval.
