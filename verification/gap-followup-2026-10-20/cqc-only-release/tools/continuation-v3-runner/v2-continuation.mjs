// One exact continuation after a tail readiness failure before a claimant desk request.
// No network, retries, deployment, cache changes, receipt or checkpoint operations.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const tools=dirname(fileURLToPath(import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const MANIFEST_SHA='5ff163fbd149ce45e5bc199ba52bbfbc92aec13318f9f3429912fefc97b98c56';
const ID='cqc-r2-tail-readiness-continuation-v2';
const PREFIX=['local-preflight','active-contract-scope','usa-cold-cpu','legacy-cold-cpu','added-source-fresh-cpu'];
const COPIED=[...PREFIX.map(n=>'logs/'+n+'.log'),'staged-us-cpu.json','staged-legacy-cpu.json','staged-added-source-cpu.json'];
const json=async p=>JSON.parse(await readFile(p));
const time=x=>{const t=Date.parse(x);assert.ok(Number.isFinite(t)&&t<=Date.now(),'Invalid/future timestamp');return t;};
async function list(root){const out=[];async function visit(p){for(const d of await readdir(p,{withFileTypes:true})){const file=join(p,d.name);assert.ok(!d.isSymbolicLink(),'Symlink forbidden');if(d.isDirectory())await visit(file);else{assert.ok(d.isFile(),'Only regular files');out.push(relative(root,file));}}}await visit(root);return out.sort();}
async function manifest(){const b=await readFile(join(tools,'prefix-manifest.json'));assert.equal(sha(b),MANIFEST_SHA);return JSON.parse(b);}
async function verifyFailed(root,repo,revision,version){
 const m=await manifest();assert.equal(revision,m.revision);assert.equal(version,m.version);
 assert.deepEqual(await list(root),m.files.map(x=>x.file).sort(),'Exact failed-attempt membership required');
 for(const x of m.files){const b=await readFile(join(root,x.file));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256,'Failed-attempt bytes changed: '+x.file);}
 const s=await json(join(root,'summary.json'));assert.equal(s.pass,false);assert.equal(s.phase,'staged');assert.equal(s.revision,revision);assert.equal(s.version,version);assert.equal(s.exit_code,1);assert.equal(s.last_step,m.failed_gate);assert.equal(s.runner_sha256,m.original_runner_sha256);assert.equal(s.tool_bundle_manifest_sha256,m.original_bundle_sha256);assert.equal(s.baseline_sha256_before_cpu,m.baseline_sha256);
 const steps=(await readFile(join(root,'steps.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(steps,s.steps);assert.deepEqual(steps.map(x=>x.step),[...PREFIX,m.failed_gate]);assert.ok(steps.slice(0,5).every(x=>x.pass===true&&x.exit_code===0));assert.equal(steps[5].pass,false);assert.equal(steps[5].exit_code,1);assert.ok(steps.every((x,i)=>time(x.finished_at)<=(i===5?time(s.finished_at):time(steps[i+1].finished_at))));
 assert.equal(sha(await readFile(join(repo,'verification/monitoring-baseline.json'))),m.baseline_sha256,'Accepted baseline changed');
 const pre=JSON.parse(await readFile(join(root,'logs/local-preflight.log'),'utf8'));assert.equal(pre.pass,true);for(const x of pre.inputs){const b=await readFile(join(repo,x.file));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256,'Runtime verification tool changed');}
 const f=await json(join(root,'staged-claimant-cpu.json'));assert.equal(f.error,'tail_not_ready');assert.equal(f.budget_pass,false);assert.equal(f.version,version);assert.equal(f.expected_source_revision,revision);assert.deepEqual(f.events,[]);assert.ok(!f.tail_command_error&&!f.tail_parse_error);assert.equal(f.checks.length,5);assert.ok(f.checks.every(x=>x.path==='/health.json'&&x.status===200));assert.equal(f.checks.filter(x=>x.override===true).length,1);assert.equal(f.checks.find(x=>x.override===true).origin,'https://www.morningrows.com');assert.equal(f.production_identity_confirmed,true);assert.equal(f.deployment_unchanged,true);assert.deepEqual(f.deployment_before,f.deployment_after);
 const baseline=await json(join(repo,'verification/monitoring-baseline.json'));
 const {evaluateCpuEvidence,identityMatches,stagingMatches}=await import(pathToFileURL(join(repo,'scripts/lib/us-cpu-evidence.mjs')));
 const {evaluateLegacyCpuEvidence}=await import(pathToFileURL(join(repo,'scripts/lib/legacy-cpu-evidence.mjs')));
 assert.equal(stagingMatches(f.deployment_before,version,baseline.identity),true);
 for(const c of f.checks.filter(x=>!x.override))assert.equal(identityMatches(c,baseline.identity),true);
 const us=await json(join(root,'staged-us-cpu.json')),legacy=await json(join(root,'staged-legacy-cpu.json')),fresh=await json(join(root,'staged-added-source-cpu.json'));
 assert.equal(evaluateCpuEvidence(us,baseline.identity,100).budget_pass,true);assert.equal(evaluateLegacyCpuEvidence(legacy,baseline.identity,version,revision).budget_pass,true);assert.equal(fresh.pass,true);assert.equal(fresh.input_sha256,sha(await readFile(join(root,'staged-legacy-cpu.json'))));
 for(const r of [us,legacy]){assert.equal(r.version,version);assert.equal(r.deployment_before.id,f.deployment_before.id);assert.equal(r.deployment_after.id,f.deployment_before.id);assert.ok(time(r.finished_at)<time(f.started_at));}
 assert.deepEqual(fresh.sources.map(x=>x.source),['scotland/college_activity','canada/rental_benchmark','northern-ireland/electricity_balance','england/care_assessment_cohort']);assert.ok(fresh.sources.every(x=>x.pass===true&&x.full_desk_cpu_ms<=500));
 return {m,s,steps,f};
}
const origin=(m,i)=>({kind:'imported_original_gate',continuation_id:ID,original_attempt_pass:false,original_summary_sha256:m.original_summary_sha256,original_steps_sha256:m.files.find(x=>x.file==='steps.jsonl').sha256,original_step_index:i});
export async function prepareContinuation(repo,out,revision,version){
 const m=await manifest(),old=await realpath(m.original_attempt_root);out=await realpath(out);assert.notEqual(out,old);assert.ok(!out.startsWith(old+sep));
 const {s,steps}=await verifyFailed(old,repo,revision,version);
 assert.deepEqual(await list(out),['logs/continuation-v2-preflight.log','logs/continuation-v2-scope.log'],'Fresh continuation root must contain only offline v2 preflight');
 const pre=JSON.parse(await readFile(join(out,'logs/continuation-v2-preflight.log'),'utf8'));assert.equal(pre.pass,true);assert.deepEqual(pre.bundle,await json(join(tools,'manifest.json')),'New v2 preflight must bind v2 bundle');
 const scope=JSON.parse(await readFile(join(out,'logs/continuation-v2-scope.log'),'utf8'));assert.equal(scope.pass,true);assert.equal(scope.source_states_expected,120);
 await mkdir(join(out,'prior-failed-attempt'));
 for(const x of m.files){const dest=join(out,'prior-failed-attempt',x.file);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,await readFile(join(old,x.file)),{flag:'wx'});}
 for(const file of COPIED)await writeFile(join(out,file),await readFile(join(old,file)),{flag:'wx'});
 const imported=steps.slice(0,5).map((x,i)=>({...x,provenance:origin(m,i)}));await writeFile(join(out,'steps.jsonl'),imported.map(x=>JSON.stringify(x)).join('\n')+'\n',{flag:'wx'});
 const proof={kind:ID,pass:true,uninterrupted:false,original_attempt_root:m.original_attempt_root,original_attempt_pass:false,original_summary_sha256:m.original_summary_sha256,original_runner_sha256:m.original_runner_sha256,original_bundle_sha256:m.original_bundle_sha256,prefix_manifest_sha256:MANIFEST_SHA,revision,version,prefix_count:5,required_fresh_suffix_count:28,original_failed_gate:m.failed_gate,original_failed_gate_requested_claimant_desk:false,original_failure_finished_at:s.finished_at,prepared_at:new Date().toISOString(),copied_prefix_files:COPIED.map(file=>m.files.find(x=>x.file===file)),v2_preflight_files:await Promise.all(['logs/continuation-v2-preflight.log','logs/continuation-v2-scope.log'].map(async file=>{const b=await readFile(join(out,file));return{file,bytes:b.length,sha256:sha(b)};})),claims:['The original attempt remains failed.','The logical33-gate proof combines five original successes with28 freshly executed suffix gates, including one new claimant attempt.','No CPU request is repeated for the imported USA or legacy gates.']};
 await writeFile(join(out,'continuation.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});return proof;
}
export async function verifyContinuation(out,repo,{revision,version,state='complete',requireSummary=true}={}){
 assert.ok(['prefix','before-audit','complete'].includes(state));
 const {m,s,steps:old}=await verifyFailed(join(out,'prior-failed-attempt'),repo,revision,version);const raw=await readFile(join(out,'continuation.json')),p=JSON.parse(raw);
 assert.equal(p.kind,ID);assert.equal(p.pass,true);assert.equal(p.uninterrupted,false);assert.equal(p.original_attempt_pass,false);assert.equal(p.original_attempt_root,m.original_attempt_root);assert.equal(p.original_runner_sha256,m.original_runner_sha256);assert.equal(p.original_bundle_sha256,m.original_bundle_sha256);assert.equal(p.original_failed_gate,m.failed_gate);assert.equal(p.original_summary_sha256,m.original_summary_sha256);assert.equal(p.prefix_manifest_sha256,MANIFEST_SHA);assert.equal(p.revision,revision);assert.equal(p.version,version);assert.equal(p.prefix_count,5);assert.equal(p.required_fresh_suffix_count,28);assert.equal(p.original_failed_gate_requested_claimant_desk,false);assert.equal(p.original_failure_finished_at,s.finished_at);assert.ok(time(p.prepared_at)>=time(s.finished_at));
 assert.deepEqual(p.copied_prefix_files,COPIED.map(file=>m.files.find(x=>x.file===file)));
 for(const x of p.copied_prefix_files){const b=await readFile(join(out,x.file));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);}
 assert.deepEqual(p.v2_preflight_files.map(x=>x.file),['logs/continuation-v2-preflight.log','logs/continuation-v2-scope.log']);for(const x of p.v2_preflight_files){const b=await readFile(join(out,x.file));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);}
 const pre=await json(join(out,'logs/continuation-v2-preflight.log'));assert.equal(pre.pass,true);assert.deepEqual(pre.bundle,await json(join(tools,'manifest.json')));
 const steps=(await readFile(join(out,'steps.jsonl'),'utf8')).trim().split('\n').map(JSON.parse),plan=(await json(join(tools,'step-plan.json'))).steps.staged,count={prefix:5,'before-audit':32,complete:33}[state];assert.equal(steps.length,count);assert.deepEqual(steps.map(x=>x.step),plan.slice(0,count));assert.ok(steps.every(x=>x.pass===true&&x.exit_code===0));
 for(let i=0;i<5;i++)assert.deepEqual(steps[i],{...old[i],provenance:origin(m,i)});
 for(let i=5;i<steps.length;i++){assert.deepEqual(steps[i].provenance,{kind:'fresh_continuation_gate',continuation_id:ID});assert.ok(time(steps[i].finished_at)>=time(p.prepared_at));if(i>5)assert.ok(time(steps[i].finished_at)>=time(steps[i-1].finished_at));}
 if(state!=='prefix'){
  const c=await json(join(out,'staged-claimant-cpu.json'));assert.equal(c.budget_pass,true);assert.ok(!c.error);assert.ok(time(c.started_at)>=time(p.prepared_at));assert.equal(c.version,version);assert.equal(c.expected_source_revision,revision);assert.equal(c.deployment_before.id,(await json(join(out,'prior-failed-attempt/staged-claimant-cpu.json'))).deployment_after.id,'Continuation must retain same zero-percent staging deployment');assert.equal(c.deployment_after.id,c.deployment_before.id);
  const rent=await json(join(out,'staged-rent-cpu.json'));assert.equal(rent.budget_pass,true);assert.ok(time(rent.started_at)>=time(c.finished_at));
 }
 if(requireSummary){assert.equal(state,'complete');const summary=await json(join(out,'summary.json'));assert.equal(summary.phase,'staged');assert.equal(summary.revision,revision);assert.equal(summary.version,version);assert.equal(summary.exit_code,0);assert.equal(summary.last_step,'complete');assert.equal(summary.runner_sha256,sha(await readFile(join(tools,'validate-release.sh'))));assert.equal(summary.tool_bundle_manifest_sha256,sha(await readFile(join(tools,'manifest.json'))));assert.equal(summary.baseline_sha256_before_cpu,m.baseline_sha256);assert.ok(time(summary.finished_at)>=time(steps.at(-1).finished_at));assert.equal(summary.pass,true);assert.equal(summary.uninterrupted,false);assert.equal(summary.original_attempt_pass,false);assert.equal(summary.imported_gate_count,5);assert.equal(summary.fresh_gate_count,28);assert.deepEqual(summary.continuation,p);assert.deepEqual(summary.steps,steps);assert.equal(summary.continuation_sha256,sha(raw));}
 return {kind:ID,pass:true,state,revision,version,uninterrupted:false,original_attempt_pass:false,original_summary_sha256:m.original_summary_sha256,prefix_manifest_sha256:MANIFEST_SHA,continuation_sha256:sha(raw),imported_gate_count:5,fresh_gate_count:count-5,logical_gate_count:count,actual_attempt_count:2,previous_failed_gate_attempts:1};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,out,revision,version]=process.argv.slice(2);assert.equal(process.argv.length,6);const repo=await realpath(process.env.MR_REPO);
 if(mode==='prepare'){
  const m=await manifest();assert.equal(revision,m.revision);assert.equal(version,m.version);assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),revision);for(const args of [['diff','--name-only'],['diff','--cached','--name-only']])assert.equal(execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim(),'');
  console.log(JSON.stringify(await prepareContinuation(repo,out,revision,version)));
 }else{assert.ok(['prefix','before-audit','complete','finalize'].includes(mode));const state=mode==='finalize'?'complete':mode,result=await verifyContinuation(out,repo,{revision,version,state,requireSummary:mode==='complete'});if(mode==='finalize')await writeFile(join(out,'continuation-verification.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));}
}
