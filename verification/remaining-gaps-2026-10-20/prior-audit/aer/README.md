# AER queue reassessment — 20 October 2026

**Decision: exact quarterly-price contract identified; original-data transport
still blocked from this workspace.** This is not a repeated source alert or a
claim that AER is unavailable to everyone.

The [official quarterly regional chart](https://www.aer.gov.au/industry/registers/charts/quarterly-volume-weighted-average-spot-prices-regions)
(AER reference 11048184) describes demand-weighted quarterly NEM spot prices,
with AER/AEMO sources. Its [exact advertised CSV](https://www.aer.gov.au/sites/default/files/2026-08/AER_Spot%20prices_Quarterly%20VWA%20spot%20prices%20DATA_2_20260807084204.CSV)
is now identified. Search Service could read the chart's definitions and discover
the file, but could not process the CSV content type. Direct original GETs of
the directory, chart and CSV each returned HTTP 503 with the same 85-byte body.
Those failed bytes and request records are retained. No numeric/latest-quarter
claim is made from a filename or search excerpt; no further retries were run.

A future bounded contract could return the latest common completed quarter's
five NEM-region demand-weighted AUD/MWh prices. It would complement, not replace,
AEMO's completed-day equal-interval averages. It must exclude WA/NT, validate
quarter completeness/units/region identity and retain corrections; daily means
cannot certify quarterly demand weighting. An original CSV and exact selected
numerical presentation are still required before implementation acceptance.

The [AER copyright policy](https://www.aer.gov.au/about/policies/disclaimer-copyright)
provides CC BY 4.0 for AER material with third-party exceptions and attribution.
Search Service could read it; the direct archived response is 503. The selected
chart names AEMO, so applicable upstream permission and the policy's currency
wording must be recorded in a later source contract. This audit grants no blanket
reuse right for ASX/Argus or other AER-hosted third-party series.

Revisit only with usable original bytes or a newly permitted transport context;
do not register, contact the publisher, evade access controls or substitute an
unofficial reprocessor. The current AEMO build already addresses the demonstrated
short-window task, so this contract has lower incremental priority.
