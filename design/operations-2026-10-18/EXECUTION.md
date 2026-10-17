# Dependency-ordered implementation and activation gates

**This file is a future implementation plan.** Do not execute the remote preview, upload, deployment, workflow-push or scheduling steps as part of the present design task. Current worktree contains substantial unreleased US work; do not release it incidentally, reset it, or treat its nine-desk dispatcher as the published baseline.

Each row is a separate reviewable work item. Owners are roles awaiting assignment. Implementation estimates are planning ranges, not commitments: roughly **6–12 focused engineering days**, then a **seven-day shadow/observation window**. Publisher access, permissions and duty-holder decisions can block the elapsed schedule indefinitely; a finish date for all eight desks cannot honestly be promised while the UK target is blocked.

| Step / estimated effort | Inputs and affected components | Verification and exact pass criteria | Failure response |
| --- | --- | --- | --- |
| 0. Freeze scope and isolate work / 0.5 day | This matrix; `AGENTS.md`, `HANDOFF.md`, `SOURCE_PASSES.md`; published catalogue/schema; existing uncommitted work. Product owner + release operator. | Accept the proposed ten task targets across eight desks, exclusions and actual owner assignments. Create an isolated branch/worktree from a reviewed production-compatible revision; inventory/preserve local US work. Record public source/Worker/cache fingerprint, prior Worker ID and schema. | No scope approval means only maintain current explicit obligations; no fabricated completion claim. Do not remove native sources or fold US into this task. |
| 1. Import obligations and incidents / 0.5–1 day | `lib/inventory.js`, `lib/information.js`, root monitoring baseline, later supplemental records, this public audit. New proposed `verification/monitor-contracts.json` and baseline adapter. Monitoring maintainer. | Exactly 108 existing source IDs and correct nested health paths; all eight catalogue entries; no duplicate canonical keys. Apply later incident overrides, preserve last-notified states and distinguish per-domain health. Bootstrap emits zero old-incident alerts. Restart preserves open incident/outbox state. | Stop on unknown/missing baseline or identity mismatch. Investigate and reconcile manually; never overwrite with an empty or older baseline. |
| 2. Close task-specific data/evidence gaps / 2–4 days, access delays excluded | First UK CPI reader (`worker.js` ONS calls), then BoC, pharmacies, insolvencies; existing source modules/fixtures and exact metadata. Data maintainer. | One source per patch; contract covers measure/population/geography/period/unit/adjustment/uncertainty/licence/revisions. Independent selection matches original cells and separately presented publication where available. Existing successful sections remain intact. All G gates in README. | On wrong dimensions, missing licence, partial data or unreconciled revision, keep target incomplete. UK access: two bounded investigations, then blocked with evidence and review date. Do not silently substitute history/series/geography or expand sources. |
| 3. Implement deterministic collector/state adapter / 1–2 days | Existing smoke/information/source tests; `model.mjs` as illustrative semantics. Proposed `scripts/monitor.mjs`, validator modules and tests, separate workflow template outside `.github/workflows` until activation. Monitoring maintainer. | Strict deadline/concurrency/budget; consume full desks once; every required probe recorded. Test 200 HTML, timeouts, partial body, 429/Retry-After, nested-source loss, wrong IDs/units/periods, missing/suppressed states, baseline migration, duplicate events, interrupted state write, corrupt artifact and unavailable monitor. No failure updates last-verified time. | Any skipped probe is explicit; no overall “healthy” on a partial run. Reuse prior state without clearing incidents. Fixture checks cannot justify deployed correctness. |
| 4. Measure refresh cost; repair only demonstrated amplification / 0.5–1.5 days | Actual Worker Cache API behavior, `readSections`, `fetchOfficial`, per-desk concurrency/TTL, publisher limits; cold live preview. Release/data maintainers. | Instrument requests by source without tokens. Measure successful pagination/file branches, CPU, bytes, duration, concurrent cold fills and domain/colo effects. Each source has a safe proposed monitor budget, or a documented slower cadence. If needed, source-level cooldown/cache keeps failed-refresh status visible and successful siblings' cadence intact. | No known quota means no claim of global safety. Stay daily/blocked where safe frequency cannot be justified; do not introduce a global datastore solely to hit an invented request target. |
| 5. Reproduce compatibility and actual Cloudflare behavior / 0.5–1 day | Clean candidate commit, existing test suite, fixtures, documented schemas, baseline snapshot. Release operator. | Local tests and packaging pass; legacy URLs/fields/selectors, GET/HEAD/ETag, unknown filters and source isolation pass. Actual Worker preview fetches originals, then repeats after cache expiry; no fixture substitutes for live-source access. Preserve Stats NZ secret by using existing binding. | Stop release. A local pass, authenticated CLI, fixture success or returned preview URL cannot clear a failed live data gate. No secret writes or new signups. |
| 6. Promote one reviewed change and verify / 0.5 day per release | Passed steps 0–5, clean approved source, captured previous version, configured account and safe workflow. Release operator. | Use explicit version upload/activation below; identity/binding metadata reviewed privately, no secret values read. Both domains pass full regression gates before baseline promotion. Actual newly failing source must be explained; acknowledged unchanged incidents remain quiet. | If change-caused regression, return traffic to captured last-good version; verify after cache expiry. If upstream failure independent of code, keep incident open and stop claiming that affected target passed. Never mark tests passing by deleting the check. |
| 7. Prove persistence, scheduler and delivery in shadow mode / 1–2 days setup + 7 calendar days | Safe default-branch workflow-delivery decision, Actions/artifact access, monitor contract budgets, existing watch, authorized sender/ack adapter. Monitoring maintainer + operator. | No deploy permissions in job. Serial manual runs restore/upload checkpoint; terminate after checkpoint and after simulated delivery to test replay. Lost/corrupt state fails closed. 7 days: every planned probe accounted for; no silent skipped checks; zero duplicate incident events; zero daily-staleness alerts; budget within measured cap; external watchdog detects a stopped collector. | Missing access/durability/idempotent receipt/watchdog evidence blocks automated notifications. Fix in shadow mode. If default-branch push could trigger unverified deployment, do not push/activate. Retain current daily watch and disclose detection limit. |
| 8. Activate authorized monitoring and close desk targets / 0.5 day | Passed gates and named duty holders; reviewed notification destination/quiet policy and cost cap. Product owner + monitoring maintainer. | Separately authorize schedule/delivery changes, then replace obsolete saved baseline with durable checkpoint reference while preserving quiet policy. Observe one complete run, restore checkpoint in another and rehearse one synthetic incident in a test channel. Mark each desk complete only if its finite task gates G pass. | Pause only the new monitor/delivery if faulty, retain current public service and previous state. Restore last-good verifier/workflow, not an empty checkpoint. UK remains blocked until its evidence gates pass. |

## Build and release commands to use at the relevant steps

Run only in the isolated, reviewed implementation worktree. Repository credentials remain outside it. Installed Wrangler `versions upload --help` was checked during planning; `--keep-vars` and `--strict` are available. No authenticated remote operation was required for this design, so current authentication is **not re-certified** here.

```sh
# Local verification; produces build metadata and dry-run output.
npm run check
npm run build
python scripts/verify-structure-reference.py
python scripts/verify-nz-prices.py

# Before any remote preview/release: verify the configured identity privately.
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler whoami

# Existing protected remote-dev harness; inspect its pinned unstable API before upgrades.
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config CHECK_INFORMATION=1 REPORT_DIR=/tmp/morning-rows-operations-preview node scripts/remote-check.mjs worker.js /health.json /catalog.json /australia.json /new-zealand.json /canada.json /united-kingdom.json /england.json /scotland.json /wales.json /northern-ireland.json
```

The preview harness's status checks alone are insufficient: apply source/semantic validators to its saved public bodies, perform an actual second cold read, and use a separate fixture harness for failures. Keep preview tokens on protected stdin; no headers/token output. Confirm binding names and intended account privately. Do not copy credentials into a worktree or use a fixture key to claim Stats NZ is live.

Once authorized to release, and **only after all prior gates**, record actual returned/captured version IDs:

```sh
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler versions upload --config wrangler.toml --keep-vars --strict --message 'Verified bounded Morning Rows repair'
# Substitute the returned, verified ID; do not use a guessed/latest version.
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler versions deploy '<verified-version-id>@100%' --config wrangler.toml
# Rollback, if required, substitutes the captured previous good version:
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler versions deploy '<captured-last-good-version-id>@100%' --config wrangler.toml
```

These are future operator commands, not automatic tasks. Do not run `npm run deploy`, push main, write secrets or enable Workers Builds as a shortcut. Verify remote configuration divergence and secret binding presence through metadata and functional Stats NZ success; do not read secret contents. Code rollback does not restore external data, credentials or monitoring checkpoints. No stateful service migration is proposed here.

## Release regression contract

Use approved clean revision in `EXPECTED_REVISION` for a release check, not for the periodic monitor. Enable all existing addition gates, not `STRICT_SOURCES=1`, because acknowledged upstream failures are deliberately retained. Current script options:

```sh
CHECK_OPEN_ADDITIONS=1 CHECK_FISCAL_ADDITIONS=1 CHECK_TRANSPORT_ADDITIONS=1 CHECK_PHARMACY_ADDITION=1 CHECK_ASSEMBLY_ADDITION=1 CHECK_NZ_PRICES=1 REPORT_PATH=/tmp/mr-operations-apex-smoke.json node scripts/smoke.mjs
SITE_URL=https://www.morningrows.com CHECK_OPEN_ADDITIONS=1 CHECK_FISCAL_ADDITIONS=1 CHECK_TRANSPORT_ADDITIONS=1 CHECK_PHARMACY_ADDITION=1 CHECK_ASSEMBLY_ADDITION=1 CHECK_NZ_PRICES=1 REPORT_PATH=/tmp/mr-operations-www-smoke.json node scripts/smoke.mjs
INFORMATION_REPORT_DIR=/tmp/mr-operations-information node scripts/check-information.mjs
```

Run the current implementation's schema validator too; status checks are not schema validation. Preserve each run's dated outputs instead of overwriting release evidence. `CHECK_US` stays unset. Compare per-source success/coverage against the immediately preceding verified snapshot: merely having one healthy source per desk is insufficient. Existing smoke numeric/year constants must be updated only with a verified new publisher vintage; they are baseline regression assertions, not perpetual publisher rules.

Mandatory result on **both** domains:

- Approved clean source/Worker identity matches; eight desk IDs and URLs, `/morning.json`, v1 schema and selected URLs preserve compatibility. No US endpoint becomes live from this package.
- NZ exact 23 series/dimensions, finite numeric values with correct period, unit and geography. Prices are a separate five-node day/interval/status contract.
- AIHW complete eight jurisdiction × five triage coordinates; current 2024–25 values match the frozen 40-cell reference. A future sanctioned suppressed cell must be represented explicitly and reviewed, never converted to zero.
- Wales projection retains population/age/sex, base vintage and selected mid-year; NISRA retains four exact statistic IDs, national geography, academic year and method/coverage caveats.
- Every previously successful source remains successful or has a separately evidenced upstream incident; ordinary source failure never empties unrelated data. New hidden failures, changed units/geography, fake freshness or incompatible selectors are release failures.
- Unchanged monthly/annual data stays valid. New period, verified revision, failed refresh and recovery produce distinct state transitions; same unresolved incident does not generate another alert.

## Activation go/no-go checklist

**GO only if all are true:** accepted finite target; named roles/destination; current baseline imported without notifications; every source registered; deterministic and original-evidence checks pass; real preview passes for each changed reader; regression gates pass; measured budgets acceptable; default-branch workflow delivery cannot trigger an unverified release; authenticated artifact round trip and restart proven; seven-day shadow evidence complete; separate watchdog and notification receipt path tested; schedule/delivery changes explicitly authorized.

**Current result: NO-GO for activation.** This task supplied the design, public audit and 26 isolated state/contract exercises. It did not establish remote Actions access, durable artifact operation, notification acknowledgments, seven-day shadow performance, named roles, safe default-branch delivery, exact publisher quotas or completed UK CPI access/contract. These are implementation dependencies, not reasons to ask for another Cloudflare login now.

## Handoff and watch prompt to adopt only at activation

Update the saved watch to consume the latest validated checkpoint and its expected collection deadline. Preserve acknowledged incidents and last-delivery receipts. Check both public domains only when checkpoint evidence calls for diagnosis, avoiding a second full hourly collector. If the checkpoint is overdue/unreadable, diagnose the monitor independently and create one monitoring incident. Notify only a confirmed new failure, meaningful recovery, validated-data regression, severity escalation or required user action. Stay silent for unchanged states, ordinary validated releases and non-actionable queue items. Never deploy, push, change keys, register access or contact publishers from the watch.

Keep the first public baseline, later confirmations and existing root incident history append-only. Do not replace historical successful evidence with a later failure or imply the fixture run is production. Subsequent releases append source contract/evidence/version decisions; a new project scope requires a new explicit target, not endless expansion of this completion matrix.
