# Operational state — GDP release, 20 October 2026

Both domains serve clean source `a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b`,
Worker `775bfe2d-491b-4bf5-a257-4d3465003351`, fingerprint `fc27e14328f2c397`.
Deployment `5b9bb834-4aef-4f2f-8dd5-bc5d6614951e` promoted it at
`2026-10-20T08:11:15.420461Z`. The current rollback target is the prior rent
Worker `b2a562a7-d137-4376-a6ca-54f29f1415ad`, source
`f85224e6a9ee601d9e706ffab2cd133d3697c272`, fingerprint `d06c032d78d73a12`.
See [GDP release evidence](../verification/statcan-gdp-2026-10-20/README.md).

The existing `canada/product` obligation now validates the exact selected GDP
identity, metadata, two adjacent current-cube quarters and one ordinary derived
growth observation. The levels are millions of chained (2017) dollars,
seasonally adjusted at annual rates; the derived percentage is not annualized.
Legacy numeric fields remain compatible. This strengthens existing coverage and
adds no desk or series. Current Q1/Q2 2026 levels are 2,503,604 and 2,524,127,
with derived growth 0.82%; the independent evidence is specific to that vintage.

Release validation passed **429 Node tests**, the build, **23 protected
scenarios**, **151 general checks / 104 requests**, **24 existing schemas,
26 BLS slots and 100 semantic checks**. Both-domain claimant checks passed
**366 / 112 requests, 130 cells, 50 schemas and 370 negative cases**; rent checks
passed **224 / 62 requests, 232 native cells, 268 selected cells, 42 schemas and
48 negative cases**. Smoke checks passed **18 apex / 17 www**. CPU samples were
**15 ms USA, 26 ms Canada and 170 ms maximum across legacy desks**, within the
100 / 500 ms gates under the unchanged 1,000 ms Worker ceiling.

## Current collector and checkpoint boundary

The reviewed chain preserves the first three edges, old baseline → USA →
claimant → rent, and adds GDP as a fourth edge in the same scope. The serialized
daily collector retains **115 source obligations / 24 public probes**. Its next
normal run may apply the remaining approved suffix once; no intermediate review
is presented as an observed collection. Independent evidence approvals and
contract validation remain distinct. Nine-desk v2 and eight-desk v1 discovery,
the hourly checkpoint watchdog and disabled ordinary source alerts are unchanged.

Maintenance acceptance remains **incomplete**; see [acceptance.json](acceptance.json).
The actual durable checkpoint is still **sequence 5**, scheduled run
`39341442350`, completed `2026-10-19T23:26:10.163Z`, digest
`665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f`,
retaining **33 incidents and 36 pending repairs**. It records **two actual
legacy scheduled cycles and zero expanded-scope scheduled cycles**. Scheduled
validation of the strengthened GDP contract remains pending. Releases and
constructed replays neither write a checkpoint nor count as scheduled evidence.
SHADOW retains `2026-10-18T23:22:22.161Z`; the next complete checkpoint deadline
is `2026-10-21T01:26:10.163Z`. The delivery receipt remains unresolved; do not
repeat the test or treat build instructions as acknowledgment.

The daily fallback remains 23:17 UTC, with the existing 26-hour complete-checkpoint
budget. Acceptance needs at least eight complete daily scheduled checkpoints,
seven days spanned by actual scheduled completions, no gap over 26 hours and
genuine delivery evidence. NZ-PRICES remains blocked on separate evidence for
the selected 17 October specimen; UK CPI remains parked. Credentials and
disconnected automatic Builds are preserved. Routine monitoring stays read-only
apart from a real acknowledgment through the existing serialized workflow.

## Historical claimant-release operational snapshot

The next two sections retain the earlier claimant release and its then-current
114-obligation scope. Their identity, scope and release measurements are
historical; the GDP release and 115-obligation boundary above supersede them.
The standing incident, recovery and delivery policies that follow still apply.

The national claimant-count reader is deployed on both domains at clean source
`983904912d512b054ae3a7fa1cd1e6a65c353036`, Worker
`21582063-b7df-456b-ba2f-4f629f9cc63d`, fingerprint `5a0a0fe53d5f160c`.
Deployment `50b64c24-0ccb-4c88-b4da-b2b54592582d` promoted it at
`2026-10-20T05:06:59.662392Z`. The five existing UK/nation desks provide thirteen
monthly administrative counts, August 2025 through August 2026, all sexes,
age 16+, persons rounded to five, not seasonally adjusted. These are not
unemployment estimates or rates. Nine-desk v2 and eight-desk v1 discovery remain.
See [the release evidence](../verification/claimant-count-2026-10-20/README.md).

Validation passed **231 tests** and the build. Actual CPU measured **25 ms USA**,
**293 ms maximum across legacy desks**, and **53 ms for a second fresh Northern
Ireland acquisition**, within the separate 100 ms USA / 500 ms legacy gates and
unchanged **1,000 ms Worker ceiling**. Both-domain production passed **151 general
checks / 104 requests** and **366 claimant checks / 112 requests**. Independent
reconciliation matched 130 national cells with 40 successful selectors and 30
explicit refusals. Schema verification passed 50 claimant responses / 370 negative
cases, plus 24 existing-contract responses and 26 BLS slots; 100 semantic checks
passed. Known intermittent TfL failures were the only production source-state
changes. Final smoke checks passed **18/18 apex and 17/17 www**. The additional
apex-only repeat is retained separately and does not count as www evidence.

Maintenance acceptance remains **incomplete**; see `operations/acceptance.json`.
The latest actual checkpoint is sequence 5 from scheduled run `39341442350`,
completed `2026-10-19T23:26:10.163Z`, digest
`665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f`,
retaining 33 incidents and 36 pending repairs. Two legacy scheduled cycles are
verified; there are zero USA or claimant scheduled observations. Actual collection
under the new release remains pending; constructed replays do not write or reset
the checkpoint or count as scheduled evidence. SHADOW retains its actual start
`2026-10-18T23:22:22.161Z`, and the next complete checkpoint deadline is
`2026-10-21T01:26:10.163Z`. The delivery receipt remains unresolved; do not repeat
the already-announced test. NZ-PRICES remains blocked on separate official
evidence for the selected 17 October specimen, and UK CPI remains parked.

## Historical claimant collector scope

The reviewed two-step release chain preserves the prior eight-desk identity, its USA transition and the subsequent claimant-count transition. It configures `node scripts/monitor.mjs` to check both health and v1/v2 catalogue pairs and all nine desks in **24 public requests**, concurrency two, reusing desk responses for **114 source obligations**. It takes effect only through enabled exact-identity reviews and the existing serialized collection; the latest actual checkpoint above still records the prior eight-desk scope of 20 requests / 108 obligations. Existing 93 described observations plus the five NZ nodes retain their semantic checks. The release chain adds the single USA CPI contract and five national claimant contracts with thirteen exact periods each. It preserves incidents, repairs, outbox and the original SHADOW start; new-scope scheduled evidence is tracked separately and remains absent. Native sections receive availability, parse, presence and observed-provenance-loss checks. They are not independently certified by their HTTP status. No collector request needs a publisher key or Cloudflare write access.

`operations/monitor-policy.json` selects the plan's **daily fallback**, at 23:17 UTC (09:17 Brisbane). Cold preview measurements show substantial publisher fan-out. The bounded Paid CPU samples do not establish publisher capacity for hourly full-desk collection, so the daily cadence is unchanged. This is a slower detection goal, not an hourly service claim. The independent hourly watchdog reads checkpoint evidence instead of repeating the desk sweep. It flags no successful complete collection for 26 hours, corrupt/missing state, or failed workflow/artifact delivery. Seven elapsed shadow days at this cadence require at least eight scheduled complete checkpoints, seven days spanned by their actual completion timestamps, no interval over 26 hours, and genuine delivery evidence. Manual dispatches do not satisfy scheduled-run evidence. Ordinary source alerts remain disabled.

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

## Initial implementation evidence and continuing limits

The 18–19 October measurements below retain their original scope and evidence
boundary. Current production identity and scheduled progress are stated above;
the later Paid release evidence does not rewrite these historical measurements.

- `verification/operations-2026-10-18/preflight.json`: fresh both-domain core contracts and source baseline.
- `monitor-first` and `monitor-second`: real public collections, with occasional whole-desk 503 responses explicitly incomplete. Successful sibling evidence survived. These are manual runs, not shadow days.
- `reconciliation/boc.json`: four original Bank of Canada JSON/CSV rates and date match exactly.
- `reconciliation-second/pharmacies.json`: all nine NHSBSA CSV/datastore values and stock/flow identities match.
- `reconciliation-second/insolvencies.json`: 12 original CSV values match official national narrative sections 3/4, including explicit zeros and exact totals. The release is August 2026, published 18 September; metadata expiry 20 October is a review trigger, not proof of a missed release.
- The separate Python extractions share publishers' statistical lineage. No independent agent evaluation or administrative-record audit is claimed.
- `operating-load.json` and `preview`: real Cloudflare fetch counts, warm/concurrent cache experiments and source outcomes. Wall time is measured; CPU and a final account bill are not.
- CPI D7BT/D7G7 reconciliation and tests pass locally, but both preview investigations returned ONS 403. The repair is parked and must not be promoted until actual runtime success, cold/failed-refresh behavior and both-domain release checks pass. Seasonal-adjustment metadata remains a stated evidence gap. Revisit access no earlier than weekly unless a new official access route is supplied.
- NZ price verification on 19 October Brisbane independently re-extracts 240 original CSV cells for the latest listed completed day (17 October interim) and matches five actual-parser values in protected Cloudflare preview. Separate official report access and current both-domain comparison remain blocked; this is partial evidence, not acceptance. See `verification/nz-prices-2026-10-19/README.md`. Stats NZ 23-row structural validation is not independent re-extraction with an unprovided credential.

## Delivery and rollback

The user confirmed disconnecting Morning Rows Workers Builds in this chat on 18 October 2026 (Brisbane). This resolves the previous unsafe push path; the Builds API itself remains 403. GitHub monitoring workflows have read-only repository/actions permissions and no Cloudflare token, deploy command or secret-write command. `check.yml` dry-runs the Worker and checks the reviewed deployed baseline; a documentation/monitor commit is not represented as a production version.

Monitoring changes need no Worker deployment. To stop collection, disable only the monitor workflow; retain its last checkpoint and outbox. To restore collector code, use a reviewed Git revision, preserving checkpoint schema and receipts. The claimant-count release's Worker rollback target is the prior USA release, `e0224d26-6bcb-4f96-a580-460919a0d195`, source `c6a96283743476af730dc2ff4bd915463e47d03c`, fingerprint `42edef0b385e972f`. The earlier USA release and its own rollback evidence remain in `verification/us-paid-2026-10-20/README.md` and the historical handoff. Do not issue an actual rollback merely to test availability. Routine monitoring does not authorize another reader release, key registration, secret change or publisher contact.

## Historical remote activation evidence — 18 October 2026

This section records initial activation. Its then-pending independent wake is
superseded by the verified scheduled evidence above; the delivery receipt remains
unresolved. These manual runs are not additional scheduled cycles.

PRs [1](https://github.com/SafehavenAU/morning-rows/pull/1) and [3](https://github.com/SafehavenAU/morning-rows/pull/3) installed the monitor without deploying the Worker. Initial bootstrap [39077382567](https://github.com/SafehavenAU/morning-rows/actions/runs/39077382567) and restart [39077460651](https://github.com/SafehavenAU/morning-rows/actions/runs/39077460651) both succeeded. The second run restored sequence 1 from artifact 12117109140, then completed all 20 public requests in 22.47 seconds,635,590 response bytes, and persisted sequence 2 with 33 acknowledged incidents and no notifications. The actual full hosted job took 33 seconds. These were manual dispatches and do not count as scheduled shadow days.

Measured compressed artifact sizes were 20,981 bytes/checkpoint and 29,245 bytes/report. At one daily checkpoint retained 30 days and seven detailed reports, the steady-state storage estimate is about 834 KB before metadata, incident growth and diagnostic runs. Raw state has a 4 MiB restoration cap. This is measured sample arithmetic, not a guaranteed maximum or account bill. GitHub runner/account billing and Cloudflare CPU cost remain separate. The official GraphQL CPU query returned a budget-depleted error; retry no earlier than its stated five minutes. Daily fallback remains appropriate.

The existing Codex monitor has been updated to an hourly independent checkpoint watchdog, starting 09:10 Brisbane 18 October. Its GitHub connector download path was exercised successfully and the returned file was decoded. The workspace CLI's Azure artifact redirect returned 403; this does not imply GitHub runner restoration failed. Signed transport URLs are excluded from new adapter errors. Actual independent wake and a user delivery acknowledgment remain acceptance gates. A single labelled delivery-test event was queued by run 39077529097. Ordinary source events remain in shadow.

The CPI candidate is preserved in [draft PR 2](https://github.com/SafehavenAU/morning-rows/pull/2); it is explicitly blocked and excluded from main. The verified production rollback target remains available through the Cloudflare version API with its existing bindings; this was checked read-only.

`node scripts/exercise-maintenance.mjs` reproduces a complete constructed incident cycle against retained real AIHW aggregates: wrong-measure detection, bounded repair record, successful sibling preservation, injected interrupted write and failed delivery, reviewed candidate checks, two spaced simulated healthy checks, closure and a simulated receipt. Its output explicitly distinguishes fixture time and fake receipts from the separate real GitHub/notification evidence. No real release or notification is performed by the drill.

## Historical checkpoint incident and bounded recovery

Scheduled run 39078664324 failed before collection. Artifact IDs were not chronological; the previous selector chose the older collection checkpoint over the newer delivery-test checkpoint. See [the recovery contract](CHECKPOINT-RECOVERY.md) and `verification/checkpoint-recovery-2026-10-18/README.md`. Mode `recover` is constrained to that exact failed attempt and original predecessor. It republishes identical state, never bootstraps or acknowledges events. Normal restores reject missing newer checkpoints. Run attempts above one and pagination beyond 1,000 entries deliberately require review. Rehearsal and manual recovery do not satisfy the scheduled-run or seven-day gates.

Actual recovery39083194151 republished byte-identical state, followed by complete manual collection39083249445 (sequence3). Both artifacts were independently downloaded and verified; full state replay matches. The repair's scheduled gate subsequently passed with independently verified run39176195113, as retained in [the scheduled-cycle evidence](../verification/scheduled-cycle-2026-10-19/README.md), and was reported once. Do not repeat that transition. Current scheduled progress and the separate unresolved seven-day and delivery gates are stated above.

## Read-only shadow-window audit

Run `node scripts/audit-shadow-window.mjs CHECKPOINT CHECKED_AT_ISO` on the
connector-downloaded checkpoint. It validates the envelope digest and prints
scheduled completion span, count, gaps, deadline and whether a delivery receipt
is recorded. Exit 0 means those recorded gates are satisfied; 1 means pending;
2 means invalid input or corrupt evidence. It never writes state or sends alerts.

Elapsed hours now mean the span between actual scheduled completions. Advancing
the observer clock cannot create evidence, and a later manual collection cannot
refresh the scheduled deadline. Duplicate IDs, non-increasing/future timestamps,
invalid cadence, missing start anchor, incomplete cycles and excessive gaps fail
closed. The existing daily cadence and 26-hour budget are unchanged.

A checkpoint's `scheduled` flag and receipt string are not independently
authenticated by this command. A passing recorded window still requires original
GitHub run/attempt metadata, artifact attribution, full transition replay,
independent watchdog evidence and the actual user reply. Other data-verification
gates remain separate. Old evidence verifiers must use their pinned producer
modules: this calculation change does not rewrite historical summaries.
