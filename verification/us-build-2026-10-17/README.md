# US implementation candidate — 17 October 2026

**Built and tested locally; not released.** This implements the bounded [US onboarding plan](../../research/us-onboarding-2026-10-17/EXECUTION.md). Original BLS access from Cloudflare still fails, so the mandatory live-source gate remains closed. Cloudflare authentication works; another login is not the remedy indicated by these results.

## Implemented

- `lib/us-cpi.js`: one original BLS series, `CUUR0000SA0`; exact dimensions/title/base validation; 13 consecutive calendar slots; M13 excluded; explicit October 2025 X unavailability; documented R correction handling; no fallback series, date or saved snapshot. Three original files are bounded to 8 MiB each with a shared 20-second deadline. Public source-text hashes and original decimal strings provide traceability. Publication/next-update times remain explicitly unknown; the official schedule is linked.
- `lib/information-v2.js`: nine-desk catalogue with explicit linked-resource versions, US source/measure/exact-month selections, stable canonical IDs, qualifications, observation versions and Draft 2020-12 schema. The existing catalogue/schema and eight data resources remain v1. Source-file changes can change a response ETag without falsely changing observation versions.
- `lib/us-desk.js`: actual US JSON and human view, one-hour success/30-second error cache with absolute expiry, shared reads across selectors/domains, GET/HEAD/conditional requests. Full desk stays HTTP 200 with explicit failed-source health; selected failure is 503. Neither turns a failed read into 304. No server vintage archive or global publisher quota guarantee.
- `worker.js`: separate v2/US dispatch, current discovery and sitemap, and a successor link from the unchanged v1 catalogue. The candidate is visible locally/preview only; public production has no US or v2 route.
- `scripts/smoke.mjs` and `scripts/check-information.mjs`: opt-in `CHECK_US=1` release gates alongside the original eight checks. `EXPECTED_US_LATEST=YYYY-MM` pins the independently reconciled release. No existing gate is weakened.

The code uses the existing Worker and cache, adds no dependency, binding, secret, key or persistent infrastructure, and imports no verification specimen into the production bundle. No production upload, deployment or main-branch push occurred. Remote-dev sessions were torn down.

## Evidence

| Check | Result |
| --- | --- |
| Existing plus new Node tests | **116 pass**, including all prior 95. New cases cover source definition drift, M13/year-end handling, missing/duplicate/truncated data, missingness versus zero, revisions, deadline/body limits, unchanged monthly values, wrong selectors, cache expiry, failed refresh and source isolation. |
| Actual Worker legacy replay | **315 responses** preserve their prior status and body hash. V1 catalogue only adds the documented successor Link header. This now exercises the real dispatcher, not the earlier delegating prototype. |
| JSON Schema validation | **221 actual offline responses** validate; constructed v1 ninth-desk, wrong-geography and unavailable-to-zero payloads are rejected. **16 actual Cloudflare response bodies** also validate, including explicit failures. |
| Publisher reconciliation | All **13 slots** from the actual JS reader agree with the independently written Python extraction of retained original data; September 2025/September 2026 remain 324.800/336.940, yielding the official rounded 3.7%. Same BLS statistical lineage; no independent statistical estimate. |
| Build | `npm run build` passes; dry-run bundle 432.90 KiB, gzip 111.28 KiB at this capture. No deployment. |
| Actual Cloudflare implementation | **21 of 22 scenario status checks pass.** Live original-source access is the failed gate: selected response 503 with BLS upstream **406** using the identifying Morning Rows request. Earlier unmodified requests returned 403. Fixture success is not a substitute for this failure. |
| Runtime return behavior | Real handler/reader with clearly labelled fixtures: warm GET 304 and HEAD 200/304 make zero source calls; expiry rereads three files and can still return 304; correction changes September's observation only; a new month changes the window; failed/cached refresh stays explicit; recovery after error expiry works. |
| Production | Both public domains retain clean source `7d614e2e78a63fc16f705b67e35ed0438baa7d87`, Worker `739b9031-305c-4bc7-afc5-79a82c654ac7`, the eight-desk catalogue and 404 for proposed US/v2 routes. This check verifies identity/discovery; the latest full core/source-health baseline remains the prior dated check. |

Files: [actual compatibility replay](compatibility.json), [offline schema results](schema-results.json), [Cloudflare integration](integration-preview.json), [preview schema checks](preview-schema.json), [source access probe](access-results.json), [production identity/discovery](production-current.json), and [validation manifest](validation.json). A probe envelope's HTTP 200 is not source success: `live_access_pass:false` records the actual failure.

## Reproduce

From the repository root:

```sh
npm run check
npm run build
US_REPORT_DIR=/tmp/mr-us-actual-contract node scripts/verify-us-contract.mjs
python scripts/verify-us-schema.py /tmp/mr-us-actual-contract
```

The last two commands disable external fetches and run the actual Worker against the existing eight-desk snapshot plus the dated original CPI specimen in `test/fixtures/us-cpi.json`. Generated complete response bodies live in the temporary output directory, avoiding a second copy of the existing aggregate specimens. `jsonschema` is needed for the Python checker; its installed version is recorded in the validation manifest.

Remote validation uses the configured existing authentication and a protected remote-dev session, with no production routes or bindings:

```sh
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler whoami
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config node verification/us-build-2026-10-17/check-preview.mjs
```

Preserve this dated report before rerunning. **A nonzero exit is currently expected because the live source gate fails.** The harness imports the actual implementation and uses fixed, labelled fixtures only for constructed cases. It uses a four-second/two-second expiry for remote tests; controlled-clock Node tests additionally verify the actual one-hour/30-second boundaries. Remote credentials stay in memory/curl stdin and are excluded from reports.

## Next gate and limitations

1. Resolve official original-source access from the actual Worker runtime. Do not release this candidate until repeated real cold fills reconcile to the current official release. Do not deploy the specimen or silently use FRED/an older month. No API key was registered or added.
2. Once access works, measure real bulk parsing CPU/body cost and repeat the final configured-TTL/full eight-desk preview. The current fixtures verify semantics, not successful real BLS transfer cost or global rate limits. No global coalescing or global API quota claim.
3. Then rerun every existing release gate and the new `CHECK_US=1` gates on both domains with the actual clean implementation revision and verified US period. Follow the plan's direct versions upload/deploy workflow, rollback and monitoring requirements. The known NZ EMI incident remains acknowledged; do not weaken its test or repeat its unresolved alert.

Publication dates are deliberately null unless verified; this implementation does not infer release lateness or treat unchanged monthly observations as stale. Independent agent evaluation and adoption remain unmeasured. No user login action is required by the current evidence.
