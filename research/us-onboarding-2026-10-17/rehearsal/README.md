# US onboarding validation rehearsal — 17 October 2026

**Planning decision: retain the bounded CPI-U proposal; do not release it.** The mandatory Cloudflare source-access gate failed. Original BLS bulk, series metadata and footnotes each return **403** from the observed Cloudflare location (ORD). Separate preview sessions reproduce the refusal. A fresh workspace capture still reproduces the official answer. Installed skills, authenticated Wrangler and local success are therefore insufficient release evidence.

No production code, route, schema, binding, secret or deployment was changed. This directory contains an isolated remote-dev harness and compatibility prototype. The remote session was torn down; no named production Worker was deployed. Its configuration has no production routes, account bindings, build hook or credentials. The old production identity is checked separately; prototype `schema_version:2.0` does not advertise a released version.

## What the additional work establishes

| Question | Result and reproducible evidence |
| --- | --- |
| Does a ninth entry break v1? | Yes. Actual Draft 2020-12 validation rejects nine entries under the **published** schema. A new `additional_countries` property validates but existing country iterators still discover only eight. Versioned discovery makes the new contract explicit without changing old consumers. [Schema results](schema-results.json). |
| Can the proposed branch preserve existing consumers? | Isolated wrapper delegates existing paths unchanged: **315** full-desk, source, measure, exact-period, directory, alias and error cases have identical status/body/headers. **219** successful v1/v2 responses pass JSON Schema validation. This is a compatibility seam proof, not proof that future route edits cannot regress. [Replay](compatibility-results.json). |
| Where does the one-observation constraint live? | `selectedResponse` coverage validation and `candidates[0].row`, **not a schema maxItems rule**. A duplicate currency observation produces 503 `representation_validation_failed`. US needs a separate multi-period selection branch. |
| Is the national frame defensible? | Current CPI FAQ identifies the 2018 sample and 2013 OMB frame. Original CPI design specifies 381 metro + 536 micro CBSAs; OMB explicitly separates these US counts from Puerto Rico's 7 + 5. Its state table lists 50 states and DC; current CPI appendix names DC and the design explicitly includes Alaska/Hawaii. Territories are outside the selected frame. This is an explicit primary-source derivation, not a claimed verbatim all-territories sentence. [Minimal excerpts](geography-evidence.json). |
| Does the Worker parser preserve the answer? | JS agrees cell-for-cell with the independent Python parser on all 13 slots; 24 isolated JS checks and the prior 20 Python semantic checks pass. Three archived-release levels and official rounded 3.7% still reconcile. All numerical presentations share BLS statistical lineage. [Reader checks](reader-results.json), [validation](validation.json). |
| Does real Cloudflare retrieval work? | **No.** All three fixed BLS bulk URLs return 403; reader returns explicit 503, no observations and no false freshness. [Final full rehearsal](preview-results.json), [separate live attempt](preview-live-repeat.json). No substitute publisher or access workaround was introduced. |
| Do revisit/failure semantics work in Cloudflare? | Constructed fixtures demonstrate warm conditional 304 with zero upstream calls; expiry re-fetches and can still return 304; a correction changes only September's version; a new month changes the window; failure returns 503 even with the old ETag; cached failure stays 503; recovery succeeds after error expiry. HTTP failures, timeout, body bounds, empty and malformed responses fail explicitly. These are fixture results, not live-source successes. |
| Is the proposed fetch budget globally bounded? | No. In the final three concurrent cold fixture requests, two misses cause **six** simulated upstream calls and the third hits cache. Cache API is location-specific. Remove the earlier promise of cross-request request coalescing; there is no global quota guarantee. A global lock/store is not implicitly authorized. |

The preview uses accelerated **10-second success / 2-second error TTLs** and records absolute expiry. It does not establish an elapsed one-hour production test, genuine BLS payload/CPU costs in Workers, geographic reliability or a global request limit. Fixture HEAD was not exercised remotely; the live HEAD branch could not run after access failure. These remain final implementation gates. The 8 MiB/file and 20-second deadline are tested with constructed inputs; the current workspace files are about 4.03 MB combined, but that is not a successful Cloudflare transfer measurement.

## Reproduce

Run from the repository root. Versions and source revision are in `validation.json`; specimen hashes/URLs are in the parent manifest. These commands do not deploy production:

```sh
python research/us-onboarding-2026-10-17/demo.py
python -m unittest discover -s research/us-onboarding-2026-10-17 -p test_demo.py
node research/us-onboarding-2026-10-17/rehearsal/verify-reader.mjs
node research/us-onboarding-2026-10-17/rehearsal/compatibility.mjs
python research/us-onboarding-2026-10-17/rehearsal/schema-check.py
npm run check
```

The compatibility script regenerates ignored `schema-inputs.json` from the existing eight-desk snapshot. It forbids network fetches; JSON Schema checks use `jsonschema` (version recorded), including URI formats and equality with the captured published schema. Run it again against the eventual implementation, replacing the wrapper delegation seam with the actual route dispatcher.

Fresh original-source replay, using a new empty temporary directory:

```sh
python research/us-onboarding-2026-10-17/capture.py --live --output /tmp/mr-us-new-replay
python research/us-onboarding-2026-10-17/demo.py --specimens /tmp/mr-us-new-replay/specimens
python research/us-onboarding-2026-10-17/rehearsal/geography.py --live /tmp/mr-us-frame-replay > /tmp/mr-us-frame-replay.json
```

The dated Python demonstration deliberately rejects a later window; updating the reference period requires reconciling a new official release. The JS prototype instead derives the latest month from matching bulk and series metadata. Neither silently selects an older matching release when metadata is ahead.

Remote rehearsal, using the existing configured login:

```sh
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config /workspace/.morning-rows-tools/node_modules/.bin/wrangler whoami
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config node research/us-onboarding-2026-10-17/rehearsal/run-preview.mjs
```

**Current expected result: nonzero exit because live access fails.** Never turn this into an accepted 200 baseline. The sanitized report retains only public aggregate bodies and allowlisted headers, including transport statuses/bytes/latency and code hashes. Preview tokens travel through curl stdin, never command arguments or saved reports. A later retest should preserve the old report in a dated evidence directory before writing a new one.

Cloudflare operational references: [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) (location-specific), [remote development](https://developers.cloudflare.com/workers/local-development/). The reproduction uses pinned Wrangler's established `unstable_DevEnv` transport; revalidate that private API on upgrade.

## Remaining limits and release blockers

1. **Mandatory blocker: original-source access from the actual Worker runtime.** All three fixed URLs must return valid complete responses in repeated cold previews. If refusal persists, stop this release; evaluate an official supported transport and quota model separately. Do not hide the blocker behind FRED or a snapshot.
2. **Mandatory implementation work:** real v2 routing/schema/native US desk, release-calendar handling, discovery, resource budget, actual-client conditional GET/HEAD, full regression preview and clean versioned release. The prototype proves selected boundaries only.
3. **Existing service condition:** NZ EMI was already degraded and notified before this task. Keep it separate from a US regression; an unqualified all-green rollout is blocked while its required gate fails. An explicit recorded release exception must identify that existing incident without weakening its check.
4. Independent agent evaluation and adoption remain unmeasured. Existing demand is implemented public workflows and tool failure reports, not permitted user request logs or traffic volume. The result supports a candidate and an executable plan, not a claim that agents will return.
