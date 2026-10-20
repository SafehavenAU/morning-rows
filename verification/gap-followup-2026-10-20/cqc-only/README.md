# CQC-only local activation boundary

The combined candidate is narrowed to CQC because the required latest AEMO
20 October bundle was absent at the release continuation. The separate dated
AEMO access evidence is retained by the release runner. This edit does not serve
19 October as a replacement, retry the monthly route, or approve the candidate.

Australia's native reader, public selectors, schema, discovery and cache
behavior are restored from accepted NI merge
`791807e066c54884864db88c0c3f2f85c6d713c5`. The original five-region grid snapshot
remains active. The Worker import graph contains 38 local modules, including the
CQC PDF parser, and no AEMO completed-day reader or schema module. Source/measure/
observation requests for grid_day are unknown-source refusals. No AEMO daily
promise, body field, source-health field, rollover handling or public capability
claim remains active.

The CQC source, five definitions, schema, native/selected responses and completion
clock remain connected. The optimized parser is unchanged, SHA-256
`7ee99d03615ee0cbfed4d7e8dff709f45dcde0839c410c2a56f0997563f61dbc`.
Its CPU repair evidence and the failed earlier 794 ms staged request remain
separate. This activation edit does not establish a Cloudflare CPU pass.

`historical-relocations.json` maps eleven byte-identical source/test snapshots
from combined candidate `baa10d13f62b5a74c6f67ff2c0d1f05a4523d394`.
The `.source` suffix prevents historical tests being discovered by `node --test`.
Old manifests and results continue to bind those exact files; none were edited
to describe the narrowed runtime.

The current AEMO reader module and schema module remain unchanged candidate code.
The current suite exercises the original-byte reader and 80 manually installed
candidate native-schema cases, with explicit separation of schema and numerical
validation. Historical active-selector tests remain retained as historical
source. They are not run or counted as evidence for the current public interface.
Current AEMO information and Worker tests instead assert held discovery, absent
public schema and refusal without daily-fetch side effects. No test helper or
conditional production activation was introduced.

The first focused attempt passed 203 tests and failed one newly written
assertion because it expected `validateSelection().error` rather than the
established `.code` field. `focused-attempt1.tap` retains that failed test
unchanged. After correcting the assertion, `focused-final.tap` passes all
**204 current tests**, with zero skips:

```sh
node scripts/build-info.mjs
node --test --test-reporter=tap test/aemo-daily-bundles.test.js test/aemo-daily-information.test.js test/aemo-daily-schema.test.js test/gap-information.test.js test/gap-schema.test.js test/gap-selection.test.js test/gap-worker-integration.test.js test/cqc-pdf-worker-integration.test.js test/cqc-pdf-information.test.js test/cqc-pdf.test.js
```

`activation-audit.json` records the static import graph and verifies all eleven
historical copies against their original Git blobs. The ignored, locally generated
build identity is retained exactly as `local-build-info.js.source`; the graph
record binds this snapshot and labels its runtime import path as transient. It
does not claim to bind the final clean source or deployed identity. No monitoring support,
operations ledger, prior evidence manifest, workflow, schedule, checkpoint,
receipt, credential, infrastructure or deployment changes are included.

Fresh exact-source checks, protected-reader evidence, staged full-desk CPU and
production validation remain the release owner's gates. Local fixture success
does not establish production or scheduled acceptance.

## Monitoring-test supplement

The root's subsequent full build passed 1,443 of 1,445 tests and stopped on two
historical assertions expecting an active AEMO interface. The unchanged failure
log is `full-build-before-monitor-test-adjustment.log`; the original monitor test
is retained at `historical/test/monitor-aemo-cqc-contracts.test.js.source`.

The narrowed runtime correctly reports `semantic / described_measure_coverage`
for otherwise valid AEMO candidate data because its public described measures are
disconnected. The test correction must verify that boundary for original,
reacquired and balanced revised candidate data, without successful observations
or versions. Pure candidate validation must still pass those constructed valid
inputs. No monitoring implementation, active wiring or comparison rule is
changed to satisfy the former expectation.

`monitor-held-boundary-tests.tap` passes all six current monitor-contract tests
after that correction. This focused pass is not a rerun of the complete build;
the root retains responsibility for the fresh full check.


## Accepted continuation release

The later accepted evidence is retained in [the CQC-only release acceptance record](../cqc-only-release/acceptance/release-acceptance.json). Clean source `7d7ed892c469d6f589dabf52283fc31dfef98d8a`, Worker `16e5a892-be54-4381-a9c3-98ae4e47a309`, was accepted at `2026-10-20T19:55:09.580268+00:00`. All 33 staged gates are proved across six passing gates from the exact two-predecessor chain plus the reviewed 27-gate continuation; both prior claimant/rent trace-readiness failures remain failed. Five unique independently extracted CQC source-reference cells are verified. Production validation and remaining operational limits are recorded in the linked acceptance package. Earlier evidence remains unchanged.
