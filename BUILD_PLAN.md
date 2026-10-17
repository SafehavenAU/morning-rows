# Morning Rows continuous build plan

Reviewed 17 October 2026, Australia/Brisbane. Follow `AGENTS.md` for source eligibility and `HANDOFF.md` for existing coverage. The next build must restore usable figures before expanding coverage. A successful HTTP response or deployment is not proof that a desk contains usable data.

## Implementation status — 17 October 2026

The starting-point review below is historical. The recovery implementation includes Stats NZ dimension selection and parsing, per-source isolation, bounded requests, 32 deterministic tests, reproducible dependencies, CI and production smoke checks, observability, release identity and cache fingerprints. All 23 Stats NZ rows passed Cloudflare preview. ABS and ONS refusals remain explicit errors.

The initial discovery batch adds FSA counts, Scottish bill stages and Canadian recalls. The second batch replaces the static hospital table with verified request-time AIHW data, repairs StatsWales selection/pagination, and adds national NISRA aggregates. The legislation feed remains unavailable from Workers and is logged. See [SOURCE_PASSES.md](SOURCE_PASSES.md) for source evidence and the unfinished second pass.

The current OAuth grant cannot inspect Workers Builds settings (HTTP 403). Release proceeds through the authenticated Wrangler CLI, preserving the existing runtime secret. Main-branch pushes remain on hold until the automatic commands are verified as `npm run check` and `npx wrangler deploy --config wrangler.toml` without secret-writing steps. This is a pipeline-settings limitation, not a restriction on the separately authenticated Worker deployment operation.

Stages 1–2 are implemented and preview-tested, with a broader inherited-series audit still open. Stage 3 awaits production verification of the direct release. Stage 4 has not reached a completed empty pass. Categories and a daily monitor remain pending. Prepared GitHub CI is not active remotely until these commits are pushed.

## Verified starting point

| Area | Finding |
| --- | --- |
| Repository | `SafehavenAU/morning-rows`; local HEAD and remote `main` both `2cb3ffd457c6eae7e5b5310049217f9d71b45ab2` at review time. |
| Runtime | One JavaScript Worker, `worker.js`; Wrangler `4.151.1`; compatibility date `2026-10-16`. Custom domains configured for `morningrows.com` and `www.morningrows.com`. |
| Build | `node --check worker.js` and Wrangler deployment dry run pass. |
| Cloudflare access | Authenticated. Latest deployment returned by Wrangler serves version `21631712-c553-444c-9fdb-647d1cb6c92e` at 100%; created 17 October at 11:53 AEST. Its metadata does not establish the source commit. |
| Stats NZ secret | Production version has `STATSNZ_KEY` as a secret binding. The public response contains upstream observation text, with no per-table HTTP errors in this sample. No secret value was read. |
| Discovery | `/llms.txt`, `/catalog.json`, and `/keys.json` return HTTP 200. The catalogue lists eight desks. The log contains 18 key-required entries and 11 blocked entries. |
| Build configuration gaps | No tracked lockfile, tests, test command, CI workflow, or `.gitignore`. Wrangler config does not declare logs or traces; dashboard settings were not verified. Existing generated `.wrangler/` files are untracked. |
| Deployment pipeline | Repository instructions say Cloudflare Workers Builds watches `main`. The dashboard connection, build commands, and automatic trigger have not been independently verified. Do not treat the documented setup as proof that continuous deployment is healthy. |

## Live data check

All eight desk URLs returned HTTP 200. The content check found:

| Desk | Observed result | First action |
| --- | --- | --- |
| New Zealand | `stats.present` is true, but **0 of 23 Stats NZ rows have both a period and a value**. All 23 contain observation text in the diagnostic `header` field. Power and GeoNet sections contain data. | Repair CSV parsing and validate series selection. |
| Australia | Jobs, prices, approvals, wages, retail, population, household spending, and construction sections are empty or null. Other sections contain data. | Diagnose ABS reads from the deployed Worker and retain per-source errors. |
| Canada | Populated top-level sections; no top-level error observed. | Establish a freshness and metadata baseline; this sample does not validate every figure. |
| United Kingdom | `error: "not read"`. | Isolate failing sources so one failure does not discard the desk. |
| England | `error: "not read"`. | Isolate failing sources; preserve the distinction between England, Great Britain, and UK figures. |
| Scotland | `error: "not read"`. | Diagnose population, unemployment, and holiday reads independently. |
| Wales | `error: "not read"`, but a StatsWales projection survives separately. | Preserve the projection while recovering the remaining fields. |
| Northern Ireland | `error: "not read"`. | Diagnose population, unemployment, and holiday reads independently. |

An ONS Scotland population CSV and an ABS labour-force request both returned usable data directly from this workspace. The ONS parser returned period `2025` and value `5545500` from the retrieved CSV; the ABS response contained a September 2026 observation in the expected structure. These checks do not explain the deployed failures. Investigate Worker-specific responses, other requests in each group, and cached failures before declaring either publisher unavailable.

### Stats NZ diagnosis

`statNzFromCsv` removes every line beginning with `DATAFLOW` or `STRUCTURE` before looking for `TIME_PERIOD` and `OBS_VALUE`. Those prefixes can start the actual SDMX CSV column header. A local fixture with `DATAFLOW,TIME_PERIOD,OBS_VALUE` and observation `2025,123` reproduces the blank fields seen in production.

The reader also selects the first data row from an unrestricted `/all` query and reads only the first 800,000 bytes. Observation text in the live response includes historical periods such as 1978 and 199806 despite requesting `lastNObservations=1`. Do not assume that parameter or the first row yields the intended current headline. Some tables are fixed-year cross-sections or projections and require different period handling.

## Build order and completion gates

### 1. Restore Stats NZ correctness

- Detect CSV column headers by exact column names; retain valid `DATAFLOW` and `STRUCTURE` headers. Handle quotes, BOMs, metadata preambles, empty/suppressed values, and zero values.
- Inspect each table's dimensions and choose an explicit series with a documented geography, measure, unit, and adjustment. Keep region, age, sex, ethnicity, industry, and projection-scenario distinctions where relevant. Never label an arbitrary subgroup as a national headline.
- Verify the API's actual period filtering and ordering. Use bounded, explicit queries rather than truncating an unrestricted download and selecting its first row. Give fixed-year cross-sections their documented reference period and identify projections separately from observations.
- Handle each table independently. One rejected request currently rejects the entire `Promise.all`; preserve successful tables and return a specific error for the failed table. Keep binding presence separate from upstream and parsing health.
- Add regression fixtures covering standard SDMX CSV, quoted headers, metadata, zero, suppression, missing time dimensions, and a failed request among successful tables.

**Gate:** every one of the 23 configured tables returns either a validated observation with source, period, unit, geography, and relevant dimensions, or an explicit reason it cannot supply one. No silent blank successes. Verify representative values against the official source, then check `/new-zealand.json` after its two-minute cache expires. Update the handoff with actual outcomes, not just a deploy success.

### 2. Recover the existing desks

- Diagnose the Australian ABS requests and the five UK/nation desk failures individually in the Worker execution context. Record response status, content type, duration, and parser failure without logging credentials or request headers.
- Replace all-or-nothing groups where a single upstream error discards unrelated results. Add bounded request timeouts and concurrency; respect publisher rate limits and retry guidance.
- Add source-level `status`, `fetched_at`, observation period, and error information. Preserve existing public fields where possible. Distinguish an empty event list from a failed read.
- Review caching of failures. Use a shorter failure lifetime where appropriate and do not report a degraded response as healthy merely because it is cached.
- Audit provenance and units across existing rows, including the static hospital table. Keep its publication/reference dates explicit. Retain accurate UK and Great Britain geography on supplementary England-desk figures.

**Gate:** all eight desks retain successful sources when another fails; missing figures have specific reasons. A bounded live check identifies degradation and freshness issues without requiring every external service to be continuously available.

### 3. Make builds reproducible and releases verifiable

- Add a lockfile and a supported Node version; use `npm ci` for reproducible installs. Keep the pinned Wrangler version until a deliberate upgrade is tested.
- Add `.gitignore` coverage for `.wrangler/`, dependencies, build output, local secret files, and logs. Never commit OAuth credentials or `STATSNZ_KEY`.
- Add syntax, parser, failure-isolation, and response-contract checks. Use deterministic fixtures in pull-request CI; separate bounded live-source checks so a publisher outage is not mistaken for a code regression.
- Verify Cloudflare Workers Builds points to this repository and `main`, with the correct root, install/build commands, and `npx wrangler deploy --config wrangler.toml`. Remove any build step that writes the runtime secret. Recent deployment history includes repeated secret-triggered deployments; inspect the configured command before assuming that old issue is resolved.
- Enable sampled Worker logs and traces using the existing configuration format. Record source failures in structured logs. Do not log token values or upstream authentication headers.
- Keep deployment through the established main-branch pipeline. Record source SHA, deployed version, and content-check results together. Add an additive release identifier so production can be matched to source without guessing from timestamps.
- After release, check discovery files, all eight desks, the Australia alias, both domains, and a missing route. Check JSON contents as well as HTTP status. Account for cache lifetimes: NZ two minutes, Australia five, UK/nations ten, Canada sixty. A query-string cache buster does not bypass this Worker's pathname-only cache key.
- Retain the previous working version for rollback. Roll back a release regression; do not repeatedly redeploy because an upstream publisher is unavailable.

**Gate:** a reviewed change runs deterministic checks, builds reproducibly, deploys a traceable version, and produces a content-level verification report. The runtime secret remains untouched by normal builds.

### 4. Repeat official-source discovery passes

Run the following loop after the recovery gates pass:

1. Read `AGENTS.md`, this plan, the current handoff, each desk's sources, and `/keys.json`. Remember that `/keys.json` is generated in `worker.js`, not a tracked JSON file.
2. Create a pass record with an identifier, date, baseline revision, and a checklist of all eight desks. Record concrete publisher/endpoint candidates and why they are not already covered or logged.
3. Prioritize the thin Scotland, Wales, and Northern Ireland desks, then remaining gaps across Australia, New Zealand, Canada, the UK-wide desk, and England. Candidate research areas include national statistics, public health, environment, transport, energy, and legislatures; each endpoint must still pass eligibility checks.
4. For every candidate, verify official publisher, free access, no new key requirement, copying terms, geography, units, time coverage, and current response format. Record the checked URL and date.
5. Add a qualifying feed to its country desk with parser/failure checks. Add key-required feeds to `needs_a_key` without signing up or calling them. Add refused, stale, or removed feeds to `blocked`; record copying restrictions on the relevant desk. Deduplicate entries and keep moving when a feed fails.
6. Keep the already-authorized Stats NZ integration as the existing exception. Reconcile its misleading placement in the key-required log without exposing its secret or implying that other keyed feeds may now be called.
7. Finish a small coherent change, run the checks, release through the established pipeline, and verify affected production content. Update `HANDOFF.md` and the pass record with added feeds, new log entries, unresolved defects, and the next candidates.
8. Start the next pass from that record. Continue until one **complete eight-desk pass** adds zero open feeds, zero new key-required entries, and zero new blocked entries. Do not count a stalled or incomplete pass as completion. Record excluded candidates so later passes do not repeat the same research.

**Gate:** every pass is resumable and its coverage and counts are auditable. The stopping condition describes the completed search pass, not proof that every possible public dataset has been found.

### 5. Add categories only when coverage supports them

After the empty-pass condition, build a measure-by-desk matrix from verified data. Add a cross-country subject file only when the same comparable measure exists on every desk, with clear units, periods, geography, and methodology. Keep incompatible measures separate and do not publish placeholder category pages.

## Operating cadence

The development loop advances through small verified changes; it is separate from request-time fetching. Routine new source observations do not require rebuilding the Worker. Keep the public desks request-driven with short caches and no private records database.

Once implemented, run deterministic checks on every change and bounded production checks after deployment. A daily content monitor should check source health and publication cadence, notifying only on meaningful new failures, recovery, or required action. Do not label monthly or annual data stale merely because it did not change today. A recurring monitor or autonomous build job has not been created by this plan.

The immediate next action is to release this verified batch through Wrangler and run the production content check. Then continue the logged discovery queue and provenance audit. A refusal from one publisher never stops the wider discovery pass.
