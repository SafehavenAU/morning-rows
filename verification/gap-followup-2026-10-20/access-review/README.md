# Held-access review — 20 October 2026

Research only. No source activation, credentials, publisher contact, deployment,
checkpoint change or scheduled evidence is created here. UK CPI was not
reopened. Existing failures remain retained. The review sought official
published alternate resources, rather than changing a refused URL or using an
unofficial proxy.

## Actionable route: NI electricity article

The [DfE publication landing page](https://www.economy-ni.gov.uk/articles/electricity-consumption-and-renewable-generation-statistics)
is an official statistical presentation linked from the previously retained DfE
news. A new ordinary GET returned HTTP200 and 39,615 bytes. All five exact
July2025–June2026 figures match the retained independently extracted report:
50%, 8865/4431/3855/578GWh. The latest-publication heading identifies3September2026
and the overview identifies the March2026 GFEC methodology. The original
datavis report was not retried.

See [proposed bounded acquisition contract](ni-article/CONTRACT-PROPOSAL.md),
[exact comparison](ni-article/comparison.json) and the two acquisition records.
The first200 response's nested contact heading caused a local retention failure;
that record is preserved. One new acquisition retained the statistical excerpt
and the DfE copyright link. Both wire hashes match. No publisher failure or
recovery is inferred from the retention defect.

The article lacks the full own-use/revision/Statistics-in-Development statements.
An implementation must bind the same-vintage original metadata and fail closed
on a future edition, or establish a new accessible metadata anchor. A fixed
publication must be labelled as such. Same-vintage corrections require fresh
exact approval. The existing [DfE copyright/OGL evidence](https://www.economy-ni.gov.uk/articles/crown-copyright-economy)
remains applicable; the new article's footer points to that policy.

Root subsequently reported a successful protected Worker probe of the exact
article with the identical wire hash. That probe is separate evidence owned by
root, under `/tmp/mr-followup-ni-access-20261020`; this research comparison does
not itself assert integrated production acceptance.

## Useful alternate evidence: CQC official GOV.UK PDF

The [CQC publication on GOV.UK](https://www.gov.uk/government/publications/state-of-health-and-adult-social-care-in-england-2024-to-2025)
links an original [government-hosted PDF](https://assets.publishing.service.gov.uk/media/68fa3b4fe200d653d8b63735/care-quality-commission-state-of-health-care-and-adult-social-care-England-2024-2025.pdf).
It returned200 and7,175,967bytes. Printed pages186–187 (PDF indices187–188)
present the exact same five historical cohort counts125/809/2063/65/3062,
1August2025 snapshot, single assessment framework and risk/service-level
qualifications. The new extraction matches the old independent workbook/SVG
reference; shared CQC administrative lineage remains.

[Acquisition](cqc-gov-pdf/acquisition.json), two-page excerpt and
[comparison](cqc-gov-pdf/comparison.json) are retained. The original workbook
was not retried. A separately published CQC PDF and charts-page search fetch
returned403 and were not retried. GOV.UK exposes this PDF and a CQC HTML link,
not a newly discovered tabular export. A production PDF parser and its resource
budget remain unproved. Do not activate a static extracted-data fallback.

## AEMO: alternate report family exists, runtime gate remains

The official [AEMO NEMWeb page](https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/market-data-nemweb)
embeds [the NEMWeb data interface](https://web.nemweb.com.au/), which explicitly
links current and archive public reports. The retained earlier evidence already
contains two successful `Public_Prices` ZIP acquisitions:254,309 and260,373bytes,
expanding to1,109,187 and1,118,267-byte CSVs. Their DREGION values independently
reconcile all576 selected prices with monthly CSVs. See
[`aemo/original/acquisition.json`](../../gap-pass-2026-10-20/aemo/original/acquisition.json)
and the [existing verifier](../../gap-pass-2026-10-20/aemo/verify-original.py).

This route was not the refused monthly-CSV runtime route, and its original
success is workspace evidence, not new Worker access. No price endpoint was
retried here. A bounded acquisition amendment could use the documented daily
bundles only after genuine Worker access and resource proof. It must combine two
NEM trading-day bundles for one fixed-AEST calendar day, retain run/intervention
flags, reject incomplete/duplicate intervals, and handle five-decimal DREGION
prices consistently with the existing per-interval cent-rounding contract.
The retained files were generated about04:05AEST: availability in the first
hours after calendar midnight is not established. Never substitute an older day
or claim stable publication latency from these two filenames.

The [AEMO dashboard documentation](https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem)
distinguishes dispatch history from forecasts and daily/peak averages.
Neither a rolling48-hour chart nor a daily-average table independently supplies
all required interval cells and sign counts. Existing attribution and mutable
market-data qualifications remain; no new licence assertion is made.

## ONS bedroom rent: documented prerequisite, no new exact export

The [ONS bot and rate-limit guide](https://developer.ons.gov.uk/bots/) instructs
automation to respect429 `Retry-After` and to use an honest named/versioned
User-Agent with an organisation URL/contact, without personal identifiers.
Published limits are dynamic; low local request volume alone does not prove a
request will be accepted. This documents appropriate future access behaviour;
it is not evidence that the existing429 is solved or permission to impersonate
a browser. The held JSON and dataset-index URLs were not retried.

The [API introduction](https://developer.ons.gov.uk/) and
[dataset catalogue documentation](https://developer.ons.gov.uk/dataset/datasets/)
describe public no-key versioned datasets. They do not establish that the exact
Manchester bedroom-level monthly estimates are exposed as API observations.
An old regional rental **index** is not a replacement for four local rent
**levels**. No invented API ID, alternative geography, unofficial reprocessor,
credentials or UK CPI call was used. Remaining prerequisite: a publisher-
documented exact export or permitted usable access to the held current-release
resources, followed by actual Worker and same-vintage numerical proof.

## AER: no usable replacement established

The [wholesale charts page](https://www.aer.gov.au/industry/wholesale/charts)
and [performance-report index](https://www.aer.gov.au/industry/wholesale/performance)
describe quarterly updates and current charts. The2026 annual report focuses
on2025 outcomes; it does not establish an exact latest-quarter five-region CSV
replacement. Documentation navigation resolves back to the existing market-
statistics collection and quarterly chart. No original GET of the known503
CSV, chart or collection was repeated; search-service documentation may expose
those existing links, which is not a new transport success.

The [prior AER review](../../gap-pass-2026-10-20/held-queue/aer/README.md)
retains the exact original CSV URL and503 evidence. The remaining prerequisite
is usable publisher-original data and exact independent numerical comparison.
Retain applicable AER/AEMO attribution and third-party exceptions: the AER
CCBY policy is not blanket permission for ASX, Argus or all other upstream data.
No publisher contact, account, registered key or changed transport identity was
attempted. AER remains blocked, not completed.

## Reproduction and evidence limits

The two comparison scripts are offline:

```sh
python verification/gap-followup-2026-10-20/access-review/ni-article/verify-article.py
python verification/gap-followup-2026-10-20/access-review/cqc-gov-pdf/verify-cohort.py
```

`acquire-originals.py` documents bounded original acquisition and refuses to
overwrite its acquisition record. Do not rerun it routinely. A wire hash is
distinct from a transformed minimal excerpt hash. The NI/CQC comparisons rely
on the exact retained originals; documentation-only findings above rely on
the linked official pages reviewed through Search Service on20October2026.
Search-service retrieval is not proof of Worker connectivity or an original
HTTP byte/status record. No whole-site sweep was performed.
