# USA desk candidate — 19 October 2026 Brisbane

Implemented on main `51254f51e20a2afed572763045467e5b24c9003c` after the
user explicitly requested USA development. **Not deployed; live-source gate
blocked.** Existing uncommitted work in the original workspace is untouched.
This branch carries the earlier candidate and its original evidence forward.

The first offering is one BLS series, `CUUR0000SA0`: all-items CPI-U, U.S. city
average, all urban consumers, not seasonally adjusted, index 1982–84=100.
The [pre-existing contract](../../research/us-onboarding-2026-10-17/CONTRACT.md)
defines 13 consecutive calendar slots, exact-month selection, geographic and
population exclusions, revisions, missingness, provenance and release gates.
It does not promise jobs, GDP, state figures, arbitrary history or other CPIs.

`/catalog.v2.json` discovers the USA candidate alongside eight linked v1 desks.
`/united-states.json` supports source, measure and exact-month selection.
The v1 catalogue/schema and existing eight data resources retain their contracts.
These new URLs are candidate routes, not claims about current production.

## Evidence

- All **153 Node tests**, **20 independent Python tests** and the dry-run build
  pass on current main plus the candidate.
- **315** actual legacy response bodies/statuses match the retained baseline;
  the v1 catalogue adds only a successor Link header.
- **221** actual offline responses validate against the corresponding schemas;
  wrong geography, a ninth v1 entry and unavailable-to-zero mutations fail.
- Fresh original bulk data, series metadata, footnotes, BLS public API, FRED
  republication and BLS's archived release were acquired separately in the
  workspace. `original/manifest.json` records source URLs, acquisition times,
  original hashes and the minimal retained selections. Independent Python
  extraction reconciles all **13 slots** and three official release-table cells.
  The production parser matches those independently extracted rows. The latest
  metadata still identifies September 2026; October 2025 is explicitly
  unavailable with X. Neither a retrieval date nor M13 substitutes for a month.
- September 2025 **324.800** and September 2026 **336.940** produce the published
  rounded annual change **3.7%**. This is shared BLS statistical lineage;
  separate parsers/presentations do not establish independent statistical truth.
- Actual protected Cloudflare preview passes **21 of 22** status scenarios.
  The failed scenario is genuine original-source access: selected retrieval
  returns **503**, carrying BLS **406**. The full desk reports the failed source
  explicitly. Fixture scenarios exercise the actual reader/router/cache and are
  labelled constructed; they cannot satisfy the live-source gate.
- The preview session was torn down. No fixture is imported into the production
  entrypoint. No new key, binding, infrastructure or public Worker release.

The latest summary and retained-file hashes are in `validation.json`.
`integration-preview.json` retains public responses and allowlisted headers only.
Historical reports in the 17 October directories remain dated historical evidence.

## Reproduce

```sh
npm ci
npm run build
python -m unittest discover -s research/us-onboarding-2026-10-17 -p 'test_demo.py'
python research/us-onboarding-2026-10-17/demo.py --specimens verification/us-build-2026-10-19/original/specimens
US_REPORT_DIR=/tmp/mr-us-contract node scripts/verify-us-contract.mjs
python scripts/verify-us-schema.py /tmp/mr-us-contract
```

The schema checker requires Python `jsonschema`. Node uses the locked dependencies.
For a new permitted live-source investigation, preserve each report separately:

```sh
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config \
US_PREVIEW_REPORT=/tmp/mr-us-new-preview.json \
node verification/us-build-2026-10-17/check-preview.mjs
```

This uses the existing authenticated protected remote-dev mechanism, not a
production deployment. A nonzero result is expected while genuine BLS access
fails. Do not count an HTTP-200 full desk or fixture as live-source success.

## Release boundary

Keep this PR in draft. First establish repeatably permitted original-source access
from Cloudflare, reconcile a new dated specimen, and measure real transfer/parsing
costs. The public API is not an automatic fallback: its unregistered quota needs
an explicit budget that per-location cache expiry cannot guarantee. Do not deploy
retained values, proxy around a refusal, or substitute FRED, another CPI or a month.

Then complete the existing full live preview, integrate the ninth desk into the
monitoring registry with explicit state-preserving review, and run the versioned
release and both-domain acceptance gates with `CHECK_US=1` and a verified
`EXPECTED_US_LATEST`. Preserve separation from Cloudflare automatic Builds.

Until then production and the daily collector remain eight-desk, SHADOW, with
their existing identity, checkpoint lineage, incidents, repairs and pending
delivery event. UK CPI remains parked; the separate NZ-PRICES contract and
scheduled-cycle/seven-day acceptance gates remain unresolved. This candidate
does not enable alerts or certify overall maintenance completion.
