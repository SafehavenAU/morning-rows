# Four existing StatCan headline contracts — before runtime code, 20 October2026

This pass selects existing `canada/jobs`, `price_index`, `shop`, `homes` only.
It preserves native aliases while refusing unchecked interpretation. No GDP,
new geography, history, arbitrary publisher query, credential or monitoring
state changes. Each source has a detailed evidence contract in its subdirectory;
this pre-code parent contract fixes the selection and falsifiable gates.

| Source | Exact product/coordinate/vector | Required meaning | Numeric contract |
|---|---|---|---|
| jobs |14100287, G.7.1.1.1.1.0.0.0.0, G1..11 with separately pinned11vectors|Canada and tenprovinces; unemploymentrate, totalgender, age15+, estimate, seasonallyadjusted; Canadaexcludesterritories|percent/unit239/scalar0/decimals1/frequency6;11currentmonthlypoints|
| price_index |18100004,2.2.0.0.0.0.0.0.0.0,41690973|Canada; All-items CPI; notseasonallyadjusted; index2002=100, not inflationrate or costofliving index|unit17/scalar0/decimals1/frequency6;1currentmonthlypoint|
| shop |20100056,1.1.1.2.0.0.0.0.0.0,1446859483|Canada; NAICS44–45 retailtrade; totalretailsales; seasonallyadjusted currentdollar value, not salesvolume|thousandsofCanadiandollars/unit81/scalar3/decimals0/frequency6;1currentmonthlypoint|
| homes |34100136,1.1.1.0.0.0.0.0.0.0,15817836|Canada housingstarts,totalunits in centres10,000+ only; quarterlyreportedunitcount, not allCanada monthly; adjustment unspecified|dwellings/unit300/scalar0/decimals0/frequency9;1currentquarterpoint|

Retained first-vintage observations are Sept2026 jobs (all11), Sept2026 CPI170.0,
July2026 retail73,696,547thousanddollars, and2026-Q3 housing57,947units. Pin raw
release strings separately from retrieval/verification instants. Validate exact
series+cube IDs/titles/dimensions/active selectedmembers and latestcubeperiod;
map jobs by identity, never arrayposition. Exactly one point per requestedseries,
all11jobs atsamemonth; missing/duplicate/extra/unknown results fail. Monthly
refPer/refPerRaw are firstday; quarterlyrefPer quarterstart andraw quarterfinalmonth.
Datesmustbereal, allperiods complete by acquisition, cubeend latest, no stale
fallback. Homes legacyperiodYYYY-MM is labelled quarterstartalias; typedperiodYYYY-Qn.

Allvaluesfinite numeric atdeclaredprecision, no strings/null/suppressioncoercion.
Jobs0..100; CPIpositive; retail/homesnonnegative safeintegers. Securitymust0.
Statuses0normal accepted; retail documented3/A excellent,4/B verygood,5/C good,
6/D acceptable,7/E usewithcaution remainexplicitlyqualified numericobservations.
Unavailable1, roundedzero2, unreliable8, inapplicable9, belowdetection10 and
unknownstatuses fail. Otherthreecontracts acceptnormal0 only. Symbols0none,
1preliminary,3revised explicit; other/unknownsymbols fail. Validate cube/series
frequency,scalar,precision andunits independently beforeinterpreting points.
Changedrelease/value/flag ormeaning changes semanticversion; acquisitionclock,
hash andrequestorder do not. Preserve datavintage/revision qualifications;
nonchanging monthlydata isvalid. Neverdeclarefuturevintages preverified.

Numerical acceptance: independent Python extraction from original selectedCSV
and independently presented officialHTML/publication, no runtimeimport, exact
zero-tolerance rawvalue/dimension/period agreement. For anyroundedpublication
comparison tolerance must be specified and separatefromexactCSVcomparison.
Allpublisheroutputs shareunderlying statisticallineage; do notclaimindependent
survey. A newerrelease doesnotcertify retainedspecimen. Testwrong identity,
order, dimensions,geo,units,period,release,flags,missing/duplicatepartialcoverage,
futuremonths/quarters andHTTP/UTF8/JSON/timeout/size failures. No healthyCanadian
sibling lostwhenone sourcefails.

CMHC housing reuse is separately gated: cube explicitly points to CMHC Data
Licence Agreement. Do not label it StatisticsCanadaOpenLicence alone or approve
releaseuntil readableoriginalterms permitthis exactredistribution; otherwise
recordblocker and rootmustkeepuncertainty/refusal. Structural/numerical pass
alone isnot legalorpublication acceptance. Jobs/CPI/retail use StatisticsCanada
OpenLicence withattribution. Allactualreaderpreview/regression/CPU/versioned
release/bothdomain acceptance belong to root; no productionacceptance claimedhere.

Terms evidence acquired before release: the official Statistics Canada CMHC agreement permits redistribution subject to its attribution/adaptation notices and downstream terms agreement. The runtime must carry those notices and the explicit by-use terms condition; it must not claim recorded recipient assent. See homes/CONTRACT.md and retained agreement.

Acquisition guard clarification: raw publisher release timestamps lack a timezone.
Do not convert them to instants. A release calendar date later than the UTC
retrieval date plus one day is impossible even with the largest civil timezone
lead and is refused. The one-day allowance avoids inventing a timezone; it is
not evidence that a future instant was published. The reference period itself
must have ended by the UTC acquisition day. Both actual provenance and an
explicit public-response acquisition anchor enforce these bounds, including
when raw fixture provenance is empty.
