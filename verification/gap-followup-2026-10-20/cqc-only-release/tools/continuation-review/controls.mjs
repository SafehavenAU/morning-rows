// Offline constructed controls. No actual continuation, Git, network or publisher requests.
import assert from 'node:assert/strict';import{readFile,writeFile,mkdir,cp,unlink,symlink}from'node:fs/promises';import{join}from'node:path';import{createHash}from'node:crypto';
import{prepareContinuation,verifyContinuation}from'./runner/continuation.mjs';
const root='/tmp/mr-dated-release-review/cqc-continuation-v2',repo='/workspace/morning-rows-aemo-followup',seed=join(root,'control-prefix-hardened'),revision='7d7ed892c469d6f589dabf52283fc31dfef98d8a',version='16e5a892-be54-4381-a9c3-98ae4e47a309',sha=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await readFile(p));const edit=async(p,f)=>{const j=await json(p);f(j);await writeFile(p,JSON.stringify(j,null,2)+'\n');};
await prepareContinuation(repo,seed,revision,version);const checks=[];
const verify=(p,opts={})=>verifyContinuation(p,repo,{revision,version,state:'prefix',requireSummary:false,...opts});
assert.equal((await verify(seed)).pass,true);checks.push({name:'Exact original five-gate prefix with current offline v2 preflight',pass:true});
const cases=[
 ['wrong-source',async()=>{}, {revision:'0'.repeat(40)}],['wrong-version',async()=>{}, {version:'00000000-0000-0000-0000-000000000000'}],
 ['changed-original-summary',p=>edit(join(p,'prior-failed-attempt/summary.json'),j=>{j.pass=true;})],
 ['original-past-claimant-desk-request',p=>edit(join(p,'prior-failed-attempt/staged-claimant-cpu.json'),j=>{j.checks.push({path:'/northern-ireland.json',override:true});})],
 ['original-unexpected-tail-event',p=>edit(join(p,'prior-failed-attempt/staged-claimant-cpu.json'),j=>{j.events.push({request_path:'/northern-ireland.json'});})],
 ['changed-original-USA',p=>edit(join(p,'prior-failed-attempt/staged-us-cpu.json'),j=>{j.budget_pass=false;})],
 ['changed-imported-legacy',p=>edit(join(p,'staged-legacy-cpu.json'),j=>{j.budget_pass=false;})],
 ['missing-original-member',p=>unlink(join(p,'prior-failed-attempt/logs/claimant-www-cold-cpu.log'))],
 ['extra-original-member',p=>writeFile(join(p,'prior-failed-attempt/extra.json'),'{}')],
 ['symlink-original-member',async p=>{const q=join(p,'prior-failed-attempt/logs/claimant-www-cold-cpu.log');await unlink(q);await symlink('/tmp/mr-cqc-r2-staged-r1/logs/claimant-www-cold-cpu.log',q);}],
 ['forged-imported-provenance',async p=>{const f=join(p,'steps.jsonl'),s=(await readFile(f,'utf8')).trim().split('\n').map(JSON.parse);s[2].provenance.kind='fresh_continuation_gate';await writeFile(f,s.map(JSON.stringify).join('\n')+'\n');}],
 ['missing-imported-gate',async p=>{const f=join(p,'steps.jsonl'),s=(await readFile(f,'utf8')).trim().split('\n');s.splice(2,1);await writeFile(f,s.join('\n')+'\n');}],
 ['forged-uninterrupted-claim',p=>edit(join(p,'continuation.json'),j=>{j.uninterrupted=true;})],
 ['forged-original-root',p=>edit(join(p,'continuation.json'),j=>{j.original_attempt_root='/tmp/other';})],
 ['forged-prefix-count',p=>edit(join(p,'continuation.json'),j=>{j.prefix_count=6;})],
 ['missing-v2-preflight',p=>unlink(join(p,'logs/continuation-v2-preflight.log'))],
 ['changed-v2-preflight',p=>edit(join(p,'logs/continuation-v2-preflight.log'),j=>{j.bundle.files=[];})],
 ['wrong-baseline-root',async()=>{}, {repo:'/tmp'}],
];
for(const[name,mutate,opts]of cases){const p=join(root,'case-final-'+name);await cp(seed,p,{recursive:true,errorOnExist:true});await mutate(p);await assert.rejects(()=>opts?.repo?verifyContinuation(p,opts.repo,{revision,version,state:'prefix',requireSummary:false}):verify(p,opts));checks.push({name:name+' refused',pass:true});}
// The synthetic suffix below exercises chronology/provenance guards only. It is
// not a valid33-gate release, contains no HTTP captures and is never accepted.
const suffix=join(root,'constructed-suffix-final');await cp(seed,suffix,{recursive:true,errorOnExist:true});
const prepared=(await json(join(seed,'continuation.json'))).prepared_at,stamp=new Date().toISOString(),plan=(await json(join(root,'runner/step-plan.json'))).steps.staged;
const prefix=(await readFile(join(seed,'steps.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);const rows=[...prefix,...plan.slice(5,-1).map(step=>({step,pass:true,exit_code:0,finished_at:stamp,provenance:{kind:'fresh_continuation_gate',continuation_id:'cqc-r2-tail-readiness-continuation-v2'}}))];await writeFile(join(suffix,'steps.jsonl'),rows.map(JSON.stringify).join('\n')+'\n');
const previous=await json(join(seed,'prior-failed-attempt/staged-claimant-cpu.json'));
await writeFile(join(suffix,'staged-claimant-cpu.json'),JSON.stringify({constructed_control_only:true,budget_pass:true,version,expected_source_revision:revision,started_at:stamp,finished_at:stamp,deployment_before:previous.deployment_after,deployment_after:previous.deployment_after}));await writeFile(join(suffix,'staged-rent-cpu.json'),JSON.stringify({constructed_control_only:true,budget_pass:true,started_at:stamp}));
const suffixCases=[
 ['forged-fresh-provenance',async p=>{const f=join(p,'steps.jsonl'),s=(await readFile(f,'utf8')).trim().split('\n').map(JSON.parse);s[5].provenance.kind='imported_original_gate';await writeFile(f,s.map(JSON.stringify).join('\n')+'\n');}],
 ['old-suffix-clock',async p=>{const f=join(p,'steps.jsonl'),s=(await readFile(f,'utf8')).trim().split('\n').map(JSON.parse);s[5].finished_at='2026-10-20T18:00:00Z';await writeFile(f,s.map(JSON.stringify).join('\n')+'\n');}],
 ['old-claimant-request',p=>edit(join(p,'staged-claimant-cpu.json'),j=>{j.started_at='2026-10-20T18:00:00Z';})],
 ['changed-staging-deployment',p=>edit(join(p,'staged-claimant-cpu.json'),j=>{j.deployment_before.id='different';})],
 ['claimant-failed-again',p=>edit(join(p,'staged-claimant-cpu.json'),j=>{j.budget_pass=false;j.error='tail_not_ready';})],
 ['rent-before-claimant',p=>edit(join(p,'staged-rent-cpu.json'),j=>{j.started_at='2026-10-20T18:00:00Z';})],
 ['incomplete-suffix',async p=>{const f=join(p,'steps.jsonl'),s=(await readFile(f,'utf8')).trim().split('\n');s.pop();await writeFile(f,s.join('\n')+'\n');}],
];
for(const[name,mutate]of suffixCases){const p=join(root,'case-final-'+name);await cp(suffix,p,{recursive:true,errorOnExist:true});await mutate(p);await assert.rejects(()=>verify(p,{state:'before-audit'}));checks.push({name:name+' refused',pass:true});}
await assert.rejects(()=>verify(suffix,{state:'complete',requireSummary:true}));checks.push({name:'Constructed incomplete suffix cannot establish full-stage acceptance',pass:true});

const complete=join(root,'constructed-complete-metadata-only');await cp(suffix,complete,{recursive:true,errorOnExist:true});
const completeRows=[...rows,{step:'final-offline-gate-audit',pass:true,exit_code:0,finished_at:stamp,provenance:{kind:'fresh_continuation_gate',continuation_id:'cqc-r2-tail-readiness-continuation-v2'}}];await writeFile(join(complete,'steps.jsonl'),completeRows.map(JSON.stringify).join('\n')+'\n');const continuationBytes=await readFile(join(complete,'continuation.json'));
const summary={constructed_control_only:true,pass:true,phase:'staged',revision,version,exit_code:0,last_step:'complete',finished_at:stamp,runner_sha256:sha(await readFile(join(root,'runner/validate-release.sh'))),tool_bundle_manifest_sha256:sha(await readFile(join(root,'runner/manifest.json'))),baseline_sha256_before_cpu:'13717dddf44f3393848116124cf7f1338a1a653e8212fed9aac5b21827e48cdf',uninterrupted:false,original_attempt_pass:false,imported_gate_count:5,fresh_gate_count:28,continuation:JSON.parse(continuationBytes),continuation_sha256:sha(continuationBytes),steps:completeRows};await writeFile(join(complete,'summary.json'),JSON.stringify(summary));
for(const[key,value]of [['phase','production'],['revision','0'.repeat(40)],['version','00000000-0000-0000-0000-000000000000'],['exit_code',1],['last_step','claimant-www-cold-cpu'],['runner_sha256','0'.repeat(64)],['tool_bundle_manifest_sha256','0'.repeat(64)],['baseline_sha256_before_cpu','0'.repeat(64)]]){const p=join(root,'case-final-summary-'+key);await cp(complete,p,{recursive:true,errorOnExist:true});await edit(join(p,'summary.json'),j=>{j[key]=value;});await assert.rejects(()=>verify(p,{state:'complete',requireSummary:true}));checks.push({name:'Conflicting summary '+key+' refused',pass:true});}

const report={kind:'Constructed offline exact-continuation guard controls',pass:true,count:checks.length,checks,tools:{verifier_sha256:sha(await readFile(join(root,'runner/continuation.mjs'))),runner_sha256:sha(await readFile(join(root,'runner/validate-release.sh'))),manifest_sha256:sha(await readFile(join(root,'runner/manifest.json')))},actual_stage_continued:false,http_requests:0,git_operations:0,source_changes:0,receipt_or_checkpoint_writes:0};await writeFile(join(root,'controls.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,count:checks.length}));
