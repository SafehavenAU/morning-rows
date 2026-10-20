# Remaining-gap release interface gate

This gate covers only `scotland/college_activity` and
`canada/rental_benchmark`: five independently extracted SFC cells and two CMHC
cells. NI electricity, CQC assessments and ONS bedroom rents remain held after
their actual Worker access failures and are excluded from these public checks.

Run only after root freezes and stages an exact candidate. The capture tool
makes 22 bounded requests per domain: health/schema, two native desks and their
catalogues, source/measure/exact-period selections, HEAD/304 and six explicit
refusals. Staged mode uses the exact Worker version override on the apex domain;
production captures both domains. It does not deploy, activate monitoring,
modify checkpoints, refresh numerical references or retry failures.

```
node scripts/check-remaining-gaps.mjs CAPTURE REVISION VERSION [staged]
node verification/remaining-gaps-2026-10-20/interface-checker/verify-captures.mjs CAPTURE OUTPUT REVISION VERSION [staged]
python3 verification/remaining-gaps-2026-10-20/interface-checker/verify-schemas.py CAPTURE OUTPUT REVISION VERSION [staged]
```

`CAPTURE` must be a new directory. Outputs must be new files. Every received
body and unsuccessful attempt is retained. Public identity headers, request
intervals, byte counts and hashes bind `remaining-interface-report.json` to its
numbered body files. No credentials, signed URLs, raw tail or private headers
are retained. A transport/parsing failure stops the capture; there is no retry
or old-body substitution.

`support.mjs` imports no runtime reader. Its pinned Python reference reports
establish the exact seven values, vintage and semantic mappings. Any mismatch
requires investigation and a separately verified new reference; neither a new
publisher release nor a successful response silently changes acceptance.
Source/measure/exact selections must retain the same observation versions.
Canonical observation and content digests are replayed independently. Complete
selected context, data and qualifications must match the earlier checked native
source after excluding acquisition-only fields.
Native and selected results keep academic-year/FTE meaning, the exact CMA/CA
identities, annual October rent reference, raw unzoned release and conditional
CMHC notices. Acquisition provenance is checked separately from statistical
observations. The schema gate checks ten captured documents and eight negative
controls per domain using the captured Draft 2020-12 schema, explicit date/time
format checks and no external references.

```
node verification/remaining-gaps-2026-10-20/interface-checker/check-controls.mjs NEW_REPORT
```

This last command uses mocked original publisher responses and the actual
readers/adapters to construct offline subjects. It checks all capture rules,
meaningful corruptions, missing/wrong filters and source-failure isolation.
These controls are not actual Worker/publisher executions, CPU measurements,
release acceptance or scheduled monitoring evidence. The numerical oracle is
still the separately extracted Python references, never the subject reader.
The retained GDP schema helper supplies explicit format checks only.

The frozen constructed controls passed 345 positive checks, 22 meaningful
corruption refusals, two source-isolation cases, ten schema documents and eight
schema negatives. The first control invocation preceded inventory integration
and stopped at `unknown_source`/missing selection entry; it established no
acceptance. `control-attempts.json` preserves that preparation failure.
