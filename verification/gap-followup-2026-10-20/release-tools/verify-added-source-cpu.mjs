// Offline freshness gate for three actual full-desk CPU captures; no HTTP.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {evaluateLegacyCpuEvidence} from '../../../scripts/lib/legacy-cpu-evidence.mjs';
import {validateRemainingRepresentation} from '../../../lib/remaining-information.js';
const [input,output,revision,version]=process.argv.slice(2);
assert.equal(process.argv.length,6,'CPU_REPORT NEW_OUTPUT REVISION VERSION required');
const bytes=await readFile(input),report=JSON.parse(bytes);
const approved=JSON.parse(await readFile(new URL('../../monitoring-baseline.json',import.meta.url),'utf8')).identity;
const result={kind:'Offline fresh publisher acquisitions bound to actual full-desk CPU samples',pass:false,input,input_sha256:createHash('sha256').update(bytes).digest('hex'),revision,version,sources:[],limitations:['CPU is the full-desk sample, not per-source CPU.','One sampled request per desk; no percentile, sustained-operation or scheduled-acceptance claim.']};
try{
 assert.deepEqual(report.approved_identity,approved);
 assert.equal(report.version,version);assert.equal(report.expected_source_revision,revision);assert.equal(report.cpu_limit_ms,500);
 const evaluated=evaluateLegacyCpuEvidence(report,approved,version,revision);
 assert.equal(evaluated.budget_pass,true,'Recomputed exact trace, identity, budget and freshness gates must pass');
 const specs=[
  ['scotland','college_activity',['workbook'],[39655,47405,4595,24400,116055]],
  ['canada','rental_benchmark',['cube','data','series'],[2121,991]],
  ['northern-ireland','electricity_balance',['article'],[50,8865,4431,3855,578]],
 ];
 for(const [desk,key,roles,values]of specs){
  const path='/'+desk+'.json',matches=report.checks.filter(c=>c.override===true&&c.path===path);
  assert.equal(matches.length,1);const capture=matches[0],native=capture.body[key],health=capture.body.sources[key];
  assert.equal(health.status,'ok');assert.equal(validateRemainingRepresentation(desk,key,native,{retrieved_at:health.fetched_at}),true);
  const start=Date.parse(capture.started_at),end=Date.parse(capture.at),complete=Date.parse(health.fetched_at);
  assert.ok(Number.isFinite(start)&&Number.isFinite(end)&&start<=complete&&complete<=end,'Fresh source completion required inside sampled request');
  assert.deepEqual(native.rows.map(row=>row.value),values,'Pinned release values required in the CPU body');
  assert.deepEqual(native.provenance.map(p=>p.role).sort(),roles);
  for(const acquisition of native.provenance){
   const at=Date.parse(acquisition.retrieved_at);
   assert.ok(start<=at&&at<=complete,'Cached or future publisher acquisition cannot establish cold CPU');
   assert.ok(Number.isSafeInteger(acquisition.bytes)&&acquisition.bytes>0&&/^[a-f0-9]{64}$/.test(acquisition.sha256));
  }
  const cpu=evaluated.cpu_by_path[path];assert.equal(cpu.length,1);assert.ok(Number.isFinite(cpu[0])&&cpu[0]>=0&&cpu[0]<=500);
  result.sources.push({source:desk+'/'+key,path,full_desk_cpu_ms:cpu[0],request_started_at:capture.started_at,request_completed_at:capture.at,health_completed_at:health.fetched_at,publisher_acquisitions:native.provenance,pass:true});
 }
 result.pass=true;
}catch(error){result.error=error.message;}
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:result.pass,sources:result.sources.length,error:result.error,output}));
if(!result.pass)process.exitCode=1;
