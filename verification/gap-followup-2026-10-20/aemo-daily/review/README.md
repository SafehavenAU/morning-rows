# Independent AEMO daily-bundle review

Review completed 20 October 2026 against the reader hash in `clock-review.json`.
No remaining release-blocking parser or numerical defect was found in this
bounded review. This is not actual Worker, CPU, deployment or operational acceptance.

`verify-rounding.py` uses only Python's ZIP, CSV and Decimal implementations.
It reads both original daily bundles and the separately retained monthly CSVs,
binds their hashes and the original AEMO YAML, and verifies every selected cell.
All **576 cent-rounded values match exactly**, with zero tolerance after rounding;
all 576 layout pairs agree numerically, and all ten summaries match the local
pure-parser capture. Each region has exactly 288 fixed-UTC+10 calendar intervals.
The first 48 intervals come from the previous trading-day bundle and the other
240 from the target trading-day bundle. These sources share AEMO market lineage.

The primary AEMO definition explicitly describes next-day daily dispatch reports.
Its full 124/134 DREGION field lists exactly match both retained CSV headers.
The same report family also defines TREGION layouts, so the reader's strict
DREGION selection is necessary. RRP is the regional energy price after
capping/flooring/scaling, with NUMBER(15,5) precision. No TRADE/FIRM field, finality,
publication SLA or correction convention is invented.

Independent Decimal controls cover positive and negative half-cent values,
scientific notation, rounded negative zero, rounding before sign classification,
and positive/negative half-cent mean ties. `check-clocks.mjs` independently
confirms that explicitly invalid acquisition arguments fail and that midnight
crossings after parsing/hashing and after public validation both refuse the
result. These two concrete issues were reported to the owner and fixed before
this final review. The controls use mocked transport and do not make HTTP calls.

Reproduction (each output path must not exist):

```sh
node verification/gap-followup-2026-10-20/aemo-daily/review/capture-pure.mjs /tmp/aemo-pure-new.json
python verification/gap-followup-2026-10-20/aemo-daily/review/verify-rounding.py /tmp/aemo-rounding-new.json /tmp/aemo-pure-new.json
node verification/gap-followup-2026-10-20/aemo-daily/review/check-clocks.mjs /tmp/aemo-clocks-new.json
```

The final pure capture is byte-identical to the capture preceding the clock
fixes; its hash is retained in the independent report. This record certifies
only the original 19 October specimen and tested boundaries. It does not certify
future bundles or replace actual protected-reader/resource and release gates.
