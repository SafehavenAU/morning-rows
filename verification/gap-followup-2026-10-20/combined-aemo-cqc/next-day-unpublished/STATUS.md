# 20 October AEMO publication gate: blocked

The one authorized ordinary index request ran at
2026-10-20T18:06:09.161611+00:00 and completed at
2026-10-20T18:06:10.275563+00:00 with HTTP 200. Its 16,059 bytes have SHA-256
`c817aa790c76c20235c715aeb9a5af175d09279169fa7a87e3ec919c32bf707d`.
The response still advertises
`PUBLIC_PRICES_202610190000_20261020040503.zip`; it does not advertise the
required 20 October trading bundle. The observed 04:05 generation pattern was
an inference, not a publication deadline or an availability promise.

The acquisition refused explicitly. There was exactly **one HTTP request**,
zero ZIP requests, zero monthly presentation requests and zero retries.
No 20 October source values, numerical oracle, checker manifest, protected
reader acceptance, resource acceptance or release acceptance were generated.
No older day was substituted. The exclusive attempt marker remains in place.

The amended contract preserves the full original acceptance gate: a future
separately reviewed continuation must use actually advertised 19/20 October
bundles and separately acquired same-day official monthly presentations,
reconcile all 576 cent prices and ten summaries, and then pass all actual
reader/resource/staged/production gates. These prepared scripts are not
permission to retry or approve future dates.

`original/acquisition.json` retains the failed attempt and original response
metadata; `original/index-directory-excerpt.html` is the minimal exact title
and directory listing with telemetry excluded. The full index remains outside
the repository at `original/index-full.html`; its exact hash is retained.
The `failure-manifest.json` binds the minimal failure evidence and prepared
scripts. It is explicitly an unaccepted failure manifest, not the successful
`oracle-manifest.json` expected by any release runner.

All source, monitoring, checkpoint, receipt and schedule state was unchanged by
this evidence subtask. Parent is continuing a separately validated CQC-only
candidate with AEMO disconnected.
