# Cold-path diagnostics — 20 October 2026

This bundle preserves the local investigation of the unreleased US CPI route.
The fixed candidate preserves the published data shape and exact SHA-256 inputs.
The combined local profile supports one bounded, version-isolated edge
investigation. It does **not** establish reliable cold improvement or acceptance
of the Workers Free 10 ms budget. Actual edge disposition is recorded separately
in the runtime-budget continuation; this bundle does not release the candidate.

## Criterion and evidence boundary

Before changing runtime code, the criterion was a meaningful, repeatable reduction
in first-request work with unchanged numerical, semantic, interface and hash
contracts. Warm cache or repeated-isolate performance cannot satisfy the cold
criterion. The release gate remains a complete final cold capture and two fresh
confirmations at no more than 10 ms, with distinct clean build cache keys and
complete version/path/time-correlated edge traces. No limit waiver, paid plan,
new infrastructure, synthetic CPI warmup or hidden CPI work in health is proposed.

Two mechanisms are combined:

- `table-candidate.mjs` locates the two identified table boundaries before
  parsing their contents, retaining duplicate/ambiguous identity rejection.
- `fragment-information.mjs` precomputes constant definition/attribution JSON
  fragments at module initialization. It assembles the known observation and
  selected-response structures in the existing canonical order. Additional
  row properties fall back to the original canonicalization; nested footnote
  properties remain canonicalized. The route passes a request-local canonical
  string to the response finisher. No response field or digest meaning changes.

`fragment-desk.mjs` and all candidate files here are diagnostic copies, not Worker
imports. `baseline/` snapshots the dependency closure from
`bb41f961014febb46f9544676caebe9319feadc3`, with sibling imports redirected to that
snapshot. This prevents subsequent runtime changes from changing the comparison.
The manifest records both original Git-object hashes and retained-file hashes.

## Findings

| Local diagnostic | Baseline | Candidate | Interpretation |
|---|---:|---:|---|
| Fragment-only fresh Node first call, median of 16 each | 15.147 ms | 13.609 ms | Modest local difference; predates fixes described below |
| Fragment-only minified Wrangler/workerd, six fresh instances each, median non-idle sampling deltas | 12.660 ms | 13.448 ms | No reliable cold improvement |
| Direct Miniflare combined, first capture non-idle sampling deltas | 16.695 ms | 9.565 ms | One local sampled capture each |
| Direct Miniflare combined, second capture non-idle sampling deltas | 9.438 ms | 8.051 ms | Overlapping cold ranges and a small sample |
| Direct Miniflare combined, non-idle samples across 100 repeated reads | 1,489 | 1,176 | About 21% fewer samples in a warm isolate |

The direct Miniflare harness uses minified esbuild output, fresh isolates, the
actual route/reader code, both retained HTML responses and `cache:null`.
`/ready` returns only a short string. All outbound fetch is denied. The four
fresh-isolate profiles and two repeated profiles are retained under `results/`.
V8 CDP samples use a requested 100 µs interval. Sampling deltas can include host
descheduling and have incompletely symbolized native work; they are neither billed
edge CPU nor request latency. Baseline captures preceded combined captures rather
than randomized execution. Two captures per variant cannot establish a percentile
or sustained performance result.

The original executed bundles and source maps remain temporary generated files;
their hashes are retained in `results/direct-manifest.json`. Portable `prepare.mjs`
and `profile.mjs` recreate entries, bundles and maps outside the checkout. Absolute
paths in historical summaries identify the original local run; no credentials or
signed URLs are present. The portable harness records its Node, Miniflare, workerd,
esbuild, WebSocket and source-map package versions in new reports.

Earlier table-only Node timings in
`results/table-node-before-identity-guard.json` preceded a small extra check
rejecting two recognized IDs on one opening tag. Those timings are not measurements
of the final guarded parser. Fragment-only Node/Wrangler timing files likewise
precede two fixes: direct construction replaces substring searches that could
confuse nested footnote keys, and fallback records canonicalize the complete
versioned object so properties sorting after `version` remain correct. The final
direct Miniflare combined captures include these fixes and the identity guard.
A later equivalence review also changed context timing-note canonicalization from
native JSON serialization to the original recursive semantic serializer, preserving
sorted keys and omitted retrieval fields when an accepted JSON timing note is an
object. The retained prototype includes that fix; the direct profiles precede it.
The measured fixture has a string timing note, so no differing semantics were
exercised, but those profiles are not measurements of the final corrected source.

The separate compact-response experiment reduced serialized bytes by about 61%
but did not improve first-call CPU reliably. Its raw first-call summary is retained
as `results/compact-response-before-change.json`; no shared-definition-reference
schema change is adopted.

## Diagnostic equivalence

These checks run against the pinned baseline. They are additional prototype
comparisons, not a claim that 104 production tests were added:

- `check-fragments.mjs`: 104 comparisons covering source/measure/observation
  selection, GET/HEAD, missing/unavailable/revised values, errors, escaping,
  extra row keys, numeric keys, keys sorting after `version`, and nested footnote
  `period`/`value` properties, and object-valued timing notes. Bodies, observation versions, content versions,
  ETags and headers match exactly.
- `check-table-equivalence.mjs`: 38 structural variants plus full route
  body/header/ETag equivalence.
- `check-table-contract.mjs`: the four existing table contract cases exercised
  explicitly against the guarded parser.
- `check-combined.mjs`: full selected-route body, headers and ETag match for all
  13 retained observations with both candidate mechanisms.

The filenames avoid automatic discovery by ordinary `node --test`. None fetch
publishers, exercise production, alter checkpoint state or satisfy a release gate.

## Inputs and reproduction

Both BLS HTML specimens are reused from `../serialization-experiment/inputs/`;
they are not duplicated. The retained publisher attribution and public-domain
basis remain unchanged. Their original retrieval timestamps and HTTP metadata
are unavailable. These are local diagnostic fixtures, not new independent
publisher evidence or certification of another release.

With the repository's locked dependencies installed:

```sh
node verification/us-build-2026-10-19/runtime-budget/cold-path-2026-10-20/check-fragments.mjs
node verification/us-build-2026-10-19/runtime-budget/cold-path-2026-10-20/check-table-equivalence.mjs
node --test verification/us-build-2026-10-19/runtime-budget/cold-path-2026-10-20/check-table-contract.mjs
node verification/us-build-2026-10-19/runtime-budget/cold-path-2026-10-20/check-combined.mjs
node verification/us-build-2026-10-19/runtime-budget/cold-path-2026-10-20/prepare.mjs /tmp/mr-cold-path-reproduction
node verification/us-build-2026-10-19/runtime-budget/cold-path-2026-10-20/profile.mjs /tmp/mr-cold-path-reproduction/baseline-worker.mjs /tmp/mr-cold-path-reproduction/baseline 2
node verification/us-build-2026-10-19/runtime-budget/cold-path-2026-10-20/profile.mjs /tmp/mr-cold-path-reproduction/combined-worker.mjs /tmp/mr-cold-path-reproduction/combined 2
```

The profile tool resolves packages through `MR_TOOLS_PACKAGE`, defaulting to
`/workspace/.morning-rows-tools/package.json`. It requires Miniflare, esbuild, ws,
workerd and `@jridgewell/trace-mapping`; exact captured versions are in the
manifest. It does not install packages or use Wrangler authentication.
`MR_PROFILE_PORT` and `MR_INSPECTOR_PORT` default to 8801 and 9234.
Reproduction generates new observations rather than overwriting retained results.
Do not repeat unchanged captures merely to seek a passing sample.

`commands.json` records the packaging checks actually run. `manifest.json`
hashes this bundle, pinned code and both shared inputs. The manifest excludes
itself to avoid a self-reference.
