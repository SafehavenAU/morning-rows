# Claimant-count history: implementation contract

Written before runtime changes, 20 October 2026 (Australia/Brisbane).
The user asked to keep building following the Workers Paid upgrade. This is a
new bounded implementation from the existing demand queue, separate from the
blocked NZ-PRICES verification task and the parked UK CPI reader.

## Purpose and selection

Answer: “What is the latest published claimant count in this nation, and how
does it compare with the same month a year earlier?” The demand assessment in
`research/project-demand-2026-10-17/README.md` ranks this ahead of rental
benchmarks, completed-day energy summaries and dated FX. It adds a consistent
history to five existing desks through one original publisher, without a new
country desk, key, paid data subscription or infrastructure.

The major correctness risk is a plausible wrong answer caused by confusing
claimants with unemployment, using the wrong nation, a seasonally adjusted
headline, a rate, a different age group, or incomplete history. Those risks
define the checks below. Local-authority examples in the historical research
are outside this implementation.

## Exact statistical contract

Publisher: ONS / Nomis dataset `NM_162_1`, mnemonic `UCJSA`, “Claimant count by
sex and age”. Fixed dimensions: `gender=0` (Total), `age=0` (All categories:
Age 16+), `measure=1` (Claimant count), `measures=20100` (Value).

| Desk | Publisher geography | Exact name |
|---|---|---|
| united-kingdom | K02000001 | United Kingdom |
| england | E92000001 | England |
| scotland | S92000003 | Scotland |
| wales | W92000004 | Wales |
| northern-ireland | N92000002 | Northern Ireland |

Administrative stock of Jobseeker's Allowance and the relevant Universal Credit
claimants, all sexes, age16+, under the publisher's eligibility definition.
Unit: persons, rounded to the nearest five. Not seasonally adjusted. It is not
an ILO unemployment estimate, claimant rate or estimate of available recruits.
Retain policy, eligibility, classification and overlap limitations.

The source supplies monthly reference-date observations. The period identifier
is the publisher's `YYYY-MM`, not the retrieval date, a monthly sum or mean.
Require the latest thirteen consecutive published calendar months for every
geography, exactly65 unique cells in the bounded acquisition. The initial
official-page check still identifies August2026 as the latest release
(reference13August, release15September); the scheduled20October release is not
treated as observed before it appears. A later release requires a newly dated
specimen and reconciliation before final release acceptance.

Previous months can be revised; methodological revisions can reach further
back. Keep publisher dataset-update metadata, retrieval time, source URLs and
content hashes separately. A current fetch is not independent verification, a
new release is not inferred from today's date, and old values cannot substitute
silently for a failed latest read.

Numeric output requires `OBS_CONF=F`, `OBS_STATUS=A`, the exact dimension codes
and labels, nonnegative safe integer counts divisible by five, and unique
geography/month identifiers. Missing, suppressed, unknown-status, malformed or
partial data invalidates this source response; never convert it to zero.
Explicit published zero remains a rounded observed zero.

Reuse: ONS Crown copyright / Open Government Licence with attribution and source
links; retain only the minimal aggregate specimen and supporting metadata.
Independent NISRA comparison is also subject to its Crown copyright/OGL terms.

## Interface and isolation

Add `claimant_count` to the five existing desks, with one described measure
`claimants`. A source or measure selection returns all thirteen calendar slots;
an exact observation selector returns only that month or explicitly refuses an
unretained month. Do not accept a geography/date query that is silently ignored.
Each observation has its actual nation, definition, unit, adjustment, period,
licence, source and content version. Preserve monthly history in measure-only
data, without selecting an arbitrary first row.

Failures stay within the new source and preserve successful sibling sources.
Bound response bytes and HTTP runtime. Cache only within an explicit short
lifetime and retain original retrieval metadata; no indefinite stale fallback,
database, proxy substitute or credential is introduced. Preserve nine-desk v2
discovery and the existing eight-desk v1 contracts.

## Falsifiable acceptance

1. Structural: exactly five allowed geographies × thirteen contiguous periods,
   complete reported record count, no duplicates, exact fixed dimensions and
   known flags. Reject wrong dataset/geography/age/sex/measure/units, truncated
   payloads, blank values, missing months and suppressed-to-zero mutations.
2. Numerical: independently extract all65 cells with Python CSV/Decimal and
   reconcile the actual JavaScript reader exactly. Compare the separately
   acquired official JSON representation and a dated official NISRA table for
   matched NI cells. Require exact rounded-cell equality; a UK/four-nation
   aggregate comparison permits at most12.5persons from separate rounding.
   Explain shared administrative/statistical lineage and the coverage of the
   independent presentation; do not claim an independent population enumeration.
3. Semantic: every returned row preserves the exact nation and definition,
   latest-window endpoints, NSA status and missingness. Check earliest/latest,
   prior-year and exact-month requests, revision version changes, wrong
   geography, duplicate periods and silent older-release substitution.
4. Runtime: original-publisher retrieval must pass in actual Cloudflare
   execution with the real reader. Exercise transport/parse/partial-coverage
   failure and successful siblings in the runtime. No fixture success substitutes
   for the live-source gate. No new binding or infrastructure.
5. Capacity: retain the1,000ms whole-Worker safety ceiling. The final affected
   cold desk checks must each remain at or below500ms; repeat one fresh
   claimant acquisition to detect a cache-only pass. Preserve the existing
   USA100ms gate in final CPU checking. Match traces to exact version, route and
   time; wall time is not CPU.
6. Release: promote only an exact clean validated version through existing
   versioned Wrangler flow. Check both domains, all nine desks, StatsNZ23,
   AIHW40, Wales projection, NISRA4, NZ prices and the USA13-slot contract.
   Diagnose unexpected regressions before acceptance; retain initial failures.
7. Monitoring: stage the five new obligations until an explicit reviewed
   release activates them. Keep the daily collector's24public requests and
   hourly watchdog schedule, disabled source alerts, pending outbox and all
   incidents/repairs. Preserve the pending sequence5→USA reviewed bridge when
   adding this release; never manufacture an intermediate collection or start
   scheduled observation from a release/replay. Prove the composed transition
   offline, then leave the real write to the next normal serialized run.

The evidence record must retain source URLs, acquisition timestamps/hashes,
publisher mappings, independent comparisons, mutation/failure tests, actual
Cloudflare evidence, release identity and unresolved limitations. No new reader
release closes NZ-PRICES, UK CPI, delivery-receipt or seven-day SHADOW gates.
