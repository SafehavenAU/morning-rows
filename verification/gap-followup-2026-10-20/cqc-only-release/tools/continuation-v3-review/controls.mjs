// Constructed offline controls only; no actual continuation, Git or HTTP.
import assert from 'node:assert/strict';import{readFile,writeFile,cp,unlink,symlink}from'node:fs/promises';import{join}from'node:path';import{createHash}from'node:crypto';
import{prepareContinuation,verifyContinuation}from'./runner/continuation.mjs';
import{evaluateRentSourceCpuEvidence as originalEvaluate}from'/workspace/morning-rows-aemo-followup/scripts/verify-rent-source-cpu.mjs';
import{evaluateRentSourceCpuEvidence as derivedEvaluate}from'./runner/verify-rent-source-cpu-startup.mjs';
const root='/tmp/mr-dated-release-review/cqc-continuation-v3',repo='/workspace/morning-rows-aemo-followup',seed=join(root,'control-prefix-final'),revision='7d7ed892c469d6f589dabf52283fc31dfef98d8a',version='16e5a892-be54-4381-a9c3-98ae4e47a309',sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p));
const edit=async(p,f)=>{const j=await json(p);f(j);await writeFile(p,JSON.stringify(j,null,2)+'\n');};
await prepareContinuation(repo,seed,revision,version);const checks=[];const verify=(p,opts={})=>verifyContinuation(p,repo,{revision,version,state:'prefix',requireSummary:false,...opts});assert.equal((await verify(seed)).pass,true);checks.push({name:'Exact two-predecessor six-gate prefix and independently reevaluated53ms claimant',pass:true});
const stepEdit=(p,fn)=>editLines(join(p,'steps.jsonl'),fn);async function editLines(p,f){const s=(await readFile(p,'utf8')).trim().split('\n').map(JSON.parse);f(s);await writeFile(p,s.map(JSON.stringify).join('\n')+'\n');}
const cases=[
 ['wrong-source',async()=>{},{revision:'0'.repeat(40)}],['wrong-version',async()=>{},{version:'00000000-0000-0000-0000-000000000000'}],
 ['relabel-v1-pass',p=>edit(join(p,'prior-failed-attempt-v1/summary.json'),j=>{j.pass=true;})],
 ['relabel-v2-pass',p=>edit(join(p,'prior-failed-attempt-v2/summary.json'),j=>{j.pass=true;})],
 ['past-failed-claimant-desk-request',p=>edit(join(p,'prior-failed-attempt-v1/staged-claimant-cpu.json'),j=>{j.checks.push({override:true,path:'/northern-ireland.json'});})],
 ['past-failed-rent-data-request',p=>edit(join(p,'prior-failed-attempt-v2/staged-rent-cpu.json'),j=>{j.checks.push({override:true,path:'/new-zealand.json?source=market_rent'});})],
 ['past-failed-rent-trace-event',p=>edit(join(p,'prior-failed-attempt-v2/staged-rent-cpu.json'),j=>{j.events.push({cpu_ms:400});})],
 ['changed-claimant53-proof',p=>edit(join(p,'prior-failed-attempt-v2/staged-claimant-cpu.json'),j=>{j.events[1].cpu_ms=501;})],
 ['changed-original-staging-deployment',p=>edit(join(p,'prior-failed-attempt-v2/staged-claimant-cpu.json'),j=>{j.deployment_before.id='different';})],
 ['changed-imported-claimant',p=>edit(join(p,'staged-claimant-cpu.json'),j=>{j.budget_pass=false;})],
 ['changed-imported-legacy',p=>edit(join(p,'staged-legacy-cpu.json'),j=>{j.budget_pass=false;})],
 ['changed-v2-embedded-v1',p=>edit(join(p,'prior-failed-attempt-v2/prior-failed-attempt/summary.json'),j=>{j.exit_code=0;})],
 ['missing-v2-original-file',p=>unlink(join(p,'prior-failed-attempt-v2/logs/rent-www-cold-cpu.log'))],
 ['extra-v2-original-file',p=>writeFile(join(p,'prior-failed-attempt-v2/extra.json'),'{}')],
 ['symlink-original',async p=>{const q=join(p,'prior-failed-attempt-v2/logs/rent-www-cold-cpu.log');await unlink(q);await symlink('/tmp/mr-cqc-r2-staged-continuation-v2/logs/rent-www-cold-cpu.log',q);}],
 ['wrong-imported-claimant-provenance',p=>stepEdit(p,s=>{s[5].provenance.source_attempt='v1';})],
 ['changed-imported-original-time',p=>stepEdit(p,s=>{s[5].finished_at='2026-10-20T18:00:00Z';})],
 ['missing-sixth-success',p=>stepEdit(p,s=>{s.pop();})],
 ['claim-rent-as-imported-success',p=>stepEdit(p,s=>{s.push({...s[5],step:'rent-www-cold-cpu'});})],
 ['forged-uninterrupted',p=>edit(join(p,'continuation.json'),j=>{j.uninterrupted=true;})],
 ['forged-predecessor-root',p=>edit(join(p,'continuation.json'),j=>{j.original_attempts[1].root='/tmp/other';})],
 ['forged-prefix-count',p=>edit(join(p,'continuation.json'),j=>{j.prefix_count=7;})],
 ['forged-remaining-gates',p=>edit(join(p,'continuation.json'),j=>{j.required_fresh_suffix_count=26;})],
 ['startup-wait-relaxed',p=>edit(join(p,'continuation.json'),j=>{j.rent_startup_wait_ms=4000;})],
 ['continuation-before-second-failure',p=>edit(join(p,'continuation.json'),j=>{j.prepared_at='2026-10-20T19:00:00Z';})],
 ['changed-v3-preflight',p=>edit(join(p,'logs/continuation-v3-preflight.log'),j=>{j.bundle.files=[];})],
];
for(const[name,mutate,opts]of cases){const p=join(root,'case-'+name);await cp(seed,p,{recursive:true,errorOnExist:true});await mutate(p);await assert.rejects(()=>verify(p,opts));checks.push({name:name+' refused',pass:true});}
await assert.rejects(()=>verify(seed,{state:'complete',requireSummary:true}));checks.push({name:'Six-gate prefix alone refuses completed-stage acceptance',pass:true});
const original=await readFile(join(repo,'scripts/verify-rent-source-cpu.mjs'),'utf8'),derivative=await readFile(join(root,'runner/verify-rent-source-cpu-startup.mjs'),'utf8'),d=await json(join(root,'runner/rent-harness-derivation.json'));let normalized=derivative;assert.equal(d.exact_replacements.length,5);for(const x of [...d.exact_replacements].reverse()){assert.equal(normalized.split(x.derivative).length,2);normalized=normalized.replace(x.derivative,x.original);}assert.equal(normalized,original);checks.push({name:'All rent derivative bytes normalize to original through exactly five authorized replacements',pass:true});
assert.equal(originalEvaluate.toString(),derivedEvaluate.toString());checks.push({name:'Original and external rent evaluator functions byte-identical',pass:true});
assert.equal(derivative.split('await pause(20000);').length,2);assert.ok(!derivative.includes('await pause(4000);'));assert.equal(derivative.split('const until=Date.now()+10000;').length,2);assert.equal(derivative.split('const check=await read(path);').length,2);assert.equal(derivative.split('for(const path of RENT_CPU_PATHS)').length,2);assert.equal(derivative.split('startup_wait_ms:20000').length,2);checks.push({name:'One20s startup allowance retains one candidatehealth and10s correlation gate without retry',pass:true});
const failed=await json('/tmp/mr-cqc-r2-staged-continuation-v2/staged-rent-cpu.json'),baseline=await json(join(repo,'verification/monitoring-baseline.json'));const a=originalEvaluate(failed,baseline.identity,version,revision),b=derivedEvaluate(failed,baseline.identity,version,revision);assert.deepEqual(a,b);assert.equal(a.budget_pass,false);checks.push({name:'Original zero-event failed rent capture stays failed under both evaluators',pass:true});
const r={kind:'Offline exact v3 two-predecessor continuation and derivative controls',pass:true,count:checks.length,checks,tools:{runner_sha256:sha(await readFile(join(root,'runner/validate-release.sh'))),manifest_sha256:sha(await readFile(join(root,'runner/manifest.json'))),verifier_sha256:sha(await readFile(join(root,'runner/continuation.mjs'))),rent_harness_sha256:sha(Buffer.from(derivative))},actual_stage_continued:false,http_requests:0,git_operations:0,source_changes:0,checkpoint_or_receipt_writes:0};await writeFile(join(root,'controls.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({pass:true,count:checks.length}));
