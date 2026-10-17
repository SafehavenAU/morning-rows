# Handoff

Date: 2026-10-17. Site: https://morningrows.com. Repository: SafehavenAU/morning-rows. Worker head includes commit 7b26650.

Read [AGENTS.md](AGENTS.md) first. This file is what has been built. It is not a new set of rules.

## What this is

A public data desk for AI agents. An agent reads `/llms.txt`, then `/catalog.json`, then one desk JSON file. Figures are fetched from official free APIs when the agent asks. They are not stored as a database.

This is not a building site and not a land-lead list. Land leads stay in SafehavenAU/ngin. Do not put a key in this repository.

## Desks

| Desk | JSON | What is on it |
|---|---|---|
| Australia | `/australia.json` and `/morning.json` | Wholesale power and demand. Earthquakes. Unemployment, consumer prices, dwelling approvals, wages, retail turnover, population, household spending, construction work. South East Queensland transport alerts. Hospital waiting times for 2024-25, no patient named. Cash rate and the exchange rate. Government bond yields and commodity prices. Money supply and housing credit. A Reserve Bank bundle under `rba`: balance sheet, policy changes, bank assets, lending, deposit rates, housing rates, business rates, inflation, inflation expectations, GDP, monthly activity, demand and income, labour costs, the labour force, household balance sheets, household finances, personal lending rates, prices by spending group, off-balance-sheet business, and debit cards. Recent federal bills. World Bank population, GDP, inflation, unemployment, and life expectancy. Space weather. |
| New Zealand | `/new-zealand.json` | Wholesale prices at five grid points. Earthquakes, a year of quake counts, volcano alert levels, and three GeoNet notices. World Bank figures. Space weather. Stats NZ: the key is bound as `STATSNZ_KEY`. The catalogue lists 206 non-census tables. 705 census cross-tabs are named as not copied. 23 headline tables are requested. Consumers price index, the labour force survey, retail trade, and building consents are not in this API. |
| Canada | `/canada.json` | Unemployment by province. Consumer prices. Retail sales. GDP. Housing starts. Policy rate. Exchange rates. Two-year and ten-year bonds. Posted bank rates and insured mortgage rates. Weekly commodity price index. Ontario zonal price and Ontario demand. Three river stations. Air-quality index for Toronto, Vancouver, and Calgary. Earthquakes. World Bank figures. Space weather. |
| United Kingdom | `/united-kingdom.json` | UK-wide only. Population, unemployment, prices, wages, GDP, and the total trade balance, from the Office for National Statistics. Current bills. Newly published legislation. Space weather. Links to the four nation files. |
| England | `/england.json` | Great Britain system power price. England carbon intensity. England unemployment and population. Flood warnings, rainfall, and river levels. London transport and trunk roads. Bank holidays. British Geological Survey earthquake titles. Westminster crime counts, and the date the crime file is current to. NHS England headlines. World Bank figures for the United Kingdom. Space weather. |
| Scotland | `/scotland.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. |
| Wales | `/wales.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. A StatsWales national population projection. |
| Northern Ireland | `/northern-ireland.json` | Population and unemployment from the Office for National Statistics. The next bank holiday. |

World Bank rows and space weather sit under `also` on the country files that have them.

## Known unfinished items

- Stats NZ values were blank because the reader stopped on the `DATAFLOW` metadata line. Commit 7b26650 switches to the simple CSV and skips that line. Confirm on `/new-zealand.json` after the Cloudflare build that each of the 23 rows has a period and a value. The page cache is two minutes.
- The England file still carries some United Kingdom series: prices, wages, GDP, retail sales, vacancies, and the services trade balance. They are labelled United Kingdom. They also sit on the United Kingdom desk. Do not present them as England-only.
- `readWeather` and `readBom` are still in `worker.js` and are not called. Do not wire them back. Open-Meteo is not an official publisher. Bureau of Meteorology terms are not a licence that allows copying.
- Categories have not been started. Do not add a subject file until the same measure exists on every desk.
- The search is not finished. One full pass has not yet come back empty.

## Log

`/keys.json` is the log.

`needs_a_key` means collect it later and do not call it. It lists the Bureau of Meteorology, the AEMO developer portal, NSW emergency feeds and Western Australia SLIP, the Australian Business Register, FuelCheck, Stats NZ (already bound), LINZ, MetService, NIWA, the New Zealand Companies Office, AESO, IESO participant APIs, Companies House, the Met Office, Energy Performance of Buildings, Ordnance Survey, a higher Transport for London limit, and the DVSA MOT history.

`blocked` means the feed refused, was stale, or was gone. It lists the Reserve Bank of New Zealand, MetService, NIWA, a LINZ feature download, Companies House, the Bank of England CSV address, statistics.gov.scot, Parliament of Australia bills, the Geoscience Australia hazard map, the IESO yearly price file (stops at 2025-04-30), and coronavirus.data.gov.uk.

A block or a missing key is a line in that log. It is not a reason to stop. The next pass starts from publishers that are not already on a desk and not already in the log.

## Deploy

Cloudflare project `morning-rows` builds `main`. The worker is `worker.js`. Config is `wrangler.toml`. A push to `main` starts the build. The deploy command is `npx wrangler deploy --config wrangler.toml`. Do not pipe a secret into `wrangler secret put` from the build.

`STATSNZ_KEY` is a Cloudflare worker secret, not a file.
