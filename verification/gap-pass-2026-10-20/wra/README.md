# WRA existing tax-due depth

The contract predates the implementation. This adds typed selection for the
existing four Welsh Land Transaction Tax cells; acquisition and native aliases
are preserved.

Fresh original CSV and metadata were acquired on 20 October 2026. The official
HTML table was acquired separately at 09:29:58 UTC. Independent Python
`csv`, `HTMLParser` and decimal extraction reconciles all four 2025–26 cells:
371, 370.8, 294 and 76.8 GBP million, with matching revision notes and exact
coverage. Metadata identifies revision
`8d10f1e5-c8d2-4921-9c67-2707bf631a87`, published 25 September 2026 at 08:30 UTC.
The runtime reader is compared separately against that report.

Both presentations share WRA/StatsWales administrative lineage. They provide
independent presentation and extraction, not independent statistical production.
The two inclusive category cells marked Not Applicable remain absent; they
are not zero. Inclusive and disclosed totals overlap. Effective-year tax due
is not cash receipts or accounting revenue, so the separately encountered
annual-accounts revenue figure was not used as corroboration.

The existing CSV acquisition is retained. Definitions explain Wales, nominal
GBP million, effective financial year, disclosure coverage, revision behavior
and overlap. Runtime validation rejects wrong identities, periods, geography,
units, missing/duplicated/suppressed cells and impossible component arithmetic.
Three focused test groups pass, including explicit missing-clock refusal.
Worker preview and both-domain release acceptance are recorded in the parent
release evidence when completed.

The initial official HTML page and page 2 did not reach the selected year.
Requesting the ordinary public table at `page_size=100` exposed the required
rows; no authentication or access-control bypass was used. The first runtime
comparison harness attempt failed because its relative module path went one
directory too far. The path alone was corrected; that attempt is not a pass.

Reproduce without overwriting retained reports:

```sh
python verification/gap-pass-2026-10-20/wra/verify-original.py \
  verification/gap-pass-2026-10-20/wra/original /tmp/wra-independent-new.json
node verification/gap-pass-2026-10-20/wra/check-reader-reference.mjs \
  /tmp/wra-reader-new.json
node --test test/wra-depth.test.js
```

Original URLs, retrieval times and hashes are in `acquisition.json`.
The publisher table and metadata retain the Open Government Licence and
WRA attribution. Publication time belongs to this evidence vintage; it is not
hardcoded as the publication time of future runtime observations.
