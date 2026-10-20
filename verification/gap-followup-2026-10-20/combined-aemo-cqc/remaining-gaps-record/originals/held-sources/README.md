# Final bounded ONS/AER held-contract review — 20 October 2026

Both existing contracts remain held. This read-only pass found no qualifying new original-publisher transport or specimen. It made seven indexed queries and read ordinary AEMO legal pages, without retrying the previously refused ONS/AER routes. It made no implementation, release, operations, credential, monitoring or delivery changes.

## ONS Manchester bedroom rents

The retained exact August 2026 specimen already reconciles four bedroom-category values: **£1,003 / £1,233 / £1,433 / £2,014 per month**. These are Manchester E08000003 average private rents across property types, NSA, in the 16 September publication. They are not asking rents or the joint two-bedroom-flat measure. The official workbook, JSON and [Manchester presentation](https://www.ons.gov.uk/visualisations/housingpriceslocal/E08000003/) share ONS estimation lineage.

The unresolved gate is actual reader access: the protected Cloudflare attempt starting **2026-10-20T10:12:10.337Z** returned **HTTP 429** from `www.ons.gov.uk`. Its failure remains retained. The reader requests the public JSON and separate publication index concurrently; the aggregate failure identifies the host, not the exact failed URL. Earlier workspace JSON HTTP 200 does not establish protected Worker access. The same known presentation appearing in search with extraneous query parameters is not a new permitted route.

Resume only with genuinely new permitted usable publisher access evidence for the existing contract, then validate the actual reader and resource gates. A new monthly publication cannot certify this fixed specimen. This pass adds no new numerical comparison or acceptance.

## AER quarterly regional spot prices

The [known chart](https://www.aer.gov.au/industry/registers/charts/quarterly-volume-weighted-average-spot-prices-regions), AER reference 11048184, is quarterly demand/volume-weighted NEM spot prices in AUD/MWh, with AER/AEMO source attribution. The exact advertised CSV is retained in `findings.json`. Its earlier original request returned **HTTP 503**, 85 bytes, SHA-256 `e482a48fef03d183029fa2edf995fc8e9ce023f18649fd1d9149958e977068a1`. That route was not retried.

The indexed [wholesale charts page](https://www.aer.gov.au/industry/wholesale/charts) exposes Q2 2026 rounded headlines for only Victoria ($60), South Australia ($95) and NSW ($78). This does not supply an exact five-region CSV reconciliation. A Q2 2025 report containing 2026 futures discussion is a different vintage and measure, and was rejected without download. No numbers were inferred from the CSV filename, no missing regions were filled, and AEMO daily equal-interval means were not substituted for quarterly demand weighting.

The [AER policy](https://www.aer.gov.au/about/policies/disclaimer-copyright) retains third-party exceptions. The [AEMO copyright permission](https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions) permits accurately attributed public AEMO-created material subject to exclusions. The latter policy was already retained in the repository; its browser confirmation is not new selected-CSV evidence. Original CSV provenance and any applicable exclusions, attribution and policy currency conditions still need to be bound to the exact accepted source. Nothing here grants blanket rights over ASX, Argus or other third-party series.

Resume only with usable ordinary original CSV access, exact five-region quarterly comparison and the applicable AER/AEMO permission record. There is no reason for an implementation change from this evidence.

## Record boundary

`reviewed-boundary.json` binds the prior files examined. `search-log.json` records the queries and rejected candidate routes. These are manually recorded search/browser findings, not original publisher HTTP bodies; they contain no invented wire hashes or acquisition timestamps. `findings.json` records exact remaining conditions. The artifact manifest covers this review only.

PHW's exclusion, parked UK CPI and the selected NZ 17 October Interim-price evidence gap remain unchanged. No routine retry loop or general future-vintage approval is authorized by this review.
