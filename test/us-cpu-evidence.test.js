import test from 'node:test';
import assert from 'node:assert/strict';
import {CPU_PATHS,PRODUCTION_ORIGINS,latestDeployment,evaluateCpuEvidence} from '../scripts/lib/us-cpu-evidence.mjs';
const approved={worker_version:'production',source_revision:'a'.repeat(40),source_dirty:false,build_fingerprint:'1'.repeat(16)};
const candidate={...approved,worker_version:'candidate',source_revision:'b'.repeat(40)};
const headers=id=>({'x-worker-version':id.worker_version,'x-source-revision':id.source_revision,'x-source-dirty':'false','x-build-fingerprint':id.build_fingerprint});
function fixture(){
 const deployment={id:'deployment',versions:[{version_id:'production',percentage:100},{version_id:'candidate',percentage:0}]};
 return {version:'candidate',deployment_before:structuredClone(deployment),deployment_after:structuredClone(deployment),checks:[
  ...CPU_PATHS.map(path=>({path,override:true,status:200,started_at:'2026-10-20T00:00:00Z',at:'2026-10-20T00:00:02Z',headers:headers(candidate),body:path==='/health.json'?candidate:{retrieval:{status:'ok',retrieved_at:'2026-10-20T00:00:01Z'},sources:{cpi:{status:'ok'}}}})),
  ...['before','after'].flatMap(phase=>PRODUCTION_ORIGINS.map(origin=>({path:'/health.json',override:false,phase,origin,status:200,body:approved,headers:headers(approved)}))),
 ],events:CPU_PATHS.map(request_path=>({request_path,script_version:{id:'candidate'},event_timestamp:Date.parse('2026-10-20T00:00:01Z'),cpu_ms:10,outcome:'ok',exception_names:[]}))};
}
test('complete correlated CPU evidence requires clean candidate, zero traffic and unchanged production',()=>{
 assert.equal(evaluateCpuEvidence(fixture(),approved).budget_pass,true);
 for(const mutate of [
  r=>r.events[1].cpu_ms=11,r=>r.events[1].cpu_ms=-1,r=>r.events[1].cpu_ms=NaN,
  r=>r.events.pop(),r=>r.events.push(r.events[0]),r=>r.events[1].script_version.id='other',
  r=>r.events[1].exception_names=['Error'],r=>r.events[1].outcome='exception',
  r=>r.checks[1].body.retrieval.retrieved_at='2026-10-19T00:00:00Z',
  r=>r.checks[1].body.retrieval.retrieved_at='2026-10-21T00:00:00Z',
  r=>r.checks[2].body.sources.cpi.status='error',r=>r.checks[1].headers['x-source-dirty']='true',
  r=>r.checks[1].headers['x-source-revision']='c'.repeat(40),r=>r.checks.pop(),
  r=>r.checks.at(-1).headers['x-worker-version']='other',r=>r.checks.at(-1).body.source_dirty=true,
  r=>r.deployment_after.id='changed',r=>r.deployment_before.versions[1].percentage=1,
  r=>r.checks[3].path=CPU_PATHS[2],r=>r.tail_command_error=true,
 ]){const r=structuredClone(fixture());mutate(r);assert.equal(evaluateCpuEvidence(r,approved).budget_pass,false,String(mutate));}
});
test('deployment ordering uses timestamps and rejects ambiguous metadata',()=>{
 const a={id:'new',created_on:'2026-10-20T00:00:00Z',versions:[]},b={id:'old',created_on:'2026-10-19T00:00:00Z',versions:[]};
 assert.equal(latestDeployment([a,b]).id,'new');assert.equal(latestDeployment([b,a]).id,'new');
 assert.throws(()=>latestDeployment([a,{...a,id:'tie'}]),/ambiguous/);
 assert.throws(()=>latestDeployment([]),/invalid/);assert.throws(()=>latestDeployment([{...a,created_on:'invalid'}]),/invalid/);
});
