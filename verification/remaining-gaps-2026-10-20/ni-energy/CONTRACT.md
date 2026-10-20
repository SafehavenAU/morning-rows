# Northern Ireland electricity balance — bounded implementation contract

Written 20 October 2026 before runtime code. This implements the separately
authorised phase-two NI energy gap, using the frozen
[`prior-audit/ni-energy`](../prior-audit/ni-energy/README.md) evidence. Runtime and
release acceptance remain distinct from that evidence.

## Exact answer and identities

Proposed desk/source: `northern-ireland/electricity_balance`. Exactly five
publisher aggregates for one latest published, completed rolling twelve-month
window:

| Stable measure ID | Meaning | Unit | July 2025–June 2026 specimen |
| --- | --- | --- | ---: |
| `renewable_share_gfec` | Indigenous renewable generation / gross final electricity consumption | % | 50 |
| `gross_final_consumption` | Generation plus imports minus exports | GWh | 8,865 |
| `renewable_generation` | Renewable generation, including metered and own use | GWh | 4,431 |
| `non_renewable_generation` | Non-renewable generation, including metered and own use | GWh | 3,855 |
| `net_imports` | Imports minus exports; negative means net exports | GWh | 578 |

Geography is Northern Ireland only. Values are unadjusted physical electricity
volumes or a ratio of those rolling totals, not monthly averages, grid-only
generation, the share of total generation, retail consumption, the whole island
of Ireland or UK totals. The methodology is the gross-final-consumption basis
first published in March 2026; do not splice the superseded consumption basis.
The publisher calls these Statistics in Development. No historical API, fuel
breakdown or derived growth is included.

## Acquisition and selection

Fetch the fixed official no-key [NISRA/DfE HTML report](https://datavis.nisra.gov.uk/Economy/electricity-consumption-and-renewable-generation-report.html)
once, with a 20-second request budget and a maximum 6 MiB uncompressed response.
Do not fetch external scripts, images, arbitrary links, archives or the malformed
CSV exports. From that report select exactly one embedded XLSX named for Figure
1 and one for Figure 3, matching their displayed labels and publication month.
Each compressed XLSX is limited to 64 KiB, 32 ZIP entries, 256 KiB per selected
XML part and 512 KiB total selected XML expansion. Reject duplicate archive
members, external worksheet relationships, macros, formulas, DTD/entities,
unknown cell encodings and alternate date epochs.

Require the exact report title, Northern Ireland coverage, Quarterly frequency,
Statistics in Development status and explicit gross-final/own-use/revision/
whole-percentage methodology. Read its publication date and publication period;
retain the date without inventing a publication time or timezone. Both workbook
titles must identify the same latest ending month as the current report.
Validate explicit Figure 1 rolling/monthly headers and Figure 3's four named GWh
columns. Do not select by workbook order or fixed cell B94.

Workbook dates are first-of-month Excel-1900 serials, starting December 2018,
strictly increasing and contiguous, with at most 240 monthly rows. The two
tables must have identical date coverage. Reject duplicated/reordered dates,
missing latest cells or a complete older window inconsistent with the report.
Only the latest five cells are emitted. A changed future layout or methodology
is a source failure requiring review, never permission to guess.

Period identity is `YYYY-MM-DD/YYYY-MM-DD`, inclusive, starting the first day
eleven months before the ending month and ending its final day. The report's
stated start and end must agree. The reference end must precede the publication
date; neither reference end nor publication date may be after the real UTC
acquisition date. Unchanged quarterly observations stay valid.

## Values, revisions and falsifiable acceptance

All five observations must be finite publisher integer values. GFEC is positive;
generation and the percentage are nonnegative; net imports may be signed.
Preserve zero. Blank, unknown, formula/error, suppression and nonnumeric cells
must fail rather than become zero. No upper clamp of 100% is imposed, because
net exports can make renewable generation exceed GFEC.

Return the publisher's values, without replacing them with recomputation.
Rounded component sum may differ from GFEC by at most 2 GWh. The percentage may
differ from `100 * renewable_generation / GFEC` by at most 0.5 percentage points.
The current one-GWh residual passes. Values and earlier periods may be revised;
include the publication date, methodology and explicit revision status.
Acquisition bytes/hashes/times are provenance and must not alone revise an
individual observation's statistical version.

Acceptance requires five exact matches against independently extracted
Python ZIP/XML cells and the corresponding official chart plus the dated DfE
news for the retained vintage. Presentations share SONI/NIE/DESNZ lineage; this
does not independently recompute electricity generation. A live changed release
needs new matched evidence before acceptance, without silently applying the old
reference values.

Focused failures must cover wrong geography/denominator/header/unit, monthly
substitution, old methodology, mixed/old windows, partial latest rows,
duplication/reordering, unknown markers, zero coercion, invalid ZIP/XML,
resource bounds and acquisition failures. Valid controls include negative
imports, zero generation, rounded residuals and unchanged annual observations.
Public native validation must check the complete contract and supplied real
clock. A source failure must preserve unrelated successful sources.

## Reuse and release boundary

Publisher: Department for the Economy, Northern Ireland; report hosted by NISRA.
Retain attribution and the [DfE Crown copyright/OGL policy](https://www.economy-ni.gov.uk/articles/crown-copyright-economy)
without implying endorsement. Retain only statistical/methodological evidence,
not contact names, phone numbers or footer metadata.

Implementation is isolated in `lib/ni-energy.js` and focused tests. Parent owns
inventory, worker/typed-interface/schema/monitor integration and versioned
release. Protected actual-reader success, CPU/resource gates and both-domain
regression checks are required before release acceptance. No credential,
registration, notification, checkpoint or schedule change is authorised here.
