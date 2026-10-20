# NZ market-rent benchmark verification contract

Written **20 October 2026**, before reader implementation. This is a bounded
addition to the existing New Zealand desk, following the rental-budget task
research in `research/rent-demand-2026-10-17/README.md`. It does not authorize
countrywide place discovery, historical inventory, property records, keys,
registration or new infrastructure.

## Question and exact scope

Answer: for one of the two named publisher localities, a published dwelling
category and a bedroom category, what are the recent six-month weekly-rent
quartiles and the separately defined active-bond count?

| Site-owned locality ID | Exact publisher city | Exact publisher suburb | Exact publisher area echo |
| --- | --- | --- | --- |
| `nz-auckland-avondale` | Auckland | Avondale | Auckland - Avondale |
| `nz-wellington-kelburn` | Wellington | Kelburn | Wellington - Kelburn |

These are site-owned identifiers, not official geography codes. The geography is
the publisher's New Zealand Address Dataset (NZAD) suburb, qualified by its city.
No stable official NZAD identifier or equivalence to territorial authorities,
SA2 boundaries or postal areas has been established. An exact publisher echo is
mandatory; a default location, city-only result or similarly named suburb fails.

The fixed dwelling labels are `Apartment`, `Boarding House`, `Flat`, `House` and
`Room`; their site slugs are `apartment`, `boarding-house`, `flat`, `house` and
`room`. The literal observed bedroom labels are `1 bedroom`, `2 bedrooms`,
`3 bedrooms`, `4 bedrooms`, and `5+ bedrooms`; site bedroom keys are `1`, `2`,
`3`, `4`, `5-plus`. The last is a category of five or more bedrooms, never an
exactly-five observation. Preserve publisher labels alongside site-owned keys.

Retain **every reported row** for the two localities, not only apartment examples.
Do not manufacture the full Cartesian product: an absent dwelling/bedroom tuple
means `not_reported`, with no assertion that the reason is suppression, zero,
no properties, or no bonds.

## Measures, population and time

- `lower_quartile`, `median`, `upper_quartile`: publisher-rounded **NZD per week**,
  descriptive and unadjusted. Lower/upper quartiles are the 25th/75th percentile
  of the publisher's ordered weekly rents; median is the middle value.
- `active_bonds`: a **count of bonds**, separate from the rent units. The
  methodology describes current bonds within the selected window, whereas its
  total-bonds summary includes all bonds lodged. The full-page tooltip also
  requires complete rent, dwelling, bedroom and address information. Preserve
  both qualifications; do not treat this count as the denominator for the rent
  quantiles, all lodged bonds, current rental listings, or all current tenancies.
- Underlying population: non-government properties with rental bonds lodged in
  the displayed six-month window. It excludes government-owned properties and
  is not a survey of advertised rents or every existing tenancy.
- The window is inclusive, starts on the first day of a month and ends on the
  final day of the sixth consecutive month. Preserve start and end explicitly;
  never label these as monthly rent observations or infer a release from today.
- Publication updates are monthly and deliberately omit the most recent month.
  Late lodgements can revise past results. Current bond-system migration means
  figures are provisional, incomplete or revisable and changes may have
  administrative rather than market causes.
- Publication time and an official revision identifier are not supplied by the
  selected payload. Keep those unknown; record retrieval time separately.
  A fresh retrieval of unchanged bytes is not a new publisher vintage.
- Acquisition must reject a window ending after the retrieval's UTC date.
  This prevents future observations without inventing a publication deadline,
  an age-since-change rule or a fixed two-month release lag. Offline parsing and
  retained-specimen validation remain independent of the observer's clock.

The initial acquired window is **2026-03-01 through 2026-08-31**, observed
2026-10-20T07:04:59–07:05:06 UTC. It agrees with the 17 October research;
the two current AJAX response hashes are byte-identical to those earlier
responses. Runtime must validate a newly returned complete six-month window
without hardcoding this period or the form's opaque hidden `period=42`.
Release acceptance remains pinned to independently verified evidence: a later
window or revised value requires a fresh official comparison.

Only nonnegative integer counts and publisher currency-formatted integer rents
were observed. No missing/suppression token vocabulary was established for this
website. Unrecognized numeric content or markers must fail validation rather
than be guessed, silently omitted or converted to zero. A literal numeric zero
must remain numeric zero if otherwise valid. Do not apply the download files'
base-three count rounding or suppression rules to the website table.

## Publisher acquisition and independence

Use one fixed no-key request per locality:

```
https://www.tenancy.govt.nz/market-rent-api/updateMarketValueLocation?ajax_city=Auckland&ajax_suburb=Avondale
https://www.tenancy.govt.nz/market-rent-api/updateMarketValueLocation?ajax_city=Wellington&ajax_suburb=Kelburn
```

The public website route uses `X-Requested-With: XMLHttpRequest`,
`Accept: application/json`, and the market-rent page as `Referer`. No cookie or
credential is needed. It currently serves JSON with `Finder` and `Table` under
a `text/html` content type; validate the actual JSON and complete `Table`, not
MIME alone. Do not substitute historical, CSV, TA, SA2 or keyed-API data after a
failure. Limit response size and timeout, and preserve other successful desk
sources on failure.

Independently request the original full page with explicit `location` and
`action_doSearchValues=Find Rent`, **omitting `period`**:

```
https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/?location=Auckland+-+Avondale&action_doSearchValues=Find+Rent
https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/?location=Wellington+-+Kelburn&action_doSearchValues=Find+Rent
```

Require the full-page selection and result echo to agree. Extract its complete
five dwelling tables separately from the AJAX table, using a different Python
extraction path and no runtime reader import. Both presentations share the same
MBIE administrative lineage; agreement verifies access, selection and extraction,
not an independent survey or recomputation of the underlying rent statistics.
No substitute population is acceptable.

Retain only exact result headings and aggregate tables plus a minimal form
selection excerpt. Do not retain full pages, contact/footer metadata or
unbounded location lists. Record original response hashes, byte counts,
timestamps, URLs, selection transformations and retained hashes.

Publisher: Ministry of Business, Innovation and Employment / Tenancy Services.
Reuse: [CC BY 3.0 NZ](https://creativecommons.org/licenses/by/3.0/nz/), with MBIE
attribution and the [official methodology](https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/market-rent-explained/)
link. The current [download-page migration caveat](https://www.tenancy.govt.nz/about-tenancy-services/data-and-statistics/rental-bond-data/)
must accompany the benchmark's provisional interpretation.

## Falsifiable pass criteria

1. **Structure and selection:** each response has one exact area/window heading
   and all five distinct dwelling tables with headers `Size`, `Active bonds`,
   `Lower Quartile`, `Median Rent`, `Upper Quartile`. Every row has exactly five
   cells, a recognized bedroom label, no duplicate tuple and valid values;
   quartiles satisfy lower ≤ median ≤ upper. Reject unknown tables, extra cells,
   missing table structure, default-place output and broken payloads.
2. **Numerical/semantic correctness:** initial Avondale has 13 rows (Apartment 3,
   Boarding House 1, Flat 3, House 5, Room 1); Kelburn has 16 (4, 1, 5, 5, 1).
   Independently reconcile **all 29 tuples and all 116 numeric cells** against
   the separately acquired full-page presentation, with **zero tolerance** after
   lossless currency/thousands-separator decoding. Require matching period,
   place, dwelling and bedroom semantics. Do not average medians or sum counts
   to invent a population total.
3. **Realistic failures:** demonstrate rejection or explicit nonreporting for
   wrong city/suburb, mixed periods, monthly/currency-unit substitution,
   duplicate or dropped rows, silent old-window substitution in the acceptance
   check, unknown bedroom/category, 5+ treated as exactly 5, missing/unknown
   numeric tokens, zero accidentally treated as missing, swapped quartiles,
   malformed JSON/HTML, oversized response, HTTP error and timeout. Preserve
   successful unrelated source results. Constructed fault tests are labelled
   separately from original publisher evidence.
4. **Actual reader:** reconcile actual protected Cloudflare preview and final
   production captures against independent normalized cells, including all
   116 native numbers per domain and supported selected responses. Exact source
   identity and release vintage must match the candidate being accepted.
   Source/measure/exact-observation interfaces must preserve the six-month
   window and refuse unsupported localities, absent tuples and incompatible
   date/geography filters explicitly.
5. **Release boundaries:** the root task retains the established paid CPU,
   schema, interface, full-nine-desk source-preservation and versioned-release
   gates. This contract does not change ordinary source alerts, hourly watchdog,
   daily collector, existing incident/outbox state, or the separate SHADOW,
   delivery, UK CPI and NZ-PRICES evidence gates.

Completion of a local parser or this independent comparison alone is not a live
reader release or sustained operational acceptance.
