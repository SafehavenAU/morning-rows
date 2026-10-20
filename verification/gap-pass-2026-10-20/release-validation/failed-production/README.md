# Failed production promotion and rollback

The candidate source `ba0812b493f7cc4ca47a9f726211d96903bd9597` / Worker
`3eae0d8f-e4ad-4c31-97f2-6b98845e3ba9` was promoted for production validation,
**failed acceptance, and was rolled back**. The original staged composite remains
a dated staged result only; it is not a successful production release.

The retained [production invocation](mr-gap-production-20261020/summary.json)
remains `pass: false`. Both apex and www native captures contain explicit
`grid_day` source errors: AEMO HTTP 406 for both SA1 and VIC1. No earlier day or
fixture was substituted. The production invocation stopped at the core-semantic
step. Its separate SEPA outcome was a timeout without `http_status`, differing
from the earlier retained 503; the original wrapper itself records
`release_gate_pass: false` and error `'http_status'`. These failures are not
relabeled as passes by later helper changes.

[Promotion log](mr-gap-promotion-20261020.log),
[deployment listing after promotion](mr-gap-deployments-after-promotion.json),
[rollback log](mr-gap-rollback-20261020.log) and
[deployment listing after rollback](mr-gap-deployments-after-rollback.json)
retain the actual transition. Rollback deployment
`5e200fe0-ae7e-4fdd-a557-ad951359dd8b` at `2026-10-20T10:24:42.151362Z`
restored accepted GDP source `a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b`,
Worker `775bfe2d-491b-4bf5-a257-4d3465003351`, fingerprint
`fc27e14328f2c397`. [Both-domain health proof](mr-gap-rollback-proof-20261020/report.json)
confirms that clean identity at `2026-10-20T10:26:38.391484+00:00`. Health identity
alone is not a new whole-site source sweep.

The original [production health gate](mr-gap-production-health-gate.py),
[constructed decision controls](mr-gap-production-health-gate-controls.json),
[constructed GDP geography control](mr-gap-production-health-gate-gdp-geography-control.json)
and [production runner](mr-gap-release-validate-production.sh) are preserved as
executed/reviewed at this boundary. They are not rewritten when a later bounded
availability gate is corrected. Constructed controls are not publisher or
production success evidence.

[packaging-manifest.json](packaging-manifest.json) records all 183 original
files, their original paths, byte lengths and SHA-256 digests. Every original
production runner file binding and both rollback body hashes were checked, as
was the health-control helper hash. Sensitive-content scans found no credentials,
private authentication headers, signed URLs or private preview tokens. Absolute
paths inside original files remain unchanged; replace their `/tmp/` prefix with
this directory when resolving retained evidence. Packaging made no HTTP request,
validation rerun, deployment, checkpoint, receipt or notification change.
