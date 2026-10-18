# NZ prices — original-data verification, acceptance blocked

Checked 19 October 2026 Brisbane (18 October 16:45–16:48 UTC).
One selected contract, `NZ-PRICES`; no production reader change or deployment.
The user's subsequent “go now” instruction authorized starting this work before
scheduled-cycle proof. That operational gate remains pending, not waived.

## Result

Independent Python extraction validates all **240 original node-period cells**
for the publisher's latest listed completed trading day, **17 October 2026**,
interim. The five terminal prices match the actual JavaScript parser in protected
Cloudflare remote preview exactly. The independent directory extraction and
Cloudflare reader saw the same directory hash and selected the same release.

| Node | Period | NZD/MWh |
|---|---:|---:|
| OTA2201 | 48 | 87.63 |
| HAY2201 | 48 | 76.38 |
| ISL2201 | 48 | 43.11 |
| BEN2201 | 48 | 41.27 |
| INV2201 | 48 | 39.60 |

All refer to 17 October 23:30–24:00 NZDT, **10:30–11:00 UTC**.
At acquisition it was 19 October in New Zealand; latest completed calendar day
was 18 October. The selected file's **one-day publication lag is explicit**.
No 18 October release was listed. This is not an assertion that an official
publication deadline has been missed; interim finalisation is normally by 2pm
the following business day, subject to pricing-error claims. Do not equate a
retrieval date with a trading date or infer finality from elapsed time.

**Acceptance is blocked.** CLA3WR's five date/node-specific report requests each
returned 302 to the unqualified report route. The first preview followed a loop
for two reports and exhausted its diagnostic subrequest budget. This was a
verification-harness limitation, not five established publisher failures.
A corrected diagnostic disabled redirects and confirmed the first-hop 302 for
each node. No report table was obtained and no second-presentation numerical
comparison is claimed. Do not describe the 240-cell original-file check as an
independent market measurement or as report reconciliation.

Both selected public-domain responses were inaccessible through the tested
verification paths: workspace 403, protected-preview requests 522. These do not
establish a public outage or a new production regression; no public values were
obtained in this pass. The previous independently verified production baseline
is preserved. There was no whole-site sweep and no known-source alert.

## Mapping and retained evidence

Original CSV: `TradingDate → date`, `TradingPeriod → period`,
`PointOfConnection → code`, `DollarsPerMegawattHour → price`. Require one row for
each of five nodes × 48 periods; select period 48 only after validating coverage.
No averaging, summation, weighting or adjustment. Decimal equality has zero
numerical tolerance; zeros and negatives are legitimate prices, markers are not.

- `CONTRACT.md`: pre-implementation selection rationale and pass/fail criteria.
- `source-selected.csv`: 240 necessary, untransformed aggregate rows and header.
- `reader-preview.json`: source/directory hashes, acquisition times, release
  selection and actual production-parser outputs from Cloudflare.
- `discovery.json`: separate Python HTML-link extraction of all 368 listed
  filenames, with the necessary six latest eligible filenames retained. It uses
  Python `zoneinfo`, not the JS date-selection function. Original directory hash
  is retained; the full directory was used temporarily, not redistributed.
- `access-results.json`: bounded access attempts and separate diagnostic limits.
- `licence.json`: publisher CC BY 4.0 statement and attribution.
- `specimen.json`: dated manifest, provenance and retained-file SHA-256 hashes.
- `verify.py`: independent CSV/Decimal/timezone replay and constructed adversarial
  cases. These are deterministic checks, not an independent agent evaluation.

Hashes detect changed evidence, not authenticity. GitHub review and the original
publisher are the trust boundaries. Original CSV and reader share input lineage;
the separate official report would still share the publisher's pricing lineage.

## Reproduce

From repository root, with Python 3.9+ and timezone data:

```sh
python verification/nz-prices-2026-10-19/verify.py
python verification/nz-prices-2026-10-19/verify.py --test
# Deliberately exits 2 while the report/production acceptance gates are blocked:
python verification/nz-prices-2026-10-19/verify.py --require-acceptance
node scripts/build-info.mjs
node --test test/nz-prices.test.js
```

The five Python tests cover actual retained evidence, missing/duplicate cells,
wrong dates/nodes/units, suppression, genuine zero/negative values, wrong terminal
periods, revisions against old evidence, incomplete node coverage, hidden release
lag and both DST day lengths. The nine existing reader tests additionally cover
failed-newest-file/no-older-fallback behavior, final-over-interim selection,
bounded reads and successful sibling preservation. Initial test startup in the
new worktree lacked generated build metadata; `npm ci` and the standard build-info
step resolved setup. No reader-test failure was observed after setup.
The complete existing `npm run check` suite also passed all 132 tests.

To reacquire through the existing protected remote-dev workflow (requires the
existing Wrangler login; never log preview headers or credential contents):

```sh
XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config \
REPORT_DIR=/tmp/mr-nz-new-specimen \
node scripts/remote-check.mjs verification/nz-prices-2026-10-19/preview-specimen.js /specimen.json
```

`preview-specimen.js` is a verification-only entrypoint, not production code.
It retains original CSV lines and separately runs the actual parser. Its final
version disables report redirects to bound load; the retained first acquisition
preceded that diagnostic fix, documented in `access-results.json`. `/access.json`
reproduces the fixed-date first-hop diagnostics and targeted public-domain reads.
These commands do not deploy a production Worker or create a new service.

For independent directory selection, parse the public directory's anchor `href`
attributes with Python `html.parser.HTMLParser`; accept only paths matching
`/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/\d{8}_FinalEnergyPrices(_I)?.csv`.
Parse the filename date with `datetime.strptime`, exclude dates on or after the
acquisition date in `ZoneInfo('Pacific/Auckland')`, then sort date descending and
final before interim. Compare the selected URL and full-directory SHA-256 with
the protected preview. Replay must use the retained acquisition time.
The executable extraction is `discover.py`:

```sh
python verification/nz-prices-2026-10-19/discover.py directory.html 2026-10-18T16:45:48.355880+00:00
```

That command exactly reproduced `discovery.json` against the temporarily retained
original directory. A newly downloaded directory may legitimately differ.

## Next action and completion boundary

Resume **this same contract**, not another dataset, when a usable official CLA3WR
table/export for 17 October and the five nodes is available, or new evidence
identifies a permitted official access route. A manually obtained public report
export with source URL, date, units and interim/final status can unblock the
separate-presentation check. No account/key registration, publisher contact,
credential replacement or unbounded retry is authorized by this record.

Reconcile that table against the retained original values, accounting explicitly
for any intervening revision, and obtain comparable current public-domain
responses before accepting the contract. Fresh release evidence must receive its
own dated specimen; do not relabel this historical specimen as current.

Scheduled-cycle proof, actual delivery acknowledgment, seven-day SHADOW operation
and UK CPI's separate access/metadata gates remain outstanding. No maintenance
completion, new source alert or exactly-once delivery claim follows from this work.

## Subsequent scheduled evidence — 19 October 2026 Brisbane

The first genuine scheduled cycle now passes independent artifact, lineage and
full-state replay verification. See [scheduled-cycle evidence](../scheduled-cycle-2026-10-19/README.md).
This supersedes only the scheduled-gate-pending statements above. Seven-day
SHADOW, the actual delivery receipt and NZ-PRICES separate-presentation evidence
remain unresolved. New both-domain18October prices are a different release from
the retained17October specimen; no independent numerical certification or reader
release follows. Keep the same selected contract and existing quiet watchdog.
