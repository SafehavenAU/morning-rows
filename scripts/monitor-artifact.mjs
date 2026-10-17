// Public aggregate checkpoint transport. GH_TOKEN stays in the environment.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {chooseCheckpoint,assertFirstBootstrap,CHECKPOINT_NAME} from '../lib/monitor-artifact.js';
const exec=promisify(execFile),repo=process.env.GITHUB_REPOSITORY||'SafehavenAU/morning-rows';
if(repo!=='SafehavenAU/morning-rows')throw Error('Unexpected monitor repository');
const [directory,mode]=process.argv.slice(2);if(!directory)throw Error('State directory required');
async function api(path){return JSON.parse((await exec('gh',['api',`repos/${repo}/${path}`],{maxBuffer:2*1024*1024})).stdout);}
// GitHub returns newest runs/artifacts first. Refuse reset even if historical
// artifacts have expired. A later failed upload cannot roll state back silently.
const listing=await api(`actions/artifacts?name=${CHECKPOINT_NAME}&per_page=100`);
const history=await api('actions/workflows/monitor.yml/runs?branch=main&per_page=100');
const runs=history.workflow_runs||[],artifacts=listing.artifacts||[];
if(mode==='--bootstrap-guard'){
 // Query workflow-specific history as well: unrelated runs must not crowd out
 // old monitor runs from the first page. A missing workflow is a setup error.
 const monitor=await api('actions/workflows/monitor.yml/runs?per_page=2');
 assertFirstBootstrap(artifacts,[...runs,...(monitor.workflow_runs||[])],process.env.GITHUB_RUN_ID);
 console.log('Explicit first bootstrap permitted; no prior monitor history.');
}else{
 const {artifact:latest,producer:run}=chooseCheckpoint(artifacts,runs,process.env.GITHUB_RUN_ID);
 await mkdir(directory,{recursive:true});const zip=join(directory,'checkpoint.zip');
 const {stdout}=await exec('gh',['api',`repos/${repo}/actions/artifacts/${latest.id}/zip`],{encoding:'buffer',maxBuffer:4*1024*1024});await writeFile(zip,stdout,{mode:0o600});
 const names=(await exec('unzip',['-Z1',zip])).stdout.trim().split('\n');if(names.length!==1||names[0]!=='checkpoint.json')throw Error('Unexpected checkpoint archive entries');
 const text=(await exec('unzip',['-p',zip,'checkpoint.json'],{maxBuffer:4*1024*1024})).stdout;const e=decodeCheckpoint(text);
 await writeFile(join(directory,'state.json'),text,{mode:0o600});
 await writeFile(join(directory,'restored.json'),JSON.stringify({artifact_id:latest.id,producer_run:run.id,producer_revision:run.head_sha,state_sequence:e.state.sequence,digest:e.digest},null,2)+'\n');
 console.log(JSON.stringify({restored_artifact:latest.id,sequence:e.state.sequence}));
}
