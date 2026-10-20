import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {REGISTRY,US_CONTRACT,CLAIMANT_CONTRACTS,RENT_CONTRACT} from '../lib/monitor-contracts.js';
import {reviewedReleasePlan} from '../lib/monitor-state.js';
import {measuresFor} from '../lib/information.js';
import {CPI_DEFINITION} from '../lib/us-cpi.js';
import {claimantDefinition} from '../lib/claimant-count.js';
import {nzRentDefinitions} from '../lib/nz-market-rent.js';
const tasks={'australia/hospital':'AU-ED','new-zealand/stats':'NZ-STATS23','new-zealand/prices':'NZ-PRICES','canada/exchange':'CA-FX4','united-kingdom/price_index':'UK-CPI','england/price_index':'UK-CPI','england/pharmacies':'EN-PHARM9','scotland/company_insolvencies':'SC-INSOLVENCY','wales/projection':'WA-PROJECTION','northern-ireland/childhood_bmi':'NI-BMI4','northern-ireland/company_insolvencies':'NI-INSOLVENCY'};
const registry=REGISTRY.map(c=>({...c,task_ids:tasks[c.key]?[tasks[c.key]]:[],schema_version:'1.0',validator_version:'monitor-contracts-v1',definitions:measuresFor(c.desk,c.source),evidence:tasks[c.key]?'operations/acceptance.json#'+tasks[c.key]:null,owner:'Codex maintenance workflow; product decisions remain with owner in this chat',monitor_interval_minutes:1440,publisher_request_quota:null,publisher_quota_status:'not established; hourly collection withheld',next_verified_publication:null,publication_grace_seconds:null,cadence:measuresFor(c.desk,c.source).map(x=>x.cadence).filter(Boolean).join('; ')||'unknown; do not infer daily freshness',semantic_approval:tasks[c.key]?'See acceptance ledger; availability alone is insufficient':'Not established; native limitations remain visible',incident_group:c.key}));
export function buildMonitorRegistry(releaseReview){
if(typeof releaseReview?.enabled!=='boolean')throw Error('Explicit release-review enabled flag required');
const plan=releaseReview.enabled?reviewedReleasePlan(releaseReview):null;
const us={...US_CONTRACT,task_ids:['US-CPI'],schema_version:'2.0',validator_version:'monitor-us-cpi-v1',definitions:[CPI_DEFINITION],evidence:releaseReview.enabled?releaseReview.evidence:'verification/us-build-2026-10-19/README.md',monitor_interval_minutes:1440,publisher_request_quota:null,publisher_quota_status:'Official database table and publication index; no API-quota fallback or global cache guarantee',next_verified_publication:null,publication_grace_seconds:null,semantic_approval:'Exact current version requires independent original-data reconciliation; unchanged monthly values are valid',incident_group:US_CONTRACT.key};
const claimants=CLAIMANT_CONTRACTS.map(contract=>({...contract,task_ids:['CLAIMANT-COUNT'],schema_version:'1.0',validator_version:'monitor-claimant-count-v1',definitions:[claimantDefinition(contract.desk)],evidence:plan?.includeClaimants?plan.reviews.find(edge=>edge.scope==='nine-desks-plus-claimants').evidence:'verification/claimant-count-2026-10-20/CONTRACT.md',monitor_interval_minutes:1440,publisher_request_quota:null,publisher_quota_status:'Bounded anonymous official query; no credential or hourly polling',next_verified_publication:null,publication_grace_seconds:null,cadence:'monthly; reference-date stock',semantic_approval:'Exact current version requires independent original-data reconciliation; unchanged monthly values are valid',incident_group:contract.key}));
const rent={...RENT_CONTRACT,task_ids:['NZ-MARKET-RENT'],schema_version:'1.0',validator_version:'monitor-nz-market-rent-v1',definitions:nzRentDefinitions(),evidence:plan?.includeRent?plan.reviews.find(edge=>edge.scope==='nine-desks-plus-claimants-and-nz-rent').evidence:'verification/nz-market-rent-2026-10-20/CONTRACT.md',monitor_interval_minutes:1440,publisher_request_quota:null,publisher_quota_status:'Two fixed anonymous publisher locations; no credential, discovery fan-out or hourly polling',next_verified_publication:null,publication_grace_seconds:null,cadence:'monthly publication; inclusive six-month reference window',semantic_approval:'Exact current window, tuples and values require independent original-page reconciliation; absent tuples are not zero',incident_group:RENT_CONTRACT.key};
return {schema_version:1,sources:[...registry,...(plan?[us]:[]),...(plan?.includeClaimants?claimants:[]),...(plan?.includeRent?[rent]:[])],staged_sources:[...(plan?[]:[us]),...(plan?.includeClaimants?[]:claimants),...(plan?.includeRent?[]:[rent])]};
}
async function main(){
const releaseReview=JSON.parse(await readFile('operations/us-release-review.json','utf8'));
await writeFile('operations/source-contract-registry.json',JSON.stringify(buildMonitorRegistry(releaseReview),null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
