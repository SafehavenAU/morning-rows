# US onboarding decision — 17 October 2026

**Recommend one first offering: exact-month national CPI-U reference indexes for recurring annual price reviews.** Use original BLS `CUUR0000SA0`, retain 13 calendar months, and refuse an adjustment when either requested month is unavailable. This is a recommendation to implement behind explicit gates, **not a production-ready integration**. Production remains unchanged. An isolated compatibility prototype and protected Cloudflare remote-dev rehearsal were added for planning; no production US integration, binding, credential change or release occurred.

**Latest planning validation:** the [executable step-by-step plan](EXECUTION.md) and [rehearsal record](rehearsal/README.md) prove the compatibility boundary and frame derivation. Live BLS access fails with 403 from Cloudflare despite successful workspace replay, so release is blocked.

The [contract](CONTRACT.md) defines the statistical boundary. The [implementation plan](PLAN.md) specifies compatibility, affected files, preview/release gates and rollback. [Results](results.json), [task evaluation](evaluation.json), [validation record](validation.json), [specimen manifest](manifest.json) and [access probes](probes.json) make the decision reproducible.

## Demand: why this task

The repository's preceding [project-wide research](../project-demand-2026-10-17/README.md), source inventory and unfinished queue contain no demonstrated US request history. No private request logs were available or accessed. This recommendation therefore rests on public implemented workflows and reported tool failures, not measured Morning Rows usage.

| Underlying evidence | What it establishes | Independence/limit |
| --- | --- | --- |
| [Docusign price-adjustment agent](https://github.com/docusign/mcp-agent-foundry-procurement-python), [pinned BLS tool code](https://github.com/docusign/mcp-agent-foundry-procurement-python/blob/f6802bf28c1d60b1dda45c3044df7b98e56029b7/adjustment_agents/bls_agent.py) | Public implemented agent workflow identifies expiring agreements and retrieves this exact CPI series to calculate price adjustments. The tool uses effective/current months and has nearest/latest-period fallback branches. | Authored vendor demonstration, not user transcripts, production adoption or volume. The fallback's risk for an explicitly specified month is our static-code finding; we did not execute Docusign integrations or allege an observed incorrect customer payment. Forks are the same evidence lineage. |
| BLS MCP maintainer reports [#53](https://github.com/cyanheads/bls-labor-mcp-server/issues/53), [#55](https://github.com/cyanheads/bls-labor-mcp-server/issues/55), [#58](https://github.com/cyanheads/bls-labor-mcp-server/issues/58) | Reproductions describe annual averages entering monthly histories/latest readings, and missing sentinel rows disappearing from a mirror. CPI series appear explicitly in #53/#55. | Direct developer/tool-failure evidence; all are from one repository and were closed when checked. They are not three independent customers or currently unresolved claims. #58's example is another BLS series, a relevant missingness mechanism. |
| [Pinned Browser Use FRED retrieval skill](https://github.com/browser-use/browser-harness/blob/fb1a51dd9ba7c9891b2b279c15aa148d6edba2e2/agent-workspace/domain-skills/fred/scraping.md) | Authored agent workflow maps NSA CPI to `CPIAUCNS`, offers BLS as a no-key alternative and reports headless FRED access failures. | Separate project, but not an observed end-user request. **Our FRED CSV request succeeds**, so its blanket timeout claim is not treated as current fact. |
| [BLS escalation guidance](https://www.bls.gov/cpi/factsheets/escalation.htm) | Official use guidance describes recurring escalation and requires population, area, series, base and reference period choices. | Independent institutional-use proxy, not evidence of agent demand or usage counts. |

The recurring task is plausible because agreement reviews recur and published code automates them. The hypothesis is that a narrow, qualified, exact-period interface will be preferable to bespoke retrieval. **No evidence yet establishes how often people will use Morning Rows, willingness to switch, or repeat visits.** The source earns a bounded pilot because the task, exact series and reproducible failure mechanisms align—not because CPI is a familiar macro indicator.

## Two candidates, one underlying statistical source

Multiple BLS transports are competing access methods for one source. FRED is the second candidate and republishes BLS; no third agency was evaluated because a different inflation concept would not answer the chosen question.

| Property | BLS original data — recommended | FRED `CPIAUCNS` — cross-check/alternative |
| --- | --- | --- |
| Questions supported | Exact national urban NSA index for a specified month; ratio/change between two published months | Same index-level questions after confirming mapping and metadata |
| Tested original access | [Bulk all-items file](https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems), [series metadata](https://download.bls.gov/pub/time.series/cu/cu.series), [footnotes](https://download.bls.gov/pub/time.series/cu/cu.footnote), v1/v2 API GET; all HTTP 200 | [Bounded CSV](https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS&cosd=2025-01-01) and [series page](https://fred.stlouisfed.org/series/CPIAUCNS): HTTP 200. API without a key: HTTP 400, explicit missing-key error. |
| Access constraints | No key for bulk or documented v1 API. [API FAQ](https://www.bls.gov/developers/api_faqs.htm): 25 queries/day unregistered, 500 registered, plus request/series/year limits. Tested v2 no-key GET succeeds, but documentation reserves v2 capabilities for registration; do not rely on that behavior. | CSV works without a key here. Supported REST API requires a manually obtained key; none registered. Public CSV availability does not establish API-like service guarantees. |
| Identifiers/coverage/history | Series metadata explicitly says `0000`, `SA0`, `U`, `R`, `S`, `1982-84=100`; starts January 1913, current end September 2026. Only the one national series/13 slots are proposed. | Exact mapping to `CPIAUCNS`, monthly, NSA, same index base; `CPIAUCSL` is the wrong adjusted series. Long history exists; only 2025 onward transport and 13 selected slots checked. |
| Time/revisions | Monthly; archived release confirms 14 October 2026 08:30 ET and next scheduled 10 November 08:30 ET. NSA corrections possible; no as-of archive through the chosen bulk path. | Updated 14 October 2026 08:08 CDT, after BLS's 08:30 ET publication. Republisher update is not original release time. The tested CSV is latest vintage, not a demonstrated ALFRED vintage retrieval. |
| Missingness | October 2025 `-` with footnote X, unavailable due to appropriations lapse. Original annual-average `M13` row retained in specimen only to test exclusion. | CSV preserves an empty October slot but loses its reason. API conventions may differ; authenticated API not tested. |
| Rights | [BLS public-domain policy](https://www.bls.gov/bls/linksite.htm), excluding copyrighted illustrations/photos; aggregate extracts retained, cite BLS. | Series labelled public domain/citation requested; [FRED terms](https://fred.stlouisfed.org/legal/) require source acknowledgement, e.g. BLS via FRED. Do not generalize this licence to all FRED data. |
| Reliability observed | Two complete captures agree. Bulk GET is 2,690,809 bytes; series metadata 1,339,447 bytes. Conditional ETag request still returned 200/full body here. v1 ignored the tested GET year bounds and included 2024 plus M13; v2 returned 2025–26. | Two captures agree. CSV is only 418 bytes for the tested 21-month response; no timeout reproduced. No measured long-term uptime or Cloudflare egress reliability. |
| Improvement offered | Fixed statistical selection, exact-period refusal, unavailable reason, explicit monthly window, versions/citations. Avoid per-user API quota consumption via an existing Worker cache and bulk source, subject to runtime gates. | Could add missingness/definition/provenance context, but introduces republisher dependence; its compact CSV is already efficient. No reason to silently substitute it when BLS fails. |

Manual setup options are recorded in [manual-access.json](manual-access.json). Neither is required for this demonstration. A key alone would not fix period, missingness or global quota problems.

## Real-data demonstration and reconciliation

The selected window has **13 slots: 12 numeric and one explicitly unavailable**. The raw bulk file also includes the 2025 annual average, 321.943; it is excluded, not mistaken for a month or used to fill October.

| Constructed question, grounded in the workflows | Demonstrated answer |
| --- | --- |
| Annual reference change, September 2025 to September 2026? | 324.800 → 336.940; factor **1.037376847290640394…**, change **3.737684729…%** (3.74% displayed). A constructed USD1,000 example, final cents rounded half-up with no cap/floor, yields **USD1,037.38**. This is not an observed agreement or legally determined payment. |
| Can October 2025 be the numeric base? | **Unavailable**, original footnote X retained. No ratio, carry-forward, interpolation or annual-average substitution. |
| Exact October 2026 index? | Not retained/not yet published at check time; no September substitution. Next release is scheduled for 10 November. |
| Additional development case: December 2025 to June 2026? | 324.054 → 333.952, **3.05%** displayed. These explicitly selected months are not a year-on-year comparison. |
| Held-out November 2025 to February 2026 comparison? | 324.122 → 326.785, **0.82%** displayed; not an annual comparison. |
| Held-out DC-only index or quarterly average? | Unsupported geography/period convention, explicit refusal. DC's inclusion in the national target does not supply a separate DC index. Development tests also reject New York and USD units. |

The bulk TSV reader, an independent API parser, and FRED CSV agree on all 13 slots. The separate HTML parser reads archived BLS **Table 1**, row `cpipress1.r.1` (All items), unadjusted index header group `cpipress1.h.1.3`, columns `h.2.3`/`h.2.4`/`h.2.5`: September 2025 **324.800**, August 2026 **334.980**, September 2026 **336.940**. Levels agree exactly to three decimals; the computed annual change rounds to the release's **3.7%**, within 0.05 percentage points. Caption, headers and row are retained, so seasonally adjusted columns cannot be selected merely by position.

These are independently parsed presentations of **the same BLS statistical estimates**, not independent estimation of inflation. FRED adds distribution lineage, not a separate survey. No component total is tested because this price index is non-additive: summing or simply averaging category/area indexes would be wrong. The review does not reconstruct BLS sampling, weights, imputation or uncertainty.

The [shutdown FAQ](https://www.bls.gov/cpi/additional-resources/2025-federal-government-shutdown-impact-cpi-faq.htm) confirms the real missing value and says affected October 2026 12-month changes will not be published. That expected refusal is a first-release requirement, not a reader outage. [Current sample design](https://www.bls.gov/opub/hom/cpi/design.htm), [sample-area definitions](https://www.bls.gov/cpi/additional-resources/geographic-sample.htm), [CPI population FAQ](https://www.bls.gov/cpi/questions-and-answers.htm) and [BLS territory collection statement](https://www.bls.gov/bls/hurricanes-harvey-irma-maria.htm) support the scope. The follow-up [primary frame derivation](rehearsal/geography-evidence.json) resolves the earlier gap using the original 381/536 CPI CBSA frame and OMB's explicit US/Puerto Rico split. It is a documented derivation, not one verbatim all-territories sentence. Keep the exact BLS geography label.

## Evaluation and retrieval effort

Six authored tasks (three representative, three held-out) pass the deterministic correctness, required-field, caveat and citation checks in [evaluation.json](evaluation.json). Twenty semantic tests cover actual M13/missing data plus constructed geography, units, period, malformed/duplicate/partial rows, zero anomaly, suppression, revision, failure and recovery. The final held-out inputs were chosen after freezing the reader: a new interval, DC-only geography and quarterly aggregation. The reader hash is recorded and no reader changes followed that run. The same researcher wrote the implementation/tests and had seen the underlying dataset, so this is not a blinded assessment.

The independent Codex client was attempted and failed before any task/tool execution because its separate login could not refresh. [Validation record](validation.json) preserves the sanitized outcome. No autonomous agent accuracy, intervention count, latency improvement or retention result is claimed.

| Retrieval today | Proposed representation | Demonstrated comparison |
| --- | --- | --- |
| Morning Rows US route returns 404; catalogue lists eight desks | Explicit ninth-desk discovery, one defined measure, bounded history | Current production response verified; proposed routes remain a plan. |
| BLS API returns known-series data in one call, but metadata needs other material; tested v1 includes unrequested years/M13 | Fixed monthly selection and definitions, one call once the measure URL is known | Same available index values; explicit missing reason preserved. Bulk + metadata + footnotes is three cold source fetches, not an upstream-call saving. |
| FRED CSV is concise but the empty cell lacks its cause | Exact gap explanation, caveats and source citations | Raw tested CSV 418 bytes; proposed full 13-slot representation **5,523 bytes**. More metadata costs bytes. The annual answer is **1,812 bytes**. No claim of beating the raw API/CSV on size. |
| Docusign code permits nearest/latest-period choices | Explicit requested-month refusal | Static-code comparison and constructed boundary tests, not a live Docusign agent experiment. |
| Repeat raw retrieval needs client logic to distinguish changes | Stable observation IDs and semantic versions; changed health remains visible | Deterministic same-value/retrieval, revision and failure cases pass. Isolated Cloudflare fixture cache/conditional behavior now passes; real original-source access fails, and final integrated routing remains a gate. |

The added value demonstrated is semantic reliability and traceability. Whether agents prefer it remains an adoption hypothesis. First discovery would take four planned requests (`llms.txt`, v2 catalogue, source directory, measure); an already configured raw BLS client may need fewer. Unknown original historical publication times remain null. The demo is an isolated proposal representation, not certified against a deployed schema v2.

## Reproduce

From the repository root:

```sh
python research/us-onboarding-2026-10-17/demo.py
python research/us-onboarding-2026-10-17/test_demo.py
python research/us-onboarding-2026-10-17/evaluate.py
python research/us-onboarding-2026-10-17/capture.py --live --output /tmp/mr-us-fresh
python research/us-onboarding-2026-10-17/demo.py --specimens /tmp/mr-us-fresh/specimens
```

The live capture makes six read-only public requests, including one quota-counted BLS API call. It cannot overwrite the dated specimens. It is a fixed September 2026 verification, not a latest-release job; after metadata moves to a newer period, strict replay may fail and must be investigated rather than updating expected figures blindly. The two captures in this run have equal semantic versions, comparisons and answers, with different genuine retrieval times.

## Production boundary and remaining gates

Both domains still report clean source `7d614e2e78a63fc16f705b67e35ed0438baa7d87`, Worker `739b9031-305c-4bc7-afc5-79a82c654ac7`. Eight-desk catalogue/schema match. Existing full-site smoke checks retain working sources on all desks and pass the Stats NZ, AIHW, Wales and NISRA contracts. **The optional NZ electricity-price gate fails on both domains:** EMI timed out again at 11:02, 11:06 and 11:14 UTC, while 23 Stats NZ observations remain valid. This recurrence was notified once and recorded separately from the US recommendation. A transient Australia grid timeout recovered by the final recheck. No US code is running and no causal deployment regression is inferred. [Supplemental production record](production-status.json). Other acknowledged upstream blocks remain quiet.

US release is **NO-GO today**: repeated Cloudflare BLS bulk/metadata/footnote requests return 403. Geography-frame evidence and isolated compatibility tests are complete; the real production implementation, working original-source runtime access and final operational validation remain mandatory. The existing NZ price gate must recover or receive an explicitly documented release exception; it must not be hidden by weakening a test. There is no need to register keys for this plan. The pending Nomis/MBIE/AEMO/BoC and other source queue is unchanged.
