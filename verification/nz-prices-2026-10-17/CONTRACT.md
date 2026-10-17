# NZ electricity prices: contract and acceptance criteria

Defined 17 October 2026 before implementation. Bounded repair of the existing five-node `prices` section. Prior production: source `605d1dd32d09357caef72cd50e384d0639105f9a`, Worker `8120bd02-5bda-469f-b63b-2307fe294f52`. The previous reader used positional columns, `Number('')`, and independent per-node maxima, allowing plausible zeroes or mixed/incomplete periods. It omitted source, units, licence and interim/final status. This active correctness exposure takes priority over the unfinished new-source queue.

## Meaning and scope

- Measure: wholesale nodal energy price for the final half-hour trading period of the latest published, completed New Zealand trading day. Under the post-1 November 2022 regime, interim prices are time-weighted averages of dispatch prices within the trading period; final status is determined by the pricing manager. These are not household tariffs, daily averages or a national price.
- Population/geography: exactly OTA2201 (Otahuhu), HAY2201 (Haywards), ISL2201 (Islington), BEN2201 (Benmore), INV2201 (Invercargill), each a point of connection in New Zealand. No population weighting or averaging across nodes.
- Unit: NZD per megawatt hour. Preserve the published decimal amount without additional rounding or adjustment; negative and numeric zero are valid.
- Time: trading date and sequential 30-minute period in `Pacific/Auckland`. A complete day has 46, 48 or 50 periods across daylight-saving transitions. Publish the final period with explicit UTC start/end and local-zone identification. Current incomplete local day is ineligible.
- Publication/revision: daily files; `_I.csv` is interim, `.csv` without `_I` is final. The official directory says interim prices normally become final by 2pm the following business day if no pricing-error claims are lodged. Do not infer finality from age. Select the newest eligible date listed, preferring the final file when both statuses are listed for that same date. Re-read the selected public release on cache expiry; revisions replace observations rather than becoming a new measure.
- Currency: report the selected file/date, latest completed local date and lag in calendar days. Never call it real-time. A dated release with publication lag is explicit, not silently substituted. Do not fall back to an older file when the selected listed file fails or is invalid.
- Reuse: CC BY 4.0, Electricity Authority EMI legal information; attribute `www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)`. The dataset is public aggregate price data; no confidential or individual records.
- Missing/unavailable/suppressed: blanks and nonnumeric markers are not zero. No suppression codebook is established for this file; unknown markers therefore fail validation. Any missing/duplicate required node-period, invalid date, mismatched unit header or non-finite price makes this section unavailable while other desk sources remain available.

## Exact mapping and transformations

Source directory: https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices

Original CSV columns: `TradingDate`, `TradingPeriod`, `PointOfConnection`, `DollarsPerMegawattHour`. Require precisely these unique columns; use names so harmless reordering cannot swap meanings. Require every record date to equal the selected filename date and every period to be valid for that day. For each of the five nodes require exactly one row for every period 1..N; then select period N. `TradingDate` -> `date`; `TradingPeriod` -> `period`; `PointOfConnection` -> `code`; `DollarsPerMegawattHour` -> `price`. Preserve the existing array and numeric field names for clients, adding descriptive metadata per row. Names are display labels, not geographic aggregates. There are no additive component totals: adding nodal prices would be meaningless.

## Acceptance

1. Original publisher CSV specimen yields exactly five rows for one date, one period and one release status. On 17 October the directory lists 16 October 2026 interim as latest completed day; period 48 runs 10:30–11:00 UTC (23:30–00:00 NZDT).
2. All five selected values match the original CSV exactly. Attempt separate official report/raw-pricing-manager corroboration; record which comparison is independent of our parser, which shares upstream lineage, and any unavailable cross-check. Do not claim independent economic validation from two parsers of the same file.
3. Tests reject blank/marker/non-finite values, missing latest or interior periods, duplicate records, mismatched dates, changed headers and failed newest releases. Genuine zero/negative values, quoted/reordered columns, final-over-interim preference, NZ local midnight and both DST transitions behave correctly.
4. Bounded network reads; selected-file failures do not trigger an older-release fallback. Cloudflare preview validates the real reader and complete NZ desk, including Stats NZ. Existing successful sources survive a simulated price failure.
5. Production on both domains has matching clean release identity; catalogue still lists eight desks; all existing source-status and Stats NZ/AIHW/Wales/NISRA contracts pass against the prior baseline. Annual/monthly unchanged values do not become stale alerts.

## Publisher references

- Dataset definition and finalisation: source directory above.
- Licence: https://www.emi.ea.govt.nz/LegalInformation
- Trading-period clock convention: https://forum.emi.ea.govt.nz/thread/daylight-saving-time-and-trading-periods/
- General dataset documentation: https://www.emi.ea.govt.nz/Content/About_datasets.pdf
- Separately presented single-node report linked by the directory: https://emi.ea.govt.nz/Wholesale/Reports/CLA3WR
