# Combined AEMO/CQC candidate validation package

This temporary package performs validation only. It never uploads, promotes, rolls back, writes checkpoints, or edits release approvals. Runtime source/Worker identities are required arguments; none is presumed accepted.

Owner invocation, after exact clean candidate upload and successful source CI:

```
MR_REPO=/absolute/combined/worktree /tmp/mr-combined-release/validate-release.sh staged WORKER_VERSION SOURCE_REVISION /fresh/staged-output
MR_REPO=/absolute/combined/worktree MR_FOLLOWUP_STAGED_ROOT=/fresh/staged-output /tmp/mr-combined-release/validate-release.sh production WORKER_VERSION SOURCE_REVISION /fresh/production-output
```

The owner performs a separate reviewed promotion between these commands. A staged pass does not authorize this package to promote. Production requires the same successful staged revision/version, main runner hash, complete helper-bundle hash, and every retained file hash. Each invocation uses a fresh output directory, stops on first failure and retains all logs and reports. There is no automatic retry.

All gates are strict: USA sampled CPU <=100 ms, each legacy/claimant/rent sampled request <=500 ms, configured Worker ceiling 1000 ms. Baseline identity is read before CPU sampling and must stay byte-identical until those gates finish. Full Australia and England cold CPU captures must contain new publisher acquisitions inside the measured request. AEMO must match the two exact independently retained ZIPs, 576 raw/rounded intervals and ten summaries. CQC must match the 7,175,967-byte exact original PDF and five independent cells. Source completion must follow acquisition and precede response. These are full-desk samples, not per-source CPU or percentile evidence.

The AEMO reference is 19 October 2026. Every gate checks the actual clock before and after execution; the run fails at 20 October 2026 14:00 UTC. No simulated/pinned live clock, older-day fallback, automatic reference refresh or acceptance of a new date is provided.

Preserved gates: all nine desks and both production domains; strict 50 core semantic checks per domain; 13 BLS slots; 15 exact Stats NZ cells with eight remaining unverified; GDP; five claimant contracts; NZ market rent; six phase-one contracts (BoC, four StatCan, WRA); SFC; CMHC; fixed-edition NI. New public gates add AEMO (34 routes,23 schema documents,8 negatives/domain) and CQC (23 routes,13 schema documents,10 negatives/domain). Historical source-state comparison now covers 121 obligations, requiring review of any unexpected regression. Ordinary monitoring alerts and shadow acceptance remain unchanged.

Compatibility copies are isolated here. The older gap checker keeps all six original numerical contracts but removes its historical AEMO-held404 (39 remaining routes); active AEMO presence is required and the separate 34-route AEMO gate performs exact validation. Earlier NI/remaining schema helpers now permit `remainingCqc` but continue rejecting held ONS and obsolete `gapAemo` schemas. General and copied structural verifiers parse JSON decimals exactly. Historical source code, retained attempts and historical evidence manifests are untouched.

Final evidence assembly, after actual success only:
1. Retain this package and its manifest byte-identically with the invocation output, source commit/tree/fingerprint, CI outcome and exact candidate upload metadata.
2. Preserve initial failures as historical failed attempts; never replace them with a later pass or omit interrupted runs.
3. Retain staged and production directories in full, including every `.log` and body byte. Force-track reviewed ignored logs explicitly only after privacy review. Validate all manifest paths against the committed tree.
4. Independently review exact CPU events, request-time acquisitions, 576+10 AEMO and five CQC reference values, all prior contracts, and source-state comparison. No scheduled or sustained acceptance follows from this release.
5. Root performs the serialized existing activation/preservation workflow only after both domains pass, retains prior incidents/outbox/approvals, and updates acceptance/ledger/handoff/baseline. This runner does none of those writes.

Required before invoking: current combined module integration, monitoring scope 121, exact active CQC/AEMO catalogue and schema, ONS held, reference inputs present, pinned local tools and separately checked Cloudflare authentication. Local controls are constructed tooling tests only. No requests have been executed by preparing this package.
