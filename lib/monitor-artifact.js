// IDs establish identity, never publication order. Integrity is not authenticity.
import {createHash} from 'node:crypto';
import {decodeCheckpoint} from './monitor-store.js';
export const CHECKPOINT_NAME='morning-rows-monitor-checkpoint';
export const WORKFLOW_ID=388034330;
const path='.github/workflows/monitor.yml';
const relevant=r=>r.path===path&&r.head_branch==='main'&&['schedule','workflow_dispatch'].includes(r.event);
const time=s=>Date.parse(s);
const sha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const fail=message=>{throw Error(message+'; state not reset');};

export async function readPages(api,path,key,limit=1000){
 const rows=[];let total;const ids=new Set();
 for(let page=1;;page++){
  const data=await api(`${path}${path.includes('?')?'&':'?'}per_page=100&page=${page}`);
  if(!Number.isSafeInteger(data.total_count)||data.total_count<0||!Array.isArray(data[key]))fail('Invalid paginated history');
  total??=data.total_count;
  if(total!==data.total_count||total>limit)fail('History changed or exceeds review ceiling');
  for(const row of data[key]){if(!Number.isSafeInteger(row.id)||ids.has(row.id))fail('Duplicate or ambiguous paginated history');ids.add(row.id);rows.push(row);}
  if(rows.length===total)return rows;
  if(rows.length>total||!data[key].length||rows.length>=limit)fail('Incomplete paginated history');
 }
}

export function selectProducer(runs,currentRunId,{recovery}={}){
 const eligible=runs.filter(relevant);
 if(!eligible.length)fail('No eligible workflow history');
 const numbers=new Set(),ids=new Set();
 for(const r of eligible){
  if(r.workflow_id!==WORKFLOW_ID||!Number.isSafeInteger(r.id)||!Number.isSafeInteger(r.run_number)||r.run_number<1||!sha(r.head_sha))fail('Untrusted workflow identity');
  if(r.run_attempt!==1)fail('Rerun attempt requires separate reviewed recovery');
  if(numbers.has(r.run_number)||ids.has(r.id))fail('Ambiguous workflow execution order');numbers.add(r.run_number);ids.add(r.id);
  if(!Number.isFinite(time(r.run_started_at))||!Number.isFinite(time(r.updated_at)))fail('Missing execution timestamps');
 }
 eligible.sort((a,b)=>a.run_number-b.run_number);
 for(let i=1;i<eligible.length;i++)if(time(eligible[i].run_started_at)<=time(eligible[i-1].run_started_at))fail('Execution chronology conflicts with workflow run order');
 const current=eligible.at(-1);
 if(String(current.id)!==String(currentRunId))fail('Current execution is not latest; serialization or history changed');
 const prior=eligible.slice(0,-1);let producer=prior.at(-1),skipped=null;
 if(!producer)fail('No prior producer; reviewed bootstrap required');
 if(producer.status!=='completed')fail('Prior producer is still running; serialization failed');
 if(recovery){
  if(current.event!=='workflow_dispatch')fail('Recovery requires explicit manual dispatch');
  for(const [key,value] of Object.entries(recovery.failed))if(producer[key]!==value)fail('Recovery does not match the exact failed execution');
  skipped=producer;producer=prior.at(-2);
  if(!producer||producer.id!==recovery.predecessor.run_id||producer.run_attempt!==recovery.predecessor.run_attempt||producer.head_sha!==recovery.predecessor.revision||producer.status!=='completed')fail('Reviewed recovery predecessor changed');
 }
 if(time(producer.updated_at)>time(current.run_started_at))fail('Producer overlapped current execution');
 return {producer,current,skipped};
}

export function chooseCheckpoint(artifacts,runs,currentRunId,options={}){
 const selection=selectProducer(runs,currentRunId,options),{producer}=selection;
 const candidates=artifacts.filter(a=>a.name===CHECKPOINT_NAME&&a.workflow_run?.id===producer.id);
 if(candidates.length!==1)fail(candidates.length?'Ambiguous checkpoint artifacts':'Latest producer has no checkpoint; reviewed recovery required');
 const artifact=candidates[0],p=artifact.workflow_run;
 if(p.head_branch!=='main'||p.head_sha!==producer.head_sha||p.repository_id!==1422775200||p.head_repository_id!==1422775200)fail('Checkpoint producer identity mismatch');
 if(artifact.expired||!Number.isFinite(time(artifact.expires_at))||time(artifact.expires_at)<=(options.now??Date.now()))fail('Newest checkpoint expired');
 if(!Number.isSafeInteger(artifact.size_in_bytes)||artifact.size_in_bytes<=0||artifact.size_in_bytes>4*1024*1024)fail('Checkpoint archive exceeds size budget');
 if(!/^sha256:[a-f0-9]{64}$/.test(artifact.digest||''))fail('Missing archive digest');
 const published=time(artifact.created_at);
 if(!Number.isFinite(published)||published<time(producer.run_started_at)||published>time(producer.updated_at))fail('Artifact not attributable to producer attempt');
 if(options.recovery&&(artifact.id!==options.recovery.predecessor.artifact_id||artifact.digest!==options.recovery.predecessor.archive_digest))fail('Reviewed recovery artifact changed');
 return {...selection,artifact};
}

export function validateRecoveryEvidence(review,jobs,artifacts){
 if(artifacts.length)fail('Failed execution now has artifacts; recovery review invalid');
 if(jobs.length!==1)fail('Failed execution jobs changed');
 const j=jobs[0],expected=review.job;
 for(const key of ['id','run_id','run_attempt','head_sha','status','conclusion','started_at','completed_at'])if(j[key]!==expected[key])fail('Failed attempt evidence changed');
 const steps=j.steps.map(s=>({number:s.number,name:s.name,status:s.status,conclusion:s.conclusion}));
 if(JSON.stringify(steps)!==JSON.stringify(expected.steps))fail('State-changing step evidence differs from review');
}

export function validateArchive(bytes,artifact){
 if(bytes.length>4*1024*1024||bytes.length!==artifact.size_in_bytes||'sha256:'+createHash('sha256').update(bytes).digest('hex')!==artifact.digest)fail('Checkpoint archive digest or size mismatch');
}
export function validateRestoredText(text,review){
 if(Buffer.byteLength(text)>4*1024*1024)fail('Uncompressed checkpoint exceeds size budget');
 const e=decodeCheckpoint(text);
 if(e.previous_digest!==null&&!/^[a-f0-9]{64}$/.test(e.previous_digest||''))fail('Invalid predecessor digest');
 if(review){const p=review.predecessor;if(e.digest!==p.checkpoint_digest||e.previous_digest!==p.previous_digest||e.state.sequence!==p.sequence)fail('Reviewed checkpoint lineage changed');}
 return e;
}

export function assertFirstBootstrap(artifacts,runs,currentRunId){
 if(artifacts.length||runs.some(r=>String(r.id)!==String(currentRunId)&&relevant(r)))
  fail('Monitor history already exists; bootstrap cannot reset acknowledged incidents. Review recovery instead');
}
