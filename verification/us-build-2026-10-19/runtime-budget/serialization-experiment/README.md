# Rejected canonical serialization experiment — 20 October 2026

The current US selected route hashes 13 observations, a selected content version
and its response ETag. The previous local profile attributed substantial CPU to
semantic normalization, UTF-8 encoding and hashing. This experiment replaced the
v2 digest's intermediate canonical object with canonical JSON strings and reused
those strings within one selected-response invocation. It preserves the existing
SHA-256 input format; it does not compose a new fingerprint algorithm.

**Decision: do not change runtime code or stage another edge trial on this evidence.**
The repeated-route benefit is modest and the first-request results do not show a
reliable cold improvement. All figures below are local Node process CPU, not
Cloudflare measurements or evidence of meeting the Free plan's 10 ms limit.

| Diagnostic | Original median CPU | Prototype median CPU | Samples per variant |
|---|---:|---:|---:|
| Repeated cold-cache route | 2.731 ms/request | 2.514 ms/request | 6 batches of 150 |
| First request in a fresh Node process | 44.409 ms | 46.294 ms | 8 |
| First CPI request after Request/Response initialization | 16.928 ms | 16.478 ms | 8 |

The first case uses `cache: null` and rereads/parses both fixture responses for
every invocation, but the JS runtime is warm. Order alternates between variants
by batch. The second case includes Node's HTTP primitive initialization; the
third initializes only Request/Response before timing, not the CPI reader. Both
first-request variants run in separate Node child processes. The third case's
ranges overlap and individual pairs regress. None establish an edge bottleneck
correction, percentile or sustained-load result.

`prototype.mjs` is diagnostic only and is not imported by the Worker. It memoizes
strings by object identity within one digest, and within the 13 observation hashes
and content hash of one selected response. The helper assumes those JSON objects
are not mutated during that operation. It is not a general-purpose serializer:
accessors, cycles and custom `toJSON` objects are outside its tested input contract.
The equivalence check includes integer-index property ordering, omitted undefined
object fields, sparse/undefined array slots, null/nonfinite values and JSON
escaping through the native scalar serializer. The full selected route's body,
headers and ETag match with fixed retrieval/clock values. This limited equivalence
is not a reason to accept complexity without a reliable cold performance benefit.

## Inputs and provenance

The two HTML files were already present in local `/tmp` storage from earlier work.
They contain 86,962 and 92,520 bytes. Their original retrieval timestamps and HTTP
metadata are unavailable. `manifest.json` records that limitation, expected reader
URLs, SHA-256 values, runtime source hashes and the Node version used. No publisher
request, credential access, remote test or deployment occurred in this experiment.
These fixtures do not add independent publisher verification or certify a new
release. BLS statistical content is retained as an original-publisher diagnostic
specimen; attribution remains US Bureau of Labor Statistics.

The manifest's `baseline_git_revision` is the checkout revision when these
artifacts were retained. The runtime modules had not changed during the
experiment; their hashes, rather than unrelated monitoring/document commits,
identify the tested reader. The measured JSON files are the original experiment
results, including regressions. Reproduction scripts only adapt paths to the
repository and prepare temporary modules outside it; machine-dependent timings
will differ.

## Reproduce

From the repository root, with its locked dependencies installed:

```sh
node verification/us-build-2026-10-19/runtime-budget/serialization-experiment/bench.mjs --smoke
node verification/us-build-2026-10-19/runtime-budget/serialization-experiment/bench.mjs
node verification/us-build-2026-10-19/runtime-budget/serialization-experiment/run-first.mjs
node verification/us-build-2026-10-19/runtime-budget/serialization-experiment/run-first.mjs --warm-transport
```

The smoke command checks baseline/input hashes and exact equivalence without
repeating the performance batches. `prepare.mjs` makes temporary patched copies
of two current modules and cleans them up afterward; it never edits repository
runtime files. For a changed reader, use the retained baseline revision rather
than overriding the hash check. Reports are written to stdout and never replace
these retained measurements automatically. No fixture is wired into production.
