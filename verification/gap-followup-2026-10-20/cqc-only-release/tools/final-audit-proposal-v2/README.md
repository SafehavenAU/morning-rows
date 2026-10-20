# Proposed final CQC committed-tree audit — revision 2

This explicit revision adds the eighth active update, `operations/source-contract-registry.json`, which will advance from 119 to 120 obligations only after actual acceptance. Its exact source-7d7 original is retained by SHA-256 `14cb64414507374bac8d230d25328549128c640bbb4f8479f125e2212d832bf7` (760,261 bytes); both prior audit configurations pin those bytes. The original proposal at `/tmp/mr-cqc-final-audit-proposal` and its frozen tool manifest `37fb3ea442b15e1ae70f0aa0162822088cb2bb8d2c0eaff661ddc92b802f2d5b` remain unchanged.

This directory is outside the repository. Nothing here has copied into the repository, changed a commit, performed remote calls or established final acceptance.

The previous accepted NI **final** audit is `/tmp/mr-ni-final-remote-committed-evidence-audit.json`: exact evidence commit `ee599a447a4de49d371a809c7aef690e2f3a01d7`, 1,729 files and 1,335 direct manifest records, config SHA-256 `93932952b84bb5493dfd701354a1db6d8cac9f4084ceb02c867058d0d3db2fff`. The repository's retained `release-validation/source/audit-config.json` is an earlier 397-file source boundary, not that final audit.

Current CQC source is exact `7d7ed892c469d6f589dabf52283fc31dfef98d8a`: 593 files, 87 direct manifest records and 576 custom manifest relationships. Do not call that source subset the full release evidence tree. The existing committed-tree verifier checks direct manifests and flattened `additional_files`, but does not separately interpret `custom_manifest_bindings`.

## Prepared historical payload

`copy-files.json` proposes 25 exact files under the eventual package root `verification/gap-followup-2026-10-20/cqc-only-release`:

- Twelve exact NI Git blobs for runtime/test files whose active paths changed during CQC development.
- Eight exact current-source Git blobs for the planned operational/document append paths.
- Both prior audit configurations and their matching actual committed-tree audit reports.
- One explicit original-path + SHA-256 relocation ledger, recording source commits and Git object IDs.

Existing committed historical/`.source`/`.snapshot` candidates were checked first; none matched these twenty original byte/hash pairs. The payload is in `payload/` and has not been installed. Add each exact source from `copy-files.json` to the final packager's explicit auxiliary file inputs, retaining the declared destination after removing the package-root prefix. Do not append these as unbound files after packaging. Do not edit original manifests to point at new source bytes.

The anticipated changed active paths are:

```
operations/source-contract-registry.json
operations/us-release-review.json
operations/approved-observations.json
operations/acceptance.json
verification/monitoring-baseline.json
HANDOFF.md
GAP-LEDGER.md
verification/gap-followup-2026-10-20/cqc-only/README.md
```

Additional overwritten historical paths require an explicit exact-byte snapshot and reviewed relocation; they must not be silently rebound.

## Final procedure after the accepted package exists

1. Materialize the final evidence package with the historical payload included and apply the approved operational/document updates.
2. Run this outside-repository preparation script:

```sh
python /tmp/mr-cqc-final-audit-proposal-v2/build-final-audit.py \
  /workspace/morning-rows-aemo-followup /tmp/NEW-cqc-final-preparation
```

It requires the final package manifest, preserves the prior NI and CQC configurations, verifies every prior pin through identity or explicit relocation, reconstructs all 576 custom associations against their original JSON declaration/path/hash, and emits an exact physical inventory/add-list. It writes only its new outside-repository output. Original failed evidence is hash-bound without changing its outcome.

3. Review the exact add-list, including ignored required logs; commit the actual final evidence/document tree through the established root workflow.
4. Audit that exact 40-character commit:

```sh
python /tmp/mr-cqc-final-audit-proposal-v2/verify-final-union.py \
  /workspace/morning-rows-aemo-followup EXACT_COMMIT \
  /tmp/NEW-cqc-final-preparation/audit-config.json /tmp/NEW-cqc-final-audit.json
```

The wrapper executes the existing committed-tree verifier from the exact target Git tree. It then independently checks 2,310 prior-config pin relationships, all 576 original custom manifest relationships, and all twenty retained snapshots against their exact source Git blobs. It reads no worktree evidence, writes no repository files and makes no network calls. Its counts keep direct manifest records, custom relationships, historical pins and distinct committed files separate; these categories overlap and must not be summed as unique observations.

5. Repeat the exact committed-tree audit on the pushed evidence commit and, where relevant, the merge tree. Compare actual Git tree IDs when claiming equivalence. The local source check, a successful CI status alone, or an ignored untracked log cannot replace this check.

The coverage claim is the union of previous NI audited coverage, current CQC source coverage and the new accepted CQC evidence package. It is not a claim that all 6,997 current repository files or every historical repository manifest have been newly reconciled. Final counts must come from the actual completed committed audit.

## Preparation controls

`preview/` checks current source plus the explicit outside-repository historical overlay only: 2,170 physical files, seven existing direct manifests, 2,310 prior-config relationships and all 576 custom relationships. It deliberately has `final_ready:false`, omits the nonexistent final CQC package manifest, and cannot produce an accepted committed audit. `preview-refusal.log` records that refusal.

`proposal-controls.json` checks all original associations and rejects changed declared paths, changed hashes, escaped paths, omitted declarations and altered flattened targets. An initial control-script `files` versus `copy_files` field assumption is preserved separately as failed harness evidence; it did not indicate a source mismatch and was not relabelled passing. Python syntax compilation passed. The final package does not yet exist, so an actual final committed audit has not run.
