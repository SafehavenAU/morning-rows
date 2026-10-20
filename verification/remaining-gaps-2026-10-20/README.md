# SFC and CMHC release — 20 October 2026

Two additions within the existing nine desks are **accepted on both domains**:
`scotland/college_activity` and `canada/rental_benchmark`. Clean deployed source
is `3ae91ac1ce163008f05377acefc27cce488fbbed`, Worker
`ff344629-f392-44ec-b816-92d14f52bd07`, fingerprint `e2a345caf4569e1f`.
Deployment `fc98bcad-eb84-40d7-aeff-55460c0f5a58` promoted that exact version to
100% at `2026-10-20T11:28:10.036988Z`; acceptance was recorded at
`2026-10-20T11:32:05.631Z`. The [acceptance record](release-acceptance.json)
binds the identity, reports, exact observation versions and remaining limits.
Rollback is accepted phase-one source `bf3110e3bcbbc7db6d629254a886356e80f4c24a`,
Worker `7f93e660-666c-435a-9b8b-bc37c060ac02`, fingerprint `f815539b2fa5b866`.
Source CI `39414131265` passed for the exact PR16 source. A merge/evidence
revision is not the deployed source.

| Bounded contract | Evidence and actual Worker result | Final boundary |
| --- | --- | --- |
| [SFC college activity](sfc/CONTRACT.md) | Exact original workbook and five independently extracted FTE cells; separate Parliament presentation; actual integrated production passes | Released for fixed 2024–25 edition |
| [CMHC rental benchmark](cmhc-rent/CONTRACT.md) | Two exact 2025 WDS/CSV cells with complete metadata; actual integrated production passes | Released with applicable HMIP conditions in every representation |
| [CQC historical assessment cohort](cqc/CONTRACT.md) | Publisher HTTP 403 after corrected actual-reader invocation | Blocked and disconnected; local evidence does not establish usable access |
| [ONS Manchester bedroom rent](ons-rent/CONTRACT.md) | Publisher HTTP 429 | Blocked and disconnected; no fixture fallback or additional attempt |
| [NI electricity balance](ni-energy/CONTRACT.md) | Report reader refused an access page; bounded diagnosis confirms `Request Rejected` | Blocked and disconnected; no more requests |

SFC uses academic year **2024–25**, published **4 February 2026**, and reports
39,655 / 47,405 / 4,595 / 24,400 / 116,055 FTE. These are all-funding Scottish-college
learning volumes, not individual students or Scottish-domiciled residents. The
rounded total overlaps the four rounded components. Its reproduction permission
requires accurate attribution; no OGL licence is invented.

CMHC uses the **2025 October survey**: Victoria BC CMA **2,121** and Victoriaville
Quebec CA **991 CAD/month**, weighted average rent for two-bedroom combined row
and apartment structures of three or more units. These are not municipality-wide,
apartment-only or current asking-rent measures. Raw unzoned publication metadata
and exact status/category/geography identifiers are retained. Applicable HMIP
terms, attribution/adaptation/no-endorsement notices and further-recipient
agreement conditions survive every selector; no individual assent is claimed.

The separate SFC Parliament table shares SFC FES lineage; CMHC CSV/WDS outputs
share the CMHC survey. Independent extraction/presentation checks do not provide
independent population measurements or blanket future-vintage approval. The
[joined protected proof](preview/accepted-reader-proof.json) preserves the original
failed attempts, corrected workbook invocation, exact code hashes, actual clocks,
provenance and seven unique exact references.

## Exact release validation

The exact source passed **24 staged gates and 22 production gates**. Production
finished at `2026-10-20T11:30:50.571559+00:00`; the independent offline audit passed
at `2026-10-20T11:31:31.983Z`, before the recorded acceptance time.

| Check | Actual accepted result |
| --- | --- |
| New SFC/CMHC interfaces | 44 requests and 694 offline assertions; seven unique reference cells / fourteen domain comparisons |
| Captured new schemas | 20 valid documents and 16 rejected semantic mutations |
| Existing phase-one gap interfaces | 80 requests / 1,547 offline assertions; existing BoC, StatCan and WRA exact references retained |
| Established contracts | GDP, claimant, NZ rent, USA, Stats NZ reference subset, AIHW, Wales and NISRA gates pass; 24 core schemas and 26 BLS slots preserved |
| Strict core semantics | 50/50 staged and 50/50 on each production domain, 100/100 production; no availability exception needed |
| Full smoke checks | 18 apex / 17 www |
| Held-source refusal/discovery | 10 production requests / 164 checks; held sources remain inactive |
| CPU | USA 12 ms; legacy maximum / Scotland 350 ms; Canada 71 ms; claimant 52 ms; rent 236 ms; fresh SFC/CMHC acquisitions bound to the full-desk captures |
| Source-state comparison | 236 comparisons; fourteen changes consist only of twelve known ONS 403→429 changes and two known TfL fluctuations, none unexplained |

CPU observations are one-location bounded evidence, not sustained-load percentiles.
Existing 100/500 ms validation gates and the 1,000 ms Worker ceiling remain.
All counts distinguish offline identity/schema/transport assertions from the
seven unique independently extracted new source values.

## Preserved failures and source provenance

Earlier smoke captures exercised only the supplied subset; they are retained as
limited coverage, not relabelled as the final 18/17 full runs. The remote ancestry
preflight failed its assertion and remains failed. Exact complete Git-tree
equivalence separately binds the deployed connector source to the locally
verified tree and its 68-check preflight; it does not transfer that ancestry
claim. Initial workbook transport/harness failures and corrected attempts remain
separate in the joined proof. CQC/ONS/NI access failures did not activate sources.
The earlier AEMO-active promotion/rollback is retained under the phase-one record;
its 576 historical comparisons do not establish reliable production access.

## Monitoring and remaining queue

The exact accepted phase-one → SFC/CMHC review is the **sixth edge**. All 21 prior
observation approvals are preserved and two exact source versions are added:
**23 approvals, 118 obligations and the existing 24 public probes**. Both-domain
constructed replay preserves all 33 incidents, 36 repairs, outbox and history;
53 targeted monitoring tests passed after applying the accepted review. No
checkpoint, receipt or scheduled observation is created. The normal serialized
collector must follow the exact remaining reviewed suffix and every intervening
run/attempt/write; never invent intermediate sequences or skip missing artifacts.

Durable checkpoint stays sequence 5 / scheduled run `39341442350`, complete
`2026-10-19T23:26:10.163Z`, digest
`665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f`.
There are two actual legacy cycles and zero expanded-scope cycles; the pending
delivery event has no receipt. Original SHADOW start remains
`2026-10-18T23:22:22.161Z`; next nominal cron `2026-10-20T23:17Z`, complete
checkpoint deadline `2026-10-21T01:26:10.163Z`, with existing delay/runtime budgets.
Eight actual daily checkpoints, seven elapsed scheduled-completion days, no gap
over 26 hours, independent watchdog proof and genuine delivery remain required.

The bounded [full ledger](../../GAP-LEDGER.md) has been worked through, but its
external blockers remain uncompleted: twelve exact Stats NZ cells, selected
17 October Interim NZ-PRICES, parked UK CPI, AER access/upstream terms, and held
AEMO/NI/CQC/ONS access. Fixed annual observations remain valid when unchanged.
Keep hourly watchdog/daily collector, credentials and disconnected Builds as they
are, ordinary source alerts disabled and notification deduplication intact.
Do not repeat release notices or the delivery test. No implementation release
completes sustained operation or the broader maintenance plan.
