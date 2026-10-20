# AEMO daily structural-schema proof — 20 October 2026

This is an offline schema proof for the isolated daily-bundle candidate. It is
not a live reader invocation, production acceptance or scheduled observation.
The frozen original directory excerpt and two official daily ZIPs are injected
into the actual bounded reader. Its output passes through the actual
`selectedResponse` adapter. Python's independent Draft 2020-12 implementation
then evaluates the published schema; it does not call the reader validator to
decide schema validity. JSON decimals are loaded exactly, so the structural
`multipleOf: 0.01` cent constraint cannot fail through binary floating-point
division.

The retained report covers 178 cases: 80 native cases, 97 selected-response
cases and one explicit arithmetic-boundary case. Healthy native data retains
two fixed regions, 288 intervals per region, ten exact definitions, the raw
layout-2 and layout-3 price tokens, cent-rounded numeric prices, all required
DREGION run and flag fields, two trading-bundle records and three ordered
public acquisition records. Raw signed decimal and scientific notation follows
the reader's lexical precision; no TRADE or FIRM field is introduced.

Both regional failure directions are exercised. A degraded source has exactly
five healthy observations and five unavailable-measure records. Each healthy
regional measure remains selectable with degraded source health. Each failed
regional measure or exact observation returns HTTP 503 with no observations.
Whole-source failure also has no observations. The schema constrains JSON body
shape; the test separately asserts the route's HTTP status.

Native and selected controls reject wrong country/region, substituted units and
definitions, missing or extra intervals, changed run/flags/layouts, suppressed
or nonnumeric prices, excessive precision, non-cent values, false finality,
invalid dates, missing/oversized provenance, misleading health, invalid
canonical identities and pointers, duplicate/omitted observations and fabricated
failed-region zeros. Context deliberately retains the full native representation,
including regions, bundles and provenance. All ten exact selected IDs are checked.

Cross-field equality, current-day eligibility, contiguous exact interval endings,
layout equality, bundle generation and clock ordering, raw numeric magnitude,
rounding arithmetic and complete-day summary arithmetic remain the semantic
reader's responsibility. A structurally valid wrong mean is explicitly accepted
by the schema and rejected by the reader in the boundary control. These tests
do not establish publisher correction timing or independent statistical lineage.
The original numerical reconciliation is retained separately in the parent
AEMO evidence directory.

Reproduce from the repository root:

```sh
AEMO_SCHEMA_REPORT=/tmp/aemo-daily-schema-report.json node --test test/aemo-daily-schema.test.js
```

`report.json` binds the actual reader, schema, adapter and test file hashes plus
the three retained original inputs. The test rejects source changes during an
evidence run. `manifest.json` binds this proof's files and required dependencies;
paths are relative to the repository root. No HTTP, deployment, checkpoint,
approval, notification or operational-schedule change is performed by this test.
