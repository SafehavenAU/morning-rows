# Executable onboarding plan: United States, first release

Status: **research GO; production NO-GO: BLS bulk/metadata/footnotes return 403 from Cloudflare**. The current dependency-ordered, per-step inputs/outputs/commands/failure actions are in [EXECUTION.md](EXECUTION.md), backed by the [isolated rehearsal](rehearsal/README.md). This overview retains the design and future release commands. One source (`cpi`), one measure (`CUUR0000SA0`), one national urban geography, 13 calendar slots. No state, county, metro, territory, other inflation series, arbitrary history, contract processing, MCP server or new storage service in this release.

## Current project and the compatibility decision

Inspected: repository AGENTS.md and HANDOFF.md, worker routes/headers/discovery, `lib/information.js`, `lib/inventory.js`, source-pass/research queue, smoke/preview/information scripts, package/Wrangler configuration, published health/catalogue/schema/llms on both domains, and the monitoring baseline. The live US route is 404. Runtime remains clean source `7d614e2e78a63fc16f705b67e35ed0438baa7d87`, Worker `739b9031-305c-4bc7-afc5-79a82c654ac7`. The unfinished UK/NZ/AU/Canada research remains pending; US scope does not replace it.

| Existing assumption | Consequence and required change |
| --- | --- |
| `lib/information.js`: literal eight `DESKS`, schema 1.0 country enum, catalogue `minItems:8,maxItems:8` | A ninth entry in `/catalog.json` fails the published contract. A new major version is required; calling it an additive metadata change would be false. |
| `lib/inventory.js`: eight desk inventories, 108 reader sections | Add one US inventory entry only in the v2 registry. Existing entries/keys/native pointers stay intact. |
| `validateSelection`, `catalogue`, `cells`, `validCell`, `selectedResponse` in `lib/information.js` | Current described selection assumes exactly one cell per measure and assigns `candidates[0].row` to measure data. A 13-month measure cannot use that branch unchanged. Introduce a US/v2 branch with unique `(measure,period)` coverage; do not manufacture 13 measure IDs. |
| `worker.js`: `LLMS`, `AI_CATALOG`, `DESK` HTML, route branches, `HOLD_SECONDS`, sitemap | Add US route/rendering/cache policy and v2 discovery. Change “eight desks” only in current discovery, keeping the v1 compatibility description explicit. Unknown routes must still 404 rather than fall through to Australia. |
| `scripts/smoke.mjs`: literal desk list and length-eight assertion; `scripts/check-information.mjs`, `test/information.test.js` | Keep explicit v1-eight tests and add v2-nine tests and US contract checks. Do not globally replace every `8` with `9`. |
| AIHW eight jurisdictions, NZ fleet eight rows, Australian eight-capital CPI and bounded feed counts | These are source/data counts, **not desk counts**. Preserve them. |
| `scripts/evaluate-structure.mjs` and saved eight-desk evidence | Preserve historical evidence and its frozen fixture. New US evaluation is separate; do not rewrite old results to imply nine desks existed. |
| AGENTS.md, HANDOFF.md, source-pass records, monitoring baseline | Update the active release instructions/desk table only when implementation is real; retain dated past evidence and last-notified source states. |

**Selected migration:** preserve `/catalog.json`, `/catalog.json?desk=<existing>`, `/schema.json` and all existing desk/selector responses as schema **1.0**. Publish `/catalog.v2.json` as the new nine-desk directory and `/schema.v2.json` for the v2 catalogue and US response. New `/catalog.v2.json?desk=united-states` describes the single US source. V2 catalogue entries for the existing eight link to their existing v1 directories/records and explicitly identify each resource's schema. A directory version does not silently upgrade every resource it links to.

Route current `llms.txt`, AI discovery, homepage navigation and sitemap to the v2 catalogue; label v1 as the eight-desk compatibility view, and advertise the successor with an HTTP Link header. Preserve the eight existing country URLs and `/morning.json`. `/catalog.json?desk=united-states` remains an explicit 404 under v1. Old consumers remain functional but do not automatically discover US; that is the disclosed compatibility tradeoff. There is no sunset or redirect in this release.

Do not mutate the shared `SCHEMA_VERSION`/`DESKS` so old resources change accidentally. Keep an immutable legacy desk set and schema; add a current discovery registry including US and a distinct `US_SCHEMA_VERSION`. Schema v2 should validate an extensible country list with stable IDs rather than bake nine into a permanent maximum; release tests still require the exact intended nine unique desks. The two versioned discovery/schema routes are justified by a measured fixed-cardinality conflict, not speculative endpoint expansion.

## Smallest implementation sequence

1. **Freeze references and settle blockers.** Re-run the research demo against original sources; retain dated responses. Retain and review the now-documented authoritative CPI/OMB frame derivation. Refresh the release/calendar and `cu.series` metadata. Resolve the current NZ EMI failure or record an explicit release exception without changing its test. Capture the production Worker/version/bindings' names, not secret values, before any upload.
2. **Compatibility foundation.** Add a focused `lib/information-v2.js` (or equivalent small isolated module) for the new catalogue/schema/US representation. Keep the legacy module behavior covered by unchanged fixtures. Route new discovery files from `worker.js`; a first staged patch can test v1 preservation without exposing an empty US desk. Register US only when its reader is validated. This is a single planned feature, not a framework rewrite.
3. **Original-source reader.** Add `lib/us-cpi.js` with pure bulk/series/footnote parsers and an existing-style timed fetch wrapper. Filter exact series and validate metadata; exclude M13 before choosing the latest monthly period. Derive 13 consecutive calendar slots, including unavailable rows. Year-boundary tests must account for annual-average rows in both data and metadata. Do not infer the latest release solely from wall-clock month or mark an older monthly observation bad before its next scheduled publication.
4. **Provenance/timing.** Pin verified definition metadata with its source/hash/date and validate current series dimensions. Fetch/parse current official release metadata for latest publication and next expected release, or leave unverified timestamps null with an explicit qualification. Never hard-code the demonstration's dates into production. Old observation first-publication dates remain null unless separately established. A changed definition quarantines the standardized representation for review. Do not label the whole historical window as newly published on the latest release date.
5. **Desk and selectors.** Add `readUnitedStates` using the existing per-source success/error pattern, native `cpi` result and `sources.cpi` health. `lib/inventory.js` US entry is `["cpi","cpi","sources.cpi"]`. In v2, measure selection contains all 13 observations/native rows; exact observation contains one. Source selection retains the full qualified source object. Existing v1 measure selection stays unchanged. Human view displays the same JSON's period/NSA/index-base/missingness, with no independent calculations or alternate data source.
6. **Cache and resource limits.** Reuse Workers Cache API/absolute expiry enforcement; start with a transparent one-hour success TTL for US, 30-second error TTL, without cross-request in-flight I/O sharing. Concurrent cold misses can duplicate upstream requests; the rehearsal measured two fills (six fixture calls) from three concurrent requests. A selected US URL reuses its full US read. Do not use the 25/day API for per-visitor production reads: even one continuously busy cache location at a 5-minute TTL could exceed that daily limit. Use no-key BLS bulk as primary; metadata and footnote validation must remain consistent with the selected release. No hidden FRED fallback. Set bounded transport/body/parser limits (proposed 20-second overall source deadline and 8 MiB per file, verified in preview); oversize/truncated/timeout response becomes explicit source failure. These limits pass constructed fixture tests, but real BLS transfers in Cloudflare are blocked and their size/CPU budget is not established.
7. **Versioning and citations.** Hash value, period, definition, status and footnotes, excluding only retrieval timestamps. Preserve source URL and exact period in each citation. Include health in response ETag/content version; a failure cannot 304 a prior success. A new period changes the collection, not the IDs of unchanged historical rows. Client comparison can identify changed observations; no server revision archive or permanent historical URL availability is promised.
8. **Tests, preview, release and handoff.** Follow the gates below in order. Update only the validated capabilities in documentation and discovery. No new dependencies or Worker bindings are expected; any demonstrated need is a separate decision, not an assumed part of this plan.

The bulk file is about 2.7 MB and metadata 1.34 MB in this sample. A conditional ETag request returned 200/full body, so publisher-side 304 savings are **not established**. Use an existing cache, measure cold/repeat costs in Cloudflare, and stop if limits or access fail. Do not add a database, cron service or shared proxy to rescue an unproven design automatically.

## Exact go/no-go gates

All mandatory gates must be recorded as pass; no aggregate score can hide a semantic failure.

| Gate | Pass criterion | Present status |
| --- | --- | --- |
| Evidence/task | Public workflow uses the exact series; original endpoint and rights verified; limitations and direct/proxy/hypothesis distinctions preserved | PASS for bounded research; adoption still unmeasured |
| Source contract | Exact dimension tuple; 13 consecutive slots; no duplicate month/M13 contamination; numeric or explained null; no implicit date/geography/series substitution | PASS on dated demo, production reader not implemented |
| Geography | Authoritative frame confirms national urban 50-state/DC scope and territory exclusions; exact publisher label retained | PASS via current CPI FAQ → original 381/536 CBSA frame → OMB US/PR split, 50-state/DC headings and explicit DC sample evidence; see rehearsal/geography-evidence.json |
| Independent presentation | Bulk/API/FRED agree for all selected slots; official release three cells agree to 0.001; computed year change within 0.05 percentage points of rounded official rate; release time verified | PASS for dated specimen, shared statistical lineage disclosed |
| Real missingness | October 2025 is null/unavailable with X reason, including when it becomes the base of October 2026 comparison; zero/suppression/failure remain distinct | PASS dated demo and isolated Cloudflare fixture; live-source integration pending |
| Compatibility | Frozen v1 catalogue/schema validate; all eight original native fields/URLs/selectors and Australia alias retained; v2 has exactly nine unique entries; US never resolves as Australia; all discovery/canonical/schema links agree | Isolated 315-case legacy replay and 219 schema validations PASS; actual production integration pending |
| Semantics/failure | Port all 20 cases; test API-200 error envelope if API access is ever enabled, HTTP 403/429/500, timeout, malformed body, truncation, missing/duplicate month, changed metadata, year boundary, unknown footnote, and partial-source isolation; no fabricated numeric answer | 20 Python + 24 isolated JS checks PASS; constructed Cloudflare failure/cache cases PASS; final integrated cases pending |
| Preview | Actual Cloudflare execution of the new reader passes the same real-data/reference and HTTP checks; successful responses use the expected code/build; cache limits, failure path and return semantics proven | FAIL: authenticated remote-dev succeeds, all three BLS original URLs return 403; fixtures pass but do not satisfy live-source gate |
| Operational budget | Three cold bulk/metadata/footnote fetches plus at most one release-metadata fetch per cold US fill; zero publisher calls on a valid cache hit in the same test location; all files within explicit bounds; source deadline enforced; upstream failure yields 503 selected response | PARTIAL: fixture warm hit zero calls, expired fill three, concurrent cold fills duplicate; original Cloudflare transfers blocked; no global ceiling/CPU claim |
| Existing service | Both domains, all eight desks retain successful sources; 23 valid Stats NZ rows, AIHW eight jurisdictions/five triage cells, Wales correct all-persons/all-ages projection/year, NISRA four academic-year/national observations; previously released addition gates pass or explicit exception exists | Core contracts pass. NZ EMI optional gate currently fails; blocks an unqualified all-green release |
| Release identity | Clean reviewed commit; expected source revision/Worker version on every checked response after propagation; both domains agree; no unexpected binding change | Future release gate |

Same-value annual/monthly observations pass unchanged. Publisher release delays and known unavailable periods are not statistical revisions. Expected null cells must not be forced numeric to satisfy a count. If any new numeric value differs from the approved baseline, reconcile it to publisher release/correction evidence before accepting it.

## Commands and actual Cloudflare validation

Commands below are **future production implementation/release instructions, not actions performed by this planning task**. The separate minimal remote-dev rehearsal has now run; see its failing live-access evidence. Installed Wrangler **4.151.1** help was inspected for `versions upload`, `versions deploy` and rollback; see [Cloudflare versions/deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/). Follow the installed [Wrangler skill](/home/agent/.agents/skills/wrangler/SKILL.md). Check current help again if the pinned version changes.

From the implementation worktree:

```sh
npm run check
npm run build
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler whoami
CHECK_INFORMATION=1 REPORT_DIR=/tmp/mr-us-preview XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config node scripts/remote-check.mjs worker.js /health.json /catalog.json /catalog.v2.json /schema.json /schema.v2.json /united-states.json '/united-states.json?source=cpi&measure=CUUR0000SA0' '/united-states.json?source=cpi&measure=CUUR0000SA0&observation=2025-10'
```

Extend `scripts/remote-check.mjs` first: it currently recognizes the existing information contract, not US v2. Use its existing protected preview-token transport. Include all eight desk paths and known selections in the actual preview run; the short command above shows the new paths, not the full required regression suite. Repeat tests with cache warm, cache expired, conditional GET/HEAD, a changed fixture value, and failed upstream fetch. Use an isolated test entry/config for injected failures; do not deploy fixtures or alter real publisher responses. Preview must test genuine BLS requests as well as failure injection. Record public bodies, selected sanitized headers, code identity and exact test conditions; never persist preview access tokens.

Check authenticated target Worker/account/environment and existing binding names before remote operations. Do not reauthenticate, create secrets, or copy secret values based merely on this plan. The existing `STATSNZ_KEY` must remain intact; no US key is required. Use the established direct version workflow, **not `npm run deploy`, a main-branch push or the unverified automatic Builds pipeline**.

Only after all gates pass and an implementation commit is clean:

```sh
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler versions upload --config wrangler.toml --keep-vars --strict --message 'Add bounded US CPI desk with v1 compatibility'
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler versions deploy '<verified-uploaded-version>@100%' --config wrangler.toml --message 'Release verified US CPI desk'
```

Record the actual uploaded version; do not reuse this text as a value. Compare upload summary/binding names with the intended unchanged configuration. A version upload is not proof of runtime success; if the actual uploaded artifact can be inspected through the established version-preview path, verify it too before activation. No schema v2 route is publicly promised until the reader is ready.

After propagation, run the extended information checker against **both** domains with `EXPECTED_REVISION=<clean-implementation-commit>` and separate public smoke reports:

```sh
EXPECTED_REVISION='<clean-implementation-commit>' INFORMATION_REPORT_DIR=/tmp/mr-us-production node scripts/check-information.mjs
SITE_URL=https://morningrows.com EXPECTED_REVISION='<clean-implementation-commit>' CHECK_NZ_PRICES=1 CHECK_FISCAL_ADDITIONS=1 CHECK_TRANSPORT_ADDITIONS=1 CHECK_PHARMACY_ADDITION=1 CHECK_ASSEMBLY_ADDITION=1 CHECK_OPEN_ADDITIONS=1 REPORT_PATH=/tmp/mr-us-apex.json node scripts/smoke.mjs
SITE_URL=https://www.morningrows.com EXPECTED_REVISION='<clean-implementation-commit>' CHECK_NZ_PRICES=1 CHECK_FISCAL_ADDITIONS=1 CHECK_TRANSPORT_ADDITIONS=1 CHECK_PHARMACY_ADDITION=1 CHECK_ASSEMBLY_ADDITION=1 CHECK_OPEN_ADDITIONS=1 REPORT_PATH=/tmp/mr-us-www.json node scripts/smoke.mjs
```

The scripts need explicit v2-nine/US assertions before these commands count as a US release check. Keep v1-eight and the original eight-desk selection tests. Verify every response revision, not just `/health.json`: prior releases briefly mixed cached identities during propagation. Recheck a fresh sample after a cache-expiry cycle; do not call an unresolved mixed rollout settled.

The established comparison baseline includes Stats NZ 23 numeric rows with units/period/geography; AIHW **2024-25**, all eight jurisdictions and 40 numeric cells with suppression distinct from zero; Wales **mid-2026 projection 3,195,431**, 2024 base, all persons/all ages; NISRA four **2024/25** national all-persons aggregates. Do not freeze those values forever: changed periods/values require official-release evidence. The existing eight-jurisdiction AIHW total must never become nine when the catalogue does.

## Rollback and monitoring

Before release, capture the then-active last-good version. The current known version is `739b9031-305c-4bc7-afc5-79a82c654ac7`; it is a reference, not a promise that it will remain the right rollback target. Revert traffic to the captured version with `wrangler versions deploy '<captured-last-good-version>@100%' --config wrangler.toml`, then recheck both domains and response identities. Code rollback restores the previous routes/definitions; cached responses may require expiry/verification. It does not restore external bindings/data. No stateful migration is proposed, which keeps rollback bounded. A US publication mismatch, wrong geography/period, fabricated missing value or existing-desk regression is an immediate stop/rollback condition; an unchanged already-recorded upstream failure is not.

On release, add US to the active monitoring registry and baseline while retaining the legacy eight checks. Save expected series/dimensions, retained window, numeric/unavailable states, latest release/schedule, per-observation versions, source health, code/Worker identity and source specimens. The provisional dated US values are research evidence only and must **not** be inserted into the production-success baseline now.

Monitor on publisher cadence: compare at the scheduled release and one-hour cache allowance; require a second check after at least 15 minutes before notifying a sustained missing release. Treat a changed official schedule as a schedule update, not a failure. Notify immediately for verified semantic corruption. A failed attempted refresh is explicit even when prior values are still valid; never advance a success timestamp. Deduplicate notifications by source/semantic state, alert once for a meaningful failure/recovery/revision requiring attention, and keep unchanged monthly values and acknowledged ABS/ONS/StatCan/legislation/TfL/RFS degradation quiet. The confirmed NZ EMI recurrence is already notified and must not be repeated each run.

## Mandatory versus deferred

Mandatory: the one-measure contract, missing-month refusal, provenance/rights/frame confirmation, v1 preservation, v2 discovery, bounded-history representation, actual Worker parsing/cache/failure tests, preview, both-domain regressions, release identity and rollback evidence.

Deferred: state/county/metro outputs, CPI-W/chained/core/SA/PCE, arbitrary/long historical windows, vintage archives, contract interpretation or automated price changes, computed official inflation series, key registration, new persistent stores, cron, MCP, extra publishers and broad US parity with the other desks. Independent agent evaluation and real adoption measurements remain valuable follow-up evidence; this plan explicitly does not claim them.
