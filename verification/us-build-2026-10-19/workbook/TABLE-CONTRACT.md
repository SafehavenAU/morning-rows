# Official database-table transport amendment — before implementation

The XLSX candidate measured 38 ms cold CPU; native inflation measured 50 ms.
Neither satisfies Workers Free's 10 ms gate. Retain those measurements; no
production activation. The linked BLS database table provides the same measure
without ZIP/XML processing. This is another original publisher presentation, not
a proxy, API-key registration, cached fixture or older-release fallback.

Read https://data.bls.gov/timeseries/CUUR0000SA0?years_option=all_years and the
supplemental index. Require the latest published historical CPI-U edition and its
paired exact-series link as in CONTRACT.md. Require table0 to reference catalog0,
whose exact series ID, title, area, item, base and NSA fields must match the original
contract. Require Year, Jan–Dec, HALF1, HALF2 headings in that order; discard both
half-year cells. Select exact year rows and monthly positions, not row offsets.
Latest monthly value must equal the index edition period, with no future values.

Required window remains all 13 calendar slots. Three-place positive decimal index
strings must retain their text; no rounding of HTML values is needed. Empty
in-window cells remain missing, -(X) remains unavailable only with the exact
publisher lapse-in-appropriations explanation. Accept R only with exact Revised
explanation. Reject unknown flags, markup in scalar cells, suppressed-as-zero,
negative/nonfinite values, duplicate/missing years/cells, mismatched headers and
older-release substitution. Keep publication time unknown and distinguish fetch
and verification time. Stable series citation remains the BLS bulk reference;
actual table/index URLs and source hashes appear in all selected-response context.

Independent check: Python html.parser against the retained official table,
compared with Python XML extraction of the original workbook and independently
read bulk/API/release evidence. All 13 values/states must agree exactly; geographic,
population and adjustment assertions must hold. Retain the minimal catalogue,
headers, two relevant year rows and original footnotes, plus original response hash.
All presentations share BLS statistical lineage. Re-run actual Worker error/cache/
conditional tests and cold CPU measurement. <=10 ms is required before activation;
HTTP success or a wall-clock improvement does not waive this gate.

## Bounded-year request amendment — 19 October, before implementation

The native bounded-byte candidate still measured12ms cold CPU. The official
database form supports `years_option=specific_years`, `from_year`, and `to_year`.
Request the earliest year required by the index-selected13-month window through
one year after the later of the acquisition UTC year and the selected edition
year. This removes irrelevant earlier history without using the machine clock
to choose an observation period or impose age-since-change staleness. A stale
index still requests every subsequent year through the acquisition horizon;
newer returned rows/months must fail the existing edition-mismatch checks.

Read the index first, then this bounded original table; no fixed edition, cached
specimen or older-release fallback. Retain exact requested URL and original
response hash. Require all13 values/states, dimensions, columns and footnotes
to match the independent original-workbook/bulk evidence exactly. First-request
failures may now make one upstream call rather than two. All existing semantic,
missingness, revision, cache and <=10ms CPU requirements remain unchanged.
