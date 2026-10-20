# price_index original evidence — 20 October 2026

Scope: existing Canada source `price_index`, exact coordinate `2.2.0.0.0.0.0.0.0.0` in product `18100004`; vector `41690973`. The contract was written before runtime implementation. No reader or release is approved by this evidence directory alone.

The selected 2026-09 value is **170.0 index (2002=100)**. Python extraction independently reconciles the original WDS response, minimal one-row CSV, series metadata, cube dimensions and official table presentation. `59` checks pass; all one selected cells are compared. Publisher release `2026-10-19T08:30` has no supplied timezone. Exact retrieval timestamps and SHA-256/byte counts are in `acquisition.json`; independent verification time is in `independent-report.json`.

Run offline from the repository root:

```sh
python verification/gap-pass-2026-10-20/statcan/price_index/verify-retained.py
```

The verifier uses Python's CSV, JSON and HTML parsers, not the application reader or site output. `selected-config.json` records the pre-code dimensions, labels, geography classifications, UOM/scalar/frequency and flag rules. `original/selected-series.csv` is a minimal exact official download; `original/selected-table-valid.html` is the successful selected table page. Its embedded presentation model supplies the actual displayed row and column labels. The first `selected-table.html` is a retained error page caused by an invalid single reference-period parameter; its HTTP 200 is **not** passing data evidence. The corrected request uses paired reference-period endpoints, recorded separately without overwriting the failed original.

To obtain a separate future specimen without changing these originals:

```sh
python verification/gap-pass-2026-10-20/statcan/price_index/acquire-originals.py /tmp/statcan-price_index-new-wds
python verification/gap-pass-2026-10-20/statcan/price_index/acquire-presentations.py /tmp/statcan-price_index-new-presentations
```

These are public no-auth requests. Acquisition scripts never use a credential or query Morning Rows. A future specimen requires a new dated comparison; do not relabel the current record.

The independently edited 19 October Daily table 1 also presents exactly 170.0 for September 2026. All-items CPI is not a cost-of-living index; this bounded source supplies a level, not an inferred inflation rate. The official Statistics Canada Open Licence is retained as `original/statcan-licence.html`.

All outputs share original publisher statistical lineage. Independent extraction and separate presentation reduce reader/selection risk; they do not establish an independent statistical measurement. Original publisher errors or later revisions remain possible. No actual runtime, CPU, deployment, monitoring or scheduled-window result is claimed here.

Five independent negative controls pass in `negative-controls.json`. They change the CSV geography/value/period/row count or the selected metadata geography, update acquisition hashes for the changed temporary fixture, and confirm rejection by semantic checks. Thus the controls do not merely test a hash mismatch. Run `python verification/gap-pass-2026-10-20/statcan/price_index/test-independent-extraction.py` to reproduce them.
