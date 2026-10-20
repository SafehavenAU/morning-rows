# National claimant-count history

The user authorized continued building after the Workers Paid upgrade. This
bounded addition serves thirteen monthly administrative claimant counts for the
UK and each constituent nation through `source=claimant_count&measure=claimants`.
It adds no country desk, credential, infrastructure or paid data source.

The [contract](CONTRACT.md) was written before runtime changes. The source is
Nomis `NM_162_1`, all sexes, age 16+, measure1, value20100, rounded to five persons,
not seasonally adjusted. Claimants are not an unemployment estimate, claimant
rate or estimate of available recruits.

## Original evidence

The independent Python extraction compares all65 original CSV cells with the
separately acquired official JSON. The initial dated window is August2025 to
August2026. One independently presented NISRA table cell matches the Northern
Ireland latest rounded count exactly. The remaining thirteen NISRA headline
values have different classification/rounding and are retained as context, not
claimed as exact comparisons. All presentations share administrative lineage.
See [the acquisition record and limitations](original/README.md) and
`independent-report.json`.

The publisher response-generation clock is not a release timestamp. Runtime
records preserve the publisher's unzoned reference/revision timestamps without
inventing UTC offsets. The live time codelist anchors the latest window; a
scheduled future release never advances it by itself.

The URN month guard uses the encoding `year*16+month`, observed consistently in
all65 retained CSV/JSON pairs. This is an explicitly inferred fail-closed identity
check, not a claim of universal documented Nomis encoding. A change requires
review; contradictory month identities are not silently accepted.

## Implementation and verification

The source validates the whole65-cell acquisition before selecting one nation's
thirteen rows. Response bytes and runtime are bounded; malformed, suppressed,
partial or contradictory data fails this source while successful siblings remain.
Source and measure selections retain all thirteen rows; an exact month selects
one row or returns404. Unsupported date/geography filters return400.

Individual observation versions retain values, definitions and revision metadata,
but exclude acquisition hashes and native row offsets. Source context retains
raw acquisition hashes for audit. ETags represent the returned content, including
that provenance; they are not an official statistical-revision classification.

Local tests and protected Cloudflare fault cases cover wrong dimensions and
geographies, malformed CSV/JSON, incomplete coverage, stale-window substitution,
suppression, zero, URN contradictions, revisions and failed transport. The initial
fault preview was captured during implementation; `fault-preview.json` is the
final run and additionally requires unchanged code and fixture hashes throughout.
It proves constructed fault behavior, not live publisher access.

## Release gates

At this preparation commit, live final-version retrieval, CPU, both-domain
acceptance and production promotion remain pending. The1,000ms Worker ceiling
is unchanged; each cold legacy desk must remain within500ms and USA within100ms.
A second fresh claimant acquisition must pass on an untouched domain cache key.

The monitoring implementation stages five new obligations, activating them only
through an exact reviewed continuation of the existing USA release bridge.
Activation increases109 to114 obligations while retaining24 public probes.
No manual collection, checkpoint write, notification acknowledgment, schedule
change or source-alert enablement is part of this build.

The latest independently verified checkpoint remains sequence5,
digest `665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f`,
run39341442350, completed2026-10-19T23:26:10.163Z. Its33 incidents,36 repairs,
delivery outbox and original SHADOW start are preserved. There are two actual
scheduled cycles and no USA/claimant scheduled observations. NZ-PRICES,
UK CPI, the genuine delivery receipt and sustained operational gates remain open.
