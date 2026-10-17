# Handoff

Date: 2026-10-17. Site: https://morningrows.com. Repository: SafehavenAU/morning-rows. Baseline before local recovery: `2cb3ffd457c6eae7e5b5310049217f9d71b45ab2`.

Read [AGENTS.md](AGENTS.md) first. This file is what has been built. It is not a new set of rules.

## Implementation update 17 October 2026 — not yet deployed

The local recovery change repairs Stats NZ CSV headers and selects explicit dimension combinations for all 23 tables. All 23 returned numeric values with periods, units and geography in Cloudflare preview. Historical cross-sections remain historical; projections are labelled and selected by the current year or next available horizon. The iwi row is explicitly Ngāi Tahu Whānui (2018), not the entire Māori population. This supersedes the ineffective earlier first-row parser fix.

Per-source failures now preserve working sections on all eight desks. Cloudflare preview confirms ABS HTTP 403 and ONS HTTP 403/429 even though direct workspace requests can succeed. These blocks remain unresolved and are logged. Healthy alternative sources survive. The legacy hospital table lacks its original publisher URL and is explicitly marked unverified; its `uploaded` field is a legacy claim, not a newly confirmed publication date. Dormant Open-Meteo/BOM readers have been removed.

The local change also adds food-establishment counts for the UK and its four nations, Scottish bill-stage events, and Canadian consumer-product recalls. See [SOURCE_PASSES.md](SOURCE_PASSES.md) for terms, evidence, exact pass counts, checks and the next research queue.

Build tooling now includes `npm ci`, `npm run check` (23 tests), `npm run build` (checks and Wrangler dry run), GitHub CI, and `npm run smoke`. `/health.json` identifies source SHA, dirty-worktree state, content fingerprint and Worker version. Cache namespaces include a content fingerprint, so different preview builds cannot reuse an older response merely because they share a Git parent. `sources` and `x-data-status` expose degradation. Existing runtime secret `STATSNZ_KEY` is read but never written by these scripts.

**Deployment is pending.** The current OAuth login can access the Worker, but Workers Builds settings returned HTTP 403. The user was asked to save Build command `npm run check` and Deploy command `npx wrangler deploy --config wrangler.toml` with no secret-put step, or choose direct deployment. Do not push main while that question is unresolved. Last known production version before this work is `21631712-c553-444c-9fdb-647d1cb6c92e`; production still has the old faults until a new release is verified. Preserve that version for rollback.

After the deployment path is resolved: commit any remaining changes, deploy the committed revision, run `EXPECTED_REVISION=$(git rev-parse HEAD) npm run smoke`, inspect `smoke-report.json`, and record the live version and outcomes here. Then start the next full discovery pass. The empty-pass condition, complete inherited-source audit, and daily monitoring are still open. No category files have been added.

## What this is

A public data desk for AI agents. An agent reads `/llms.txt`, then `/catalog.json`, then one desk JSON file. Figures are fetched from official free APIs when the agent asks. They are not stored as a database.

This is not a building site and not a land-lead list. Land leads stay in SafehavenAU/ngin. Do not put a key in this repository.

## Desks

| Desk | JSON | What is on it |
|---|---|---|
| Australia | `/australia.json` and `/morning.json` | Wholesale power and demand. Earthquakes. Unemployment, consumer prices, dwelling approvals, wages, retail turnover, population, household spending, construction work. South East Queensland transport alerts. Hospital waiting times for 2024-25, no patient named. Cash rate and the exchange rate. Government bond yields and commodity prices. Money supply and housing credit. A Reserve Bank bundle under `rba`: balance sheet, policy changes, bank assets, lending, deposit rates, housing rates, business rates, inflation, inflation expectations, GDP, monthly activity, demand and income, labour costs, the labour force, household balance sheets, household finances, personal lending rates, prices by spending group, off-balance-sheet business, and debit cards. Recent federal bills. World Bank population, GDP, inflation, unemployment, and life expectancy. Space weather. |
| New Zealand | `/new-zealand.json` | Wholesale prices at five grid points. Earthquakes, a year of quake counts, volcano alert levels, and three GeoNet notices. World Bank figures. Space weather. Stats NZ: the key is bound as `STATSNZ_KEY`. The catalogue lists 206 non-census tables. 705 census cross-tabs are named as not copied. 23 explicitly selected series are requested; some are historical cross-sections or projections, not current headlines. Consumers price index, the labour force survey, retail trade, and building consents are not in this API. |
| Canada | `/canada.json` | Unemployment by province. Consumer prices. Retail sales. GDP. Housing starts. Policy rate. Exchange rates. Two-year and ten-year bonds. Posted bank rates and insured mortgage rates. Weekly commodity price index. Ontario zonal price and Ontario demand. Three river stations. Air-quality index for Toronto, Vancouver, and Calgary. Earthquakes. World Bank figures. Space weather. |
| United Kingdom | `/united-kingdom.json` | UK-wide only. Population, unemployment, prices, wages, GDP, and the total trade balance, from the Office for National Statistics. Current bills. Newly published legislation. Space weather. Links to the four nation files. |
| England | `/england.json` | Great Britain system power price. England carbon intensity. England unemployment and population. Flood warnings, rainfall, and river levels. London transport and trunk roads. Bank holidays. British Geological Survey earthquake titles. Westminster crime counts, and the date the crime file is current to. NHS England headlines. World Bank figures for the United Kingdom. Space weather. |
| Scotland | `/scotland.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. |
| Wales | `/wales.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. A StatsWales national population projection. |
| Northern Ireland | `/northern-ireland.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. |

World Bank rows and space weather sit under `also` on the country files that have them.

## Known unfinished items

- Release the prepared recovery change and verify production content; previews do not establish production health.
- ABS and ONS refuse Worker requests. Publisher access remains unresolved; do not disguise missing data or substitute unrelated geography.
- The static hospital table needs a verifiable original source and publication date. Other inherited readers need a broader unit, provenance and selection audit.
- Supplementary England fields labelled United Kingdom or Great Britain must retain those labels.
- Source discovery has not reached a complete empty pass. Categories and daily monitoring remain pending.

## Log

`/keys.json` is the log.

`needs_a_key` means collect it later and do not call it. It lists the Bureau of Meteorology, the AEMO developer portal, NSW emergency feeds and Western Australia SLIP, the Australian Business Register, FuelCheck, LINZ, MetService, NIWA, the New Zealand Companies Office, AESO, IESO participant APIs, Companies House, the Met Office, Energy Performance of Buildings, Ordnance Survey, a higher Transport for London limit, and the DVSA MOT history. The prepared pass adds Auckland Transport, Natural Resources Wales and HMRC Trade Tariff Hub subscriptions. Stats NZ is now separately listed as `configured`.

`blocked` means the feed refused, was stale, or was gone. It lists the Reserve Bank of New Zealand, MetService, NIWA, a LINZ feature download, Companies House, the Bank of England CSV address, statistics.gov.scot, Parliament of Australia bills, the Geoscience Australia hazard map, the IESO yearly price file (stops at 2025-04-30), and coronavirus.data.gov.uk. The prepared change also records ABS/ONS Worker refusals and the AFSA discovery-page HTTP 503.

A block or a missing key is a line in that log. It is not a reason to stop. The next pass starts from publishers that are not already on a desk and not already in the log.

## Deploy

Cloudflare project `morning-rows` builds `main`. The worker is `worker.js`. Config is `wrangler.toml`. A push to `main` starts the build. The deploy command is `npx wrangler deploy --config wrangler.toml`. Do not pipe a secret into `wrangler secret put` from the build.

`STATSNZ_KEY` is a Cloudflare worker secret, not a file.
