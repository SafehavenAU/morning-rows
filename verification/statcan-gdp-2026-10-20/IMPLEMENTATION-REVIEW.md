# Independent GDP integration review — 20 October 2026

Reviewed the new information/selector/schema and existing Canada execution path
against the committed GDP contract. Runtime reader author independently reviewed
the separate information implementation. This is code/offline evidence, not a
Cloudflare performance or production acceptance result.

## Outcome and corrected finding

The native guard runs before cell extraction and requires source health `ok`, a
valid retained retrieval instant, exact native semantics and current-cube two-
quarter coverage. Source selection preserves native legacy fields; level returns
two adjacent quarters, exact observation returns the requested retained quarter,
and growth returns only the latest ordinary comparison. Historical/monthly aliases
return 404, unsupported geography/history queries return 400, and failed native
validation returns 503 with no observations. Raw unzoned release times remain raw
and publication instants remain unknown.

Observed GDP record versions include only the quarter-specific level, definition,
flags and raw release. Growth includes both input rows. Native row offsets and
source acquisition hashes/clocks do not manufacture statistical revisions. A real
revision changes its level and the dependent growth identity version. Rolling
windows preserve an unchanged retained level's version.

A concrete schema identity bypass was found and corrected with root approval:
removing/changing `source` could evade the GDP conditional and permit wrong units;
retaining source with an external selected `id` also passed. The GDP conditional
now applies independently when either canonical GDP source or GDP id is present,
requires the exact canonical source and anchors all permitted source/measure/
observation identity forms. Nine matching schema negatives were added. Existing
claimant structural assertions now count their five national conditions rather
than assume that no other source can add an `allOf` clause.

Verification: 34 tests across GDP, claimant and rent interface suites passed;
GDP schema checks cover 10 positive and 65 negative cases. Reader tests previously
passed 117 including mutation subtests. Cross-field arithmetic and relationships
remain the runtime validator's job; JSON Schema is explicitly structural and the
published usage note states this boundary.

## Request and budget assessment

The GDP branch replaces one POST with three concurrent POSTs. The two additional
metadata responses are currently 473 and 11,686 bytes, adding 12,159 bytes; all
three original inputs total 12,778 bytes. Data/series bounds are 16 KiB each and
cube metadata is 128 KiB, for a combined maximum of 160 KiB before parsing.

One shared AbortSignal.timeout(20000) covers all three fetches and streamed bodies.
This is a maximum shared source deadline, not three sequential 20-second waits.
The existing four-section outer concurrency, bounded error isolation and full-
desk cache remain unchanged. GDP waits for all three sources to agree; a partial
metadata failure or release rollover causes explicit source failure rather than
using cached metadata as proof of a different release. This is intentional.
Successful Canada desk cache is one hour; degraded cache is 30 seconds, so the
added requests run on the existing cache miss rather than every selected render.
The selected-source endpoint still uses the full Canada desk cache/acquisition.

The retained prior rent candidate Canada measurement was 34 ms CPU and 11,067 ms
wall time; that predates this GDP reader and is not its budget result. Original
workspace acquisition durations (~0.74 s data, ~0.38 s cube, ~0.42 s series) are
individual observed public HTTP reads, not an edge SLA or a percentile estimate.
No required optimization is established by this evidence. Keeping metadata tied
to each fresh acquisition is required for correctness. Actual fresh Canada
candidate CPU and network validation remain release gates; no new infrastructure,
metadata cache, sequential lookup or broader Canada refactor is warranted now.
