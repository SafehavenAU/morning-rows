# LEED evidence follow-up — 20 October 2026

**One of three exact numerical comparisons is now established.** The separate
official Infoshare CSV reports **18,100 dollars for 2025 Q2** in `LED005AA`,
Total All Sexes / Total All Ages / Median Earnings – All. This exactly matches
the retained `LEED_Q1W_001` `.A3Z.MEDIAN_EARN` observation for `202506`, with zero
numerical tolerance. The annual count **4,091,334** and annual median earnings
**57,610** remain without a usable separate numerical export.

This is evidence work only. It changes no reader, operational approval,
deployment, credential, monitoring state or acceptance of future observations.
The quarterly export explicitly does not display status flags, so the numerical
match does not certify final/provisional/revised status. The report distinguishes
that remaining limit from the completed numerical comparison.

## Reproduce the retained comparison

From the repository root:

```sh
python3 verification/gap-followup-2026-10-20/statsnz-income/leed/verify-retained.py
```

The verifier uses Python's standard CSV and HTML parsers, with no runtime reader
imports or network calls. It passes **25 original-metadata checks, seven quarterly
comparison checks and 15 negative controls**. Controls refuse a wrong period,
value, sex, age, measure, units/magnitude, table or update vintage, as well as
suppressed/missing/blank data treated as a number. Reader-side period, geography
and units must match. Retained original lines remain byte-identical.

`report.json` contains the exact crosswalk and per-target outcome.
`pinned-reader-targets.json` identifies the previously retained reader capture
and its hash; it is a comparison target, not independent evidence.
`manifest.json` binds this directory's retained files. HTTP body hashes in the
minimized JSON metadata records bind the acquired full bodies; they do not
pretend that those full pages are retained.

## Quarterly scope and dated evidence

The [official Infoshare service](https://infoshare.stats.govt.nz/) was accessed
through its ordinary visible public form: Work income and spending → Linked
Employer-Employee Dataset → Sex and Age → the selected four labels.
`ui-acquisitions.json` records all five successful requests. Session data,
cookies, hidden fields and query identifiers were not retained. The visible
table-label transcript is explicitly labeled as an execution-output transcript,
not complete original HTML.

The full wire export was 619 bytes, acquired at
**2026-10-20T12:18:29.838523+00:00**, SHA-256
`77d1c5e9b3f37d44a86b76717b0d5c05c47afba79f9337e837f19700c784e3a4`.
The repository retains only its **521-byte original-line excerpt** in
`original/quarter-full-jobs-2025Q2.csv`, SHA-256
`6f55fecfedd91ca5d371294c22a7018beffe01aff51b47c70a1ddac0c0cba2ad`.
Original lines 1–28 are byte-identical, through the publisher attribution; only
the subsequent contact footer and trailing blank lines are omitted.
`original/quarter-export-excerpt.json` distinguishes wire and excerpt hashes.
The irrelevant migration/contact block is likewise omitted from the release
JSON excerpt while preserving its original full-response acquisition hash.
Its update stamp is **25 August 2026, 10:45am**, without a stated timezone. That
matches the publisher-local date/time of the
[June 2025 quarter release](https://www.stats.govt.nz/information-releases/linked-employer-employee-data-june-2025-quarter/);
neither stamp is converted into an invented UTC publication instant.

The [quarterly technical notes](https://www.stats.govt.nz/methods/leed-quarterly-technical-notes/)
establish the interpretation:

- A full-quarter job is an employer–employee pair continuous throughout the
  quarter. The selected measure covers all full-quarter jobs, not only continuing
  jobs or new hires, and does not represent a median across individual people.
- Jobs ordinarily involve people aged 15 or over, PAYE deducted at source and a
  valid IRD identifier. Social-assistance payments are excluded. A small number
  of working proprietors paying tax at source cannot be separated.
- The quarter is 1 April–30 June 2025. Earnings are gross and include lump sums.
  The selected all-age/all-sex national table has no regional restriction.
- Earnings are confidentiality-rounded to base 10 or 100. The exact match is to
  the published rounded integer, not to an unrounded underlying median.
- The quarterly revision policy allows two subsequent quarters of revision and
  describes finality at 18 months. The export displays no observation status:
  neither this policy nor empty reader attributes establishes this cell's flag.

Infoshare CSV and ADE provide separate official presentations, and this
extraction is independent of the runtime reader. Both still share Stats NZ's
LEED administrative statistical lineage; this is not an independently measured
second statistic.

## Annual findings and remaining requirements

The [March 2024 year release](https://www.stats.govt.nz/information-releases/linked-employer-employee-data-march-2024-year/)
is dated 1 December 2025. Its acquired body does not expose either exact annual
target. The [2025 annual technical notes](https://www.stats.govt.nz/methods/leed-annual-technical-notes/)
provide useful semantic evidence, retained in
`original/annual-methods-canonical.json`:

| Target | Established metadata | Remaining numerical evidence |
| --- | --- | --- |
| `LEED_AP1_001`, 2024, 4,091,334 people | Tax year 1 April 2023–31 March 2024; unique IRD person, aged 15+ at the start of the tax year, with nonzero covered income and valid identifier. Covered taxable sources include employment, self-employment and specified transfers; this is not every possible income source or all residents. | Exact dated Table 1.1 / selected `.IZ.AZ.XZ.RZ` export, including status/revision vintage. |
| `LEED_AP1_002`, 2024, NZD 57,610 | Median annual total earnings: wages/salaries plus self-employment across jobs; gross earnings, including negative self-employment. It must not be relabeled as all taxable income, wages alone or earnings of full-year workers. | Exact dated Table 1.2 / selected `.IZ.AZ.XZ.RZ` export, including status/revision vintage. |

The notes distinguish these annual populations from the quarterly job measure.
They describe suppression of median cells below the stated count threshold,
rounding that can prevent totals adding, and the latest annual year remaining
provisional for one year until the next release. **Empty reader attributes do not
mean final.** The 2024 reference-year value is not substituted with a newer
release or a rounded headline.

The public CSV-download index yielded no LEED download. The bounded ordinary
Infoshare LED visit exposed 21 quarterly tables and no usable annual selection.
That is not a claim that an annual public export cannot exist elsewhere.
An exact, dated, permitted annual export remains the concrete requirement; no
credential or publisher registration is needed or requested by this task.

## Access history, reuse and limits

The first plain request to the Infoshare landing page returned HTTP 403 at
12:10:27 UTC. It is retained in `original/infoshare-landing.json`. A later
authorized ordinary public-form session using a transparent project user agent
and standard cookies succeeded. The reason for the difference is unknown;
there was no proxy, credential, bypass or retry of the denied ADE endpoint.

Selected original Stats NZ metadata and the minimal CSV excerpt are retained with Stats
NZ attribution under the site's stated Creative Commons Attribution 4.0 terms.
Public discovery-only files, including one guessed technical-note URL returning
404, remain part of the access history; the actual canonical annual notes are
the 200 response used in the verification. No discovery response is substituted
for a numerical reference.
