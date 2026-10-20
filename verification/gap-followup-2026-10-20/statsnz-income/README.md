# Stats NZ income and LEED follow-up — 20 October 2026

The income investigation resolves a misleading comparison, while both income
numeric checks remain open. `INC_INC_001` is **paid-employment earnings**, which
includes wage/salary work and/or self-employment. The separate 1,419 wage/salary
headline cannot replace or disprove the retained 1,391 value. There is no
independent exact 202606 income cell here, and no claim that all 23 Stats NZ
selections are verified.

The [LEED record](leed/README.md) separately compares the original public
Infoshare quarterly CSV with the retained 18,100 full-quarter-job earnings cell.
Its two annual cells remain numerical evidence gaps. That result and its
rounding/revision limitations are owned by [leed/report.json](leed/report.json).

## The two income cells

| Selection | Result | Remaining evidence |
|---|---|---|
| INC_INC_001, 202606, 1,391 NZD/week | Original dataflow title and current official concept resolve the paid-employment population. Numerical gate remains open. | Dated exact total-ethnicity/region/sex/age `MED_WEEK_INC` export or separate official presentation, with revision/vintage information. |
| INC_INC_011, 202606, 2,438 NZD/week | Original dataflow binds household income and exact dimensions. Prior household exclusions and June-quarter snapshot qualification remain. Numerical gate remains open. | Dated exact total-region/household-type `MED_INC_ALL_SOUR` cell; household aggregation, tax basis and revision/vintage metadata. |

The original [INC001 structure](original/INC_INC_001-structure.json) names
“Earnings for people in paid employment by region, sex, age groups and ethnic
groups”. Stats NZ's [paid-employment concept](https://datainfoplus.stats.govt.nz/item/nz.govt.stats/ef78dffe-06f3-432e-99d3-8bff1897e26d)
explicitly includes self-employment and is linked to its June 2026 income study.
Its [wages-and-salaries concept](https://datainfoplus.stats.govt.nz/item/example.org/82d98c2a-3310-4362-870e-9c9f71af8833)
is remuneration paid to employees. These are different statistical populations.
The initial main-job-only hypothesis in the contract was not supported and was
rejected; nearby INC002/004 tables cannot establish INC001's meaning.

The root implementation updates INC001's name, population, period convention
and limitation using this evidence. It retains the value and selected dimensions.
The HLFS frame is non-institutionalised people aged 15+ who usually live in
New Zealand. The collection is a June-quarter weekly snapshot; self-employment
questions cover the preceding 12 months. Multiplication by 52 would not make it
an annual earnings estimate. The household row must also retain its distinct
population: households with all members outside ages 18–64 are excluded.
No new household gross/net claim is supported by an individual-income headline.

## New permitted routes examined

- The public ADE Income landing page returned 403/error1010 once. Direct
  DataInfo+ requests also returned 403/error1010. These outcomes remain in
  [direct-access-boundaries.json](original/direct-access-boundaries.json), and
  were not retried or relabelled success.
- The browser tool had already supplied official DataInfo+ page renderings.
  Minimal exact lines and source URLs are retained in `*-browser.json` with the
  explicit limitation that original HTTP body hashes and fetch times are not
  available. Those excerpts support metadata, not numeric comparison.
- After another evidence worker demonstrated the documented public Infoshare
  interface working, one bounded ordinary form-navigation sequence used a
  truthful project User-Agent and fresh public session. It found 192 HLF table
  entries, none titled income, earnings, wages, salary or median. The separate
  `income` search submission timed out after 30 seconds; no retry followed and
  no exhaustive catalogue-absence claim is made. This is an unsuccessful
  search attempt, not a diagnosed publisher outage. Session paths, cookies and
  hidden form values are not retained.
- The official CSV index linked the June 2026 labour-market ZIP. Its original
  SHA-256, member list and independent streaming inspection are retained.
  All 1,511,151 rows of the combined member were inspected: subjects are
  HLF/QES/LCI, and no median-weekly, household-income or paid-employment title
  matched. This is the ordinary quarterly export, not the separately published
  annual income supplement. Its 18.6 MB ZIP and more than 700 MB uncompressed
  files are omitted because they supply no accepted income cell.

## Reproduction and limits

Run the offline evidence check from the repository root:

```sh
python verification/gap-followup-2026-10-20/statsnz-income/verify-income-evidence.py
python verification/gap-followup-2026-10-20/statsnz-income/leed/verify-retained.py
```

`extract-retained-structure.py` re-extracts the exact title/selected codelist
fragments from the prior original SDMX response wrappers. Their publisher
`Prepared` timestamps are retained separately from unknown retrieval times;
no URL or acquisition date is invented. `inspect-labour-export.py` reproduces
the ZIP inspection offline against its exact hash. Prior publication/metadata
files are referenced and hash-bound, rather than fetched or copied again.

All evidence retains Stats NZ's survey/administrative lineage. Independent
extraction and presentation do not independently re-estimate statistics.
No credential access, registration, publisher contact, runtime fetch change,
checkpoint write, observation approval or release acceptance occurs in this
folder. An observed match certifies only its exact dated reference cell; future
vintages and genuine scheduled operation remain separate requirements.
