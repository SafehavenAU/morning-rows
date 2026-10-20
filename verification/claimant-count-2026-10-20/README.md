# National claimant-count history — 20 October 2026

**Released to both domains at 2026-10-20T05:06:59.662392Z.**
The release adds thirteen published monthly claimant counts to the existing
United Kingdom, England, Scotland, Wales and Northern Ireland desks. It answers
latest-versus-prior-year questions with the correct national boundary and
administrative definition. No new country desk, key, data subscription or
infrastructure is introduced.

The user explicitly authorized continued building after the Workers Paid
upgrade. This bounded task follows the existing demand assessment and its
[contract written before runtime changes](CONTRACT.md). It is separate from the
blocked NZ-PRICES contract and parked UK CPI reader.

## Release identity and execution boundary

| Item | Evidence |
|---|---|
| Clean released source | `983904912d512b054ae3a7fa1cd1e6a65c353036` |
| Source tree | `ff573ea365ac7ffb679cb25a33ac45c9c0bb7fd0` |
| Released Worker | `21582063-b7df-456b-ba2f-4f629f9cc63d` |
| Build fingerprint | `5a0a0fe53d5f160c` |
| Zero-percent staging deployment | `e85b6165-5449-41a9-bdda-7ba4583a154b` |
| Production deployment | `50b64c24-0ccb-4c88-b4da-b2b54592582d`, `2026-10-20T05:06:59.662392Z`, 100% candidate allocation |
| Post-release matching identity | Apex and www match the clean source, Worker and fingerprint above; no revision mismatches |
| Rollback version | `e0224d26-6bcb-4f96-a580-460919a0d195`, source `c6a96283743476af730dc2ff4bd915463e47d03c` |

[Candidate evidence](candidate.json) records the exact clean revision and
runtime configuration. [PR12](https://github.com/SafehavenAU/morning-rows/pull/12)
is the delivery vehicle. Its successful PR workflow is an implementation check;
it is not a scheduled monitoring observation. After validation at zero percent,
the exact candidate was promoted to 100%; [promotion.json](promotion.json)
records the allocation and deployment identity. The released runtime remains
unchanged from source `983904912d512b054ae3a7fa1cd1e6a65c353036`.
Automatic Workers Builds remain disconnected; existing credentials and bindings
are preserved. The whole-Worker ceiling remains 1,000 ms.

## Statistical definition and interface

The original publisher is ONS/Nomis, dataset `NM_162_1` / `UCJSA`. Fixed
selectors are gender 0 (total), age 0 (all categories, age 16+), measure 1
(claimant count), and measures 20100 (value). These are monthly reference-date
stocks of Jobseeker's Allowance and relevant Universal Credit claimants under
the publisher's administrative definition, in persons rounded to the nearest
five, not seasonally adjusted. They are not unemployment estimates, claimant
rates or counts of available recruits.

Each national scope uses its verified GSS code: UK `K02000001`, England
`E92000001`, Scotland `S92000003`, Wales `W92000004`, NI `N92000002`. The reader
validates the entire five-nation, 65-cell acquisition before returning one
nation's thirteen consecutive months. A current official time codelist anchors
the last month; a future release-calendar entry cannot advance it.

For any of those desks, `?source=claimant_count` and
`?source=claimant_count&measure=claimants` retain all thirteen observations and
native rows. Appending `&observation=YYYY-MM` selects one exact retained month.
An unretained month returns 404; unsupported date/geography filters return 400.
No local-authority history, arbitrary-date archive, seasonal adjustment or
unemployment substitution is supported. Explicit published zero remains a
rounded observation; missing, suppressed, malformed and partial data fail this
source without erasing successful sibling sources.

## Original evidence and independence

[Independent Python CSV/Decimal extraction](verify-original.py) reconciles all
**65 cells** with a separately acquired official JSON representation. The
retained vintage is **August 2025–August 2026**, with August's reference day
13 August and raw release metadata `2026-09-15 07:00:00`. The independent report
also checks thirteen UK-versus-four-nation totals: the maximum residual is
**5 persons**, within the predeclared 12.5-person independent-rounding tolerance.

| Geography | August 2026 | August 2025 | Count change |
|---|---:|---:|---:|
| United Kingdom | 1,698,450 | 1,663,580 | +34,870 |
| England | 1,486,460 | 1,459,710 | +26,750 |
| Scotland | 112,215 | 104,480 | +7,735 |
| Wales | 65,615 | 62,620 | +2,995 |
| Northern Ireland | 34,155 | 36,765 | −2,610 |

These values identify the retained release; a later release requires newly
acquired and reconciled evidence before acceptance. The offline capture checker
fails when the actual window or revision metadata differs from this reference.

Independent standard-library ZIP/XML extraction of the dated official NISRA
September workbook gives **one exactly comparable presentation check**:
`LGD_11!D19`, NI August, **34,155**. Thirteen separate NSA headline values are
retained as context only: August's unrounded headline is 34,159, with a different
geographical-classification/rounding boundary. They are not thirteen exact
matches. Nomis CSV, Nomis JSON and NISRA share upstream administrative lineage;
separate presentations/extractors do not constitute an independent population
enumeration.

[Original evidence notes](original/README.md) and acquisition ledgers retain
URLs, original hashes, local UTC retrieval times and transformations. JSON
publisher contact headers and NISRA staff contacts are omitted from committed
specimens; all retained observations and codelist values are unchanged. Reuse
is attributed to ONS/Nomis and NISRA under their Crown copyright/Open Government
Licence terms.

Release, reference and retrieval times remain distinct. Publisher release and
revision timestamps lack an established timezone, so the reader preserves their
raw strings and leaves absolute publication timestamps null. The publisher's
`prepared`/`extracted` fields are labelled `Z` but were approximately one hour
ahead of the local acquisition records; those strings are preserved without
claiming verified UTC timing. Previous-month and wider methodological revisions
remain possible. The observed URN month encoding is an inferred, fail-closed
identity check, not a universally documented API guarantee.

## Validation and actual Cloudflare evidence

[Local validation](local-validation.json) records **231 passing tests** and a
successful dry-run build. Local coverage includes dimension/geography drift,
malformed CSV/JSON, incomplete or stale windows, suppression, explicit zero,
contradictory URNs, revision metadata and source isolation.

The final protected remote preview passed **12 constructed scenarios** through
the actual reader and selector: complete history; earliest month; latest month;
unretained month; a revision; HTTP failure; timeout; oversized response; invalid
metadata JSON; partial coverage; wrong geography; and suppression. Source and
fixture hashes remained unchanged throughout. Error scenarios also preserve a
successful constructed sibling. This does not imply that every local mutation
was exercised remotely. The initial preview is retained but superseded by the
hash-bound final [fault evidence](fault-preview.json). Constructed fault success
is distinct from live publisher access.

The actual zero-percent version subsequently fetched the original publishers.
Version, revision, request path and execution times were matched to Cloudflare
CPU traces, and staging/production allocations stayed unchanged throughout:

| Actual candidate check | Observed CPU | Gate | Evidence |
|---|---:|---:|---|
| Eight legacy desks, maximum | 293 ms | 500 ms per desk | `cpu-legacy.json` |
| UK / England / Scotland / Wales / NI | 34 / 95 / 135 / 91 / 47 ms | 500 ms each | `cpu-legacy.json` |
| USA fresh selected CPI request | 25 ms | 100 ms | `cpu-usa.json` |
| Second fresh NI claimant acquisition on www | 53 ms | 500 ms | `cpu-claimant-repeat.json` |

The repeat capture verifies new publisher acquisitions on an untouched domain
cache key, preventing a cache-only pass. These are bounded observed executions,
not percentile, load-test or sustained-performance claims. The 1,000 ms Worker
ceiling is a separate safety limit and is not a spending cap.

The [general staged interface](staged-preview/staged-preview-report.json) passes
**137 assertions**, and the [established staged semantic checks](staged-preview/semantic-report.json)
pass **50 checks**. The [claimant interface](claimant-interface-staged/claimant-interface-report.json)
passes **183 checks over 56 requests**.
[Final staged independent reconciliation](claimant-stage-reconciliation-final.json)
passes **65 native cells**, **20 successful source/measure/exact-month selections**,
**15 expected negative responses** and **51 relevant request-metadata checks**,
including five conditional 304 and five HEAD responses. The original offline
verifier misclassified ten deliberately invalid date/geography responses as
positive data responses. The initial failed report is preserved; the corrected
verifier binds method, status, identity and body hashes to the original capture
report and verifies negative semantics separately. Ten copied-capture mutation
checks pass, including unexpected status, wrong identity, substituted error data,
modified body hashes and missing positive selectors. See
[capture-verifier-correction.json](capture-verifier-correction.json). No runtime
code or original capture changed for this tooling correction.
[Claimant schema validation](claimant-schema-staged.json) accepts **25 captured
documents** and rejects **185 constructed negative controls**. Established
semantic checks retain Stats NZ's 23 values, AIHW's 40 jurisdiction/triage cells,
the Wales projection, NISRA's four childhood-BMI aggregates, five NZ price values
and the USA's thirteen CPI slots. These schema/semantic checks have their stated
coverage and do not certify every native field independently.

## Production outcome

Both production domains match the released identity. The [general production
capture](production-general/report.json) passes **151 checks over 104 requests**,
covering all nine desks and reporting no revision mismatches. The [claimant
production interface](production-claimants/claimant-interface-report.json) passes
**366 checks over 112 requests**.

[Independent production reconciliation](claimant-production-reconciliation.json)
passes **130 native claimant cells**, **40 successful selector captures**, **30
expected negative responses** and **102 relevant transport checks**. [Claimant
schema validation](claimant-schema-production.json) accepts **50 actual documents**
and rejects **370 constructed negative controls**. The established [apex](production-apex-semantic.json)
and [www](production-www-semantic.json) semantic suites each pass **50 checks**.

The [existing schema/reference and source-state review](production-schema-reference.json)
passes **24 schemas**, exactly reconciles **26 USA CPI calendar slots** across
the two domains (including the correctly retained unavailable slot), and compares
**228 source states**. Its only two changes are the known intermittent TfL road
source recovering from HTTP 429 on each domain; no change remains classified as
requiring review. Availability comparisons do not independently certify all
native source coverage or values. Known unchanged publisher failures remain
acknowledged and are not reannounced as new incidents.

The final smoke checks pass **18 checks on [apex](smoke-apex.json)** and **17
checks on [www](smoke-www.json)**. An initial positional www argument was ignored
by the existing smoke script, so that extra apex run is retained accurately as
[smoke-apex-repeat.json](smoke-apex-repeat.json). The actual www run uses
`SITE_URL`. The complete outcome is recorded in
[release-acceptance.json](release-acceptance.json).

The initial offline reconciliation failure remains retained alongside its tooling
correction and final pass. Later evidence does not erase that original result.

## Reproduction and remaining operational gates

```sh
python verification/claimant-count-2026-10-20/verify-original.py \
  verification/claimant-count-2026-10-20/original /tmp/claimant-original.json
node scripts/verify-claimant-captures.mjs CAPTURE_DIR \
  verification/claimant-count-2026-10-20/independent-report.json \
  OUTPUT --require-selectors
```

The capture verifier reads supplied files only and does not import the runtime
parser as its oracle. It validates the recorded HTTP status, response identity,
body hashes and HEAD/conditional behaviour against the original capture report.
Live acquisition and CPU acceptance remain separate original-capture checks.
Reproducing NISRA extraction requires the exact hash-pinned official workbook,
which is omitted from the repository because it includes staff contacts.

The monitoring integration is governed by the exact reviewed continuation of
the sequence-5-to-USA release bridge. It adds five claimant obligations, taking
the registry from 109 to 114 while retaining **24 public probes**, the daily
collector, hourly watchdog and disabled source alerts. The handoff and acceptance
ledger track final activation and composed replay evidence separately. The
actual state write belongs to the next normal serialized collection, not this
release task.

The latest independently verified checkpoint remains **sequence 5**, scheduled
run `39341442350`, completed `2026-10-19T23:26:10.163Z`, digest
`665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f`.
Its **33 incidents, 36 pending repairs**, delivery outbox and original SHADOW
start `2026-10-18T23:22:22.161Z` are preserved. There are **two actual scheduled
cycles and no USA/claimant scheduled observations**. A release or replay cannot
manufacture another scheduled cycle.

Seven-day operational acceptance still requires at least eight complete daily
scheduled checkpoints, seven elapsed days spanned by actual scheduled
completions, no gap over 26 hours and genuine delivery evidence. The previously
announced delivery test remains unacknowledged and must not be repeated.
NZ-PRICES remains `blocked_external_evidence` for its selected 17 October
specimen; UK CPI remains parked. This claimant release does not complete those
gates or the broader maintenance plan.
