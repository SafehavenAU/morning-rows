# ONS bedroom-only rent: implementable bounded candidate

Checked **20 October 2026**, 09:42–09:47 UTC. This is a held-queue evidence update, not a reader implementation or release. No Morning Rows endpoint was requested.

The [current ONS dataset](https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics) still identifies the **16 September 2026** workbook; the next release is listed for **21 October**. The downloaded workbook is byte-identical to the 17 October research specimen: 18,640,156 bytes, SHA-256 `ab1fdfbb27738b20cd1762521a19489c9274dedae1e39926e734ac1cf867f2de`. It supplies August 2026 estimates, not October observations. An unchanged monthly release is valid.

The separate [official Manchester presentation](https://www.ons.gov.uk/visualisations/housingpriceslocal/E08000003/) is also dated 16 September. Its rent narrative and category lists reconcile with **six independently extracted workbook cells**, including all four bedroom categories:

| Manchester `E08000003`, August 2026 | GBP per month | Table 1 cell |
| --- | ---: | --- |
| One bedroom, across property types | 1,003 | L34163 |
| Two bedrooms, across property types | 1,233 | P34163 |
| Three bedrooms, across property types | 1,433 | T34163 |
| Four or more bedrooms, across property types | 2,014 | X34163 |
| All properties, control | 1,373 | H34163 |
| Flats and maisonettes across bedroom counts, control | 1,147 | AN34163 |

The HTML extraction is separate from the standard-library XLSX/XML extraction. Both outputs share ONS PIPR statistical lineage; their agreement checks extraction and selection, not the underlying estimation. The flat control is deliberately distinct from the two-bedroom measure. **Neither presentation supports a joint two-bedroom-flat answer.**

## Concrete next contract

An implementable first contract is **Manchester only, the four published bedroom categories, latest published monthly level**, on the existing England desk. Use the exact local-authority code, GBP per month, not seasonally adjusted, rounded to £1. A source refresh must identify its actual release and period and retain revision evidence; never fabricate a current month or substitute another geography. Preserve `[x]` as unavailable and `[z]` as not applicable, never zero. Do not add joint property/bedroom, listings, asking-rent or individual-property claims.

The [current PIPR QMI](https://www.ons.gov.uk/peoplepopulationandcommunity/housing/methodologies/priceindexofprivaterentsqmi) resolves important semantics that the earlier research left open:

- Local estimates use a **three-month moving average**, so the August label is not a raw August sample mean.
- Levels use imputed base-period prices uprated by the index; the base is refreshed periodically and the level history is recalculated on rebasing.
- The regular two-month imputation/revision policy applies to the **UK aggregate**, owing to Northern Ireland's input lag. It must not be attached to Manchester as an ordinary local revision window. Methodology-driven revisions remain possible.
- England's inputs cover achieved new and existing private rents. Cross-nation comparisons would require separate input-population caveats. The current QMI describes Scotland's achieved/advertised mixture from September 2025; the workbook's older broad note must not silently override that distinction.

ONS statistics are published under the Open Government Licence; retain attribution and methodology links. No key, registration or publisher contact is needed. This is **not externally blocked**. Remaining work is an implementation/acceptance gate: choose and validate a bounded acquisition/parser strategy, add exact dimension/period/missingness tests, and establish actual Worker resource and preview evidence before release. The original workbook's Table 1 XML expands to **92,054,843 bytes**; the existing small-file reader cannot simply be reused with its current bounds. The official presentation is a possible smaller acquisition candidate, but stability, exact location echoes and release changes need their own tests.

## Retained evidence and reproduction

`acquisition.json` records original URLs, UTC retrievals, status, wire bytes and hashes. Full pages and the large workbook remain outside the repository; contact/footer material is not retained. `selected-workbook.json` and `selected-presentation.json` contain only the selected aggregates, identifiers and explicit extraction transformations. `retained-manifest.json` binds those transformed specimens and the reconciliation.

Run from the repository root:

```sh
python verification/gap-pass-2026-10-20/held-queue/ons-rent/verify.py
```

To repeat the two independent extractions, download the exact ledger objects into a private directory using their recorded `local_file` names, then pass `--wire-root DIRECTORY --output NEW_DIRECTORY`. The verifier requires the pinned wire hashes and refuses an unreviewed release. It makes no network requests. Initial extraction diagnostics caught a property-sale price before the rent subsection was scoped; the final extractor scopes the rent list and all six comparisons pass. No production result was involved.
