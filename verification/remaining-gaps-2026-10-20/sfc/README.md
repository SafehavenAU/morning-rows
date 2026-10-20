# SFC college activity: phase-two implementation evidence

The [pre-code contract](CONTRACT.md) selects five 2024–25 Scottish college FTE
measures from a named SFC edition. Local implementation and independent comparison
pass. Integrated Worker CPU, source isolation, interface/schema, both-domain
release checks and monitoring activation remain separate parent-owned gates.

The reader is `lib/sfc-activity.js`. Its exports are `SFC_ACTIVITY_CONTRACT`,
`parseSfcActivity`, `validateSfcActivity`, `readSfcActivity`,
`sfcActivityDefinitions` and `sfcActivityRows`. The typed helper maps each native
`measure` to `measure_id`. Five rows cover the four FE/HE and full-/part-time
components and their overlapping total, all in FTE.

The retained workbook is 70,694 bytes, SHA-256
`f4816a63e4ab246799f4cbb6075d3feba78ada67670e34d71e5900826c3b5979`.
It was acquired on 20 October 2026 at 09:42:55.549117 UTC; publication remains
4 February 2026 and the observation period remains academic year 2024–25.
The original [request record](../prior-audit/sfc/original/tables.xlsx.request.json)
and [audit](../prior-audit/sfc/README.md) retain dates, direct publisher links,
methods and reproduction permission. This implementation does not claim a
new publication or that this named edition will remain latest.

`verify-original.py` independently reads XLSX ZIP/XML using Python stdlib and
Decimal, then extracts the Scottish Parliament's separately presented Table 1
using HTMLParser. All five values match exactly: 39,655; 47,405; 4,595; 24,400;
116,055. The workbook's separate Table 3 total also matches. The presentations
share the same SFC FES statistical lineage; extraction/presentation independence
does not establish independent measurement.

`verify-reader.mjs` runs the actual reader with the retained workbook supplied
through an injected Response, verifies the strict native representation and
compares its five typed rows to the independent Python report. Its provenance
clock is explicitly the normalized retained acquisition time. This is an offline
replay, not a new publisher retrieval or a Cloudflare acceptance result.

The 13 focused tests include wrong geography, unit, population, edition, academic
year and category; headcount substitution; omitted and duplicate axes; blank,
suppressed and malformed values; numeric zero; coherent same-edition revision;
nearest-five rounding residual; native semantic mutations; input and expansion
bounds; redirects and HTTP failures; strict acquisition provenance; and typed
metadata completeness. The fixed public workbook fetch is limited to 128 KiB
and redirects are refused.

The initial protected run exposed a Workerd compatibility error before any SFC
publisher request: `redirect: "error"` is unsupported. The retained local Workerd
constructor proof and original failed code snapshots are under `../preview/`.
The reader now uses `manual` and refuses non-success responses or changed URLs.
The actual corrected SFC read on 20 October at 10:15:25–10:15:29 UTC matched all
five cells and the exact original workbook digest. Its full protected result is
`../preview/cloudflare-workbooks-live.json`; the simultaneously attempted CQC
reader's 403 is preserved as a separate source failure. No billed CPU or final
integrated release acceptance is inferred from this proof.

Reproduce from the repository root:

```sh
python verification/remaining-gaps-2026-10-20/sfc/verify-original.py
node verification/remaining-gaps-2026-10-20/sfc/verify-reader.mjs
node --test test/sfc-activity.test.js
```

New coherent values in the same edition can parse, but require exact-vintage
independent verification before an acceptance claim. New periods or altered
statistical meaning fail the current contract. Acquisition provenance is
separate from observation meaning; source/typed integration must preserve that
separation when calculating semantic versions.
