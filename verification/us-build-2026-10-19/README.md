# Current status — USA CPI released on 20 October 2026

After the user confirmed “worker upgraded”, the same single-series reader passed
the [Paid release contract and evidence](../us-paid-2026-10-20/README.md).
Both domains match clean source `c6a96283743476af730dc2ff4bd915463e47d03c`,
Worker `e0224d26-6bcb-4f96-a580-460919a0d195`, fingerprint `42edef0b385e972f`.
Rollback remains Worker `739b9031-305c-4bc7-afc5-79a82c654ac7`.

Fresh USA CPU captures **23 / 12 / 13 ms** passed the **100 ms gate**; the
legacy maximum was **292 ms** under the separate **1,000 ms Worker ceiling**.
The release passed 187 tests and the build, staged 137 interface / 50 semantic
checks and nine desk schemas, settled production 151 checks / 104 requests
without revision mismatches, and smoke checks 18/18 apex and 17/17 www.
The v1 catalogue preserves eight desks; v2 discovers the USA desk alongside them.

The reviewed collector transition is 24 probes / 109 obligations through the
existing daily workflow. Latest actual checkpoint sequence 5 still has two
scheduled cycles and no USA scheduled observation; hourly watch, SHADOW and
disabled source alerts remain. Seven-day acceptance, the real delivery receipt,
NZ-PRICES external evidence and parked UK CPI remain separate unresolved gates.
See [the current handoff](../../HANDOFF.md) for exact checkpoint and deadline.

Everything below is historical evidence with its original release gate. The
Free-plan failures remain failed or incomplete under 10 ms; former “not released”
and “disabled review” statements do not describe current production.

---

# Historical continuation — runtime budget validation

BLS access is resolved for the tested runtime: `Accept: */*` with the same truthful
Morning Rows User-Agent returned the original bulk files. The actual reader
passed all **22/22** integrated preview scenarios (`integration-preview-accept-any.json`).
Repeated independent cold reads returned identical current original rows. A full
nine-desk preview passed after extending the checker to use the documented US
one-hour cache limit; all four existing core contracts were healthy.

The user subsequently confirmed **Workers Free / 10 ms CPU**. That is the active
release gate. Pinned Wrangler 4.151.1 disables the inspector for remote dev and
uploads previews without CPU limits. No numeric CPU events were available from
its existing tail transport. The protected-preview successes do not prove the
Free CPU budget. `runtime-budget/` preserves this evidence; wall times are not
labelled CPU. Subscription lookup returned 403; Worker settings were readable and
showed standard usage with no explicit override. No credentials are retained.

A small bulk-parser allocation correction is now under validation. The official
historical CPI workbook (24,238 bytes) was also found accessible; it is not an
activated fallback or a changed statistical contract. No production activation.

The optional ninth-desk collector retains v1-eight discovery, adds v2-nine and
US CPI checks, and uses 24 public probes / 109 source obligations when enabled.
`operations/us-release-review.json` is disabled. Exact reviewed identity matching
updates only the release identity and request budget through the existing
serialized collection. Original incidents, repairs, receipts and SHADOW start
are retained; US scheduled observation starts only from an actual scheduled run.
The new tests also prevent the known unavailable October from becoming a false
numeric-loss incident merely because other months are numeric.

The sections below retain the initial candidate findings; the continuation above
supersedes their current BLS-access status. Their reports remain immutable.

---

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
