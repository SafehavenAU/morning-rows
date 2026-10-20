# Retained local integration proof

These files preserve the local merge and offline checks for historical source
`e7c1f3acf1e417732da37e3428a345c269ae4033`. They are not a phase-two release,
new source execution, CPU measurement, scheduled cycle or acceptance record.
The original `integration-summary.json` and `manifest.json` remain unchanged.

`retention-map.json` maps every absolute `/tmp/mr-remaining-merge-bf3110e/`
input named by the historical summary to a byte-identical file in this directory.
It records the original length and SHA-256. `commit.log`, `merge.log`,
`protected-before.json` and `wrangler-deploy-help.txt` were copied without edits.
The merge log records the intermediate conflict state; the later commit and
checks record the resolved result. The protected-file hashes describe the old
merge boundary, before the subsequently accepted phase-one evidence arrived.
They must not be substituted for current approved inputs.

The repository's `*.log` rule had omitted the existing test/build logs even
though their manifests referenced them. This proof-only repair tracks those
unchanged files, including the failed premerge run and the earlier monitoring
controls in their existing directories. It does not relabel failed attempts or
rerun any passed checks. Four trailing-whitespace lines in the original Wrangler
and failed-test output remain unchanged so their recorded digests still match.
The 1,166-test result remains tied to the historical
implementation; later documentation-only merges have separate preservation
checks.

All eleven omitted logs and the four additional inputs were reviewed before
tracking. They contain local test/build/control output, Git summaries, public
source paths and hashes. No credential values, signed URLs, private headers or
personal contact details were found. Python bytecode remains ignored.

The historical summary also names the external owner-run release validator.
That path describes the reviewed workflow at the time; it is not a claim that
this directory packages a self-contained future release runner. The final
candidate still requires clean-source preflight and the separately owned actual
staged and production gates.
