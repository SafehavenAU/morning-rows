# Historical pre-hold fault harness

These exact scripts produced the 36-case `../fault-preview-final.json`. Its SHA-256 is `0327b0c4ca133be56808c4d689901e0f33d4a0fee10dbc959b65d91e685b9668`. The earlier 35-case report remains separate history. Both original report files are unchanged.

Every one of the 36-case report's 37 source/fixture input hashes was checked against commit `ba0812b493f7cc4ca47a9f726211d96903bd9597` before adaptation; `manifest.json` records that mapping. Restore that commit in an isolated checkout to reproduce the original harness with its original active-AEMO fixture scope. The copied scripts alone are a historical byte snapshot, not the current activation configuration.

The current held-AEMO harness and its immutable report are maintained in the parent directory. Neither historical fixture proof establishes live AEMO access or acceptance.
