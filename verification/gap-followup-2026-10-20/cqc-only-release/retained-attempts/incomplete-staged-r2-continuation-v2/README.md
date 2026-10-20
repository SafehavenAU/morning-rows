# Failed staged continuation v2 retained

The exact `7d7ed892c469d6f589dabf52283fc31dfef98d8a` candidate / Worker `16e5a892-be54-4381-a9c3-98ae4e47a309` stopped at `rent-www-cold-cpu` on 20 October 2026 at `19:06:45.661456+00:00`. This staged suite failed and did not establish release acceptance.

Six logical gates passed: five successful gates imported byte-identically from the original failed staged attempt, followed by one fresh claimant gate. The claimant capture passed at 53 ms for the Northern Ireland desk (3 ms health). Its identity, event correlations, publisher acquisition timestamps and representation were independently rechecked. This capture-level pass does not certify the remaining release gates.

The rent gate failed `tail_not_ready` after five health-only HTTP checks. It contains zero trace events and no rent data request. This is an incomplete capture, not a measured rent CPU-budget breach or publisher failure. Twenty-six of the 33 required logical gates remained unrun. The summary's `fresh_gate_count: 2` counts the passed claimant attempt and failed rent attempt; it is not two fresh successes.

All 29 files from the actual continuation directory and its sibling runner log are preserved byte-identically. The original twelve-file failed attempt remains inside `stage/prior-failed-attempt/`; the eight imported prefix evidence files remain at their original continuation locations too. No repeated file was omitted or silently deduplicated. Explicit `predecessor_copy_bindings` and `imported_prefix_bindings` in the manifest describe those repeated bytes.

`stage/continuation.json` and the initial runner log contain the original planned 5-plus-28 gate construction and a passing prefix preparation result. They are preserved unaltered. The failed final summary and retained step log establish the actual six-passed/one-failed/26-unrun outcome. No complete continuation-verification report or full release audit was produced.

`inspection.json` is a separate offline review of the retained capture and failure, not a production test. Both prior staged failures remain failures. This package changes no source, deployment, checkpoint, receipt, schedule or source-alert setting; it grants no scheduled-operation acceptance.
