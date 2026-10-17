# Morning Rows

This repository is the website worker for https://morningrows.com.

Morning Rows is a public data desk for AI agents. An agent should be able to visit every day and read fresh official figures. The figures are fetched from free APIs when the agent asks. They are not stored as a private database.

This is not a building site, a property site, or a land-lead list. The land-lead system stays in SafehavenAU/ngin. Do not copy land, listing, or builder records into this repository.

## Who it is for

Agents read the files. Humans may look at the HTML, but the HTML is not the product. Do not scrape the HTML. Do not add pages whose only purpose is a visual design.

Start at `/llms.txt`, then `/catalog.json`, then one desk file.

## Desks

One file per country. The United Kingdom is split, because a nation figure must not be buried in another nation's file.

| Desk | File |
|---|---|
| Australia | `/australia.json` (also `/morning.json`) |
| New Zealand | `/new-zealand.json` |
| Canada | `/canada.json` |
| United Kingdom, UK-wide only | `/united-kingdom.json` |
| England | `/england.json` |
| Scotland | `/scotland.json` |
| Wales | `/wales.json` |
| Northern Ireland | `/northern-ireland.json` |

Do not add a subject file, such as one population file for every country, until that same measure exists on every desk. An empty subject file sends an agent to the wrong place.

Categories come after the sources are in. Do not invent a category that is not already in the file.

## What may be added

Add a source only when all of these are true:

1. It publishes official, verified facts from a reliable publisher. A statistics office, a central bank, a public grid, a parliament, a health service, or another public authority. Not a hobby API and not an unofficial reprocessor.
2. It is free.
3. It does not need a key. If it is free but needs a key, do not call it. Add one line to the `needs_a_key` list in `keys.json`: the country, the source name, and what it would unlock.
4. Its terms do not forbid copying the figures onto this site. If the terms say nothing, the source may be read. If the terms forbid copying, leave it out and say so in the desk file.

Do not sign agents up for API keys. Do not put a key, a token, or a password in this repository. `STATSNZ_KEY` is a Cloudflare worker secret, not a file.

## How a desk file should behave

- Fetch the source when the agent requests the desk. A short cache is allowed so the same source is not hit on every request.
- Return JSON for the `.json` path. The HTML page is only a view of that JSON.
- Keep the licence, the publisher, the period, and the geography on the figure.
- If a read fails, return an empty row or an error field. Do not fail the whole desk.
- Do not name a person, publish a phone number, or copy a patient record.
- Label the geography honestly. A United Kingdom series must not be presented as an England series, and the reverse.

## Code and deploy

The worker is `worker.js`. The Wrangler config is `wrangler.toml`. Cloudflare project `morning-rows` builds this repository's `main` branch.

A push to `main` starts the build. The deploy command is `npx wrangler deploy --config wrangler.toml`. Do not pipe a secret into `wrangler secret put` from the build. That has stored an empty secret before.

The runtime secret, when one is required, is set in Cloudflare under the worker's Variables and Secrets, type Secret. The only secret in use is `STATSNZ_KEY`, for the Stats NZ Aotearoa Data Explorer.

## Do not

- Do not treat this site as a construction, development, or listings product.
- Do not merge this repository into SafehavenAU/ngin.
- Do not add a source because it is interesting if it fails the rules above.
- Do not categorise ahead of the data.


## Continuous build

Do not stop because one feed refuses or asks for a key. That is a note, not the end of the search.

A pass looks for official, free, no-key feeds for Australia, New Zealand, Canada, the United Kingdom, England, Scotland, Wales, and Northern Ireland. For each feed:

- If it returns the figures, add them to that desk. Keep the publisher, the period, the geography, and the licence.
- If it needs a key, add one line to `needs_a_key` in `keys.json` and keep looking.
- If it is blocked, stale, or gone, add one line to `blocked` in `keys.json` and keep looking.
- If the terms forbid copying, do not copy it. Note that on the desk. If the terms say nothing, it may be read.
- Do not label a figure with the wrong country.

Done means one full pass adds no new open feed, no new key line, and no new blocked line. Until that happens, the next pass starts from the log and looks for publishers that are not on a desk and not in the log. Do not start category pages before that pass.
