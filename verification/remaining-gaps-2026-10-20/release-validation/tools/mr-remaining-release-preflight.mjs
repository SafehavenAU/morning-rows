// Offline, read-only preflight. No HTTP, repository writes, generated files or approval changes.
// node /tmp/mr-remaining-release-preflight.mjs REPOSITORY ACCEPTED_PHASE_ONE_EVIDENCE_COMMIT OUTPUT
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [directory,acceptedCommit,output,...extra]=process.argv.slice(2);
assert.ok(directory&&/^[a-f0-9]{40}$/.test(acceptedCommit||'')&&output&&!extra.length,'REPOSITORY ACCEPTED_PHASE_ONE_EVIDENCE_COMMIT OUTPUT required');
const root=resolve(directory),hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'buffer',stdio:['ignore','pipe','pipe']});
const text=(...args)=>git(...args).toString().trim();
const frozen='e7c1f3acf1e417732da37e3428a345c269ae4033';
const identity={source_revision:'bf3110e3bcbbc7db6d629254a886356e80f4c24a',source_dirty:false,build_fingerprint:'f815539b2fa5b866',worker_version:'7f93e660-666c-435a-9b8b-bc37c060ac02'};
const result={kind:'Offline phase-two preflight against accepted phase-one evidence; no source requests or release action',pass:false,accepted_evidence_commit:acceptedCommit,accepted_production_identity:identity,checks:[],runtime_files:[],protected_inputs:[]};
const check=(label,condition)=>{result.checks.push({label,pass:Boolean(condition)});assert.ok(condition,label);};
try{
 check('clean worktree',text('status','--porcelain')==='');
 git('merge-base','--is-ancestor',frozen,'HEAD');git('merge-base','--is-ancestor',acceptedCommit,'HEAD');
 result.source_revision=text('rev-parse','HEAD');result.tree=text('rev-parse','HEAD^{tree}');
 const protectedFiles=['operations/us-release-review.json','operations/approved-observations.json','operations/source-contract-registry.json','operations/acceptance.json','verification/monitoring-baseline.json'];
 for(const file of protectedFiles){const bytes=await readFile(join(root,file));check(file+' equals accepted committed evidence',bytes.equals(git('show',acceptedCommit+':'+file)));result.protected_inputs.push({file,bytes:bytes.length,sha256:hash(bytes)});}
 const json=async file=>JSON.parse(await readFile(join(root,file)));
 const review=await json(protectedFiles[0]),approvals=await json(protectedFiles[1]),registry=await json(protectedFiles[2]),baseline=await json(protectedFiles[4]);
 const {reviewedReleasePlan}=await import(pathToFileURL(join(root,'lib/monitor-state.js')));
 const {buildMonitorRegistry}=await import(pathToFileURL(join(root,'scripts/monitor-registry.mjs')));
 const plan=reviewedReleasePlan(review);
 assert.deepEqual(plan.target,identity);check('accepted fifth edge only',plan.reviews.length===5&&plan.scope==='nine-desks-plus-claimants-rent-and-daily-history'&&plan.includeDailyHistory&&plan.remainingSourceKeys.length===0);
 for(const [key,value]of Object.entries(identity))check('accepted production baseline '+key,baseline.identity[key]===value);
 check('21 accepted approvals, no premature additions',Object.keys(approvals).length===21&&!['australia/grid_day','canada/rental_benchmark','scotland/college_activity'].some(key=>Object.hasOwn(approvals,key)));
 const active=buildMonitorRegistry(review);check('accepted 116 active obligations',active.sources.length===116&&registry.sources.length===116);
 assert.deepEqual(active.sources.map(c=>c.key).sort(),registry.sources.map(c=>c.key).sort());
 check('held AEMO and pending additions remain staged',active.staged_sources.some(c=>c.key==='australia/grid_day')&&active.staged_sources.some(c=>c.key==='canada/rental_benchmark')&&active.staged_sources.some(c=>c.key==='scotland/college_activity'));
 const files=git('ls-tree','-r','--name-only','-z',frozen).toString().split('\0').filter(f=>f==='worker.js'||f.startsWith('lib/')||['wrangler.toml','package.json','package-lock.json','scripts/build-info.mjs','scripts/monitor.mjs','scripts/monitor-registry.mjs','scripts/replay-gap-release.mjs','scripts/replay-remaining-release.mjs','.github/workflows/monitor.yml','operations/monitor-policy.json'].includes(f));
 for(const file of files){const bytes=await readFile(join(root,file)),expected=git('show',frozen+':'+file);check(file+' unchanged after accepted-evidence merge',bytes.equals(expected));result.runtime_files.push({file,sha256:hash(bytes)});}
 const actualRuntime=git('ls-files','-z','lib','worker.js').toString().split('\0').filter(Boolean).sort();assert.deepEqual(actualRuntime,files.filter(f=>f.startsWith('lib/')||f==='worker.js').sort());
 const all=[...new Set(git('ls-files','-co','--exclude-standard','-z').toString().split('\0').filter(Boolean))].sort(),fingerprint=createHash('sha256');
 for(const file of all)fingerprint.update(file+'\0').update(await readFile(join(root,file))).update('\0');
 result.build_fingerprint=fingerprint.digest('hex').slice(0,16);
 const generated=await import(pathToFileURL(join(root,'.generated/build-info.js')));
 check('generated clean final source identity',generated.BUILD_REVISION===result.source_revision&&generated.BUILD_DIRTY===false&&generated.BUILD_FINGERPRINT===result.build_fingerprint);
 check('new identity does not reuse pre-evidence source fingerprint',result.source_revision!==frozen&&result.build_fingerprint!=='c204367b89f89d50');
 result.pass=true;
}catch(error){result.error=error.message;process.exitCode=1;}
result.finished_at=new Date().toISOString();
await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:result.pass,error:result.error,source_revision:result.source_revision,build_fingerprint:result.build_fingerprint,checks:result.checks.length,output:resolve(output)}));
