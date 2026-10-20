# Constructed GDP release-replay controls

Run from the repository root:

```sh
node verification/statcan-gdp-2026-10-20/replay-helper-controls.mjs
```

The command prints the compact result retained in `replay-helper-controls.json`.
It makes no network requests and changes no active review, approval, checkpoint,
schedule or notification. Temporary constructed inputs are removed after a
successful check. An optional fixture-root argument permits checking the same
retained rent evidence before a worktree contains the completed rent merge.

`replay-prior-rent-review.json` and `replay-prior-rent-approvals.json` are exact
copies of the accepted three-edge rent configuration. Their byte hashes are
pinned in the helper and result report. The controls never read active
`operations` files, so appending the actual fourth release edge cannot alter
this historical test.

The generator combines retained accepted rent-production desk responses with
GDP parsed from the original publisher specimens. It supplies an explicitly
constructed clean identity and proposed GDP approval in a temporary directory.
This establishes helper behavior only, not an actual candidate or release.
The report lists every required fixture reference.

The positive case checks one sequence increment from the exact audited
sequence-5 checkpoint, plus hypothetical already-USA, already-claimant and
already-rent prefixes. It preserves all 33 incidents, 36 repairs, pending
delivery event, prior run history and original shadow start. Only GDP gains its
new described contract; the other 107 existing source states are unchanged.
No expanded-scope scheduled start is invented.

Negative controls reject a broken fourth-edge predecessor, replacement of an
unrelated prior approval, an unreconciled GDP observation and overwriting an
existing evidence output.

For a later proof using actual accepted captures, use:

```sh
node scripts/replay-gdp-release.mjs \
  CHECKPOINT OLD_REPORT PRIOR_REVIEW PRIOR_APPROVALS REVIEW APPROVALS \
  CAPTURE_DIRECTORY EXPECTED_CLAIMANT_LATEST NEW_OUTPUT \
  [CAPTURED_AT_ISO]
```

The capture directory contains `_health.json.response` and full desk bodies
named `_<desk>.json.response`. The fourth exact review and approval must match
the accepted GDP capture. The first three edges and all 14 prior approvals must
match the pinned rent-era files. A new publisher vintage, additional actual
checkpoint or changed prior approval requires explicit review; the helper
refuses to silently substitute it.
