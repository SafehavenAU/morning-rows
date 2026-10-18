# Checkpoint recovery contract — 18 October 2026

Scope: monitoring transport only, eight desks, daily collector, SHADOW. No Worker release, source change, credential change, UK CPI or US promotion.

## Evidence and confirmed mechanism

Original API metadata, necessary checkpoint specimens, error excerpt and exact failed-revision code are retained in `verification/checkpoint-recovery-2026-10-18/`. Repository/workflow access is the trust boundary; SHA-256 detects damage, not forgery.

Workflow 388034330 ran collection #3 (39077382567), collection #4 (39077460651), then delivery-test #5 (39077529097). The latter two artifacts were published at 23:03:02 and 23:03:44 UTC, respectively. Artifact #4 has ID 12117945370, larger than #5's 12117561506. Descending artifact-ID selection therefore picked #4 and rejected its producer because #5 was newer. Scheduled run #6 (39078664324, attempt 1, revision 5d1651cedc4aad5bf5ead050272e24931af0b3c1) failed restore before every state-changing step; checkpoint upload also failed and its artifact listing is empty.

Correcting selection alone must still reject run #6's missing checkpoint. A specific reviewed recovery is necessary; a generic “ignore failed runs” rule would risk dropping committed events.

## Invariants established before implementation

1. Discover the exact workflow ID/path through GitHub. Read all pages of its main-branch history and the selected producer's artifact collection, with stable totals, unique IDs and a bounded ceiling that fails closed. Unrelated workflows, branches and events cannot establish authority. An incomplete or changing listing is an error, never evidence of absence.
2. Order eligible executions by the workflow's run number, corroborated by run start times and identity. IDs are identifiers only. Reject duplicate/conflicting run numbers, equal/reversed execution times and unsupported rerun attempts. This repair supports first attempts only; a rerun requires separate review rather than inferring which attempt produced an artifact. Require the current execution to be the latest eligible run and preserve GitHub's existing serialization.
3. The latest prior eligible execution must be completed and have exactly one named checkpoint tied to its run ID, repository, branch and revision. The producer revision must be an ancestor of the current main execution. Match artifact publication to that first attempt's time interval. Reject absent, multiple, expired, oversized or mismatched artifacts; never select by artifact ID.
4. Validate archive SHA-256, the sole ZIP member, uncompressed size and the repository's canonical state digest before creating restored state. Preserve the checkpoint bytes. Collection sequence counts collections, not writes: #4 and #5 both have sequence 2, but #5 has a new digest and #4's digest as predecessor because it added the delivery event. Do not infer equality from sequence alone.
5. Recovery requires explicit workflow mode `recover` and a checked-in review naming only failed run #6/attempt 1 and predecessor #5/attempt 1/artifact/digests/sequence. Re-fetch the exact failed attempt's jobs and empty artifacts. Its complete step evidence must still match the reviewed evidence, including skipped collection, bootstrap, test and acknowledgment steps. No other later run, new attempt or changed evidence is exempt. Once a subsequent checkpoint exists this recovery mode must refuse reuse.
6. Recovery republishes byte-identical state through the existing serialized workflow, with a separate restoration audit. It performs no collection or acknowledgment. The next normal collection links its new envelope to the restored state digest. Incidents, repairs, approved observations and all outbox entries/receipts must be identical immediately after recovery. The announced delivery test stays pending without an actual user acknowledgment.
7. Re-read the current execution and latest prior frontier before writing restored state. Restore cannot overwrite an existing local state file. Upload failure leaves a visible missing-checkpoint incident requiring review; no reset or automatic bypass.

## Acceptance and reproduction

- Reproduce the original selector failure with real metadata; verify the corrected selector chooses #5 before #6 exists and refuses #6 without the exact review.
- Test pagination, truncation, ambiguous order, reruns, unrelated history, expired/missing/corrupt artifacts, interrupted upload, changed recovery evidence and notification-only sequence changes.
- Validate all three specimens and predecessor links; a local rehearsal and remote recovery must retain the complete #5 state and envelope without any field changes.
- Independent connector download must validate the actual recovered artifact; a separate manual collection must prove subsequent restoration and complete collection. Manual runs do not start the shadow window.
- Only a subsequent actual scheduled collection with valid continuous state, complete results and independent watchdog verification completes this repair. The next scheduled time is 09:17 Brisbane on 19 October, subject to GitHub scheduler delay. Keep that gate pending until observed.
- Seven elapsed days and all other evidence/access gates remain separate. Ordinary source alerts stay disabled. Do not repeat the pending delivery-test notification.

Cloudflare Builds separation relies on the user's explicit disconnection confirmation in this chat and repository instructions; the Builds API previously returned 403. No claim of new API verification. The GitHub workflows contain no Worker deploy or secret writes; `check.yml` only dry-runs the build and reads production.
