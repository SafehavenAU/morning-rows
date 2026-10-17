# Morning Rows

Website worker for https://morningrows.com.

Read [AGENTS.md](AGENTS.md) for the rules. Read [HANDOFF.md](HANDOFF.md) for what is already built.

Read [BUILD_PLAN.md](BUILD_PLAN.md) for the verified setup review, current live-data failures, and continuous build sequence.

This repository is only the public data desk. The land-lead system stays in SafehavenAU/ngin. Do not put API keys in this repository.

## Develop and verify

Use Node 24 (`.node-version`), then `npm ci`. Run `npm run check` for deterministic parser and failure-isolation tests, and `npm run build` for tests plus a Wrangler dry run. `npm run smoke` checks deployed content using curl and writes an ignored `smoke-report.json`; `STRICT_SOURCES=1 npm run smoke` also fails on upstream degradation. Normal smoke checks fail on broken desk contracts, no successful sources, or invalid Stats NZ rows while reporting publisher blocks separately.

The normal deployment path is the main-branch Cloudflare build. While its settings are inaccessible, a verified committed release can use `npm run deploy` directly; hold main-branch pushes until its commands are confirmed not to rewrite secrets. GitHub Actions checks changes and, after a push to main, waits for `/health.json` to identify that revision before checking production content. `/health.json` identifies code and Worker version; it is not a statement that upstream feeds are healthy. Desk `sources` fields and `x-data-status` report data health. A versioned cache key prevents a new release from serving the prior release's response shape.

Do not set or rewrite `STATSNZ_KEY` in build scripts. The Worker reads the existing runtime secret. The local tooling and auth directory for this workspace are documented in `/workspace/AGENTS.md`.
