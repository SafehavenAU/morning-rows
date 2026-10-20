# Fixed-edition Northern Ireland electricity reader

The new isolated `lib/ni-energy-summary.js` reads the newly proven ordinary DfE
article, without changing or retrying the held old report reader. The fixed
3 September 2026 edition covers July 2025–June 2026 and returns the five
independently reconciled values 50%, 8,865 GWh, 4,431 GWh, 3,855 GWh and 578 GWh.
The one-GWh component residual is publisher rounding, not a corrected total.

[Contract](CONTRACT.md) was written before code. Full own-use/GFEC, provisional
and revisions metadata comes from the explicitly hash-bound same-edition
original report. The live provenance identifies only the article. No historical
count, future-vintage support, live-workbook retrieval or newest-publication
claim is added. The different presentations share SONI/NIE/DESNZ lineage.

[Protected article access](access/worker-access.json) previously returned HTTP200,
39,615 bytes, matching the independent original hash. That initial probe establishes transport. The subsequent [actual reader proof](protected-preview/report.json) passed 19/19 protected Worker cases, including one ordinary live article GET at 2026-10-20T12:27:59.353Z: the same 39,615 bytes and original hash, all five independent values and period/unit/geography exactly matching. The other 18 cases are explicitly constructed controls through the same reader. CPU, public typed selectors and full release validation remain parent-owned.

The isolated reader and the preserved legacy reader pass 138 focused controls:
75 new and 63 unchanged. They cover exact independent references, incorrect
period/denominator/units/geography, duplicate or conflicting statements, prior
imports substitution, missing/suppressed data, bounds, redirects, bad clocks,
provenance tampering, genuine zero/signed imports and sibling preservation.
The initial method mutation found a masking issue caused by repeated method
sentences; the parser now requires every occurrence to agree. See the
[implementation manifest](implementation-manifest.json). No network request was made by those local tests. The live proof is separate.

The first protected reader attempt failed before publisher acquisition because
Workers does not implement `redirect:error`. Its [failed report](failed-redirect-mode/report.json) and exact source/tool snapshots remain unchanged. The [documented correction](redirect-mode-correction.json) changes only the option to `manual`; 3xx responses remain rejected. Local controls still pass138/138, and the corrected protected proof passes with unchanged code hashes.

This record does not activate or accept a production release.
