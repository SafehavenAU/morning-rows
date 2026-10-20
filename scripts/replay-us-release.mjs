// Offline, constructed preservation proof only. Never writes a checkpoint,
// acknowledges a notification, changes a schedule or makes a network request.
// Usage: node scripts/replay-us-release.mjs CHECKPOINT REVIEW US_BODY OUTPUT [CAPTURED_AT_ISO]
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {decodeCheckpoint} from '../lib/monitor-store.js';
import {applyRun} from '../lib/monitor-state.js';
import {US_CONTRACT,ORIGINS,inspectSource} from '../lib/monitor-contracts.js';

const [checkpointPath,reviewPath,bodyPath,outputPath,capturedAt]=process.argv.slice(2);
assert.ok(process.argv.length===6||process.argv.length===7,'Expected CHECKPOINT REVIEW US_BODY OUTPUT [CAPTURED_AT_ISO]');
assert.ok(checkpointPath&&reviewPath&&bodyPath&&outputPath,'Four file paths are required');
const inputs=await Promise.all([checkpointPath,reviewPath,bodyPath].map(path=>realpath(path)));
const output=resolve(outputPath);
assert.ok(!inputs.includes(output),'Output cannot replace any input');
let existingOutput;try{existingOutput=await realpath(output);}catch(error){if(error.code!=='ENOENT')throw error;}
assert.ok(!existingOutput,'Output must be a new evidence file; no existing file is overwritten');
const [checkpointText,reviewText,bodyText]=await Promise.all(inputs.map(path=>readFile(path,'utf8')));
const envelope=decodeCheckpoint(checkpointText),prior=envelope.state;
const review=JSON.parse(reviewText),body=JSON.parse(bodyText);
const identityFields=['source_revision','worker_version','build_fingerprint','source_dirty'];
const identity=value=>Object.fromEntries(identityFields.map(key=>[key,value?.[key]]));
assert.equal(review.enabled,true,'Review must explicitly enable the scoped transition');
assert.equal(review.scope,'eight-legacy-plus-us-cpi','Unexpected release scope');
assert.equal(typeof review.evidence,'string');assert.ok(review.evidence.trim(),'Exact release evidence reference required');
assert.deepEqual(identity(review.from),identity(prior.approved_identity),'Review from identity must match the decoded current checkpoint');
assert.equal(Object.keys(prior.incidents).length,33,'Current audited predecessor must retain 33 incidents');
assert.equal(Object.keys(prior.repairs).length,36,'Current audited predecessor must retain 36 repairs');
assert.ok(Array.isArray(prior.outbox),'Current outbox required');
assert.equal(prior.us_started_shadow_at,undefined,'USA scheduled observation must not already have started');
assert.ok(prior.started_shadow_at&&Number.isFinite(Date.parse(prior.started_shadow_at)),'Existing original SHADOW start required');
assert.equal(body.country,'United States','Expected actual full USA desk body');
assert.equal(body.sources?.cpi?.status,'ok','Actual captured USA source must be healthy');
const result=await inspectSource(body,US_CONTRACT);
assert.equal(result.kind,'success','Actual USA body must satisfy its monitoring contract');
assert.ok(typeof result.version==='string'&&result.version.length>0,'Exact verified observation version required');
const finishedAt=capturedAt||new Date().toISOString();
assert.ok(Number.isFinite(Date.parse(finishedAt)),'A valid actual capture/replay wall-clock time is required');
assert.ok(Date.parse(finishedAt)>=Date.parse(prior.last_complete_collection_at||prior.created_at),'Replay cannot precede its checkpoint');
assert.ok(Date.parse(finishedAt)<=Date.now()+1000,'Do not use a future simulated clock');
const sourceAttempt=Date.parse(body.sources.cpi.fetched_at);
assert.ok(Number.isFinite(sourceAttempt)&&sourceAttempt<=Date.parse(finishedAt),'Actual source retrieval must not be after the stated capture time');
const before=JSON.stringify(prior);
const run={
 id:'CONSTRUCTED-ONLY-paid-USA-preservation-'+finishedAt,
 scheduled:false,complete:true,scope:review.scope,finished_at:finishedAt,
 // These synthetic required-request placeholders do not establish a collection.
 requests:Array.from({length:24},()=>({constructed:true})),
 identities:Object.fromEntries(ORIGINS.map(origin=>[origin,structuredClone(review.to)])),
 results:{[US_CONTRACT.key]:Object.fromEntries(ORIGINS.map(origin=>[origin,structuredClone(result)]))},
};
const next=applyRun(prior,run,{
 approvedRelease:review,
 approvedVersions:{[US_CONTRACT.key]:{version:result.version,evidence:review.evidence}},
});
assert.equal(JSON.stringify(prior),before,'Input checkpoint state must not be mutated');
assert.deepEqual(next.incidents,prior.incidents,'All incidents must remain unchanged');
assert.deepEqual(next.repairs,prior.repairs,'All 36 existing repairs must remain unchanged');
assert.deepEqual(next.outbox,prior.outbox,'Pending and delivered notification state must remain unchanged');
assert.equal(next.started_shadow_at,prior.started_shadow_at,'Original SHADOW start must survive');
assert.equal(next.us_started_shadow_at,undefined,'Constructed nonscheduled proof cannot start USA scheduled observation');
assert.equal(next.sequence,prior.sequence+1,'Exactly one constructed sequence increment');
assert.deepEqual(identity(next.approved_identity),identity(review.to),'New exact reviewed release identity required');
assert.equal(next.us_scope_first_complete_at,finishedAt);
assert.equal(next.policy.max_public_requests_per_collection,24);
const expectedPolicy={...prior.policy,max_public_requests_per_collection:24};
assert.deepEqual(next.policy,expectedPolicy,'Only the reviewed public-request budget may change');
assert.equal(next.release_reviews.length,(prior.release_reviews||[]).length+1);
assert.equal(next.sources[US_CONTRACT.key].last_independently_verified.version,result.version);
assert.equal(next.sources[US_CONTRACT.key].pending_verification,undefined);
assert.deepEqual(next.runs.slice(0,-1),prior.runs,'Existing scheduled/manual run history must survive');
assert.equal(next.runs.at(-1).scheduled,false);
assert.equal(await readFile(inputs[0],'utf8'),checkpointText,'Checkpoint file must remain byte-identical');
const sha=text=>createHash('sha256').update(text).digest('hex');
const evidence={
 checked_at:new Date().toISOString(),kind:'Constructed offline transition using caller-supplied verified USA body; not a real collection or scheduled proof',
 constructed:true,run_scheduled:false,constructed_at:finishedAt,
 time_basis:capturedAt?'Caller-supplied actual capture timestamp':'Actual local replay execution time',
 input_sha256:{checkpoint:sha(checkpointText),release_review:sha(reviewText),us_body:sha(bodyText)},
 prior_digest:envelope.digest,prior_sequence:prior.sequence,constructed_next_sequence:next.sequence,
 from_identity:identity(prior.approved_identity),to_identity:identity(next.approved_identity),
 release_evidence:review.evidence,us_observation_version:result.version,
 incident_count:Object.keys(prior.incidents).length,repair_count:Object.keys(prior.repairs).length,
 incidents_equal:true,all_repairs_equal:true,outbox_equal:true,prior_history_equal:true,
 original_shadow_start:prior.started_shadow_at,original_shadow_start_unchanged:true,
 us_scheduled_start_absent:true,exact_reviewed_identity_applied:true,
 policy_change:{max_public_requests_per_collection:{from:prior.policy.max_public_requests_per_collection,to:24}},
 checkpoint_written:false,notification_delivered:false,remote_calls:0,pass:true,
 limitations:[
  'Both-domain identities and 24 request placeholders are constructed inputs, not actual network evidence.',
  'The caller must separately retain real release acceptance and independent publisher reconciliation for this exact body/version.',
  'No constructed next checkpoint is saved; the real transition belongs to the existing serialized collector.'
 ]
};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,pass:true,constructed:true,prior_sequence:prior.sequence,incident_count:33,repair_count:36,us_scheduled_start_absent:true,checkpoint_written:false}));
