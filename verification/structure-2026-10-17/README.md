# Agent discovery and repeat-visit structure

17 October 2026. Existing eight desks; no source integration or infrastructure added.

**Released:** clean source `021dc2f462586f940d295e8181fd883eaaef0805`, Worker `1ca121f4-49b9-400b-8725-75720f27949e`, both public domains. [Production requests and assertions](production.json), [release and source-health evidence](../release-021dc2f.json), [monitoring state](../monitoring-baseline.json). 95 local tests, dry-run build, 24 Cloudflare preview checks and 129 production information checks pass. All eight desks retain working sources and the four requested statistical contracts pass. The additional NZ electricity gate fails on both domains due to the publisher timeout reproduced before implementation; this is retained as an acknowledged upstream limitation, not reported as a green source.

The [pre-implementation contract](CONTRACT.md) specifies identities, dimensions, missingness, timing, compatibility and acceptance criteria. The public `/schema.json` documents and validates catalogue, full-desk and selected-response structures. `lib/inventory.js` maps every existing reader section; `lib/information.js` provides explicit measure definitions and representation logic. Existing readers and full JSON fields remain available.

## Evidence, not assumed demand

The [project demand record](../../research/project-demand-2026-10-17/README.md) contains primary links and evidence classifications. OpenBB's historical-FX integration request is direct developer demand; BoC/Nomis/AEMO client examples are authored workflows; the ONS access trace is an author-reported single session; the Trafford/AEMO pipelines are non-agent proxies. Exact test questions here are constructed from those operations, not alleged Morning Rows users. No permitted existing query-log dataset was found in the repository. Cloudflare runtime logging being enabled does not establish access to historical end-user requests.

The independent Codex CLI attempt produced no model answer: its separate login could not refresh. [Client evaluation record](agent-client.json) preserves the sanitized failure events and conditions. No autonomous-agent accuracy, human intervention rate, search-engine indexing, adoption or return-use claim is made. Scripted HTTP replay and semantic checks below are not agent results.

## Observed failures and changes

| Current-site observation | Change and measured boundary |
| --- | --- |
| Well-known discovery describes Australia only; root catalogue supplies eight unqualified desk links. | All eight desk directories are linked, each with explicit source paths and described measure links where definitions were checked. Native-only sections remain explicitly incomplete. |
| `canada.json?date=2026-10-12` returns HTTP 200 with 16 October values. | Unsupported date/geography selectors return 400. A known measure requested at an unretained period returns 404, without substitution. |
| Canadian FX has values and currency names but no quote unit or citation. | Explicit CAD-per-foreign-unit definitions, publisher links and latest-business-date limitation. The original reader now rejects blanks/missing/nonpositive values instead of coercing them to zero. |
| Full responses are 8.6–71 KB for the measured desks; no source/measure retrieval. | Existing JSON URLs accept opt-in selectors. Selected bodies in fixed-snapshot replay are 2.2–4.4 KB, 58–95% smaller. See exact traces in `evaluation.json`; production sizes can differ as source context changes. |
| No ETag; an unchanged revisit transfers the full body. | Weak semantic ETags, conditional GET, HEAD, canonical links and retained retrieval-time headers. Seven deterministic revisits return 304 with empty bodies; real Cloudflare preview checks repeat this for FX and projection. |
| Preview cache hits return a four-hour cache header although the Worker stored a 30-second degraded response. | Explicit stored expiry is enforced before cache reuse, and remaining permitted lifetime is restored on hits. Expired data must be fetched again even if the edge advertises a longer lifetime. The internal expiry header is not exposed to consumers. |
| Sitemap returns 404; HTML and machine discovery do not consistently link the contract. | Sitemap, schema links, canonical/alternate links and shared catalogue navigation. Crawler requests and robots must also be checked at the edge, where Cloudflare adds managed policy text. |
| AIHW reader groups explicit suppression and unavailable values together. | Additive per-cell value states distinguish suppression, unavailable and observed zero, preserving native numeric fields and footnotes. |

Existing Wales/NISRA qualifications were already correct. Their values do not count as an accuracy improvement; the improvement is stable selection, retained context and conditional return visits. Initial discovery goes from three requests (`llms → catalogue → desk`) to four (`llms → catalogue → desk directory → selected measure`). Returning to a saved URL takes one conditional request. The selection layer reuses the complete-desk cache; it does **not** reduce cold publisher fan-out or guarantee lower latency. Source-selected errors do not invalidate unrelated sources.

## Reproduce

```sh
npm run check
node scripts/evaluate-structure.mjs
python scripts/verify-structure-reference.py
npm run build
```

The replay uses a dated selected-data snapshot and the real Worker handler with a simulated complete-desk cache. External requests are disabled. `before.json` retains original release identity, statuses, bytes and query probes; `evaluation.json` records exact URL sequences, expected values, qualification checks, bytes and conditional statuses. `test/information.test.js` covers both development and held-out cases, including wrong geography/units, academic versus calendar periods, a specific iwi population, stock versus flow, partial Stats NZ rows, AIHW suppression, revision/new period/failure/recovery semantics and compatibility. The intentional change from silently ignored cache-busting parameters to explicit 400 is documented and tested; callers should remove unknown parameters.

For Cloudflare preview, use the existing authenticated configuration (no secret-file inspection):

```sh
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config \
REPORT_DIR=/tmp/morning-rows-structure-preview CHECK_INFORMATION=1 \
node scripts/remote-check.mjs worker.js /health.json /catalog.json /schema.json \
  /australia.json /new-zealand.json /canada.json /united-kingdom.json \
  /england.json /scotland.json /wales.json /northern-ireland.json
```

This runs the actual Worker in Cloudflare remote dev, including its existing Stats NZ binding. The preview script prints only allowlisted public response headers; preview authorization stays private. It asserts selected/error/conditional HTTP results. `preview.json` records the final run; production verification and release identity are recorded separately after release. No automatic Builds or main push is used.

## Source-to-output verification

- AIHW: original `MYH-ED-WAITS`, `MYH0010`, state/territory type `S`; five `MYH-RM0035…0039` triage codes. IDs combine jurisdiction and triage. Values and caveats pass through, without adding percentages across triage categories. All 40 cells reconcile against a separate Python selection from the original API.
- Wales: original StatsWales CSV, `Area=Wales`, `Age=All Ages`, `Sex=Persons`, `Year=Mid-year 2026`, `Data description=Population projections`. 3,195,431, 2024-based projection. No conversion into an observed estimate.
- NI: original `CHILDBMILGD` JSON-stat, `SEX=All`, `LGD2014=N92000002`, `TLIST(A1)=2024/25`, four statistic codes. Independent Python mixed-radix indexing reconciles 6.3, 23.2, 6.0, 26.5 percent. Coverage/methodology caveats retained.
- Canada: existing four Valet series. `FXUSDCAD=1.4154` on 16 October yields CAD1,415.40 for USD1,000. Earlier research reconciled selected rates with official CSV and daily table; the structural change adds no history or holiday imputation.
- Stats NZ: original SDMX table IDs and fixed dimensions in `lib/stats-nz-series.js` are retained; selected observation IDs include the exact source period. `CORR_FIS_005` code 2025 retains label 2024/2025. All 23 validated rows remain covered by the existing upstream reader; this pass does not claim a fresh independent 23-series statistical reconciliation.
- Scotland/NI insolvency and England pharmacy: existing validated national rows, publication dates, units, monthly stock/flow conventions and caveats pass through. These tests use prior verified output, not a newly independent publisher comparison.

`publisher-reference.json` retains only necessary public aggregate cells, exact endpoints, raw-response hashes, licence attribution and comparison coordinates. Original full upstream responses were used temporarily and are not bundled. Python extraction is independent of the JavaScript reader, but the statistical lineage is shared: agreement validates extraction/selection, not the publishers' data collection. Existing [NZ price evidence](../nz-prices-2026-10-17/README.md) is unchanged.

## Remaining limits

Common described observations cover the already verified Stats NZ, AIHW, Wales projection, NI BMI, BoC FX, national insolvency and pharmacy selections. Other existing sections expose native fields, explicit paths and health with a clear metadata limitation. Unknown population, adjustment, publication date, next release or licence is not invented. This is progressive contract coverage, not a claim that every legacy event feed supports cross-source comparison.

Observation URLs are stable identities for currently retained selections, not archives. Clients must retain cited payloads/version hashes for historical audit. Same-ID content change can be a value revision or metadata correction; official release classification requires publisher evidence. No server-side history or automatic “new release” assertion is added.

During baseline checks, NZ EMI electricity prices newly timed out on both domains and on a direct 45-second publisher request. The failure preceded this change; all other NZ readers survived. It is a separately tracked upstream degradation, not hidden by retrieval timestamps or replaced with old prices. Final production status is recorded in the release evidence and monitoring baseline.
