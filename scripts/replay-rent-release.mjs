// Constructed offline preservation proof; never a real collection/checkpoint.
// Run from the repository root after installing this file in scripts/.
// node scripts/replay-rent-release.mjs CHECKPOINT OLD_REPORT REVIEW APPROVALS CAPTURE_DIRECTORY EXPECTED_CLAIMANT_LATEST NEW_OUTPUT [CAPTURED_AT_ISO]
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
// Resolve from cwd so this evidence-only helper can also be prepared outside the checkout.
const {decodeCheckpoint}=await import(pathToFileURL(resolve('lib/monitor-store.js')));
const {applyRun,reviewedReleasePlan}=await import(pathToFileURL(resolve('lib/monitor-state.js')));
const {US_CONTRACT,CLAIMANT_CONTRACTS,RENT_CONTRACT,ORIGINS,inspectSource}=await import(pathToFileURL(resolve('lib/monitor-contracts.js')));
const args=process.argv.slice(2);
assert.ok(args.length===7||args.length===8,'Expected CHECKPOINT OLD_REPORT REVIEW APPROVALS CAPTURE_DIRECTORY EXPECTED_CLAIMANT_LATEST NEW_OUTPUT [CAPTURED_AT_ISO]');
const [checkpointPath,reportPath,reviewPath,approvalPath,captureDirectory,expectedClaimantLatest,outputPath,capturedAt]=args;
assert.ok(/^\d{4}-(0[1-9]|1[0-2])$/.test(expectedClaimantLatest),'Explicit independently verified claimant latest month required');
const expectedClaimantFirst=`${Number(expectedClaimantLatest.slice(0,4))-1}-${expectedClaimantLatest.slice(5)}`;
const contracts=[US_CONTRACT,...CLAIMANT_CONTRACTS,RENT_CONTRACT];
const directory=await realpath(captureDirectory);
const requestedInputs=[checkpointPath,reportPath,reviewPath,approvalPath,resolve('verification/claimant-count-2026-10-20/proposed-review.json'),join(directory,'_health.json.response'),...contracts.map(c=>join(directory,`_${c.desk}.json.response`))];
const inputPaths=await Promise.all(requestedInputs.map(path=>realpath(path)));
const output=resolve(outputPath);
assert.ok(!inputPaths.includes(output),'Output cannot replace an input');
let existing;try{existing=await realpath(output);}catch(error){if(error.code!=='ENOENT')throw error;}
assert.ok(!existing,'Output must be a new evidence file; never overwrite existing evidence');
const texts=await Promise.all(inputPaths.map(path=>readFile(path,'utf8')));
const [checkpointText,reportText,reviewText,approvalText,retainedReviewText,healthText,...bodyTexts]=texts;
const sha=value=>createHash('sha256').update(value).digest('hex');
const envelope=decodeCheckpoint(checkpointText),prior=envelope.state;
const oldReport=JSON.parse(reportText),review=JSON.parse(reviewText),approvedVersions=JSON.parse(approvalText),health=JSON.parse(healthText);
const plan=reviewedReleasePlan(review);
assert.equal(sha(retainedReviewText),'295ce94d3e7f059372fc46b5d1563dc879ad66f658abd13cc4af57341d3fbe17','Exact retained claimant release review required');
const retainedPlan=reviewedReleasePlan(JSON.parse(retainedReviewText));
assert.deepEqual(plan.reviews.slice(0,2),retainedPlan.reviews,'Retained exact USA and claimant identities, evidence and scopes must remain unchanged');
const fields=['source_revision','worker_version','build_fingerprint','source_dirty'];
const identity=value=>Object.fromEntries(fields.map(key=>[key,value?.[key]]));
assert.equal(review.enabled,true,'Explicit enabled review required, including for an explicitly proposed offline input');
assert.equal(plan.reviews.length,3,'Exactly the retained USA and claimant edges plus one rent continuation required');
assert.deepEqual(plan.reviews.map(edge=>edge.scope),['eight-legacy-plus-us-cpi','nine-desks-plus-claimants','nine-desks-plus-claimants-and-nz-rent']);
assert.equal(plan.includeUs,true);assert.equal(plan.includeClaimants,true);assert.equal(plan.includeRent,true);
assert.deepEqual(identity(prior.approved_identity),identity(review.from),'Checkpoint must match original USA predecessor');
assert.deepEqual(identity(health),identity(plan.target),'Captured health must match exact final clean identity');
assert.equal(prior.sequence,5,'Proof is pinned to audited sequence 5; review any actual intervening run separately');
assert.equal(envelope.digest,'665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f');
assert.equal(envelope.previous_digest,'aba5cf8b893790843e6d92468cb6d09c67b286c90edc2f70443d8fcf977f68a0');
assert.equal(sha(checkpointText),'73c0614e23bb044dc4b95aea7fff9a84120a795005667db95863d561cd0cd955','Exact retained downloaded checkpoint bytes required');
assert.equal(sha(reportText),'4ffc99d952e162adf588342dfa62612a2dd11aac0c923434a6dd495dbfb2a807','Exact retained sequence-5 report required');
assert.equal(oldReport.id,prior.last_run_id);assert.equal(oldReport.finished_at,prior.last_complete_collection_at);
assert.equal(oldReport.producer.workflow_run,'39341442350');assert.equal(oldReport.scheduled,true);assert.equal(oldReport.complete,true);
assert.equal(Object.keys(oldReport.results).length,108);assert.equal(Object.keys(prior.sources).length,108);
assert.equal(Object.keys(prior.incidents).length,33);assert.equal(Object.keys(prior.repairs).length,36);
assert.ok(Array.isArray(prior.outbox));
assert.equal(prior.outbox.find(event=>event.id==='12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6')?.status,'pending');
assert.equal(prior.started_shadow_at,'2026-10-18T23:22:22.161Z');
const scopeStarts=['us_started_shadow_at','claimants_started_shadow_at','market_rent_started_shadow_at'];
for(const key of scopeStarts)assert.equal(prior[key],undefined);
for(const origin of ORIGINS)assert.deepEqual(identity(oldReport.identities[origin]),identity(prior.approved_identity));
const finishedAt=capturedAt||new Date().toISOString();
assert.ok(Number.isFinite(Date.parse(finishedAt)),'Actual capture/replay timestamp required');
assert.ok(Date.parse(finishedAt)>=Date.parse(prior.last_complete_collection_at),'Replay cannot precede checkpoint');
assert.ok(Date.parse(finishedAt)<=Date.now()+1000,'Future simulated clocks cannot create evidence');
const results={},observationVersions={};
for(let index=0;index<contracts.length;index++){
 const contract=contracts[index],body=JSON.parse(bodyTexts[index]);
 assert.equal(body.country,contract.country,`${contract.key}: exact country required`);
 assert.equal(body.sources?.[contract.source]?.status,'ok',`${contract.key}: healthy actual source required`);
 const fetched=Date.parse(body.sources[contract.source].fetched_at);
 assert.ok(Number.isFinite(fetched)&&fetched<=Date.parse(finishedAt),`${contract.key}: valid actual retrieval timestamp required`);
 const result=await inspectSource(body,contract);
 assert.equal(result.kind,'success',`${contract.key}: ${result.reason||'semantic contract failed'}`);
 assert.equal(result.observations.length,contract===RENT_CONTRACT?116:13,`${contract.key}: exact accepted coverage required`);
 assert.ok(/^[a-f0-9]{64}$/.test(result.version));
 assert.equal(approvedVersions[contract.key]?.version,result.version,`${contract.key}: exact independently approved observation version required`);
 assert.ok(typeof approvedVersions[contract.key].evidence==='string'&&approvedVersions[contract.key].evidence.trim(),`${contract.key}: retained evidence reference required`);
 if(contract.source==='claimant_count'){
  assert.equal(body[contract.data].metadata.latest_period,expectedClaimantLatest,'A different claimant release cannot certify this capture');
  assert.equal(body[contract.data].metadata.first_period,expectedClaimantFirst);
 }
 if(contract===RENT_CONTRACT){
  const native=body[contract.data];
  assert.equal(native.status,'ok');assert.equal(native.rows.length,29);
  assert.deepEqual(native.locations.map(location=>[location.id,location.row_count]).sort(),[['nz-auckland-avondale',13],['nz-wellington-kelburn',16]]);
  assert.ok(native.rows.every(row=>row.period==='2026-03-01/2026-08-31'),'Exact accepted six-month rent specimen required');
  assert.equal(new Set(result.observations.map(observation=>observation.id)).size,116);
  assert.equal(approvedVersions[contract.key].evidence,plan.reviews[2].evidence,'Rent approval and exact release review must cite the same retained acceptance record');
 }
 results[contract.key]=Object.fromEntries(ORIGINS.map(origin=>[origin,structuredClone(result)]));
 observationVersions[contract.key]=result.version;
}
const unchanged=JSON.stringify(prior);
const run=(suffix,scope,target,sourceResults)=>({
 id:`CONSTRUCTED-ONLY-rent-release-${suffix}-${finishedAt}`,
 finished_at:finishedAt,complete:true,scheduled:false,scope,
 requests:Array.from({length:24},()=>({constructed:true})),
 identities:Object.fromEntries(ORIGINS.map(origin=>[origin,structuredClone(target)])),
 results:sourceResults,probe_errors:[],
});
const finalRun=suffix=>run(suffix,plan.scope,plan.target,results);
const options={approvedRelease:review,approvedVersions};
const directRun=finalRun('direct'),direct=applyRun(prior,directRun,options);
const prefixes=[];
for(const count of [1,2]){
 const prefixReview={enabled:true,...structuredClone(plan.reviews[0]),...(count===2?{continuations:[structuredClone(plan.reviews[1])]}:{})};
 const prefixPlan=reviewedReleasePlan(prefixReview),label=count===1?'USA':'claimants';
 // Deliberately no source observations: this prefix is an algebraic case, not
 // evidence of an intermediate collection, publisher retrieval or scheduled run.
 const prefix=applyRun(prior,run(`hypothetical-${label}-prefix`,prefixPlan.scope,prefixPlan.target,{}),{approvedRelease:prefixReview});
 const suffix=applyRun(prefix,finalRun(`already-${label}-suffix`),options);
 prefixes.push({count,label,prefix,suffix});
}
function preserved(before,after){
 assert.deepEqual(after.incidents,before.incidents,'All 33 existing incidents remain unchanged');
 assert.deepEqual(after.repairs,before.repairs,'All 36 existing repairs remain unchanged');
 assert.deepEqual(after.outbox,before.outbox,'Delivery history and pending event remain unchanged');
 assert.equal(after.started_shadow_at,before.started_shadow_at);
 assert.equal(after.sequence,before.sequence+1,'One sequence increment per constructed input');
 assert.deepEqual(after.runs.slice(0,-1),before.runs,'Existing run history is preserved');
 assert.equal(after.runs.at(-1).scheduled,false);
 assert.deepEqual(after.policy,{...before.policy,max_public_requests_per_collection:24});
 for(const key of scopeStarts)assert.equal(after[key],undefined,'No constructed scheduled acceptance');
 for(const [key,value]of Object.entries(prior.sources))assert.deepEqual(after.sources[key],value,`${key}: prior source state and observation versions unchanged`);
}
preserved(prior,direct);
for(const {prefix,suffix}of prefixes){preserved(prior,prefix);preserved(prefix,suffix);}
for(const next of [direct,...prefixes.map(item=>item.suffix)]){
 assert.deepEqual(identity(next.approved_identity),identity(plan.target));
 assert.equal(next.runs.at(-1).scope,plan.scope);
 assert.equal(Object.keys(next.sources).length,115);
 for(const contract of contracts){
  assert.equal(next.sources[contract.key].last_independently_verified.version,observationVersions[contract.key]);
  assert.equal(next.sources[contract.key].pending_verification,undefined);
 }
 assert.equal(next.market_rent_scope_first_complete_at,finishedAt);
}
const directAudit=direct.release_reviews.at(-1);
assert.equal(direct.release_reviews.length,(prior.release_reviews?.length||0)+1);
assert.deepEqual(direct.release_reviews.slice(0,-1),prior.release_reviews||[]);
assert.deepEqual(directAudit.reviewed_chain.map(edge=>edge.observed_in_collection),[false,false,true]);
assert.deepEqual(applyRun(direct,directRun,options),direct,'Same constructed run ID must be idempotent');
for(const {count,prefix,suffix}of prefixes){
 const audit=suffix.release_reviews.at(-1);
 assert.equal(suffix.release_reviews.length,prefix.release_reviews.length+1);
 assert.deepEqual(suffix.release_reviews.slice(0,-1),prefix.release_reviews);
 assert.deepEqual(audit.reviewed_chain.map(edge=>edge.observed_in_collection),count===1?[false,true]:[true]);
 assert.equal(suffix.us_scope_first_complete_at,prefix.us_scope_first_complete_at);
 if(count===2)assert.equal(suffix.claimants_scope_first_complete_at,prefix.claimants_scope_first_complete_at);
}
assert.equal(JSON.stringify(prior),unchanged,'Input checkpoint object must not mutate');
for(let index=0;index<inputPaths.length;index++)assert.equal(await readFile(inputPaths[index],'utf8'),texts[index],'All input files must remain unchanged');
const evidence={
 checked_at:new Date().toISOString(),constructed:true,run_scheduled:false,constructed_at:finishedAt,
 kind:'Constructed offline direct, already-USA and already-claimants suffix preservation proof; not real collection or scheduled evidence',
 time_basis:capturedAt?'Caller-supplied retained actual capture/replay time':'Actual local replay execution time',
 inputs:inputPaths.map((path,index)=>({path,sha256:sha(texts[index])})),
 prior_digest:envelope.digest,prior_sequence:prior.sequence,prior_run:oldReport.producer.workflow_run,
 final_identity:identity(plan.target),captured_health_identity:identity(health),observation_versions:observationVersions,
 direct:{constructed_next_sequence:direct.sequence,constructed_runs_added:1,release_audit:directAudit},
 hypothetical_prefixes:prefixes.map(({label,prefix,suffix})=>({label,constructed_prefix_sequence:prefix.sequence,constructed_final_sequence:suffix.sequence,constructed_runs_added:2,prefix_is_hypothetical:true,release_audit:suffix.release_reviews.at(-1),prefix_history_preserved:true})),
 incident_count:33,repair_count:36,incidents_equal:true,all_repairs_equal:true,outbox_equal:true,prior_history_equal:true,
 prior_108_source_states_equal:true,exact_approved_new_source_count:7,rent_rows:29,rent_published_cells:116,
 claimant_window:{first_period:expectedClaimantFirst,latest_period:expectedClaimantLatest,periods_per_desk:13},
 original_shadow_start:prior.started_shadow_at,original_shadow_start_unchanged:true,
 USA_scheduled_start_absent:true,claimants_scheduled_start_absent:true,rent_scheduled_start_absent:true,
 actual_checkpoint_sequence_unchanged:5,actual_scheduled_cycles_added:0,
 checkpoint_written:false,notification_delivered:false,remote_calls:0,pass:true,
 limitations:[
  'Both-domain identities/results and required-request placeholders are constructed from supplied captures; this proof does not perform independent network observations or all 115 live probes.',
  'Hypothetical prefixes contain no publisher observations and establish only exact suffix application, not real intermediate checkpoints or scheduled cycles.',
  'Exact observation approvals must be independently supported by retained publisher reconciliation and actual release acceptance; this tool does not create approvals.',
  'Original 108 source states are deliberately not re-collected, so this isolates preservation from normal source changes or recoveries.',
  'No constructed checkpoint is saved. The next normal serialized collector must perform the real transition; any actual intervening run needs separate lineage verification.'
 ],
};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,pass:true,constructed:true,prior_sequence:5,incident_count:33,repair_count:36,rent_published_cells:116,actual_scheduled_cycles_added:0,checkpoint_written:false}));
