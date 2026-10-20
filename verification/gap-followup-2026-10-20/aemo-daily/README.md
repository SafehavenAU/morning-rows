# AEMO completed day: daily-bundle candidate

This unreleased integrated candidate replaces only acquisition for the held SA1/VIC1
completed-day contract. **No new production or scheduled acceptance is asserted.**
The older monthly reader, HTTP 406 failure and rollback remain intact. The
[contract](CONTRACT.md) was written before this module; it preserves the same
latest fully elapsed fixed-AEST calendar day and ten cent-based summaries.

The official directory advertises both required daily files. Their original
ZIP bytes are retained in [original/](original/) because archive/framing/resource
checks require more than an extracted selected-row fixture. Only public regional
aggregate data is present. The directory's title and listing were retained as a
minimal excerpt, with the full original response hash; unrelated telemetry code
is omitted. The two historical protected Worker GETs in
[worker-access-only.json](original/worker-access-only.json) prove fixed-file
access only, not this new reader or current dynamic discovery.

The publisher's [report definition](original/public-prices-definition.yaml),
acquired through its ordinary public interface and advertised metadata links,
explicitly describes next-day daily dispatch reports. It defines DREGION layouts
2 and 3, RRP after capping/flooring/scaling at NUMBER(15,5), APC flags and market
suspension flags. The file also contains separate TREGION definitions; this
candidate does not accept them. Source framing and fields are required, rather
than treating any report in the family as equivalent. See
[acquisition](original/public-prices-metadata-acquisition.json) and
[discovery chain](original/metadata-discovery.json).

The independent [Python review](review/verify-rounding.py) reads original ZIPs
with `zipfile`, CSV and Decimal, without importing the runtime reader. All **576**
19 October 2026 daily prices, after exact half-away-from-zero cent rounding,
match the independently retained monthly `TRADE` prices exactly; both DREGION
layouts agree. All **ten** independently derived summaries match. This checks
selection, units, time coverage and rounding across separate presentations that
share AEMO market lineage. It does not independently calculate market prices or
certify future vintages. See [comparison report](review/independent-rounding.json).

The new parser/reader passes **101 local tests**, including shared three-request
acquisition, strict ZIP/CRC/stream bounds, layout agreement, signed scientific
notation and half-cent rounding, before-publication refusal, regional isolation,
wrong flags/dates/coverage, malformed provenance and final midnight crossing.
See [local validation](local-validation.json) and [test log](local-tests.txt).
The [initial 97/98 test attempt](initial-test-attempt.txt) remains a failed harness
attempt: its footer mutation did not match the original quoted footer, leaving
that negative fixture unchanged. The corrected control is included in the
passing suite; the historical result has not been relabelled.

The unchanged reader subsequently passed **37 protected Cloudflare cases and
291 assertions**, including one live three-request acquisition at
12:50:13–17 UTC on 20 October. All 576 raw/rounded cells and ten summaries matched
the retained originals. The [protected result](protected-preview/RESULT.json)
and its 57-file manifest are retained; an independent local rehash found no
changes. This establishes actual reader correctness/access for that acquisition.
CPU and memory peaks were not measured by that proof, and production acceptance
remains pending.

The reader makes one index and two shared ZIP requests with truthful Accept
headers, manual redirect refusal, a 20-second bound per request and no monthly
fallback/retry. It refuses multiple advertised files for one needed trading date
rather than guessing revision ordering. Each successful region retains all 288
raw and rounded intervals, both layout tokens, actual source-bundle identities,
run/intervention/flags and recomputable summaries. Missingness is never zero.
A corrupt global archive prevents reconstruction; a region-specific bad cell
preserves a complete valid sibling with degraded status.

Generation timestamps are source labels in fixed AEST, not asserted publication
times. No FIRM, TRADE source field, guaranteed update schedule or finality is
invented. Prices remain potentially revisable, and the latest elapsed day can be
unavailable until both trading-day bundles have been published.

## Integration handoff

Exports from `lib/aemo-daily-bundles.js`:

- `discoverAemoDailyBundles(indexText, {now})` returns the two complete advertised
  descriptor objects in trading-date order; no network.
- `parseAemoDailyBundles([{url, data: Uint8Array}, ...], {now})` parses the two ZIPs
  and returns native regions/definitions/bundle metadata with empty provenance.
  Pure parsing is not a successful public acquisition.
- `readAemoDailyBundles({fetcher = fetchOfficial, now})` acquires index plus two
  shared ZIPs, adds wire/member SHA256/size/time provenance, and checks the clock
  after parsing/hashing and after validation. Root may isolate thrown global
  failures through the existing section-reader mechanism.
- `validateAemoDailyBundlesRepresentation(value, {now})` requires an explicit
  public acquisition clock and all three provenance entries. Omitting the second
  argument permits local pure-parser evidence only; explicitly passing undefined
  is rejected. Public acquisition clocks must represent completion, not a
  pre-fetch invocation timestamp.
- `aemoDailyBundleDefinitions()` provides ten stable derived measure definitions.
- `aemoDailyBundleObservationRows(value)` provides successful-region typed rows
  with both `measure` and `measure_id`, exact date and qualifiers. Failed regions
  contribute no observation rows.
- `aemoDailyBundleClock(now)` and `aemoDailyBundleCacheSeconds(now, maximum)` retain
  fixed-AEST midnight invalidation.

Native `regions` preserve the existing region/summary shape but replace a
monthly `period_type` claim with actual DREGION dataset/run/flag/layout fields.
`source_url` identifies the daily directory and `source_urls` identifies both
actual ZIPs; each interval identifies its contributing ZIP. Top-level `bundles`
and `provenance` retain generation/member/resource evidence. `published_at`,
`publisher_updated_at` and `next_expected_update` remain null.

The pre-code [integration amendment](INTEGRATION-CONTRACT.md) covers the
Worker's shared daily acquisition, inventory, ten typed selectors, independent
schema, source-health agreement and cache boundary. **47 affected integration
tests** passed with the real schema installer, including all ten numeric native
pointers, regional failure isolation, unchanged-value versions, preservation of
the legacy grid, forged-cache refusal, desk acquisition crossing midnight and
conditional-response hashing crossing midnight. Cache TTL is clipped again
after hashing. See [interface handoff](INTERFACE-HANDOFF.md).

Staged full-desk/resource validation, fresh exact independent comparison,
both-domain regression checks, exact reviewed promotion and monitoring
integration remain parent-owned release gates. No preview, local check or
independent comparison establishes a scheduled cycle or authorizes a checkpoint
reset, receipt, source alert or schedule change.
