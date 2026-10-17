# Monitoring contracts, state and operating design

All scheduling, storage and notification behavior below is **proposed**. The included `model.mjs` is an offline model, not a production collector. Its row fingerprint and period comparison exercise the selected fixtures only; production still needs full provenance/definition hashing, projection-selection rollover, task-impact handling, escalation deadlines and persistence/delivery adapters. The existing daily watch is unchanged.

## Smallest system and its gates

1. **Existing Worker:** continue serving live public aggregate data with isolated source failures. No monitoring secrets or background scheduler need to be added to it.
2. **One deterministic Node verifier:** public HTTP only; one desk response per domain per run reused for all source/measure checks. Do not issue 93 selected requests on every maintenance cycle. Use selected URLs for a daily rotating compatibility sample and full pre/post-release audits.
3. **One serialized GitHub Actions monitor workflow with artifact checkpoints:** reuse repository/toolchain capability, no new hosted database. Separate from `.github/workflows/check.yml`; no Cloudflare token, no repository write or deployment commands. Repository `actions:read` and `contents:read`, plus the workflow's artifact upload capability, suffice for collection/state. Keep PR/untrusted-fork jobs away from production state and notification credentials.
4. **Existing Codex watch as an independently scheduled watchdog / human-facing incident reviewer:** proposed hourly, reading the verifier checkpoint age and pending incidents. Its current daily schedule is too slow for the proposed detection goals. It must retain the user's silence/dedup policy. No schedule was changed here.

GitHub scheduling runs the default branch, may be delayed/dropped, and can be disabled after inactivity. Adding a workflow to main currently risks the unverified Cloudflare Builds trigger. **Do not push it to main to try it.** Develop with local/offline tests, then a manual dispatch on an authorized safe branch if supported. Before scheduled activation, the release operator must establish a safe way to deliver workflow changes that cannot inadvertently deploy or replace secrets. If that cannot be proven, leave the current daily watch in place and mark higher-frequency monitoring blocked.

Artifact access, a successful restart from a previous run and an authorized notification/acknowledgement adapter are mandatory gates. Remote Actions execution, account plan, artifact policies and Codex access to private artifacts were not proven here. A copied JSON file in this ephemeral workspace or chat memory is not the durable checkpoint. If artifact limitations defeat serialization/retention/recovery, bring back that measured failure before proposing a state store. Do not add KV/D1/R2/Queues speculatively.

## What every check proves

| Layer | Contract / failure classification |
| --- | --- |
| Monitor execution | Correct pinned verifier version, valid prior checkpoint, deadlines and all planned probes recorded. Collector crash, missing artifact, permissions failure or unreadable baseline = **monitoring failure**, never 108 invented source outages. |
| Service/discovery | Both identities match the approved release; catalogue desk IDs/URLs preserved; schema version, content type and links valid; robots and `llms.txt` remain accessible. Identity health alone proves no data correctness. |
| Transport | DNS/TLS/status/timeout/size limit; record Retry-After. A 200 outage page, redirect to login, or truncated body is not successful data. No credentials in URLs or captured headers. |
| Schema/parse | Parse with size bound; validate expected envelopes, source presence, types and compatible schema; missing sources are explicit coverage failures. Distinguish whole-request failure from one publisher failure. |
| Definition | Exact publisher series/table/dimensions, geography and boundary definition, population, unit/base, seasonal adjustment, statistic type. Unknown metadata stays unknown; similar titles do not establish comparability. |
| Observations | Required keys unique, exact periods present, values finite when observed, supported null states qualified; check domain-specific bounds, totals and rounding. Never sum percentages for different denominators or projections across incompatible populations. |
| Provenance | Publisher URL, source identifiers, licence/attribution and needed caveats present; semantic comparison must notice their removal. Record source release/version where available. |
| Timing/version | Observation period, publisher publication time, attempted retrieval, last successful retrieval and last independently verified content are separate. Cadence is per source, not per desk. |

The live registry in `production-audit.json` enumerates all 108 source keys and health/data pointers, including England's nested `also.sources`. First implementation produces a checked-in **monitor-contract registry** with, per key: owning task(s), parser/schema version, exact definitions, coverage predicate, semantic validator and evidence pointer, publisher rate budget, known cadence and next verified release or `null`, allowed delay, licence, incident group and owner. Unknown cadence/semantic validation/rights are explicit gaps, not automatically green checks. Every published source must have at least transport/parse/presence/provenance-loss coverage before activation.

The 93 described measures retain their v1 exact selected URLs and source-to-native pointers. UK CPI and NZ prices need source-specific validators despite native representation. Monitor schema/status separately from numeric answers: a legitimate nonnumeric published state can be schema-valid yet unsuitable for a numeric task.

## Cadence and change classification

| Evidence | State and action |
| --- | --- |
| Same observation key, definition, value, annotations and release identity; later retrieval | `unchanged_valid`. Advance successful retrieval time only. Annual/monthly data is not stale merely because unchanged. |
| Release scheduled in future / within documented grace | `awaiting_expected_release`. No user alert. Grace is configured from release timing and measured availability, not guessed from observation month. |
| No verified schedule | `schedule_unknown`. Preserve limitation; do not infer a missed daily/monthly release. Check publisher release calendar in a bounded evidence task. |
| New published period with verified source release | `new_period`, validate/reconcile and update baseline quietly. A change of the site's current-year projection selector is `selection_rollover`, not proof of a new publisher release. |
| Same period but changed value/flag/definition | `revision_pending`. Keep previous verified reference separately; retain candidate evidence and compare publisher release. Promote only after validation; authorized revisions are normally quiet. Unexplained changes affecting an answer create a review ticket, then an alert if action is needed. |
| Required old row disappears / duplicate or mixed dates / unexpectedly small result | `partial_or_incompatible`, semantic incident; do not accept a smaller success set. |
| Publisher explicitly suppresses/unavailable/missing | Preserve exact state and reason, value null. If that removes a previously supported numeric answer, record task impact and review; never quietly clear that obligation. The exercise's accepted suppression demonstrates representation, not automatic acceptance of coverage loss. |
| Refresh fails | `retrieval_failed`, record attempt/error. Preserve last-good evidence internally without advancing its verification time; public failed section remains explicit. Serving retained observations would need a separate additive contract with `retained`, `as_of` and failed refresh details; no such fallback is introduced by this design. |

**Release lateness:** use verified publisher release time + source-specific measured grace + maximum relevant cache interval. Confirm with a second due check. The model uses a **constructed 24-hour grace** only to demonstrate the rule; it is not a real publisher SLA. BoC business days must include Canadian holidays and Eastern DST; NZ price days use Pacific/Auckland with 46/48/50 trading intervals; NISRA academic years and AIHW financial years are not calendar years. Stats NZ's 23 selections have different cadences, and some are historical cross-sections/projections. The insolvency metadata expiry date is an evidence-review trigger, not automatically proof that a release occurred.

## State, persistence and privacy

Stable observation key = canonical desk/source/measure + geography/dimensions + period; value is never part of its ID. Definition version hashes population/unit/base/adjustment/geography convention. Content version hashes the observation, missingness, qualifications, provenance and publisher vintage, excluding attempt times and request noise. A service ETag is useful but insufficient: it can combine health and content and its implementation currently strips only selected timestamp names.

Required checkpoint fields:

```text
schema_version, verifier_revision, checkpoint_sequence, prior_checkpoint_digest
run_id, started_at, completed_at, last_complete_collection_at, planned/completed probes
approved_production_identity, registry_version
source key → last_attempt(status/time/error), last_successful_retrieval
             current candidate(version/evidence), last_verified(version/time/evidence)
             required coverage, expected release/grace (nullable)
             consecutive outcome counters and first-confirmation times
incident → stable id, contract/source key, affected domains/tasks, severity,
           first/last seen, acknowledgment, next review, closure conditions
outbox → event id, incident id, event type, delivery state, attempts, receipt
```

Use canonical source keys to group cross-domain source incidents; retain each domain's evidence so a `www`-only failure cannot be hidden by apex success. Group shared ONS/ABS outages into one notification with the individual source members. Do not group away incorrect geography or a new lost core task. Raw error text/403→429 changes alone must not generate new incidents.

Artifacts are immutable per-run envelopes with producer run ID, pinned verifier revision, checksum and predecessor digest. A checksum detects corruption, not malicious modification; trust only this allowlisted workflow/ref and GitHub access controls. One workflow-wide concurrency group, `cancel-in-progress: false`, including manual replays and notification acknowledgments. A later queued run can still be dropped by platform behavior; watchdog notices missing completed checkpoints. Read the newest valid chain head, not merely the latest successful workflow: a run can upload valid state and then fail. Never roll back to an earlier checkpoint merely because the latest run conclusion is failure.

Write/check/upload the checkpoint before marking collection complete. On upload/download/sequence failure, preserve the prior checkpoint, stop notification delivery and raise one monitoring incident. Never initialize empty incidents because artifacts expired or credentials failed. Bootstrap is a deliberate operator import of the existing baseline plus later incident records and a fresh audit; log the source digests and silence imported acknowledged failures. Rehearsal fixtures and simulated acknowledgments must never merge into that import.

Retention proposal: hourly state and concise reports **7 days**; one daily checkpoint **30 days**; carry every open incident and dedup receipt forward in every new checkpoint until resolved; resolved incident/evidence **90 days**; release evidence/manifests **1 year** or existing repository policy if longer. A ≥30-day shutdown needs a reviewed baseline recovery from the last retained release record; never silently restart. Keep minimal latest/previous aggregate versions and anomalous cells, not full raw publisher archives or visitor request logs. Respect per-source licence; no personal data or secret-bearing headers. Repo docs retain public aggregate specimens only.

## Schedules, budgets and detection goals

Proposed scheduled verifier at **17 minutes past each hour**, maximum runtime 12 minutes, maximum two simultaneous desk requests; no overlap with itself. Each run requests health + catalogue + eight desks from both domains: **20 requests/hour = 480/day**, of which 384 are desk requests. Reuse the responses for all source/contract checks. All eight get equal availability checks; publisher cadence controls release assertions, not source health sampling.

Daily additional discovery/compatibility budget **60 requests**, including eight source directories, two schemas/robots/llms sets and a rotating selected/conditional sample. Full route matrix only on release or a structural failure. Direct original-publisher reconciliation runs once per changed/due core source, capped at **30 requests/day** across sources; if the selected source requires more, record pending verification and a reviewed explicit budget. No budget exhaustion silently becomes validation success.

Transport confirmation uses the next hourly run by default. If diagnosis is urgent, at most one bounded confirmation per affected desk/domain, ≥15 minutes after first failure, within a **32 extra desk requests/day** budget. Honor `Retry-After` if later; exponential backoff 15m, 30m, 60m with jitter capped at 24h for a repeatedly failing publisher. A contract or deadline cannot override a publisher limit. Do not sleep for long periods inside a job: record `retry_not_before` for the next run. After two diagnostic sessions, park upstream-access work with weekly evidence review; ordinary cached health observations still record its ongoing state.

**Important current limit:** the Worker refetches all sources when a degraded desk's 30-second cache expires. A monitor cannot enforce publisher-level backoff by delaying only its own direct requests while whole-desk reads keep refetching that publisher. Before hourly activation, measure per-desk cold fan-out and set an acceptable budget; where it fails, implement a bounded source-level cooldown/cache in the existing Worker with explicit failure health. Local/isolate coalescing is not a global quota mechanism. If safe publisher limits cannot be met, retain daily collection for those desks and disclose the resulting slower detection goal. Do not imply the initial hourly budget is guaranteed safe today.

Nominal goals after activation: core semantic regression detected on first hourly run (≤60m + runtime under normal scheduling); new transport outage confirmed by second run (≤120m + runtime). Watchdog checks hourly; checkpoint age >150m triggers one monitoring incident, giving nominal detection within **210m**, plus scheduler delays. These are operating targets, **not hard SLAs**: Actions and Codex schedules are best effort. If a strict sub-hour SLA becomes a requirement, this design must be revisited with measured need for independent uptime infrastructure. The present daily watch provides no such guarantee.

## Request and cost assumptions

[Live audit](production-audit.json): 38 requests, 757,907 response bytes, including 631,221 bytes for both copies of all eight desks. Approximate hourly desk payload = **15.15 MB/day**, before changes/compression/retries. These are response bytes, not publisher-transfer or CPU measurements.

At the proposed budget: 480 + 60 + 32 = **572 Worker requests/day**, **17,160 per 30 days**, plus up to 900 direct publisher reconciliation requests/month. Desk cold-read upper *scenario* = 416/day; if each cold desk performs 25 publisher requests, ~10,400/day; at 50, ~20,800/day. Those 25/50 figures are **sensitivity assumptions, not measured fan-out or quotas**. Exact `F_d` must be measured with fetch instrumentation and real payload branches; a timeout-only mock undercounts pagination/secondary calls. Formula: `Σ cold_d × F_d + direct_reconciliation`; traffic from real users adds independently. Configured Stats NZ key quotas, shared anonymous quotas and current account usage were not read or established.

Cache API content is local to a Cloudflare data center. Current keys also differ by domain/path and release fingerprint. Two domains, multiple colos, human versus JSON routes, concurrent cold fills and a new release can all multiply publisher reads. Neither an ETag nor a warm workspace test proves a global request ceiling. No publisher budget approval until these effects are accounted for.

Cloudflare's [published pricing](https://developers.cloudflare.com/workers/platform/pricing/), fetched this task, lists Standard at $5/month minimum, 10M included requests and 30M included CPU-ms, then $0.30/M requests and $0.02/M CPU-ms. At 17,160 calls/month, hypothetical 10ms/100ms mean CPU adds 0.172M/1.716M CPU-ms. If entirely above allowances, request cost is about **$0.0052**, CPU **$0.0034/$0.0343**. These are marginal arithmetic examples, not an account bill; existing usage/plan is unknown. Network wait is not CPU. The Free 10ms CPU limit cannot be assumed adequate for workbook parsing.

Runner time: 720 hourly jobs × assumed 2–5 billed minutes = **1,440–3,600 minutes/month**, watchdog allowance separate. Current collection took about 56 seconds locally; that is not a CI billing measurement. A 12-minute ceiling bounds verifier jobs at 8,640 minutes/month before manual runs. Use actual account minute allowance and rate `P`: incremental cost = `max(0, billed minutes − available allowance) × P`; no asserted free runner entitlement.

Storage scenario: 168 hourly checkpoints × 0.25MB + 168 reports × 0.5MB + 30 daily checkpoints × 0.25MB ≈ **133.5MB**, plus incident/release specimens. Alert at 200MB, stop optional archives at 250MB pending budget review. Enforce payload caps; do not claim these averages are measured. Artifact/account billing and retention policy require verification. Codex watch execution cost/limits are also unknown; run it on concise checkpoints, not repeated full-site research. Seven-day shadow measurements determine final frequency and spend cap before activation.

## Incident handling and roles

| Severity | Trigger / confirmation | Next action / closure |
| --- | --- | --- |
| P1 correctness/release | Core value/definition/coverage regression; first validated evidence opens incident. Repeat affected read promptly within budget; no need to wait to flag a plausible wrong answer. | Data maintainer compares exact source cells, dimensions and release. Release operator assesses last-known-good rollback if change-caused. Close only after repaired/reconciled data and two good checks ≥15m apart. |
| P2 availability | New supported-source error in two checks ≥15m apart, normally successive hourly checks; one 429 alone is suspect. | Check original endpoint/status, failure scope and Retry-After; preserve successful siblings. Close after two spaced successes with source contract validation. |
| P2 monitoring | Missing/corrupt checkpoint, repeated collector failure, or no complete collection for 150m. External watchdog owns detection. | Check run history, access, artifact chain and runtime budget; do not diagnose source failure from missing probes. Close after restored checkpoint and two complete runs. |
| P3 evidence/action | Unknown release policy, licence change, unsupported user requirement, unreconciled revision affecting a task. | Prepare a bounded evidence/decision ticket. Notify only when a concrete user decision or time-sensitive task impact exists; otherwise queue quietly. |

Every notification includes incident/event ID, affected task/source and domains, first/last observations, previous and candidate period/version, exact check failure, evidence URLs/hashes, known-incident relation, diagnostic next step, owner role and closure condition. Never include credentials or full response headers. Correlate common publisher outages; expose new task impact as escalation under the same incident. Two unresolved checks do not mean two notifications. A known ABS/ONS access failure remains quiet unless it gains a new material impact. Healthy days and normal releases produce no user status message.

Escalation: P1 unowned/unreviewed after 4 hours → one owner-action event; P2 after one business day → one owner-action event if intervention is needed. Keep a persisted escalation level/deadline; do not page every day. Quiet hours do not suppress newly established incorrect data, but nonurgent evidence work waits for the maintainer's next work window. The four-hour/one-day response targets require an actual assigned person; no staffed on-call coverage is assumed.

**Roles to assign before activation:** data maintainer (contracts/reconciliation/repair), release operator (preview/promotion/rollback), monitoring maintainer (collector/state/budget/watchdog), product owner (scope/credentials/cost decisions). One person can hold several roles; the release evidence should still be reproduced by a separate parser or reviewer. Until names and escalation destination exist, these are unassigned responsibilities, not guaranteed service.

Delivery uses a durable outbox keyed by `(incident_id, event_type, escalation_level)`. Persist pending event before send; record receipt after successful delivery; retry only pending events with the same idempotency key. The receiver must support idempotency or there is a crash window between send and receipt. **Exactly-once delivery is not claimed.** The existing Codex watch's artifact read, user-message delivery and durable acknowledgement path must be demonstrated in a manual test before it is used as the sender; if unavailable, keep notification review manual until an authorized adapter is selected. No Slack/email/publisher contact is configured by this plan.

## Example runbooks

- **NZ EMI failed refresh:** inspect the selected latest completed-day file and the error, then verify five node codes and all expected intervals. Do not substitute an earlier day. Stats NZ remains independently usable. Two complete new-day reads close the price incident; an interim→final change for the same observation is a release-status revision to retain.
- **UK CPI mismatch:** attach both `D7BT` and `D7G7` period/value/metadata rows and the official release. Refuse the combined answer on unequal periods; quarantine only that selected representation if a reviewed repair requires it. ONS 403→429 alone stays the existing access incident. Never replace UK CPI with an England series or CPIH.
- **AIHW suppressed cell:** retain publisher code/footnote and null; compare original table and year. A zero without suppression flag is a materially different assertion. The existing numeric baseline is not permission to invent zero; a legitimate changed coverage contract needs review and an accurate consumer limitation.
- **Ontario `www` timeout/520:** compare the same native source on both domains after cache expiry, then one direct official read if needed. One occurrence followed by health is transient, not a repeated new incident. Keep other Canadian sources available.
- **Lost monitor checkpoint:** stop sends and preserve run artifacts. Restore the newest valid chain head, including pending outbox; bootstrap only with explicit operator reconciliation if all retained state is gone. The independently scheduled watch alerts on overdue successful collection even when `/health.json` remains green.

Documentation checked: [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), [GitHub schedule limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [artifact access/retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts), and pricing above. Fetch records: `system-docs.json`. No current account quota or remote authorization was inferred from these public documents.
