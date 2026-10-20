# Gap-list implementation and evidence pass — 20 October 2026

This pass follows the user's instruction to work through `GAP-LEDGER.md`.
The source-specific contracts were written before reader changes. The revised
phase-one implementation is **accepted on both domains** at clean source
`bf3110e3bcbbc7db6d629254a886356e80f4c24a`, Worker
`7f93e660-666c-435a-9b8b-bc37c060ac02`, fingerprint `f815539b2fa5b866`.
Deployment `5dd15b87-3455-4939-a3fb-85128f25d852` promoted that exact version to
100% at `2026-10-20T10:51:30.095999Z`. See the [accepted candidate's retained
release proof](release-validation/accepted-candidate-bf3110e3/README.md).

AEMO completed-day activation remains held after repeated Cloudflare HTTP 406.
The first, different candidate was rolled back to GDP; its passed staged proof
and failed production evidence remain separate below. This accepted version
excludes AEMO activation. Implementation acceptance does not complete the
remaining evidence, scheduled-observation or delivery gates.

| Gap | Implemented or established boundary | Independent evidence |
| --- | --- | --- |
| AEMO completed day — held | Disconnected candidate: SA1/VIC1, fixed-AEST calendar day, 288 interval-ending prices per region, five summaries each. Repeated actual Worker HTTP 406 prevents activation | All 576 monthly-file prices match separately published daily DREGION records; ten summaries independently calculated with decimal arithmetic |
| BoC dated FX | USD/CAD and GBP/CAD over 31 calendar days; exact-date selectors and latest-response anchor | 38 exact JSON/CSV cells, ten official-table cells and two latest-anchor cells |
| StatCan headlines | Four existing sources now validate identity, metadata, period and flags | Fourteen selected values reconciled against separate official presentations; ten provincial unemployment mislabels reproduced and repaired |
| WRA tax due | Four existing effective-financial-year cells gain typed selection | Four exact CSV/HTML comparisons; overlapping totals and missing restricted cells retained honestly |
| Stats NZ | Precise household-population, fiscal-period and productivity-index metadata | Eleven of 23 retained values match dated official evidence; twelve individually documented gaps remain |
| Transport editions | No replacement edition or reader correction indicated | Twelve existing workbook cells independently extracted; four Scottish chapter comparisons at published rounding |

The dated source folders retain original bytes or documented minimal specimens,
public URLs, hashes, retrieval times, independent extraction, failure controls and
shared statistical-lineage limitations. No result certifies an arbitrary future
publication. Native fields remain compatible; new typed interfaces expose exact
measures and retained periods with explicit refusals.

The proven jobs defect arose because WDS returned coordinates in lexical order
`1, 10, 11, 2, …, 9` and the old reader labelled by array position. The new reader
joins by verified product, coordinate and vector before emitting the established
display order. Canada was correctly labelled; the ten provincial labels were not.
The independently verified GDP reader is a separate retained contract.

The disconnected AEMO candidate bounds caching at fixed-AEST midnight; active dated FX caching ends at UTC midnight.
Acquisitions or complete desk responses crossing those boundaries withhold the
old daily source. One failed source or AEMO region preserves healthy siblings.
No weekend or holiday is invented, and no older date fills a missing current
selection.

New local validation and actual protected/production results are recorded
separately. Initial tooling failures are retained: a WRA comparison import used
one excess parent directory, a new selector test shadowed its own source variable,
and the first full run retained two old staged-registry count expectations.
Those failures are not relabelled passing attempts. The first full run was
823/825; fixes are verified in later reports.

The original AEMO-active candidate passed 843 local tests and 36 protected
Worker fault cases, including malformed WRA rows returning a controlled refusal.
The accepted revision with AEMO held passed **832 local tests**, the build and
**28 protected fault cases**; exact source CI was `39410289205`.
The initial live development preview received AEMO HTTP 406 responses; those
failures remain retained. One subsequent complete unchanged reader execution
successfully acquired both regions and matched all 576 prices and ten summaries.
That earlier success did not establish reliable AEMO production access.

The accepted revision's actual production run passed all **18 release gates**,
including **100 core semantic checks**, established GDP/claimant/rent contracts,
24 core schemas and 26 BLS reference slots. Gap-specific checks passed
**80 requests, 1,547 independent checks, 56 unique reference cells / 112 domain
cells, 48 schemas and 16 negative controls**. Smoke passed **18 apex / 17 www**.
Exact staged CPU was **13 ms USA, 306 ms legacy maximum, 25 ms claimant and
201 ms rent**, within existing gates and the unchanged 1,000 ms Worker ceiling.
Both production NZ captures agree with the eleven dated independent references
and supported metadata; they do not certify the twelve remaining cells.

The isolated second batch has **SFC and CMHC prepared, not released**, with
seven protected actual-reader comparisons. NI, CQC and ONS candidates remain
disconnected after actual Worker access refusal, 403 and 429 respectively.
Those results supersede the [held-queue audit's](held-queue/README.md) earlier
research-readiness findings. AER's original CSV access and applicable upstream
reuse evidence remain unresolved. The [full queue disposition](../../GAP-LEDGER.md)
retains every item and the twelve exact Stats NZ requirements.

## Operational boundary

The rollback target is accepted GDP source
`a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b`, Worker
`775bfe2d-491b-4bf5-a257-4d3465003351`, fingerprint `fc27e14328f2c397`.
The accepted gap release adds the exact fifth reviewed identity edge, preserving
the prior four edges and all fifteen earlier observation approvals. Six exact
approvals bring the total to **21**. The failed AEMO-active promotion created no
reviewed edge or approval; AEMO remains outside active scope. Both-domain offline
replay preserves all incidents, repairs, outbox and history while applying the
exact five-edge path or remaining suffix. It is constructed proof, not a
checkpoint write or scheduled observation.

The durable checkpoint remains sequence 5, scheduled run `39341442350`,
completed `2026-10-19T23:26:10.163Z`, digest
`665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f`.
Its 33 incidents, 36 repairs and pending already-announced delivery event are
preserved. No acknowledgment exists. The original SHADOW has two actual legacy
scheduled checkpoints; releases, previews and replays do not add scheduled days.
The next complete-checkpoint deadline remains `2026-10-21T01:26:10.163Z`.

The accepted monitoring scope contains **116 obligations in 24 public probes**.
There are **two actual legacy scheduled cycles and zero expanded-scope cycles**.
The expanded scope's clock starts only with an actual scheduled collection
observing the reviewed release; historical registries remain replayable. The
next nominal daily cron is `2026-10-20T23:17Z`, with existing delay/runtime
allowances. Seven-day acceptance requires at least eight actual daily
checkpoints, seven elapsed days between scheduled completions, no gap over
26 hours, independent watchdog evidence and genuine delivery evidence. No
release or constructed intermediate identity adds a scheduled cycle.

The selected NZ-PRICES 17 October Interim specimen remains blocked. A newly
accessible official export presents Final values, so numerical agreement does
not certify the held release status. UK CPI remains parked. Ordinary alerts,
hourly watchdog and daily collector schedules, credentials, infrastructure and
disconnected automatic Builds are preserved.

## Unaccepted first promotion and rollback

Candidate source `ba0812b493f7cc4ca47a9f726211d96903bd9597`, Worker
`3eae0d8f-e4ad-4c31-97f2-6b98845e3ba9`, passed staged numerical and schema
checks after one bounded AEMO confirmation. Deployment
`302dc69e-1456-48f7-83aa-bedb6abc2ae8` promoted it at
`2026-10-20T10:21:09.400348Z`. Both public domains then returned AEMO 406
again. Deployment `5e200fe0-ae7e-4fdd-a557-ad951359dd8b` restored the
accepted GDP Worker at `2026-10-20T10:24:42.151362Z`; both health endpoints
confirmed the clean GDP identity. No further AEMO access attempts are part of
this pass. The implementation remains available for a future access review,
with all successful and failed evidence retained under [release validation](release-validation/README.md).

During the earlier failed-candidate checks, the unchanged SEPA reader returned
503 or a request timeout. Those strict failures and the separately reviewed
narrow availability exception remain historical evidence. The final accepted
candidate passed all **50 strict semantic checks per domain / 100 total** with
SEPA available; it did not need that exception. This does not establish sustained
source recovery or alter the quiet-monitoring rules.
