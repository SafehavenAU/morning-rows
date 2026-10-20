# External dated AEMO evidence preparation

**Current status: blocked after the single authorized 18:06 UTC index request.**
See `STATUS.md` and `evidence/failure-manifest.json`. The required 20 October
bundle was absent; no numerical oracle or successful checker manifest exists.
The attempt marker prevents repeating the acquisition. The commands below are
preserved preparation, not authorization to retry.

All files here are outside the repository. The frozen runtime candidate is not
changed. Original 19 October evidence is preserved in its existing directory.

Acquisition is a single, guarded attempt:

```sh
python /tmp/mr-aemo-next-day/acquire.py
python /tmp/mr-aemo-next-day/audit-acquisition.py
python /tmp/mr-aemo-next-day/extract.py /tmp/mr-aemo-next-day/evidence/independent-rounding.json
python /tmp/mr-aemo-next-day/prepare-checkers.py
```

The first command refuses before actual 20 October 2026 18:06 UTC, after
21 October 14:00 UTC, or if its exclusive attempt marker already exists.
If either required advertised trading bundle is missing, retain the failure;
do not remove the marker or run another index request.
The next commands are conditional on the first succeeding. They make no HTTP
requests. Generated checkers contain the literal hash of the new exact oracle.

After successful independent extraction, parent-controlled actual-reader,
resource and release workflows may use:

```sh
node /tmp/mr-aemo-next-day/tools/check-aemo-daily-bundles.mjs OUTPUT REVISION VERSION staged
node /tmp/mr-aemo-next-day/tools/verify-captures.mjs CAPTURE OUTPUT REVISION VERSION staged
python /tmp/mr-aemo-next-day/tools/verify-numbers.py CAPTURE OUTPUT REVISION VERSION staged
MR_REPO=/workspace/morning-rows-aemo-followup python /tmp/mr-aemo-next-day/tools/verify-schemas.py CAPTURE OUTPUT REVISION VERSION staged
```

Omit `staged` only for separately authorized production validation after exact
version promotion. The tools make no promotion or checkpoint write. No capture
is authorized or performed merely by preparing these instructions.

Only the existing schema helper needs `MR_REPO`; reference originals resolve
relative to this package, so a later evidence-only copy can remain portable.
Parent owns dated amendments to the combined release's `day-gate.mjs`,
`clock-controls.mjs`, `audit-reports.mjs` and `audit-controls.py`, preserving
unrelated BoC references. All actual source clocks must fall inside the new
20 October eligibility window.

The 20 October oracle reports 576 independently extracted original intervals,
576 same-publication layout agreements and ten summaries. The parent authorized
one ordinary workspace acquisition of each retained exact October SA1/VIC1
monthly URL at 17:56 UTC. Preparation requires all 576 new monthly cent
comparisons and ten independently derived summaries before emitting any
successful oracle or public checker. No old 19 October comparison or future
approval transfers to this date; missing evidence leaves acceptance unresolved.
