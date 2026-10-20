# Northern Ireland electricity balance — 20 October 2026

**Blocked by publisher access from Cloudflare; do not activate this source.**
Implementation and independent specimen checks pass. The first protected live
reader attempt failed closed with `Report title/geography changed`; its complete
result remains in [cloudflare-reader-live.json](cloudflare-reader-live.json).
One bounded [same-route diagnosis](cloudflare-report-diagnostic.json) confirmed
a 247-byte HTTP 200 HTML response titled `Request Rejected`, with no report
heading or publication metadata. This is an access rejection, not a successful
statistical response. The existing Northern Ireland sources are unchanged.

The [pre-code contract](CONTRACT.md) fixes five measures for one inclusive
rolling twelve-month period. For July 2025–June 2026, published 3 September 2026,
these are renewable generation / gross final electricity consumption **50%**,
gross final consumption **8,865 GWh**, renewable generation **4,431 GWh**,
non-renewable generation **3,855 GWh**, and net imports **578 GWh**. Net imports
are imports minus exports; a negative observation remains meaningful. A one-GWh
component residual is publisher rounding. This is neither the monthly renewable
percentage nor renewable generation's share of total generation.

The new [reader](../../../lib/ni-energy.js) makes one fixed no-key report request,
bounded to 20 seconds and 6 MiB. It reads only the two named current XLSX exports
embedded in that report. It bounds compressed archives and expanded statistical
XML, verifies titles, scope, units, dates, denominator and methodology, and
refuses incomplete, marked or ambiguous observations. It returns publisher
integers, a common rolling interval, explicit revision qualifications and
acquisition provenance. Publication is a date; no publication time or timezone
is invented. An unchanged quarterly release is valid.

## Independent evidence

[independent-report.json](independent-report.json) records **38 passing checks**
and exact agreement for all five cells. Python's standard-library ZIP/XML
extraction is separate from the JavaScript reader and is reconciled with the
official chart presentation and the dated DfE release retained in the frozen
prior audit. These presentations share SONI/NIE/DESNZ statistical lineage;
agreement does not independently measure electricity generation or certify the
entire historical series.

[original/acquisition.json](original/acquisition.json) records original wire
hashes and the explicit evidence transformation. The 13,475-byte retained HTML
contains only the title, publication/scope fields, reviewed methodology and two
statistical exports. Each retained XLSX contains only four statistical XML
parts, byte-identical to their original parts; contact/footer, document
properties, printer metadata, styles and unrelated figures are omitted. The
original archive and retained archive hashes are deliberately distinct.

Attribution and reuse follow the publisher's [Crown copyright/OGL policy](https://www.economy-ni.gov.uk/articles/crown-copyright-economy).
No keys, registrations or publisher contact were needed.

## Validation boundary

The **63 focused local tests** cover wrong geography, old methodology, monthly
or generation-share substitution, mixed/old periods, future publication dates,
headers and units, incomplete/marked values, numerical balance, zero and
negative-import controls, ZIP/XML ambiguity and resource bounds, acquisition
failure, and preservation of an unrelated successful source.

The first live proof used the actual unchanged reader and real UTC clock on
protected Cloudflare remote dev, with one request attempt and no fixtures or
fallback. Its source returned a successful HTTP response whose content failed
the title guard. The retained full 5,191,096-byte publisher specimen still
passes this same parser offline, distinguishing the observed current-response
failure from a minimal-fixture transformation error. No values were accepted
from the failed live request, and the failed record is preserved.

The single authorised diagnostic used the identical fixed URL and
`accept: text/html` request, without origin/header spoofing, alternate routes,
proxy workarounds or retries. It completed at `2026-10-20T10:11:15.710Z` and
retained only public title/classification, status, size and body digest:
`a6e09e9c03eac6e61b07cd41fccba5498066ee776bdd206e50772760e6824031`.
It did not retain the rejection body or any contact fields. Both protected
records confirm unchanged reader/tool hashes. This route is stopped until
permitted access or a separately reviewed official transport becomes available.
There is no actual-reader success, integrated CPU proof, public endpoint
acceptance or production release for this new source.

Reproduce the local checks without network:

```sh
node --test test/ni-energy.test.js
python3 verification/remaining-gaps-2026-10-20/ni-energy/verify-original.py \
  verification/remaining-gaps-2026-10-20/ni-energy/original \
  verification/remaining-gaps-2026-10-20/prior-audit/ni-energy \
  /path/to/new-independent-report.json
```

The verifier refuses to overwrite an existing output. `prepare-evidence.py`
recreates the minimal evidence in a new directory from the frozen prior audit;
it does not make HTTP requests. The protected harnesses remain reproducible
with an unused output path and the authorised existing Wrangler configuration,
but should not be rerun against the blocked route without new permitted access
evidence. Their transport keeps protected preview tokens in memory/stdin and
records only public statistical evidence.
