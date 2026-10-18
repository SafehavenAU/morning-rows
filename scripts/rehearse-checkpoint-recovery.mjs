// Local simulated GitHub transport, real retained checkpoint bytes. No network/write to GitHub.
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
export async function rehearse(){
 const dir=await mkdtemp(join(tmpdir(),'mr-restore-rehearsal-'));
 try{
  const fixture=JSON.parse(await readFile(join(root,'verification/checkpoint-recovery-2026-10-18/github-evidence.json'),'utf8'));
  const next={...fixture.runs[0],id:99,run_number:7,run_started_at:'2026-10-18T00:00:00Z',updated_at:'2026-10-18T00:00:01Z',event:'workflow_dispatch',status:'in_progress',conclusion:null};
  // Only the simulated transport expiry is moved forward so this rehearsal remains reproducible.
  const data={...fixture,artifacts:fixture.artifacts.map(a=>({...a,expires_at:new Date(Date.now()+86400000).toISOString()})),runs:[...fixture.runs,next]};
  await writeFile(join(dir,'data.json'),JSON.stringify(data));await mkdir(join(dir,'bin'));
  const program=`#!/usr/bin/env node
import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync(${JSON.stringify(join(dir,'data.json'))}));
const path=process.argv[3];let result;
if(path.endsWith('/zip')){process.stdout.write(readFileSync(${JSON.stringify(join(root,'verification/checkpoint-recovery-2026-10-18/predecessor.zip'))}));process.exit(0);}
if(path.endsWith('actions/workflows/monitor.yml'))result={id:388034330,path:'.github/workflows/monitor.yml'};
else if(path.includes('/runs?branch=main'))result={total_count:f.runs.length,workflow_runs:f.runs};
else if(path.includes('/attempts/1/jobs'))result={total_count:f.failed_jobs.length,jobs:f.failed_jobs};
else if(path.includes('/39078664324/artifacts'))result={total_count:0,artifacts:[]};
else if(path.includes('/39077529097/artifacts')){const artifacts=f.artifacts.filter(a=>a.workflow_run.id===39077529097);result={total_count:artifacts.length,artifacts};}
else if(path.includes('/compare/'))result={status:'ahead',behind_by:0};
else throw Error('Unexpected simulated API request');
process.stdout.write(JSON.stringify(result));
`;
  await writeFile(join(dir,'bin','gh'),program,{mode:0o700});
  const stateDir=join(dir,'state');
  await exec(process.execPath,[join(root,'scripts/monitor-artifact.mjs'),stateDir,'--recover'],{env:{...process.env,PATH:join(dir,'bin')+':'+process.env.PATH,GITHUB_ACTIONS:'true',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ID:'99',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:next.head_sha,GITHUB_REPOSITORY:'SafehavenAU/morning-rows'},maxBuffer:1024*1024});
  const expected=await readFile(join(root,'verification/checkpoint-recovery-2026-10-18/12117561506.json'),'utf8');
  const actual=await readFile(join(stateDir,'state.json'),'utf8');assert.equal(actual,expected);assert.deepEqual(JSON.parse(actual),JSON.parse(expected));
  const audit=JSON.parse(await readFile(join(stateDir,'restored.json'),'utf8'));
  assert.equal(audit.recovery.failed_run,39078664324);assert.equal(audit.recovery.state_mutated,false);
  const e=JSON.parse(actual);
  return {simulation:true,network_calls:0,actual_adapter_executed:true,checkpoint_byte_identical:true,changed_fields:[],sequence:e.state.sequence,digest:e.digest,previous_digest:e.previous_digest,incident_count:Object.keys(e.state.incidents).length,pending_repairs:Object.keys(e.state.repairs),outbox:e.state.outbox.map(x=>({id:x.id,type:x.type,status:x.status})),scheduled_evidence:false};
 }finally{await rm(dir,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await rehearse(),null,2));
