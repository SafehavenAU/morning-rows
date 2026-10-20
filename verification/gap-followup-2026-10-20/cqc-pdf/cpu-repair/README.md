# Local CQC parser CPU repair

The dictionary parser checked the 1,024-key limit by enumerating every key after
each insertion. This makes a dictionary's bound check quadratic. It now counts
successful insertions once; the duplicate-key check still precedes insertion,
and the same limit is checked at the same point after parsing each value.

The complete original PDF has 12,520 inserted keys across parsed dictionaries;
the largest has 673 keys. The instrumented local census records 306,404
bound-check key visits before and 12,520 after. This count is deterministic work
evidence, separate from timing. The instrumentation is never in the Worker.

The unchanged full PDF is 7,175,967 bytes, SHA-256
`61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef`.
Both modules derive 125, 809, 2063, 65 and 3062 and the identical complete native
JSON SHA-256 `20ec5f620e7a5685df804fc5e6651feda6dd8d0fddb9cc02f8c9b7cff6ff790c`.
Whole-file acquisition checks and all structural/statistical checks are unchanged.

Local Node v24.19.0, separate processes, 20 samples per module with CPU profiling:

| Measurement | Prior module | Counter repair |
|---|---:|---:|
| First parse wall time | 161.26 ms | 116.14 ms |
| Median wall time, following 19 parses | 81.04 ms | 50.59 ms |
| Median process CPU, following 19 parses | 110.77 ms | 74.85 ms |
| One local Response acquisition, hash and parse | 205.53 ms | 130.95 ms |

Process CPU includes Node's concurrent runtime work and can exceed wall time.
These are local observations, not measured Cloudflare CPU. Removing temporary
key arrays should reduce allocation pressure, but memory savings were not
measured. The `.cpuprofile` files retain sampled evidence; the old dictionary
line was the highest-sampled reader line. A separate exploratory direct-xref
field change showed no convincing additional benefit and was reverted; it is
not in the final runtime.

The first focused test attempt failed setup because this new worktree lacked
`.generated/build-info.js`. Its output is retained in `incomplete-setup-tests.txt`.
After the repository's normal `node scripts/build-info.mjs`, the final focused
run passed **66 tests**: the prior 57 bounded-reader tests, one new dictionary
boundary test, six information/schema groups and two worker integration tests.
The new test covers 1,024 accepted keys, 1,025 refused keys, duplicate refusal at
the limit, independent nested counts and null-prototype special names.

Reproduce from the repository root using the independently retained original
PDF outside Git:

```sh
node scripts/build-info.mjs
node --test --test-reporter=tap test/cqc-pdf.test.js test/cqc-pdf-information.test.js test/cqc-pdf-worker-integration.test.js
node verification/gap-followup-2026-10-20/cqc-pdf/cpu-repair/profile.mjs lib/cqc-pdf.js /tmp/mr-cqc-pdf-original/report.pdf /tmp/cqc-after-new.json 20
node verification/gap-followup-2026-10-20/cqc-pdf/cpu-repair/census.mjs verification/gap-followup-2026-10-20/cqc-pdf/cpu-repair/prior-reader.js lib/cqc-pdf.js /tmp/mr-cqc-pdf-original/report.pdf /tmp/cqc-census-new.json
```

For a new prior timing, copy `prior-reader.js` temporarily to
`lib/.cqc-prior-profile.js` so its original relative imports resolve, pass that
path to the same `profile.mjs` invocation with a new output path, then remove
the temporary copy. The measured prior module is preserved byte-identically
here, SHA-256 `a2e719e1dc9fa145bbabc329b21dca71e302bfed43c47cb07eb3e936fca20115`.
The repaired runtime SHA-256 is
`7ee99d03615ee0cbfed4d7e8dff709f45dcde0839c410c2a56f0997563f61dbc`.

This evidence does not cure or relabel the prior staged England 794 ms failure.
The old 19-control protected-reader proof remains bound to the prior module.
The repaired module still requires fresh exact-source CI, actual protected-reader
proof and staged full-desk CPU at or below the unchanged 500 ms gate before
release acceptance. No deployment, scheduled observation, checkpoint, receipt,
or operation-state change is performed by this local repair.
