# Independent staged legacy CPU review

The captured legacy resource gate passes. England used **386 ms**, below the
unchanged **500 ms** limit; it was also the maximum of the eight legacy desks.
This does not establish all 33 staged gates or production acceptance.

The response headers, clean candidate health and one matching England trace bind
Worker `16e5a892-be54-4381-a9c3-98ae4e47a309` to source
`7d7ed892c469d6f589dabf52283fc31dfef98d8a` and fingerprint
`56c41341c2b38c38`. Reading that exact Git source confirms reader SHA-256
`f161ab460d0e489345edcd38c9bbe5c36b1a09990e5b53494a837f48931e27a9`.
All nine captured candidate requests have exactly one matching version/path/time
trace with outcome ok and no exceptions. Source timestamps were rechecked from
raw response bodies rather than accepted only from the capture's summary flags.

The England request began at 18:51:18.683Z on 20 October 2026. It acquired the
complete original PDF at 18:51:18.760Z, completed its CQC source at
18:51:19.019Z, and returned at 18:51:23.572Z. The PDF is 7,175,967 bytes with
SHA-256 `61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef`.
The five structurally derived source values are 125 / 809 / 2,063 / 65 / 3,062.

Both domains' production health remained the accepted NI identity before and
after. The exact deployment stayed NI Worker `34d6966c-0c3f-40dd-8b61-b4a696b09b89`
at 100%, candidate at 0%, verified by explicit version IDs and percentages.
The deployment timestamp is retained; array position was not used.

The raw capture SHA-256 is
`3b346b82e460c24a9fb67bac081bd5250d44523051bdd21c4626d3ae17e9b6ae`.
The reproducible local review script and full checks are retained alongside this
note. Trace correlation uses version, path and a bounded time interval; no
per-request CF-Ray was retained. This is one observed request per desk, not a
percentile or sustained-load claim. Fresh source-health times also include
truthful publisher failures and do not replace semantic acceptance.

The earlier 794 ms and 636 ms samples remain failed attempts. No HTTP requests,
repo edits, Git mutations, retries, promotions, schedule changes, checkpoint
writes or acknowledgments were performed by this review.
