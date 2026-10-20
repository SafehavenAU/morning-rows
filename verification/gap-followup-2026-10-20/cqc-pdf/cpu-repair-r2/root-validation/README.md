# Root r2 validation before clean-source publication

The root integrated the selected r2 parser module SHA`f161ab460d0e489345edcd38c9bbe5c36b1a09990e5b53494a837f48931e27a9` and the two new lexer/zlib test files. The retained full build passed1458tests with zero failures, followed by Wrangler dry-run496.65KiB /153.88KiB gzip. The original duplicate-ctm diagnostic remains in the unmodified build log.

One bounded protected actual-reader request fetched the exact7175967-byte original PDF SHA`61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef`, derived125/809/2063/65/3062, and passed19controls. Its code-before and code-after pins match. This proves those exact code inputs and protected-reader results only; it does not measure Cloudflare full-desk CPU.

The protected report correctly records Git HEAD79e251cab4314c328e84d9ac4ca7bf5e5408bdbb while the working tree contains the new parser. That old revision contained module7ee99…, not f161…. Do not describe this as a clean79e251-source proof or reuse its earlier CI/Worker as r2 acceptance. A new clean source, exact CI, Worker, staged CPU and complete release validation are still required.

All nine report input keys resolve from the original `verification/gap-followup-2026-10-20/cqc-pdf` harness root, never from this nested evidence directory. `actual-code-input-bindings.json` records the exact normalized paths and hashes. The manifest binds these inputs and the two added test files, as well as the four original root result files copied byte-identically. Its package-lock path is explicitly relative to this fixed `cpu-repair-r2/root-validation` retention directory.

The prior794ms and636ms failed staged attempts retain their original outcomes and identities. This package changes no accepted production identity, operation ledger, checkpoint, receipt or schedule. CPU and release acceptance remain pending.
