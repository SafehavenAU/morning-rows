# CQC original-PDF fixed-cohort candidate

The actual protected Cloudflare reader passed **19 controls**, including one live
original-PDF acquisition and all **five values** independently reconciled with
PyMuPDF extraction and the retained official workbook/SVG references. This is a
candidate implementation. It is not activated or released here; full England
desk CPU, exact staged version and production acceptance remain root-owned gates.

The [contract](CONTRACT.md) was written before the new request and reader. It
preserves the 1 August 2025 single-assessment-framework cohort in *State of Care
2024/25*: Inadequate125, Requires improvement809, Good2063, Outstanding65 and
Total3062 for the reviewed original. These are ratings of individual adult
social-care services at a location in England. Risk-prioritised assessments are
not a representative national census, unique-provider/location counts or a
comparable historical quality series. The total overlaps its four categories.
No percentages or provider recommendations are added. CQC/OGLv3 attribution and
qualifications remain on the native source, definitions and selected records.

## Original and independent evidence

The ordinary no-key GOV.UK PDF route returned HTTP200 from both the workspace and
protected Worker. The full original is7,175,967bytes, SHA256
`61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef`.
It has205pages. Only the aggregate statistical excerpt, extracted text and two
rendered page images are retained; the complete report remains outside Git to
avoid copying unrelated case/contact content. Repackaged excerpts and the
structural fixture are explicitly not original wire bytes or runtime fallbacks.

- [Original acquisition and prior PDF/workbook comparison](original/comparison.json)
  preserve their earlier evidence boundary unchanged.
- [Independent current reader comparison](independent-reader-comparison.json)
  binds the full original, earlier Python ZIP/XML workbook and SVG reference,
  and actual protected Worker result. All five counts agree with zero tolerance.
- [Visual provenance](original/visual-provenance.json) binds renders made directly
  from the full original, PDF indices187–188 / printed pages186–187. Visual
  inspection confirmed visible labels/counts, narrative total, exact cohort,
  service-versus-location unit and risk/comparability qualifications.
- [Independent Python verifier](verify-original-pdf.py) imports no runtime parser.
  The PDF and JavaScript readers use different extraction methods on the same
  original; workbook/SVG/PDF presentations still share CQC administrative lineage.

Publication24October2025 is explicitly anchored to retained same-edition official
publication metadata. The PDF's23October printing date is not relabelled as its
publication date. No live workbook acquisition or newly verified later edition
is claimed, and the previously refused CQC workbook remains unused.

## Bounded implementation and validation

The reader uses the existing pinned fflate0.8.3 dependency. It resolves real
cross-reference/object streams, the page tree, resource/font/Unicode mappings,
Form content and text operators. The full original resolves two xref sections,
22,505 entries,371 objects,79 Form executions and2,260 operators; selected
inflation is201,307bytes. File, inflation, object, recursion and token bounds plus
complete DEFLATE termination and Adler32 checks fail closed.

Independent review found that a partial layout hash could miss font, annotation,
clipping or glyph-extent changes. The live reader therefore requires the **exact
full-body digest in addition to structural extraction**. Every value is derived
from the acquired original; no stored figures are returned on failure. Any changed
byte, including a harmless re-save, requires a fresh reviewed evidence update.
This is deliberately not a general PDF renderer or automatically revising feed.
The pure fixture parser preserves a genuine zero, but changed publisher bytes
still cannot pass live acquisition until explicitly reviewed.

[Reader tests](reader-tests.tap) pass57cases; real incremental-PDF mutations cover
missing/suppressed/negative/fractional counts, coherent zero, wrong total/category/
cohort/geography/unit, invisibility, duplicate values, font changes, malformed
xref/DEFLATE and resource bounds. Transport and public-clock tests cover redirects,
changed bytes, oversized responses, timeouts and exact original provenance.
[Adapter tests](adapter-tests.tap) pass six groups, including36 independent schema
cases. [NI regression tests](ni-regression-tests.tap) pass four groups with26schema
cases. The unchanged SFC/CMHC selected-response schema gate passed63cases in the
preserved broader run; its stale held-CQC assertion is explicitly updated by the
shared integration patch. The generated schema remains705,771bytes.

[Actual protected reader proof](worker-reader.json) ran at
2026-10-20T12:58:46.654Z–12:58:46.684Z, made one publisher GET, passed19controls and
retained unchanged code-input hashes. Its500ms configured limit is not a measured
CPU result. Local wall times are not Worker CPU acceptance. The exact candidate's
full England acquisition must pass the existing CPU gate before release.

[Tooling attempt history](tooling-attempts.json) preserves a preflight path mistake
before any remote request, a local independent-extractor ordering assertion and
the initial broader test setup/held-assertion failures. Original failed evidence
is retained, not overwritten or represented as a passing runtime attempt.

## Integration handoff

Owned code: `lib/cqc-pdf.js`, `lib/remaining-information.js`,
`lib/remaining-schema.js`, and the two dedicated CQC test files. Public source is
`england/care_assessment_cohort`; five measure IDs are `inadequate`,
`requires_improvement`, `good`, `outstanding`, `total`; exact observation is
`2025-08-01`. Source selection retains the whole native object; measure/exact
selection returns one native row. Schema prefix is `remainingCqc` and public
acquisition provenance requires the exact PDF URL/size/digest and real clock.

[Shared integration patch](shared-integration.patch) is provided for root to
apply when combining candidates. It wires the England task with a completion
clock, inventory, public wording and historical workbook note, and updates two
stale held-CQC test assertions. It is not applied in this isolated worktree.
There are no monitoring, checkpoint, credential, schedule or release writes here.
