# CMHC rental benchmark: transport recovered, bounded contract available

Checked **20 October 2026**, 09:42–09:43 UTC. This is a held-queue evidence update, not a reader implementation or release. No Morning Rows endpoint was requested.

The previous 17 October outage-HTML result is no longer the current transport boundary. The [StatCan table](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301), WDS cube metadata, two bounded WDS observations, series metadata and [original CSV ZIP](https://www150.statcan.gc.ca/n1/tbl/csv/34100133-eng.zip) returned valid data. The ZIP is 1,545,574 bytes, SHA-256 `9085a5bdbcdd2f29a4235175a65d940d7b84346a09548a974ffff26fbf0523b2`; its CSV expands to 24,042,374 bytes. This confirms transport recovery for these requests, not every CMHC source.

The latest cube period is **2025**. Preserve raw release timestamp **`2025-12-17T08:30`** without inventing a timezone. WDS represents the annual period as `2025-01-01`, while `refPerRaw` is `2025-10-01`, consistent with the October survey. It is not a January rental observation or a current monthly asking rent.

| Exact geography | Structure and unit | Coordinate | Vector | 2025 CAD/month |
| --- | --- | --- | --- | ---: |
| Victoria, British Columbia, CMA 935, `2011S0503935` | Row and apartment structures of three units and over; two-bedroom units | `186.3.3` | `v3823106` | 2,121 |
| Victoriaville, Quebec, CA 440, `2011S0504440` | Same combined structure category; two-bedroom units | `66.3.3` | `v3823208` | 991 |

Independent Python CSV/Decimal extraction matches both WDS observations exactly, including geography, dimensions, vectors, units, scale, period and normal published status. This is **two exact comparisons using separate encodings of one publisher table**, not an independent rental survey or a separate CMHC numerical presentation. The retained third CSV row is an explicit missingness control: `66.2.3`, the different row-structure-only category, has empty VALUE and `F` status. It remains missing, never zero; it does not replace the selected combined category.

## Concrete next contract and true limits

An implementable contract is these **two already selected geographic areas × the exact combined row-and-apartment category × two bedrooms × latest published annual average rent** on the existing Canada desk. Use metadata to bind all three dimension positions, exact DGUIDs/labels and vector IDs; test the historically plausible Victoria/Victoriaville and structure/bedroom substitutions. Do not label either area merely as a municipality. Do not split the combined structure measure into an invented apartment-only or row-only estimate.

The [official survey methodology](https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research/surveys/methods/methodology-rental-market-survey) describes an annual survey during the first two weeks of October. It covers eligible privately initiated rental structures with at least three units in urban centres of 10,000 or more, subject to the survey's frame conditions. This average includes vacant and occupied units in new and existing structures. Amenities and utilities are not standardized. It is a weighted mean, not the NZ median, not an inventory of available homes and not an asking-only index. Published geography definitions can change, so unreviewed historical growth comparisons are outside this proposed contract.

The remaining parser, missing-status mapping, exact semantic guards, source isolation, resource limits and protected-preview work are **implementation/acceptance gates**, not external access blockers. No key or registration was required. Current observations do not establish the complete WDS suppression/security vocabulary or revision policy; those must be pinned before generalizing beyond the two validated normal observations.

## Applicable reuse conditions

Cube footnote 2 explicitly links these rental data to the [CMHC Licence Agreement for the Use of Data](https://www.cmhc-schl.gc.ca/about-us/terms-conditions/hmip-terms-conditions). This is table-specific evidence; it is stronger than assuming all material on CMHC's website has the same permission. The [StatCan-hosted CMHC agreement](https://www.statcan.gc.ca/en/reference/agreement_CMHC), already retained under `statcan/homes/original/`, is related context, not a blanket licence for every CMHC page.

The linked agreement grants use and redistribution subject to its conditions, including accurate reproduction, prescribed acknowledgement and notices, no implied endorsement, and recipients agreeing to be bound. The conditional grant means the old “redistribution rights unconfirmed” statement is superseded, **but this audit does not establish recipient agreement or accept terms for users**. A proposed public delivery must satisfy the applicable licence conditions; the existing CMHC notice mechanism can be evaluated for reuse. Any unresolved recipient-agreement requirement is a genuine delivery constraint, distinct from the now-working data transport. No new permission request or publisher contact was made.

## Retained evidence and reproduction

`acquisition.json` records exact GET/POST requests, UTC retrievals, status and original wire hashes/bytes. `cmhc-points.json` and `cmhc-series.json` retain the two small responses byte-for-byte. `cube-excerpt.json` selects only the required table/dimension/release/footnote fields; it does not retain the whole geography inventory. `selected-csv.csv` keeps two numerical rows and one missingness control with original fields, reserialized by Python's CSV writer. Full HTML and the bulk ZIP remain outside the repository. `retained-manifest.json` records retained hashes and transformations.

```sh
python verification/gap-pass-2026-10-20/held-queue/cmhc-rent/verify.py
```

To reproduce from original wire responses, use the ledger's exact request bodies and `local_file` names in a private directory, then pass `--wire-root DIRECTORY --output NEW_DIRECTORY`. The verifier requires pinned wire hashes; it makes no network requests and cannot silently accept another release. Offline result: **two exact numerical matches and one preserved missingness control**. No runtime, source registry, credentials, monitoring state or deployment was changed.
