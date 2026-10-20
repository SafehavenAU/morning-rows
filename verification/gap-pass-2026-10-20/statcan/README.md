# Existing Canada headlines: original evidence and reader repair

This bundle closes the local verification and implementation work for the four
existing StatCan headline readers. It does not establish preview, deployment,
both-domain or scheduled-operation acceptance. The [pre-code contract](CONTRACT.md)
and each source's detailed contract define the exact scope.

The jobs defect is reproduced directly from retained original WDS bytes: the
publisher responds in coordinate order 1, 10, 11, 2, …, 9, while the old reader
assigned names by array position. All ten provincial labels received another
province's rate. Canada was correctly labelled. The new reader joins data and
metadata by exact product, coordinate and vector, then emits the established
Canada/province display order. See [the offline before/after record](jobs/legacy-offline-reproduction.json)
and [independent comparisons](jobs/independent-report.json). This does not
implicate the separately verified GDP reader.

| Source | Exact retained values | Independent comparisons and boundary |
| --- | --- | --- |
| Jobs | Eleven September 2026 rates; Canada 6.5%, Newfoundland and Labrador 9.1%, Alberta 6.4% | All 11 match selected CSV and the dated 9 October Daily release; Canada also matches the selected HTML table. |
| CPI | September 2026 all-items index 170.0, 2002=100, not seasonally adjusted | Exact WDS/CSV/HTML and dated Daily-table agreement. This is an index, not an inflation rate. |
| Retail | July 2026 sales 73,696,547 thousand Canadian dollars, seasonally adjusted | Exact CSV/HTML agreement. Dated Daily's 73,697 million agrees within its 0.5 million rounding tolerance. The publication calls July preliminary although WDS reports symbol none; this qualification is retained. |
| Housing | 2026-Q3 starts 57,947 dwelling units in centres of 10,000 people and over | Exact CSV and separate official table-view agreement. No separate dated CMHC publication is claimed. Seasonal adjustment is unspecified in the selected metadata. CMHC licence notices and downstream terms apply. |

Each source directory retains original response bytes, request identities,
retrieval timestamps, hashes, selected dimensions and a Python verifier that
imports no runtime reader. The presentations share publisher statistical
lineage; this is independent extraction and presentation reconciliation, not an
independent survey. New releases require fresh independent verification.

The runtime keeps the existing native aliases and adds qualified observations,
complete period boundaries, definitions, exact selected identities, quality and
revision symbols, raw publisher releases with unknown timezone, and separate
acquisition provenance. It refuses missing or ambiguous coverage, identity and
metadata drift, invalid units/flags/periods, suppression, unsupported numeric
forms, future periods and definitely future unzoned release dates. Each source
uses three bounded public POSTs: data, series metadata and cube metadata. No
credential, fallback dataset or additional statistical series is introduced.

Reproduce local validation from the repository root:

```sh
python verification/gap-pass-2026-10-20/statcan/jobs/verify-retained.py
node --test test/statcan-headlines.test.js
node verification/gap-pass-2026-10-20/statcan/verify-readers.mjs
```

The other source READMEs give their independent Python verifier and negative
control commands. [Reader tests](reader-tests.tap) pass 237 cases, including
all eleven jobs-order permutations, missing/duplicate identities, point and
metadata failures, quality grades, CMHC notices, transport bounds and a
consistent future-release-only attack against actual/public validation.
[The reader-reference comparison](reader-reference-comparison.json) matches all
14 values to the independent references. The initial local comparison helper
used one too many parent-directory segments and failed before loading the
reader; its corrected relative imports are exercised by the passing command.
That path error changed no runtime behavior or publisher evidence.
