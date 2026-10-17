// Isolated design model. No network, scheduling, production writes or notifications.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const initial=()=>({schema_version:1,sequence:0,sources:{},outbox:[],last_completed_at:null});
export function validate(rows,contract){
 if(!Array.isArray(rows))return 'parse';
 if(rows.length!==contract.keys.length||new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!contract.keys.includes(r.id)))return 'coverage';
 for(const r of rows){
  if(r.geography!==contract.geography[r.id]||r.unit!==contract.unit)return 'definition';
  if(!contract.period.test(r.period))return 'period';
  if(contract.financialYear&&Number(r.period.slice(11,15))!==Number(r.period.slice(0,4))+1)return 'period';
  if(r.state==='observed'){if(!Number.isFinite(r.value)||(contract.min!==undefined&&r.value<contract.min)||(contract.max!==undefined&&r.value>contract.max))return 'value';}
  else if(!['missing','unavailable','suppressed'].includes(r.state)||r.value!==null||!r.reason)return 'missingness';
 }
 return null;
}
function emit(s,key,incident,type,at){
 const id=hash([key,incident.id,type]);
 if(!s.outbox.some(x=>x.id===id))s.outbox.push({id,key,incident_id:incident.id,type,at,delivery:'would_notify'});
}
export function observe(previous,key,event){
 const s=structuredClone(previous);s.sequence++;
 const v=s.sources[key] ||= {last_good:null,incident:null,failures:0,successes:0};
 v.last_attempt=event.at;v.last_outcome=event.kind;
 const now=Date.parse(event.at);if(!Number.isFinite(now))throw Error('invalid clock');
 if(event.kind!=='success'){
  v.successes=0;v.success_start=null;
  if(!v.failures)v.failure_start=event.at;
  v.failures++;
  const confirmed=event.kind==='semantic'||(v.failures>=2&&now-Date.parse(v.failure_start)>=15*60*1000);
  // One active incident per source/contract, not one per raw error message/status.
  if(confirmed&&!v.incident){v.incident={id:hash([key,v.failure_start]),opened_at:event.at,reason:event.reason,severity:event.kind==='semantic'?'P1':'P2'};emit(s,key,v.incident,'failure',event.at);}
  else if(confirmed&&event.kind==='semantic'&&v.incident?.severity!=='P1'){v.incident.severity='P1';emit(s,key,v.incident,'escalation',event.at);}
  v.state=v.incident?'incident':'suspect';return s;
 }
 // event.rows must already have passed the contract validator. A null value is
 // not evidence of a retrieval error, and no observation date becomes fetched_at.
 v.failures=0;v.failure_start=null;
 const content=event.rows.map(({id,geography,unit,period,state,value,reason})=>({id,geography,unit,period,state,value,...(reason?{reason}:{})})).sort((a,b)=>a.id.localeCompare(b.id));
 const version=hash(content), old=v.last_good;
 const change=!old?'initial':old.version===version?'unchanged':old.rows.map(r=>r.period).join()===content.map(r=>r.period).join()?'revision':'new_period';
 v.detected_change=change;
 if(change!=='unchanged'&&!event.reconciled){v.successes=0;v.success_start=null;v.state='verification_pending';v.candidate={version,rows:content,detected_at:event.at};return s;}
 if(!v.successes)v.success_start=event.at;v.successes++;
 v.last_good={version,rows:content,verified_at:change==='unchanged'?old.verified_at:event.at,last_successful_retrieval_at:event.at};delete v.candidate;
 if(v.incident&&v.successes>=2&&now-Date.parse(v.success_start)>=15*60*1000){emit(s,key,v.incident,'recovery',event.at);v.incident=null;}
 v.state=v.incident?'recovering':'healthy';return s;
}
export function seedAcknowledged(state,keys,at){
 const s=structuredClone(state);
 for(const key of new Set(keys)){s.sources[key]={last_good:null,incident:{id:hash(['imported',key]),opened_at:at,severity:'P2',reason:'imported acknowledged degradation'},failures:0,successes:0,state:'incident'};}
 return s;
}
export function releaseState({now,publishedExpectedAt,graceMs=86400000,found}){
 if(found)return 'available';
 if(!publishedExpectedAt)return 'schedule_unknown';
 return Date.parse(now)<=Date.parse(publishedExpectedAt)+graceMs?'expected_delay':'overdue_requires_confirmation';
}
export function watchdog({now,lastCompletedAt}){
 return !lastCompletedAt||Date.parse(now)-Date.parse(lastCompletedAt)>150*60000?'monitor_missing':'monitor_recent';
}
export function checkpoint(state){const payload=JSON.stringify(state);return {schema_version:1,payload,sha256:hash(payload)};}
export function restore(envelope){if(envelope?.schema_version!==1||hash(envelope.payload)!==envelope.sha256)throw Error('checkpoint unavailable or corrupt; stop, do not reset incidents');const s=JSON.parse(envelope.payload);if(s.schema_version!==1||!Array.isArray(s.outbox)||!s.sources)throw Error('unsupported checkpoint');return s;}
