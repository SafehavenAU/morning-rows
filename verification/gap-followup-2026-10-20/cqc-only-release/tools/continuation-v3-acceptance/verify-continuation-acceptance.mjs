// Offline guard for the exact two-predecessor staged continuation; no generic resume.
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const CHAIN_MANIFEST='45b80fa3c7241858589c7e944e974117ee9f9750e8d336bc880920d63ecb8f1d';
const ORIGINALS=[
 {label:'v1',root:'/tmp/mr-cqc-r2-staged-r1',summary:'f7949781f726a243dd1cc69218d7659fda537bfdd9746c2b8c0a52c302999202',failed:'claimant-www-cold-cpu',cpu:'staged-claimant-cpu.json',count:6},
 {label:'v2',root:'/tmp/mr-cqc-r2-staged-continuation-v2',summary:'ed8523fea451170768886c9d7a121dc98eb90302a1adb114cc0d181b664366b5',failed:'rent-www-cold-cpu',cpu:'staged-rent-cpu.json',count:7},
];
const KIND='cqc-r2-rent-readiness-continuation-v3';
const PREFIX=['local-preflight','active-contract-scope','usa-cold-cpu','legacy-cold-cpu','added-source-fresh-cpu','claimant-www-cold-cpu'];
const COPIED=[...PREFIX.slice(0,5).map(x=>'logs/'+x+'.log'),'staged-us-cpu.json','staged-legacy-cpu.json','staged-added-source-cpu.json','logs/claimant-www-cold-cpu.log','staged-claimant-cpu.json'];
export async function verifyContinuationForAcceptance({directory,repo,bundleDir,toolManifest,summary,cfg,bytes,load,instant,rel}) {
 assert.equal(cfg.reviewed_continuation_revision,3);
 for(const file of ['continuation.mjs','chain-manifest.json','step-plan.json','verify-rent-source-cpu-startup.mjs','rent-harness-derivation.json'])assert.equal(toolManifest.files.filter(x=>x.file===file).length,1,'Exact v3 bundle member required: '+file);
 const chainRaw=await bytes(join(bundleDir,'chain-manifest.json'));assert.equal(sha(chainRaw),CHAIN_MANIFEST);
 const derivation=await load(join(bundleDir,'rent-harness-derivation.json')),derivationRaw=await bytes(join(bundleDir,'rent-harness-derivation.json'));
 assert.equal(derivation.original.file,join(repo,'scripts/verify-rent-source-cpu.mjs'));assert.equal(derivation.derivative.file,'verify-rent-source-cpu-startup.mjs');
 assert.equal(derivation.startup_wait_ms,20000);assert.equal(derivation.cpu_limit_ms,500);assert.equal(derivation.health_correlation_deadline_ms,10000);assert.equal(derivation.candidate_health_requests,1);assert.equal(derivation.retries,0);assert.equal(derivation.cause_proven,false);
 const expectedReplacements=[
  {original:"from './lib/us-cpu-evidence.mjs'",derivative:"from '"+join(repo,'scripts/lib/us-cpu-evidence.mjs')+"'"},
  {original:"from '../lib/nz-market-rent.js'",derivative:"from '"+join(repo,'lib/nz-market-rent.js')+"'"},
  {original:"const repo=fileURLToPath(new URL('..',import.meta.url));",derivative:"const repo='"+repo+"';"},
  {original:'expected_source_revision:expectedRevision,cpu_limit_ms:budget,approved_identity:approved,checks:[],events:[],',derivative:'expected_source_revision:expectedRevision,cpu_limit_ms:budget,startup_wait_ms:20000,approved_identity:approved,checks:[],events:[],'},
  {original:'await pause(4000);',derivative:'await pause(20000);'},
 ];
 assert.deepEqual(derivation.exact_replacements,expectedReplacements);
 const originalHarness=await bytes(derivation.original.file),derivativeHarness=await bytes(join(bundleDir,derivation.derivative.file));
 assert.equal(originalHarness.length,derivation.original.bytes);assert.equal(sha(originalHarness),derivation.original.sha256);assert.equal(derivativeHarness.length,derivation.derivative.bytes);assert.equal(sha(derivativeHarness),derivation.derivative.sha256);
 let normalizedHarness=derivativeHarness.toString('utf8');for(const x of [...expectedReplacements].reverse()){assert.equal(normalizedHarness.split(x.derivative).length,2);normalizedHarness=normalizedHarness.replace(x.derivative,x.original);}assert.deepEqual(Buffer.from(normalizedHarness),originalHarness,'Only reviewed startup wait, metadata and external import relocation may change');
 const continuation=await load(join(directory,'continuation.json')),raw=await bytes(join(directory,'continuation.json'));
 assert.equal(continuation.kind,KIND);assert.equal(continuation.pass,true);assert.equal(continuation.prefix_count,6);assert.equal(continuation.required_fresh_suffix_count,27);assert.equal(continuation.original_attempt_pass,false);assert.equal(continuation.uninterrupted,false);assert.equal(continuation.chain_manifest_sha256,CHAIN_MANIFEST);assert.equal(continuation.revision,cfg.source_revision);assert.equal(continuation.version,cfg.version);
 assert.deepEqual(continuation.original_attempts,ORIGINALS.map(x=>({label:x.label,root:x.root,summary_sha256:x.summary,pass:false,failed_gate:x.failed})));
 const prepared=instant(continuation.prepared_at);const originalResults=[];
 for(const original of ORIGINALS){
  const copiedRoot=join(directory,'prior-failed-attempt-'+original.label),rawSummary=await bytes(join(copiedRoot,'summary.json'));
  assert.equal(sha(rawSummary),original.summary);assert.equal(sha(await bytes(join(original.root,'summary.json'))),original.summary);
  const s=JSON.parse(rawSummary);originalResults.push(s);assert.equal(s.pass,false);assert.equal(s.phase,'staged');assert.equal(s.revision,cfg.source_revision);assert.equal(s.version,cfg.version);assert.equal(s.last_step,original.failed);assert.equal(s.steps.length,original.count);
  assert.ok(s.steps.slice(0,-1).every(x=>x.pass===true&&x.exit_code===0));assert.equal(s.steps.at(-1).pass,false);assert.equal(s.steps.at(-1).exit_code,1);
  for(const x of s.files){
   const copied=await bytes(join(copiedRoot,rel(x.file))),old=await bytes(join(original.root,rel(x.file)));
   assert.equal(copied.length,x.bytes);assert.equal(sha(copied),x.sha256);assert.equal(old.length,x.bytes);assert.equal(sha(old),x.sha256,'Prior actual failed attempt changed');
  }
  const failed=await load(join(copiedRoot,original.cpu));assert.equal(failed.error,'tail_not_ready');assert.equal(failed.budget_pass,false);assert.deepEqual(failed.events,[]);assert.equal(failed.checks.length,5);assert.ok(failed.checks.every(x=>x.path==='/health.json'));assert.equal(failed.checks.filter(x=>x.override===true).length,1);
 }
 assert.equal(continuation.predecessor_failure_finished_at,originalResults[1].finished_at);assert.ok(prepared>=instant(originalResults[1].finished_at));assert.ok(instant(originalResults[1].finished_at)>=instant(originalResults[0].finished_at));
 assert.deepEqual(continuation.copied_prefix_files.map(x=>x.file).toSorted(),COPIED.toSorted());
 for(const x of continuation.copied_prefix_files){
  assert.equal(x.source_attempt,['logs/claimant-www-cold-cpu.log','staged-claimant-cpu.json'].includes(x.file)?'v2':'v1');assert.equal(x.source_file,x.file);const origin=ORIGINALS.find(o=>o.label===x.source_attempt);assert.ok(origin);
  const copied=await bytes(join(directory,rel(x.file))),old=await bytes(join(origin.root,rel(x.source_file)));assert.equal(copied.length,x.bytes);assert.equal(sha(copied),x.sha256);assert.equal(old.length,x.bytes);assert.equal(sha(old),x.sha256);
 }
 assert.equal(continuation.v3_preflight_files.length,2);
 for(const x of continuation.v3_preflight_files){const b=await bytes(join(directory,rel(x.file)));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);}
 for(const file of ['logs/local-preflight.log','logs/continuation-v3-preflight.log']){
  const pre=await load(join(directory,file));assert.equal(pre.pass,true);assert.ok(Array.isArray(pre.inputs)&&pre.inputs.length);
  for(const x of pre.inputs){const b=await bytes(join(repo,rel(x.file)));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);}
 }
 const {verifyContinuation}=await import(pathToFileURL(join(bundleDir,'continuation.mjs')));
 const recomputed=await verifyContinuation(directory,repo,{revision:cfg.source_revision,version:cfg.version,state:'complete',requireSummary:true});
 const stored=await load(join(directory,'continuation-verification.json'));assert.deepEqual(stored,recomputed);
 assert.equal(recomputed.kind,KIND);assert.equal(recomputed.pass,true);assert.equal(recomputed.logical_gate_count,33);assert.equal(recomputed.imported_gate_count,6);assert.equal(recomputed.fresh_gate_count,27);assert.equal(recomputed.actual_attempt_count,3);assert.equal(recomputed.previous_failed_gate_attempts,2);assert.deepEqual(recomputed.original_summary_sha256s,ORIGINALS.map(x=>x.summary));assert.equal(recomputed.chain_manifest_sha256,CHAIN_MANIFEST);assert.equal(recomputed.continuation_sha256,sha(raw));
 assert.equal(summary.uninterrupted,false);assert.equal(summary.original_attempt_pass,false);assert.equal(summary.imported_gate_count,6);assert.equal(summary.fresh_gate_count,27);assert.deepEqual(summary.continuation,continuation);
 const rent=await load(join(directory,'staged-rent-cpu.json'));assert.equal(rent.startup_wait_ms,20000,'Only separately reviewed startup-wait derivative is allowed');assert.ok(instant(rent.started_at)>=prepared);
 let freshRequests=0;
 for(const item of summary.files){
  if(!item.file.endsWith('.json')||item.file.startsWith('prior-failed-attempt-')||COPIED.includes(item.file)||['continuation.json','continuation-verification.json'].includes(item.file))continue;
  const doc=await load(join(directory,rel(item.file)));
  const requests=Array.isArray(doc.requests)?doc.requests:[];
  const checks=Array.isArray(doc.checks)?doc.checks.filter(x=>Object.hasOwn(x,'override')):[];
  for(const r of [...requests,...checks]){assert.ok(r&&typeof r==='object');const start=instant(r.started_at),end=instant(r.completed_at??r.at);assert.ok(start>=prepared&&start<=end,'Fresh suffix HTTP request predates v3 preparation: '+item.file);freshRequests++;}
 }
 assert.ok(freshRequests>0,'Fresh suffix request chronology absent');
 return {kind:KIND,verified:true,imported_prefix_steps:6,fresh_suffix_steps:27,logical_gate_count:33,actual_attempt_count:3,original_attempt_pass:false,prior_continuation_pass:false,original_failure:'tail_not_ready',prior_continuation_failure:'tail_not_ready',original_summary_sha256s:ORIGINALS.map(x=>x.summary),chain_manifest_sha256:CHAIN_MANIFEST,continuation_sha256:sha(raw),continuation_verification_sha256:sha(await bytes(join(directory,'continuation-verification.json'))),prepared_at:continuation.prepared_at,fresh_request_chronology_checks:freshRequests,rent_startup_wait_ms:20000,rent_harness_derivation_sha256:sha(derivationRaw),uninterrupted:false};
}
