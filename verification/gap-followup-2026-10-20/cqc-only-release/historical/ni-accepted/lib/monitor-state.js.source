import {fingerprint,ORIGINS,REMAINING_SCOPE,REMAINING_ELIGIBLE_CONTRACT_KEYS,NI_ELECTRICITY_SCOPE,NI_ELECTRICITY_SOURCE_KEYS,validateRemainingSourceKeys,validateNiElectricitySourceKeys} from './monitor-contracts.js';
export const STATE_VERSION=1;
const minutes=60*1000;
const measureKey=id=>id.split('&observation=')[0];
const identityFields=['source_revision','worker_version','build_fingerprint','source_dirty'];
const sameIdentity=(a,b)=>identityFields.every(k=>a?.[k]===b?.[k]);
const validIdentity=i=>i&&/^[a-f0-9]{40}$/.test(i.source_revision||'')&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(i.worker_version||'')&&/^[a-f0-9]{16}$/.test(i.build_fingerprint||'')&&i.source_dirty===false;
export const MAX_REVIEWED_RELEASE_EDGES=8;
const releaseScopes=['eight-legacy-plus-us-cpi','nine-desks-plus-claimants','nine-desks-plus-claimants-and-nz-rent','nine-desks-plus-claimants-rent-and-daily-history',REMAINING_SCOPE,NI_ELECTRICITY_SCOPE];
// Preserve the existing USA review as the first immutable edge. This bounded
// continuation is release history, not permission to invent an intermediate run.
export function reviewedReleasePlan(review){
 const fail=()=>{throw Error('Exact contiguous reviewed release identities, scope and evidence required');};
 if(!review||(Object.hasOwn(review,'enabled')&&review.enabled!==true)||review.scope!=='eight-legacy-plus-us-cpi')fail();
 const continuations=review.continuations===undefined?[]:review.continuations;
 if(!Array.isArray(continuations)||continuations.length>=MAX_REVIEWED_RELEASE_EDGES)fail();
 const reviews=[review,...continuations].map((edge,index)=>{
  if(!edge||!validIdentity(edge.from)||!validIdentity(edge.to)||edge.from.worker_version===edge.to.worker_version||typeof edge.evidence!=='string'||!edge.evidence.trim()||!releaseScopes.includes(edge.scope)||index<2&&edge.scope!==releaseScopes[index]||index&&Object.hasOwn(edge,'continuations')||index&&Object.hasOwn(edge,'enabled'))fail();
  const remaining=edge.scope===REMAINING_SCOPE,niElectricity=edge.scope===NI_ELECTRICITY_SCOPE;
  if(!remaining&&!niElectricity&&Object.hasOwn(edge,'source_contracts'))fail();
  const sourceContracts=niElectricity?validateNiElectricitySourceKeys(edge.source_contracts):remaining?validateRemainingSourceKeys(edge.source_contracts):null;
  return {from:structuredClone(edge.from),to:structuredClone(edge.to),evidence:edge.evidence,scope:edge.scope,...(sourceContracts?{source_contracts:sourceContracts}:{})};
 });
 if(reviews.some((edge,index)=>index&&(!sameIdentity(reviews[index-1].to,edge.from)||releaseScopes.indexOf(edge.scope)<releaseScopes.indexOf(reviews[index-1].scope)||releaseScopes.indexOf(edge.scope)>releaseScopes.indexOf(reviews[index-1].scope)+1)))fail();
 const nodes=[reviews[0].from,...reviews.map(edge=>edge.to)];
 if(new Set(nodes.map(i=>i.worker_version)).size!==nodes.length)fail();
 const remainingReviews=reviews.filter(edge=>edge.scope===REMAINING_SCOPE);
 if(remainingReviews.some(edge=>JSON.stringify(edge.source_contracts)!==JSON.stringify(remainingReviews[0].source_contracts)))fail();
 const terminal=reviews.at(-1);
 const includeNiElectricity=terminal.scope===NI_ELECTRICITY_SCOPE;
 if(includeNiElectricity&&JSON.stringify(remainingReviews.at(-1)?.source_contracts)!==JSON.stringify(REMAINING_ELIGIBLE_CONTRACT_KEYS))fail();
 return {reviews,target:terminal.to,scope:terminal.scope,includeUs:true,includeClaimants:continuations.length>=1,includeRent:releaseScopes.indexOf(terminal.scope)>=2,includeDailyHistory:releaseScopes.indexOf(terminal.scope)>=3,remainingSourceKeys:remainingReviews.length?[...remainingReviews.at(-1).source_contracts]:[],includeNiElectricity};
}
export const initialState=(now,identity,policy={collection_interval_minutes:60,watchdog_grace_minutes:90})=>({policy,schema_version:STATE_VERSION,sequence:0,created_at:now,approved_identity:identity,started_shadow_at:null,last_complete_collection_at:null,sources:{},incidents:{},outbox:[],repairs:{},runs:[]});
export function importAcknowledged(state,baseline,now){
 const s=structuredClone(state),keys=(baseline.last_notified_state?.known_degradations||[]).map(x=>x.desk.slice(1,-5)+'/'+x.source);
 if(baseline.last_notified_state?.nz_prices?.state==='error')keys.push('new-zealand/prices');
 for(const key of new Set(keys)){const id=fingerprint(['imported',key]);s.incidents[key]={id,source:key,kind:'availability',severity:'P2',opened_at:baseline.checked_at,acknowledged:true,last_seen:now,imported:true,good_checks:0};}
 s.import={at:now,baseline_digest:fingerprint(baseline),count:new Set(keys).size};return s;
}
function event(s,incident,type,now,evidence){const id=fingerprint([incident.id,type,incident.severity]);if(!s.outbox.some(x=>x.id===id))s.outbox.push({id,incident_id:incident.id,source:incident.source,type,severity:incident.severity,created_at:now,status:'pending',evidence});}
function fault(s,key,kind,reason,now,evidence){
 const v=s.sources[key] ||= {};v.good_checks=0;v.good_since=null;v.bad_since ||= now;v.bad_checks=(v.bad_checks||0)+1;
 const confirmed=kind==='semantic'||(v.bad_checks>=2&&Date.parse(now)-Date.parse(v.bad_since)>=15*minutes);
 if(!confirmed)return;
 let i=s.incidents[key];
 if(!i){i=s.incidents[key]={id:fingerprint([key,v.bad_since]),source:key,kind,severity:kind==='semantic'?'P1':'P2',opened_at:now,last_seen:now,acknowledged:false};event(s,i,'failure',now,evidence);}
 else if(kind==='semantic'&&i.severity!=='P1'){i.severity='P1';event(s,i,'escalation',now,evidence);}
 i.last_seen=now;i.reason=reason;i.good_checks=0;
 s.repairs[i.id] ||= {incident_id:i.id,source:key,reason,created_at:now,state:'open',evidence,scope:'Repair existing contract only; no new source authorized'};
}
export function applyRun(previous,run,{approvedVersions={},approvedRelease=null}={}){
 if(previous.schema_version!==STATE_VERSION)throw Error('Unsupported checkpoint version');
 for(const approval of Object.values(approvedVersions))if(typeof approval.version!=='string'||typeof approval.evidence!=='string'||!approval.evidence.trim())throw Error('Exact version and reproducible evidence reference required');
 const releasePlan=approvedRelease?reviewedReleasePlan(approvedRelease):null;
 const s=structuredClone(previous),now=run.finished_at;
 if(!Number.isFinite(Date.parse(now))||Date.parse(now)<Date.parse(s.created_at))throw Error('Invalid run clock');
 if(run.scope===NI_ELECTRICITY_SCOPE&&typeof run.scheduled!=='boolean')throw Error('Explicit NI collection scheduled provenance required');
 if(!s.policy)s.policy={collection_interval_minutes:60,watchdog_grace_minutes:90};
 if(s.runs.some(r=>r.id===run.id))return s;
 s.sequence++;s.last_run_id=run.id;
 // Clean identity alone does not authorize a different deployed revision.
 const identities=Object.values(run.identities||{});
 let remainingScopeObserved=false,niElectricityScopeObserved=false;
 if(releasePlan){
  const {reviews,target,scope,includeClaimants,includeRent,includeDailyHistory,remainingSourceKeys,includeNiElectricity}=releasePlan;
  const sourceContracts=includeNiElectricity?NI_ELECTRICITY_SOURCE_KEYS:remainingSourceKeys;
  const exactContracts=!sourceContracts.length||JSON.stringify(run.source_contracts)===JSON.stringify(sourceContracts);
  const observed=run.complete&&run.scope===scope&&exactContracts&&ORIGINS.every(o=>sameIdentity(run.identities?.[o],target));
  if(observed&&remainingSourceKeys.length&&s.remaining_source_contracts&&JSON.stringify(s.remaining_source_contracts)!==JSON.stringify(remainingSourceKeys))throw Error('A different remaining-contract set requires a separately reviewed scope; observation days cannot transfer');
  const start=reviews.findIndex(edge=>sameIdentity(s.approved_identity,edge.from));
  if(observed&&start>=0){
   const applied=reviews.slice(start);
   const audit={at:now,from:structuredClone(s.approved_identity),to:structuredClone(target),evidence:applied.at(-1).evidence,scope,...(sourceContracts.length?{source_contracts:[...sourceContracts]}:{})};
   // observed_in_collection refers to the edge's destination identity. The
   // intermediate release is supported by its retained review evidence only.
   if(approvedRelease.continuations?.length) audit.reviewed_chain=applied.map((edge,index)=>({...structuredClone(edge),observed_in_collection:index===applied.length-1}));
   s.release_reviews ||= [];s.release_reviews.push(audit);
   s.approved_identity=structuredClone(target);
   s.policy.max_public_requests_per_collection=24;
  }
  if(observed&&sameIdentity(s.approved_identity,target)){
   s.us_scope_first_complete_at ||= now;if(run.scheduled)s.us_started_shadow_at ||= now;
   if(includeClaimants){s.claimants_scope_first_complete_at ||= now;if(run.scheduled)s.claimants_started_shadow_at ||= now;}
   if(includeRent){s.market_rent_scope_first_complete_at ||= now;if(run.scheduled)s.market_rent_started_shadow_at ||= now;}
   if(includeDailyHistory){s.daily_history_scope_first_complete_at ||= now;if(run.scheduled)s.daily_history_started_shadow_at ||= now;}
   if(remainingSourceKeys.length){s.remaining_source_contracts ||= [...remainingSourceKeys];if(run.scheduled)s.remaining_started_shadow_at ||= now;}
   if(includeNiElectricity){s.ni_electricity_scope_first_complete_at ||= now;if(run.scheduled===true)s.ni_electricity_started_shadow_at ||= now;}
   remainingScopeObserved=remainingSourceKeys.length>0;
   niElectricityScopeObserved=includeNiElectricity;
  }
 }
 const approved=s.approved_identity;
 if(approved?.source_revision&&identities.some(i=>i.source_revision!==approved.source_revision||i.worker_version!==approved.worker_version||i.source_dirty!==false||approved.build_fingerprint&&i.build_fingerprint!==approved.build_fingerprint))
  fault(s,'service/release','semantic','Production identity differs from reviewed release baseline',now,run.identities);

 // A missing desk is a monitor/service probe failure, not invented failures of
 // every source it contains. Other successfully checked desks still advance.
 for(const [key,result]of Object.entries(run.results)){
  const v=s.sources[key] ||= {};v.last_attempt={at:now,outcomes:Object.fromEntries(Object.entries(result).map(([d,x])=>[d,{kind:x.kind,reason:x.reason||null,retrieved_at:x.retrieved_at||null}]))};
  const outcomes=Object.values(result);if(outcomes.length!==2){v.not_fully_checked=true;continue;}delete v.not_fully_checked;
  const failures=outcomes.filter(x=>!['success'].includes(x.kind));
  if(failures.length){const semantic=failures.some(x=>x.kind==='semantic');fault(s,key,semantic?'semantic':'availability',failures.map(x=>x.reason).join('; '),now,result);continue;}
  v.good_since ||= now;v.good_checks=(v.good_checks||0)+1;
  const current=outcomes[0],versions=[...new Set(outcomes.map(x=>x.version).filter(Boolean))];
  v.last_successful_retrieval_at=now;
  if(versions.length>1){v.domain_difference={at:now,versions,reason:'Different cached snapshots; compare periods/retrieval times before calling this corruption'};v.good_checks=0;fault(s,key,'availability','Persistent difference between domain snapshots',now,result);continue;}delete v.domain_difference;
  const profile=current.provenance_fields||[];
  const lost=(v.provenance_fields||[]).filter(k=>!profile.includes(k));
  if(lost.length){fault(s,key,'semantic','Previously present provenance fields removed: '+lost.join(','),now,result);continue;}
  v.provenance_fields=profile;
  if(current.version){
   const old=v.last_contract_validated;
   let change=!old?'initial':old.version===current.version?'unchanged':JSON.stringify(old.periods)===JSON.stringify(current.periods)?'revision':key==='wales/projection'?'selection_rollover':'new_period';
   const removed=old?.metadata?Object.keys(old.metadata).filter(k=>!(k in current.metadata)):[];
   if(removed.length){fault(s,key,'semantic','Provenance/definition metadata removed: '+removed.join(','),now,result);continue;}
   // Multi-period sources compare a loss only with the same exact month.
   const sameObservation=(a,b)=>key==='united-states/cpi'||key.endsWith('/claimant_count')||key==='new-zealand/market_rent'||key==='australia/grid_day'||key==='canada/exchange_history'?a===b:measureKey(a)===measureKey(b);
   if(current.nonnumeric?.length&&old?.observations?.some(o=>o.value_state==='observed'&&current.nonnumeric.some(n=>sameObservation(n.id,o.id)))&&approvedVersions[key]?.version!==current.version){v.candidate=current;fault(s,key,'availability','Supported numeric answer became nonnumeric; preserve explicit publisher state',now,result);continue;}delete v.candidate;
   v.change=change;v.last_contract_validated={version:current.version,at:change==='unchanged'?old.at:now,periods:current.periods,observations:current.observations,metadata:current.metadata,assurance:current.assurance||'not established'};
   if(approvedVersions[key]?.version===current.version){v.last_independently_verified={...v.last_contract_validated,evidence:approvedVersions[key].evidence};delete v.pending_verification;if(s.repairs['verify:'+key])s.repairs['verify:'+key].state='resolved';}
   else if(change!=='unchanged'){v.pending_verification={version:current.version,kind:change,detected_at:now};s.repairs['verify:'+key]={source:key,state:'evidence_review',kind:change,version:current.version,created_at:now,scope:'Reconcile original publisher evidence; no automatic source substitution'};}
  }
  v.bad_checks=0;v.bad_since=null;
  const incident=s.incidents[key];
  if(incident&&!(incident.severity==='P1'&&v.pending_verification)&&v.good_checks>=2&&Date.parse(now)-Date.parse(v.good_since)>=15*minutes){event(s,incident,'recovery',now,result);s.closed_incidents ||= [];s.closed_incidents.push({...incident,closed_at:now});if(s.repairs[incident.id])s.repairs[incident.id].state='resolved';delete s.incidents[key];}
 }
 if(run.complete){const c=s.sources['monitor/collection'];if(c){c.bad_checks=0;c.bad_since=null;}s.last_complete_collection_at=now;if(run.scheduled)s.started_shadow_at ||= now;}
 else fault(s,'monitor/collection','availability','Incomplete required probes',now,run.probe_errors);
 if(run.complete&&s.incidents['monitor/collection']){
  const v=s.sources['monitor/collection'];v.good_since ||= now;v.good_checks=(v.good_checks||0)+1;
  if(v.good_checks>=2&&Date.parse(now)-Date.parse(v.good_since)>=15*minutes){event(s,s.incidents['monitor/collection'],'recovery',now,[]);delete s.incidents['monitor/collection'];}
 }
 s.runs.push({id:run.id,at:now,complete:run.complete,scheduled:Boolean(run.scheduled),requests:run.requests.length,...(run.scope?{scope:run.scope}:{}),...(run.source_contracts?{source_contracts:structuredClone(run.source_contracts)}:{}),...([REMAINING_SCOPE,NI_ELECTRICITY_SCOPE].includes(run.scope)?{reviewed_scope_observed:run.scope===NI_ELECTRICITY_SCOPE?niElectricityScopeObserved:remainingScopeObserved}:{})});s.runs=s.runs.slice(-2000);
 return s;
}
export function acknowledge(state,eventId,receipt,at){
 if(!receipt||typeof receipt!=='string'||!Number.isFinite(Date.parse(at)))throw Error('Delivery receipt and valid time required');
 const s=structuredClone(state),e=s.outbox.find(x=>x.id===eventId);if(!e)throw Error('Unknown notification event');
 if(e.status==='delivered'&&e.receipt!==receipt)throw Error('Conflicting delivery receipt');e.status='delivered';e.receipt=receipt;e.delivered_at=at;return s;
}
export function watchdog(state,now){const last=Date.parse(state.last_complete_collection_at);return !Number.isFinite(last)||Date.parse(now)-last>(state.policy.collection_interval_minutes+state.policy.watchdog_grace_minutes)*minutes?'monitor_overdue':'monitor_recent';}
export function shadowStatus(state,now){
 const start=Date.parse(state.started_shadow_at),checked=Date.parse(now);
 const interval=state.policy?.collection_interval_minutes,grace=state.policy?.watchdog_grace_minutes;
 const policyValid=Number.isFinite(interval)&&interval>0&&Number.isFinite(grace)&&grace>=0;
 const runs=state.runs.filter(r=>r.scheduled===true);
 // Do not sort or deduplicate corrupt evidence into a passing window. Earlier
 // failed scheduled executions may precede the first successful shadow start.
 const validHistory=runs.every((r,i)=>typeof r.id==='string'&&r.id.length>0&&typeof r.complete==='boolean'&&Number.isFinite(Date.parse(r.at))&&Date.parse(r.at)<=checked&&(!i||Date.parse(r.at)>Date.parse(runs[i-1].at)))&&new Set(runs.map(r=>r.id)).size===runs.length;
 const window=runs.filter(r=>Date.parse(r.at)>=start);
 const complete=window.filter(r=>r.complete),last=complete.at(-1);
 const anchored=window.length>0&&window[0].complete&&Date.parse(window[0].at)===start;
 const elapsed=anchored&&last?Date.parse(last.at)-start:0;
 let maxGap=0;for(let i=1;i<window.length;i++)maxGap=Math.max(maxGap,Date.parse(window[i].at)-Date.parse(window[i-1].at));
 // The observer's clock can make a checkpoint overdue, but cannot create
 // elapsed scheduled evidence. A manual collection cannot refresh this gate.
 const recent=Boolean(last&&checked>=Date.parse(last.at)&&checked-Date.parse(last.at)<=(interval+grace)*minutes);
 const valid=policyValid&&validHistory&&anchored&&Number.isFinite(checked);
 return {scope:'original-eight-desks',elapsed_hours:elapsed/3600000,complete_runs:complete.length,incomplete_runs:window.length-complete.length,max_gap_minutes:maxGap/minutes,
  seven_days_elapsed:valid&&elapsed>=7*86400000,
  operating_window_pass:valid&&elapsed>=7*86400000&&complete.length>=Math.ceil(7*1440/interval)+1&&complete.length===window.length&&maxGap<=(interval+grace)*minutes&&recent};
}
export function dailyHistoryShadowStatus(state,now){
 const scope='nine-desks-plus-claimants-rent-and-daily-history',start=state.daily_history_started_shadow_at||null;
 const runs=state.runs.filter(run=>run.scope===scope||[REMAINING_SCOPE,NI_ELECTRICITY_SCOPE].includes(run.scope)).map(run=>run.scope!==scope?{...run,complete:run.complete&&run.reviewed_scope_observed===true}:run);
 const result=shadowStatus({...state,started_shadow_at:start,runs},now);
 return {...result,scope,started_at:start,scheduled_evidence_pending:!start};
}
export function remainingShadowStatus(state,now){
 const sourceContracts=state.remaining_source_contracts||[],start=state.remaining_started_shadow_at||null;
 const runs=state.runs.filter(run=>[REMAINING_SCOPE,NI_ELECTRICITY_SCOPE].includes(run.scope)).map(run=>({
  ...run,complete:run.complete&&run.reviewed_scope_observed===true&&(run.scope===NI_ELECTRICITY_SCOPE?
   JSON.stringify(run.source_contracts)===JSON.stringify(NI_ELECTRICITY_SOURCE_KEYS)&&JSON.stringify(sourceContracts)===JSON.stringify(REMAINING_ELIGIBLE_CONTRACT_KEYS):
   JSON.stringify(run.source_contracts)===JSON.stringify(sourceContracts)),
 }));
 const result=shadowStatus({...state,started_shadow_at:start,runs},now);
 return {...result,scope:REMAINING_SCOPE,source_contracts:[...sourceContracts],started_at:start,scheduled_evidence_pending:!start};
}
export function niElectricityShadowStatus(state,now){
 const start=state.ni_electricity_started_shadow_at||null;
 const runs=state.runs.filter(run=>run.scope===NI_ELECTRICITY_SCOPE).map(run=>({...run,complete:run.complete&&run.reviewed_scope_observed===true&&JSON.stringify(run.source_contracts)===JSON.stringify(NI_ELECTRICITY_SOURCE_KEYS)}));
 const result=shadowStatus({...state,started_shadow_at:start,runs},now);
 return {...result,scope:NI_ELECTRICITY_SCOPE,source_contracts:[...NI_ELECTRICITY_SOURCE_KEYS],started_at:start,scheduled_evidence_pending:!start};
}

export function queueDeliveryTest(state,at){
 const s=structuredClone(state),id=fingerprint(['authorized-delivery-test',s.created_at]);
 if(!s.outbox.some(e=>e.id===id))s.outbox.push({id,incident_id:null,source:'monitor/delivery-test',type:'delivery_test',severity:'TEST',created_at:at,status:'pending',evidence:'Authorized notification-path exercise; not a production incident'});
 return s;
}
