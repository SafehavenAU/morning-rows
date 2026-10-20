// Prepare revised six-contract monitor metadata outside the repository only.
// No HTTP, deployment, checkpoint, repository write or collector dispatch.
// Usage: node /tmp/mr-prepare-gap-monitor-held.mjs REPO CONFIG_JSON NEW_PLAN_DIR
// CONFIG: production_root, staged_root, deployment_file, deployment_id,
// promoted_at, accepted_at, target {source_revision,source_dirty:false,
// build_fingerprint,worker_version}. Populate only after root accepts all gates.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,stat} from 'node:fs/promises';
import {resolve,join,dirname,basename,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const [repoArg,configArg,outArg,...extra]=process.argv.slice(2);
assert.ok(repoArg&&configArg&&outArg&&!extra.length,'REPO CONFIG_JSON NEW_PLAN_DIR required');
const repo=await realpath(repoArg),configPath=await realpath(configArg),configBytes=await readFile(configPath),config=JSON.parse(configBytes);
const out=join(await realpath(dirname(resolve(outArg))),basename(outArg));
assert.ok(out!==repo&&!out.startsWith(repo+'/'),'Output must remain outside repository, including symlink parents');
try{await stat(out);assert.fail('Output directory must not already exist');}catch(error){if(error.code!=='ENOENT')throw error;}
const {target,accepted_at:acceptedAt,promoted_at:promotedAt,deployment_id:deploymentId}=config;
assert.deepEqual(Object.keys(target||{}).sort(),['build_fingerprint','source_dirty','source_revision','worker_version']);
assert.match(target.source_revision,/^[a-f0-9]{40}$/);assert.match(target.build_fingerprint,/^[a-f0-9]{16}$/);assert.equal(target.source_dirty,false);
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;assert.match(target.worker_version,uuid);assert.match(deploymentId,uuid);
for(const value of [acceptedAt,promotedAt])assert.ok(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|\+00:00)$/.test(value)&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+1000,'Actual UTC acceptance/deployment clocks required');
assert.ok(Date.parse(acceptedAt)>=Date.parse(promotedAt));
assert.notEqual(target.worker_version,'3eae0d8f-e4ad-4c31-97f2-6b98845e3ba9','Rolled-back AEMO candidate cannot be approved');
assert.notEqual(target.source_revision,'ba0812b493f7cc4ca47a9f726211d96903bd9597','Rolled-back AEMO source cannot be approved');
const production=await realpath(config.production_root),staged=await realpath(config.staged_root);
const {DAILY_HISTORY_CONTRACTS,ORIGINS,inspectSource}=await import(pathToFileURL(join(repo,'lib/monitor-contracts.js')));
const {decodeCheckpoint}=await import(pathToFileURL(join(repo,'lib/monitor-store.js')));
const {reviewedReleasePlan}=await import(pathToFileURL(join(repo,'lib/monitor-state.js')));
const {buildMonitorRegistry}=await import(pathToFileURL(join(repo,'scripts/monitor-registry.mjs')));
const {verifyCapture}=await import(pathToFileURL(join(repo,'verification/gap-pass-2026-10-20/interface-checker/support.mjs')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inputs=new Map([[configPath,configBytes]]);
async function raw(path){const actual=await realpath(path),bytes=await readFile(actual);if(inputs.has(actual))assert.equal(sha(bytes),sha(inputs.get(actual)),'Input changed during preparation');inputs.set(actual,bytes);return bytes;}
async function load(path){return JSON.parse(await raw(path));}
async function pinned(path,digest){const bytes=await raw(path);assert.equal(sha(bytes),digest,'Exact retained predecessor required');return JSON.parse(bytes);}
function inside(base,name){assert.ok(typeof name==='string'&&!isAbsolute(name)&&!name.split('/').includes('..'),'Safe relative evidence path required');return join(base,name);}

const paths=['operations/us-release-review.json','operations/approved-observations.json','operations/acceptance.json','verification/monitoring-baseline.json','operations/source-contract-registry.json'];
const [oldReview,oldApprovals,oldAcceptance,oldBaseline,oldRegistry]=await Promise.all(paths.map(p=>load(join(repo,p))));
const fields=Object.keys(target),identity=x=>Object.fromEntries(fields.map(k=>[k,x[k]]));
const evidence='verification/gap-pass-2026-10-20/README.md',scope='nine-desks-plus-claimants-rent-and-daily-history';
const productionEvidence='verification/gap-pass-2026-10-20/release-validation/production';
const checkpointPath=join(repo,'verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json'),oldReportPath=join(repo,'verification/us-paid-2026-10-20/checkpoint-predecessor/report.json');
const priorReviewPath=join(repo,'verification/gap-pass-2026-10-20/monitoring/prior-review.json'),priorApprovalsPath=join(repo,'verification/gap-pass-2026-10-20/monitoring/prior-approvals.json');
await pinned(checkpointPath,'73c0614e23bb044dc4b95aea7fff9a84120a795005667db95863d561cd0cd955');
const checkpoint=decodeCheckpoint((await raw(checkpointPath)).toString('utf8'));
const oldReport=await pinned(oldReportPath,'4ffc99d952e162adf588342dfa62612a2dd11aac0c923434a6dd495dbfb2a807');
assert.deepEqual(oldReview,await pinned(priorReviewPath,'0f46582582547ce76134a48e47ce10637f416287814196b65b34917400bda2e6'));
assert.deepEqual(oldApprovals,await pinned(priorApprovalsPath,'c2e444008d9943c253383a6bdbacd9035de59a53174782e967ecc70411cd2396'));
assert.equal(checkpoint.state.sequence,5);assert.equal(checkpoint.digest,'665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f');
assert.equal(checkpoint.previous_digest,'aba5cf8b893790843e6d92468cb6d09c67b286c90edc2f70443d8fcf977f68a0');
assert.equal(oldReport.id,checkpoint.state.last_run_id);assert.equal(oldReport.finished_at,'2026-10-19T23:26:10.163Z');assert.equal(oldReport.producer.workflow_run,'39341442350');assert.equal(oldReport.scheduled,true);assert.equal(oldReport.complete,true);
assert.equal(Object.keys(checkpoint.state.incidents).length,33);assert.equal(Object.keys(checkpoint.state.repairs).length,36);assert.equal(checkpoint.state.outbox.find(e=>e.id==='12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6')?.status,'pending');
assert.equal(checkpoint.state.started_shadow_at,'2026-10-18T23:22:22.161Z');
const expectedKeys=['canada/exchange_history','canada/homes','canada/jobs','canada/price_index','canada/shop','wales/land_transaction_tax'];
assert.deepEqual(DAILY_HISTORY_CONTRACTS.map(c=>c.key).sort(),expectedKeys);
const deployments=await load(config.deployment_file);assert.ok(Array.isArray(deployments)&&deployments.length);
const deployment=deployments.reduce((a,b)=>Date.parse(a.created_on)>=Date.parse(b.created_on)?a:b);
assert.equal(deployment.id,deploymentId);assert.equal(deployment.created_on,promotedAt);
assert.deepEqual(deployment.versions.filter(v=>v.percentage>0),[{version_id:target.worker_version,percentage:100}],'Latest actual deployment must assign sole traffic to exact candidate');
const priorPlan=reviewedReleasePlan(oldReview);assert.equal(priorPlan.reviews.length,4);assert.equal(Object.keys(oldApprovals).length,15);assert.equal(oldRegistry.sources.length,115);
assert.deepEqual(identity(oldBaseline.identity),priorPlan.target);
assert.equal(oldBaseline.checkpoint_watch.sequence,5);assert.equal(oldBaseline.checkpoint_watch.last_verified_digest,'665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f');
assert.equal(oldBaseline.checkpoint_watch.incident_count,33);assert.equal(oldBaseline.checkpoint_watch.pending_repair_count,36);assert.equal(oldBaseline.checkpoint_watch.delivery_test_acknowledged,false);
const stageSummary=await load(join(staged,'summary.json'));
assert.equal(stageSummary.pass,true);assert.equal(stageSummary.phase,'staged');assert.equal(stageSummary.revision,target.source_revision);assert.equal(stageSummary.version,target.worker_version);assert.ok(Date.parse(stageSummary.finished_at)<=Date.parse(promotedAt));
const summary=await load(join(production,'summary.json'));assert.equal(summary.pass,true);assert.equal(summary.phase,'production');assert.equal(summary.revision,target.source_revision);assert.equal(summary.version,target.worker_version);assert.equal(summary.exit_code,0);assert.equal(summary.last_step,'complete');assert.ok(Date.parse(summary.finished_at)<=Date.parse(acceptedAt));
const requiredSteps=['exact-staged-prerequisite','core-capture','core-offline-derivation-schema-us','core-semantics-apex','statsnz-independent-apex','core-semantics-www','statsnz-independent-www','core-production-reference-health','gdp-capture','gdp-offline','claimant-capture','claimant-independent','claimant-schemas','rent-capture','rent-offline','gap-capture','gap-independent','gap-schemas'];
assert.deepEqual(summary.steps.map(step=>step.step),requiredSteps,'Every current production gate must be recorded in order');
assert.ok(summary.steps.every(step=>step.pass===true&&step.exit_code===0&&Date.parse(step.finished_at)>=Date.parse(promotedAt)&&Date.parse(step.finished_at)<=Date.parse(acceptedAt)));
for(const [directory,manifest]of [[staged,stageSummary],[production,summary]]){
 const names=new Set();for(const file of manifest.files){assert.ok(!names.has(file.file),'Duplicate evidence path');names.add(file.file);const bytes=await raw(inside(directory,file.file));assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256,'Retained runner evidence changed');}
}
const coreValidation=await load(join(production,'production-core-validation.json'));assert.equal(coreValidation.pass,true);
assert.deepEqual(Object.keys(coreValidation.source_comparison).sort(),['apex','www']);
for(const host of ['apex','www'])assert.deepEqual(coreValidation.source_comparison[host].requires_review,[]);
const semanticBoundary={kind:'Original strict semantic outcomes retained separately from the narrow SEPA transport availability gate',staged:{},production:{}};
async function retainSemanticBoundary(directory,phase,host){
 const strictFile=join(directory,`${phase}-${host}-semantic.json`),gateFile=join(directory,`${phase}-${host}-semantic-release-gate.json`);
 const strict=await load(strictFile),gate=await load(gateFile),failures=strict.checks.filter(c=>!c.pass);
 assert.equal(strict.checks.length,50);assert.deepEqual(identity(strict.identity),target);assert.equal(gate.release_gate_pass,true);assert.equal(gate.strict_report_sha256,sha(await raw(strictFile)));assert.equal(gate.strict_semantics_pass,strict.pass);
 const note={strict_report:relative(directory,strictFile),strict_report_sha256:sha(await raw(strictFile)),strict_semantics_pass:strict.pass,strict_passed_checks:50-failures.length,strict_total_checks:50,separate_availability_gate:relative(directory,gateFile),availability_gate_sha256:sha(await raw(gateFile)),release_gate_pass:true,unresolved_source_availability:structuredClone(gate.unresolved_source_availability)};
 if(failures.length){
  assert.equal(strict.pass,false);assert.equal(failures.length,1);assert.equal(failures[0].name,'SEPA Galashiels observation');
  assert.equal(gate.unresolved_source_availability.length,1);const unresolved=gate.unresolved_source_availability[0];assert.equal(unresolved.source,'scotland/river_level');assert.equal(unresolved.status,'error');
  const scotlandFile=join(directory,`${phase}-${host}-capture/_scotland.json.response`),scotland=await load(scotlandFile),health=scotland.sources.river_level;
  assert.equal(scotland.river_level,null);assert.equal(health.status,'error');
  const unavailable=health.http_status===503&&health.error==='timeseries.sepa.org.uk returned HTTP 503',timeout=!Object.hasOwn(health,'http_status')&&health.error==='Source request timed out';assert.ok(unavailable||timeout,'Only the exact previously audited SEPA503/timeout states are permitted');
  assert.equal(unresolved.error,health.error);assert.equal(unresolved.http_status??null,health.http_status??null);assert.equal(unresolved.candidate_scotland_sha256,sha(await raw(scotlandFile)));assert.match(unresolved.accepted_production_comparison_sha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(unresolved.unchanged_git_blobs).sort(),['lib/open-observations.js','lib/sources.js']);assert.ok(Object.values(unresolved.unchanged_git_blobs).every(x=>/^[a-f0-9]{40}$/.test(x)));
  note.numerical_success=false;note.interpretation='Existing SEPA river-level source remains unavailable with null native data: exact publisher503 or exact timeout. The strict report remains49/50 and false; only the separately audited availability gate passes. Unchanged reader/fetch modules and accepted-baseline linkage are retained. No numerical success or recovery is claimed.';
 }else{assert.equal(strict.pass,true);assert.deepEqual(gate.unresolved_source_availability,[]);}
 semanticBoundary[phase][host]=note;
}
await retainSemanticBoundary(staged,'staged','apex');for(const host of ['apex','www'])await retainSemanticBoundary(production,'production',host);
for(const host of ['apex','www']){
 const observed=coreValidation.semantic[host];assert.equal(observed.release_semantic_gate_pass,true);assert.equal(observed.strict_semantics_pass,semanticBoundary.production[host].strict_semantics_pass);
 const strict=await load(join(production,`production-core-validation.${host}-strict.json`));assert.equal(sha(await raw(join(production,`production-core-validation.${host}-strict.json`))),observed.sha256);assert.deepEqual(identity(strict.identity),target);assert.equal(strict.pass,observed.strict_semantics_pass);assert.equal(strict.checks.length,50);
 assert.deepEqual(strict.checks.filter(c=>!c.pass).map(c=>c.name),observed.strict_semantics_pass?[]:['SEPA Galashiels observation']);
 if(!observed.strict_semantics_pass){assert.equal(observed.exception,'SEPA unchanged reader, exact503 or timeout, null value only');assert.equal(observed.baseline_evidence.numerical_success,false);semanticBoundary.production[host].health_gate_baseline_evidence=structuredClone(observed.baseline_evidence);}
}

const coreReport=await load(join(production,'production-core/report.json'));assert.equal(coreReport.pass,true);
const gapDirectory=join(production,'production-gap'),gapReport=await load(join(gapDirectory,'gap-interface-report.json'));
const verification=await verifyCapture(repo,gapDirectory,{revision:target.source_revision,version:target.worker_version,staged:false});assert.equal(verification.pass,true,verification.error);assert.equal(verification.requests,80);assert.deepEqual(verification.independent_cells,{boc:38,statcan:14,wra:4});assert.deepEqual(verification.held_sources,['australia/grid_day']);assert.ok(gapReport.requests.every(r=>Date.parse(r.started_at)>=Date.parse(promotedAt)&&Date.parse(r.completed_at)<=Date.parse(acceptedAt)));
for(const reference of verification.references)await load(join(repo,reference.file));
for(const request of gapReport.requests)if(request.file)await load(join(gapDirectory,request.file));
const review=structuredClone(oldReview);review.continuations.push({from:structuredClone(priorPlan.target),to:target,scope,evidence});const plan=reviewedReleasePlan(review);assert.equal(plan.reviews.length,5);
const approvals=structuredClone(oldApprovals),versions={},reconciliations={};
const assurance={
 'canada/exchange_history':'Two exact BoC exchange directions over the31-calendar-day window, paired published dates only, reconcile with separate original JSON/CSV extraction. Valid absent dates are not zero or carried forward. Shared Bank of Canada lineage remains explicit.',
 'canada/jobs':'Eleven seasonally adjusted unemployment rates for Canada and its ten provinces, expressed as percent of the labour force aged15+ (total gender), joined by exact vector identity. This corrects the previous positional geography swap; all11 rates reconcile exactly with separate official selected-table/CSV extraction. Unit239 Percent, scalar0, precision1decimal, population, flags and release metadata remain explicit; these are rates, not employment levels or counts.',
 'canada/price_index':'Exact Canada all-items unadjusted CPI index and current cube/series dimensions reconcile with independently extracted original official CSV/table and dated publication; shared Statistics Canada lineage remains explicit.',
 'canada/shop':'Exact Canada total retail-trade sales definition, adjustment, current-dollar unit/scalar and reference month reconcile with independently extracted original official CSV/table; shared Statistics Canada lineage remains explicit.',
 'canada/homes':'Exact existing CMHC housing-starts measure, geography, population, adjustment and units reconcile with independently extracted original official CSV/table. Conditional source/adaptation/terms notices retained; no recipient assent or future-vintage approval claimed.',
 'wales/land_transaction_tax':'Four exact completed-financial-year residential/non-residential Welsh LTT counts and revenues reconcile with independent original CSV extraction and official workbook presentation. Counts, monetary units, provisional/revision and effective-date meanings remain distinct.',
};
for(const contract of DAILY_HISTORY_CONTRACTS){
 for(const origin of ORIGINS){const request=gapReport.requests.find(r=>r.origin===origin&&r.path===`/${contract.desk}.json`&&r.method==='GET'&&!r.conditional&&r.status===200);assert.ok(request);const body=await load(join(gapDirectory,request.file));const result=await inspectSource(body,contract,{now:request.completed_at});assert.equal(result.kind,'success',`${origin} ${contract.key}: ${result.reason}`);assert.ok(result.version);if(versions[contract.key])assert.equal(versions[contract.key],result.version,'Both-domain semantic versions must agree');versions[contract.key]=result.version;reconciliations[contract.key]={periods:result.periods,observations:result.observations.length,version:result.version};}
 approvals[contract.key]={version:versions[contract.key],evidence,reviewed_at:acceptedAt,assurance:assurance[contract.key]};
}
assert.equal(Object.keys(approvals).length,21);for(const key of Object.keys(oldApprovals))assert.deepEqual(approvals[key],oldApprovals[key]);
const sourceStatus={};
for(const [index,origin]of ORIGINS.entries()){
 const dir=join(production,`production-${index?'www':'apex'}-capture`),health=await load(join(dir,'_health.json.response'));assert.deepEqual(identity(health),target);
 for(const desk of ['australia','new-zealand','canada','united-kingdom','england','scotland','wales','northern-ireland','united-states']){const body=await load(join(dir,`_${desk}.json.response`));assert.ok(body.sources);sourceStatus[`${origin}/${desk}.json`]={...body.sources,...Object.fromEntries(Object.entries(body.also?.sources||{}).map(([key,value])=>['also.'+key,value]))};}
}
// Full gap captures are the authoritative health clocks for the newly proved
// contracts; old/core successful sibling status remains from actual core bytes.
for(const request of gapReport.requests){if(request.method!=='GET'||request.conditional||request.status!==200)continue;const matched=DAILY_HISTORY_CONTRACTS.filter(c=>request.path===`/${c.desk}.json`);if(!matched.length)continue;const body=await load(join(gapDirectory,request.file));for(const c of matched)sourceStatus[request.origin+request.path][c.source]=body.sources[c.source];}
const statsReports=[];for(const host of ['apex','www']){const v=await load(join(production,`production-statsnz-${host}.json`));assert.equal(v.passed,true);assert.equal(v.actual_native_rows,23);assert.equal(v.all_23_numeric_acceptance,false);assert.equal(v.exact_numeric_comparisons,11);assert.equal(v.unverified_numeric_ids.length,12);statsReports.push(v);}
assert.deepEqual(statsReports[0].unverified_numeric_ids,statsReports[1].unverified_numeric_ids);
const record={held_source_contracts:['australia/grid_day'],task_id:'gap-pass-2026-10-20',phase:'released_observing',authorization:'User: Go down the gap list and dont stop untill completed',scope:'Existing nine desks: correct four StatCan headline readers and deepen Welsh LTT; add bounded BoC daily exchange history. AEMO remains held after actual Worker HTTP406 and rollback. No further source activation in this release.',evidence,release_accepted:true,deployed:true,identity:target,deployment_id:deploymentId,promoted_at:promotedAt,accepted_at:acceptedAt,rollback_identity:priorPlan.target,exact_initial_observation_approvals:reconciliations,validation:{production_summary:productionEvidence+'/summary.json',core_validation:productionEvidence+'/production-core-validation.json',gap_capture:productionEvidence+'/production-gap/gap-interface-report.json',semantic_availability_boundary:semanticBoundary,gap_requests:verification.requests,gap_independent_checks:verification.checks.length,independent_cells:verification.independent_cells,stats_nz:{structural_rows:23,independently_compared_rows:statsReports[0].exact_numeric_comparisons,all_23_numeric_acceptance:false,unverified_numeric_ids:statsReports[0].unverified_numeric_ids}},monitoring:{scope,obligations:116,public_probes:24,reviewed_edges:5,source_alerts_enabled:false,checkpoint_mutated:false,actual_checkpoint_sequence:5,actual_legacy_scheduled_cycles:2,actual_new_scope_scheduled_cycles:0,daily_history_started_shadow_at:null,delivery_acknowledgment_received:false},remaining_operational_gates:['Next actual normal serialized daily collection must apply the exact remaining reviewed suffix and be independently verified','New scope starts only from an actual complete scheduled collection, not earlier legacy elapsed time','At least8 complete daily scheduled checkpoints spanning seven elapsed days, no gap over26h, independent watchdog and genuine delivery receipt','NZ-PRICES17October,12 Stats NZ numeric rows and parked UK CPI remain unresolved'],retained_limitations:['Separate extractions and official presentations share publisher statistical lineage','Version approvals cover only the dated retained observations and do not approve new vintages','All offline replay cases are constructed; no checkpoint or scheduled observation is created']};
const acceptance=structuredClone(oldAcceptance);acceptance.updated_at=acceptedAt;acceptance.complete=false;acceptance.scope+='; separately authorized BoC history and existing StatCan/WRA correctness contracts; AEMO held after actual Worker HTTP406';acceptance.status='Two legacy scheduled cycles verified; existing releases and bounded gap-pass implementation accepted. Actual expanded-scope collection, seven-day SHADOW and delivery remain incomplete; selected external evidence/access gates remain blocked';acceptance.gap_pass_release=record;
for(const count of [109,114,115])acceptance.operations[`source_registry_${count}`].state=`Historical release configured${count} obligations; current reviewed configuration has116. No actual expanded-scope collection is claimed.`;
acceptance.operations.source_registry_116={state:'116 obligations configured in24public probes; exact fifth reviewed edge awaits normal serialized collection. Zero actual daily-history-scope scheduled observations; no inherited elapsed days.',evidence:['operations/source-contract-registry.json','operations/us-release-review.json','verification/gap-pass-2026-10-20/monitor-transition-replay.json']};
const statsTask=acceptance.tasks.find(t=>t.id==='NZ-STATS23');assert.ok(statsTask);statsTask.gates['Independent extraction and publisher comparison']='Partial progress:11 exact independently extracted original publisher cells match both production domains;12 numeric rows remain unverified. All23 metadata/structure checks pass; shared publisher lineage and dated-vintage limits retained.';statsTask.blocking_decisions=['Retain independent numerical verification gap for12 specified Stats NZ rows; no all23-cell or future-vintage numerical approval'];statsTask.evidence=[...new Set([...statsTask.evidence,'verification/gap-pass-2026-10-20/statsnz/README.md'])];
const baseline=structuredClone(oldBaseline);baseline.earlier_releases.push(structuredClone(baseline.previous_release));baseline.previous_release={checked_at:oldBaseline.checked_at,identity:oldBaseline.identity,release_evidence:oldBaseline.release_evidence,source_status:oldBaseline.source_status};baseline.checked_at=acceptedAt;baseline.identity={...oldBaseline.identity,...target};baseline.release_evidence=evidence;baseline.source_status=sourceStatus;baseline.gap_pass_release=structuredClone(record);baseline.validated_contracts.daily_history_gap_pass={evidence,contracts:reconciliations,assurance:'Exact dated numerical approvals; shared publisher lineage; no future release or scheduled-operation claim'};baseline.validated_contracts.stats_nz='23 current structural/metadata rows;11 independently reconciled dated values on both domains;12 numeric rows remain unverified. No all23 or future-vintage numerical approval.';baseline.latest_release_targeted_confirmation={checked_at:acceptedAt,evidence:productionEvidence+'/production-core-validation.json',semantic_availability_boundary:semanticBoundary,note:'Actual per-domain strict semantic results: '+Object.entries(semanticBoundary.production).map(([host,result])=>host+' '+result.strict_passed_checks+'/'+result.strict_total_checks+', strict_pass='+result.strict_semantics_pass+', availability_exception='+(result.unresolved_source_availability.length?'exact SEPA503/timeout with null native data; separate narrow gate':'none')).join('; ')+'. Original strict reports remain unchanged. No broader source recovery or numerical verification is inferred; source alerts stay disabled.'};baseline.checkpoint_watch.pending_release_transition={...baseline.checkpoint_watch.pending_release_transition,approved_live_identity:target,state:'Await next normal serialized daily collection; exact old→USA→claimant→rent→GDP→daily-history chain. Reviewed intermediates are not fabricated collections; no checkpoint write or manual dispatch.',reviewed_scopes:plan.reviews.map(e=>e.scope),reviewed_edges:5,evidence:'verification/gap-pass-2026-10-20/monitor-transition-replay.json'};
const unchangedCheckpointWatch=structuredClone(baseline.checkpoint_watch);delete unchangedCheckpointWatch.pending_release_transition;const oldCheckpointWatch=structuredClone(oldBaseline.checkpoint_watch);delete oldCheckpointWatch.pending_release_transition;assert.deepEqual(unchangedCheckpointWatch,oldCheckpointWatch);assert.deepEqual(baseline.last_notified_state,oldBaseline.last_notified_state);assert.deepEqual(baseline.notification_policy,oldBaseline.notification_policy);assert.deepEqual(baseline.bounded_data_verification,oldBaseline.bounded_data_verification);assert.deepEqual(acceptance.bounded_verification_continuation,oldAcceptance.bounded_verification_continuation);assert.deepEqual(acceptance.operations.seven_day_shadow,oldAcceptance.operations.seven_day_shadow);assert.deepEqual(acceptance.operations.notification_acknowledgment,oldAcceptance.operations.notification_acknowledgment);
const registry=buildMonitorRegistry(review);assert.equal(registry.sources.length,116);assert.deepEqual(registry.staged_sources.map(c=>c.key),['australia/grid_day']);assert.equal(registry.staged_sources[0].activation,'held_runtime_access');
await mkdir(out);for(const [name,value]of Object.entries({'review.json':review,'approvals.json':approvals,'acceptance.json':acceptance,'baseline.json':baseline,'registry.json':registry}))await writeFile(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const captureCompletedAt=gapReport.requests.reduce((latest,request)=>Date.parse(request.completed_at)>Date.parse(latest)?request.completed_at:latest,gapReport.requests[0].completed_at);
const replayArgs=[join(repo,'scripts/replay-gap-release.mjs'),checkpointPath,oldReportPath,priorReviewPath,priorApprovalsPath,join(out,'review.json'),join(out,'approvals.json'),gapDirectory,join(production,'production-apex-capture'),join(production,'production-www-capture'),join(out,'monitor-transition-replay.json'),new Date(Date.parse(captureCompletedAt)).toISOString()];
await promisify(execFile)(process.execPath,replayArgs,{cwd:repo,maxBuffer:1024*1024,timeout:60000});
const replay=JSON.parse(await readFile(join(out,'monitor-transition-replay.json')));assert.equal(replay.pass,true);assert.equal(replay.total_obligations,116);assert.equal(replay.actual_scheduled_cycles_added,0);assert.equal(replay.checkpoint_written,false);
for(const [path,bytes]of inputs)assert.equal(sha(await readFile(path)),sha(bytes),'Input changed during preparation');
await writeFile(join(out,'preparation.json'),JSON.stringify({pass:true,prepared_only:true,activation_written:false,offline_replay_pass:true,proposal_files_only:true,replay_clock: captureCompletedAt,identity:target,accepted_at:acceptedAt,production_root:production,repo,versions,prior_edge_count:4,final_edge_count:5,prior_approval_count:15,final_approval_count:21,obligations:116,public_probes:24,checkpoint_sequence:5,actual_scheduled_cycles_added:0,unchanged:['prior review fields/edges','prior15approvals','checkpoint_watch except pending transition','last_notified_state','notification_policy','NZ-PRICES bounded task','seven_day_shadow','notification_acknowledgment'],inputs:[...inputs].map(([path,bytes])=>({path,sha256:sha(bytes),bytes:bytes.length}))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,prepared_only:true,out,obligations:116,approvals:21,actual_scheduled_cycles_added:0}));
