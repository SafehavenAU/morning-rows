// Offline final audit of this invocation's reports. No HTTP or release activation.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const [directory,phase,revision,version]=process.argv.slice(2);
assert.equal(process.argv.length,6,'OUTPUT_ROOT staged|production REVISION VERSION required');
assert.ok(['staged','production'].includes(phase));
assert.match(revision,/^[a-f0-9]{40}$/);assert.match(version,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
const hosts=phase==='staged'?['apex']:['apex','www'],n=hosts.length;
const report={kind:'Offline complete release-gate report audit; no metadata activation or scheduled-operation claim',pass:false,phase,revision,version,inputs:[],gates:[],semantic_exceptions_allowed:false};
const load=async file=>{const bytes=await readFile(join(directory,file));report.inputs.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});return JSON.parse(bytes);};
const passed=async(file,field='pass')=>{const value=await load(file);assert.equal(value[field],true,file+' failed');report.gates.push({file,pass:true});return value;};
const count=(value,expected,label)=>assert.equal(Array.isArray(value)?value.length:value,expected,label);
const identity=value=>{assert.equal(value.source_revision,revision);assert.equal(value.worker_version,version);assert.equal(value.source_dirty,false);assert.match(value.build_fingerprint,/^[a-f0-9]{16}$/);return value.build_fingerprint;};
const allPass=(rows,label)=>assert.ok(Array.isArray(rows)&&rows.every(row=>row.pass===true),label);
try{
 const steps=(await readFile(join(directory,'steps.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
 const expected=['local-preflight','active-contract-scope',
  ...(phase==='staged'?['usa-cold-cpu','legacy-cold-cpu','added-source-fresh-cpu','claimant-www-cold-cpu','rent-www-cold-cpu','baseline-preserved-through-cpu']:['exact-staged-prerequisite']),
  'core-capture','core-offline-derivation-schema-us',
  ...hosts.flatMap(host=>['core-semantics-'+host,'statsnz-independent-'+host]),
  ...(phase==='production'?['strict-production-source-comparison']:[]),
  'gdp-capture','gdp-offline','claimant-capture','claimant-independent','claimant-schemas','rent-capture','rent-offline',
  'gap-capture','gap-independent','gap-schemas','remaining-capture','remaining-independent','remaining-schemas',
  'ni-capture','ni-independent','ni-schemas',...(phase==='production'?['full-smoke-apex','full-smoke-www']:[])];
 assert.deepEqual(steps.map(s=>s.step),expected,'Every required gate must run exactly once and in order');
 assert.ok(steps.every(s=>s.pass===true&&s.exit_code===0));report.completed_steps_before_audit=steps.length;
 const core=await passed(`${phase}-core/${phase==='staged'?'staged-preview-report.json':'report.json'}`);
 count(core.checks,phase==='staged'?137:151,'Core interface assertions');
 await passed(`${phase}-core-derivation.json`);
 const schemas=await passed(`${phase}-core-schemas-us.json`);
 count(schemas.schema_documents,12*n,'Core schemas');count(schemas.us_reference_cells,13*n,'BLS slots');
 let fingerprint;
 for(const host of hosts){
  const semantic=await passed(`${phase}-${host}-semantic.json`);
  count(semantic.checks,50,'Strict core semantics');allPass(semantic.checks,'Every strict core check must pass');
  const fp=identity(semantic.identity);if(fingerprint)assert.equal(fp,fingerprint);fingerprint=fp;
  assert.equal(semantic.source_status.scotland.river_level.status,'ok','No SEPA exception');
  const stats=await passed(`${phase}-statsnz-${host}.json`,'passed');
  count(stats.independent_reference_count,15,'Dated Stats NZ references');count(stats.exact_numeric_comparisons,15,'Stats NZ comparisons');count(stats.unverified_numeric_ids,8,'Unresolved Stats NZ numeric cells');
  for(const key of ['all_23_numeric_acceptance','undisplayed_flags_accepted','future_vintages_approved','scheduled_or_release_acceptance'])assert.equal(stats[key],false,key);
 }
 if(phase==='staged'){
  for(const [name,limit] of [['us',100],['legacy',500],['claimant',500],['rent',500]]){
   const cpu=await passed(`staged-${name}-cpu.json`,'budget_pass');assert.equal(cpu.version,version);assert.equal(cpu.cpu_limit_ms,limit);
   assert.equal(cpu.complete_event_coverage,true);assert.equal(cpu.cold_retrieval_confirmed,true);
  }
  const fresh=await passed('staged-added-source-cpu.json');
  assert.deepEqual(fresh.sources.map(s=>s.source),['scotland/college_activity','canada/rental_benchmark','northern-ireland/electricity_balance']);
  assert.ok(fresh.sources.every(s=>s.pass===true&&s.full_desk_cpu_ms<=500));
 }else{
  const comparison=await passed('production-core-validation.json');assert.equal(comparison.semantic_exceptions_allowed,false);assert.equal(identity(comparison.identity),fingerprint);
  for(const host of hosts){count(comparison.source_comparison[host].compared_source_states,119,'Source-state coverage');count(comparison.source_comparison[host].requires_review,0,'Unreviewed source changes');}
 }
 const gdp=await passed(`${phase}-gdp-validation.json`);
 assert.deepEqual(gdp.counts,{transport:19*n,native_comparisons:3*n,selected_comparisons:11*n,schema_checks:9*n,schema_negative_controls:18*n});
 const claimants=await passed(`${phase}-claimant-validation.json`);
 count(claimants.native_cells_compared,65*n,'Claimant cells');count(claimants.selectors,20*n,'Claimant selectors');count(claimants.negative_responses,15*n,'Claimant refusals');
 const claimantSchemas=await passed(`${phase}-claimant-schemas.json`);
 count(claimantSchemas.schema_checks,25*n,'Claimant schemas');count(claimantSchemas.negative_contracts,185*n,'Claimant schema mutations');
 const rent=await passed(`${phase}-rent-validation.json`);
 count(rent.counts.native_numeric_cells,116*n,'Rent cells');count(rent.counts.schema_documents,21*n,'Rent schemas');count(rent.counts.schema_negative_controls,24*n,'Rent schema mutations');
 for(const [key,manifest,routes,docs,negatives] of [
  ['gap','gap-interface-report.json',40,24,8],
  ['remaining','remaining-interface-report.json',22,10,8],
  ['ni-energy','ni-energy-interface-report.json',23,13,8],
 ]){
  const captured=await passed(`${phase}-${key}/${manifest}`);assert.equal(captured.revision,revision);assert.equal(captured.version,version);assert.equal(captured.staged,phase==='staged');count(captured.requests,routes*n,key+' requests');
  const validated=await passed(`${phase}-${key}-validation.json`);
  const structured=await passed(`${phase}-${key}-schemas.json`);count(structured.schema_checks,docs*n,key+' schemas');count(structured.negative_controls,negatives*n,key+' mutations');
  if(key==='gap')assert.deepEqual(validated.independent_cells,{boc:38,statcan:14,wra:4});
  if(key==='remaining')assert.deepEqual(validated.independent_cells_per_domain,{sfc:5,cmhc:2});
  if(key==='ni-energy'){assert.deepEqual(validated.independent_cells_per_domain,{ni_electricity:5});assert.equal(validated.fixed_edition,'fixed_2026-09-03');assert.equal(validated.source_presentations_share_statistical_lineage,true);}
 }
 if(phase==='production')for(const [host,total] of [['apex',18],['www',17]]){
  const smoke=await load(`production-smoke-${host}.json`);
  count(smoke.checks,total,'Full smoke checks');assert.ok(smoke.checks.every(c=>c.status==='pass'));assert.equal(identity(smoke.identity),fingerprint);
  report.gates.push({file:`production-smoke-${host}.json`,pass:true});
 }
 report.pass=true;report.build_fingerprint=fingerprint;
}catch(error){report.error=error.message;}
await writeFile(join(directory,'release-gate-audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:report.pass,gates:report.gates.length,error:report.error}));
if(!report.pass)process.exitCode=1;
