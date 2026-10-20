# NI release validation runner

This runner validates one explicitly supplied clean candidate. It does not
upload, promote, acknowledge notifications, dispatch the collector or activate
monitoring metadata. Local preparation and constructed controls are not actual
release or scheduled evidence.

From the repository root, run the local preflight:

```sh
node verification/gap-followup-2026-10-20/release-tools/preflight.mjs
```

The owner can then validate an already staged candidate. Both output directories
must be new; their parent directories must exist:

```sh
bash verification/gap-followup-2026-10-20/release-tools/validate-release.sh \
  staged "$MR_CANDIDATE_VERSION" "$MR_CANDIDATE_REVISION" "$MR_STAGE_OUTPUT"

MR_FOLLOWUP_STAGED_ROOT="$MR_STAGE_OUTPUT" \
  bash verification/gap-followup-2026-10-20/release-tools/validate-release.sh \
  production "$MR_CANDIDATE_VERSION" "$MR_CANDIDATE_REVISION" "$MR_PRODUCTION_OUTPUT"
```

Production requires the successful exact-candidate staged result, the same
runner hash, and unchanged retained staged file hashes. Production invocation
must follow a separately authorized promotion. The approved monitoring baseline
must remain unchanged through staging and CPU sampling.

The first candidate requests are the USA and eight-desk CPU captures. USA uses
an explicit 100 ms gate; legacy desks use 500 ms. NI's full-desk sample must
include its exact five values and one original article acquisition inside that
sampled request, in addition to exact trace/version/path/time correlation.
Scotland SFC and Canada CMHC retain the equivalent fresh-input checks. These
are sampled CPU measurements, not percentile or sustained-operation claims.

Every domain must pass all 50 strict core semantic checks. There is no historical
SEPA availability exception. Other source-state changes fail unless they are
the explicitly recognized ONS 403/429 or TfL 429 fluctuations; unchanged known
source failures remain visible. The cumulative Stats NZ check covers 15 exact
dated references and retains eight unresolved numeric cells. It does not
certify undisplayed flags, all 23 cells, future vintages or scheduled operation.

The remaining gates preserve GDP, claimant history, market rent, the six active
phase-one contracts, SFC/CMHC and NI's fixed 3 September 2026 edition. Production
smokes enable all existing optional addition checks and require 18/17 route
checks. Each step stops on a nonzero exit. `release-gate-audit.json` separately
checks exact step order, report coverage, identities and refusal counts.

`summary.json` includes every retained output/log hash and the exit status even
when a gate fails. Its manifest describes files on disk, not Git retention:
before publishing evidence, verify the committed tree includes every referenced
file, including logs ignored by the repository's general `*.log` rule. Keep
failed attempts and later attempts in different directories.

Local validation passed shell/JavaScript syntax, helper/CLI preflight and 12
constructed source-state controls. Reproduce the controls without network:

```sh
python3 verification/gap-followup-2026-10-20/release-tools/runner-controls.py
```
