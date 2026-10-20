# Retained original claimant-count evidence

These are five national scopes from ONS/Nomis `NM_162_1`: United Kingdom,
England, Scotland, Wales and Northern Ireland. The specimen contains 65 cells,
August 2025–August 2026, for total sex, age 16+, claimant count, value. All cells
carry normal/publication flags `A`/`F`. Counts are persons rounded to five and
not seasonally adjusted; they are administrative claimant counts, not ILO
unemployment estimates.

`acquisition.json` identifies each original request, HTTP result, local UTC
acquisition interval, byte length and SHA-256. `nomis-national.csv` is unchanged.
`nomis-national.excerpt.json` retains the separately acquired JSON observations
and provenance header, omitting the publisher's contact header. Its original
and retained hashes and the exact transformation are recorded. The complete
65 observation objects are unchanged. All eight supporting metadata JSON files
also omit `structure.header.sender`, retaining their existing filenames.
Their original wire hashes/byte lengths and separate retained hashes/byte
lengths are recorded alongside explicit transformations in `acquisition.json`.
All other metadata, annotations and codelist values are unchanged. These
retained JSON files are clearly documented excerpts, not byte-original wire
responses. The time codelist establishes the latest actually available period
without inferring publication from the calendar.

The `type=TYPE480` geography-metadata request returned country entries despite
its requested type; it is retained as an observed transport limitation. Exact
GSS codes/names are verified against the returned country codelist. In the data,
Wales, Scotland and Northern Ireland use the transport type `regions`/480;
that does not change their national statistical boundaries.

At acquisition on 20 October at 04:40 UTC, the latest period was August, with
dataset update/revision metadata `2026-09-15 07:00:00`. The source page still
showed this vintage at 04:45 UTC. Its advertised 20 October release is not
evidence of publication. `publisher-notes.json` retains official source URLs,
retrieval hashes and paraphrased statistical/licence notes.

Publication time, reference day and acquisition time are distinct. The API's
release strings have no timezone; none has been invented. Its `prepared` and
`extracted` strings include `Z` but are about one hour ahead of our UTC
acquisition records. They are retained raw and are not trusted as independently
verified retrieval timestamps. Per-period metadata records reference dates and
revision versions; August is version 0 and July version 1 in this specimen.

`nisra-selected-cells.json` contains independently extracted aggregate cells and
necessary notes from NISRA's September workbook. `LGD_11!D19`, the geographically
classified and rounded NI total, matches August Nomis exactly: **34,155**.
Thirteen NSA headline cells are retained only as context. Their population
classification/rounding differs: August's unrounded headline is **34,159**.
They are not thirteen like-for-like matches and must not be forced to agree.
NISRA and Nomis share administrative/statistical lineage; independent
presentation and extraction are not an independent population enumeration.

The original NISRA workbook contains staff contact details and is therefore not
committed. Its exact URL, hash and retrieval evidence are in
`nisra-acquisition.json`. The selected cells omit those contacts. Reproducing
the workbook extraction requires obtaining that exact hash-pinned original:

```sh
python verification/claimant-count-2026-10-20/verify-original.py \
  verification/claimant-count-2026-10-20/original /tmp/claimant-original-report.json
python verification/claimant-count-2026-10-20/extract-nisra.py \
  /path/to/lmr-claimant-count-tables-september-2026.xlsx \
  verification/claimant-count-2026-10-20/original/nomis-national.csv \
  /tmp/claimant-nisra-report.json
```

Both commands are offline and import no production reader. The first checks
all 65 CSV/JSON cells, current window, dimensions, flags and thirteen
UK/four-nation rounding reconciliations. The second checks the workbook hash,
release/period boundary, NI dimensions and one directly comparable cell.
Neither command proves live Cloudflare retrieval or a later release.

Reuse is under ONS and NISRA Crown copyright/Open Government Licence terms,
with attribution: **Source: Office for National Statistics (Nomis); NISRA**.
See [Nomis copyright](https://www.nomisweb.co.uk/home/copyright.asp) and
[NISRA copyright](https://www.nisra.gov.uk/crown-copyright).
