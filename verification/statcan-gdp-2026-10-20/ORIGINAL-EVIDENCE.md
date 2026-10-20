# Frozen original-publisher evidence

These public aggregate specimens and the independent report were frozen before
implementing the guarded GDP reader. `independent-report.json` records six exact
level comparisons and separately reconciles ordinary and annualized growth.
The original sampled output is numerically correct; this is evidence for a
semantics and validation repair, not a demonstrated wrong current observation.

Run from the repository root without network or JavaScript reader imports:

```sh
python3 verification/statcan-gdp-2026-10-20/verify-retained.py verification/statcan-gdp-2026-10-20
```

`original-manifest.json` hashes the retained files. `acquisition.json` records
original request parameters, UTC acquisition intervals, byte counts and full
original response hashes. The three WDS JSON responses and the two-row CSV are
byte-identical originals. The selected public table JSON is a parsed exact
subset of its embedded `prepareTable` object; the Daily HTML excerpts retain
original table headers and the GDP row. These excerpts omit unrelated rows,
contacts and page chrome. They are not hashes of the full original pages.
The cube and code-set excerpts retain only relevant semantic metadata; the full
11.6 KB cube is also retained to exercise the exact runtime input shape.

`extract-originals.py` is the separate Python extraction/check program used on
the original acquired responses. To repeat acquisition into an isolated temporary
directory, run the three `acquire-*.py` programs in original/selected/presentation
order, each with that directory as its argument, then run
`extract-originals.py <directory>`. Acquisition is an explicit network operation,
not part of the offline verifier. Mutable WDS/current-table endpoints may now
represent another vintage: a future response does not replace or certify this
28 August 2026 specimen. The dated Daily release remains a separate presentation
with the same national-accounts statistical lineage, not an independent survey.

The first selected export request included overlapping hierarchy selections and
returned duplicated GDP rows. It is quarantined in the acquisition log and report;
only the corrected exact two-row CSV is retained as the acceptance specimen.
No silent deduplication occurred. No runtime, preview, release, sustained
monitoring or user-delivery acceptance follows from this report alone.

Source: Statistics Canada, table 36-10-0104-01 and The Daily, 28 August 2026.
Reproduced and adapted under the Statistics Canada Open Licence. Derived growth
is Morning Rows' calculation from the two reported rounded levels. Raw unzoned
publication timestamps are preserved without an invented UTC offset.
