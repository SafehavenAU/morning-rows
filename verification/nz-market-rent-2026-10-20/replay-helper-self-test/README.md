# Constructed replay-helper self-test

This directory tests the offline replay helper. It is **not candidate, production,
publisher-reconciliation, actual checkpoint or scheduled-operation evidence**.
The rent body is built from retained HTML through an injected local fetcher; the
final identity is deliberately synthetic (`dddd…`), and the corresponding local
approval is a test input. Nothing here activates the release review.

Run from the repository root:

```sh
node verification/nz-market-rent-2026-10-20/replay-helper-self-test/self-test.mjs
```

The harness creates new scratch files outside the repository, exercises a valid
constructed direct/prefix preservation proof and seven fail-closed cases, and emits
the scratch path. `proof.json` and `test-summary.json` retain one such execution.
Rejections cover the wrong observation approval, broken release edge, dirty
identity, missing rent row, invented contiguous intermediate release, a mismatched claimant release month and an
attempt to overwrite evidence. No network calls or durable checkpoint writes
occur. The final release requires its own exact production approvals and proof.

The harness pins the retained pre-rent review and August approvals, matching its
retained August claimant captures. Its initial use of active configuration
correctly failed after rent activation appended another edge. The historical
fixture is now stable across later accepted releases; no runtime or checkpoint
behavior changed.
