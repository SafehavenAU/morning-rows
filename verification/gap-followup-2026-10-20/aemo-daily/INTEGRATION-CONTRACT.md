# Candidate integration amendment — 20 October 2026

Written before integrating the frozen daily-bundle reader. Root authorized these
changes only in the isolated AEMO candidate worktree; production activation still
requires protected-reader, staged and both-domain exact-release acceptance.
The reader SHA256 is `151a0eba192cac883a5f156fbafad077bfe3e8d989d78dfc6a1fb1fcbb15c4a6`.

Add only `australia/grid_day` within the existing Australia desk and its
`/morning.json` alias. Preserve the five-region `grid` snapshot and every existing
source, the accepted NI article route, nine-desk scope and all monitoring state.
The catalogue describes ten explicit derived IDs (`SA1`/`VIC1` × `mean`, `minimum`,
`maximum`, `negative_count`, `zero_count`) and exact YYYY-MM-DD observations.
Source selection returns native data; measure or exact-date selection returns
one typed summary row. Observation native pointers resolve to the numeric native
summary field, not an invented row offset. Only the current successfully retained
calendar day is selectable. Invalid dates are400; valid unretained dates404;
unknown IDs404; failed requested region503; missing or old representations503.
No arbitrary date/geography filtering or fallback to older days is introduced.

Public adapters validate the frozen reader with an explicit current request UTC
clock, enforce native/source-health consistency, and retain actual acquisition
completion clocks in source health. Healthy source selections expose ten rows.
A degraded source exposes only the five complete healthy-region rows plus five
explicit unavailable-measure records without observation IDs or zero values.
A failed regional selection exposes no observations; a healthy sibling remains
selectable. Both failed regions are source failure. Raw prices, rounding and run/
flag/layout semantics stay attached; no TRADE or FIRM source field is created.

Observation versions include the exact typed statistic and statistical contract;
acquisition provenance alone is excluded, while full context retains it. A raw
interval change changes source content even if one rounded statistic is unchanged.
A price revision cannot revise an unchanged sibling statistic just because the
reader acquired it again. Schema supplements native semantic validation with
strict identity/geography/units/current-period shapes, complete interval coverage,
observed values and separate explicit failures. Arithmetic and cross-field date
relationships remain the reader/independent verifier's responsibility.

All Australia paths and selected responses expire at fixed-AEST midnight
(14:00 UTC). Cache hits need the exact current boundary marker and retained
expiry; external Cache-Control extensions cannot override it. A full-desk request
may outlast the AEMO reader: recheck at desk completion and final response finish,
withhold old daily data and use no-store across rollover, preserving unrelated
successful sources. A cached prior-day source never qualifies as current after
midnight. HEAD/ETag/canonical identities retain existing semantics and cannot
return stale daily data through304 after the boundary.

Independent integration controls must cover native/source/measure/exact results,
ten pointer identities and schema, healthy/degraded/failure states, current-day
refusal, shared three upstream requests, original grid preservation, cache miss/
hit/expiry/forged-extension/missing-marker/alias, final-boundary crossing and
unrelated-source isolation. No monitoring/operations files, credentials, live
collectors, schedules, release IDs, delivery receipts or alerts are changed here.
