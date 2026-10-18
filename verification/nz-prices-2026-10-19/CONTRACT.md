# Current NZ price verification — 19 October 2026 Brisbane

Task: `scheduled-cycle-and-one-verification-gap-2026-10-18`.
Phase: publisher verification; selected contract: `NZ-PRICES` only.

The user explicitly said “go now” after being told implementation was waiting
for scheduled proof. This authorizes starting this verification phase now; it
does not satisfy or waive scheduled-cycle, delivery-receipt or seven-day gates.
No collector dispatch, schedule change or checkpoint mutation is part of this work.

## Selection before implementation

1. NZ prices: daily decision exposure, plausible wrong day/status/half-hour or
   partial coverage, current-day independent comparison unresolved. Bounded to
   five existing nodes and one completed trading day; original and separately
   presented official sources already identified. Selected.
2. Stats NZ: substantial semantic risk across 23 heterogeneous series; no fresh
   independent all-series extraction. Requires a separate bounded selection and
   original metadata review; not added to this task.
3. AIHW/Wales/NISRA: serious semantic risks but retained separate publisher
   comparisons already exist. Lower unresolved evidence risk for this pass.
UK CPI remains parked under its existing access-review conditions.

## Falsifiable contract

Retain the existing `verification/nz-prices-2026-10-17/CONTRACT.md` semantics:
wholesale nodal energy price, NZD/MWh, no seasonal or population adjustment;
exactly OTA2201, HAY2201, ISL2201, BEN2201 and INV2201, points of connection,
not national or household prices. Select the newest listed completed
Pacific/Auckland trading date, final over interim for that same date. Date
selection is fixed at acquisition time, not at replay time. Final half-hour of
the day is the published answer; validate every half-hour (46/48/50 with DST).
Expected latest completed day at the start of this investigation: 18 October
2026, 48 periods, final interval 10:30–11:00 UTC. This is an expectation to test,
not permission to fabricate an unlisted release or substitute an older one.

Original source: EMI FinalEnergyPrices directory and selected CSV. Columns:
TradingDate, TradingPeriod, PointOfConnection, DollarsPerMegawattHour. Separate
presentation: official CLA3WR report, exact date and POC per query. Compare
Decimal values exactly (zero numerical tolerance), complete node/period keys,
date and explicit price status. Prices are not additive; component totals do
not apply. Zero and negative prices are valid. Missing, blank, suppressed,
unavailable and failed retrieval must never become zero or an older answer.
Unknown price markers fail the bounded section.

Daily publication, possible interim revisions and finalisation follow publisher
metadata. File status, not age, determines finality. Capture retrieval time and
verification time separately; do not invent a publication timestamp. Reuse:
CC BY 4.0, attributed to Electricity Authority (New Zealand), EMI; retain only
necessary public aggregate rows/table cells and metadata, with hashes.

## Acceptance and stopping rules

- Retain original necessary CSV rows and independently presented official table
  cells for the selected date, with exact URLs, acquisition times and hashes.
- Separate Python CSV/HTML extraction (no import of production reader) agrees
  on every required node-period and status. Explain shared publisher lineage.
- Actual JavaScript reader agrees on all five terminal observations and their
  semantic fields, in Cloudflare preview if any reader repair is necessary.
- Tests detect wrong date/node/units, missing or duplicate interior/final cells,
  suppression-to-zero, incomplete coverage, older-file substitution and status
  or value revisions. Existing production reader tests remain relevant.
- Compare both production NZ responses to the selected publisher evidence;
  qualify any intervening release/revision rather than silently rebasing.
- If no reader correction is required, retain evidence and update the handoff
  and acceptance ledger only. If a correction is required, preview it and use
  the established reviewed versioned release with both-domain/eight-desk/core
  regressions. Never promote on local tests alone.
- Bounded access attempts only. If original or separate presentation cannot be
  obtained through permitted workspace and protected preview access, record
  the exact remaining gap as blocked; do not claim numerical reconciliation,
  keep retrying indefinitely, add alternate sources or expand to another task.

Scheduled proof, delivery acknowledgment, seven-day SHADOW acceptance and CPI
access remain separate unresolved gates regardless of this contract's outcome.
