// Public aggregate transport. Never expose child stderr: redirects can be signed.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chooseCheckpoint,selectProducer,readPages,validateArchive,validateRestoredText,validateRecoveryEvidence,assertFirstBootstrap,CHECKPOINT_NAME,WORKFLOW_ID} from '../lib/monitor-artifact.js';
const rawExec=promisify(execFile);
const exec=async(...args)=>{try{return await rawExec(...args);}catch{throw Error('Checkpoint transport command failed; signed URLs and credentials withheld; state not reset');}};
const repo=process.env.GITHUB_REPOSITORY||'SafehavenAU/morning-rows';
if(repo!=='SafehavenAU/morning-rows')throw Error('Unexpected monitor repository');
const [directory,mode]=process.argv.slice(2);if(!directory||![undefined,'--recover','--bootstrap-guard'].includes(mode))throw Error('State directory and supported mode required');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw Error('Restore requires serialized main workflow first attempt');
async function api(path){return JSON.parse((await exec('gh',['api',`repos/${repo}/${path}`],{maxBuffer:4*1024*1024})).stdout);}
const workflow=await api('actions/workflows/monitor.yml');
if(workflow.id!==WORKFLOW_ID||workflow.path!=='.github/workflows/monitor.yml')throw Error('Workflow identity changed; review required');
const history=()=>readPages(api,`actions/workflows/${WORKFLOW_ID}/runs?branch=main`,'workflow_runs');
const artifactList=id=>readPages(api,`actions/runs/${id}/artifacts`,'artifacts');
const runs=await history();
if(mode==='--bootstrap-guard'){
 const artifacts=await readPages(api,`actions/artifacts?name=${CHECKPOINT_NAME}`,'artifacts');
 const review=JSON.parse(await readFile(new URL('../operations/bootstrap-review.json',import.meta.url),'utf8'));
 const reviewed=new Set(review.failed_before_state_creation.map(r=>r.run_id));
 assertFirstBootstrap(artifacts,runs.filter(r=>!reviewed.has(r.id)),process.env.GITHUB_RUN_ID);
 console.log('Explicit first bootstrap permitted; no prior monitor history.');
}else{
 const recovery=mode==='--recover'?JSON.parse(await readFile(new URL('../operations/checkpoint-recovery-review.json',import.meta.url),'utf8')):undefined;
 const options={recovery},currentId=process.env.GITHUB_RUN_ID;
 const selected=selectProducer(runs,currentId,options);
 if(selected.current.head_sha!==process.env.GITHUB_SHA)throw Error('Current workflow revision mismatch');
 async function verifyFailure(){
  if(!recovery)return;
  const jobs=await readPages(api,`actions/runs/${recovery.failed.id}/attempts/${recovery.failed.run_attempt}/jobs`,'jobs');
  validateRecoveryEvidence(recovery,jobs,await artifactList(recovery.failed.id));
 }
 await verifyFailure();
 const artifacts=await artifactList(selected.producer.id);
 const {artifact:latest,producer:run}=chooseCheckpoint(artifacts,runs,currentId,options);
 const ancestry=await api(`compare/${run.head_sha}...${selected.current.head_sha}`);
 if(!['ahead','identical'].includes(ancestry.status)||ancestry.behind_by!==0)throw Error('Checkpoint producer is not an ancestor of current main');
 // gh redirect is used only inside the hosted Actions runner, where verified.
 // External diagnosis uses the GitHub connector download, not this transport.
 const {stdout:bytes}=await exec('gh',['api',`repos/${repo}/actions/artifacts/${latest.id}/zip`],{encoding:'buffer',maxBuffer:4*1024*1024});
 validateArchive(bytes,latest);
 await mkdir(directory,{recursive:true});const zip=join(directory,'checkpoint.zip');await writeFile(zip,bytes,{mode:0o600,flag:'wx'});
 const names=(await exec('unzip',['-Z1',zip])).stdout.trim().split('\n');if(names.length!==1||names[0]!=='checkpoint.json')throw Error('Unexpected checkpoint archive entries');
 const text=(await exec('unzip',['-p',zip,'checkpoint.json'],{maxBuffer:4*1024*1024})).stdout;
 const e=validateRestoredText(text,recovery);
 // Fail if a concurrent/retried execution or replaced artifact appeared meanwhile.
 const freshRuns=await history();
 const fresh=chooseCheckpoint(await artifactList(run.id),freshRuns,currentId,options);
 if(fresh.producer.id!==run.id||fresh.producer.run_attempt!==run.run_attempt||fresh.producer.head_sha!==run.head_sha||fresh.artifact.id!==latest.id||fresh.artifact.digest!==latest.digest||fresh.current.head_sha!==selected.current.head_sha)throw Error('Workflow frontier changed during restoration');
 await verifyFailure();
 await writeFile(join(directory,'state.json'),text,{mode:0o600,flag:'wx'});
 await writeFile(join(directory,'restored.json'),JSON.stringify({artifact_id:latest.id,archive_digest:latest.digest,producer_run:run.id,producer_attempt:run.run_attempt,producer_revision:run.head_sha,producer_run_number:run.run_number,state_sequence:e.state.sequence,digest:e.digest,previous_digest:e.previous_digest,current_run:Number(currentId),current_attempt:1,restored_at:new Date().toISOString(),recovery:recovery?{failed_run:recovery.failed.id,failed_attempt:recovery.failed.run_attempt,review:'operations/checkpoint-recovery-review.json',state_mutated:false}:null},null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({restored_artifact:latest.id,sequence:e.state.sequence,digest:e.digest,recovery:Boolean(recovery)}));
}
