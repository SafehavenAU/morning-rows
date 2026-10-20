# GAP2 — dated Bank of Canada reference rates

Implementation and original-source evidence are ready for root-owned integration
and protected Worker validation. This is not release acceptance, monitoring
activation or scheduled-operation evidence. The pre-code [contract](CONTRACT.md)
adds only `canada/exchange_history`; the existing four latest `exchange` pairs
are untouched.

## Original evidence

Official public responses acquired on 20 October 2026 request the inclusive
20 September–20 October window. There are **19 reported dates / 38 cells**, from
21 September through 19 October. The separately acquired `recent=1` response
matches both 19 October cells: USD/CAD1.4097 and GBP/CAD1.8767. This is a dated
specimen; runtime does not hardcode its dates, values or count.

[Independent verification](independent-report.json) uses Python stdlib JSON,
CSV, HTML and Decimal extraction without importing the runtime reader. All38
JSON cells equal the official CSV cells exactly. All10 values shown for these
two currencies in the official daily table (13–16 and19 October) also match.
The other28 cells have cross-format evidence, not a separate table comparison.
All formats share Bank of Canada financial-market lineage; this is extraction
and presentation independence, not independent price discovery. No rounding
allowance was necessary.

[Acquisition metadata](acquisition.json) retains exact public URLs, retrieval
instants, statuses, byte counts and full-response hashes. Only the selected
complete JSON/CSV responses, the latest anchor, selected table header/two rows,
and relevant methodology/reuse paragraphs are retained. Full-page hashes identify
the fetched pages; unrelated full-page HTML is not stored in the repository.
The extracted table does not retain unrelated currencies or personal content.
Original content is freely available from Bank of Canada under its linked terms.

No publisher release instant or immutable revision vintage is claimed. Missing
dates are not zero, not carried forward, and not automatically holidays. The
separate earlier research documents12 October as a holiday for its dated specimen;
this reader does not use that as a general business calendar.

## Runtime boundary and interface

`lib/boc-history.js` exports:

- `readBocHistory({fetcher, now}={})`: two concurrent official JSON requests, one
  explicit rolling31-calendar-day window and one latest-date anchor. A shared20s
  deadline and32KiB bound per response cap acquisition. Both must succeed.
- `parseBocHistory(windowJSON, latestJSON, {start,end})`: pure, clock-independent
  parsing with exact metadata, complete USD/GBP pairs and latest-tail agreement.
- `validateBocHistoryRepresentation(value, {retrieved_at})`: verifies the complete
  native semantic shape. When acquisition is supplied, its UTC day must match
  the native window; missing/malformed supplied clocks fail.
- `bocHistoryDefinitions()`: two definitions whose IDs are `FXUSDCAD` and
  `FXGBPCAD`; `bocHistoryWindow(UTCinstant)` and `bocHistoryUrls(window)` expose
  deterministic request bounds/URLs. Constants expose the two series,31 days
  and32768-byte response cap.

Native `rows` are date-sorted, then USD/GBP ordered. Each row has `series`, exact
`period` date, numeric `value`, publisher `value_text`, `unit` (`CAD per USD` or
`CAD per GBP`), `base_currency`, `quote_currency:'CAD'` and
`value_state:'observed'`. Native `latest_anchor` retains the two exact rows from the separate latest response;
public validation requires them to equal the window tail. Native `window` has
`start`, `end`, `calendar_days`;
`metadata` has date/observation counts and first/latest reported dates. Definitions,
meaning, reuse notice and separately hashed acquisition provenance remain visible.
No amount-conversion calculator is added. One revised historical cell changes
only that native row. Integration must exclude global window/provenance from
individual observation versions, and distinguish exact absent dates
`not_published_on_date` from `outside_window` and source failures. Root owns the
request-cache cap at UTC midnight and corresponding selector/schema controls.

A syntactically valid whole-date omission cannot be identified by inventing a
business calendar. The latest anchor detects stale tails, not all possible
missing historical dates. Complete-pair validation rejects partial cells. An
independent exact-specimen comparison detects lost specimen cells. This
limitation is explicit in both contract and tests.

## Validation and reproduction

From repository root:

```sh
python3 verification/gap-pass-2026-10-20/boc/verify-originals.py
node --test test/boc-history.test.js
```

The final focused reader run passed **86 tests/subtests**. It covers opposite
quote direction, metadata/series drift, invalid or out-of-window dates,
missing/duplicate pairs, unknown value flags, invalid numerics, stale/mixed
latest anchors, historical revisions, ordering, absent dates, leap/month/year
boundaries, representation mutation, byte limits, timeout/error propagation and
successful existing-source retention. The first run remains in
`reader-tests-initial.tap`:82 passed and1 failed because the historical fixture
path incorrectly resolved outside the repository. Only that test path was fixed;
`reader-tests.tap` retains the successful86/86 final run. Independent review then
found that native validation needed to preserve the separate latest anchor to
reject a truncated tail with adjusted metadata. The anchor is now retained and
checked. Additional tests cover that mutation, a missing anchor and acquisition
across UTC midnight. The reader refuses the latter before an old window can be
cached as current. No failed run is labelled passed.

The manifest hashes reader, focused tests, contract, extraction script and retained
evidence. No production HTTP, Cloudflare operations, credentials, deployment,
monitor activation or global-document edits were performed by this reader task.
