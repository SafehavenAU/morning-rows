# Independent CQC second CPU-repair review

No semantic or integrity blocker was found for exact reader SHA-256
`f161ab460d0e489345edcd38c9bbe5c36b1a09990e5b53494a837f48931e27a9`.
This is a local review, not Cloudflare CPU or release acceptance. The original
794 ms and first-repair 636 ms England samples remain failed against the
unchanged 500 ms gate. USA100 ms and Worker1000 ms bounds remain unchanged.

The selected diff contains only bounded Adler32 arithmetic and private,
synchronous reuse of an array token that was just read. All lexical trials and
typed-xref/classification trials are absent. The 1024-key dictionary bound and
duplicate behavior remain; no static values or byte bypass were added.

Independent checks compared exact values (including signed zero), errors,
positions and token counts against the pinned prior reader:

* 290,168 lexical comparisons, including exhaustive hex/name byte pairs.
* 3,543 array comparisons, including token/depth refusal order, comment positions,
  references, malformed tokens, nested values and the32768-element bound.
* 423 decoder comparisons:117 accepted representations match the independent
  original payload byte hash;306 refused representations retain exact errors.
* 72 worst-case modular-arithmetic controls;20 xref and20 dictionary controls.

There were zero old/new semantic mismatches. The complete7,175,967-byte original
PDF produces identical native output, hash
`20ec5f620e7a5685df804fc5e6651feda6dd8d0fddb9cc02f8c9b7cff6ff790c`,
with five source values125/809/2063/65/3062. Generated assertion counts are not
additional independent publisher reference cells.

The Adler proof starts each batch with a,b<=65520. At5552 all255 bytes,
a<=1481280 and b<=4294690200 (<2^32), so every sum is an exact JS integer.
Reducing both sums at each complete or partial batch preserves the recurrence.
The128-byte compressed feed, prior expansion check and complete/trailing
DEFLATE checks are unchanged. The array handoff resets position before the
child depth check, then reproduces skip/token-budget behavior before restoring
the already-read end; indirect-reference lookahead remains unchanged.

Three initial decoder-harness expectations failed and are retained as separate
failed scripts and records. The first two incorrectly assumed all valid
node:zlib stored representations were accepted by the existing bounded
parser. The third malformed-header generator accidentally cleared FDICT while
repairing FCHECK. Neither represented an old/new mismatch. The corrected
harness requires exact baseline behavior, independent payload hashes for every
accepted output and explicit refusal for malformed/bound cases. A separate
metadata-audit attempt assumed an older profile had a variant field; its failed
script/record is retained, and the corrected audit groups by exact bound SHA.
No failed attempt is labelled a passing run.

All51 bindings in the exact author manifest
`56b78987e46b0f0e893c547f0084e74737fd0bc3499fcfa59016eed930f72c5d`
were verified. The manifest, README and local-comparison bytes are snapshotted
here. All22 timing summaries were independently recomputed, including the
selected304.600431 ms cold wall-time outlier. The selected cold median process
CPU247.488→229.524 ms and wall119.014216→104.294722 ms are local diagnostics.
Early timing runs may overlap review; later quiet windows do not prove machine
isolation. No-JIT comparisons are separately retained runs and are not a
Cloudflare execution model. The author's79 focused passes were verified from
bound logs, not rerun here; this review executed its own differential controls.

The external decoder harness exports the private function only inside in-memory
imports of unchanged source copies. Repository source was not edited. This
review made no HTTP requests, Git mutations, deployment, monitoring, checkpoint,
schedule or acknowledgment changes. Fresh protected-reader, exact-source and
actual full-desk staged resource gates remain necessary.
