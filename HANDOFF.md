# Handoff

Date: 2026-10-17. Site: https://morningrows.com. Repository: SafehavenAU/morning-rows. Baseline before local recovery: `2cb3ffd457c6eae7e5b5310049217f9d71b45ab2`.

Read [AGENTS.md](AGENTS.md) first. This file is what has been built. It is not a new set of rules.

## Recovery release preparation — 17 October 2026

The first batch (`540a3f7`) repairs Stats NZ's 23 explicit series, failure isolation and build verification, and adds FSA food counts, Scottish bill stages and Canadian recalls. Cloudflare preview validated all 23 Stats NZ rows and all eight desks retaining their healthy sources.

The second batch replaces the static hospital table with the official AIHW MyHospitals API: all 40 2024–25 state/triage values and the 19 August 2026 upload date were independently confirmed. It corrects the licence to CC BY 4.0 and requires complete state/triage coverage in the latest published financial year. It also fixes StatsWales pagination/selection to return the current-year, all-ages, all-persons projection (mid-2026: 3,195,431; explicitly a 2024-based projection), and adds four aggregate NISRA Childhood BMI measures for Northern Ireland, academic year 2024/25. All three readers passed Cloudflare preview. Source errors preserve HTTP statuses.

ABS and ONS still refuse Workers requests (403/429). The National Archives Atom feeds return 404 from Workers despite returning data in the workspace; that failure is now logged. Other sources remain available. See [SOURCE_PASSES.md](SOURCE_PASSES.md) for checked endpoints, terms and unfinished discovery candidates.

Release uses the authenticated Wrangler CLI while the Cloudflare Builds settings API returns 403. Do not push main until the automatic build commands are verified to contain no secret-writing steps. The direct CLI release does not run the inaccessible pipeline or write `STATSNZ_KEY`. Prior production version for rollback: `21631712-c553-444c-9fdb-647d1cb6c92e`.

Build commands: `npm ci`, `npm run check`, `npm run build`, and `npm run smoke`. There are 32 deterministic tests. `/health.json` exposes source SHA, dirty-worktree state, content fingerprint and Worker version; desk `sources` and `x-data-status` describe data health. Production verification and the release version will be recorded below once deployment completes.

The second discovery pass is in progress, not empty. Categories, the broader inherited-series audit and daily monitoring remain pending. CI is prepared locally but will not run remotely until the commits are pushed.

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

- Complete release verification and reconcile the repository with the automatic build pipeline.
- ABS and ONS refuse Worker requests. Publisher access remains unresolved; do not disguise missing data or substitute unrelated geography.
- The hospital source and date are now verified against AIHW. Other inherited readers still need a broader unit, provenance and selection audit.
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
