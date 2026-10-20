# New Zealand local market-rent benchmarks

**20 October 2026 — deployed and accepted on both production domains.** Rent,
claimant, core, schema, semantic, CPU and smoke checks pass for the bounded
release described here. This record does not create a new scheduled monitoring
observation or complete the broader maintenance plan.

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

The initial tooling rehearsal used explicitly labelled **constructed offline
captures**, not a remote preview. Subsequent [format controls](format-validation-controls.json)
confirmed that this Python installation lacked optional URI and date-time
checkers. The verifier now registers explicit dependency-free checks and
separately validates timezone-aware retrieval/provenance timestamps. All
**19 format controls** passed; its updated offline rehearsal passed **24 schema
negative controls**. These rehearsals are tooling evidence, not publisher
acquisition, production evidence or scheduled runs.

The existing claimant capture runner now accepts an explicitly selected
`CLAIMANT_REFERENCE`, retaining the historical default. It validates the
independent reference's 65 cells and thirteen consecutive national months,
records the resolved path and hash, and refuses capture overwrites.
[Fifteen offline controls](claimant-reference-controls.json) pass. A constructed
next-window control is labelled as such; it is not a new official reference.

## Actual staged Cloudflare results

The zero-percent candidate has clean source
`f85224e6a9ee601d9e706ffab2cd133d3697c272`, Worker
`b2a562a7-d137-4376-a6ca-54f29f1415ad` and fingerprint
`d06c032d78d73a12`. All results in this section concern this candidate or the
explicitly identified protected fault harness; they do not establish a
production promotion.

[Local validation](local-validation.json) passed **287 tests** and the build.
The [actual protected Cloudflare harness](fault-preview.json) passed **21
constructed scenarios**. These include normal and exact selections, unretained
and absent tuples, a single-statistic revision, numeric zero, one-locality
failure with the healthy sibling preserved, and rejected transport, malformed
payload, geography, category, currency, quartile and period faults. The revised
median changes only that statistic's version; zero remains observed. These are
21 scenarios, not 21 independently observed publisher failures. Source and
fixture hashes were unchanged during the harness run.

| Actual candidate CPU measurement | Measured CPU | Separate acceptance budget | Evidence |
| --- | ---: | ---: | --- |
| Cold USA CPI selected request | 9 ms | 100 ms | [USA](usa-cpu.json) |
| Maximum across the eight legacy full desks, on New Zealand | 296 ms | 500 ms | [Legacy desks](legacy-cpu.json) |
| Fresh selected rent acquisition on www | 361 ms | 500 ms | [Rent source](rent-source-cpu.json) |

The CPU evidence confirms matching candidate identities, cold/fresh acquisitions
and unchanged deployment allocation. These measured budgets are separate from
the configured Worker ceiling and are not spend forecasts.

The [actual staged rent interface](staged-rent/rent-interface-report.json)
passed **112 checks over 31 requests**, from **07:31:27.349 to 07:31:35.035 UTC**.
The returned source provenance records Avondale and Kelburn acquisitions at
**07:31:30.803** and **07:31:30.683 UTC**, with original response hashes matching
the independently retained publisher specimens.

[Offline reconciliation of those original captures](staged-rent-validation.json)
passes **116 native numeric cells across 29 tuples**, **19 successful selected
responses containing 134 observation cells**, **21 captured schema documents**
and **24 schema negative controls**. It validates all request/body hashes and
identities, six explicit refusals, and matching-ETag empty HEAD/304 responses.
The refusals cover a known absent apartment tuple, unsupported Christchurch
locality, an unretained window, incompatible geography/date filters and a
duplicate source selector. No existing failed capture was overwritten.

The [captured nine-desk semantic suite](staged-semantic.json) passes **50
checks**, including all 23 Stats NZ values, 40 AIHW jurisdiction/triage cells,
the Wales projection, four NISRA aggregates, NZ prices, USA CPI and the
established earlier additions. Those bounded checks do not certify every
native field or imply all publishers are healthy.

## Production results and claimant release refresh

Deployment `663484b4-bf7d-4d3e-8b66-1320fcdd8876` promoted Worker
`b2a562a7-d137-4376-a6ca-54f29f1415ad` to **100% at
2026-10-20T07:35:25.569148Z**, preserving clean source
`f85224e6a9ee601d9e706ffab2cd133d3697c272` and fingerprint
`d06c032d78d73a12`. Both production-domain captures match that identity.
The rollback target is the prior claimant release: Worker
`21582063-b7df-456b-ba2f-4f629f9cc63d`, source
`983904912d512b054ae3a7fa1cd1e6a65c353036`, fingerprint
`5a0a0fe53d5f160c`.

The [production rent interface](production-rent/rent-interface-report.json)
passed **224 checks over 62 requests**, from **07:35:51.929 to
07:36:04.874 UTC**. [Independent capture validation](production-rent-validation.json)
passes **232 native numeric cells across 58 tuples**, **38 selected responses
containing 268 observation cells**, **42 captured schema documents** and **48
schema negative controls** across apex and www. All twelve explicit refusals
and four HEAD/304 responses satisfy their expected status, body, identity and
ETag checks. The rent window remains March–August 2026; production did not
substitute a different period or locality.

During validation, Nomis legitimately advanced the existing claimant reader to
**September 2025–September 2026**. The
[separate refreshed evidence](claimant-refresh/README.md) independently matches
all **65 national CSV/JSON cells** and their reference/revision metadata, and
matches the already acquired cold candidate bodies. September is revision 0;
August is revised from version 0 to version 1. The publisher release string
`2026-10-20 07:00:00` remains unzoned because its timezone is not established.
The prior August-vintage evidence remains unchanged.

A separately extracted official NISRA October workbook verifies the one directly
comparable September NI aggregate, **34,225**, against Nomis. This is one
independent presentation with shared administrative lineage, not thirteen exact
NI historical matches or an independent population enumeration. It does not
alter the administrative, non-seasonally-adjusted, age-16-plus claimant-count
definition or turn these values into unemployment estimates.

The [staged claimant reconciliation](staged-claimant-validation.json) passes
65 cells, 20 successful selectors and 15 negative responses, with
[25 schema documents and 185 negative controls](staged-claimant-schemas.json).
The [production claimant interface](production-claimants/claimant-interface-report.json)
passes **366 checks over 112 requests**.
[Production reconciliation](production-claimant-validation.json) passes **130
cells, 40 successful selectors and 30 negative responses**.
[Final production schema validation](production-claimant-schemas-final.json)
passes **50 documents and 370 negative controls**. The
[initial schema attempt](production-claimant-schemas.json) is retained: it read
the wrong schema-capture directory and stopped before checking any documents.
Correcting that input path required no reader change; the failed attempt was
not overwritten.

The [general production interface](production-core/report.json) passes **151
checks over 104 requests**. Its [schema/reference and source-state review](production-core-validation.json)
passes **24 schema documents**, **26 USA CPI calendar slots** and **230 source
state comparisons**. The four changes are acknowledged intermittent TfL
availability changes; none remains classified as requiring review. Source
availability comparisons do not independently certify every native value.

The [apex](production-apex-semantic.json) and
[www](production-www-semantic.json) semantic suites each pass **50 checks**.
Final smoke passes **18 checks on [apex](smoke-apex.json)** and **17 checks on
[www](smoke-www.json)**. These complete the bounded production release gates;
SHADOW, delivery and unrelated evidence gates remain unresolved separately.

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

Final evidence/configuration integration passes **288 repository tests and the build**.
The source candidate passed287 tests before upload. The additional constructed
replay harness initially used mutable active review inputs and failed after
activation; it now pins the retained pre-rent review/approvals matching its
historical August fixture. This was a test-fixture correction, with no runtime
change. [Final local validation](final-local-validation.json) retains the boundary.
