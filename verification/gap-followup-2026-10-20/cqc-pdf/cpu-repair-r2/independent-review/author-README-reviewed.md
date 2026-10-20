# Second local CQC CPU repair

This is local implementation evidence, not production acceptance. The original
794 ms and first-repair 636 ms full-England Worker samples remain failed against
the unchanged 500 ms gate. The accepted NI production version is unchanged.
The source before this repair is
`79e251cab4314c328e84d9ac4ca7bf5e5408bdbb`; its exact reader and reader tests
are retained in `prior-reader.js.source` and `prior-reader-tests.js.source`.

The selected reader changes only two pieces of bounded computation:

* Adler32 reduces its sums after at most 5,552 inflated bytes. Starting with
  `a,b <= 65,520`, the worst all-255 block produces `a <= 1,481,280` and
  `b <= 4,294,690,200`, below 2^32 and exactly representable. Reducing both sums
  at each block end is the same modular recurrence. The compressed feed remains
  128 bytes, and expansion checks still precede checksum work. Complete/trailing
  DEFLATE checks, every checksum byte, output bounds and cumulative bounds remain.
* Array parsing passes a token that it has just read into a private synchronous
  value parser. The original depth check, whitespace/comment skip, virtual token
  increment, token-budget refusal position and indirect-reference lookahead
  remain. There is no cache across public calls or mutable-input assumption.

The selected module SHA-256 is
`f161ab460d0e489345edcd38c9bbe5c36b1a09990e5b53494a837f48931e27a9`.
The earlier dictionary-count repair remains. Integer/nibble, byte-classification
and typed-xref trials are **not** in the selected reader. Their exact snapshots
and unsuccessful or limited measurements are retained, not relabelled passes.

## Measurements and their limits

Every parse uses the same independently retained 7,175,967-byte original PDF,
SHA-256 `61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef`.
All measured variants retain the complete native-output hash
`20ec5f620e7a5685df804fc5e6651feda6dd8d0fddb9cc02f8c9b7cff6ff790c`,
including the five structurally extracted values 125 / 809 / 2,063 / 65 / 3,062.
No publisher requests occur: the acquisition check uses a local Response over
those same bytes.

The final alternating fresh-process comparison has six baseline and six selected
processes, using each process's first parse:

| Local diagnostic | Prior reader | Selected reader |
| --- | ---: | ---: |
| Median cold wall time | 119.014216 ms | 104.294722 ms |
| Median cold process CPU | 247.488 ms | 229.524 ms |
| Cold wall range | 94.913961–151.537880 ms | 96.070507–304.600431 ms |
| No-JIT median following wall time | 279.841917 ms | 252.807258 ms |
| No-JIT median following process CPU | 306.605 ms | 277.697 ms |

The cold outlier is retained. The no-JIT comparison is between separately
retained runs, not an alternating pair. Early normal/initial-cold runs may overlap
the independent differential review; later comparisons requested a quiet window
but do not establish machine isolation. Process CPU includes Node/V8 helper
threads. Neither local Node timing nor no-JIT mode predicts Cloudflare CPU.
`local-comparison.json` computes all retained medians without dropping outliers.

The original no-JIT profile has 647 `next`, 301 `value` and 190 `ascii` samples
out of 2,105 samples. The arithmetic-only profile still has 640 `next` and 320
`value` samples out of 2,062. Those profiles motivated the internal array
handoff; the retained cold profiles also identify lexical work. CPU profiles
contain local source paths and public source URLs, with no credential content.

## Regression checks

`focused-tests-77.tap` records 58 existing reader tests, six existing information
tests, ten lexical/array regression tests and three production-stream Adler
tests. `worker-tests-2.tap` separately records both existing worker-integration
tests. All 79 passed. The unchanged original reader-test snapshot remains bound
to its original source; the new tests are separate files.

The new controls cover signed zero and safe-number/word fallback, byte classes,
hex/name limits, duplicate aliases, exact token/depth error order and positions,
reference lookahead, array coverage limits, full decoded bytes at zero and
5,552-byte boundaries/repeated blocks, saturated/varying bytes, four independently
mutated checksum bytes, truncation/trailing bytes and expansion refusal before
checksum comparison. Original statistical adversarial controls still run.
The separate independent review must bind its fresh controls to the selected
module; older trial reviews are not evidence for this module.

Reproduce a local diagnostic using the existing exact-input profiler:

```sh
node verification/gap-followup-2026-10-20/cqc-pdf/cpu-repair/profile.mjs \
  lib/cqc-pdf.js /path/to/exact-original.pdf /tmp/new-cqc-profile.json 20
```

Run the current focused tests:

```sh
node scripts/build-info.mjs
node --test test/cqc-pdf.test.js test/cqc-pdf-lexer.test.js \
  test/cqc-pdf-zlib.test.js test/cqc-pdf-information.test.js \
  test/cqc-pdf-worker-integration.test.js
```

Root must still bind a fresh protected actual-reader proof, exact-source CI,
clean staged Worker and complete fresh full-desk CPU measurement to this module.
The 500 ms legacy gate, 100 ms USA gate and 1,000 ms Worker ceiling remain.
No release, checkpoint, approval, receipt, scope or schedule changes occur here.
