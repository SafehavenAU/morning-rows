# Handoff

Date: 2026-10-17. Site: https://morningrows.com. Repository: SafehavenAU/morning-rows. Baseline before local recovery: `2cb3ffd457c6eae7e5b5310049217f9d71b45ab2`.

Read [AGENTS.md](AGENTS.md) first. This file is what has been built. It is not a new set of rules.

## Released no-key additions — 17 October 2026

`lib/open-observations.js` adds three isolated readers: Australia `rfs_incidents` (aggregate NSW RFS feed counts, including neighbouring ACT), England `pupil_absence` (five national full-academic-year measures), and Scotland `river_level` (one explicitly named Galashiels gauge, not a national aggregate). No new secrets or registrations are needed. RFS uses CC BY 4.0 with the requested attribution; DfE and SEPA use OGL v3.0. Bounded responses, explicit selections, dataset-version pinning and missing-value handling prevent partial or mislabelled observations. The RFS snapshot is flagged degraded when its publication timestamp is more than six hours old; annual education data has no daily freshness test.

Live endpoint/parser checks returned nine RFS incidents in the delayed 16 October 08:15:40 UTC snapshot; 2024/25 England totals of 7,388,150 enrolments, 1,340,437 persistent absentees (18.14307%), and 176,361 severe absentees (2.38708%); Galashiels 0.185 metres at 17 October 05:00 UTC. These are verification observations, not embedded fallback values. DBT's advertised latest quota report returns a missing-object 404, so only a narrowly scoped blocked entry was added. The combined NSW emergency/SLIP key entry now correctly excludes the public RFS feed.

The test suite has 41 tests. All passed, and the Wrangler dry-run build passed. All three new readers also returned the validated data inside local workerd using a curl transport through the inherited workspace proxy (runtime parsing, not Cloudflare edge validation). A direct `wrangler dev --local` network check encountered outbound fetch failures/timeouts in this proxy-only workspace, including on inherited sources; do not mistake those local failures for production outages. Cloudflare device login was restored and the existing `STATSNZ_KEY` binding preserved. The remote dev proxy also failed to connect through this workspace; production content checks below establish actual edge behavior. Do not replace the secret or push main to trigger the unverified build pipeline.

Current production: source `e7d364cd4080e78e64157b5803fca16462ce0f3d`, Worker `85da384d-4ab4-491a-a0d4-7d4d35c6cbb9`, fingerprint `79c7066c23569d64`, `source_dirty: false`. Released using Wrangler versions upload/deploy, without a push or secret write. Both domains have matching identity and catalogue. All 15 smoke checks passed with `CHECK_OPEN_ADDITIONS=1`. Content checks on both domains confirmed all eight desks retain successful sources, 23 valid Stats NZ rows, 40 numeric AIHW cells for 2024–25, Wales all-persons/all-ages mid-2026 projection 3,195,431, and four national NISRA 2024/25 rows. The new DfE section has five numeric measures; SEPA reports 0.185 metres at 06:00 UTC. RFS retains nine incidents and its delayed-feed label. [Release evidence and source-status baseline](verification/release-e7d364c.json). Previous Worker available for rollback: `9de05f20-66c4-48d9-ae39-52e14fbbc5c4`.

Monitoring baseline: checked 17 October 2026 around 06:32 UTC. Existing ABS/ONS/legislation blocks persist, with intermittent TfL throttling still known; no new inherited-source failure. RFS's delayed 16 October snapshot is now an acknowledged baseline. Notify only for meaningful changes or required action; unchanged annual/monthly values are not stale. Documentation/evidence commits after `e7d364c` do not change the deployed source identity.

## Previous verified production release — 17 October 2026

The first batch (`540a3f7`) repairs Stats NZ's 23 explicit series, failure isolation and build verification, and adds FSA food counts, Scottish bill stages and Canadian recalls. Cloudflare preview validated all 23 Stats NZ rows and all eight desks retaining their healthy sources.

The second batch replaces the static hospital table with the official AIHW MyHospitals API: all 40 2024–25 state/triage values and the 19 August 2026 upload date were independently confirmed. It corrects the licence to CC BY 4.0 and requires complete state/triage coverage in the latest published financial year. It also fixes StatsWales pagination/selection to return the current-year, all-ages, all-persons projection (mid-2026: 3,195,431; explicitly a 2024-based projection), and adds four aggregate NISRA Childhood BMI measures for Northern Ireland, academic year 2024/25. All three readers passed Cloudflare preview. Source errors preserve HTTP statuses.

ABS and ONS still refuse Workers requests (403/429). The National Archives Atom feeds return 404 from Workers despite returning data in the workspace; that failure is now logged. Other sources remain available. See [SOURCE_PASSES.md](SOURCE_PASSES.md) for checked endpoints, terms and unfinished discovery candidates.

Release uses the authenticated Wrangler CLI while the Cloudflare Builds settings API returns 403. Do not push main until the automatic build commands are verified to contain no secret-writing steps. The direct CLI release does not run the inaccessible pipeline or write `STATSNZ_KEY`. Prior production version for rollback: `21631712-c553-444c-9fdb-647d1cb6c92e`.

Build commands: `npm ci`, `npm run check`, `npm run build`, and `npm run smoke`. There are 32 deterministic tests. `/health.json` exposes source SHA, dirty-worktree state, content fingerprint and Worker version; desk `sources` and `x-data-status` describe data health. Production release `29a2d4ea1ac657b63b08a9a5310664bc8233d3f7` is served by Worker version `9de05f20-66c4-48d9-ae39-52e14fbbc5c4` on both domains. All 15 smoke checks passed, including discovery files, eight desks, Australia alias, both domains and the missing-route 404. Stats NZ returned 23 validated rows using the existing secret. Targeted production checks confirmed all 40 AIHW cells, the corrected Wales projection and four NISRA rows. [Verification report](verification/release-29a2d4e.json) records release identity and the remaining source errors. A passing smoke check means the desk contracts and core data passed; it does not mean every upstream source is healthy.

The second discovery pass is in progress, not empty. Categories and the broader inherited-series audit remain pending. The daily **Check Morning Rows** health watch is active, using Australia/Brisbane as the personal timezone. It is read-only and stays quiet unless there is a meaningful new failure, recovery or required action. CI is prepared locally but will not run remotely until the commits are pushed.

## What this is

A public data desk for AI agents. An agent reads `/llms.txt`, then `/catalog.json`, then one desk JSON file. Figures are fetched from official free APIs when the agent asks. They are not stored as a database.

This is not a building site and not a land-lead list. Land leads stay in SafehavenAU/ngin. Do not put a key in this repository.

## Desks

| Desk | JSON | What is on it |
|---|---|---|
| Australia | `/australia.json` and `/morning.json` | Wholesale power and demand. Earthquakes. Unemployment, consumer prices, dwelling approvals, wages, retail turnover, population, household spending, construction work. South East Queensland transport alerts. Live AIHW hospital waiting-time percentages by triage category and state, latest published financial year. Cash rate and the exchange rate. Government bond yields and commodity prices. Money supply and housing credit. A Reserve Bank bundle under `rba`: balance sheet, policy changes, bank assets, lending, deposit rates, housing rates, business rates, inflation, inflation expectations, GDP, monthly activity, demand and income, labour costs, the labour force, household balance sheets, household finances, personal lending rates, prices by spending group, off-balance-sheet business, and debit cards. Recent federal bills. World Bank population, GDP, inflation, unemployment, and life expectancy. Space weather. |
| New Zealand | `/new-zealand.json` | Wholesale prices at five grid points. Earthquakes, a year of quake counts, volcano alert levels, and three GeoNet notices. World Bank figures. Space weather. Stats NZ: the key is bound as `STATSNZ_KEY`. The catalogue lists 206 non-census tables. 705 census cross-tabs are named as not copied. 23 explicitly selected series are requested; some are historical cross-sections or projections, not current headlines. Consumers price index, the labour force survey, retail trade, and building consents are not in this API. |
| Canada | `/canada.json` | Unemployment by province. Consumer prices. Retail sales. GDP. Housing starts. Policy rate. Exchange rates. Two-year and ten-year bonds. Posted bank rates and insured mortgage rates. Weekly commodity price index. Ontario zonal price and Ontario demand. Three river stations. Air-quality index for Toronto, Vancouver, and Calgary. Earthquakes. World Bank figures. Space weather. |
| United Kingdom | `/united-kingdom.json` | UK-wide only. Population, unemployment, prices, wages, GDP, and the total trade balance, from the Office for National Statistics. Current bills. Newly published legislation. Space weather. Links to the four nation files. |
| England | `/england.json` | Great Britain system power price. England carbon intensity. England unemployment and population. Flood warnings, rainfall, and river levels. London transport and trunk roads. Bank holidays. British Geological Survey earthquake titles. Westminster crime counts, and the date the crime file is current to. NHS England headlines. World Bank figures for the United Kingdom. Space weather. |
| Scotland | `/scotland.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. FSA establishment counts. |
| Wales | `/wales.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. A StatsWales national population projection. |
| Northern Ireland | `/northern-ireland.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. FSA establishment counts. Four NISRA national Childhood BMI aggregates. |

World Bank rows and space weather sit under `also` on the country files that have them.

## Known unfinished items

- Reconcile the local release commits with the automatic build pipeline after its secret-safe commands can be verified. No main-branch push was made.
- ABS and ONS refuse Worker requests. Publisher access remains unresolved; do not disguise missing data or substitute unrelated geography.
- The hospital source and date are now verified against AIHW. Other inherited readers still need a broader unit, provenance and selection audit.
- Supplementary England fields labelled United Kingdom or Great Britain must retain those labels.
- Source discovery has not reached a complete empty pass; pass 02 remains in progress. Categories remain pending. Daily monitoring is enabled.

## Log

`/keys.json` is the log.

`needs_a_key` means collect it later and do not call it. It lists the Bureau of Meteorology, the AEMO developer portal, Western Australia SLIP subscription datasets (the public RFS feed needs no key), the Australian Business Register, FuelCheck, LINZ, MetService, NIWA, the New Zealand Companies Office, AESO, IESO participant APIs, Companies House, the Met Office, Energy Performance of Buildings, Ordnance Survey, a higher Transport for London limit, and the DVSA MOT history. The prepared pass adds Auckland Transport, Natural Resources Wales and HMRC Trade Tariff Hub subscriptions. Stats NZ is now separately listed as `configured`.

`blocked` means the feed refused, was stale, or was gone. It lists the Reserve Bank of New Zealand, MetService, NIWA, a LINZ feature download, Companies House, the Bank of England CSV address, statistics.gov.scot, Parliament of Australia bills, the Geoscience Australia hazard map, the IESO yearly price file (stops at 2025-04-30), and coronavirus.data.gov.uk. The prepared change also records ABS/ONS Worker refusals and the AFSA discovery-page HTTP 503.

A block or a missing key is a line in that log. It is not a reason to stop. The next pass starts from publishers that are not already on a desk and not already in the log.

## Deploy

Cloudflare project `morning-rows` builds `main`. The worker is `worker.js`. Config is `wrangler.toml`. A push to `main` starts the build. The deploy command is `npx wrangler deploy --config wrangler.toml`. Do not pipe a secret into `wrangler secret put` from the build.

`STATSNZ_KEY` is a Cloudflare worker secret, not a file.
