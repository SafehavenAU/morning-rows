# Project-wide demand-led source assessment

**17 October 2026 — all eight desks reviewed; research only.** Recommend **Nomis claimant-count history first**, followed by the already demonstrated **NZ market-rent benchmark**, then **AEMO completed-day price summaries**. Canadian historical FX is useful but a lower-priority extension of an existing publisher. No deployment or runtime edit.

This extends the previous research standard across the project, not just the rental topic. Four task families cover the eight desks. Each uses at most three candidate sources: labour (Nomis, NISRA), electricity (AEMO), FX (Bank of Canada), and the previous rental study (MBIE, ONS, CMHC). Different formats/endpoints from one publisher are access options, not independent sources or demand observations.

## Coverage and decisions

Inspected the live [catalogue](https://morningrows.com/catalog.json), current `worker.js`/readers, repository instructions, handoff and unfinished source queue. This was not a production health audit. Existing successful sources and monitoring baseline remain untouched.

| Desk | Existing coverage relevant to the decision | Underserved recurring task | Tested result and decision |
| --- | --- | --- | --- |
| Australia | Current five-region grid snapshot, ABS/RBA macro series, AIHW, legislation and incidents | Summarise a complete day's wholesale prices and negative-price exposure | AEMO original CSV, SA/VIC, 288 intervals each. **Recommend dated history**, not live or retail-price advice. |
| New Zealand | 23 Stats NZ series, electricity prices, fleet and other official feeds; no local rental benchmark | Refresh suburb × dwelling × bedroom rent comparisons | Reuse the [completed rent study](../rent-demand-2026-10-17/README.md). **Recommend MBIE**, with provisional/migration caveats. |
| Canada | Latest FX, rates/yields/mortgages and macro series; no dated FX window | Retrieve reference conversions/history for a specified date | BoC original JSON/CSV and daily table agree. **Lower-priority reader extension**; no additional publisher needed. CMHC remains deferred. |
| United Kingdom | Headline economic observations, Parliament, legislation, food aggregates | Monthly UK claimant-count brief and constituent comparisons | Nomis `K02000001`: **1,698,450**, August 2026. **Recommend**, separately from the existing unemployment measure. |
| England | National headlines, health/education/pharmacy and environmental/transport feeds; no local claimant history | Monthly local claimant brief, e.g. Birmingham versus last year | England **1,486,460**; Birmingham **77,930**, up **760** year-on-year. **Recommend Nomis**. |
| Scotland | National headlines, holidays, food aggregates, bills, river, road traffic and insolvencies | Equivalent local labour brief using Scottish geography | Scotland **112,215**; Glasgow City **22,530**, up **1,030** year-on-year. **Recommend Nomis**. |
| Wales | National headlines, projection, tax, holidays and food aggregates | Equivalent local labour brief using Welsh geography | Wales **65,615**; Cardiff **10,115**, up **400** year-on-year. **Recommend Nomis**. |
| Northern Ireland | National headlines, NISRA childhood BMI, Assembly divisions, insolvencies and holidays | Equivalent local labour brief with explicit administrative definition | NI **34,155**; Belfast **8,980**, down **400** year-on-year. NISRA detailed table agrees. **Recommend Nomis**, retain NI-specific caveats. |

All claimant numbers above are **unadjusted, rounded administrative claimant counts**, not unemployment estimates or rates. Country totals and local examples are not additive peers. NI's separately published **33,400 seasonally adjusted** headline answers a different question.

## What demand was actually observed

No private analytics or request logs were accessed; no permitted query-log dataset was found in the repository. We do not know Morning Rows usage volume. Evidence below supports qualitative task selection, not a quantified market forecast.

| Primary evidence | Classification and recurrence | Independence/limit |
| --- | --- | --- |
| [OpenBB issue #7490](https://github.com/OpenBB-finance/OpenBB/issues/7490) | **Direct integration request**, open when checked. Requests BoC historical FX support with rate-only fields, plus rates and yields. Strong evidence of an unmet developer need. | One issue/author; comments and repository stars are not usage counts. It is not proof people prefer Morning Rows over Valet. |
| [Bank-of-Canada MCP README](https://github.com/arose26/bank-of-canada-mcp) | **Implemented agent workflow** with authored history and conversion prompts. Complements the explicit integration request. | Separate project lineage; prompts are documentation examples, not user transcripts. |
| [ONS/Nomis MCP worked examples](https://github.com/brynmrgn/ons-mcp/blob/main/EXAMPLES.md) | **Agent workflow** asks for Birmingham's current Claimant Count versus a year ago. A concrete repeating monthly comparison. | One project; its README/examples are not separate demand observations. The example names the older `NM_1_1` dataset. Official metadata confirms that is JSA-only, whereas `NM_162_1` supports the combined claimant question. |
| [Trafford Data Lab source notebook](https://github.com/traffordDataLab/open_data_companion/blob/master/index.Rmd) | **Non-agent workflow proxy:** official local data team's code retrieves 13 months of claimant counts using `NM_162_1`. Corroborates the same recurring analytic operation. | Independent organisation/project; does not prove AI-agent adoption. |
| [Published ONS agent access trace](https://github.com/chris-page-gov/okf-ons/blob/main/research/2026-07-18-claude-desktop-cowork-fable-5-okf-ons-access-trace.md) | **Author-reported execution trace**, one session: payload caps and metadata navigation obstruct retrieval; a different record was substituted. Supports small, explicit, caveated responses. | A metadata demonstrator, partly AI-authored; not independently replicated here and not evidence of repeated claimant queries. Its proposed future experiment is not completed evidence. |
| [AEMO MCP authored questions](https://github.com/Bigred97/aemo-mcp) | **Agent workflow** asks about SA negative prices over 24 hours and weekly Victorian averages. Current Morning Rows snapshot cannot answer either history question. | Same lineage as ausdata clients: counted once. The exact moving-24-hour task needs fresher retrieval than the tested monthly files. |
| [AEMO history pipeline](https://github.com/ZC-ANZ/aemo-historical-prices) | **Automation proxy:** code/documentation specifies monthly scheduled price-history processing. Supports repeated historical summaries. | Separate project; not an observed agent query or verified outcome. Energy-control simulation projects are weaker adjacent evidence and are not used to claim household savings. |
| [Previous NZ evidence record](../rent-demand-2026-10-17/README.md) | NZ rental agent wrapper, a separate Canadian scheduled financial brief, and relocation MCP proxy. | Reused evidence, not new independent observations. End-user recurrence in NZ remains unmeasured. |

**Hypothesis being tested:** agents benefit from correctly selected, dated official observations with compact semantics. The demonstrated benefit is preventing specific wrong answers and repeated extraction work. We have not measured adoption, model accuracy, willingness to pay or end-to-end agent latency.

## Source evaluation and competing access paths

**Labour: recommend Nomis; NISRA provides a national alternative and comparison.** Original [dataset/next release/revisions](https://www.nomisweb.co.uk/datasets/ucjsa), [API](https://www.nomisweb.co.uk/api/v01/help), [methodology/rounding](https://www.nomisweb.co.uk/articles/920.aspx), [reuse terms](https://www.nomisweb.co.uk/home/copyright.asp). No key for this query. Both CSV and JSON work; metadata/codelists resolve dataset, sex, age, count-vs-rate and geography. `NM_162_1`, gender `0`, age `0`, measure `1`, measures `20100`; actual query and complete 117-observation specimen retained. These distinctions are missing from a superficial “employment” label. Exact geography mappings, flags and monthly reference convention are in [CONTRACTS.md](CONTRACTS.md).

Latest is August 2026, released 15 September; next release 20 October. Previous months can be revised. Do not alert merely because it has not changed today. Nomis currently supplies all nine requested country/local geographies. The [NISRA original claimant workbook](https://www.nisra.gov.uk/system/files/statistics/2026-09/lmr-claimant-count-tables-september-2026.xlsx) works without a key (350,790 bytes), but covers NI only and requires selecting a worksheet, units, adjustment and notes. Its `LGD_11!D11` = **8,980 Belfast** and `D19` = **34,155 NI**, exactly matching Nomis. It warns that geographically unclassified records may be excluded and some JSA/UC double counting occurs. [NISRA reuse terms](https://www.nisra.gov.uk/crown-copyright) permit OGL reuse. The two presentations share administrative upstream lineage; no independent population enumeration was attempted.

**Electricity: recommend AEMO's completed-day history, with a freshness boundary.** Original [aggregated-data directory/application](https://aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/aggregated-data), [monthly SA CSV](https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_SA1.csv), [monthly VIC CSV](https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_VIC1.csv), [dashboard definitions](https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem/), [reuse permission](https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions). Free/no key, explicit region and five-minute interval-ending prices in AUD/MWh. Zero/negative values are legitimate. NEM geography excludes WA/NT; do not turn two sample regions into “Australia's average”.

Alternatives from the same publisher: the existing `ELEC_NEM_SUMMARY` is a latest snapshot; [DispatchIS files](https://nemweb.com.au/Reports/Current/DispatchIS_Reports/) give fresh individual intervals and status, with substantially more window-assembly work. Two original dispatch ZIPs were tested and four selected prices reconcile within AUD0.005/MWh. Both presentations share the market calculation, so this is extraction/rounding validation. The monthly files stop at **17 October 00:00 AEST**, not research time. They support a completed calendar day, not the moving last 24 hours or a future cheap-hour recommendation. Calendar day is distinguished from the NEM trading day. The monthly-file refresh/correction SLA remains unverified; do not label values final. Tiny negative full-precision prices can round to published zero: the demonstrated count concerns the rounded published CSV values.

**FX: BoC works, but its native API is already good.** Original [JSON endpoint](https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXGBPCAD/json?start_date=2026-10-12&end_date=2026-10-16), [CSV](https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXGBPCAD/csv?start_date=2026-10-12&end_date=2026-10-16), [daily official table](https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/), [terms](https://www.bankofcanada.ca/terms/). No key. Two explicit currency series, CAD per foreign unit, business-day averages normally published by 16:30 ET. Four dates, 13–16 October, eight values: JSON, CSV and the separately presented table agree exactly. The table marks 12 October a bank holiday. There is no carry-forward or inversion in the demonstration. No immutable revision-vintage guarantee was established. Reuse requires attribution, accuracy, transformation disclosure and, in paid products, notice that the original data is free. Morning Rows' opportunity is dated history/holiday semantics in its existing reader, not building another FX provider.

**Rental: retain MBIE recommendation.** The [previous three-source assessment](../rent-demand-2026-10-17/README.md) already probes original MBIE, ONS and CMHC data and documents licences, revisions, geography, missingness and alternatives. Reuse it without claiming a new check or adding three more rental sources. ONS remains a possible bedroom-only rental benchmark for UK areas; it did not earn priority over the clearer claimant task in this pass. CMHC transport/reuse questions remain unresolved.

## Demonstrated answers and retrieval comparison

All tests are **constructed from cited workflow capabilities**. Country/city coverage extrapolations are labelled as such; these are not alleged production user queries.

| Representative question | Answer / boundary |
| --- | --- |
| Birmingham claimant count versus a year earlier? | August 2026 **77,930**, versus **77,170** in August 2025; **+760 (+0.98%)**. Administrative definition retained. |
| Do the four nations reconcile with the UK? | **1,698,445** summed versus published **1,698,450**; difference **5**, consistent with independent rounding to five. Never silently force equality. All 13 monthly residuals stay within the stated tolerance. |
| Are NI and Belfast estimates verified? | **34,155** and **8,980** agree with NISRA's detailed table. The **33,400 adjusted headline is not an interchangeable value**. |
| Was SA wholesale pricing negative on the selected complete day? | 16 October market-clock calendar day: **68/288 published intervals**, **340 minutes**, with **2 explicit zero intervals**. Mean **AUD57.83/MWh**, minimum **−10.81**. VIC mean **55.25**, also 68 negative/2 zero intervals. |
| What is the corresponding CAD reference amount on 16 October? | USD1,000 × **1.4154** = **CAD1,415.40**; GBP2,500 × **1.8871** = **CAD4,717.75**. Not executable quotes. |
| What was the rate on 12 October? | **Not published on that date**; official table says bank holiday. No silent substitute. |
| What is Avondale's two-bedroom apartment rent? | Prior verified demonstration: **NZ$550/week median**, $470–$600 quartiles, March–August 2026. Not today's asking rent or a property valuation. |

| Current retrieval | Proposed Morning Rows benefit | Measured effort and limits |
| --- | --- | --- |
| Nomis requires correct dataset/dimensions; the public agent example selects JSA-only | Fixed measure/age/sex, verified codes, revisions, flags, totals and year-on-year comparison | Raw tested CSV **43,703 bytes** / JSON **131,052**; compact answer object **3,007 bytes**. One data call once selectors are known; no claim that Morning Rows beats a correctly configured Nomis API. Output is a selected summary, not lossless compression. |
| AEMO snapshot cannot supply a day's history; monthly CSVs require window assembly | Explicit clock/window, completeness, equal-interval mean and negative/zero distinction | Two original files **416,822 bytes**; two compact summaries **1,878 bytes**. Same two upstream calls in the demo. Dispatch comparison checks only four prices, not all 576. |
| BoC direct API already supplies clean dated JSON; Morning Rows currently drops history | Exact-date lookup, quote direction and holiday refusal in the existing desk | Original JSON **1,802 bytes**; compact output **1,220 bytes**. One call either way. Benefit is modest and should be validated with actual repeat requests before prioritising. |

No blinded agent experiment was performed. Payload reduction partly comes from selecting required questions/fields. No fabricated latency, token-cost, success-rate or usage statistics.

## Queue and manual access

The unfinished queue is preserved, not declared exhausted. **NI energy** needs both clearer agent-task demand and denominator/source validation. **Scottish Funding Council** had no task-specific agent evidence in this bounded search; that is not proof of no demand. **CQC aggregates** remain a lead, but provider lookup and operational patient workflows do not establish demand for the project's aggregate-only output. **AER** stays behind AEMO for the selected short-window price task; its old discovery-page block is not repeated as a new alert. **CMHC** retains its prior transport and redistribution uncertainties. Unrelated macro, health, legislation and environment sources have not been replaced by a convenient adjacent measure.

[Manual-key register](manual-key-register.json) consolidates the 22 inherited leads plus MBIE Market Rent, optional Nomis larger-query access and the current Met Office replacement lead. Inherited entries are explicitly **not revalidated recommendations**. No registration or credential access occurred. Relevant new decisions:

- **MBIE Market Rent:** documented subscription-key API; optional supported alternative to the working public website route.
- **Nomis UID:** optional only beyond the anonymous **25,000-cell** allowance; not needed for the 117-observation demo. Treat a UID as a credential if obtained later.
- **Met Office:** the existing DataPoint lead is obsolete—[retired 1 December 2025](https://www.metoffice.gov.uk/services/data/datapoint/datapoint-retirement-faqs). [Weather DataHub v2 documentation](https://datahub.metoffice.gov.uk/support/changes-and-updates) describes new keys and a free plan; product limits/reuse need further evaluation. This corrects the research queue, not the production `/keys.json` route.

## Reproduce and integration gates

```sh
python research/project-demand-2026-10-17/demo.py
python research/project-demand-2026-10-17/test_demo.py
python research/project-demand-2026-10-17/demo.py --live
```

`--live` fetches the dated selections; no deployment and no specimen overwrite. **All 14 new checks pass. Live results exactly match offline specimens** for Nomis, both AEMO regions and BoC. NZ's 11 checks/live evidence are reused from the previous completed study. Tests include wrong dimensions/dataset/geography, confidentiality flags, missing values, duplicate/missing periods, rounding discrepancies, forecast contamination, non-finite prices, quote inversion, absent business days and source-failure isolation. [Manifest](manifest.json), [contracts](CONTRACTS.md), [results](results.json) and [validation record](validation.json) contain reproduction details and dated aggregate specimens.

Before any release: implement only the chosen bounded reader/extension in the existing architecture; validate actual Cloudflare retrieval and size limits; preserve other sources on failure; verify both domains and all eight desks and established NZ/AIHW/Wales/NISRA contracts. Production workflows and credentials have not been exercised or changed by this research. No source is called “production ready” on the strength of a local demo.

The main remaining uncertainty is demand frequency and preference for Morning Rows. A permitted developer trial or repeat-query evidence for these exact tasks would strengthen prioritisation. Four reusable task contracts—not eight unrelated new APIs—are the result of this project-wide pass.
