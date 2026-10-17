# Reproducing the NZ electricity-price repair

Read [CONTRACT.md](CONTRACT.md) for the pre-implementation meaning, selections and acceptance criteria. [specimen.json](specimen.json) records collection time, URLs, original-response hashes, retained-file hashes, attribution and comparison limitations.

The original all-node CSV had 11,808 observations. `source-selected.csv` retains all 48 periods for only the five existing Morning Rows nodes: 240 aggregate prices. Original publisher columns and decimal strings are preserved. `report-selected.csv` retains the corresponding 240 table cells and explicit price statuses independently extracted from the five official CLA3WR HTML reports. They are verification specimens, never production fallback values. Both are CC BY 4.0; **www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)**.

Run from the repository root:

```sh
python scripts/verify-nz-prices.py
node --test test/nz-prices.test.js
npm run build
```

The Python replay uses only the standard library, decimal comparisons and its own CSV/HTML extraction. It does not import the production JavaScript reader. Expected: all 240 pairs match, with final-period prices OTA2201 101.38, HAY2201 86.58, ISL2201 83.17, BEN2201 78.81, INV2201 77.17 NZD/MWh; all are **interim**, dated 16 October 2026, period 48. There is no sum/average across nodes; no rounding tolerance is applied because both presentations publish the same two-decimal price. The reader accepts up to two fractional digits and fails rather than rounding an unexpected finer precision.

To compare fresh copies of the same published vintage where still available:

```sh
mkdir -p /tmp/morning-rows-price-check
curl -fSL 'https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/20261016_FinalEnergyPrices_I.csv' -o /tmp/morning-rows-price-check/source.csv
for code in OTA2201 HAY2201 ISL2201 BEN2201 INV2201; do
  curl -fSL "https://www.emi.ea.govt.nz/Wholesale/Reports/CLA3WR?DateFrom=20261016&DateTo=20261016&POC=$code" -o "/tmp/morning-rows-price-check/report-$code.html"
done
python scripts/verify-nz-prices.py --source /tmp/morning-rows-price-check/source.csv --report-dir /tmp/morning-rows-price-check
```

The workspace proxy refused the bulk CSV; an authenticated Cloudflare remote preview fetched it successfully. The report pages worked directly. Use the documented preview procedure in `scripts/remote-check.mjs` if the local network blocks the source. Credentials belong only in the established Wrangler configuration, not these specimens. This interim file may be removed when finalised; a later report may contain revised/final data. A changed future vintage is not evidence that this dated comparison failed. Offline retained specimens remain reproducible.

## Independence and limits

All 240 values and all status labels match a separately presented official report, using an extraction independent of the production parser. However, both presentations originate from the Electricity Authority pricing system. This does **not** independently verify dispatch inputs or rerun the market pricing calculation. An attempted read of the original pricing-manager interim archive timed out from the workspace and Cloudflare, so no further raw-manager corroboration is claimed. The official directory provides modification dates, not an exact per-observation release timestamp; the reader exposes the actual file, interim/final status and selected-date lag without inventing a publication time.

The price reader deliberately requires complete data for the five selected nodes only; it does not certify the other 241 nodes. Its day calculation is for the current post-November-2022 regime in Pacific/Auckland. It is not a historical pre-regime reader. Cached desk responses can briefly show an earlier valid read; a failed latest request never causes the reader to select an older release. Upstream changes can make the section unavailable while other successful sources remain visible.

The initial preview caught EMI's scripts appearing after `</html>`. The directory check now accepts that observed layout while still requiring the document terminator; a regression test retains the case. The original positional reader's prior-day fallback test has been replaced with tests of published-release discovery and explicit failure rather than retained as an incorrect expectation.

## Production replay

Run the existing public smoke suite with every retained contract gate:

```sh
EXPECTED_REVISION=a9bc9e06d083b5fb2211d045a3fc06dc80f72672 CHECK_NZ_PRICES=1 CHECK_OPEN_ADDITIONS=1 CHECK_ASSEMBLY_ADDITION=1 CHECK_PHARMACY_ADDITION=1 CHECK_TRANSPORT_ADDITIONS=1 CHECK_FISCAL_ADDITIONS=1 REPORT_PATH=/tmp/morning-rows-price-check/apex-smoke.json npm run smoke
SITE_URL=https://www.morningrows.com EXPECTED_REVISION=a9bc9e06d083b5fb2211d045a3fc06dc80f72672 CHECK_NZ_PRICES=1 CHECK_OPEN_ADDITIONS=1 CHECK_ASSEMBLY_ADDITION=1 CHECK_PHARMACY_ADDITION=1 CHECK_TRANSPORT_ADDITIONS=1 CHECK_FISCAL_ADDITIONS=1 REPORT_PATH=/tmp/morning-rows-price-check/www-smoke.json npm run smoke
```

Create the report directory first if replaying these separately from the specimen download commands. On a later deployed release, set `EXPECTED_REVISION` to that verified release; the smoke check deliberately refuses to certify a mismatched version. The dynamic price gate checks semantics and coverage without freezing future prices to this historical specimen.

Production acceptance on 17 October 2026: both domains match clean source `a9bc9e0` / Worker `4c7e5234-469a-415e-8b5c-a233e7987ab9`; 15 apex and 14 www checks passed. Full NZ preview and public responses contain all five described prices and 23 valid Stats NZ rows. All eight desks and established core/addition contracts passed. A transient Australian grid timeout recovered on a fresh read; the initial failure and successful recheck are retained in [release evidence](../release-a9bc9e0.json). The HTML view also shows the explicit interim status and verified attribution. No unresolved unexpected regression remains.
