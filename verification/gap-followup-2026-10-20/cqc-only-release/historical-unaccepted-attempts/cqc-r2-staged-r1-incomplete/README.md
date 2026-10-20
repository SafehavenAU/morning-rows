# Incomplete CQC r2 staged validation

The exact clean source `7d7ed892c469d6f589dabf52283fc31dfef98d8a`, Worker `16e5a892-be54-4381-a9c3-98ae4e47a309`, completed five of 33 staged gates before the sixth gate failed with `tail_not_ready`. Twenty-seven gates were not run. The original summary remains `pass:false` and is never relabelled a complete suite.

The claimant-specific www capture contains only health requests: four ordinary production-identity checks and one candidate-override health request. It contains no `/northern-ireland.json` desk request and no trace events. This is an incomplete trace-readiness attempt, not a measured claimant CPU budget failure or a publisher failure. The separate earlier legacy gate did request Northern Ireland and does not substitute for this required fresh claimant gate.

The prior staged legacy-resource capture passed at a maximum 386 ms for England, with exact source/version correlation and fresh original CQC PDF acquisition. Its original independent review is retained separately and expressly accepts only that capture. It does not establish all staged gates or production acceptance. Earlier 794 ms and 636 ms actual resource failures remain unchanged.

NI Worker `34d6966c-0c3f-40dd-8b61-b4a696b09b89` remained at 100%; this candidate remained at zero. No promotion, release approval, checkpoint, receipt, schedule change or ordinary source notification occurred. This package makes no continuation or retry decision.

All 17 original evidence/review files are copied byte-identically. The package adds only this explanation and a hash manifest. The originating source inventory, runtime and frozen tools remain unchanged.
