# Official-source discovery passes

## Pass 2026-10-17-03 — requested no-key additions, released

This is a targeted continuation of the requested sources, not a completed empty discovery pass. Cloudflare authentication was restored and source `e7d364c` was deployed as Worker `85da384d-4ab4-491a-a0d4-7d4d35c6cbb9` on both production domains.

| Desk | Source and terms | Result |
| --- | --- | --- |
| Australia | [NSW RFS RSS](https://www.rfs.nsw.gov.au/feeds/majorIncidents.xml), [feed terms](https://www.rfs.nsw.gov.au/news-and-media/stay-up-to-date/feeds) | Added `rfs_incidents`: whole-feed incident counts by alert level and type, with original publication time, CC BY 4.0 and requested attribution. No incident names, addresses or contacts. Coverage explicitly includes neighbouring ACT. Snapshot checked: nine incidents, published 16 October 2026 08:15:40 UTC; delayed flag retained rather than describing this as live warnings. |
| England | [DfE EES API](https://api.education.gov.uk/statistics/docs/getting-started/), [publication](https://explore-education-statistics.service.gov.uk/find-statistics/pupil-absence-in-schools-in-england), OGL v3.0 | Added `pupil_absence`: resolves the published persistent/severe absence dataset, selects England `E92000001`, total school types and latest academic year, pins metadata and query to the same version. Five measures: total enrolments, persistent count/percentage, severe count/percentage. Exact dimensions and complete result coverage required. Suppressed or unavailable values remain null with publisher symbols. Current validated year: 2024/25. |
| Scotland | [SEPA documented last-value query](https://timeseriesdoc.sepa.org.uk/api-documentation/api-endpoint-examples/time-series-data-queries/), [access and OGL terms](https://timeseriesdoc.sepa.org.uk/api-documentation/before-you-start/what-controls-there-are-on-access/) | Added `river_level`: anonymous single latest observation at Galashiels, series `61573010`, station `9683`. Exact station, metre units, timestamp and publisher quality code retained. Validated 0.185 metres at 17 October 05:00 UTC. Shared anonymous quotas can fail; registered access is recommended by SEPA for web products, but not required for this permitted anonymous request. No registration, identity rotation or quota bypass. |
| United Kingdom | [DBT API](https://data.api.trade.gov.uk/), latest quota metadata and its advertised report | Catalogue/metadata respond and state OGL v3.0. The latest report resolves to `v1.0.994` but the CSV returns HTTP 404 `NoSuchKey`. Documented filtered requests return headers without observations. Logged this specific report as blocked, not the whole API; no empty trade observations added. |

The RFS fire-danger XML was also inspected. It labels periods only as “today”/“tomorrow” without a publication timestamp in the body; it was not promoted into dated observations. Existing keyed candidates remain uncalled. Existing working integrations are untouched; adding these sources does not resolve ABS/ONS or legislation restrictions.

Validation: 41 deterministic tests passed, including suppression versus zero, incomplete/duplicate rows, exact geography and dates, malformed RSS, delayed snapshots, and source failure isolation. Wrangler dry-run passed. A local workerd harness executed all three actual readers against official endpoints using curl through the inherited proxy, with all three returning HTTP 200 and the expected data; RFS correctly retained its delayed status. Subsequent remote-dev proxy transport failed, but production verification passed: all 15 smoke checks with `CHECK_OPEN_ADDITIONS=1`, plus content checks on all eight desks on both domains. All three additions return the expected observations; SEPA advanced to 06:00 UTC, while RFS correctly remains delayed. Stats NZ, AIHW, Wales and NISRA baseline contracts remain valid. See [release evidence](verification/release-e7d364c.json). No secret writes or repository pushes were performed.

## Pass 2026-10-17-01 — released and production-verified

Baseline: `2cb3ffd457c6eae7e5b5310049217f9d71b45ab2`. Checked 17 October 2026. Each publisher below was absent from the corresponding desk and log when this pass began. Counts describe distinct integrations or log entries, not individual observations.

| Desk | Candidate and evidence | Outcome |
| --- | --- | --- |
| Australia | [AFSA quarterly insolvencies](https://www.afsa.gov.au/about-us/statistics-and-insights/headline-statistics/quarterly-personal-insolvency-statistics) | Discovery page returned HTTP 503 from this workspace. Added one narrowly scoped blocked entry; no claim that the underlying CSV is unavailable. |
| New Zealand | [Auckland Transport developer portal](https://dev-portal.at.govt.nz/) | Official registration/subscription-key requirement. Added one key entry; no registration or keyed API call. |
| Canada | [Health Canada consumer-product RSS](https://recalls-rappels.canada.ca/en/feed/consumer-products-alerts-recalls), linked by the official [RSS directory](https://recalls-rappels.canada.ca/en/rss-feeds) | Added `recalls`, containing up to eight titles, official links and original publication timestamps. Three current notices in the preview check; latest 16 October 2026. |
| United Kingdom | [Food Standards Agency authorities API](https://api.ratings.food.gov.uk/Authorities) and [HMRC Trade Tariff API Developer Hub](https://hub.trade-tariff.service.gov.uk/) | Added UK aggregate `food_establishments`. Logged Hub-managed API subscriptions as key-required; this is not a claim that every UK tariff dataset needs a key. |
| England | [FSA authorities API](https://api.ratings.food.gov.uk/Authorities) | Added England-only aggregation using the nine explicitly listed English regions. Unknown regions, duplicate authorities and incomplete pagination fail rather than become totals. |
| Scotland | [FSA authorities API](https://api.ratings.food.gov.uk/Authorities); [Scottish Parliament open data](https://data.parliament.scot/) endpoints `/api/bills`, `/api/billstages`, `/api/billstagetypes` | Added Scotland-only food counts and `bill_stages`, joining exact bill/stage identifiers. Latest eight dated events on or before today; latest preview event 9 September 2026. No sponsor/person records. |
| Wales | [FSA authorities API](https://api.ratings.food.gov.uk/Authorities); [Natural Resources Wales API portal](https://api-portal.naturalresources.wales/) | Added Wales-only food counts. NRW requires a subscription key: logged, not called. |
| Northern Ireland | [FSA authorities API](https://api.ratings.food.gov.uk/Authorities); [NISRA portal guide](https://data.nisra.gov.uk/guide.html) | Added Northern Ireland-only food counts. NISRA portal and public configuration responded, but no individual series was validated in this batch; queued for the next pass. |

Prepared additions: **3 distinct feed integrations across 7 desk sections, 3 key-required entries, 1 blocked discovery-page entry.** Recovery diagnosis separately adds 2 existing-publisher block entries (ABS and ONS from Workers); these are not discovery wins. Stats NZ moves from `needs_a_key` to `configured`.

### Terms, geography and time

- **FSA:** [API help](https://api.ratings.food.gov.uk/help) permits access without signup, using version header `2`; [terms](https://ratings.food.gov.uk/terms-and-conditions) specify the Open Government Licence. The response preserves source, licence and attribution, snapshot extraction time, each authority's publication time and aggregate publication range. The UK preview contained 363 authorities and 614,349 listed establishments. These are service entries, not inspection outcomes or all operating businesses. Different FHRS/FHIS schemes are not treated as comparable ratings. No contacts, addresses or individual establishment records are returned.
- **Scottish Parliament:** [copyright licence](https://www.parliament.scot/about/copyright) permits republication with the included attribution. Bill titles and stage dates are legislative facts; future/undated stages are excluded. No implication that a dated stage means enactment.
- **Health Canada:** the official [open-data catalogue entry](https://open.canada.ca/data/en/dataset/d38de914-c94c-429b-8ab1-8776c31643e3) specifies the Open Government Licence – Canada. The RSS feed has no explicit timezone on its publication timestamps; they are preserved without appending a fabricated UTC offset. The feed is a current subset, not an exhaustive recall history.

All three readers returned usable data in an authenticated Cloudflare remote preview and in the production release. Deterministic tests cover malformed/truncated responses, country boundaries, duplicate authority records, missing bill joins, future dates, RSS entities, official link restrictions and removal of nonessential fields. Preview checks do not establish production deployment.

### Next pass and release gate

This pass is **not empty** and does not satisfy the repository's stopping condition. The batch was released through Wrangler as source `29a2d4e`, Worker `9de05f20-66c4-48d9-ae39-52e14fbbc5c4`; production content verification passed. Workers Builds commands still cannot be inspected with the current OAuth scope (HTTP 403), so main-branch pushes remain on hold. No claim of completed continuous discovery is made.

Pass `2026-10-17-02` has started below, again covering all eight desks. Start with the new-publisher queue below, inspect official terms and concrete endpoints, and log every outcome. Do not retest the same successful publisher to manufacture an empty pass.

- Australia: ABS-independent official aggregate environmental or economic publishers; AFSA direct dataset link only if officially published.
- New Zealand: Ministry for the Environment open aggregate datasets.
- Canada: Elections Canada aggregate turnout/results, without voter or candidate-person records.
- UK-wide: [Department for Business and Trade data API](https://data.api.trade.gov.uk/) and its official [API catalogue](https://www.api.gov.uk/dbt/uk-global-tariff-commodities/); distinguish this from the keyed HMRC Hub.
- England: Department for Education aggregate statistics API.
- Scotland: SEPA official hydrometric observations.
- Wales: Senedd official legislative data, without member-person records.
- Northern Ireland: [NISRA Data Portal](https://data.nisra.gov.uk/), using its published PxStat endpoints and explicit aggregate dimensions.

These are research candidates, not assertions of eligibility or working feeds. Continue until a complete eight-desk pass adds zero open feeds, zero key entries and zero blocked entries. Category pages remain deferred.

## Pass 2026-10-17-02 — recovery additions and discovery in progress

Baseline: `540a3f749330226db7a3a7b3a98c4e906be618c1`. This is **not a completed eight-desk pass** and cannot satisfy the empty-pass stopping condition.

| Desk | Work and evidence | Current outcome |
| --- | --- | --- |
| Australia | [AIHW MyHospitals API](https://www.aihw.gov.au/hospitals/other-resources/myhospitals-api), documented measure `MYH0010` and state reporting-unit type `S` | Replaced the unverified embedded hospital table with a request-time API read. All 40 state/triage cells match the original 2024–25 table; upload date confirmed as 19 August 2026. Current [licence](https://www.aihw.gov.au/copyright) is CC BY 4.0. The API requires an explicit JSON Accept header in Workers. Preview verified all eight jurisdictions. |
| New Zealand | [MfE Data Service](https://data.mfe.govt.nz/) | Official portal responds, but its JavaScript shell does not establish a working no-key dataset endpoint or authentication terms. Research remains open; no false key-required entry added. |
| Canada | [Elections Canada 2025 summary tables](https://www.elections.ca/content.aspx?dir=rep%2Foff%2F45gedata&document=summary&lang=e&section=res) | Official page exposes aggregate turnout CSVs, including `/res/rep/off/ovrGE45/62/data_donnees/table_tableau03.csv`. Parser and reuse-terms verification remain queued; no candidate/voter records will be used. |
| United Kingdom | [DBT public data API](https://data.api.trade.gov.uk/) | Documentation responds and publishes a dataset-list API. No individual measure validated yet. Separately, legislation Atom readers now retain titles, identifiers, feed timestamps and scope; the documented feed still returns HTTP 404 from Workers and is logged explicitly. |
| England | [DfE statistics API documentation](https://api.education.gov.uk/statistics/docs/) | Documentation and getting-started page respond. Concrete series selection and geography/licence validation remain queued. The earlier guessed `/api-documentation` page is not recorded as a blocked data feed. |
| Scotland | [SEPA time-series API](https://timeseriesdoc.sepa.org.uk/) | Official documentation confirms anonymous access and OGL, with a shared anonymous quota limitation. A small metadata query responds; a current station observation has not yet been selected. Do not register or rotate identities to evade its quota. |
| Wales | Existing StatsWales projection reader audited against [dataset metadata](https://api.stats.gov.wales/v2/20b6276b-92f7-48fd-806e-69c35b54d9e0) and [API docs](https://api.stats.gov.wales/docs/) | Fixed first-row/pagination selection. The JSON API defaults to 100 rows; the documented full CSV returns 8,346 rows in about 534 KB. A bounded complete read selects exactly all ages, persons, Wales, current-calendar-year projection. Preview: mid-2026, 3,195,431 people, 2024-based projection. Senedd discovery remains unresolved after a website request returned 403; no data endpoint was established. |
| Northern Ireland | [NISRA Childhood BMI JSON-stat](https://ws-data.nisra.gov.uk/public/api.restful/PxStat.Data.Cube_API.ReadDataset/CHILDBMILGD/JSON-stat/2.0/en) | Added four national all-persons aggregate measures, latest academic year 2024/25. Exact dimensions select Northern Ireland (`N92000002`), not a district or individual. Preview values: 6.3%, 23.2%, 6.0%, 26.5%. [NISRA terms](https://www.nisra.gov.uk/crown-copyright) permit reuse under OGL; attribution and methodology caveats included. No contacts or individual health records are published. |

Added in this batch: two official API integrations (AIHW replaces a static table; NISRA is new), one existing projection repair, and one runtime-specific legislation block entry. HTTP error wrapping now preserves the original status code. The remaining candidate validations above must be finished before counting this pass as complete.

The implemented portions of pass 02 are now live in release `29a2d4e`. Production checks confirm AIHW, Wales and NISRA data; legislation remains an explicit 404. Further source discovery continues from the unvalidated candidates in this table.
