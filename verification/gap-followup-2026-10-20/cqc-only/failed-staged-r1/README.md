# Failed CQC-only staged attempt r1

Exact source `79e251cab4314c328e84d9ac4ca7bf5e5408bdbb`, Worker `da1d5c5d-5a50-421b-9862-c3e63fd7e9d6`, stopped at `legacy-cold-cpu` after the actual full-England request consumed **636 ms**, above the unchanged **500 ms** gate. It is a separate failed attempt from the earlier combined candidate's794ms sample.

Three gates passed and the fourth failed; the remaining29of33gates did not run. USA sampled29ms passed its100ms gate. The original legacy report confirms candidate/production identity, unchanged deployment, full event correlation coverage and fresh desk retrieval. Its `events_valid` and `budget_pass` are both false because the resource predicate includes the500ms limit. No failure flag is changed.

The retained deployment proof shows accepted NI Worker34d6966c at100% and this candidate at0% before and after sampling. This is a failed staged resource validation, not a production regression or acceptance. All eight stage-output files and the external runner log are copied byte-identically and individually hash-bound. The manifest's integrity result describes copying only. No repository, deployment, schedule, checkpoint or notification was changed by this packaging.
