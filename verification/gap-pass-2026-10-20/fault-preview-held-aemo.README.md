# Protected fault proof with AEMO held

`fault-preview-held-aemo.json` passed all 28 protected Cloudflare remote-dev cases
from 2026-10-20T10:37:42.272Z to 2026-10-20T10:37:47.852Z. Its SHA-256 is
`3a613e7e98d66f97b931e4cb63ba3831ba325635019249bf638b1dc35df2a8e2`. All 38 bound source, configuration and fixture inputs
were unchanged during execution.

The six active contracts are Bank of Canada exchange history, StatCan jobs,
consumer prices, retail sales and housing starts, and Welsh land transaction
tax. Their 25 constructed cases retain exact numerical/period checks, invalid
metadata and suppression refusal, sibling isolation, acquisition-only version
stability, row-order stability and actual revision detection. WRA exercises its
bounded read/parser and selector, not its non-injectable live fetch wrapper.

Three additional held-AEMO cases require `unknown_source` for the source alone,
its measure and its exact-period selector. Each verifies absence from inventory,
typed adapter, source directory and schema, checks both catalogue source counts,
and records zero calls. The harness imports neither the AEMO reader nor its CSV
fixtures. The retained legacy grid snapshot is outside this new source contract.

All active reader inputs were injected retained specimens. No publisher HTTP,
credential binding, production deployment, infrastructure change, actual source
freshness or billed CPU is claimed. The fixture clock is explicitly constructed
and separate from the actual protected execution timestamps.

The original 35- and 36-case reports remain byte-identical. The exact original
36-case harness, both report hashes and its 37 transitive input hashes are
preserved in `fault-harness-before-aemo-hold/`; its manifest identifies the
retained commit for historical reproduction. Those old active-AEMO fixture
results do not establish live AEMO access or current activation.

The current runner refuses to overwrite an existing report. Any explicitly
authorized future protected rerun needs a distinct output path; it must not
replace this evidence.
