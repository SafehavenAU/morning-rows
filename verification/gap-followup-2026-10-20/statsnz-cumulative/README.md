# Cumulative Stats NZ capture checker — 20 October 2026

The new checker combines **15 dated exact numerical references** while keeping
**eight numerical gaps unresolved**. It preserves the historical eleven-cell
checker and evidence unchanged. The four added references are three agriculture
cells and one LEED quarterly cell, extracted directly from separate original
official CSVs with Python's standard library.

Run against an actual, unmodified native New Zealand response:

```sh
python3 scripts/verify-followup-statsnz.py CAPTURE_JSON OUTPUT_JSON
```

The checker does not fetch anything. A passing report establishes agreement of
the supplied capture with these references and metadata, not how or when the
capture was acquired. The surrounding staged/production capture pipeline must
establish its actual request, identity, health and retrieval provenance.

## Fixed checks

1. Hash-check and call the unchanged
   [`verify-gap-statsnz.py`](../../../scripts/verify-gap-statsnz.py) `verify(capture)`.
   Its eleven numerical references and exact 23-row identity/metadata checks
   remain mandatory.
2. Hash-check the complete frozen agriculture, LEED and income evidence
   manifests, then every listed file's bytes and hash. Changing a reference and
   rewriting its manifest does not authorize a new specimen.
3. Independently parse the original agriculture `AGR001AA` CSV and contact-free
   original-line excerpt of LEED `LED005AA`. Require exact table, selections, period, units/magnitude, update vintage
   and missingness/status-warning metadata. Compare exact numeric values,
   native geography, units, dimensions, kind and selection.
4. Require the independently reviewed `metadata-contract.json`: the four income
   fields for `INC_INC_001` and three population/period/limitation fields for
   each LEED selection. Metadata clarification does not certify the two annual
   LEED numbers or the paid-employment weekly-income value.

| New reference | Exact value | Period and boundary |
| --- | ---: | --- |
| `AGR_AGR_001` | 8,293 hectares | 2018 new exotic forest area; year to 31 March, not replanting. |
| `AGR_AGR_002` | 9,522 hectares | Apple area at 30 June 2024. |
| `AGR_AGR_003` | 23,252,463 animals | Total sheep at 30 June 2025. |
| `LEED_Q1W_001` | NZD 18,100 per quarter | 2025 Q2 / `202506`; all full-quarter jobs, all sexes and ages. |

The agriculture CSV update stamp is 16 April 2026, 10:45am; the LEED CSV stamp is
25 August 2026, 10:45am. Both are unzoned publisher stamps. Neither export displays
observation status flags. Exact equality is to the published value; it is not a
claim about unrounded microdata, undisplayed flags, finality or later vintages.
Both export routes share Stats NZ statistical lineage with ADE.
The LEED wire response was 619 bytes; only byte-identical original lines 1–28
(521 bytes) are retained, omitting the contact footer. Wire and excerpt hashes
remain separate and are required by the checker. No full-wire retention is claimed.

The eight remaining numeric IDs are `CORR_FIS_005`, `INC_INC_001`, `INC_INC_011`,
`JUS_FIS_001`, `LEED_AP1_001`, `LEED_AP1_002`, `POPPR_FHH_003` and `POPPR_LAB_003`.
Every output keeps whole-23, undisplayed-flag, future-vintage and
scheduled/release acceptance false.

## Controls and actual-capture boundary

```sh
python3 verification/gap-followup-2026-10-20/statsnz-cumulative/test-verifier.py
```

`verifier-controls.json` records **79 rejected capture mutations, six rejected
reference/manifest mutations and four CLI controls**. These cover wrong values,
periods, geography, units, dimensions, missing/suppressed values, booleans,
nonfinite values, absent/error rows, and false or missing semantic metadata.
An unresolved numeric cell stays unresolved even when its supplied number
changes. The positive fixture is explicitly constructed; it is not a live
reader capture or release proof.

`prior-release-rejection.json` runs the checker against the unchanged actual
response retained from the preceding accepted release. Its 15 numerical
comparisons match, but it fails all **13 newly required metadata fields**.
That expected failure is preserved rather than modifying the historical response
to resemble the new reader. A new candidate's actual captures must pass before
the new metadata implementation is accepted.

The manifest binds the checker, metadata contract and local control evidence.
No runtime source, historical evidence, credentials, monitoring state or
production service was changed by this checker task.
