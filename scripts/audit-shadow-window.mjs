// Offline, read-only arithmetic over a digest-validated checkpoint. This does
// not establish GitHub provenance, replay continuity or an actual user reply.
import {loadCheckpoint} from '../lib/monitor-store.js';
import {shadowStatus} from '../lib/monitor-state.js';

const [path,at,...extra]=process.argv.slice(2);
if(!path||!at||extra.length||!Number.isFinite(Date.parse(at))){
 console.error('Usage: node scripts/audit-shadow-window.mjs CHECKPOINT CHECKED_AT_ISO');process.exitCode=2;
}else{
 try{
  const checkpoint=await loadCheckpoint(path),state=checkpoint.state;
  const window=shadowStatus(state,at);
  const deliveries=state.outbox.filter(e=>e.type==='delivery_test').map(e=>({
   event_id:e.id,status:e.status,
   receipt_recorded:e.status==='delivered'&&typeof e.receipt==='string'&&Boolean(e.receipt.trim())&&Number.isFinite(Date.parse(e.delivered_at))&&Date.parse(e.delivered_at)>=Date.parse(e.created_at)&&Date.parse(e.delivered_at)<=Date.parse(at),
  }));
  const last=state.runs.filter(r=>r.scheduled===true&&r.complete===true).at(-1);
  const minutes=state.policy?.collection_interval_minutes+state.policy?.watchdog_grace_minutes;
  const deadline=last&&Number.isFinite(Date.parse(last.at))&&Number.isFinite(minutes)&&minutes>0?new Date(Date.parse(last.at)+minutes*60000).toISOString():null;
  const recordedDelivery=deliveries.length>0&&deliveries.every(e=>e.receipt_recorded);
  console.log(JSON.stringify({checked_at:at,checkpoint_digest:checkpoint.digest,sequence:state.sequence,shadow_started_at:state.started_shadow_at,
   scheduled_checkpoint_deadline:deadline,window,delivery_tests:deliveries,
   recorded_gates_satisfied:window.operating_window_pass&&recordedDelivery,
   independent_verification_required:['Original GitHub schedule/run/attempt metadata and artifact attribution','Every checkpoint transition, including manual and acknowledgment writes, independently replayed','Independent watchdog evidence and actual user reply matching the serialized delivery receipt'],
   scope:'Recorded evidence only. Does not establish operational acceptance, complete data-verification gates, enable alerts or write checkpoints.'},null,2));
  if(!window.operating_window_pass||!recordedDelivery)process.exitCode=1;
 }catch(error){console.error('Shadow audit failed: '+error.message);process.exitCode=2;}
}
