# First scheduled cycle after checkpoint repair

The checkpoint repair's scheduled-run gate passes. This is one scheduled cycle,
not seven-day operational acceptance or completion of the maintenance plan.

GitHub scheduled [run 39176195113](https://github.com/SafehavenAU/morning-rows/actions/runs/39176195113),
workflow run number 9, attempt 1, started **18 October 2026 23:21:47 UTC**
(19 October 09:21:47 Australia/Brisbane). Its producer is current main revision
`51254f51e20a2afed572763045467e5b24c9003c`, a descendant of repair merge `5518c55`.
The real collector completed at **23:22:22.161 UTC**, which is the checkpoint's
`started_shadow_at`. Preserve both timestamps; the checkpoint uses completion
time for conservative elapsed-window calculations, not the nominal cron time.

## Independent watch and provenance

The existing hourly watchdog `6ad2f1fd41e481918b13871769eedd0f` woke at
`2026-10-18T23:30:22.707677+00:00`, after the scheduled collection. `watchdog.json`
records the enabled independent schedule and actual last-run timestamp, queried
during this verification. The collector's successful exit was not sufficient:
the watchdog downloaded both original artifacts through the GitHub connector,
used each returned Sediment `file_id` with `download_file`, checked ZIP digests,
validated the envelope, and replayed the complete state transition separately.
No collector dispatch, checkpoint write, recovery, Worker release or public
endpoint sweep was used. The existing watchdog schedule remains hourly; the
collector remains daily. No independently invented next-wake timestamp.

`runs.json` is the complete 14-run main-branch collection returned by
`https://api.github.com/repos/SafehavenAU/morning-rows/actions/runs?branch=main&per_page=30`.
Workflow path, main branch, run number, attempt and timestamps identify #9 as
newest, directly following manual #8. There are no intermediate collections,
recovery copies or notification-only writes. `check.yml` runs are excluded.
`attempt.json` is the original `/actions/runs/39176195113/attempts/1` response;
`jobs.json` records the actual successful collect job. Bootstrap, test queue and
acknowledgment steps were skipped. The run-list and attempt responses record
23:22:26 and 23:22:27 update timestamps respectively; both identify attempt 1.
`main.json` corroborates the producer as current main at observation time.

The checkpoint artifact is **12154666619**, archive SHA-256
`97380fa80a13ebe7f98f17c51578de58fa5b40ca39cdee7bf0e7ef6d220605ae`.
The evidence artifact is **12154532315**, archive SHA-256
`f0898fc7e9249441fa340e5d68298fbd67c23c79aaab6d74451e3776d8264768`.
Both were unexpired, attached to this exact run and producer. Original archives,
extracted checkpoint/report/summary/restoration audit and original GitHub
metadata are retained. The manifest hashes these files and the exact producer
modules/approvals/workflow used for replay. No signed redirect or credentials
are retained. Hash agreement protects integrity; GitHub remains a trust boundary.

## Continuity and state changes

The [reviewed recovery bridge](../checkpoint-recovery-2026-10-18/README.md)
remains the only historical exception. This run's `restored.json` has
`recovery: null` and restores artifact 12120081333 from run 39083249445, #8,
attempt 1, revision `5518c55d65ae71ccf7063bfd9de4ca9377ecffe2`.

| Field | Prior manual checkpoint | First scheduled checkpoint |
|---|---|---|
| Sequence | 3 | 4 |
| Digest | `644b38393bbd76e98ad77f4cf9dcb97595f273d2a9c0ed730a72e558f1bd93d9` | `aba5cf8b893790843e6d92468cb6d09c67b286c90edc2f70443d8fcf977f68a0` |
| Predecessor | `f0bb849f17ca59b57e831b7c9162d783142d18854478adb49b38d0d068314210` | `644b38393bbd76e98ad77f4cf9dcb97595f273d2a9c0ed730a72e558f1bd93d9` |
| Open incidents | 33 | 33, same identities and acknowledgment states |
| Pending repairs | 35 | 35, same keys |
| Outbox | One pending delivery test | Byte-equivalent event data, no receipt |
| Successful scheduled collections | 0 | 1 |

Exact `decodeCheckpoint` validates both envelopes. Producer-version `applyRun`
with the retained report and approved observations reproduces **every field**
of sequence 4, including counters, timestamps, historical runs, source evidence,
incidents, repairs and outbox. `comparison.json` records the result.
The only changed repair record is `verify:new-zealand/prices`: the contract-valid
period advances to 18 October, still interim, and independent verification
remains pending. Existing incident identities/open times/acknowledgments/severity
are retained; current last-seen and check fields follow the report exactly.
No new source notification was queued or sent.

All 20 required health/catalogue/desk requests returned 200, all 108 obligations
have both-domain outcomes, and no probe error occurred. Each of the eight desks
retains successful sources alongside its known publisher failures. These are
collector/storage/scheduling successes; they do not certify failing publishers.
Both domains report clean source `7d614e2e78a63fc16f705b67e35ed0438baa7d87`,
Worker `739b9031-305c-4bc7-afc5-79a82c654ac7`, fingerprint `44967a5319167783`.
The report retains normalized observations and request body hashes, not complete
HTTP bodies: replay verifies the state machine against retained collector
evidence, not independent re-extraction of all 108 publisher contracts.

## Same bounded verification contract; still blocked

Retain **NZ-PRICES**, selected before this wake. Its [risk ranking and falsifiable
contract](../nz-prices-2026-10-19/CONTRACT.md), original publisher-to-output mapping,
240-cell independent Python extraction, preview comparison and adversarial
failure tests remain in the [existing evidence record](../nz-prices-2026-10-19/README.md).
No other gap is selected, and no reader defect or release is implied.

The new collector report supplies both-domain observations, but for a **different
release** from the retained 17 October specimen: 18 October period 48, interim,
OTA2201 67.98, HAY2201 59.79, ISL2201 42.93, BEN2201 41.10, INV2201 39.06 NZD/MWh.
Both domains agree. This improves current operational evidence but cannot be
compared numerically as if it were the original 17 October release. The source
URL identifies `20261018_FinalEnergyPrices_I.csv`; retrieval times are
23:22:02.072 and 23:22:16.803 UTC, not publication or independent verification
times. No original 18 October CSV or separately presented official table was
acquired in this watchdog cycle. Do not silently rebase the selected specimen.

The separate CLA3WR presentation remains inaccessible in the retained bounded
attempts, and matched-period independent production reconciliation remains open.
Resume this same contract only with a usable official dated report/export or new
permitted access evidence. Prior CPU-plan replies do not acknowledge delivery.
The already-announced event
`12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6`
remains pending without a user receipt; do not repeat it or manufacture one.

## Reproduce and continue

From this evidence commit, with Node and Python available:

```sh
node verification/scheduled-cycle-2026-10-19/verify.mjs
python verification/nz-prices-2026-10-19/verify.py --test
```

The verifier checks original ZIP members, archive/envelope digests, full state
replay, run/attempt/workflow identity, restoration provenance, complete coverage,
production identity, retained incidents/repairs/outbox and independent wake.
It makes no network requests or checkpoint writes. After future runtime changes,
extract producer revision `51254f51e20a2afed572763045467e5b24c9003c` into a temporary
directory and set `PRODUCER_ROOT` to it; pinned module hashes must still match.

Seven-day acceptance remains **pending**: one complete scheduled run is observed,
not eight, and seven days have not elapsed. Count actual scheduled completions
from 18 October 23:22:22.161 UTC, with no gap over 26 hours and the real delivery
receipt required. The next complete-checkpoint deadline is
**20 October 01:22:22.161 UTC / 11:22:22.161 Brisbane**. The next nominal daily
collector is 19 October 23:17 UTC / 20 October 09:17 Brisbane, subject to GitHub
delay. Never accelerate it to obtain evidence. Seven days cannot elapse before
25 October 23:22:22.161 UTC, and elapsed time alone cannot pass acceptance.
The watchdog keeps checking quietly. Source alerts remain disabled; UK CPI and
US work remain outside this watch. The single data contract and broader
maintenance plan are not complete.
