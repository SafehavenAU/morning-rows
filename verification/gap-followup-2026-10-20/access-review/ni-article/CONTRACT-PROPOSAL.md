# NI electricity: alternate official article, prerelease proposal

Written 20 October 2026 before any runtime change. This is a proposed acquisition
amendment for the same five `northern-ireland/electricity_balance` measures.
It does not activate the source or establish Worker access.

The Department for the Economy's existing dated news links this exact original
publication landing page:

`https://www.economy-ni.gov.uk/articles/electricity-consumption-and-renewable-generation-statistics`

This is a separate publisher-written statistical presentation. It is not an
altered URL, proxy or mirror of the refused NISRA report. No request to the
refused report was made. Two new article GETs returned 200: the first's local
excerpt-retention guard rejected a nested heading; its acquisition record is
preserved. One subsequent acquisition retained the original statistical section.
Neither is a Worker request or a recovery claim.

## Exact same measure contract

Retain the existing NI contract's geography, rolling window, GFEC denominator,
GWh/% units and lack of seasonal adjustment. For July 2025–June 2026, published
3 September 2026, the article independently presents:

| Stable ID | Publisher value | Unit |
| --- | ---: | --- |
| renewable_share_gfec | 50 | % |
| gross_final_consumption | 8865 | GWh |
| renewable_generation | 4431 | GWh |
| non_renewable_generation | 3855 | GWh |
| net_imports | 578 | GWh |

These are the same five values independently extracted from the original report
workbooks and Plotly presentation. All presentations share SONI/NIE/DESNZ
lineage; this checks presentation and selection, not independent estimation.
The component sum is 8864 versus GFEC8865 because of publisher rounding. Preserve
the original tolerance; do not replace the publisher's total.

## Acquisition and fail-closed selection proposal

One GET, no redirects, credentials or retries; 256 KiB decoded maximum and
20-second runtime budget. The observed document is 39,615 bytes. Require the
exact page title, the dated `Latest results published` heading, one identified
12-month window, the March2026 GFEC methodology statement and exact publisher
report link. A title/status200 alone is insufficient.

Select by the meaning of each article sentence, never the first matching number,
list position or subtraction. The share sentence binds renewable generation,
GFEC and percentage together. The generation sentence binds renewable and
non-renewable components. The import sentence must identify both the correct
current window and whether imports exceed exports. The earlier comparison
window's172GWh must not become the current578GWh. Unknown or changed sentence
structure must refuse rather than guess. Negative imports, genuine zero and
publisher rounding require explicit controls; do not turn absent values into0.

Require all five current observations, exactly one period, matching publication
date, reference end before publication, and publication no later than actual
retrieval. Reject stale/mixed window, wrong geography/units/denominator,
duplicates, conflicting repeated values, unsupported methodology, missingness,
HTML access pages and oversized/truncated bodies. Preserve unrelated successes.

The article omits the full own-use, revision and Statistics-in-Development
statements. Those are established in the retained same-vintage original report
and dated methodology evidence. **Do not silently certify a future article
edition under the old metadata.** Before dynamic future-vintage support, require
an accessible authoritative metadata anchor preserving those meanings. A
fixed-vintage implementation, if chosen, must disclose its publication and
snapshot explicitly and must not claim to track the newest publication.

## Remaining acceptance gates

Actual protected Worker retrieval of this exact route must succeed without
header impersonation or access workarounds. Then independently compare all five
values against retained original workbook cells and this article, implement the
minimal reviewed acquisition change, exercise the refusal controls, and run the
established full release/CPU/both-domain/monitor lineage process.

The existing DfE Crown copyright/Open Government Licence basis remains the
applicable reuse evidence:
`https://www.economy-ni.gov.uk/articles/crown-copyright-economy`.
The landing-page footer must be inspected for any conflicting notice. No
credential registration, publisher contact, scheduled acceptance, delivery
receipt or source alert is created by this proposal.
