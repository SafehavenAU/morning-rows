# homes original evidence — 20 October 2026

Scope: existing Canada source `homes`, exact coordinate `1.1.1.0.0.0.0.0.0.0` in product `34100136`; vector `15817836`. The contract was written before runtime implementation. No reader or release is approved by this evidence directory alone.

The selected 2026-Q3 value is **57947 dwellings**. Python extraction independently reconciles the original WDS response, minimal one-row CSV, series metadata, cube dimensions and official table presentation. `54` checks pass; all one selected cells are compared. Publisher release `2026-10-19T08:30` has no supplied timezone. Exact retrieval timestamps and SHA-256/byte counts are in `acquisition.json`; independent verification time is in `independent-report.json`.

Run offline from the repository root:

```sh
python verification/gap-pass-2026-10-20/statcan/homes/verify-retained.py
```

The verifier uses Python's CSV, JSON and HTML parsers, not the application reader or site output. `selected-config.json` records the pre-code dimensions, labels, geography classifications, UOM/scalar/frequency and flag rules. `original/selected-series.csv` is a minimal exact official download; `original/selected-table-valid.html` is the successful selected table page. Its embedded presentation model supplies the actual displayed row and column labels. The first `selected-table.html` is a retained error page caused by an invalid single reference-period parameter; its HTTP 200 is **not** passing data evidence. The corrected request uses paired reference-period endpoints, recorded separately without overwriting the failed original.

To obtain a separate future specimen without changing these originals:

```sh
python verification/gap-pass-2026-10-20/statcan/homes/acquire-originals.py /tmp/statcan-homes-new-wds
python verification/gap-pass-2026-10-20/statcan/homes/acquire-presentations.py /tmp/statcan-homes-new-presentations
```

These are public no-auth requests. Acquisition scripts never use a credential or query Morning Rows. A future specimen requires a new dated comparison; do not relabel the current record.

Coverage is housing starts in Canadian centres of 10,000 population and over. The official table labels the value Q3 2026; the legacy July alias is a quarter start, not monthly July. Seasonal adjustment is unspecified by the selected metadata. The official table viewer is a separate presentation but shares the same service/statistical lineage; no separate dated CMHC publication was compared.

The cube explicitly invokes CMHC terms. The linked CMHC host returned 403, retained in the manifest; the official Statistics Canada copy of the CMHC agreement succeeded and is preserved in `original/cmhc-licence-statcan.html`. It permits publication/reproduction subject to accurate source/adaptation notices, no endorsement, and recipients agreeing to the same terms. The agreement states use constitutes agreement and prescribes no click-through. The exact templates and downstream obligation are in `selected-config.json`; an actual recipient agreement has not been observed. A solely StatCan licence label is insufficient for these data.

All outputs share original publisher statistical lineage. Independent extraction and separate presentation reduce reader/selection risk; they do not establish an independent statistical measurement. Original publisher errors or later revisions remain possible. No actual runtime, CPU, deployment, monitoring or scheduled-window result is claimed here.

Five independent negative controls pass in `negative-controls.json`. They change the CSV geography/value/period/row count or the selected metadata geography, update acquisition hashes for the changed temporary fixture, and confirm rejection by semantic checks. Thus the controls do not merely test a hash mismatch. Run `python verification/gap-pass-2026-10-20/statcan/homes/test-independent-extraction.py` to reproduce them.
