# USA CPI paid-plan validation — 20 October 2026

Status: **released and validated on both domains**. This completes the USA reader
release gates; sustained operation and the broader maintenance plan remain open.

The user confirmed “worker upgraded”. Cloudflare accepted the explicit1,000ms
whole-Worker limit and returned it in version metadata. Standard usage and existing
bindings were read; subscription access returns403, so no invoice/billing claim is
made. [The contract](CONTRACT.md) preceded upload and requires a separate100ms USA
gate, three fresh captures, legacy headroom and final release checks.

Released source: `c6a96283743476af730dc2ff4bd915463e47d03c`.
Worker: `e0224d26-6bcb-4f96-a580-460919a0d195`.
Clean build fingerprint: `42edef0b385e972f`.
Approved rollback Worker: `739b9031-305c-4bc7-afc5-79a82c654ac7`.
Only the simpler original table/index reader is used. No rejected optimization is
restored, no embedded observations, API/proxy fallback or new credential is added.

## CPU and exception evidence

| Capture | Source | Cold USA CPU | Result |
|---|---|---:|---|
| First successful post-expiry |4c7d025|23ms|Fresh original retrieval;100ms gate passed|
| Second clean cache key |c83c9d6|12ms|Fresh original retrieval;100ms gate passed|
| Final candidate |c6a9628|13ms|Fresh original retrieval;100ms gate passed|

Each successful capture has exact version/path/time-correlated traces, clean
candidate identity, unchanged0% staging and matching approved production before
and after. Each has a unique revision/fingerprint cache key. These bounded samples
are not percentiles or a global capacity guarantee. All16 prior Free failures
remain unchanged, and no Paid result reclassifies a Free result.

The first request returned BLS503. An early follow-up returned the identical cached
error timestamp and is explicitly not independent confirmation. One post-expiry
confirmation succeeded. Both failure records are retained. The transient publisher
failure did not expose USA to normal traffic and did not lead to a reader change.
An initial dirty upload was discarded before staging/probes; see upload-preflight.

The final legacy sweep records CPU132/292/25/23/77/122/72/53ms for Australia,
New Zealand, Canada, UK, England, Scotland, Wales and Northern Ireland respectively.
All traces/status/identities pass; its original freshness evaluation falsely
required `also.sources` whenever `also` exists. Australia/NZ legitimately expose
other `also` data without a source-health map. The original report is retained;
the corrected evaluator checks top-level sources and `also.sources` when present.
The separately labelled reevaluation passes all 108 source-health entries and
the 500 ms legacy gate. Four focused evaluator regressions pass. No network
sample was fabricated or retaken to hide this verifier defect.

## Data and interface evidence

187 Node tests, the dry-run build,20 independent Python tests,315 legacy cases,
eight US interface cases,221 schema-valid responses and three negative schema
cases pass. The actual protected integration preview passes22 live/fault cases.
Separate Python HTMLParser and ZIP/XML/Decimal methods reconcile13 exact slots;
all three actual staged captures agree with that reference. Fresh minimal official
table excerpts preserve dimensions, two year rows, monthly columns and footnotes.
Original bytes/hash and selection are retained in fresh-table-provenance.json.

All-items CPI-U, U.S. city average, all urban consumers, NSA,1982–84=100; September
2025–September2026 calendar slots include October2025 as unavailable, not zero.
September2026 is336.940; August334.980; September2025 is324.800. The official
presentations share BLS statistical lineage; separate extraction does not make
an independent statistical estimate. Retrieval and verification times are retained
separately from the existing release metadata.

## Monitoring boundary

The latest independently verified checkpoint remains sequence5 from scheduled
run39341442350, artifact12229261618, digest
665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f.
It has33 incidents,36 repairs and the unchanged pending delivery-test event.
The GitHub runs collection was reread during release preparation and showed no
newer monitor execution. No actual checkpoint is written by this implementation.

The exact reviewed identity transition is enabled after both-domain acceptance.
Its offline replay preserves all incidents, repairs, outbox and original SHADOW
start2026-10-18T23:22:22.161Z. The exact independently reconciled USA observation
version is approved in `operations/approved-observations.json`, matching the
replay input. The normal serialized collector must perform the real transition;
the retained sequence5 checkpoint still has the prior identity. Two completed
scheduled cycles exist; USA has no
scheduled observation yet. The normal daily collector/hourly watchdog remain.
Seven-day acceptance, genuine delivery receipt, NZ-PRICES separate official report
and parked UK CPI remain independent gates. Ordinary source alerts stay disabled.

## Production acceptance

Deployment `916e97b8-e062-4fe9-9a21-a12a8f713fe9` promoted the exact staged version
to 100% at **2026-10-20T04:16:49.474606Z**. The first immediate check encountered
eight apex responses from the old version during rollout. Its complete failed
record is retained in `production-rollout/`; no acceptance was claimed from it.
One settled recheck at **04:20:07.152Z** passes **151 checks across 104 requests**
with no revision mismatch. Both domains match the clean released identity.

All nine desks pass on both domains: **18 apex / 17 www smoke checks**,
**100 offline semantic checks**, **24 schema documents**, and **26 exact USA
observation comparisons** against the independently extracted workbook. The
staged final version separately passed 137 interface checks, 50 semantic checks
and all nine full-desk schemas. These include the established Stats NZ23,
AIHW40, Wales projection, NISRA4 and five described NZ price nodes; the latter
does not close the separate 17 October NZ-PRICES independence gap.

The source comparison covers218 domain/source states. Four deltas are known
intermittent TfL429 transitions. One apex Australian legislation timeout had a
healthy www response and then passed one targeted apex confirmation with a new
retrieval timestamp04:21:05.307Z. The original timeout is preserved. No persistent
new source regression is established; native legislation fields are not thereby
independently certified. `laws-confirmation.json` retains the exact result.

The first offline USA comparison incorrectly demanded identical missing-value
display text: the independent reference uses null, while the public response
uses value=null with display text "-", unavailable/X. The retained initial
diagnostic and corrected semantic comparison make this distinction explicit;
all numeric Decimal values match exactly.

Current evidence files include `production-deployment.json`, `production-settled/`,
`smoke-apex.json`, `smoke-www.json`, `production-*-semantic.json`,
`production-schema-reference.json`, `production-source-comparison.json` and
`manifest.json`. Public captures retain only allowlisted response headers.
No credentials, preview tokens or signed transport URLs are included.

## Reproduction

Run from the repository root. Captures are historical evidence, so pair them with
their recorded acquisition/version metadata; replay does not create new live or
scheduled evidence.

```sh
npm run build
EXPECTED_REVISION=c6a96283743476af730dc2ff4bd915463e47d03c EXPECTED_US_LATEST=2026-09 \
  node scripts/verify-preview-bodies.mjs verification/us-paid-2026-10-20/staged-preview /tmp/staged-semantic-replay.json
EXPECTED_REVISION=c6a96283743476af730dc2ff4bd915463e47d03c EXPECTED_US_LATEST=2026-09 \
  node scripts/verify-preview-bodies.mjs verification/us-paid-2026-10-20/production-apex-capture /tmp/apex-semantic-replay.json
EXPECTED_REVISION=c6a96283743476af730dc2ff4bd915463e47d03c EXPECTED_US_LATEST=2026-09 \
  node scripts/verify-preview-bodies.mjs verification/us-paid-2026-10-20/production-www-capture /tmp/www-semantic-replay.json
python3 scripts/verify-paid-production.py \
  verification/us-paid-2026-10-20/production-settled \
  verification/us-paid-2026-10-20/workbook-recheck.json \
  /tmp/production-reference-replay.json \
  --staged-semantic verification/us-paid-2026-10-20/staged-semantic.json \
  --laws-confirmation verification/us-paid-2026-10-20/laws-confirmation.json
node scripts/replay-us-release.mjs \
  verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json \
  verification/us-paid-2026-10-20/release-review.json \
  verification/us-paid-2026-10-20/replay-us-body.json \
  /tmp/us-release-preservation-replay.json 2026-10-20T04:16:06.893Z
```

The replay's last argument is the retained actual capture time, explicitly a
historical replay. It produces no real checkpoint or scheduled run. The original
scheduled window remains two completions spanning24.0633hours, and its next
complete checkpoint deadline is **2026-10-21T01:26:10.163Z**. Neither release
validation nor offline replay advances that window.
