# Held-source public interface gate

This separate bounded release gate checks the exact staged version or both
production domains. It requests `/keys.json` and the four held source selectors:
AEMO daily prices, NI electricity, CQC assessment cohort and ONS bedroom rent.
All must remain documented as blocked and refuse selection with `unknown_source`.
SFC and CMHC must not appear as blocked after their accepted activation.

Run `node check.mjs FRESH_OUTPUT SOURCE_REVISION WORKER_VERSION [staged]`.
Replay the retained bytes with `node check.mjs --verify CAPTURE FRESH_REPORT
SOURCE_REVISION WORKER_VERSION [staged]`. The capture allows five requests per
domain, no redirects or retries, and retains bounded response bytes and hashes.
The offline controls are constructed; they do not establish actual release
acceptance. Local integration tests establish that held selectors trigger no
publisher acquisition; this public gate checks their exposed behaviour.
