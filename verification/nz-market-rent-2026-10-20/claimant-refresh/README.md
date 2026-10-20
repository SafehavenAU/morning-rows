# Claimant release refresh during market-rent validation

The publisher release advanced during the 20 October 2026 candidate checks.
This dated specimen covers **September 2025–September 2026**, exactly five
national geographies × thirteen months. It supplements the unchanged
[original August-vintage evidence](../../claimant-count-2026-10-20/README.md)
and preserves the [existing statistical contract](../../claimant-count-2026-10-20/CONTRACT.md).
There is no reader, approval, monitoring or schedule change in this directory.

[Independent reconciliation](independent-report.json) passes all **65 CSV/JSON
cells**, exact dimensions, public/normal flags, units, rounding, monthly
coverage, observation URNs, reference dates and revision versions. Separate
Python `csv.DictReader`/`Decimal` and JSON extraction are used; no production
JavaScript reader is imported. The retained cold candidate bodies also match
all **65 values and their reference/revision metadata** at source
`f85224e6a9ee601d9e706ffab2cd133d3697c272`, Worker
`b2a562a7-d137-4376-a6ca-54f29f1415ad`. Each captured CSV provenance digest
matches the independently acquired original. This is an offline comparison of
[existing cold captures](../legacy-cpu.json), not another endpoint capture.

| Nation | September 2026 count | August 2026 revised count | Earlier August count |
| --- | ---: | ---: | ---: |
| United Kingdom | 1,702,905 | 1,667,095 | 1,698,450 |
| England | 1,493,875 | 1,459,205 | 1,486,460 |
| Scotland | 108,760 | 110,065 | 112,215 |
| Wales | 66,045 | 64,305 | 65,615 |
| Northern Ireland | 34,225 | 33,515 | 34,155 |

These are administrative claimant counts, all sexes, age 16+, persons rounded to
five, not seasonally adjusted. September's reference date is **10 September
2026**, revision 0. August advances from revision 0 to revision 1. Both have the
publisher release string `2026-10-20 07:00:00`; its timezone remains unestablished
and is not invented. All thirteen UK/four-nation comparisons are within the
existing 12.5-person separate-rounding tolerance. The old window loses
August 2025 and gains September 2026; earlier evidence was not overwritten.

## Acquisition and independent presentation

The three exact no-key Nomis requests completed at
**2026-10-20T07:30:47.356676+00:00**. The
[acquisition ledger](acquisition.json) records per-request times, URLs, byte
lengths and original and retained SHA-256 hashes. Original CSV is retained
byte-for-byte. The JSON observations and full time codelist are unchanged except
for omission of the publisher contact sender header and JSON reserialization;
wire originals remain outside the repository. The historical dimension
codelists are explicitly referenced as prior hash-pinned evidence, not claimed
as newly acquired metadata. Publisher extraction clocks remain distinct from
local UTC acquisition clocks.

| Original wire specimen | Bytes | SHA-256 |
| --- | ---: | --- |
| Nomis national CSV | 23,205 | `c95b1b549d43219577f1beb8f90996c217e1027b07bc410770fe7de1c96267d0` |
| Nomis national JSON | 73,175 | `a0c29e28989d42af4bb7d54a59dc60a3564d1d2e192009107137aff4b8628d70` |
| Nomis time codelist | 114,779 | `3e96ec4ae054f05c1018b771980903fb94f1747262f2845b15c6b65f8cb78f9a` |
| NISRA October workbook | 353,319 | `9d7d881f0d68767182f2636e3bf28b04eba391f0d8d95d5325c739254c3e61cb` |

One bounded NISRA page check and its linked workbook download found the
[October official release](https://www.nisra.gov.uk/publications/labour-market-report-october-2026).
[Independent ZIP/XML extraction](nisra-selected-cells.json) verifies the directly
comparable `LGD_11!D19` total: **34,225**, exactly matching Nomis. The cover records
publication at 7am on 20 October and marks September provisional. The NSA headline
value 34,228 is retained only as context: its geographical classification and
rounding differ. This is **one** comparable independent presentation, not
thirteen NI historical matches or 65 independent population enumerations.
Nomis CSV, JSON and NISRA share upstream administrative/statistical lineage.

[Acquisition](nisra-acquisition.json), [extractor](nisra-extract.py) and
[checks](nisra-extraction-checks.json) retain the original workbook hash and
reproduction steps. Only aggregate cells and necessary notes are committed;
the workbook with staff contacts remains outside the repository. Attribution
and Crown copyright/Open Government Licence follow the existing evidence;
the same-day NISRA copyright evidence is reused explicitly.

## Reproduction and reference compatibility

From the repository root, write a new report rather than overwriting this
frozen evidence:

```sh
python3 verification/nz-market-rent-2026-10-20/claimant-refresh/verify-refresh.py --output /tmp/claimant-refresh-recheck.json
CLAIMANT_REFERENCE=verification/nz-market-rent-2026-10-20/claimant-refresh/independent-report.json node scripts/check-claimants.mjs --validate-reference
```

The frozen reference is 23,219 bytes, SHA-256
`6e35c48d68fb0f072bf697f0b520c755e231334f0b2e5168a94514faefd62d0e`.
It passes the actual no-network reference validator and the existing capture
verifier's 65 native-cell checks against an offline projection of the cold
capture. [Compatibility checks](reference-compatibility.json) distinguish this
from selected-interface or new HTTP evidence. The root release workflow owns
subsequent full-selector and both-domain acceptance. This evidence does not
satisfy scheduled observation, delivery acknowledgment or unrelated blocked
NZ-PRICES/UK-CPI gates.
