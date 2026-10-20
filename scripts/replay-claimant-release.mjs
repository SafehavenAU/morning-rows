// Constructed offline preservation proof, never a real collection/checkpoint.
// Usage: node scripts/replay-claimant-release.mjs CHECKPOINT REVIEW CAPTURE_DIRECTORY NEW_OUTPUT [CAPTURED_AT_ISO]
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {applyRun,reviewedReleasePlan} from '../lib/monitor-state.js';
import {US_CONTRACT,CLAIMANT_CONTRACTS,ORIGINS,inspectSource} from '../lib/monitor-contracts.js';

const [checkpointPath,reviewPath,captureDirectory,outputPath,capturedAt]=process.argv.slice(2);
assert.ok(process.argv.length===6||process.argv.length===7,'Expected CHECKPOINT REVIEW CAPTURE_DIRECTORY NEW_OUTPUT [CAPTURED_AT_ISO]');
assert.ok(checkpointPath&&reviewPath&&captureDirectory&&outputPath,'Four paths required');
const contracts=[US_CONTRACT,...CLAIMANT_CONTRACTS];
const directory=await realpath(captureDirectory);
const requestedInputs=[checkpointPath,reviewPath,join(directory,'_health.json.response'),...contracts.map(c=>join(directory,`_${c.desk}.json.response`))];
const inputPaths=await Promise.all(requestedInputs.map(path=>realpath(path)));
const output=resolve(outputPath);
assert.ok(!inputPaths.includes(output),'Output cannot replace an input');
let existing;try{existing=await realpath(output);}catch(error){if(error.code!=='ENOENT')throw error;}
assert.ok(!existing,'Output must be a new evidence file; never overwrite existing evidence');
const texts=await Promise.all(inputPaths.map(path=>readFile(path,'utf8')));
const [checkpointText,reviewText,healthText,...bodyTexts]=texts;
const envelope=decodeCheckpoint(checkpointText),prior=envelope.state;
const review=JSON.parse(reviewText),plan=reviewedReleasePlan(review),health=JSON.parse(healthText);
const keys=['source_revision','worker_version','build_fingerprint','source_dirty'];
const identity=value=>Object.fromEntries(keys.map(key=>[key,value?.[key]]));
assert.equal(review.enabled,true,'Explicit enabled review required');
assert.equal(plan.reviews.length,2,'Retained USA review plus exactly one claimant continuation required');
assert.equal(plan.includeClaimants,true);
assert.deepEqual(identity(prior.approved_identity),identity(review.from),'Retained checkpoint must match the original USA review predecessor');
assert.deepEqual(identity(health),identity(plan.target),'Captured health must identify the exact final clean release');
assert.equal(prior.sequence,5,'This proof is pinned to the audited sequence 5 predecessor');
assert.equal(envelope.digest,'665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f');
assert.equal(Object.keys(prior.incidents).length,33);
assert.equal(Object.keys(prior.repairs).length,36);
assert.ok(Array.isArray(prior.outbox));
assert.equal(prior.outbox.find(event=>event.id==='12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6')?.status,'pending');
assert.equal(prior.started_shadow_at,'2026-10-18T23:22:22.161Z');
assert.equal(prior.us_started_shadow_at,undefined);
assert.equal(prior.claimants_started_shadow_at,undefined);

const finishedAt=capturedAt||new Date().toISOString();
assert.ok(Number.isFinite(Date.parse(finishedAt)),'Valid actual capture/replay timestamp required');
assert.ok(Date.parse(finishedAt)>=Date.parse(prior.last_complete_collection_at),'Replay cannot precede its checkpoint');
assert.ok(Date.parse(finishedAt)<=Date.now()+1000,'Future simulated clocks cannot create evidence');
const results={},approvedVersions={},observationVersions={};
for(let index=0;index<contracts.length;index++){
 const contract=contracts[index],body=JSON.parse(bodyTexts[index]);
 assert.equal(body.country,contract.country,`${contract.key}: exact desk country required`);
 const fetched=Date.parse(body.sources?.[contract.source]?.fetched_at);
 assert.equal(body.sources?.[contract.source]?.status,'ok',`${contract.key}: healthy actual source required`);
 assert.ok(Number.isFinite(fetched)&&fetched<=Date.parse(finishedAt),`${contract.key}: source retrieval must not follow the replay timestamp`);
 const result=await inspectSource(body,contract);
 assert.equal(result.kind,'success',`${contract.key}: ${result.reason||'semantic contract failed'}`);
 assert.equal(result.observations.length,13,`${contract.key}: exact 13-period coverage required`);
 assert.ok(typeof result.version==='string'&&result.version.length===64);
 results[contract.key]=Object.fromEntries(ORIGINS.map(origin=>[origin,structuredClone(result)]));
 approvedVersions[contract.key]={version:result.version,evidence:plan.reviews.at(-1).evidence};
 observationVersions[contract.key]=result.version;
}
const unchanged=JSON.stringify(prior);
const run=(suffix,scope,target,sourceResults)=>({
 id:`CONSTRUCTED-ONLY-claimant-release-${suffix}-${finishedAt}`,
 finished_at:finishedAt,complete:true,scheduled:false,scope,
 requests:Array.from({length:24},()=>({constructed:true})),
 identities:Object.fromEntries(ORIGINS.map(origin=>[origin,structuredClone(target)])),
 results:sourceResults,probe_errors:[],
});
const finalRun=suffix=>run(suffix,plan.scope,plan.target,results);
const options={approvedRelease:review,approvedVersions};
const direct=applyRun(prior,finalRun('direct'),options);
// This hypothetical prefix carries no source observations. It proves that an
// already-applied USA identity review is not applied again; it is not evidence
// that an intermediate USA collection, observation or scheduled cycle occurred.
const prefixReview={enabled:true,...structuredClone(plan.reviews[0])};
const prefix=applyRun(prior,run('hypothetical-USA-prefix',prefixReview.scope,prefixReview.to,{}),{approvedRelease:prefixReview});
const suffix=applyRun(prefix,finalRun('already-USA-suffix'),options);
function preserved(before,after){
 assert.deepEqual(after.incidents,before.incidents,'Existing incidents must survive unchanged');
 assert.deepEqual(after.repairs,before.repairs,'All existing repairs must survive unchanged');
 assert.deepEqual(after.outbox,before.outbox,'Delivery history and pending event must survive unchanged');
 assert.equal(after.started_shadow_at,before.started_shadow_at);
 assert.equal(after.sequence,before.sequence+1,'Exactly one increment per constructed input run');
 assert.deepEqual(after.runs.slice(0,-1),before.runs,'Existing run history must remain byte-equivalent');
 assert.equal(after.runs.at(-1).scheduled,false);
 assert.deepEqual(after.policy,{...before.policy,max_public_requests_per_collection:24});
 assert.equal(after.us_started_shadow_at,undefined);
 assert.equal(after.claimants_started_shadow_at,undefined);
}
preserved(prior,direct);preserved(prior,prefix);preserved(prefix,suffix);
for(const next of [direct,suffix]){
 assert.deepEqual(identity(next.approved_identity),identity(plan.target));
 assert.equal(next.runs.at(-1).scope,'nine-desks-plus-claimants');
 for(const contract of contracts){
  assert.equal(next.sources[contract.key].last_independently_verified.version,observationVersions[contract.key]);
  assert.equal(next.sources[contract.key].pending_verification,undefined);
 }
}
const directAudit=direct.release_reviews.at(-1),suffixAudit=suffix.release_reviews.at(-1);
assert.equal(direct.release_reviews.length,(prior.release_reviews?.length||0)+1);
assert.equal(directAudit.reviewed_chain.length,2);
assert.deepEqual(directAudit.reviewed_chain.map(edge=>edge.observed_in_collection),[false,true]);
assert.equal(suffix.release_reviews.length,prefix.release_reviews.length+1);
assert.deepEqual(suffix.release_reviews.slice(0,-1),prefix.release_reviews);
assert.equal(suffixAudit.reviewed_chain.length,1);
assert.equal(suffixAudit.reviewed_chain[0].observed_in_collection,true);
assert.equal(suffix.us_scope_first_complete_at,prefix.us_scope_first_complete_at);
assert.equal(JSON.stringify(prior),unchanged,'Input checkpoint object must not be mutated');
assert.equal(await readFile(inputPaths[0],'utf8'),checkpointText,'Input checkpoint file must not be mutated');
const sha=value=>createHash('sha256').update(value).digest('hex');
const evidence={
 checked_at:new Date().toISOString(),constructed:true,run_scheduled:false,constructed_at:finishedAt,
 kind:'Constructed offline direct and already-USA-suffix preservation proof; not real collection or scheduled evidence',
 time_basis:capturedAt?'Caller-supplied retained actual capture/replay time':'Actual local replay execution time',
 inputs:inputPaths.map((path,index)=>({path,sha256:sha(texts[index])})),
 prior_digest:envelope.digest,prior_sequence:prior.sequence,
 final_identity:identity(plan.target),captured_health_identity:identity(health),
 observation_versions:observationVersions,
 direct:{constructed_next_sequence:direct.sequence,constructed_runs_added:1,release_audit:directAudit},
 already_USA:{constructed_prefix_sequence:prefix.sequence,constructed_final_sequence:suffix.sequence,constructed_runs_added:2,prefix_is_hypothetical:true,release_audit:suffixAudit,existing_USA_history_preserved:true},
 incident_count:33,repair_count:36,incidents_equal:true,all_repairs_equal:true,outbox_equal:true,prior_history_equal:true,
 original_shadow_start:prior.started_shadow_at,original_shadow_start_unchanged:true,
 USA_scheduled_start_absent:true,claimants_scheduled_start_absent:true,
 actual_checkpoint_sequence_unchanged:5,actual_scheduled_cycles_added:0,
 checkpoint_written:false,notification_delivered:false,remote_calls:0,pass:true,
 limitations:[
  'Both-domain identities/results and required-request placeholders are constructed from supplied captures, not independent network observations.',
  'The already-USA prefix is hypothetical and contains no publisher observations; it is not a real intermediate checkpoint or scheduled cycle.',
  'Exact observation approvals are constructed inputs supported only when the caller separately retains matched publisher reconciliation and actual release acceptance.',
  'No constructed checkpoint is saved. The next normal serialized collector must perform the real transition.'
 ],
};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,pass:true,constructed:true,prior_sequence:5,incident_count:33,repair_count:36,actual_scheduled_cycles_added:0,checkpoint_written:false}));
