# BLS CPI-U workbook transport contract — 18 October 2026 UTC

Written before workbook reader implementation. The measured clean bulk candidate
658e23e9-6533-4510-983d-b73c35c2a99d used 87 ms CPU on its cold selected read;
the user confirmed Workers Free / 10 ms. HTTP 200 is not resource acceptance.
Normal traffic remains on approved 739b9031 at 100%; candidate is 0%.

## Exact statistical contract

Only CUUR0000SA0: BLS all-items CPI-U, U.S. city average, all urban consumers,
50 states and DC urban population, not rural households or territories; monthly
calendar index, 1982–84=100, not seasonally adjusted. This remains the same
one-series contract. No annual averages, seasonal series, local estimates,
percentages or dollars. NSA is not routinely revised, but corrections are possible;
re-read the latest publisher edition, expose changed values as changed content,
never claim a vintage archive or preserve an older release after failure.

Read the official supplemental-files index, select the greatest YYYYMM linked
Historical CPI-U edition, and require its adjacent official database link to name
CUUR0000SA0. Do not construct an unpublished URL or fall back to an older edition.
The selected workbook must have the exact Index values sheet, resolved through
its internal relationship, exact U.S. city average/all items/all urban consumers
heading, 1982–84=100 heading, Year and Jan.–Dec. column labels. Index averages is
never a data source. Reject formulas, external relationships, ambiguous cells,
unknown notes and unexpected value forms in the selected sheet.

Map year column B and month columns C:N. For September 2026 the retained window
is September 2025–September 2026 (K118:N118 and C119:K119). Use year labels and
month headings, not fixed row numbers. Require all 13 exact calendar cells and
latest data consistent with the edition; no future numeric cell or missing latest
month. No silent substitution when a new linked edition is unavailable.

Numbers use three published decimal places. XLSX stores binary floating-point
artifacts: allow at most 1e-9 index point between the raw number and its three-place
rounding. Preserve three-place decimal text. A changed value of 0.001 must survive.
Zero, negative, nonfinite, strings pretending to be numbers and unsupported cell
types fail. A dash is not zero. Only October 2025 plus the exact publisher note
about the 2025 lapse in appropriations maps to unavailable/X. Other in-window
dashes remain missing with no invented reason. A numeric October plus that note
is inconsistent and fails. Unknown suppression or revision qualifications fail
for review; unflagged numerical corrections produce changed values and versions.

Publication time remains unknown; retrieval time and this verification time are
separate. Unchanged monthly values are valid. Keep the bulk series as the stable
reference citation and explicitly expose the actual workbook/index URLs, hashes,
edition and extraction mapping in provenance. No runtime retained specimen.

## Evidence and falsifiable acceptance

Retain the original 24,238-byte workbook (BLS public-domain aggregate data) dated
18 October 2026, SHA-256 473d3f67308952760245ff65946457a92ebde2bad3d8ba9db1ede89c89222d35.
Extract it independently with Python zipfile + ElementTree. Compare all 13 slots
against the separately extracted original bulk/API evidence and the official
release table: September 2025 324.800, August 2026 334.980, September 2026 336.940,
annual change rounded to one decimal 3.7%. All outputs share BLS statistical
lineage; the methods and presentations are independent, not the estimate.

Structural pass: bounded ZIP/parts, correct relationships, headers, typed cells,
exact 13-cell coverage and fail-closed schema validation. Numerical/semantic pass:
13/13 exact three-place values and states, no wrong dimensions/period/base, correct
October note, official headline reconciliation. Mutation tests must reject wrong
geography/population/base, wrong sheet, older edition, changed latest month,
missing cell, duplicate year/cell, future numeric month, formula, suppression/zero
and unsupported note; retain legitimate corrections and explicit missing values.

Resource acceptance: actual final Worker on Cloudflare, 0% candidate plus explicit
version override; measured cold request <=10 ms CPU, plus selected/full/cached/
conditional paths, no exceptions, correct version identity and current values.
If measured budget fails, do not activate production. Local timing and protected
remote-dev responses are not production CPU proof. Follow final release regression
gates for all eight existing desks and both domains before claiming acceptance.
