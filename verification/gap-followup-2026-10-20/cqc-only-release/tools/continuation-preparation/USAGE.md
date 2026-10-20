# Revision 2 assembly and proposal usage

The frozen tools do not perform remote actions. The fact template is deliberately unusable until all required actual evidence exists. No release acceptance has been generated here.

1. Freeze the reviewed toolchain before the continuation begins: take the exact 13-key `files` map from `tool-pins.for-review.json`, add only the final independent `review` pin, and retain `revision:2`, exact scope, `actual_release_accepted:false` and the actual `frozen_at`. The independent review must have `pass:true`, `proposal_only:true`, and `reviewed_files` containing the same 13 pins. Do not inherit extra v1 entries unless the review also explicitly binds them.
2. After all staged continuation and production gates pass, copy `actual-facts.template.json` to a new actual-facts file. Fill every null using original evidence. Each file pin is `{file:absolute_path,bytes:exact_count,sha256:exact_digest}`. `staged_continuation` is the staged root's `continuation-verification.json`; staged and production summary pins must each be their exact `summary.json`. `deployments` is the actual post-promotion array, not an assumed array position. `latest_runs` is a fresh post-promotion connector result covering newest main monitor execution. Preserve the 86 existing failed/incomplete evidence pins. Add any new unaccepted attempts explicitly. The capability note is read-only research, never a runtime test.
3. Invoke the assembler with three positional arguments:

```sh
python3 /tmp/mr-combined-final-preparation/cqc-continuation-v2/assemble-final-config.py ACTUAL_FACTS_JSON REVIEWED_TOOLCHAIN_JSON NEW_OUTSIDE_REPO_CONFIG
```

4. Only after successful assembly and independent actual-evidence review, invoke the separate acceptance helper with that config and a new outside-repository proposal directory:

```sh
node /tmp/mr-combined-final-preparation/cqc-continuation-v2/prepare-cqc-only-continuation-acceptance.mjs ACTUAL_CONFIG NEW_OUTSIDE_REPO_PROPOSAL
```

The helper reruns the exact continuation proof and every prior acceptance gate. It writes proposals only. The original staged attempt stays failed; the staged proof explicitly combines five unchanged passing gates with 28 fresh gates. No checkpoint, receipt or schedule is written.

5. The separate formatter reads the accepted proposal and emits a package plan, HANDOFF/GAP-LEDGER prefixes and `CQC-only-README-append.md`. Append that last output to the existing historical CQC README after acceptance so the reviewed edge's original evidence anchor links the accepted package. Preserve the original text. The default package root is `verification/gap-followup-2026-10-20/cqc-only-release`.

Package only explicitly pinned helper files, the runner manifest members, control result records and independent reviews. Exclude `__pycache__` and synthetic control case directories. The final committed-tree audit must cover the union of applicable earlier bindings, new accepted package and changed documentation/operational proposals, with explicit historical relocations. The 593-file source audit is not a whole-repository completeness claim.
