# CQC bounded-PDF CPU repair amendment

Recorded before runtime changes, 20 October 2026. Source under investigation is
`baa10d13f62b5a74c6f67ff2c0d1f05a4523d394`, CQC module SHA-256
`a2e719e1dc9fa145bbabc329b21dca71e302bfed43c47cb07eb3e936fca20115`.
`prior-reader.js` preserves that module byte for byte. Its imports are historical
source text, not an executable replacement from this evidence directory.

The staged full England request at 2026-10-20T17:56:51.230Z failed the existing
500 ms CPU gate at 794 ms, although its five CQC values and full original PDF
provenance matched. The original report is retained separately by the release
runner. That attempt and the earlier 19-control protected-reader report remain
evidence for their original module only.

This repair may change local parser work, not the statistical contract, selected
pages, whole-file SHA-256/length guard, fetch policy, retained lineage, publication
and acquisition meanings, structure/visibility/cohort checks, refusal controls,
or budgets. The accepted NI production version remains unchanged while this
candidate is investigated.

The reproducible local input is the complete 7,175,967-byte original PDF with
SHA-256 `61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef`.
No publisher request is required for local profiling. Compare identical original
bytes in separate processes before and after a bounded algorithmic change,
recording module/input hashes, cold and warm wall time, process CPU, all five
derived values, and structural work statistics. Local timings must be called
local timings; they cannot establish Cloudflare CPU acceptance.

Pass criteria:

1. Both modules derive exactly 125, 809, 2063, 65 and 3062 with unchanged native
   semantics from the same complete original bytes.
2. All existing 57 bounded-reader cases and relevant information/schema/worker
   interface tests pass, preserving corruption, truncation, oversized inflation,
   changed-byte, geography, period, population, category and visibility refusals.
3. The implementation reduces measured local parser work or CPU, with the
   specific cause and before/after evidence retained. A noisy wall-time reduction
   alone is not sufficient evidence of improvement.
4. Any new bound or optimization has a regression check that would catch loss of
   its resource or integrity guarantee. No static-value path is introduced.
5. Release acceptance still requires newly bound actual protected-reader proof,
   exact-source checks, full-desk staged CPU at or below the existing 500 ms
   legacy gate, existing USA 100 ms gate and all established release validation.
   The 1,000 ms Worker ceiling is unchanged. Root performs those remote checks.

If local results do not support a safe improvement, retain the failure and hold
the candidate; do not reinterpret the old pass or relax a budget.
