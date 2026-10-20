# Canada unemployment geography contract — pre-code, 20 October 2026

The selected existing `canada/jobs` scope is exactly Canada and its ten provinces
from Statistics Canada table14-10-0287-01/product14100287. Retain the native
array and legacy `name`, `rate`, `period`, `source`, `licence` fields. No
territories, new series, histories, arbitrary selectors or infrastructure.

The risk is now demonstrated in the original WDS response acquired
2026-10-20T09:16:56Z: its objects are ordered1,10,11,2,...9 although requested
1,2,...11. The previous reader assigns geography by array position. Canada is
correct; subsequent provincial labels receive other provinces' rates. Correct
by exact product/coordinate/vector identity, never response order.

The exact coordinates are `G.7.1.1.1.1.0.0.0.0`, with G1..11 and vectors:
Canada2062815; Newfoundland and Labrador2063004; Prince Edward Island2063193;
Nova Scotia2063382; New Brunswick2063571; Quebec2063760; Ontario2063949;
Manitoba2064138; Saskatchewan2064327; Alberta2064516; British Columbia2064705.
Cube dimensions in order: Geography; Labour force characteristics member7
Unemployment rate; Gender member1 Total - Gender; Age group member1 15years and
over; Statistics member1 Estimate; Data type member1 Seasonally adjusted.
Validate exact selected labels, active status and all geographic classification
codes/vintage2021 (Canada11124, provinces10/11/12/13/24/35/46/47/48/59).

The rate is unemployed people as a percentage of the labour force aged15+
(totalgender), for the civilian noninstitutional population, seasonally
adjusted. Canada excludes territories per official footnote19. It is not a
claimant rate, population unemployment share, count, recruitment availability,
trend-cycle estimate or unadjusted series. Unit239=Percent, scalar0=units,
frequency6=monthly, decimals1. Retain exact definition/revision qualifications.

Require all11 unique series and one point per series, all at the same current
cubeEndDate month; join data and series metadata by exact coordinate, corroborate
vector, title, product, active status, precision, scale and units. Reject unknown,
duplicate, missing or extra series, but accept arbitrary response ordering.
The monthly first-day `refPer` and `refPerRaw` must match, secondary dates empty.
Raw release `YYYY-MM-DDTHH:mm` must match cube release; keep timezone unknown,
never append Z. Reference month must have ended by retrieval. Do not invent an
age-since-change or publisher-deadline staleness rule.

Rates must be finite numeric0..100 at published1decimal precision, public
security0/status0; no null/string coercion, suppression-to-zero or missing
rate substitution. Symbols0/1/3 mean none/preliminary/revised, explicitly
qualified. Other flags fail closed. Seasonal estimates can be revised annually;
none symbol is not finality. Real value/release/flag revisions must affect
statistical version; acquisition clocks/hashes and array position must not.

Pinned Sept2026 specimen released9October2026: Canada6.5, Newfoundland9.1,
PEI7.3, Nova Scotia6.3, New Brunswick7.4, Quebec6.0, Ontario7.0, Manitoba5.0,
Saskatchewan5.4, Alberta6.4, British Columbia6.4. Independently extract original
selectedCSV and official selectedHTML and, where comparable, dated Daily table.
Compare every geography/period/dimension and all11rates exactly (zero numeric
tolerance). Publisher presentations share LFS lineage; separate extraction is
not an independent survey. New vintage cannot certify this specimen.

Negative controls: wrong identities/geographies/age/gender/adjustment/units,
metadata failure/termination, reordered responses (must normalize), duplicate
or missing series, mixed or older months, future month, malformed dates,
unknown symbols/security/status, null/string/nonfinite/outofrange/overprecision,
release drift, HTTP/JSON/UTF8/byte/time failures. Successful sibling sources
must survive this source failing. Native schema/typed selection/monitor must
validate this exact contract, not mere availability. Stable typed measureIDs
are lowercase geography slugs separated by underscores; exact observation ID
is the current YYYY-MM. Release acceptance requires root's protected preview,
independent actual-body comparison, regression checks, versioned release and
bothdomain gates. This document does not approve deployment or monitoring.
