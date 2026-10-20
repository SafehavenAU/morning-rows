export const CPU_PATHS = ['/health.json','/united-states.json?source=cpi&measure=CUUR0000SA0','/united-states.json','/catalog.v2.json'];
export const PRODUCTION_ORIGINS = ['https://morningrows.com','https://www.morningrows.com'];

export function latestDeployment(deployments) {
 if (!Array.isArray(deployments) || !deployments.length || deployments.some(d=>!d.id||!Number.isFinite(Date.parse(d.created_on)))) throw Error('invalid_deployments');
 const sorted=[...deployments].sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
 if(sorted[1]&&Date.parse(sorted[0].created_on)===Date.parse(sorted[1].created_on))throw Error('ambiguous_deployments');
 const {id,created_on,versions}=sorted[0];return {id,created_on,versions};
}
export function stagingMatches(deployment,version,approved) {
 const versions=deployment?.versions;
 return version!==approved.worker_version&&Array.isArray(versions)&&versions.length===2&&
  versions.some(v=>v.version_id===approved.worker_version&&v.percentage===100)&&
  versions.some(v=>v.version_id===version&&v.percentage===0);
}
export function identityMatches(check,expected) {
 const h=check.headers||{},b=check.body||{};
 return check.status===200&&b.worker_version===expected.worker_version&&b.source_revision===expected.source_revision&&b.source_dirty===false&&b.build_fingerprint===expected.build_fingerprint&&
  h['x-worker-version']===expected.worker_version&&h['x-source-revision']===expected.source_revision&&
  (h['x-source-dirty']===undefined||h['x-source-dirty']==='false')&&(h['x-build-fingerprint']===undefined||h['x-build-fingerprint']===expected.build_fingerprint);
}
export function evaluateCpuEvidence(report,approved) {
 const target=report.checks.filter(c=>c.override),cold=target.find(c=>c.path===CPU_PATHS[1]);
 const fresh=Date.parse(cold?.body?.retrieval?.retrieved_at);
 const cold_retrieval_confirmed=Boolean(cold?.body?.retrieval?.status==='ok'&&fresh>=Date.parse(cold.started_at)&&fresh<=Date.parse(cold.at));
 const complete_event_coverage=target.length===CPU_PATHS.length&&CPU_PATHS.every(path=>target.filter(c=>c.path===path).length===1)&&target.every(c=>report.events.filter(e=>e.request_path===c.path&&e.script_version?.id===report.version&&e.event_timestamp>=Date.parse(c.started_at)-1000&&e.event_timestamp<=Date.parse(c.at)).length===1);
 const deployment_unchanged=stagingMatches(report.deployment_before,report.version,approved)&&stagingMatches(report.deployment_after,report.version,approved)&&report.deployment_before.id===report.deployment_after.id;
 const production_identity_confirmed=['before','after'].every(phase=>PRODUCTION_ORIGINS.every(origin=>{
  const checks=report.checks.filter(c=>!c.override&&c.phase===phase&&c.origin===origin&&c.path==='/health.json');
  return checks.length===1&&identityMatches(checks[0],approved);
 }));
 const health=target.find(c=>c.path==='/health.json');
 const candidate={...health?.body,worker_version:report.version};
 const candidate_identity_confirmed=Boolean(/^[a-f0-9]{40}$/.test(candidate.source_revision||'')&&/^[a-f0-9]{16}$/.test(candidate.build_fingerprint||'')&&identityMatches(health||{},candidate)&&target.every(c=>c.status===200&&c.headers?.['x-worker-version']===report.version&&c.headers?.['x-source-revision']===candidate.source_revision&&(c.headers?.['x-source-dirty']===undefined||c.headers['x-source-dirty']==='false')&&(c.headers?.['x-build-fingerprint']===undefined||c.headers['x-build-fingerprint']===candidate.build_fingerprint)));
 const events_valid=report.events.length===CPU_PATHS.length&&report.events.every(e=>Number.isFinite(e.cpu_ms)&&e.cpu_ms>=0&&e.cpu_ms<=10&&e.outcome==='ok'&&Array.isArray(e.exception_names)&&e.exception_names.length===0);
 const data_valid=target.find(c=>c.path==='/united-states.json')?.body?.sources?.cpi?.status==='ok';
 return {cold_retrieval_confirmed,complete_event_coverage,deployment_unchanged,production_identity_confirmed,candidate_identity_confirmed,
  budget_pass:Boolean(!report.error&&!report.tail_command_error&&cold_retrieval_confirmed&&complete_event_coverage&&deployment_unchanged&&production_identity_confirmed&&candidate_identity_confirmed&&events_valid&&data_valid)};
}
