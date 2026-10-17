import {fingerprint} from './monitor-contracts.js';
export const STATE_VERSION=1;
const minutes=60*1000;
const measureKey=id=>id.split('&observation=')[0];
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
export function applyRun(previous,run,{approvedVersions={}}={}){
 if(previous.schema_version!==STATE_VERSION)throw Error('Unsupported checkpoint version');
 for(const approval of Object.values(approvedVersions))if(typeof approval.version!=='string'||typeof approval.evidence!=='string'||!approval.evidence.trim())throw Error('Exact version and reproducible evidence reference required');
 const s=structuredClone(previous),now=run.finished_at;
 if(!Number.isFinite(Date.parse(now))||Date.parse(now)<Date.parse(s.created_at))throw Error('Invalid run clock');
 if(!s.policy)s.policy={collection_interval_minutes:60,watchdog_grace_minutes:90};
 if(s.runs.some(r=>r.id===run.id))return s;
 s.sequence++;s.last_run_id=run.id;
 // Clean identity alone does not authorize a different deployed revision.
 const identities=Object.values(run.identities||{}), approved=s.approved_identity;
 if(approved?.source_revision&&identities.some(i=>i.source_revision!==approved.source_revision||i.worker_version!==approved.worker_version||i.source_dirty!==false))
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
   if(current.nonnumeric?.length&&old?.observations?.some(o=>o.value_state==='observed'&&current.nonnumeric.some(n=>measureKey(n.id)===measureKey(o.id)))&&approvedVersions[key]?.version!==current.version){v.candidate=current;fault(s,key,'availability','Supported numeric answer became nonnumeric; preserve explicit publisher state',now,result);continue;}delete v.candidate;
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
 s.runs.push({id:run.id,at:now,complete:run.complete,scheduled:Boolean(run.scheduled),requests:run.requests.length});s.runs=s.runs.slice(-2000);
 return s;
}
export function acknowledge(state,eventId,receipt,at){
 if(!receipt||typeof receipt!=='string'||!Number.isFinite(Date.parse(at)))throw Error('Delivery receipt and valid time required');
 const s=structuredClone(state),e=s.outbox.find(x=>x.id===eventId);if(!e)throw Error('Unknown notification event');
 if(e.status==='delivered'&&e.receipt!==receipt)throw Error('Conflicting delivery receipt');e.status='delivered';e.receipt=receipt;e.delivered_at=at;return s;
}
export function watchdog(state,now){const last=Date.parse(state.last_complete_collection_at);return !Number.isFinite(last)||Date.parse(now)-last>(state.policy.collection_interval_minutes+state.policy.watchdog_grace_minutes)*minutes?'monitor_overdue':'monitor_recent';}
export function shadowStatus(state,now){const elapsed=state.started_shadow_at?Date.parse(now)-Date.parse(state.started_shadow_at):0;const runs=state.runs.filter(r=>r.scheduled&&(!state.started_shadow_at||r.at>=state.started_shadow_at));let maxGap=0;for(let i=1;i<runs.length;i++)maxGap=Math.max(maxGap,Date.parse(runs[i].at)-Date.parse(runs[i-1].at));return {elapsed_hours:elapsed/3600000,complete_runs:runs.filter(r=>r.complete).length,incomplete_runs:runs.filter(r=>!r.complete).length,max_gap_minutes:maxGap/minutes,seven_days_elapsed:elapsed>=7*86400000,operating_window_pass:elapsed>=7*86400000&&runs.length>=Math.ceil(7*1440/state.policy.collection_interval_minutes)+1&&runs.every(r=>r.complete)&&maxGap<=(state.policy.collection_interval_minutes+state.policy.watchdog_grace_minutes)*minutes&&watchdog(state,now)==='monitor_recent'};}

export function queueDeliveryTest(state,at){
 const s=structuredClone(state),id=fingerprint(['authorized-delivery-test',s.created_at]);
 if(!s.outbox.some(e=>e.id===id))s.outbox.push({id,incident_id:null,source:'monitor/delivery-test',type:'delivery_test',severity:'TEST',created_at:at,status:'pending',evidence:'Authorized notification-path exercise; not a production incident'});
 return s;
}
