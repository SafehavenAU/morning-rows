# Stats NZ verification pass — 20 October 2026

This pass is authorized by the user's request to work through the existing gap
ledger. It does not alter publisher credentials, monitoring state, schedules or
release acceptance. Runtime code is outside this evidence worker's ownership.

## Exact comparison boundary

The target is the 23 fixed selections in `lib/stats-nz-series.js`. The retained
accepted GDP-release NZ response supplies comparison targets, not independent
evidence. `reader-targets.json` binds that response's original path and SHA-256.
For each series, compare the exact source ID, dimension codes, geography,
population, period, unit/scalar, adjustment and revision vintage. A later
publisher value must not certify the retained target. Raw missing/suppression
markers are not numeric zero. Annual unchanged values remain valid.

The first bounded selection is `INC_INC_011`, key
`.98.98.MED_INC_ALL_SOUR`, dimensions `LGR=98`, `HHTYPE=98`,
`MEASURE=MED_INC_ALL_SOUR`. The target is period `202606`, value `2438`,
NZD per week. The candidate interpretation is median weekly household income
from sources collected in the annual June-quarter HLFS income supplement.
The initial gross-income hypothesis is not accepted evidence: exact household
aggregation and tax basis must be checked separately. The precise household
population, exclusions and timing must be established from official metadata. The selected period is not permission to multiply by 52 or describe
the observation as annual income. No seasonal or inflation adjustment may be
invented.

## Evidence and acceptance

- Acquire original permitted public Stats NZ metadata, selected data exports
  and dated official publications. No key discovery, credential inspection,
  registration, publisher contact or secret changes.
- Extract with a separate Python method, without importing the runtime reader.
  Retain minimal relevant original fragments/data, acquisition time, whole
  response hash, excerpt hash, source URL and publication/version time where
  the publisher actually provides it.
- Exact numbers must match exact cells and the same statistical definition.
  A rounded official headline only supports agreement at its published
  precision; it cannot certify extra digits in a target.
- Separate schema/metadata qualification from numerical reconciliation.
  A supported metadata correction can be recommended even if the target's
  independent numeric cell remains unavailable. A third-party republication
  or agreement between two Morning Rows responses is not the required
  independent official presentation.
- State statistical lineage explicitly. Independent extraction or a separately
  presented official table still shares the publisher's survey/administrative
  lineage and does not independently recompute the estimate.
- Assess all 23 rows individually. A row passes the numerical/semantic gate only
  with exact dated official evidence and satisfied dimensions/coverage. Otherwise
  retain a precise blocker, such as no public original export, an unavailable
  exact presentation, an unmatched vintage or only rounded headline evidence.
- Recommended fixes must include controls for wrong household population,
  individual versus household income, quarter snapshot versus annual total,
  gross versus disposable income, mean versus median, suppression-to-zero and
  later-release substitution.

## NZ-PRICES boundary

The selected 17 October 2026 interim specimen remains fixed. Resume its separate
contract only if a usable dated official CLA3WR report/export for the exact five
nodes and 48 periods can be obtained. A different date, a later final revision,
the same original CSV alone or a third-party graph does not complete this gate.
No routine repeat release, live-site sweep or preview retry is authorized here.

Completing this audit does not mean all 23 series or NZ-PRICES are independently
verified. Scheduled observations, seven-day acceptance and actual delivery
acknowledgment remain separate gates.
