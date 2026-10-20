# Original AEMO aggregate specimen — 20 October 2026

The two `monthly-*-2026-10-19.csv` files retain the original CSV header and
288 complete, unmodified lines each for **19 October 2026 in fixed AEST
(UTC+10)**. Interval-ending stamps run from 00:05 through 20 October 00:00.
`TOTALDEMAND` remains part of those original lines but is not used. All rows
are `PERIODTYPE=TRADE`; this is neither a live snapshot nor a moving 24-hour
window. The target was the latest completed fixed-AEST day at acquisition.

[acquisition.json](acquisition.json) records exact public URLs, retrieval and
completion times, original wire byte counts/SHA-256, retained byte counts/SHA-256
and transformations. Full monthly files and ZIPs remain outside the repository.
The original SA1/VIC1 monthly responses were 244,124 and 250,623 bytes, acquired
at about 09:16 UTC on 20 October. Both ended at 20 October 00:00 AEST.

[month-boundary.json](month-boundary.json) retains actual first/last rows and
counts from September and October. Both September files start 1 September
00:05 and end 1 October 00:00, with 8,640 rows; October starts 1 October 00:05.
Thus the observed file month owns interval starts, including the following
month's midnight interval end. Do not fetch the next month's file for that
midnight or reinterpret the source in Adelaide/Melbourne daylight-saving time.

The separate [daily projection](public-prices-DREGION-2026-10-19.csv) retains
**576 regional records** from official NEMweb `PUBLIC_PRICES` daily ZIPs.
Those files cover NEM trading days from 04:05 through the next 04:00, so the
18 and 19 October bundles jointly cover this calendar day. The selected table
is **DREGION version 3**; version 2's exact RRP is retained as a format check.
Other regional, demand and ancillary-service columns are omitted. The two
compressed originals were 254,309 and 260,373 bytes. Their decompressed member
names, byte counts and hashes are also recorded.

Every monthly price matches its separate daily value within **AUD0.005/MWh**:
maximum difference **0.00493 SA1** and **0.00478 VIC1**. All selected records
have run 1, intervention 0, APC flag 0 and market-suspension flag 0. These are
**DREGION comparisons, not DISPATCH/PRICE observations**. No retained field
establishes `FIRM` status or finality. The full comparison supersedes a small
spot sample without implying independent market clearing: both presentations
share AEMO's upstream calculation.

Independent Python `csv` and `Decimal` extraction finds **189 negative and
2 zero intervals in SA1**, and **206 negative and 9 zero intervals in VIC1**.
The means of the published rounded monthly prices are **6.73** and **−7.80
AUD/MWh** at two decimals. Negative counts exclude zeros; a higher-precision
positive `3E-05` daily value is retained correctly rather than treated as a
missing marker. No monthly zero masks a negative daily value in this specimen.

[methodology-notes.json](methodology-notes.json) records current primary-source
clock, unit, reuse and uncertainty evidence. AEMO's copyright permissions allow
reuse with accurate attribution to the material and AEMO; this is not an OGL or
Creative Commons claim. Source attribution: **Australian Energy Market Operator
(AEMO)**. Derived summaries: **Morning Rows**. The monthly refresh/correction
SLA is unestablished, so preserve retrieval vintage and do not label the values
final. No contact/footer metadata or individual records are retained.

From the repository root, verify without network or runtime parser imports:

```sh
python verification/gap-pass-2026-10-20/aemo/verify-original.py \
  verification/gap-pass-2026-10-20/aemo/original /tmp/aemo-original-replay.json
```

The output file must not already exist. To repeat raw extraction using the
original six hash-pinned inputs, first explicitly run `reacquire-original.py`
with a new raw directory, then run `verify-original.py --extract RAW_DIR
NEW_BUNDLE_DIR`. Mutable monthly files may no longer match their original
hashes; reacquisition then fails rather than silently certifying a newer vintage.
Original acquisition and later reacquisition times remain distinct. Ordinary
offline reproduction needs only this retained minimal specimen.
