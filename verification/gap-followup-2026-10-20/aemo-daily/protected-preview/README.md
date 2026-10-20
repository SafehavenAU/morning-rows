# Protected actual AEMO daily reader proof

This harness uses temporary authenticated Wrangler remote development. It does
not upload a production version, create infrastructure, deploy routes, alter
monitoring or change credentials. It imports the frozen reader directly. The
wrapper contains no storage or production bindings. The configured OAuth check
is summarized in `authorization-check.json`; private identity, tokens, cookies
and ephemeral preview URLs/headers are not retained.

The predeclared gate is one actual live acquisition: one ordinary publisher
index GET and two ZIP GETs selected from that index, using the real acquisition
clock. All 576 original raw/cent values, both layouts, interval ownership, ZIP
and expanded CSV hashes, and ten summaries must match the independently retained
19 October specimen. A future vintage or failed live read stops the run; there
is no retry, clock pinning, earlier-day substitute or monthly fallback. The
fixed specimen remains the current completed day only until 14:00 UTC on
20 October. The original monthly and daily data share AEMO market lineage.

The other 36 requests send reproducible constructed inputs through the same
reader using injected transport. They make no publisher requests. Cases include
missing/newest or ambiguous discovery, future generation, later request day,
redirect/HTTP406/timeout/body bounds, unsupported geography/dataset/columns,
regional flags/run/intervention, missing/suppressed/excess-precision values,
missing/duplicate intervals, layout disagreement, CRC/multiple-member ZIPs,
declared and actual expansion violations, and both final midnight boundaries.
Rounding cases exercise positive/negative half cents, rounded negative zero and
scientific notation. Regional failures must preserve the entire successful
VIC1 slice; all failures preserve the unrelated sibling source. The wrapper
maps a native all-region error to source error and a partial result to degraded;
this is an isolated integration behavior, not a production desk claim.

`cases.mjs` prepares mutation ZIPs locally, so mutation compression work is not
part of the remote reader. Only input hashes and byte counts are retained for
each request; the exact original fixtures plus generator reproduce them.
`local-controls.json` records the 36 local fixture checks; `evaluator-controls.json`
adds ten adversarial mutations of the resulting capture. Neither is remote
execution. The remote output directory retains exact response bodies, per-case
checks, before/after code hashes and a capture manifest, including failures.

Run only after checking current configured authentication and the specimen day:

```sh
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config node verification/gap-followup-2026-10-20/aemo-daily/protected-preview/check-preview.mjs FRESH_OUTPUT_DIRECTORY
```

Limits tested: 128 KiB index, 512 KiB per compressed ZIP, 2 MiB per expanded CSV,
3,000 records per CSV, and a 20-second abort signal per publisher request. The
actual expanded-byte counts are recorded in provenance. Passing under the
preview's 1,000 ms configured CPU ceiling does not measure CPU consumption or
establish a lower source budget. Wall-clock timestamps are not CPU metrics;
exact staged CPU/resource and both-domain release checks remain separate gates.
No percentile, memory-peak, scheduled operation or seven-day acceptance claim
is made by this harness.

Implementation follows the installed Wrangler 4.151.1 remote-development API
and its `dev --help`, using the established protected proxy-data mechanism.
Only the allowlisted body and public publisher metadata enter evidence. All
requests, success or failure, are retained; a failure is not relabelled passing.

## Retained result

The run at 12:50 UTC on 20 October passed 37 cases / 291 assertions, with 576 exact
original comparisons and ten summaries. `independent-live-comparison.json`
repeats the original ZIP/monthly CSV reconciliation in Python against the
actual capture, not a local parser return. `live-native.derivation.json` binds
the explicit extraction from the retained wrapper. Actual resources total
514,682 compressed ZIP bytes and 2,227,454 expanded CSV bytes, plus 16,059 index
bytes. The limits and acceptance exclusions above remain unchanged.

The exact reused Python comparator output is also retained as
`independent-live-comparison.raw.json`. Its inherited local-only description
is corrected by `annotate-comparison.py`, which binds the actual remote report
and changes no numerical result. Both original and annotated outputs remain.

The completed run and all 38 manifest-bound captures/reports were verified
after the workspace reconnect. The preview had already exited after teardown;
no live source fetch or remote case was repeated.
