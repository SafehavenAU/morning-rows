# Independent final-audit proposal review

No blocker found in the frozen v2 proposal e150bc478ecd6fabc7b70138161efc1e4226f7d414699d93dd9aa7e6fb368454. The final package is pending; this review is not a final committed-tree audit or release acceptance.

Verified all original and revised tool-manifest bindings, unchanged core audit scripts, all twenty exact historical Git snapshots and their Git object IDs, all twenty-five payload pins, and 2,170 preview file pins. The sole added relocation is the old 119-obligation registry, exactly 760,261 bytes, SHA25614cb64414507374bac8d230d25328549128c640bbb4f8479f125e2212d832bf7, retained for both prior audit-configuration relationships.

Independently followed all 576 reconstructed custom relationships from their original JSON pointer to their declared path and digest. Wrong paths with the same hash, removed original declarations, changed hashes and escaped paths were rejected. The final wrapper reconstructs the original custom and historical-pin relationship lists and requires exact equality, preventing omission from the final configuration. The supplied preview has 2,310 historical-pin relationships and is explicitly ineligible for final acceptance; its refusal was independently executed and retained.

The builder inventories preparation bytes. The final wrapper reads the base verifier and all audit evidence from the exact requested Git commit, checks historical snapshots against their original source commits, and leaves the repository untouched. The base verifier rejects non-regular Git blobs and missing or altered manifests/records. Final package manifest membership is dynamically included only by final preparation, after that package exists.

Counts for distinct files, direct manifest records, original custom associations and prior configuration pins overlap and must remain separate. The coverage is the union of prior NI final coverage, CQC source coverage and eventual accepted CQC package; it is not every repository file or every historical manifest. No HTTP requests, repository writes or Git mutations were performed. Read-only Git show/rev-parse was used for exact snapshot checks.

The author’s prior failed files-versus-copy_files harness assumption and the superseded original nineteen-snapshot proposal remain intact. The copied source scripts and proposal manifests here support reproduction; running build-final-audit.py with the proposal payload is preparation only, and running verify-final-union.py with preview/audit-config.json must refuse.
