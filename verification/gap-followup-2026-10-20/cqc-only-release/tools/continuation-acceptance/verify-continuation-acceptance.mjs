// Offline acceptance guard for one exact, separately reviewed staged continuation.
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const PREFIX_MANIFEST='5ff163fbd149ce45e5bc199ba52bbfbc92aec13318f9f3429912fefc97b98c56';
const ORIGINAL_SUMMARY='f7949781f726a243dd1cc69218d7659fda537bfdd9746c2b8c0a52c302999202';
const KIND='cqc-r2-tail-readiness-continuation-v2';
const PREFIX=['local-preflight','active-contract-scope','usa-cold-cpu','legacy-cold-cpu','added-source-fresh-cpu'];
const COPIED=[...PREFIX.map(x=>'logs/'+x+'.log'),'staged-us-cpu.json','staged-legacy-cpu.json','staged-added-source-cpu.json'];
export async function verifyContinuationForAcceptance({directory,repo,bundleDir,toolManifest,summary,cfg,bytes,load,instant,rel}) {
 assert.equal(cfg.reviewed_continuation_revision,2);
 for(const file of ['continuation.mjs','prefix-manifest.json','step-plan.json'])assert.equal(toolManifest.files.filter(x=>x.file===file).length,1,'Exact continuation bundle member required: '+file);
 const prefixRaw=await bytes(join(bundleDir,'prefix-manifest.json'));assert.equal(sha(prefixRaw),PREFIX_MANIFEST);const prefix=JSON.parse(prefixRaw);
 assert.equal(prefix.original_summary_sha256,ORIGINAL_SUMMARY);assert.equal(prefix.revision,cfg.source_revision);assert.equal(prefix.version,cfg.version);
 const continuation=await load(join(directory,'continuation.json')),raw=await bytes(join(directory,'continuation.json'));
 assert.equal(continuation.kind,KIND);assert.equal(continuation.pass,true);assert.equal(continuation.prefix_count,5);assert.equal(continuation.required_fresh_suffix_count,28);assert.equal(continuation.original_attempt_pass,false);assert.equal(continuation.uninterrupted,false);assert.equal(continuation.original_failed_gate_requested_claimant_desk,false);assert.equal(continuation.original_attempt_root,prefix.original_attempt_root);assert.equal(continuation.original_runner_sha256,prefix.original_runner_sha256);assert.equal(continuation.original_bundle_sha256,prefix.original_bundle_sha256);
 const prepared=instant(continuation.prepared_at);assert.ok(prepared>=instant(continuation.original_failure_finished_at));
 const original=await load(join(directory,'prior-failed-attempt','summary.json'));assert.equal(sha(await bytes(join(directory,'prior-failed-attempt','summary.json'))),ORIGINAL_SUMMARY);
 assert.equal(original.pass,false);assert.equal(original.last_step,'claimant-www-cold-cpu');assert.equal(original.steps.length,6);assert.deepEqual(original.steps.slice(0,5).map(x=>x.step),PREFIX);
 assert.ok(original.steps.slice(0,5).every(x=>x.pass===true&&x.exit_code===0));assert.equal(original.steps[5].pass,false);assert.equal(original.steps[5].exit_code,1);
 for(const x of prefix.files){
  const copied=await bytes(join(directory,'prior-failed-attempt',rel(x.file))),liveOriginal=await bytes(join(prefix.original_attempt_root,rel(x.file)));
  assert.equal(copied.length,x.bytes);assert.equal(sha(copied),x.sha256);assert.equal(liveOriginal.length,x.bytes);assert.equal(sha(liveOriginal),x.sha256,'Original incomplete attempt changed');
 }
 for(const x of continuation.copied_prefix_files){const b=await bytes(join(directory,rel(x.file)));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);}
 assert.deepEqual(continuation.copied_prefix_files.map(x=>x.file),COPIED);
 for(const x of continuation.v2_preflight_files){const b=await bytes(join(directory,rel(x.file)));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);}
 for(const file of ['logs/local-preflight.log','logs/continuation-v2-preflight.log']){
  const pre=await load(join(directory,file));assert.equal(pre.pass,true);assert.ok(Array.isArray(pre.inputs)&&pre.inputs.length);
  for(const x of pre.inputs){const b=await bytes(join(repo,rel(x.file)));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);}
 }
 const {verifyContinuation}=await import(pathToFileURL(join(bundleDir,'continuation.mjs')));
 const recomputed=await verifyContinuation(directory,repo,{revision:cfg.source_revision,version:cfg.version,state:'complete',requireSummary:true});
 const stored=await load(join(directory,'continuation-verification.json'));assert.deepEqual(stored,recomputed);
 assert.equal(recomputed.kind,KIND);assert.equal(recomputed.pass,true);assert.equal(recomputed.logical_gate_count,33);assert.equal(recomputed.imported_gate_count,5);assert.equal(recomputed.fresh_gate_count,28);assert.equal(recomputed.actual_attempt_count,2);assert.equal(recomputed.previous_failed_gate_attempts,1);assert.equal(recomputed.original_summary_sha256,ORIGINAL_SUMMARY);assert.equal(recomputed.prefix_manifest_sha256,PREFIX_MANIFEST);assert.equal(recomputed.continuation_sha256,sha(raw));
 assert.equal(summary.uninterrupted,false);assert.equal(summary.original_attempt_pass,false);assert.equal(summary.imported_gate_count,5);assert.equal(summary.fresh_gate_count,28);assert.deepEqual(summary.continuation,continuation);
 let freshRequests=0;
 for(const item of summary.files){
  if(!item.file.endsWith('.json')||item.file.startsWith('prior-failed-attempt/')||COPIED.includes(item.file)||['continuation.json','continuation-verification.json'].includes(item.file))continue;
  const doc=await load(join(directory,rel(item.file)));
  const requests=Array.isArray(doc.requests)?doc.requests:[];
  const checks=Array.isArray(doc.checks)?doc.checks.filter(x=>Object.hasOwn(x,'override')):[];
  for(const r of [...requests,...checks]){
   assert.ok(r&&typeof r==='object');const start=instant(r.started_at),end=instant(r.completed_at??r.at);
   assert.ok(start>=prepared&&start<=end,'Every fresh suffix request must follow continuation preparation: '+item.file);freshRequests++;
  }
 }
 assert.ok(freshRequests>0,'Fresh suffix request chronology was not observed');
 return {kind:KIND,verified:true,imported_prefix_steps:5,fresh_suffix_steps:28,logical_gate_count:33,actual_attempt_count:2,original_attempt_pass:false,original_failure:'tail_not_ready',original_summary_sha256:ORIGINAL_SUMMARY,prefix_manifest_sha256:PREFIX_MANIFEST,continuation_sha256:sha(raw),continuation_verification_sha256:sha(await bytes(join(directory,'continuation-verification.json'))),prepared_at:continuation.prepared_at,fresh_request_chronology_checks:freshRequests,uninterrupted:false};
}
