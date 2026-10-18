# Checkpoint restoration incident — 18 October 2026

Status at repair commit: local validation complete; remote recovery and scheduled proof pending.

## Original evidence

`github-evidence.json` retains allowlisted original API fields for the relevant runs, attempts, artifact metadata and the failed attempt's complete step outcomes. The error excerpt is from job 117530966663. `original/` is the exact executed code at main revision 5d1651cedc4aad5bf5ead050272e24931af0b3c1. Files named by artifact ID contain the original public aggregate checkpoint JSON; `predecessor.zip` retains the exact necessary archive for the recovery rehearsal. No signed URLs, transport headers or credentials are retained.

| Workflow run | Event | Checkpoint | Sequence | Outcome |
|---|---|---|---|---|
| 39077382567 / #3 | manual bootstrap | 12117109140 | 1 | Complete collection |
| 39077460651 / #4 | manual collection | 12117945370 | 2 | Complete collection |
| 39077529097 / #5 | manual delivery test | 12117561506 | 2 | Pending test added, new digest |
| 39078664324 / #6 | scheduled | absent | none | Restore failed before state mutation |

The three archive hashes match the publisher's GitHub artifact digests. Canonical state digests and successive predecessor links validate. Between #4 and #5 the only state field changed is `outbox`; every other state field is equal. The first retained collection links to its preceding bootstrap state, which is not separately retained as an artifact; no claim of independent verification of that pre-collection envelope is made.

The original selector reproducibly rejects #5 because #4 has a larger artifact ID. Fixing that selection without reviewing #6 would correctly remain blocked: newer failed runs must not be silently ignored. The checked-in review names #6/attempt 1, its exact revision, complete job step outcomes and #5's archive/state/predecessor digests. Runtime recovery re-fetches those facts and requires no artifacts from #6. No other failure qualifies.

## Reproduction

```sh
npm ci
npm run check
node --test test/monitor-artifact.test.js
node scripts/rehearse-checkpoint-recovery.mjs
```

The test suite includes the original failing selector as a regression control. `rehearsal.json` is produced by the actual restoration adapter with simulated GitHub API transport and the original ZIP bytes. The simulated transport moves only expiry forward so the offline rehearsal remains repeatable; it cannot establish that the real artifact has not expired. `changed_fields: []` means the entire checkpoint envelope and state are byte-identical. Synthetic current run 99 is never scheduled evidence. No real notification, acknowledgment or network request occurs in rehearsal.

Specific safety checks cover paginated/missing/changed history, conflicting chronology, unsupported reruns, unrelated workflows/branches, missing/duplicate/expired artifacts, wrong producer, corrupt bytes/state, interrupted upload, altered failed-job evidence and notification-only sequence semantics. Existing source/incident tests remain in the full suite.

## Release and remaining gates

Use the reviewed GitHub PR workflow with Cloudflare automatic Builds remaining disconnected as confirmed by the user. Monitoring recovery runs through `monitor.yml`, mode `recover`; it copies the exact prior state and emits a separate `restored.json` audit. Then a normal manual collection must restore that artifact and link its newly written envelope to the retained digest. Both artifacts must be independently downloaded through the connector and compared.

The next daily cron is 23:17 UTC on 18 October / 09:17 Brisbane on 19 October, subject to GitHub delay. Only an actual successful scheduled collection and independent verification complete the repair gate. Seven elapsed shadow days and publisher/CPI evidence gates remain outstanding. The pending test was already announced in this chat; no actual acknowledgment exists. Do not repeat it or fabricate a receipt.

Known limitations: GitHub permissions are the authenticity boundary, not the hashes. Reruns and a full history above 1,000 entries fail closed for review. GitHub's serialized queue is not guaranteed FIFO; contradictory execution order fails rather than guessing. Missing future checkpoints require new exact evidence review, not reuse of this exception. Builds API access remains unavailable; user confirmation is the evidence for separation. No public Worker release is part of this repair.
