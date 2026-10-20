# Composed v2 response fingerprints — before implementation

19 October 2026. USA remains an unreleased candidate. Its selected response hashes
repeat the complete observation definitions in observation versions, the content
version and the ETag. This experiment removes the latter repetitions. It does not
change v1, publisher data, the statistical contract or observation-version bytes.

Each observation version stays SHA-256 of its exact canonical semantic record,
including dimensions, period, value, missingness, notes and attribution. The
selected content version becomes SHA-256 of the canonical object containing
`data`, `context`, `retrieval`, and the ordered `observations` references
`[{id,version},...]`. All fields remain bound: the observation version covers the
whole observation; the other three objects are covered directly. Retrieval times
are omitted by the existing semantic rule. State, errors and qualifications are
never omitted. Public `content_version_basis` identifies this algorithm as
`sha256-canonical-observation-references-v1`.

For a successful selection, the ETag hashes all top-level envelope fields except
`data`, `context`, `retrieval`, and `observations`, which are bound by its included
content version. Full-desk, catalogue, HTML and error fingerprints keep the
existing algorithm. Only a validated successful selection may use composition.

Pass criteria: observation versions equal the original algorithm exactly; changes
to values, missingness, footnotes, attribution, context/provenance or retrieval
status change the appropriate content version and ETag. New retrieval time alone
changes neither. Wrong geography/units/population/period or partial coverage must
still refuse the representation; failures never return304. Compare composed
hashes with independently rebuilt reference inputs in tests; preserve exact
GET/HEAD/conditional behavior and legacy responses. Actual Cloudflare CPU must
be <=10ms, with fresh confirmation captures, before any release. Retain every
sample, including failures; this amendment cannot waive the resource gate.

## Outcome

This experiment is **not retained in runtime**. It passed172 local tests and22
protected Cloudflare integration scenarios, but cold CPU measured19ms. The later
full-desk/catalogue override requests reached the approved production version
instead, so the capture is explicitly incomplete and cannot pass any release
gate. The matching cold selected-request trace itself records19ms. Deployment
metadata still showed approved100%/candidate0%; no unauthorized promotion occurred.
The previous response fingerprint algorithm is restored. The extra generic hash
helper and raw-byte hashing experiments are also removed: their captures measured
14ms and17ms respectively, with no demonstrated budget improvement. Their exact
reports remain retained. The simpler lexical-sort, JSON fast path, bounded native
byte read and minification optimizations remain; best observed coldCPU12ms.
