# CMHC two-area rent — bounded assessment contract

Written 20 October 2026 before any new reader implementation. This assessment first determines whether existing delivery can satisfy the rental table's applicable licence. The comparison below supports development using the existing conditional-notice mechanism; actual runtime and release acceptance remain pending.

The numerical contract is table `34-10-0133`, exactly Victoria, British Columbia CMA (`2011S0503935`, coordinate `186.3.3`, vector `v3823106`) and Victoriaville, Quebec CA (`2011S0504440`, coordinate `66.3.3`, vector `v3823208`), combined **row and apartment structures of three units and over**, two-bedroom units. Annual weighted average rent, CAD per month, October survey of eligible privately initiated structures; vacant and occupied units, new and existing structures. This is not an apartment-only split, median, municipality-wide total, current asking-only price or housing availability.

Retained 2025 observations are 2121 and 991, exact WDS/CSV matches. Preserve annual `refPer`, October `refPerRaw`, raw unzoned release `2025-12-17T08:30`, scalar/unit/frequency/status/security codes and metadata-bound geography/category IDs. Future release verification must independently pin its actual vintage. Unknown suppression, confidentiality, status or missing values must not become zero.

The rental cube explicitly links the CMHC Licence Agreement for the Use of Data. Before implementation, inspect the current `homes` licence notice/delivery mechanism against the **recipient-agreement condition**, not only attribution and no-endorsement requirements. A response stating that no acceptance is recorded is not evidence that recipients have agreed. Do not infer assent from the user's build request, create a new approval flow, register/contact anyone or accept terms for recipients.

If an explicit unmet condition is identified, retain the exact clause and concrete missing delivery property as a genuine blocker. Transport recovery alone does not authorize dissemination. Uncertainty about whether any particular recipient agreed is not itself an extra requirement for a logged receipt that the licence does not specify.

## Exact-terms comparison and implementation decision

The linked rental agreement's redistribution condition includes: “provided that such individuals or entities agree to be bound by these terms and conditions.” Its introduction states that using the information constitutes agreement; it does not prescribe a separate clickthrough, signed receipt or account. The corresponding StatCan-hosted agreement used by the existing homes source carries the same material condition.

The accepted homes mechanism carries the source and adaptation/no-endorsement notices, links the terms and states both the use-based agreement condition and the obligation on further redistribution. It explicitly does not claim that any recipient's acceptance was observed or recorded. The same conditional delivery mechanism is reasonably supported for this exact rental table, using its own linked HMIP terms URL and product/reference details. This is a limited implementation decision under the user's authorization, not a legal opinion or proof of individual assent.

Proceed with the bounded module and tests. Every native result and individual observation must retain the applicable licence, terms URL and both notices; selection must not strip the conditions. Reject metadata that no longer identifies this table's applicable licence. Do not add an approval flow or manufacture receipts. Actual protected Worker verification, integration and release remain root-owned gates.
