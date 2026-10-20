// Pure offline evaluation of the staged legacy CPU capture. No network or writes.
import {stagingMatches,identityMatches,PRODUCTION_ORIGINS} from './us-cpu-evidence.mjs';
export const LEGACY_COUNTRIES={
 '/australia.json':'Australia','/new-zealand.json':'New Zealand','/canada.json':'Canada',
 '/united-kingdom.json':'United Kingdom','/england.json':'England','/scotland.json':'Scotland',
 '/wales.json':'Wales','/northern-ireland.json':'Northern Ireland',
};
export const LEGACY_CPU_PATHS=['/health.json',...Object.keys(LEGACY_COUNTRIES)];
export function evaluateLegacyCpuEvidence(report,approved,version,expectedRevision){
 const evaluation={...report},countries=LEGACY_COUNTRIES,paths=LEGACY_CPU_PATHS;
 const correlations=check=>evaluation.events.filter(event=>event.request_path===check.path&&event.script_version?.id===version&&Number.isFinite(event.event_timestamp)&&event.event_timestamp>=Date.parse(check.started_at)-1000&&event.event_timestamp<=Date.parse(check.at));
 const target=evaluation.checks.filter(check=>check.override);
 const health=target.find(check=>check.path==='/health.json');
 const identity={...health?.body,worker_version:version,source_revision:expectedRevision};
 evaluation.candidate_identity_confirmed=Boolean(/^[a-f0-9]{16}$/.test(identity.build_fingerprint||'')&&identityMatches(health||{},identity)&&target.length===paths.length&&target.every(check=>check.status===200&&check.json_valid&&check.headers['x-worker-version']===version&&check.headers['x-source-revision']===expectedRevision&&(check.headers['x-source-dirty']===undefined||check.headers['x-source-dirty']==='false')&&(check.headers['x-build-fingerprint']===undefined||check.headers['x-build-fingerprint']===identity.build_fingerprint)));
 evaluation.production_identity_confirmed=['before','after'].every(phase=>PRODUCTION_ORIGINS.every(origin=>{
  const checks=evaluation.checks.filter(check=>!check.override&&check.phase===phase&&check.origin===origin&&check.path==='/health.json');
  return checks.length===1&&identityMatches(checks[0],approved);
 }));
 evaluation.deployment_unchanged=Boolean(stagingMatches(evaluation.deployment_before,version,approved)&&stagingMatches(evaluation.deployment_after,version,approved)&&evaluation.deployment_before.id===evaluation.deployment_after.id);
 evaluation.complete_event_coverage=target.length===paths.length&&evaluation.events.length===paths.length&&paths.every(path=>target.filter(check=>check.path===path).length===1)&&target.every(check=>correlations(check).length===1);
 evaluation.events_valid=evaluation.events.length===paths.length&&evaluation.events.every(event=>Number.isFinite(event.cpu_ms)&&event.cpu_ms>=0&&event.cpu_ms<=500&&event.outcome==='ok'&&Array.isArray(event.exception_names)&&event.exception_names.length===0);
 evaluation.desk_freshness=Object.entries(countries).map(([path,country])=>{
  const checks=target.filter(check=>check.path===path),check=checks[0],body=check?.body;
  const groups=[['sources',body?.sources],...(body?.also?.sources===undefined?[]:[['also.sources',body.also.sources]])];
  const groups_valid=groups.every(([,sources])=>sources&&typeof sources==='object'&&!Array.isArray(sources)&&Object.keys(sources).length>0);
  const sources=groups.flatMap(([group,values])=>Object.entries(values||{}).map(([name,value])=>{
   const at=Date.parse(value?.fetched_at);
   return {source:group+'.'+name,status:value?.status,fetched_at:value?.fetched_at,fresh:Number.isFinite(at)&&at>=Date.parse(check?.started_at)&&at<=Date.parse(check?.at)};
  }));
  return {path,country,source_count:sources.length,sources,pass:checks.length===1&&body?.country===country&&body?._meta?.schema_version==='1.0'&&groups_valid&&sources.length>0&&sources.every(source=>source.fresh&&['ok','degraded','error'].includes(source.status))&&sources.some(source=>source.status==='ok')};
 });
 evaluation.cold_retrieval_confirmed=evaluation.desk_freshness.length===8&&evaluation.desk_freshness.every(desk=>desk.pass);
 evaluation.budget_pass=Boolean(!evaluation.error&&!evaluation.tail_command_error&&!evaluation.tail_parse_error&&evaluation.candidate_identity_confirmed&&evaluation.production_identity_confirmed&&evaluation.deployment_unchanged&&evaluation.complete_event_coverage&&evaluation.events_valid&&evaluation.cold_retrieval_confirmed);
 evaluation.cpu_by_path=Object.fromEntries(paths.map(path=>[path,evaluation.events.filter(event=>event.request_path===path).map(event=>event.cpu_ms)]));
 return Object.fromEntries(['candidate_identity_confirmed','production_identity_confirmed','deployment_unchanged','complete_event_coverage','events_valid','desk_freshness','cold_retrieval_confirmed','budget_pass','cpu_by_path'].map(key=>[key,evaluation[key]]));
}
