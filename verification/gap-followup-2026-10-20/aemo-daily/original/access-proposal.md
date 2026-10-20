# AEMO daily public-price route — prerelease research proposal

This changes acquisition only for the held SA1/VIC1 completed-calendar-day
contract. It is not authorization to activate the reader or to retry the refused
monthly CSVs. No new AEMO data request was made during this review.

The [official NEMWeb interface](https://web.nemweb.com.au/) is linked from AEMO's
own [NEMWeb page](https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/market-data-nemweb).
Its public-current directory exposed the price-report family in the retained
original acquisition. Exact already-acquired official URLs:

1. `https://nemweb.com.au/Reports/CURRENT/Public_Prices/`
2. `https://nemweb.com.au/Reports/CURRENT/Public_Prices/PUBLIC_PRICES_202610180000_20261019040502.zip`
3. `https://nemweb.com.au/Reports/CURRENT/Public_Prices/PUBLIC_PRICES_202610190000_20261020040503.zip`

The original index was retrieved20October2026at09:17:23.587492Z,16059bytes,
SHA256`c817aa790c76c20235c715aeb9a5af175d09279169fa7a87e3ec919c32bf707d`.
It is described by source name`Public_Prices-index` in
`verification/gap-pass-2026-10-20/aemo/original/acquisition.json`.
The ZIP source names are`Public_Prices-18` and`Public_Prices`, respectively.

| Bundle | Compressed bytes / SHA256 | Selected CSV bytes / SHA256 |
| --- | --- | --- |
|18October trading day|254309 / `d4f41531f9d1deb496270c02bdf2542cba9ea65443d4cf0167d9b9a43aece03f`|1109187 / `2a3ae73d5cc6673769fcab5267aad9827330070ecc6f2ec334045c56676c0bd8`|
|19October trading day|260373 / `f67a8dd7b89f1c94544aa23192f7f29896926a2ba541c098e6a5e30fe57729b9`|1118267 / `633d8fad4d671deb268cec3dc4648f09b2de67c6e9c82851417d171712b206b0`|

The retained `public-prices-DREGION-2026-10-19.csv` is a documented minimal
transformation, not the full wire ZIP. Its SHA256 is
`765690fa175c228bf5af1e54e9190215bce408801c4dcc37b250075be82c2cfc`.
The existing independent verifier matched all576 SA1/VIC1 values to the monthly
presentation within0.005AUD/MWh. The daily values have greater decimal precision;
the two presentations share market lineage.

## Required gates before an acquisition amendment

- Actual protected Worker GETs of the exact advertised ZIP resources must succeed
  with original identity and unchanged truthful request headers. Only the two
  named files are needed for a fixed-specimen access/resource probe; this does
  not prove dynamic discovery or ongoing availability.
- Discovery for future targets must validate the exact public index, date,
  filename and appropriate version. Do not invent publication suffixes, use
  arbitrary URL parameters, silently choose an old file, or crawl an archive.
- Bound compressed streams, ZIP member count/names, expansion, UTF-8 and CSV rows
  before parsing. Only the one named CSV per archive is relevant; no nested ZIP
  expansion, macros, scripts or external references. Demonstrate real Worker
  CPU/memory within the established release budgets.
- Reconstruct exactly288 unique contiguous interval-ending times from00:05 to
  following00:00 in fixedUTC+10 for each requested region, combining the necessary
  portions of two trading-day bundles. No moving24hours, forecast, DST conversion
  or older completed day is interchangeable.
- DREGION versions, run/intervention semantics, duplicate/revision handling and
  supported flags need an explicit contract. The observed reference uses run1,
  intervention0; the daily source has no FIRM field. Never invent finality.
- To preserve the existing monthly-rounded contract, define and validate exact
  decimal per-interval cent rounding **before** negative/zero counts and summary
  derivation. Merely rounding the final mean is not equivalent. If the source
  precision instead changes, treat it as a semantic amendment with new evidence.
- Both bundles were published around04:05AEST. The latest fully elapsed calendar
  day may not be available at00:00AEST; retain explicit unavailability until all
  required cells exist. Do not infer a guaranteed schedule from two filenames or
  serve an older day. Preserve real midnight-crossing/cache invalidation checks.
- Independently reconcile the exact newly captured576cells, derive all10summary
  outputs and test wrong region, missing/duplicate/latest intervals, flags,
  revised prices, zero/suppression and partial sibling failures. Then apply the
  standard exact-version/full-desk/both-domain release process.

Existing reuse/attribution evidence applies only within its actual scope. No
new credential, hosted dataset, infrastructure, alerts, schedule or monitoring
checkpoint follows from this research. The existing five-region`grid` snapshot
stays separate.
