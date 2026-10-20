# ONS Manchester bedroom rent — bounded implementation contract

Written 20 October 2026 before runtime implementation. Status: implementation and actual Worker validation pending. This contract adds four definitions to the existing England desk; it does not authorize a release or alter monitoring.

## Exact observations

Geography is Manchester metropolitan district, `E08000003`, within North West `E12000002`, England `E92000001`. The measure is the ONS Price Index of Private Rents estimated average **monthly rent level**, GBP per month, not seasonally adjusted, publisher-rounded to £1. Population covers achieved private new and existing rents under PIPR methods. Local estimates are **three-month moving averages** and the levels use the publisher's imputed base-price/index methodology. These are not raw-month sample means, asking-only rents, available properties, affordability or individual-property valuations.

Exactly four latest-period measures:

| ID | Exact bedroom category | Publisher JSON field prefix | Initial workbook evidence |
| --- | --- | --- | --- |
| `bedroom_1` | One bedroom, across property types | `rental_price_one_bed_` | L34163 = 1003 |
| `bedroom_2` | Two bedrooms, across property types | `rental_price_two_bed_` | P34163 = 1233 |
| `bedroom_3` | Three bedrooms, across property types | `rental_price_three_bed_` | T34163 = 1433 |
| `bedroom_4_plus` | Four or more bedrooms, across property types | `rental_price_four_or_more_bed_` | X34163 = 2014 |

Initial evidence is August 2026, published 16 September 2026. It is pinned for release verification, not embedded as a runtime fallback. No arbitrary locations, historical API, property-type intersection, all-property measure, growth calculation or country-wide fan-out is included.

## Original acquisition and bounds

The official [Manchester presentation](https://www.ons.gov.uk/visualisations/housingpriceslocal/E08000003/) embeds an explicit public resource URL:

`https://www.ons.gov.uk/visualisations/housingpriceslocal/data/json/E08000003.json`

Use that official JSON resource, subject to successful direct transport verification, plus the [current dataset publication index](https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics). This avoids runtime expansion of the 18,640,156-byte XLSX and its 92,054,843-byte Table 1 XML. No unofficial proxy, stored dataset fallback, credentials, registration or new infrastructure.

At most two source requests; 1,048,576 decoded response bytes for JSON and 262,144 for the publication index. Read streams with hard byte limits, reject truncation/HTML outages, and preserve wire digests, bytes and retrieval clocks separately from publication dates. Reject redirected response identity outside the exact intended official URLs. No unbounded `response.json()` or workbook decompression.

## Falsifiable acceptance and failure rules

1. Require exact place, region and country identity; never accept similarly named places or a regional/national row.
2. Require one current Meta record with official Manchester title and a valid `lastUpdated` date. The separate dataset index's current published date and dated workbook link must match it. Do not use the JSON's legacy `releaseDate` field as the current publication clock.
3. Find the newest dated rental level field in the place object. All four bedroom fields must exist for that exact month, and the official `rent_price_third` narrative must identify the same month/geography and reconcile each bedroom value. Do not fall back to an older complete month.
4. Require four non-negative safe integer values. Missing, null, string, `[x]`, `[z]`, unknown suppression, partial coverage or conflicting values fail the whole bounded source without discarding unrelated desk sources. Such failures are not zeros. The observed JSON marker vocabulary is not established broadly enough to invent partial missing rows.
5. Preserve full definitions, methodology/OGL attribution, release date and month on output; no fake midnight publication timestamp or inferred latest-month-by-today rule. The regular two-month imputation/revision window applies to the UK aggregate, not this local series. Methodology revisions/rebasing may change historical levels; no finality claim.
6. Independent current verification must reconcile all four exact values against separately parsed original workbook cells and the separately extracted official page. Both share PIPR lineage; independent extraction is not independent estimation.
7. Negative controls must reject wrong geography, category/property substitution, stale publication or latest month, partial/duplicate narrative, conflicting value, units, missing-to-zero conversion, malformed publication metadata, oversized streams, HTTP failures and contaminated normalized output.
8. Node tests and bounds are insufficient for release. Require actual protected Worker source output and CPU/memory-safe completion under the existing release budgets, exact identity and independent numerical reconciliation. If that gate fails, retain an explicit resource/access blocker and do not include the reader.

The current JSON is an official presentation resource, not a documented stable API. Format drift must fail visibly. Unchanged observations remain valid until the publisher changes its actual release; no age-since-value-change staleness rule.
