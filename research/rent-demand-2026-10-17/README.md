# Next-source research: local rental-budget benchmarks

Research date: **17 October 2026**. Recommendation: **MBIE/Tenancy Services market-rent aggregates for the existing New Zealand desk**, initially as a dated local benchmark. This is a defensible next integration candidate, not proof of high usage or a production-ready reader. No integration was deployed.

## Task and demand evidence

Task: **refresh a rental-budget benchmark for a specified place, dwelling type and bedroom count, and compare like-for-like places**. This supports repeat housing-cost briefs and relocation research. It cannot establish available properties, an individual's affordability or the correct rent for an individual property.

The live [catalogue](https://morningrows.com/catalog.json), repository `worker.js`, `HANDOFF.md` and `SOURCE_PASSES.md` were inspected. The eight desks cover national statistics and housing finance, but have no local bedroom-by-dwelling rent benchmark. The unfinished queue included CMHC/StatCan, NI energy, Scottish Funding Council, CQC and AER. Rental research was selected because of the following task evidence, not because a download happened to work. No permitted request-log dataset or query transcripts were located; live analytics were not accessed. A subsequent direct Python request for the NZ desk returned 403, so the gap assessment uses the catalogue and source inspection, not a claim to have revalidated that live desk.

| Underlying example | What it establishes | Independence and limits |
| --- | --- | --- |
| [NZ rental-bond agent skill](https://github.com/thecolab-ai/.skills/blob/main/skills/rental-bond-nz/SKILL.md), [implementation](https://github.com/thecolab-ai/.skills/blob/main/skills/rental-bond-nz/scripts/cli.py) and [API notes](https://github.com/thecolab-ai/.skills/blob/main/skills/rental-bond-nz/references/api-notes.md) | Explicit suburb/property/bedroom tool and authored Avondale examples. Its notes describe a six-month snapshot; its old endpoint now returns 404 even with AJAX headers. Direct evidence of a developer building an agent capability and a reproducible access failure. | One project, not three independent demand observations. Documentation examples are not actual user query logs. Its own health label is `gated`. |
| [Canadian financial agent README](https://github.com/shayeeboy/Financial-Intelligence-Strategy-Agent), especially “Lessons learned”, and [CMHC adapter](https://github.com/shayeeboy/Financial-Intelligence-Strategy-Agent/blob/main/src/mcp/adapters/cmhc.js) | Describes weekly/monthly briefs using local rents; implements CMA × structure × bedrooms. Author reports retrieving bachelor rents when a bedroom selector landed on the structure dimension, and confusing Victoria with Victoriaville. These are concrete failure reports; not independently reproduced here. | A separate author/project provides recurrence evidence through scheduled workflows. It does not establish subscribers, query volume, or NZ demand. README success claims are not treated as our test results. |
| [cityparity MCP repository](https://github.com/summerstateofmind/cityparity) | City comparison and relocation cost tools corroborate the broader task. | A third project; weaker, adjacent-task proxy. Closed underlying engine; no measured adoption established. |

These are apparently separate project lineages, not verified independent user populations. **Hypothesis:** a reusable, correctly labelled official rent response would save agent developers from repeatedly resolving dimensions, dates and brittle publisher interfaces. Evidence supports that hypothesis enough to prototype; it does not justify calling this a proven high-demand market. The Canadian scheduled brief is the clearest evidence of recurrence; repeated NZ user demand remains unmeasured.

## Three candidate sources, one task

**1. NZ MBIE/Tenancy Services — strongest fit.** [Original market-rent page](https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/), [methodology](https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/market-rent-explained/) and [original downloads](https://www.tenancy.govt.nz/about-tenancy-services/data-and-statistics/rental-bond-data/). Supports “What is the recent median and middle-half range for two-bedroom apartments in Avondale?” Required dimensions are NZAD suburb, city-qualified label, dwelling category and bedrooms; measures are weekly NZD quartiles and an explicitly defined active-bond count. The publisher label is available; a stable NZAD identifier was not established. Never substitute a territorial-authority or SA2 code for it.

Population: non-government properties with bonds lodged in the six-month window; not all existing tenancies or advertised listings. Unadjusted descriptive rents, rounded by the publisher. The displayed active count is current bonds within that window, not the denominator of all lodged bonds. Latest tested window: **1 March–31 August 2026**. Updates are monthly and deliberately exclude the most recent month; unchanged daily values are expected. Late lodgements permit revisions. The download page explicitly warns that migration between bond systems leaves data provisional and can create apparent changes unrelated to the market. Therefore no growth or trend claim is recommended from this demonstration.

The website's no-key route works with ordinary AJAX request headers but returns JSON labelled `text/html`, containing an HTML `Table`. Headerless requests produced 400 and one 429. The old community route returns 404. Monthly TA CSV works but lacks joint suburb/bedroom/dwelling dimensions. Quarterly CSV has those latter two dimensions at SA2 geography, but its actual maximum period is **2026-04-01**, despite a `Q3-2026` filename; it is not a substitute for the six-month NZAD snapshot. CSV rules specify base-three count rounding and suppression below five bonds. Do not transfer that rounding rule to website counts (observed counts include 91 and 43), or infer the reason for an absent website row. Market-rent data permits **CC BY 3.0 NZ** reuse with MBIE attribution and a methodology link, included in the specimen/output.

**2. ONS Price Index of Private Rents — usable, weaker fit to the joint question.** [Dataset](https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics), [tested original workbook](https://www.ons.gov.uk/file?uri=/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics/16september2026/priceindexofprivaterentsukmonthlypricestatistics.xlsx), [reuse terms](https://www.ons.gov.uk/help/termsandconditions). No key; valid 18,640,156-byte XLSX, OGL. Supports a monthly local-authority rental benchmark with official area code, GBP/month, observation month and bedroom **or** property category. The extracted columns do not support a joint two-bedroom-flat answer. Manchester `E08000003`, August 2026: all properties **£1,373**, two bedrooms across property types **£1,233**, flats across bedroom counts **£1,147**. Exact sheet/cells and workbook hash are in `specimens/ons-selected.json`.

Published 16 September; next release listed 21 October 2026. Estimates cover new/existing private rents, with Scotland's underlying inputs primarily advertised new lets; that caveat must accompany comparisons. Not seasonally adjusted. `[x]` means unavailable; `[z]` not applicable; pounds rounded to £1. NI's latest two months are absent and its UK contribution is imputed. Country and local coverage must be checked per row rather than assumed uniform. Exact revision-window policy remains unverified, so a future reader must preserve release vintage and consult it before claiming finality. Current agents would download and select workbook cells; Morning Rows could reduce that extraction burden. The existing small-file workbook reader cannot accept this file unchanged. Demand evidence is the broader recurring benchmark task, **not a separately observed ONS-specific integration request**.

**3. CMHC Rental Market Survey through StatCan — directly relevant demand, blocked transport and unresolved reuse.** [Official table 34-10-0133](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301), [CMHC data tables](https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market/rental-market-report-data-tables), [survey methodology](https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research/surveys/methods/methodology-rental-market-survey). Supports “What is the annual average two-bedroom rent in this Canadian centre?” Required axes: fully qualified geography, structure category, bedrooms, survey year, CAD/month, estimate and quality flag. Annual October survey of privately initiated buildings with at least three rental units in eligible urban centres; not the entire rental market or today's asking rents. Weighted average, not the NZ median. Annual recurrence can support monthly briefs without fabricating monthly observations.

The existing agent resolves cube dimensions then requests observations. Correct metadata POST and direct bulk ZIP both returned **HTTP 200 outage HTML** in this check, so no Canadian numerical answer is demonstrated. The CMHC tables page works; this is not evidence all CMHC access is down. Stable series coordinates and current release/revision details remain unverified. Survey conventions distinguish reliability grades, suppressed estimates, no-unit cells, unavailable values and insignificant changes; none may become zero. [CMHC website terms](https://www.cmhc-schl.gc.ca/about-us/terms-conditions) restrict redistribution absent rights/permission. A clear applicable redistribution licence for the selected StatCan-hosted CMHC table must be confirmed; general government openness is insufficient. Defer this source.

## Tested NZ access options

| Option | Result and use |
| --- | --- |
| `https://www.tenancy.govt.nz/market-rent-api/updateMarketValueLocation?ajax_city=Auckland&ajax_suburb=Avondale` | 200, parseable JSON with `Finder`/`Table`; same for Wellington/Kelburn. Send `X-Requested-With: XMLHttpRequest`, `Accept: application/json` and the market-rent page as `Referer`. No key/cookie sent. Public website interface, not a documented stability promise. |
| Official HTML form | Explicit Avondale selection works. Apartment values reconcile with the JSON presentation; the default page alone must not be trusted to represent a requested location. |
| Official monthly/quarterly CSVs | Accessible but dimension/geography/window mismatches prevent silent substitution. Downloads must be discovered from the publisher page; inspect dates inside the file. |
| [Documented Market Rent API](https://portal.api.business.govt.nz/api/market-rent) | **Manual-key option:** subscription approval and `Ocp-Apim-Subscription-Key` required; OAuth optional. Unauthenticated `/gateway/tenancy-services/market-rent/v2/area-definitions` returned 401. Documentation offers area definitions/codes, period selection and JSON/CSV. No registration performed, price/approval timing not established, and equivalence with NZAD website selections remains to be tested. |

## Source-to-answer demonstration

The specimens retain only the unmodified heading and Apartment table needed for the selected examples. Transformation: exact area echo → inclusive ISO dates; exact Apartment table and headers → bedroom rows; currency symbols/thousands separators removed → integers. No unit conversion, inflation adjustment, aggregation, annualisation or inference of absent values. Raw response hashes, URLs and selected-fragment hashes are in `manifest.json`.

All questions below are **constructed tests derived from the observed workflow capabilities**, not alleged end-user queries:

| Question | Verified response |
| --- | --- |
| Recent Avondale two-bedroom apartment benchmark? | **NZ$550/week median; $470–$600 lower–upper quartiles; 93 active bonds.** March–August 2026 window and population caveats retained. |
| Is Kelburn cheaper on the same measure? | **Equal $550 medians**; Kelburn quartiles $496–$620, 43 active bonds. No invented ranking. |
| How does a $600 weekly budget compare? | At Avondale's upper quartile; between Kelburn's median and upper quartile. Does not guarantee an available property or establish an individual property's value. |
| Today's advertised rent or availability? | Unsupported by this source. |
| Avondale four-bedroom apartment benchmark? | No published row in the snapshot; return `not_reported`, not zero or a guessed suppressed count. |

Avondale figures also match a separate official full-page request extracted by a different method. Both views share publisher lineage; this verifies selection/extraction, not the underlying administrative calculation. No independent survey reconciliation was established. Quartile order and exact dimensions are checked; counts are not summed into a population total, and medians are never averaged.

| Retrieval comparison | Correctness/completeness | Traceability and effort |
| --- | --- | --- |
| Existing Morning Rows | No local benchmark reader found. | Agent must leave the desk. |
| Community NZ implementation's documented route | 404 in this check; cannot answer. | Requires rediscovery/repair before extraction. |
| Working publisher route | Contains the required answers, but JSON wraps HTML and methodological context is separate. | Two requests for two places; responses total **19,190 bytes**. Direct HTML for Avondale alone was **90,099 bytes**. |
| Proposed local representation | Same figures; explicit geography, population, dates, units, source, provisional status and refusal of unsupported answers. | **3,244 bytes** for the two compact normalized records. Removes per-agent HTML/dimension interpretation. Still two upstream requests in this demo; a production latency/request saving has **not** been measured. |

These are deterministic retrieval/answer checks, not a blinded agent benchmark. Smaller selected payloads partly reflect intentionally omitted dwelling types; no model accuracy, token-cost or adoption improvement is claimed.

## Reproduce and decide

From the repository root, using Python 3.12 standard library:

```sh
python research/rent-demand-2026-10-17/demo.py
python research/rent-demand-2026-10-17/test_demo.py
python research/rent-demand-2026-10-17/demo.py --live
```

Offline results: `results.json`. Eleven checks cover actual values, separate page agreement, wrong geography, incomplete/mismatched periods, moved columns, reversed quartiles, duplicated bedrooms, outage HTML, response shape, and distinct zero/missing/suppressed states. Missing-marker mutations are synthetic; they do not establish the website's complete marker vocabulary. **Live replay succeeded for both places and exactly matched the specimen-derived records and answers**, recorded with timestamp in `validation.json`. Live retrieval stops on transport/schema failures and never overwrites the dated specimens or substitutes an older release.

Before integration: establish a supported location selection/identifier contract, handle cadence-aware updates and revisions, choose the website route versus manually authorised API, test Cloudflare access and response limits, preserve source isolation, retain method/licence/provisional labels and avoid trend claims across the system migration. A full suburb inventory or country-wide fan-out was not tested and is not proposed by this two-place demo.

**Decision:** prioritize MBIE for the next bounded integration evaluation. It has a specific existing agent workflow, a reproduced failure in today's retrieval path, usable official aggregates and a demonstrated semantic/formatting benefit through Morning Rows. Do not claim demand is validated at scale. The next demand check should be permitted repeat-query evidence or a developer trial of these same questions, not a larger source list. Production source/Worker and the monitoring baseline remain unchanged by this research.
