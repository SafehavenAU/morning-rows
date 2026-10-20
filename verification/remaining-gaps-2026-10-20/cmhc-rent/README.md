# CMHC two-area rental benchmark

The [falsifiable contract](CONTRACT.md) precedes the module. The [licence assessment](LICENCE-ASSESSMENT.md) compares this table's actual linked terms to the accepted Canada homes notice mechanism. The bounded module and tests are implemented; actual protected Worker and release acceptance remain pending.

The bounded source is table **34-10-0133**, exactly **Victoria, British Columbia CMA** and **Victoriaville, Quebec CA**, combined **row and apartment structures of three units and over**, **two-bedroom units**. It is an annual weighted average rent in CAD per month. The selected 2025 values are **2121** and **991**. It does not split that combined structure category, label both places as municipalities, expose country-wide inventory or infer current asking rents.

The original WDS annual `refPer` is `2025-01-01`; the underlying `refPerRaw` is `2025-10-01`. Preserve survey year/month and unzoned raw publication `2025-12-17T08:30`, not a fabricated UTC timestamp. Independent Python CSV/Decimal extraction exactly reconciles both WDS observations and their series/cube metadata. The separate retained `66.2.3` row-structures-only cell has empty VALUE and `F` status; it is a missingness control, not a substituted answer or zero.

The current original metadata/data requests succeeded at 09:42–09:43 UTC on 20 October, as recorded in `original/manifest.json`. Two small WDS responses are retained byte-for-byte; the cube excerpt includes the original response envelope, response code, dimension order/unit placement, two geography members, the exact structure/unit members and applicable footnotes. The full inventory and web contact/footer material are omitted. The original CSV ZIP was independently parsed; only three selected rows remain.

The table explicitly links its [CMHC licence](https://www.cmhc-schl.gc.ca/about-us/terms-conditions/hmip-terms-conditions). Reuse carries the source and adaptation/no-endorsement notices plus applicable conditions. Use-based agreement is the stated licence mechanism; no additional clickthrough or recorded receipt is specified. The response must not claim that it observed any recipient accepting terms. No new approval flow or contact is introduced.

```sh
node --test test/cmhc-rent.test.js
python verification/remaining-gaps-2026-10-20/cmhc-rent/verify-original.py
```

This verifier imports no runtime reader and checks retained hashes before comparing values, periods, exact categories, geography, scale, units, status and confidentiality flags. Its two matching encodings share CMHC statistical lineage; this is not an independently conducted rental survey or a separately presented CMHC numerical comparison.

The reader performs exactly three bounded WDS requests in parallel: observations and series metadata, each capped at 16 KiB, and cube metadata capped at 128 KiB. All requested dimensions, original vector identities, current cube vintage, annual/raw October periods, status, confidentiality, precision and the table-specific licence link must agree. Original UTF-8 bytes are hashed and retained as provenance; no bulk CSV, old-year or fixture fallback is used at runtime. Ninety-two local test groups cover these boundaries and conditional-notice propagation. The two rent modules together pass 123 groups.

Only current normal observations are demonstrated. Missing/suppressed/confidential or unknown statuses must fail closed until explicitly supported; no complete missing-symbol vocabulary is inferred from one control. Actual protected source isolation, licence propagation, exact native/selected output, CPU and final production checks remain separate root-owned gates.
