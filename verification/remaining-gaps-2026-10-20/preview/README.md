# Protected actual-reader proof

The eligible source boundary is **SFC college activity and CMHC rental
benchmark only**, seven exact cells. See `accepted-reader-proof.json`, produced
by `combine-proof.mjs` from genuine retained captures without new HTTP. It binds
the exact reader/dependency hashes, actual UTC completion clocks, public input
provenance and independent-reference hashes. It does not claim integrated
deployment, CPU or monitoring acceptance.

The first protected Cloudflare remote-dev capture, `cloudflare-reader-live.json`,
ran from 10:12:10 to 10:12:12 UTC on 20 October 2026. CMHC passed its two exact
2025 cells (Victoria CMA 2,121 and Victoriaville CA 991 CAD/month). ONS returned
429. The SFC and CQC invocations failed before publisher HTTP because Workerd
does not support the standard Fetch `redirect: "error"` option. Their initial
code and harness bytes are preserved under `initial-inputs/`, with hashes bound
to that failed capture.

`check-request-options.mjs` reproduced that constructor error locally in installed
Workerd without any publisher HTTP; `request-options-workerd.json` retains the
result. The correction uses `manual` and existing status/final-URL refusal
guards. The workbook-only corrected capture, `cloudflare-workbooks-live.json`,
ran from 10:15:25 to 10:15:29 UTC. SFC passed all five FTE cells and the exact
original workbook digest. CQC returned 403 on its first actual publisher
attempt. CMHC and ONS were not invoked again.

The NI owner separately retained one actual reader failure and one bounded
diagnostic: its endpoint returned a 247-byte HTTP 200 page titled `Request
Rejected`, not the official report. Those records remain at
`../ni-energy/cloudflare-reader-live.json` and
`../ni-energy/cloudflare-report-diagnostic.json`. This harness did not request NI.

ONS, CQC and NI activation remains blocked. None of their local fixtures,
independent numerical comparisons or passing parser tests substitutes for the
missing actual Worker access evidence. No additional publisher attempts are
authorized for this proof.

Each live capture used actual module code with actual clock, source-level
isolation and a deliberate harness-only failed sibling. Each source has separate
start/completion times, because the existing `readSections.fetched_at` records
invocation start. The strict native validators use captured completion, avoiding
a false future-provenance result. Production integration must provide an actual
completion clock too.

Remote dev was protected with Wrangler's session mechanism, bound to localhost
for orchestration, and had no production routes, secrets, storage bindings,
cron or deployment. Private preview URLs and session headers were passed only
through process stdin and were not retained. Current CLI help, installed Workerd
behavior and the [Cloudflare Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/)
informed the compatibility correction.

Wall duration is recorded but is not billed CPU. The final integrated version
must still meet the root-owned CPU, interface/schema, both-domain, source
regression, release and checkpoint-transition gates. No scheduled evidence,
receipt, publisher assent or incident reset is manufactured here.

The subsequent CMHC validator correction requires all acquisition records to be
no later than public source completion. The unchanged historical actual CMHC
native passes that final validator offline;
`cmhc-final-validator-offline-recheck.json` binds the original capture hash and
final validator hash `4d5b744fd1ea89e9b56d8b7e5afbc5f9f0a62951910534ca71b38ccb7e7f24b9`.
This is not a new reader execution. The original live captures and
`accepted-reader-proof.json` remain unchanged and bind the earlier executed
module. Fresh exact-candidate stage and production evidence must bind the final
implementation before release acceptance.

Offline reproduction:

```sh
node verification/remaining-gaps-2026-10-20/preview/check-live.mjs --validate-reference
node verification/remaining-gaps-2026-10-20/preview/check-request-options.mjs
```

`check-live.mjs` without the validation option performs genuine remote reads;
do not rerun it as routine verification. The original two capture files are
immutable, and the runner refuses to overwrite an existing output.

`combine-proof.mjs` is the historical join procedure. It checks exact executed
code hashes and intentionally refuses the later CMHC validator revision; do not
rerun it to overwrite or reinterpret the historical joined proof.
