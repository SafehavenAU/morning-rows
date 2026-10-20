# NI energy queue reassessment — 20 October 2026

**Decision: ready for a separate bounded implementation contract.** The previous
encoding/denominator uncertainty is resolved for five latest rolling-year
measures. No reader, monitoring scope or release has been changed.

The [publication](https://www.economy-ni.gov.uk/publications/electricity-consumption-and-renewable-generation-northern-ireland-july-2025-june-2026)
links the [official report](https://datavis.nisra.gov.uk/Economy/electricity-consumption-and-renewable-generation-report.html).
Its Figure 1 and Figure 3 embedded XLSX exports work without credentials. The
CSV export mixes UTF-16-style content with single-byte CR/LF; it is not the
recommended transport. Original HTML, embedded bytes, hashes and request times
are retained. The report is 5,191,096 bytes; individual exports are small.

The independent Python XML extraction matches chart JSON and the separately
written [3 September release](https://www.economy-ni.gov.uk/news/electricity-consumption-and-renewable-generation-northern-ireland-year-ending-june-2026)
for all five selected cells: 8,865 / 4,431 / 3,855 / 578 GWh and 50%. The common
window is July 2025–June 2026. **32 checks pass** in `independent-report.json`.
Presentations share SONI/NIE/DESNZ lineage; this is not an independent generation
measurement. The 1 GWh component residual is permitted source rounding.

The [contract proposal](CONTRACT-PROPOSAL.md) fixes the denominator, five-cell
scope, revision/missingness rules, required adverse cases and release gates.
DfE's [Crown copyright policy](https://www.economy-ni.gov.uk/articles/crown-copyright-economy)
permits attributed OGL reuse. Further work is implementation/Worker evidence,
not publisher registration or a new statistical series search.

Reproduce without network:

```sh
python verification/gap-pass-2026-10-20/held-queue/ni-energy/verify-original.py
```

Acquisition times and SHA-256 are in each `original/*.request.json`;
`embedded-manifest.json` traces the extracted files back to the retained report.
No whole history was independently certified or proposed for output.
