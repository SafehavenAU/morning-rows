# GAP2 — bounded Bank of Canada dated exchange rates

Recorded 20 October 2026 before implementation. This contract adds only
`canada/exchange_history`; the existing four latest `exchange` pairs remain
unchanged. The user authorized the gap-list pass. No key, signup, new
infrastructure, publisher contact or automatic release is authorized here.

## Exact question and meaning

Return the official indicative daily average for `FXUSDCAD` or `FXGBPCAD` on an
exact publisher observation date, or the reported observations in a recent
window. These are CAD per one USD or one GBP, respectively. The observation
population is the Bank's aggregated financial-institution price quotes; the
geographic label identifies Canada as quote-currency jurisdiction, not a local
transaction population. These are nominal, not seasonally adjusted reference
rates, not executable prices, tax advice or a supplied conversion calculator.
No inversion, interpolation, carry-forward, arithmetic transformation or history
archive is permitted.

The publisher's date `d` is a calendar date (`YYYY-MM-DD`), not a UTC timestamp.
The requested window is exactly 31 inclusive calendar dates ending at request
UTC day. UTC determines request bounds only. This includes a possibly not-yet-
published current date. Business-daily publication is normally by 16:30 Eastern
Time, but extraordinary conditions or technical issues may delay it. Do not
manufacture an actual publication instant, next expected deadline, business-day
calendar or an age-since-value-change rule.

## Publisher identity and coverage

Use exactly `https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXGBPCAD/json`
with either explicit `start_date` and `end_date`, or `recent=1`. The latter is a
current-publisher anchor: one date and both rate cells must match the last date
of the requested window. Retain these two anchor rows in the native representation
and require continued exact tail agreement during public validation. Two successful
responses are required; a failed anchor
is a source failure, never permission to substitute retained data.

Both responses must identify exactly the two selected series. Require the
publisher labels USD/CAD and GBP/CAD, the corresponding exact daily-average
Canadian-dollar descriptions, dimension `d`/Date, `dateFormat=daily`, unit
`Canadian dollars per US dollar` or `Canadian dollars per UK pound sterling`,
frequency `Business daily`, and the Bank's terms URL. Unknown observation cell
fields/flags, wrong or extra series, duplicate dates, invalid dates, outside-
window/future dates, missing series cells, blank/suppressed/nonfinite/zero or
negative rates fail closed. Decimal strings are preserved with their numeric
value; scientific notation, thousands separators and whitespace are rejected.
All dates must contain both currencies; at most 31 dates / 62 cells are allowed.
Normalize input order into ascending date then fixed USD/GBP series order.

A whole date absent from otherwise validated publisher responses is
`not_published_on_date`, not zero and not an inferred holiday. A syntactically
complete response cannot prove an omitted whole date should have existed. The
latest anchor prevents stale tail substitution but does not establish a full
business calendar. Exact dates outside the returned window are unavailable,
never silently mapped to a nearby date. Transport/metadata/malformed/partial
cell errors remain source failures and must not discard successful siblings.

## Revisions, bounds and provenance

Published values may change; no immutable vintage or finality guarantee has
been established. Preserve exact value strings and per-cell identity. A changed
historical rate is a changed observation, not retrieval noise. Acquisition
clocks, raw-response hashes and rolling-window bounds do not enter an individual
rate's statistical version. Full response ETags may reflect acquisition context.
Retain request URLs, role, retrieval instants, byte counts and SHA-256 separately.
Use one shared 20-second deadline and a 32 KiB bound for each of the two responses;
never read an unbounded body or follow an unexpected redirect. Refuse a request
that completes across UTC midnight; retry with the new window rather than cache an
old window as current. Future observation
dates fail. Retrieval-only metadata cannot imply independent verification.

## Evidence and falsifiable acceptance

The 20 October specimen requests 20 September through 20 October 2026. It contains
19 dates / 38 cells, 21 September through 19 October. This count is a dated
acceptance specimen, not a permanent runtime count. Use Python stdlib `json`,
`csv`, `html.parser` and `decimal` as a separate extractor, importing no runtime
reader. Match every one of the 38 JSON cells exactly to the independently parsed
official CSV. Match all ten selected USD/GBP cells in the separately presented
latest-five-day official table (13–16 and 19 October). Require exact series/date/
quote metadata and exact decimal equality; no rounding tolerance is needed.
Retain the current official-table header and selected two rows only, plus minimal
permitted methodology/reuse text with full-response acquisition hashes. Earlier
12 October holiday evidence remains dated historical research; runtime does not
generalize that holiday label to other absent dates.

All presentations share Bank of Canada financial-market lineage. CSV and JSON
may share the same publisher service. Separate extraction and official table
presentation strengthen mapping, not independent price discovery. The table
comparison covers ten of the 38 cells; full-window cross-format comparison covers
all 38. Do not claim a separately presented table validates the other 28.

Meaningful failure tests must cover opposite quote direction, changed frequency,
wrong currency, misplaced/missing/duplicate date, partial pair, suppression and
invalid numbers, stale anchor/window disagreement, old whole-window substitution,
changed historical rate, valid input reordering, absent date without holiday
inference, dynamic month/year/leap boundaries, acquisition bounds/timeouts and
sibling-source isolation. Pure parsing remains clock-independent; acquisition
and public validation require consistent, finite UTC retrieval time when supplied.
Protected Worker preview, integration/schema/version controls, both-domain
regressions and the established release workflow remain root-owned gates. Local
tests and evidence alone do not release or activate monitoring.

## Reuse

Attribute Bank of Canada and link https://www.bankofcanada.ca/terms/. Preserve
accurate presentation, identify any changes, and state that original information
is available free from the Bank. No Bank logo/wordmark or unrelated page content
is reused. Source qualification remains visible in selected responses.
