// Offline preservation proof from retained actual captures. Never writes a
// checkpoint or performs HTTP. Run from the repository root.
// node scripts/replay-remaining-release.mjs CHECKPOINT OLD_REPORT PRIOR_REVIEW PRIOR_APPROVALS PRIOR_REVIEW_SHA256 PRIOR_APPROVALS_SHA256 REVIEW APPROVALS REMAINING_CAPTURE GAP_CAPTURE CORE_APEX CORE_WWW NEW_OUTPUT CAPTURED_AT
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {applyRun,reviewedReleasePlan,dailyHistoryShadowStatus,remainingShadowStatus} from '../lib/monitor-state.js';
import {REGISTRY,DAILY_HISTORY_CONTRACTS,DAILY_HISTORY_UPGRADES,US_CONTRACT,CLAIMANT_CONTRACTS,RENT_CONTRACT,REMAINING_SCOPE,REMAINING_CONTRACTS,REMAINING_ELIGIBLE_CONTRACT_KEYS,ORIGINS,inspectSource} from '../lib/monitor-contracts.js';
import {verifyCapture} from '../verification/gap-pass-2026-10-20/interface-checker/support.mjs';
import {verifyCapture as verifyRemainingCapture} from '../verification/remaining-gaps-2026-10-20/interface-checker/support.mjs';
const args=process.argv.slice(2);
assert.equal(args.length,14,'CHECKPOINT OLD_REPORT PRIOR_REVIEW PRIOR_APPROVALS PRIOR_REVIEW_SHA256 PRIOR_APPROVALS_SHA256 REVIEW APPROVALS REMAINING_CAPTURE GAP_CAPTURE CORE_APEX CORE_WWW NEW_OUTPUT CAPTURED_AT required');
const [checkpointPath,oldReportPath,priorReviewPath,priorApprovalPath,priorReviewDigest,priorApprovalDigest,reviewPath,approvalPath,remainingDirectory,gapDirectory,apexDirectory,wwwDirectory,outputPath,finishedAt]=args;
assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(finishedAt)&&Number.isFinite(Date.parse(finishedAt)),'Exact retained capture-completion UTC clock required');
assert.ok(Date.parse(finishedAt)<=Date.now()+1000,'A future simulated clock cannot create evidence');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputs=new Map();
async function load(path){
 const actual=await realpath(path),bytes=await readFile(actual);
 if(inputs.has(actual))assert.equal(sha(bytes),sha(inputs.get(actual)),'Input changed during verification');
 inputs.set(actual,bytes);return {path:actual,bytes,text:bytes.toString('utf8'),value:JSON.parse(bytes)};
}
const output=resolve(outputPath);let exists=false;
try{await realpath(output);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
assert.equal(exists,false,'Output must be new evidence; existing files and checkpoints are never overwritten');
const checkpoint=await load(checkpointPath),oldFile=await load(oldReportPath),priorReviewFile=await load(priorReviewPath),priorApprovalFile=await load(priorApprovalPath),reviewFile=await load(reviewPath),approvalFile=await load(approvalPath);
assert.equal(sha(checkpoint.bytes),'73c0614e23bb044dc4b95aea7fff9a84120a795005667db95863d561cd0cd955','Exact connector-downloaded sequence-5 bytes required; review intervening real collections separately');
assert.equal(sha(oldFile.bytes),'4ffc99d952e162adf588342dfa62612a2dd11aac0c923434a6dd495dbfb2a807','Exact retained scheduled sequence-5 report required');
assert.ok(/^[a-f0-9]{64}$/.test(priorReviewDigest)&&/^[a-f0-9]{64}$/.test(priorApprovalDigest),'Explicit independently retained accepted phase-one input digests required');
assert.equal(sha(priorReviewFile.bytes),priorReviewDigest,'Exact accepted five-edge predecessor review required');
assert.equal(sha(priorApprovalFile.bytes),priorApprovalDigest,'Exact twenty-one prior approvals required');
const envelope=decodeCheckpoint(checkpoint.text),prior=envelope.state,oldReport=oldFile.value,retainedReview=priorReviewFile.value,retainedApprovals=priorApprovalFile.value,review=reviewFile.value,approvals=approvalFile.value;
const priorPlan=reviewedReleasePlan(retainedReview),plan=reviewedReleasePlan(review),scope=REMAINING_SCOPE;
assert.equal(review.enabled,true);assert.equal(priorPlan.reviews.length,5);assert.equal(plan.reviews.length,6);assert.equal(plan.scope,scope);assert.equal(plan.includeDailyHistory,true);
assert.deepEqual(plan.remainingSourceKeys,['canada/rental_benchmark','scotland/college_activity']);
assert.deepEqual(REMAINING_ELIGIBLE_CONTRACT_KEYS,plan.remainingSourceKeys);
assert.deepEqual(plan.reviews.slice(0,5),priorPlan.reviews,'All accepted release edges remain exact');
assert.deepEqual(review,{...retainedReview,continuations:[...retainedReview.continuations,review.continuations.at(-1)]},'Only the exact sixth continuation may be appended');
assert.equal(Object.keys(retainedApprovals).length,21);
const addedContracts=REMAINING_CONTRACTS.filter(c=>plan.remainingSourceKeys.includes(c.key));
assert.deepEqual(Object.keys(approvals).sort(),[...Object.keys(retainedApprovals),...addedContracts.map(c=>c.key)].sort(),'Only the two independently reconciled remaining approvals may be added');
for(const [key,value]of Object.entries(retainedApprovals))assert.deepEqual(approvals[key],value,`${key}: prior approval must be retained byte-for-byte in meaning`);
const fields=['source_revision','worker_version','build_fingerprint','source_dirty'],identity=value=>Object.fromEntries(fields.map(key=>[key,value?.[key]]));
assert.equal(prior.sequence,5);assert.equal(envelope.digest,'665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f');
assert.equal(envelope.previous_digest,'aba5cf8b893790843e6d92468cb6d09c67b286c90edc2f70443d8fcf977f68a0');
assert.deepEqual(identity(prior.approved_identity),identity(review.from));
assert.equal(oldReport.id,prior.last_run_id);assert.equal(oldReport.finished_at,prior.last_complete_collection_at);assert.equal(oldReport.producer.workflow_run,'39341442350');assert.equal(oldReport.scheduled,true);assert.equal(oldReport.complete,true);
assert.equal(Object.keys(prior.sources).length,108);assert.equal(Object.keys(oldReport.results).length,108);
assert.equal(Object.keys(prior.incidents).length,33);assert.equal(Object.keys(prior.repairs).length,36);
assert.equal(prior.started_shadow_at,'2026-10-18T23:22:22.161Z');
assert.equal(prior.outbox.find(e=>e.id==='12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6')?.status,'pending');
assert.ok(Date.parse(finishedAt)>=Date.parse(prior.last_complete_collection_at));
const starts=['us_started_shadow_at','claimants_started_shadow_at','market_rent_started_shadow_at','daily_history_started_shadow_at','remaining_started_shadow_at'];
for(const key of starts)assert.equal(prior[key],undefined);
for(const origin of ORIGINS)assert.deepEqual(identity(oldReport.identities[origin]),identity(prior.approved_identity));
const gapPath=await realpath(gapDirectory),gapReportFile=await load(join(gapPath,'gap-interface-report.json')),gapReport=gapReportFile.value;
const actualVerification=await verifyCapture(resolve('.'),gapPath,{revision:plan.target.source_revision,version:plan.target.worker_version,staged:false});
assert.equal(actualVerification.pass,true,actualVerification.error||'All actual both-domain gap capture checks required');
// Retain every capture/reference hash, not only the full bodies used below.
for(const request of gapReport.requests)if(request.file)await load(join(gapPath,request.file));
for(const reference of actualVerification.references)await load(reference.file);
assert.ok(gapReport.requests.every(r=>Date.parse(r.completed_at)<=Date.parse(finishedAt)),'Constructed transition cannot precede actual captures');
const remainingPath=await realpath(remainingDirectory),remainingReportFile=await load(join(remainingPath,'remaining-interface-report.json')),remainingReport=remainingReportFile.value;
const remainingVerification=await verifyRemainingCapture(resolve('.'),remainingPath,{revision:plan.target.source_revision,version:plan.target.worker_version,staged:false});
assert.equal(remainingVerification.pass,true,remainingVerification.error||'All actual both-domain remaining capture checks required');
for(const request of remainingReport.requests)if(request.file)await load(join(remainingPath,request.file));
for(const reference of remainingVerification.references)await load(reference.file);
assert.ok(remainingReport.requests.every(r=>Date.parse(r.completed_at)<=Date.parse(finishedAt)),'Constructed transition cannot precede actual remaining captures');
const coreDirectories=Object.fromEntries(await Promise.all(ORIGINS.map(async(origin,index)=>[origin,await realpath(index?wwwDirectory:apexDirectory)])));
const existingContracts=[US_CONTRACT,...CLAIMANT_CONTRACTS,RENT_CONTRACT,REGISTRY.find(c=>c.key==='canada/product')];
const contracts=[...existingContracts,...DAILY_HISTORY_CONTRACTS,...addedContracts],results={},versions={},captureIdentities={};
for(const origin of ORIGINS){
 const health=await load(join(coreDirectories[origin],'_health.json.response'));
 assert.deepEqual(identity(health.value),identity(plan.target),`${origin}: exact core health identity required`);
 const gapHealthRequest=gapReport.requests.find(r=>r.origin===origin&&r.path==='/health.json'&&r.method==='GET');
 assert.ok(gapHealthRequest);const gapHealth=await load(join(gapPath,gapHealthRequest.file));
 assert.deepEqual(identity(gapHealth.value),identity(plan.target),`${origin}: exact gap health identity required`);
 const remainingHealthRequest=remainingReport.requests.find(r=>r.origin===origin&&r.path==='/health.json'&&r.method==='GET');
 assert.ok(remainingHealthRequest);const remainingHealth=await load(join(remainingPath,remainingHealthRequest.file));
 assert.deepEqual(identity(remainingHealth.value),identity(plan.target),`${origin}: exact remaining health identity required`);
 captureIdentities[origin]=identity(health.value);
 for(const contract of contracts){
  const isGap=DAILY_HISTORY_CONTRACTS.some(c=>c.key===contract.key),isRemaining=addedContracts.some(c=>c.key===contract.key);
  let capturedAt,bodyFile;
  if(isGap||isRemaining){
   const captureReport=isRemaining?remainingReport:gapReport,capturePath=isRemaining?remainingPath:gapPath;
   const request=captureReport.requests.find(r=>r.origin===origin&&r.path===`/${contract.desk}.json`&&r.method==='GET'&&r.status===200&&!r.conditional);
   assert.ok(request,`${origin} ${contract.key}: retained full desk capture required`);
   bodyFile=await load(join(capturePath,request.file));capturedAt=request.completed_at;
  }else bodyFile=await load(join(coreDirectories[origin],`_${contract.desk}.json.response`));
  const body=bodyFile.value,health=body.sources?.[contract.source];
  assert.equal(body.country,contract.country);assert.equal(health?.status,'ok',`${contract.key}: successful actual publisher retrieval required`);
  assert.ok(Number.isFinite(Date.parse(health.fetched_at))&&Date.parse(health.fetched_at)<=Date.parse(finishedAt),`${contract.key}: real retained acquisition clock required`);
  const result=await inspectSource(body,contract,{now:capturedAt||health.fetched_at});
  assert.equal(result.kind,'success',`${origin} ${contract.key}: ${result.reason||'semantic validity required'}`);
  assert.ok(result.observations.length>0&&/^[a-f0-9]{64}$/.test(result.version));
  assert.equal(approvals[contract.key]?.version,result.version,`${origin} ${contract.key}: exact independently approved version required; a new release cannot substitute`);
  assert.ok(typeof approvals[contract.key].evidence==='string'&&approvals[contract.key].evidence.trim());
  if(isRemaining)assert.equal(approvals[contract.key].evidence,plan.reviews[5].evidence,'New source approval and sixth release edge must cite the same final evidence record');
  if(versions[contract.key])assert.equal(versions[contract.key],result.version,`${contract.key}: both domains must agree on semantic version`);
  versions[contract.key]=result.version;results[contract.key]||={};results[contract.key][origin]=result;
 }
}
const original=JSON.stringify(prior),changedPriorKeys=new Set(['canada/product',...DAILY_HISTORY_UPGRADES.map(c=>c.key)]);
const run=(label,runScope,target,sourceResults)=>({id:`CONSTRUCTED-ONLY-REMAINING-${label}-${finishedAt}`,finished_at:finishedAt,complete:true,scheduled:false,scope:runScope,...(runScope===REMAINING_SCOPE?{source_contracts:[...plan.remainingSourceKeys]}:{}),requests:Array.from({length:24},()=>({constructed:true})),identities:Object.fromEntries(ORIGINS.map(origin=>[origin,structuredClone(target)])),results:sourceResults,probe_errors:[]});
const finalRun=label=>run(label,scope,plan.target,results),options={approvedRelease:review,approvedVersions:approvals};
function assertPreserved(before,after){
 assert.equal(after.sequence,before.sequence+1);
 assert.deepEqual(after.incidents,before.incidents,'All existing incidents remain');
 assert.deepEqual(after.repairs,before.repairs,'All existing repair records remain');
 assert.deepEqual(after.outbox,before.outbox,'Pending delivery event and history remain');
 assert.deepEqual(after.runs.slice(0,-1),before.runs);assert.equal(after.runs.at(-1).scheduled,false);
 assert.equal(after.started_shadow_at,before.started_shadow_at);
 assert.deepEqual(after.policy,{...before.policy,max_public_requests_per_collection:24});
 for(const key of starts)assert.equal(after[key],undefined,'Constructed cases never establish new scheduled starts');
 for(const [key,value]of Object.entries(prior.sources))if(!changedPriorKeys.has(key))assert.deepEqual(after.sources[key],value,`${key}: unrelated original source state unchanged`);
}
const directRun=finalRun('direct'),direct=applyRun(prior,directRun,options);assertPreserved(prior,direct);
assert.deepEqual(applyRun(direct,directRun,options),direct,'Repeated constructed run ID remains idempotent');
const prefixes=[];
for(let count=1;count<=5;count++){
 const prefixReview={enabled:true,...structuredClone(plan.reviews[0]),...(count>1?{continuations:structuredClone(plan.reviews.slice(1,count))}:{})};
 const prefixPlan=reviewedReleasePlan(prefixReview),prefix=applyRun(prior,run(`hypothetical-prefix-${count}`,prefixPlan.scope,prefixPlan.target,{}),{approvedRelease:prefixReview});
 const suffix=applyRun(prefix,finalRun(`suffix-after-${count}`),options);
 assertPreserved(prior,prefix);assertPreserved(prefix,suffix);
 assert.deepEqual(suffix.release_reviews.slice(0,-1),prefix.release_reviews);
 assert.deepEqual(suffix.release_reviews.at(-1).reviewed_chain.map(edge=>edge.observed_in_collection),Array.from({length:6-count},(_,index)=>index===5-count));
 for(const key of ['us_scope_first_complete_at',...(count>=2?['claimants_scope_first_complete_at']:[]),...(count>=3?['market_rent_scope_first_complete_at']:[]),...(count>=5?['daily_history_scope_first_complete_at']:[])])assert.equal(suffix[key],prefix[key]);
 prefixes.push({count,prefix,suffix});
}
for(const next of [direct,...prefixes.map(p=>p.suffix)]){
 assert.deepEqual(identity(next.approved_identity),identity(plan.target));assert.equal(next.runs.at(-1).scope,scope);assert.equal(Object.keys(next.sources).length,118);
 assert.equal(next.daily_history_scope_first_complete_at,finishedAt);
 assert.equal(dailyHistoryShadowStatus(next,finishedAt).operating_window_pass,false);
 assert.equal(dailyHistoryShadowStatus(next,finishedAt).complete_runs,0);
 assert.deepEqual(next.remaining_source_contracts,plan.remainingSourceKeys);
 assert.equal(remainingShadowStatus(next,finishedAt).complete_runs,0);assert.equal(remainingShadowStatus(next,finishedAt).operating_window_pass,false);
 for(const contract of contracts){assert.equal(next.sources[contract.key].last_independently_verified.version,versions[contract.key]);assert.equal(next.sources[contract.key].pending_verification,undefined);}
}
const audit=direct.release_reviews.at(-1);
assert.deepEqual(direct.release_reviews.slice(0,-1),prior.release_reviews||[]);
assert.deepEqual(audit.reviewed_chain.map(edge=>edge.observed_in_collection),[false,false,false,false,false,true]);
assert.equal(JSON.stringify(prior),original);
assert.ok(!inputs.has(output),'Evidence output cannot replace an input');
for(const [path,bytes]of inputs)assert.equal(sha(await readFile(path)),sha(bytes),'Inputs unchanged after verification');
const evidence={
 kind:'Constructed offline six-edge release preservation proof from actual both-domain captures; not a collector run or scheduled acceptance',
 pass:true,constructed:true,run_scheduled:false,checked_at:new Date().toISOString(),constructed_at:finishedAt,
 time_basis:'Caller-supplied retained capture-completion clock; daily source validity checked at each recorded HTTP response time',
 inputs:[...inputs].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes)})),
 prior_sequence:5,prior_digest:envelope.digest,prior_run:'39341442350',retained_review_edges:5,final_review_edges:6,
 final_identity:identity(plan.target),actual_capture_identities:captureIdentities,exact_both_domain_observation_versions:versions,
 remaining_capture_validation:{pass:true,requests:remainingVerification.requests,checks:remainingVerification.checks.length,independent_cells_per_domain:remainingVerification.independent_cells_per_domain},
 gap_capture_validation:{pass:true,requests:actualVerification.requests,checks:actualVerification.checks.length,independent_cells:actualVerification.independent_cells},
 direct:{constructed_next_sequence:direct.sequence,constructed_runs_added:1,release_audit:audit},
 hypothetical_prefixes:prefixes.map(({count,prefix,suffix})=>({reviewed_prefix_edges:count,prefix_is_hypothetical:true,constructed_prefix_sequence:prefix.sequence,constructed_final_sequence:suffix.sequence,constructed_runs_added:2,release_audit:suffix.release_reviews.at(-1),prior_history_preserved:true})),
 incident_count:33,repair_count:36,incidents_equal:true,all_repairs_equal:true,outbox_equal:true,
 original_other_102_source_states_equal:true,exact_updated_original_contracts:[...changedPriorKeys],total_obligations:118,public_probe_budget:24,
 original_shadow_start:prior.started_shadow_at,original_shadow_start_unchanged:true,new_scope_scheduled_starts_absent:true,daily_history_shadow:dailyHistoryShadowStatus(direct,finishedAt),remaining_shadow:remainingShadowStatus(direct,finishedAt),source_contracts:plan.remainingSourceKeys,
 actual_checkpoint_sequence_unchanged:5,actual_scheduled_cycles_added:0,checkpoint_written:false,notification_delivered:false,remote_calls:0,
 limitations:[
  'The capture bytes and HTTP metadata are retained real inputs; collection IDs and required-request placeholders in this algebraic proof are constructed.',
  'Hypothetical prefixes contain no publisher observations and prove suffix preservation only; they are not actual intermediate collections or scheduled executions.',
  'The caller pins the separately accepted phase-one review and approval bytes by SHA-256. The helper does not establish phase-one production acceptance.',
  'Prior approvals remain unchanged. New exact approvals must be justified by the retained independent publisher reconciliations and final production acceptance; this helper creates none.',
  'The other 102 original source states are deliberately not replayed from new public probes here. Separate release regression checks must assess them.',
  'No checkpoint is written. The next serialized collector must perform the actual six-edge or remaining-suffix transition; any intervening real run requires separate lineage verification.',
 ],
};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,pass:true,constructed:true,prior_sequence:5,incident_count:33,repair_count:36,actual_scheduled_cycles_added:0,checkpoint_written:false}));
