# Phase-one staged release evidence — 20 October 2026

**The subsequent production promotion failed and was rolled back. No new
production identity was accepted.** The dated composite staged gate passed for
source `ba0812b493f7cc4ca47a9f726211d96903bd9597`, Worker
`3eae0d8f-e4ad-4c31-97f2-6b98845e3ba9`, but both production domains then returned
AEMO HTTP 406 for SA1 and VIC1. [Failed-production and rollback evidence](failed-production/README.md)
retains that outcome without changing any original staged report.

Rollback deployment `5e200fe0-ae7e-4fdd-a557-ad951359dd8b` at
`2026-10-20T10:24:42.151362Z` restored accepted GDP source
`a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b`, Worker
`775bfe2d-491b-4bf5-a257-4d3465003351`. Both-domain clean health was confirmed
at `2026-10-20T10:26:38.391484+00:00`. This directory preserves original failed
runs and bounded confirmations byte for byte; it establishes neither scheduled
operation, seven-day acceptance nor delivery acknowledgment.

- [Composite decision](mr-gap-stage-acceptance-20261020/summary.json): combines
  the already-passed gates for that exact candidate with one bounded
  confirmation of the failed gap-interface gate. Its original proof hashes
  resolve through [the relocation manifest](packaging-manifest.json).
- [Original final-candidate run](mr-gap-staged-final-20261020/summary.json):
  remains `pass: false`. AEMO returned HTTP 406 for both selected regions, and
  the invocation stopped at `gap-capture`. Its earlier core, CPU, Stats NZ,
  claimant, rent and GDP results remain separate retained evidence.
- [Bounded confirmation](mr-gap-stage-bounded-confirmation-20261020/gap-interface-report.json):
  the same source and Worker passed 44 actual requests and 713 checks.
  [Offline numerical verification](mr-gap-stage-confirmation-numeric.json)
  passed 835 checks; [captured-schema verification](mr-gap-stage-confirmation-schemas.json)
  passed 27 documents and eight negative controls. These reports do not
  relabel or replace the original failure.
- [Superseded candidate](mr-gap-staged-validation-20261020/summary.json):
  source `6ac7515098ab2181289a44e182fbb7d960d738b0`, Worker
  `ce2feb6f-f0ce-404d-bfea-7ef85727a3fe`, stopped at the strict core-semantic
  gate. Its original captures and failure are retained as historical evidence,
  not counted as acceptance of the final source.

## Explicit SEPA availability exception

The final [strict semantic report](mr-gap-staged-final-20261020/staged-apex-semantic.json)
remains failed at 49 of 50 checks. The separate
[implementation release gate](mr-gap-staged-final-20261020/staged-apex-semantic-release-gate.json)
permits only the evidenced `scotland/river_level` HTTP 503 availability failure.
[Accepted-production comparison](mr-gap-sepa-baseline/report.json) and the
[one bounded earlier-candidate confirmation](mr-gap-sepa-confirmation/report.json)
also returned HTTP 503. The reader and fetch module blobs were unchanged.
No successful SEPA observation, recovery or strict 50/50 pass is claimed.
The [negative-control release gate](mr-gap-sepa-gate-negative-release-gate.json)
retains the refusal of a non-exempt semantic error.

## Preservation and reproducibility

[packaging-manifest.json](packaging-manifest.json) maps every original `/tmp`
path to its unchanged retained file and records byte length and SHA-256. Both
original runner manifests and every composite proof hash were rechecked during
packaging. The 382 original files occupy 22,352,551 logical bytes, with
9,395,033 unique content bytes. Original capture paths are retained because
the reports refer to them; identical content is identified by `same_bytes_as`
and is naturally deduplicated by Git. No compressed duplicate archive or new
validation output was added.

The original [release runner](mr-gap-release-validate-final.sh),
[semantic exception gate](mr-gap-core-semantic-gate.py), upload/stage logs,
runner logs, baseline/confirmation bodies and headers are included. Absolute
paths within those originals have deliberately not been rewritten. For offline
replay, map their `/tmp/` prefix to this directory using the manifest; the
release runner itself is retained as execution provenance and must not be run
merely to recreate captured evidence.

A scan of all retained originals found no credentials, private authentication
headers, signed download URLs or private preview tokens. No HTTP, test rerun,
deployment, infrastructure change, checkpoint write or notification occurred
while packaging. The failed production attempt and rollback are retained separately below;
no successful new production release is claimed. The read-only
[remaining-evidence audit](remaining-evidence-audit.json) explicitly accounts for
all 23 Stats NZ selections (11 exact references, 12 unresolved) and all eight
held-queue items, including the two phase-two readers whose release gates remain
pending.
