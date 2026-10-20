# Gap-list continuation — 20 October 2026

This pass follows the user's instruction to continue closing `GAP-LEDGER.md`.
The starting accepted release is PR16, source
`3ae91ac1ce163008f05377acefc27cce488fbbed`, Worker
`ff344629-f392-44ec-b816-92d14f52bd07`. Its merge revision is
`01a9622ccb58e1787d34f3bd272ec58624f0f397`, not its deployed source.

## Accepted NI release and evidence

The exact source `8a25fb62bad7096421ac17f6974b3aa421fe37c3` is deployed as Worker
`34d6966c-0c3f-40dd-8b61-b4a696b09b89`, fingerprint `6a29c7f49e8e2ef3`.
Deployment `08dfc0af-562b-4323-b177-cb02b00e64e8` promoted it to 100% at
`2026-10-20T12:49:33.510284Z`; acceptance was recorded at
`2026-10-20T12:57:38.068942+00:00`. The merge/evidence commit is not the deployed
source. Rollback is the starting SFC/CMHC version identified above.

All 29 staged gates and 29 production gates passed, including all established
contracts, strict 50-check core semantics on each domain, full 18/17 smokes,
NI's 46 requests, five unique reference values/ten domain comparisons, and
26 NI schemas with 16 negative controls. Sampled CPU was 36 ms USA, 236 ms
legacy maximum, 85 ms for the full NI desk, 42 ms claimant and 422 ms rent.
The 100/500 ms validation gates and 1,000 ms Worker ceiling are unchanged.
Of 238 source-state comparisons, 15 were known ONS/TfL changes and none were
unexplained.

The environment reconnect interrupted the first production attempt after
17 completed steps. Its incomplete captures and false interruption record remain
in `release-validation/interrupted-production/`. It was not relabelled passing.
The successful `production/` package comes from the separate r2 run against
the same deployed version; no repeat deployment occurred.

See [release acceptance](release-validation/release-acceptance.json),
[immutable capture package](release-validation/README.md) and
[constructed preservation replay](release-validation/monitor-transition-replay.json).

The new Northern Ireland reader obtains five fixed-edition electricity measures
from a separate official DfE article. The original datavis access failure remains
recorded. The article and retained same-edition report independently agree on
50%, 8,865 / 4,431 / 3,855 / 578 GWh for July 2025–June 2026, published
3 September 2026. These are a renewable/GFEC ratio and four overlapping electricity
balance quantities, not live grid readings or a share of generation.
Future editions fail closed pending review. See the
[pre-code contract](ni-energy-summary/CONTRACT.md),
[actual protected reader proof](ni-energy-summary/README.md) and
[public interface gate](interface-checker/README.md).

Three agriculture cells and one LEED quarterly cell now have exact comparisons
from separate official Infoshare exports. Their extraction is independent of the
production ADE reader; the statistical lineage remains shared. The exports do not
display per-cell status flags. The cumulative checker retains the previous
eleven exact references, for **15 of 23** dated numerical comparisons, and leaves
eight unresolved. See [agriculture/projections](statsnz-agri-projections/README.md),
[LEED](statsnz-income/leed/README.md) and
[cumulative capture validation](statsnz-cumulative/README.md).

Publisher metadata also supports clearer paid-employment and LEED population,
period and limitation fields. The selected dimensions and numeric values are
unchanged. In particular, the paid-employment figure includes wages/salaries
and/or self-employment and is not interchangeable with the wages-only headline.
The two annual LEED numbers and two weekly-income comparisons remain unverified.
See [income evidence](statsnz-income/README.md).

## Remaining evidence and access boundaries

[Justice evidence](statsnz-justice/README.md) does not certify either pinned fiscal
value: later-vintage/all-person counts cannot substitute for the selected adult
cohort. The two projection gaps still require their exact direct total/scenario.
The [NZ prices archive review](nz-prices/archive-route-review.json) obtained no
usable original 17 October Interim archive; Final and later prices remain
ineligible substitutes.

The [held-access review](access-review/README.md) identified the NI article, a
government-hosted CQC PDF and AEMO's separate daily public-price files. The latter
two are investigation routes, not acceptance or activation in this NI candidate.
ONS bedroom rent and AER still lack usable permitted evidence. UK CPI remains
parked and PHW's reuse exclusion remains.

## Operational boundary

Implementation release acceptance is established by the actual results above.
Scheduled-operation acceptance remains pending. Local tests, constructed controls
and protected previews do not establish a scheduled cycle. Original failed
attempts remain alongside their documented fixes.

The latest independently verified durable checkpoint remains sequence 5, run
`39341442350`, completed `2026-10-19T23:26:10.163Z`, with 33 incidents, 36 repairs
and the unchanged pending delivery event. No receipt exists. No collection,
checkpoint write, schedule change or source alert is initiated by this work.
The NI scope has its own actual scheduled start; reviewed intermediate releases
do not create collections or inherit legacy observation days.
