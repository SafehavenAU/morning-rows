# Fiscal justice evidence follow-up — 20 October 2026

Neither exact numeric gate is closed. The retained targets remain
`CORR_FIS_005` **8,199 sentenced people** and `JUS_FIS_001` **50,741 adults
convicted**, both fiscal **2024/2025**. No reader defect, replacement value,
runtime change or future-vintage approval is established.

The new evidence adds useful counting and missing-value safeguards. The
[Ministry's official adult-table guide](https://www.justice.govt.nz/justice-sector-policy/research-data/justice-statistics/adults-with-finalised-charges-in-court/)
describes one person per year, selected by most serious offence, regardless of
court. Since July 2019 the adult population generally begins at age 18; charges
filed before the change retain the documented transitional treatment for
17-year-olds. Charge totals cannot substitute for person totals.

The [official data index](https://www.justice.govt.nz/justice-sector-policy/research-data/justice-statistics/data-tables/)
now links a **June 2026 version 1.0** workbook. Independent ZIP/XML extraction
finds its fiscal 2024/2025 total of **50,737** in three presentations:

| Original sheet | Period cell | Value cell |
| --- | --- | --- |
| `4.People convicted by offence` | `AT7` | `AT25` |
| `5b.Convicted by court & sent` | `L6` | `L17` |
| `6.Convictd gender ethnicity age` | `AT8` | `AT9` |

This is **rejected as a comparator** for the retained adult count. The workbook's
`Definitions and data notes!B14` expressly distinguishes its all-person
population from the separate adult/youth ADE tables, and it is a later edition.
Its `19 years and under` age category cannot reproduce the required adult
population or transitional charge rule. Three cells within one workbook are
internal corroboration, not three independent datasets. The difference of four
does not establish a wrong reader value.

The same workbook defines financial years as July–June, uses one most-serious
convicted charge per person/year, and distinguishes a dash for unavailable
information from a numeric zero. These notes qualify this workbook; they are not
blanket proof of every Stats NZ table's confidentiality treatment.

The [September 2025 Ministry release announcement](https://www.justice.govt.nz/about/news-and-media/media-releases/latest-justice-statistics-released-sep-2025/)
confirms the earlier financial-year edition existed, but points to the mutable
current table index rather than retaining its exact workbook link. The official
historical publication finder returned **HTTP 405** during acquisition.
The Corrections statistics index and the Stats NZ sentenced-prisoner concept
page each returned **HTTP 403, `error code: 1010`**. These outcomes are recorded,
with no repeated request, changed headers, proxy, credential or access bypass.
They do not establish that the underlying datasets no longer exist.

The earlier fiscal publication notices and random-rounding qualification remain
in the [prior evidence](../../gap-pass-2026-10-20/statsnz/README.md).
Neither a quarterly prison stock nor a continuing calendar-year release
satisfies the unchanged fiscal sentenced-person target. A usable exact fiscal
table/export with counting, confidentiality and revision metadata is still
required for each selection.

`acquisitions.json` records eight original response URLs, actual retrieval
timestamps, HTTP status, byte counts and SHA-256. `sources/` retains minimal
selected original text and 31 workbook cells, including their worksheet names,
coordinates and original value text. Whole HTML bodies, workbook author/contact
properties and unrelated rows stay outside the repository. The original workbook
hash is `a77383b4ec2ea4abca676979a324877823fff3db63537b72c60399676e65f766`.
`manifest.json` binds the retained excerpts and `findings.json`.

Credit: New Zealand Ministry of Justice. Its
[copyright terms](https://www.justice.govt.nz/about-this-site/copyright/)
apply CC BY 4.0 International by default, with the stated exclusions and
no-endorsement condition. These are selected HTML/XML extracts; no individual
records or images are reproduced. The Ministry supplies the Stats NZ court
statistics, so even a separate official presentation would share administrative
lineage rather than independently audit the source records.

Reproduce the retained evidence check without network access:

```sh
python verification/gap-followup-2026-10-20/statsnz-justice/extract-official.py verify
```

The `extract RAW_DIRECTORY` mode independently reads the original downloaded
HTML and XLSX using Python's standard-library HTMLParser, zipfile and ElementTree.
It checks the original acquisition hashes and refuses to overwrite retained
evidence. Neither mode imports or calls the runtime reader.

## Additional permitted Infoshare browse

The ordinary no-key public Infoshare interface was inspected, including its visible “Show discontinued” control. The People and communities branch presented only Property transfer statistics; no exact fiscal justice table or export was available in this bounded inspection. [Sanitized evidence](infoshare-browse.json) preserves final-session acquisition hashes and visible labels, omitting hidden form/session state. Neither fiscal numerical gate is closed; no further route retry is authorized by this finding.
