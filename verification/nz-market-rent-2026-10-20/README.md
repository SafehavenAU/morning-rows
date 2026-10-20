# New Zealand local market-rent benchmarks

**20 October 2026 — implementation and independent publisher evidence prepared;
live acceptance and release are pending.** This record does not claim a deployed
reader, successful Cloudflare acquisition, production acceptance or a new
scheduled monitoring observation.

The bounded task adds weekly rent quartiles and a separately defined active-bond
count for **Auckland - Avondale** and **Wellington - Kelburn** to the existing New
Zealand desk. It supports refreshing a rental-budget benchmark and comparing
like-for-like place, dwelling and bedroom categories. It cannot establish
available properties, an individual's affordability or a particular property's
correct rent.

## Why this task and these boundaries

The [17 October demand research](../../research/rent-demand-2026-10-17/README.md)
documented a public agent workflow using NZ rental-bond benchmarks, an obsolete
route that returned 404, and a separate recurring Canadian rental-brief workflow
whose author reported dimension-selection errors. This supports the practical
value of a bounded, explicitly labelled official response. It is not evidence of
our user query volume, adoption or proven high demand.

The [falsifiable contract](CONTRACT.md) was written before reader implementation.
The fixed two-locality scope avoids a national inventory or arbitrary suburb
fanout. Five dwelling categories and five bedroom categories produce **200
supported measure definitions**: two places × five dwelling types × five bedroom
categories × four statistics. Only actual reported tuples produce observations.
Known absent tuples return `not_reported`; unsupported IDs are refused.

Official suggestions show both **Auckland - Avondale** and **Christchurch -
Avondale**. Suburb-only selection would therefore be unsafe. Site locality IDs
are explicitly site-owned, not official NZAD codes, territorial-authority or
SA2 identifiers. The `5+ bedrooms` category means five or more, not exactly five.

## Original evidence and independent comparison

Four original official requests succeeded without a key or cookie between
**2026-10-20T07:04:59 and 07:05:06 UTC**: a public AJAX request and a separately
selected full-page request for each locality. Requests used the current no-key
`/market-rent-api/updateMarketValueLocation` interface. The separate page
requests specified the exact city-qualified location and omitted `period`.
The returned form's opaque value `42` is retained as evidence, not hardcoded as
a geography or period identifier.

Both presentations show **1 March–31 August 2026**, an inclusive six-month
window. Both current AJAX response hashes are identical to the 17 October
research specimens. The retrieval is fresh; the data is unchanged. No new
publisher vintage or daily-change staleness claim follows.

| Locality | Apartment | Boarding House | Flat | House | Room | Rows | Numeric cells |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Auckland - Avondale | 3 | 1 | 3 | 5 | 1 | 13 | 52 |
| Wellington - Kelburn | 4 | 1 | 5 | 5 | 1 | 16 | 64 |
| Total | 7 | 2 | 8 | 10 | 2 | 29 | 116 |

[Independent extraction](verify-original.py) uses structural regex extraction
for the original AJAX table and a separate event-driven Python `HTMLParser`
traversal of the separately acquired full-page table. It imports no runtime
reader. The [retained report](independent-report.json) matches **all 29 tuples
and all 116 numeric cells**, with zero tolerance, including exact geography,
bedroom meanings, period and explicit full-page form selections.

For example, both two-bedroom apartment medians are **NZ$550 per week**.
Avondale's lower/upper quartiles are **$470/$600**, with **93 active bonds**;
Kelburn's are **$496/$620**, with **43 active bonds**. These examples are not the
entire verification sample: every published row in all five dwelling tables
was compared.

The two official presentations share MBIE's administrative and statistical
lineage. Agreement verifies access, selection and extraction; it does not
independently recompute the underlying statistics or reconcile to a separate
survey. The selected official population and geography cannot be replaced by
the available monthly TA or quarterly SA2 downloads.

The [original-evidence notes](original/README.md) and
[acquisition ledger](original/acquisition.json) retain original response URLs,
times, byte counts and hashes, together with exact selection transformations and
retained-file hashes. Only aggregate result headings/tables and minimal selection
inputs are retained. Full pages, navigation, contact/footer material and
unbounded selector lists remain outside the repository.

## Meaning, reuse and uncertainty

[Fresh publisher notes](original/publisher-notes.json) confirm that the rent
statistics describe non-government properties with bonds lodged in the displayed
six-month window. The figures are rounded **weekly NZD** descriptive statistics,
not monthly rents, advertised listings or all existing tenancies.

The active-bond count is a separate bond count. The methodology describes current
bonds within the six-month window; the full-page tooltip also requires complete
rent, dwelling, bedroom and address information. It is not established as the
rent-quantile denominator. Counts are not summed to invent a population total,
and medians are not averaged.

The tool updates monthly and excludes the most recent month. Late lodgements
permit revisions. The current bond-system migration notice still warns of
provisional, incomplete or revisable data and changes unrelated to market
movement. No publication timestamp or revision identifier was supplied. Website
rounding bases, suppression thresholds and a missing-token vocabulary remain
unverified; the CSV download rules must not be transferred to these tables.
Absent tuples do not imply zero, suppression or no properties.

Reuse is **CC BY 3.0 NZ**, attributed to the **Ministry of Business, Innovation
and Employment / Tenancy Services**, with the
[official methodology](https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/market-rent-explained/)
link retained. These requirements and the provisional caveats belong in the
reader output.

## Validation boundary

[Eight constructed mutations of copied originals](original-extraction-checks.json)
are rejected: altered retained hash, wrong city, changed window, five-plus
changed to exactly five, reversed quartiles, duplicate bedroom, dropped row and
one changed number. Hashes were updated for semantic mutations so rejection
could not depend solely on a stale checksum. Actual retained originals were
not changed.

The offline [capture verifier](../../scripts/verify-rent-captures.py) requires
the exact expected request coverage, source revision, Worker identity, body
hashes and byte counts. It independently checks positive selectors, explicit
negative responses, HEAD and conditional GET semantics, validates against the
captured `/schema.json`, and reconciles actual response cells to the independent
publisher reference. It refuses existing output paths.

Its tooling rehearsal used explicitly labelled **constructed offline captures**,
not a remote preview: 31 requests, 116 native cells, 19 selected responses
containing 134 observation cells, 21 schema documents and 20 schema negative
controls passed. Six explicit refusals and two bodyless responses were checked.
The replay does not establish real HTTP behaviour or count as publisher
acquisition, Cloudflare execution, production evidence or a scheduled run.

**Still pending:** actual protected-reader fault checks, live versioned preview,
the paid CPU gates, full-nine-desk preservation checks, exact production release
identity and both-domain acceptance. Those outcomes must be recorded from their
original retained captures before this task is described as released.

## Reproduction

From the repository root, choose new output paths:

```sh
python verification/nz-market-rent-2026-10-20/verify-original.py \
  verification/nz-market-rent-2026-10-20/original \
  /tmp/rent-original-replay.json

python scripts/verify-rent-captures.py CAPTURE_DIR \
  verification/nz-market-rent-2026-10-20/independent-report.json \
  OUTPUT_JSON \
  --expected-revision SOURCE_SHA \
  --expected-version WORKER_UUID \
  --domains apex
```

Use `--domains both` for production captures. The second command requires Python
`jsonschema` and reads the original `rent-interface-report.json` and its bound
body files. Neither command makes requests or substitutes fixtures.

The existing SHADOW window, real delivery acknowledgment, UK CPI access and
selected NZ-PRICES external-evidence gates remain separate. This bounded
implementation does not reset incidents, repairs or outbox state, enable source
alerts, change the hourly watchdog/daily collector or create scheduled evidence.

## Runtime preparation

The full local build and 287 Node tests pass. [Protected Cloudflare testing](fault-preview.json) passes21 constructed cases through the actual reader/selector, including per-place failure isolation, explicit zero, a single-cell revision, bad units/geography, mixed/future windows and transport/parse failures. The checked code hashes stayed unchanged. This is not live publisher or production acceptance. [Local validation](local-validation.json) records the completed preparation gates.
