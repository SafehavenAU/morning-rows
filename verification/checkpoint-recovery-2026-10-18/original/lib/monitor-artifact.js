// Artifact identity and restart rules. The digest detects damage, not forgery.
export const CHECKPOINT_NAME='morning-rows-monitor-checkpoint';
export function chooseCheckpoint(artifacts,runs,currentRunId){
 const prior=runs.filter(r=>String(r.id)!==String(currentRunId)&&r.path==='.github/workflows/monitor.yml'&&r.head_branch==='main'&&['schedule','workflow_dispatch'].includes(r.event)).sort((a,b)=>b.id-a.id);
 const latest=[...artifacts].sort((a,b)=>b.id-a.id)[0];
 if(!latest)throw Error('No checkpoint artifact; reviewed bootstrap or recovery required');
 if(latest.expired)throw Error('Newest checkpoint expired; refuse silent rollback');
 const producer=prior.find(r=>r.id===latest.workflow_run.id);
 if(!producer||producer.head_branch!=='main'||!['schedule','workflow_dispatch'].includes(producer.event))throw Error('Untrusted checkpoint workflow producer');
 if(prior[0].id!==producer.id)throw Error('A later monitor run has no checkpoint; inspect interrupted delivery before recovery');
 if(producer.status!=='completed')throw Error('Prior producer is still running; serialization failed');
 if(latest.size_in_bytes>4*1024*1024)throw Error('Checkpoint archive exceeds size budget');
 return {artifact:latest,producer};
}
export function assertFirstBootstrap(artifacts,runs,currentRunId){
 if(artifacts.length||runs.some(r=>String(r.id)!==String(currentRunId)&&r.path==='.github/workflows/monitor.yml'&&r.head_branch==='main'&&['schedule','workflow_dispatch'].includes(r.event)))
  throw Error('Monitor history already exists; bootstrap cannot reset acknowledged incidents. Review recovery instead.');
}
