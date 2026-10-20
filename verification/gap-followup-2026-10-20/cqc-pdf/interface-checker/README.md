# CQC fixed historical PDF cohort interface gate

These tools verify England's `care_assessment_cohort` using the retained
independent Python workbook/SVG extraction and PyMuPDF comparison, including
the full-original/actual-reader reconciliation and its exact protected proof. All five
ratings counts must match exactly: no rounding tolerance, reference refresh,
older-edition substitution or runtime parser import in the numerical oracle.
The underlying CQC administrative lineage is shared. The cohort is the fixed
1 August 2025 service-level single-assessment-framework snapshot, not unique
locations, a current national census, a trend or a quality rate.

`check-cqc-pdf.mjs` captures 23 actual requests per domain: health, schema,
native England, catalogue, selected source, five measures and five exact-date
observations, actual-ETag conditional GET, HEAD and six explicit refusals. A
staged run sends the exact Worker version override to the apex domain; a
production run checks both domains. Every body is retained and bound by bytes
and SHA256 to its request status and selected public identity headers. Existing
capture directories and output reports cannot be overwritten. No publisher
request, fixture fallback or credentials are used by this capture tooling.

The independent verifier replays the exact route plan and body bindings;
requires five original numerical matches, exact geography/cohort/counting unit,
limitations, publication-metadata attribution and full-PDF provenance; and
independently recalculates observation/content versions. The PDF must have the
reviewed 7,175,967-byte digest. Publication metadata remains explicitly retained,
not represented as freshly acquired. England native/selected/HEAD/304 cache
lifetimes may not exceed 600 seconds; catalogue responses retain the existing
3,600-second bound.

`verify-schemas.py` validates the captured schema and 13 successful data
representations per domain, with ten schema-negative controls per domain.
Date-time and URI formats use the existing explicit local validators; missing
optional jsonschema format packages do not disable these checks. Remote schema
references are refused. Structural success is separate from numerical and
semantic acceptance.

```sh
node scripts/check-cqc-pdf.mjs CAPTURE REVISION VERSION staged
node verification/gap-followup-2026-10-20/cqc-pdf/interface-checker/verify-captures.mjs CAPTURE OUTPUT.json REVISION VERSION staged
python3 verification/gap-followup-2026-10-20/cqc-pdf/interface-checker/verify-schemas.py CAPTURE SCHEMAS.json REVISION VERSION staged
```

Omit `staged` consistently for both-domain production evidence. CPU and existing
source regression gates are separate release requirements.

The retained `controls.json` records 35 constructed offline controls after the
full-original/actual-reader evidence bindings were added. `controls-initial.json`
preserves the earlier successful run before those additional bindings. These
controls include
one 13-document/ten-negative schema exercise. Subjects use the actual parser on
the statistical-only structural fixture with explicitly simulated original-PDF
provenance and a fixed test clock. The selector entry and catalogue card are
constructed while the release integrator owns actual inventory activation.
These controls exercise the verifier and actual selector/adapter/schema, and
prove rejection of altered values, meaning, provenance, body hashes, candidate
identity, omitted routes, false pass flags, conditional/HEAD failures, negative
response substitutions and cache overruns. They do not establish live access,
real discovery, deployment, scheduled operation or operational acceptance.

```sh
node verification/gap-followup-2026-10-20/cqc-pdf/interface-checker/check-controls.mjs NEW-CONTROLS.json
```

Control captures are created in a fresh temporary directory and removed after
verification. The live capture checker and offline oracle never construct data.
