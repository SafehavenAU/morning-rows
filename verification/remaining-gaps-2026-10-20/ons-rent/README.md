# ONS Manchester bedroom rent implementation

The [contract](CONTRACT.md) was written before the module. Current state: bounded module and local tests implemented; **integration and actual protected Worker resource/release proof remain pending**. No release or monitoring claim is made here.

The large workbook is used as independent verification evidence, not fetched by the runtime. Its official Manchester presentation explicitly identifies a public [JSON resource](https://www.ons.gov.uk/visualisations/housingpriceslocal/data/json/E08000003.json). A direct request at **2026-10-20T09:57:30.394443Z** returned valid JSON, **650,450 bytes**, SHA-256 `e73f895997858f0eff777ae8a3f5b66a56a5be53841fbc2a28527fd2361361d8`. The separate publication index was still the 16 September edition. Both resources needed no key or registration.

`lib/ons-rent.js` makes two bounded requests: JSON up to 1 MiB and publication HTML up to 256 KiB. It does not fetch or expand the 18.6 MB workbook / 92 MB worksheet. Original response bytes are hashed before strict UTF-8 decoding. Oversized, malformed, redirected, mislabelled or failed responses refuse the bounded source without returning old data.

The exact geography hierarchy, current release metadata and dated workbook link must agree. The newest rental month in the official JSON must have all four bedroom categories and agree with that release's rent narrative. The JSON's legacy `releaseDate` field is not treated as its current update date; the current `lastUpdated` must match the separate dataset index. No current month is inferred from today's date.

The independent report matches all four August 2026 levels: **1003, 1233, 1433 and 2014 GBP/month**, respectively one, two, three and four-or-more bedrooms across property types. It reconciles direct JSON fields and narrative with independently extracted original workbook cells and a separately requested official HTML presentation. These outputs share ONS estimation lineage; agreement does not independently certify the statistical method.

The output preserves Manchester `E08000003`, population, not-seasonally-adjusted status, nearest-£1 rounding, three-month moving-average methodology, revision caveats, OGL attribution and exact publication date. It exposes no property-type intersection, national coverage, available-property claim or historical selector. Public whole-source validation accepts `{retrieved_at}` to reject impossible future publication dates; it does not create an age-since-value-change rule.

## Reproduce

```sh
node --test test/ons-rent.test.js
python verification/remaining-gaps-2026-10-20/ons-rent/verify-original.py
```

The Python verifier never imports the runtime parser. To repeat against the full original responses, pass `--wire-root DIRECTORY` containing the manifest's `data.json` and `publication.html`; their original hashes are mandatory. The repository retains only small transformed extracts and original wire metadata. Unrelated data histories, contact/footer material and full pages are omitted.

Thirty-one test groups cover exact independent values, wrong geography/category, stale releases, partial latest periods, missing/suppressed markers, conflicting structured/narrative values, duplicate sections, invalid publication metadata, semantic output corruption, future-publication clocks, bounded transport and original-byte provenance. These local tests do not establish actual Cloudflare CPU or memory behavior. Root must validate the same module in the real protected candidate and independently reconcile its output before inclusion.
