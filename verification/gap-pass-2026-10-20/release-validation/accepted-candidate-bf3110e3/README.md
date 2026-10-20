# Candidate provenance

Source `bf3110e3bcbbc7db6d629254a886356e80f4c24a` / Worker `7f93e660-666c-435a-9b8b-bc37c060ac02` passed the separately retained staged checks before promotion. This directory records upload, zero-percent staging, exact-source CI and promotion provenance; it does not establish production acceptance.

Original logs are byte-identical. GitHub CI/commit and Cloudflare deployment responses are explicit safe metadata excerpts: personal author/contact fields are omitted, with original and retained byte counts and hashes plus exact transformations in `packaging-manifest.json`. Deployment collections retain publisher order; use verified creation timestamps and exact version percentages, not array position, to identify the latest deployment. See `../staged/packaging-manifest.json` for the complete staged evidence and path relocations. No production capture was copied while its validation was running.

## Production outcome

The completed [production evidence](../production/README.md) now passes all 18 gates, strict 100/100 core semantics, six-contract numerical/schema reconciliation, and both domain smoke runs. The independent [production review](production-review.json) records exact identity, artifact hashes, the 232 source-state comparison and remaining acceptance limits. The earlier packaging manifest intentionally retains its creation-time pending status; no original run or packaging record was rewritten to invent a prior acceptance.
