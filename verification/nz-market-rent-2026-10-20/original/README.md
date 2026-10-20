# Original publisher evidence

Acquired **20 October 2026, 07:04:59–07:05:06 UTC**, without credentials or
cookies, from the official MBIE / Tenancy Services public website. The two
requested localities are Auckland - Avondale and Wellington - Kelburn.

`acquisition.json` records every original response URL, status, media type,
retrieval timestamp, byte count and SHA-256, plus exact selection transformations
and retained-file hashes. Full responses remain outside the repository:
navigation, contacts, footer metadata and unrelated page content are not needed
for this aggregate comparison.

- `*-ajax.html` is the complete, otherwise unchanged decoded JSON `Table`
  string. The `Finder` field is omitted. All five dwelling tables are retained.
- `*-page.html` retains the exact heading and all five dwelling tables from a
  **separate full-page GET** with an explicit city-qualified `location`. Only
  newlines were inserted between selected elements.
- `*-selection.html` retains the exact full-page form inputs for `location` and
  the opaque hidden `period`. We omitted `period` from the request: its current
  value `42` is evidence about the form, not a code to hardcode in the reader.
- `publisher-notes.json` retains paraphrased methodology, licence, current
  migration caveats, bounded official selector examples, and source hashes.
  Avondale suggestions include both Auckland and Christchurch, demonstrating
  why suburb-only selection is unsafe.

The displayed window remains **1 March–31 August 2026**. Both AJAX response
hashes match the earlier 17 October research byte for byte. A current retrieval
does not create a new release. No original publication timestamp or stable
official NZAD area identifier was established.

The independent verifier uses structural regexes for the AJAX table and a
separate Python `HTMLParser` event traversal for the full-page tables. It imports
no runtime parser. All **29 dwelling/bedroom rows and 116 numeric cells** must
match exactly, including all active-bond counts and the six-month window.
The two presentations share the same MBIE administrative/statistical lineage;
this checks selection and extraction, not an independent survey or calculation
of underlying rent statistics.

Figures are reused under **CC BY 3.0 NZ**, attributed to the Ministry of
Business, Innovation and Employment, with the
[official methodology](https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/market-rent-explained/)
link as required. They are non-government bond-based descriptive weekly rent
benchmarks, provisional and revisable. Website rounding/suppression rules must
not be inferred from the separate downloadable CSV rules.

Reproduce from the repository root, choosing a new output path:

```sh
python verification/nz-market-rent-2026-10-20/verify-original.py \
  verification/nz-market-rent-2026-10-20/original \
  /tmp/market-rent-independent-replay.json
```

The script performs no network requests and refuses to overwrite evidence.
