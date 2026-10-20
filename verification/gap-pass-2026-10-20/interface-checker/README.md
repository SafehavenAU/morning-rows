# Combined gap interface acceptance tooling

This tooling checks the actual staged or production Worker against the frozen,
independently extracted publisher evidence. It does not fetch publishers,
substitute specimens into captured responses, refresh references, or establish
scheduled operational acceptance.

The capture command makes **40 requests per domain**: health and schema, three
native desks and their catalogs, source/measure/exact-period selections for all
six active contracts, eight explicit refusals, and HEAD/304 checks for one selection
for FX, unemployment and WRA. Staging uses the apex domain with the exact version override.
Production uses both domains. Native Australia, Canada and Wales bodies are
retained for the separate monitor/regression review.

The numerical oracle imports no runtime readers. It pins the independent
reports by SHA256 and compares 38 dated FX cells, 14 StatCan observations and four WRA observations. It also
checks geography, units, raw release times, missing-date refusals, disclosed
WRA coverage, CMHC notices, legacy fields, selector version consistency,
response identity, body hashes and the Canada UTC cache boundary. The held
AEMO `grid_day` source must be absent from Australia native data, source health,
catalog and published schema; its source selector must return `unknown_source`.
No AEMO publisher request is made by this validation.

Structural acceptance is separate. The Python verifier validates 24 successful
native/catalog/selected bodies per domain against that domain's captured
Draft 2020-12 schema. It forbids external references, registers explicit format
checks, and requires eight schema rejection controls per domain. It reuses the
format helpers in `scripts/verify-statcan-gdp-captures.py`.

## Commands

Run from the repository root. All output paths must be fresh; failed capture
directories and reports must remain available.

```sh
# Only the release owner runs actual requests after freezing the candidate.
node scripts/check-gap-pass.mjs OUTPUT REVISION VERSION staged
node verification/gap-pass-2026-10-20/interface-checker/verify-captures.mjs OUTPUT NUMERIC_REPORT REVISION VERSION staged
python3 verification/gap-pass-2026-10-20/interface-checker/verify-schemas.py OUTPUT SCHEMA_REPORT REVISION VERSION staged

# Production: omit "staged" from all three commands.

# Constructed offline controls; these are not production tests or live evidence.
node verification/gap-pass-2026-10-20/interface-checker/check-controls.mjs FRESH_CONTROL_REPORT
```

The fixed reference vintage is the BoC window
**20 September–20 October 2026** ending with published **19 October** values,
September unemployment/CPI, July retail, Q3 housing, and financial year
2025–26 WRA tax due. The capture command refuses a different
BoC UTC window before making requests. A legitimate publisher revision or new
release fails exact comparison and requires independently verified evidence
and an explicit checker update. It must not be waived or silently refreshed.

`controls-held-aemo.json` is the current constructed-control evidence for the
six-contract scope. It checks the actual adapters against retained independent
references, including held-source absence and refusal controls. These scripts
are explicitly invoked and are not automatic `node --test` production tests.

`controls.json`, `controls-with-schema.json` and
`manifest-before-aemo-hold.json` retain the earlier seven-contract tooling
history. Its 835 numerical checks and 27 positive schema documents do not
establish acceptance of the revised scope. Earlier staged passes and production
AEMO failures remain in the release-attempt evidence. Recurrent production HTTP
406 led to rollback and held activation; no earlier pass is relabelled as final
production acceptance. The pre-hold tooling source is retained in git at
`ba0812b493f7cc4ca47a9f726211d96903bd9597`.

Tooling used: Node.js 24.19.0 and Python 3 with `jsonschema` (exact version in
`manifest.json`). Capture transport requires `curl`. Only an allowlist of
response headers is retained; credentials, override request headers and raw
headers are not saved.

Limits: all official presentations share publisher statistical lineage.
Matching retained bytes does not independently authenticate a supplied
capture. Passing a bounded actual sample does not establish a CPU percentile,
uptime, delivery receipt or seven-day SHADOW acceptance.
