# Fixed-edition NI electricity interface gate

These tools validate one candidate's public Northern Ireland electricity source against **five independently extracted reference cells**. They do not fetch publishers, refresh references, certify a later edition, deploy a Worker or record monitoring acceptance. Preparing and running the constructed controls is separate from actual staged/production capture.

The frozen independent reference is the 3 September 2026 edition, inclusive rolling window **2025-07-01/2026-06-30**: renewable/GFEC share 50%, gross final consumption 8,865 GWh, renewable generation 4,431 GWh, non-renewable generation 3,855 GWh and net imports 578 GWh. `support.mjs` pins the new official article comparison, the original independent workbook/report comparison and the retained full-methodology excerpt by SHA-256. All presentations share the publisher's statistical lineage. Five measured values repeated across selectors or domains remain **five independent reference cells**, not new original acquisitions.

The active source is `northern-ireland/electricity_balance`. The actual reader obtains its numbers from the ordinary public DfE article. Fuller methodology and revision qualifications explicitly refer to retained **same-edition** report metadata with `live_retrieved:false`. No new successful access to the previously rejected datavis report is inferred. Public acquisition requires one bounded article provenance entry; its retrieval clock cannot follow the source completion or captured response.

## Exact candidate capture

From the repository root, only after the candidate is frozen and remote validation is authorized:

```sh
node scripts/check-ni-energy-summary.mjs FRESH_CAPTURE_DIRECTORY REVISION_40HEX WORKER_UUID staged
node verification/gap-followup-2026-10-20/interface-checker/verify-captures.mjs CAPTURE FRESH_NUMERIC_REPORT REVISION_40HEX WORKER_UUID staged
python verification/gap-followup-2026-10-20/interface-checker/verify-schemas.py CAPTURE FRESH_SCHEMA_REPORT REVISION_40HEX WORKER_UUID staged
```

Omit `staged` for both production domains. Staging sends the existing exact Worker version override to the apex domain; production sends no override. The capture script makes **23 bounded requests per domain**: health, schema, native NI desk, NI catalogue, one selected source, five measures, five exact-period observations, conditional GET and HEAD, and six explicit refusal checks. Exact period URLs encode the slash as `%2F`. It does not sweep other desks or contact a publisher directly.

The fresh-only output contains `ni-energy-interface-report.json` and complete JSON body bytes named `NNN.body`. Records retain public source/Worker identity, allowlisted response headers, body hashes/lengths, method, path, status, capture intervals and actual request ETags. Failed captures remain failed; the script neither retries nor overwrites them. Attempt metadata is recorded before each request, including a transport attempt that fails before a complete response. Private transport headers and credentials are not retained.

The offline numerical gate independently replays exact route coverage, candidate identity, byte hashes, no-substitution refusals, bounded cache headers, HEAD/304 behavior, all five values and their units/territory/window/edition/definitions, full selected context/qualifications against native data, provenance ordering and observation/content versions. It rejects silent scenario, period or release substitution even when numbers happen to agree.

The separate Python Draft 2020-12 gate validates **13 successful native/catalogue/selection documents and eight meaningful negative controls per domain**. It uses explicit date/date-time validators, validates the captured schema's identity/dialect, refuses external references and checks the exact 23-route set. Structural validity is not numerical or semantic correctness; both gates must pass.

## Existing SFC/CMHC compatibility

Historical evidence is immutable. Existing `scripts/check-remaining-gaps.mjs` and its numerical verifier have no NI-held selector assumptions and remain usable unchanged for SFC/CMHC. The historical schema verifier explicitly forbids `remainingNi` definitions, so use this narrowly updated compatibility copy for the new release:

```sh
python verification/gap-followup-2026-10-20/interface-checker/verify-existing-remaining-schemas.py EXISTING_REMAINING_CAPTURE FRESH_SCHEMA_REPORT REVISION_40HEX WORKER_UUID staged
```

Its only behavioral difference from the historical schema helper is allowing newly active NI definitions; it continues refusing held CQC/ONS definitions. It retains **22 routes, 10 positive schema documents and eight negative controls per domain** for SFC/CMHC. It does not replace the dedicated NI gate. Original source file hashes and the copy's scope are recorded in `compatibility.json`.

## Constructed offline controls

```sh
node verification/gap-followup-2026-10-20/interface-checker/check-controls.mjs /tmp/ni-checker-controls.json
node verification/gap-followup-2026-10-20/interface-checker/check-existing-remaining-compatibility.mjs /tmp/existing-remaining-compatibility.json
```

These scripts construct subjects with actual reader/adapter code using retained original fixtures, then test the separate reference oracle. They make no HTTP requests. The NI controls include a source error preserving a successful sibling, complete matching captures, schema positives/negatives, and mutations of identity, bytes, references, periods, units/denominator, metadata edition, public provenance/order, selected qualifications/context, versions, catalogue coverage, absent-period zero substitution and cache behavior. Constructed success is never described as actual Worker access or release acceptance.

The first constructed check found an incorrect tooling expectation that catalogue summaries contained full edition definitions. Actual catalogue cards correctly expose their standard identity/name/unit/geography/kind/record link; full fixed-edition qualifications live in selected definitions and context. The checker was corrected to the actual catalogue contract while preserving full selected metadata checks. This tooling-only failed attempt is documented in `control-attempts.json`; no runtime change was required.
