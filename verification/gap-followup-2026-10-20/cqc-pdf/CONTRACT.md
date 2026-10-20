# CQC fixed cohort — official GOV.UK PDF acquisition amendment

Written 20 October 2026 before a PDF reader or new Worker request. The held
[original cohort contract](../../remaining-gaps-2026-10-20/cqc/CONTRACT.md)
remains the semantic contract: State of Care 2024/25, published 24 October2025,
ratings published under CQC's single assessment framework as at **1 August2025**.
The five count categories are Inadequate125, Requires improvement809, Good2063,
Outstanding65 and Total3062 for the independently checked specimen. Counts may
be corrected within the exact edition only with new independent acceptance.
Do not hardcode them as a runtime fallback or interpret the fixture as live data.

The population is ratings for individual adult social-care services at a location
in England. It is not unique locations/providers/patients or an England service
census. CQC prioritised assessment by risk; this cohort is not representative of
all services, is not comparable with previous years, and must not be combined
with previous-framework location ratings. No percentages, quality rate, trend,
patient outcome, capacity or provider recommendations are introduced. The total
overlaps the categories and must not be added to them. Preserve attribution to
Care Quality Commission and its retained attributed OGLv3 reuse guidance.

## New permitted official route

Fetch the exact original linked GOV.UK asset once:
https://assets.publishing.service.gov.uk/media/68fa3b4fe200d653d8b63735/care-quality-commission-state-of-health-care-and-adult-social-care-England-2024-2025.pdf

One GET, no credentials, `redirect:manual`, reject all3xx, no retry/fallback,
20-second budget and **8MiB** decoded maximum. The independently downloaded
original is7,175,967bytes, SHA256
`61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef`.
A protected Worker access probe must retain actual status/bytes/hash/clock;
transport alone does not establish extraction, CPU or release acceptance.
Do not request the previously refused CQC workbook/report route.

The prior independent Python ZIP/XML workbook and separate SVG references
agree with the new original PDF's printed pages186–187 (PDF indices187–188):
Appendix CQC ratings charts and FigureA1 adult social-care overall ratings2025.
PyMuPDF independently extracted all four parenthesised counts and the narrative
total, exactzero-tolerance. These presentations share CQC administrative lineage.

## Falsifiable PDF extraction boundary

A runtime candidate may proceed only if a bounded structural PDF parser resolves
the real page tree, resources/fonts/character mappings, content streams and text
operators, including resource bounds and complete stream termination. It must
not regex compressed bytes, trust a filename/header/hash alone, read a static
extracted page instead of the live original, or accept a partially decompressed
page. All counts must be unambiguous native safe nonnegative integers, with the
four categories summing exactly to the separate narrative total; genuine zeros
must survive. Missing/suppressed/malformed/duplicate/changed labels fail.

Require the report title/England/edition, exact printed page/figure identity,
cohort date/framework, individual-service unit, risk/comparability qualifications
and publisher/source. Publication-date evidence must be explicit (actual PDF or
clearly disclosed retained same-edition official publication metadata), never an
invented PDF timestamp. Reject another edition/cohort/geography/meaning, mixed
pages, unsupported font encodings or filters, encryption, unsupported object
streams/cross-reference structures, external content references, malformed
stream lengths/termination and exceeded file/decompression/object/token/CPU
bounds. A general-purpose PDF dependency is not presumed acceptable; document
its actual bundle/CPU/resource cost before adding it.

First inspect actual structure offline and document the parser/resource design.
If a reliable bounded parser is impractical under the existing Worker budget,
record the concrete unresolved constraint rather than approximate or activate.
An implemented candidate must pass original-byte parsing, adversarial malformed
PDF/meaning/numerical controls and actual protected execution before integration.
Root owns integration, versioned release, both-domain regression and monitoring.
This amendment changes no source activation, credentials, schedules or alerts.

## Exact-byte fixed-edition safety guard (pre-activation design refinement)

Offline inspection found 205 pages, 22,505 cross-reference entries, two
compressed xref sections and selected chart text in 79 nested Form executions.
A real bounded object/text parser extracts all five values, but arbitrary PDF
rendering equivalence would also require font-program metrics, page annotation
appearances, clipping, transparency and text-dependent glyph extents. A partial
layout hash is insufficient. This candidate therefore requires the **complete
original 7,175,967-byte SHA256 above in addition to structural extraction**.
Every returned count still comes from the acquired PDF, not stored figures.
Any changed byte, even a harmless publisher re-save, refuses pending a fresh
independent review. No automatic numerical revision tolerance is claimed.

The pure parser may inspect explicitly constructed statistical-only fixtures for
adversarial tests; these never pass the live acquisition digest/provenance guard.
The public representation validator requires exact original-byte provenance when
a public acquisition clock is supplied. The parser's internal numeric semantics
preserve genuine zero and reject missingness; a future original containing zero
still needs explicit edition-byte reapproval. No runtime fixture substitution.

Only existing fflate 0.8.3 is used. Bounds: 8 MiB original, 32,768 xref entries,
four xref sections, 2,048 resolved objects, 2 MiB cumulative selected inflation,
256 KiB per object stream, 64 KiB per content stream, 16 KiB per Unicode CMap,
160 Form executions / depth 10, 30,000 operators and 2,048 text records. Complete
DEFLATE termination and Adler32 are checked. The 500 ms actual Worker CPU gate
remains separate; local wall-time observations are not CPU acceptance.
