# Operational implementation — 18 October 2026 (Brisbane)

Status: implementation and activation in progress, **not complete**. The acceptance ledger is `operations/acceptance.json`. Existing production remains source `7d614e2e78a63fc16f705b67e35ed0438baa7d87`, Worker `739b9031-305c-4bc7-afc5-79a82c654ac7`; US remains unpublished.

## What runs

`node scripts/monitor.mjs` checks both health/catalogue pairs and all eight desks in 20 public requests, concurrency two, reusing each desk response for 108 source obligations. Existing 93 described observations plus the five NZ nodes have semantic checks; native sections receive availability, parse, presence and observed-provenance-loss checks. They are not independently certified by their HTTP status. No collector request needs a publisher key or Cloudflare write access.

`operations/monitor-policy.json` selects the plan's **daily fallback**, at 23:17 UTC (09:17 Brisbane). Cold preview measurements show substantial publisher fan-out. Hourly full-desk collection is withheld because publisher quotas and CPU usage remain unverified. This is a slower detection goal, not an hourly service claim. The independent hourly watchdog reads checkpoint evidence instead of repeating the desk sweep. It flags no successful complete collection for 26 hours, corrupt/missing state, or failed workflow/artifact delivery. Seven elapsed shadow days at this cadence require at least eight scheduled complete checkpoints and no interval over 26 hours. Manual dispatches do not satisfy scheduled-run evidence.

## State and incident contract

Attempt, successful retrieval, structural contract validation and independently reconciled evidence have separate timestamps. Unchanged content does not advance verification. Failures retain previous validated observations with their original dates; they never make those observations current. New periods, corrections, projection year selection and explicit numeric-coverage loss are separate states. Changed content enters a bounded evidence-review queue. No source substitution or automatic code deployment occurs.

Semantic regressions produce P1 candidates immediately. Transport failures need two checks at least 15 minutes apart; by default those are daily. Recovery needs two successful checks from both domains at least 15 minutes apart. P1 data incidents also require evidence approval. Domain differences are retained as candidates before persistent divergence becomes an incident. Existing acknowledged ABS/ONS/legislation/TfL/RFS failures import silently. Later NZ-price and StatCan recoveries remain acknowledged.

A SHA-256 envelope, predecessor comparison, exclusive process lock, fsync and atomic rename protect local writes. GitHub serializes monitor runs, with cancellation of an active run disabled. Immutable daily checkpoint artifacts retain state for 30 days; detailed reports for seven. Every checkpoint carries open incidents, pending repairs and delivery receipts. A missing/corrupt/expired checkpoint, or later producer run with no checkpoint, stops restoration. It cannot bootstrap an empty state. Checksums are integrity checks, not signatures. GitHub repository/workflow access is the trust boundary. GitHub can replace a queued concurrency-group job; it is not a guaranteed FIFO scheduler.

Notifications use stable event IDs and durable receipt acknowledgments. Shadow mode does not send routine notifications. Delivery failure leaves the event pending. Exactly-once delivery is **not** claimed: sending a chat message and committing its receipt are separate operations. Reconcile an uncertain delivery before retrying. The real destination/receipt round trip and independent scheduling must be proven before actionable source alerts are enabled.

## Reproduction and recovery

```sh
npm ci
npm run check
node --test test/monitor.test.js
python scripts/verify-structure-reference.py
python scripts/verify-nz-prices.py
python scripts/reconcile-operations.py /tmp/mr-reconciliation
# This creates a new local test state only, never a replacement production state:
node scripts/monitor.mjs bootstrap --state /tmp/mr-monitor-test/state.json --baseline verification/monitoring-baseline.json
node scripts/monitor.mjs run --state /tmp/mr-monitor-test/state.json --output /tmp/mr-monitor-test/report
node scripts/monitor.mjs status --state /tmp/mr-monitor-test/state.json
```

For remote operation, restore with `node scripts/monitor-artifact.mjs /tmp/mr-restored`; normal collection never bootstraps. An expired/lost artifact requires reviewed recovery from a retained verified checkpoint and reconciliation of any later notification/repair events. Never delete incidents to get a green result. Resolve an abandoned lock only after confirming no live owner. The current CLI intentionally refuses a second remote bootstrap if monitor history exists.

The `acknowledge` workflow dispatch records a delivered event ID and concrete receipt. Never acknowledge an attempted or uncertain delivery. A user reply confirming the delivery test is acceptable receipt evidence. Watchdog writes must dispatch this one serialized workflow; they must not upload a competing checkpoint.

## Evidence and limits

- `verification/operations-2026-10-18/preflight.json`: fresh both-domain core contracts and source baseline.
- `monitor-first` and `monitor-second`: real public collections, with occasional whole-desk 503 responses explicitly incomplete. Successful sibling evidence survived. These are manual runs, not shadow days.
- `reconciliation/boc.json`: four original Bank of Canada JSON/CSV rates and date match exactly.
- `reconciliation-second/pharmacies.json`: all nine NHSBSA CSV/datastore values and stock/flow identities match.
- `reconciliation-second/insolvencies.json`: 12 original CSV values match official national narrative sections 3/4, including explicit zeros and exact totals. The release is August 2026, published 18 September; metadata expiry 20 October is a review trigger, not proof of a missed release.
- The separate Python extractions share publishers' statistical lineage. No independent agent evaluation or administrative-record audit is claimed.
- `operating-load.json` and `preview`: real Cloudflare fetch counts, warm/concurrent cache experiments and source outcomes. Wall time is measured; CPU and a final account bill are not.
- CPI D7BT/D7G7 reconciliation and tests pass locally, but both preview investigations returned ONS 403. The repair is parked and must not be promoted until actual runtime success, cold/failed-refresh behavior and both-domain release checks pass. Seasonal-adjustment metadata remains a stated evidence gap. Revisit access no earlier than weekly unless a new official access route is supplied.
- Current-day NZ price independent CSV reconciliation remains blocked although public retrieval has recovered. Stats NZ 23-row structural validation is not independent re-extraction with an unprovided credential.

## Delivery and rollback

The user confirmed disconnecting Morning Rows Workers Builds in this chat on 18 October 2026 (Brisbane). This resolves the previous unsafe push path; the Builds API itself remains 403. GitHub monitoring workflows have read-only repository/actions permissions and no Cloudflare token, deploy command or secret-write command. `check.yml` dry-runs the Worker and checks the reviewed deployed baseline; a documentation/monitor commit is not represented as a production version.

Monitoring changes need no Worker deployment. To stop collection, disable only the monitor workflow; retain its last checkpoint and outbox. To restore collector code, use a reviewed Git revision, preserving checkpoint schema and receipts. A Worker rollback is separate and only relevant to a later reader release: the current verified version above is the rollback target. Do not issue an actual rollback merely to test availability. Validate its existence and bindings before promoting a future version. No US rollout, key registration, secret change or publisher contact is authorized here.

## Remote activation evidence

PRs [1](https://github.com/SafehavenAU/morning-rows/pull/1) and [3](https://github.com/SafehavenAU/morning-rows/pull/3) installed the monitor without deploying the Worker. Initial bootstrap [39077382567](https://github.com/SafehavenAU/morning-rows/actions/runs/39077382567) and restart [39077460651](https://github.com/SafehavenAU/morning-rows/actions/runs/39077460651) both succeeded. The second run restored sequence 1 from artifact 12117109140, then completed all 20 public requests in 22.47 seconds,635,590 response bytes, and persisted sequence 2 with 33 acknowledged incidents and no notifications. The actual full hosted job took 33 seconds. These were manual dispatches and do not count as scheduled shadow days.

Measured compressed artifact sizes were 20,981 bytes/checkpoint and 29,245 bytes/report. At one daily checkpoint retained 30 days and seven detailed reports, the steady-state storage estimate is about 834 KB before metadata, incident growth and diagnostic runs. Raw state has a 4 MiB restoration cap. This is measured sample arithmetic, not a guaranteed maximum or account bill. GitHub runner/account billing and Cloudflare CPU cost remain separate. The official GraphQL CPU query returned a budget-depleted error; retry no earlier than its stated five minutes. Daily fallback remains appropriate.

The existing Codex monitor has been updated to an hourly independent checkpoint watchdog, starting 09:10 Brisbane 18 October. Its GitHub connector download path was exercised successfully and the returned file was decoded. The workspace CLI's Azure artifact redirect returned 403; this does not imply GitHub runner restoration failed. Signed transport URLs are excluded from new adapter errors. Actual independent wake and a user delivery acknowledgment remain acceptance gates. A single labelled delivery-test event was queued by run 39077529097. Ordinary source events remain in shadow.

The CPI candidate is preserved in [draft PR 2](https://github.com/SafehavenAU/morning-rows/pull/2); it is explicitly blocked and excluded from main. The verified production rollback target remains available through the Cloudflare version API with its existing bindings; this was checked read-only.

`node scripts/exercise-maintenance.mjs` reproduces a complete constructed incident cycle against retained real AIHW aggregates: wrong-measure detection, bounded repair record, successful sibling preservation, injected interrupted write and failed delivery, reviewed candidate checks, two spaced simulated healthy checks, closure and a simulated receipt. Its output explicitly distinguishes fixture time and fake receipts from the separate real GitHub/notification evidence. No real release or notification is performed by the drill.

## Checkpoint incident and bounded recovery

Scheduled run 39078664324 failed before collection. Artifact IDs were not chronological; the previous selector chose the older collection checkpoint over the newer delivery-test checkpoint. See [the recovery contract](CHECKPOINT-RECOVERY.md) and `verification/checkpoint-recovery-2026-10-18/README.md`. Mode `recover` is constrained to that exact failed attempt and original predecessor. It republishes identical state, never bootstraps or acknowledges events. Normal restores reject missing newer checkpoints. Run attempts above one and pagination beyond 1,000 entries deliberately require review. Rehearsal and manual recovery do not satisfy the scheduled-run or seven-day gates.
