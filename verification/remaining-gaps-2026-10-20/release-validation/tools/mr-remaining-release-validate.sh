#!/usr/bin/env bash
# Owner-invoked release validation only. This file never uploads/deploys a Worker.
# Active gap scope: six phase-one contracts plus SFC/CMHC; AEMO remains held.
# Core semantic/production-health exceptions are exclusively decided by the
# separately audited helper files; this runner grants no retry or new exception.
# Usage: /tmp/mr-remaining-release-validate.sh staged|production VERSION REVISION FRESH_OUTPUT_ROOT
# Production additionally requires MR_REMAINING_STAGED_ROOT pointing to a successful
# invocation's output root, so comparison cannot silently use an older release.
set -euo pipefail
if [[ $# != 4 || ! $1 =~ ^(staged|production)$ || ! $2 =~ ^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$ || ! $3 =~ ^[a-f0-9]{40}$ ]]; then
  printf '%s\n' 'Usage: staged|production VERSION REVISION FRESH_OUTPUT_ROOT' >&2; exit 2
fi
MR_PHASE=$1; MR_VERSION=$2; MR_REVISION=$3
MR_REPO=${MR_REMAINING_REPO:-/workspace/morning-rows-remaining}
MR_OUT=$(realpath -m -- "$4")
cd -- "$MR_REPO"
# No -p: never reuse or overwrite a previous attempt.
mkdir -- "$MR_OUT"
mkdir -- "$MR_OUT/logs"
MR_BASELINE=verification/monitoring-baseline.json
MR_BASELINE_SHA=$(sha256sum "$MR_BASELINE" | cut -d' ' -f1)
MR_CLAIM_REF=verification/nz-market-rent-2026-10-20/claimant-refresh/independent-report.json
MR_RENT_REF=verification/nz-market-rent-2026-10-20/independent-report.json
MR_GDP_REF=verification/statcan-gdp-2026-10-20/independent-report.json
MR_US_REF=verification/us-paid-2026-10-20/workbook-recheck.json
MR_CHECKER=verification/gap-pass-2026-10-20/interface-checker
MR_REMAINING_CHECKER=verification/remaining-gaps-2026-10-20/interface-checker
export XDG_CONFIG_HOME=/workspace/.morning-rows-tools/config
export EXPECTED_REVISION=$MR_REVISION EXPECTED_WORKER_VERSION=$MR_VERSION EXPECTED_US_LATEST=2026-09
export PYTHONDONTWRITEBYTECODE=1
MR_STEP=initialization
mr_finish() {
  local rc=$?
  trap - EXIT
  python3 - "$MR_OUT" "$MR_PHASE" "$MR_REVISION" "$MR_VERSION" "$rc" "$MR_STEP" "$MR_REPO" "$MR_BASELINE_SHA" <<'PY'
import datetime,hashlib,json,pathlib,sys
out,phase,rev,version,rc,step,repo,baseline=sys.argv[1:]
p=pathlib.Path(out);steps=[json.loads(x) for x in (p/'steps.jsonl').read_text().splitlines()] if (p/'steps.jsonl').exists() else []
files=[{'file':str(x.relative_to(p)),'bytes':x.stat().st_size,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in sorted(p.rglob('*')) if x.is_file()]
r={'kind':'Owner-invoked actual release validation; no upload, promotion or checkpoint write','phase':phase,'revision':rev,'version':version,'pass':int(rc)==0,'exit_code':int(rc),'last_step':step,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'repository':repo,'baseline_sha256_before_cpu':baseline,'steps':steps,'files':files,'limitations':['Sampled CPU only, no percentile or sustained-operation claim.','Independent references remain pinned; new vintages fail instead of silently refreshing.','Any source-state regression requires explicit review; this script does not approve or activate release metadata.']}
with (p/'summary.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps({'phase':phase,'pass':r['pass'],'steps':len(steps),'last_step':step,'output':out}))
PY
  exit "$rc"
}
trap mr_finish EXIT
mr_step() {
  MR_STEP=$1; shift
  local rc=0
  printf 'Running %s\n' "$MR_STEP"
  if "$@" > "$MR_OUT/logs/$MR_STEP.log" 2>&1; then :; else rc=$?; fi
  python3 - "$MR_OUT/steps.jsonl" "$MR_STEP" "$rc" <<'PY'
import datetime,json,sys
with open(sys.argv[1],'a') as f:f.write(json.dumps({'step':sys.argv[2],'pass':sys.argv[3]=='0','exit_code':int(sys.argv[3]),'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})+'\n')
PY
  if ((rc)); then printf 'FAILED %s; retained log: %s/logs/%s.log\n' "$MR_STEP" "$MR_OUT" "$MR_STEP" >&2; exit "$rc"; fi
  printf 'Passed %s\n' "$MR_STEP"
}
mr_baseline_unchanged() { [[ $(sha256sum "$MR_BASELINE" | cut -d' ' -f1) == "$MR_BASELINE_SHA" ]]; }
# Offline byte-copy derivation plus actual captured schema/USA numeric checks.
# No standalone nine-desk staged schema helper exists; this reuses the explicit
# format checks and remote-ref refusal from the established GDP verifier.
mr_core_offline() {
python3 - "$MR_REPO" "$MR_OUT" "$MR_PHASE" "$MR_REVISION" "$MR_VERSION" "$MR_US_REF" <<'PY'
import datetime,decimal,hashlib,importlib.util,json,pathlib,re,sys,urllib.parse
from jsonschema import Draft202012Validator
repo,out,phase,rev,version,reference=sys.argv[1:];repo=pathlib.Path(repo);out=pathlib.Path(out);cap=out/(phase+'-core')
spec=importlib.util.spec_from_file_location('mr_gdp_formats',repo/'scripts/verify-statcan-gdp-captures.py');helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
report_name='staged-preview-report.json' if phase=='staged' else 'report.json'
raw=(cap/report_name).read_bytes();report=json.loads(raw);assert report['pass'] is True
origins=['apex'] if phase=='staged' else ['apex','www'];manifest={'kind':'Byte-identical derivation from retained core files, not fresh HTTP','pass':False,'source_report':str(cap/report_name),'source_report_sha256':hashlib.sha256(raw).hexdigest(),'files':[]}
checks=[];source_status={}
try:
 for host in origins:
  origin='https://morningrows.com' if host=='apex' else 'https://www.morningrows.com'
  dest=out/(phase+'-'+host+'-capture');dest.mkdir()
  if phase=='staged':
   metadata=report['imported']+report['requests'];files=sorted(cap.glob('*.response'))
  else:
   metadata=report['requests'];files=sorted(cap.glob(host+'-*.body'))
  for source in files:
   if phase=='staged':
    name=source.name;matches=[x for x in metadata if x.get('file')==name or x.get('semantic_capture_file')==name]
    assert matches,'Unbound staged file '+name
    path=matches[0]['path'];assert all(x['path']==path for x in matches)
   else:
    path=urllib.parse.unquote(source.name[len(host)+1:-5]);name=path.replace('/','_')+'.response'
    matches=[x for x in metadata if x['origin']==origin and x['path']==path and x['method']=='GET' and x['status']!=304]
    assert matches,'Unbound production file '+source.name
   assert name==path.replace('/','_')+'.response' and '/' not in name and '\\' not in name
   data=source.read_bytes();digest=hashlib.sha256(data).hexdigest()
   for entry in matches:
    assert entry['headers'].get('x-source-revision')==rev and entry['headers'].get('x-worker-version')==version,'Wrong retained response identity'
    assert entry['bytes']==len(data),'Retained byte-length mismatch'
    if 'sha256' in entry:assert entry['sha256']==digest,'Retained hash mismatch'
   with (dest/name).open('xb') as f:f.write(data)
   assert (dest/name).read_bytes()==data
   manifest['files'].append({'host':host,'path':path,'source':str(source),'destination':str(dest/name),'bytes':len(data),'sha256':digest,'matched_original_records':len(matches)})
  def body(path):return json.loads((dest/(path.replace('/','_')+'.response')).read_bytes())
  health=body('/health.json');assert health['source_revision']==rev and health['worker_version']==version and health['source_dirty'] is False
  schemas={'v1':body('/schema.json'),'v2':body('/schema.v2.json')};validators={}
  for key,schema in schemas.items():
   helper.reject_remote_refs(schema);Draft202012Validator.check_schema(schema);validators[key]=Draft202012Validator(schema,format_checker=helper.FORMATS)
  desks=['australia','new-zealand','canada','united-kingdom','england','scotland','wales','northern-ireland','united-states']
  uspath='/united-states.json?source=cpi&measure=CUUR0000SA0'
  for path in ['/catalog.json','/catalog.v2.json',*['/'+d+'.json' for d in desks],uspath]:
   value=body(path);schema='v2' if path.startswith('/united-states') or path=='/catalog.v2.json' else 'v1';errors=list(validators[schema].iter_errors(value));assert not errors,(path,[e.message[:200] for e in errors[:2]])
   checks.append({'host':host,'path':path,'schema':schema,'pass':True})
   if path in ['/'+d+'.json' for d in desks]:source_status[host+path]={**value.get('sources',{}),**{'also.'+k:v for k,v in value.get('also',{}).get('sources',{}).items()}}
  refbytes=(repo/reference).read_bytes();ref=json.loads(refbytes);assert ref['pass'] is True
  slots={x['period']:x['value_text'] for x in ref['checks']};rows=body(uspath)['observations'];assert len(rows)==len(slots)==13 and {x['period'] for x in rows}==set(slots)
  for row in rows:
   expected=slots[row['period']]
   if expected is None:assert row['period']=='2025-10' and row['value'] is None and row['value_text']=='-' and row['value_state']=='unavailable' and row['footnotes']==[{'code':'X','text':'Data unavailable due to the 2025 lapse in appropriations'}]
   else:assert row['value_state']=='observed' and row['value_text']==expected and decimal.Decimal(str(row['value']))==decimal.Decimal(expected)
 manifest['pass']=True
 result={'kind':'Offline captured core schemas and independently extracted USA reference','pass':True,'schemas':checks,'schema_documents':len(checks),'us_reference_cells':13*len(origins),'us_reference_sha256':hashlib.sha256(refbytes).hexdigest(),'source_status':source_status}
except Exception as e:
 result={'kind':'Offline core derivation/schema/USA verification','pass':False,'error':str(e),'schemas':checks}
finally:
 with (out/(phase+'-core-derivation.json')).open('x') as f:json.dump(manifest,f,indent=2);f.write('\n')
 with (out/(phase+'-core-schemas-us.json')).open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({'pass':result['pass'],'derived_files':len(manifest['files']),'schemas':len(checks)}));sys.exit(not result['pass'])
PY
}
# The legacy capture already requests fresh full Scotland/Canada desks. This
# offline gate binds each new publisher byte acquisition to that exact request;
# it adds no HTTP and does not claim a separate per-source CPU measurement.
mr_remaining_cpu() {
python3 - "$MR_OUT/staged-legacy-cpu.json" "$MR_OUT/staged-remaining-source-cpu.json" "$MR_REVISION" "$MR_VERSION" <<'PY_REMAINING_CPU'
import datetime,hashlib,json,pathlib,re,sys
source,output,revision,version=sys.argv[1:];raw=pathlib.Path(source).read_bytes();report=json.loads(raw)
result={'kind':'Offline new-source freshness within actual full-desk CPU capture','pass':False,'input':source,'input_sha256':hashlib.sha256(raw).hexdigest(),'revision':revision,'version':version,'sources':[],'limitations':['CPU is the correlated full-desk sample, not a separately measured per-source cost.','One observed sample per desk; no percentile, sustained-operation or scheduled-acceptance claim.']}
def require(ok,label):
 if not ok:raise ValueError(label)
def time(value):
 parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));require(parsed.utcoffset()==datetime.timedelta(0),'UTC acquisition required');return parsed
try:
 require(report.get('budget_pass') is True and report.get('cold_retrieval_confirmed') is True,'Legacy CPU budget/freshness failed')
 require(report.get('version')==version and report.get('expected_source_revision')==revision,'Legacy report identity differs')
 for path,key,count,values in [('/scotland.json','college_activity',1,[39655,47405,4595,24400,116055]),('/canada.json','rental_benchmark',3,[2121,991])]:
  candidates=[c for c in report['checks'] if c.get('override') is True and c['path']==path]
  require(len(candidates)==1,'One exact full-desk CPU request required')
  c=candidates[0];require(c['status']==200 and c['headers'].get('x-source-revision')==revision and c['headers'].get('x-worker-version')==version,'Captured desk identity or status differs')
  start,end=time(c['started_at']),time(c['at']);native=c['body'].get(key);health=c['body'].get('sources',{}).get(key,{})
  require(native and health.get('status')=='ok' and start<=time(health['fetched_at'])<=end,'New source did not complete successfully in CPU interval')
  require([r['value'] for r in native['rows']]==values,'CPU body differs from pinned seven-cell release specimen')
  provenance=native.get('provenance');require(isinstance(provenance,list) and len(provenance)==count,'Missing original acquisition coverage')
  require(sorted(p.get('role','') for p in provenance)==(['workbook'] if count==1 else ['cube','data','series']),'Unexpected acquisition roles')
  for p in provenance:
   require(start<=time(p['retrieved_at'])<=time(health['fetched_at'])<=end,'Cached or future acquisition in cold CPU body')
   require(isinstance(p.get('bytes'),int) and p['bytes']>0 and isinstance(p.get('sha256'),str) and re.fullmatch('[a-f0-9]{64}',p['sha256']),'Missing acquisition digest/size')
  cpu=report['cpu_by_path'].get(path);require(isinstance(cpu,list) and len(cpu)==1 and isinstance(cpu[0],(float,int)) and 0<=cpu[0]<=500,'Missing bounded full-desk CPU sample')
  result['sources'].append({'source':key,'path':path,'full_desk_cpu_ms':cpu[0],'request_started_at':c['started_at'],'request_completed_at':c['at'],'health_completed_at':health['fetched_at'],'publisher_acquisitions':provenance,'pass':True})
 result['pass']=True
except (ValueError,KeyError,TypeError) as error:result['error']=str(error)
with pathlib.Path(output).open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({'pass':result['pass'],'sources':len(result['sources']),'error':result.get('error'),'output':output}));sys.exit(not result['pass'])
PY_REMAINING_CPU
}

mr_scope_preflight() {
  node --input-type=module - <<'JS_SCOPE'
import assert from 'node:assert/strict';
import {sources,routes,pinned} from './verification/gap-pass-2026-10-20/interface-checker/support.mjs';
assert.equal(sources.length,6);
assert.ok(sources.every(([,key])=>key!=='grid_day'));
assert.ok(!Object.hasOwn(pinned,'aemo'));
assert.equal(routes().length,40);
assert.deepEqual(routes().filter(r=>r.path.includes('grid_day')).map(r=>[r.path,r.status,r.error]),[['/australia.json?source=grid_day',404,'unknown_source']]);
JS_SCOPE
}

mr_stage_preflight() {
  if [[ -z ${MR_REMAINING_STAGED_ROOT:-} ]]; then printf '%s\n' 'Production requires MR_REMAINING_STAGED_ROOT from the successful staged invocation' >&2; return 2; fi
  MR_STAGE=$(realpath -- "$MR_REMAINING_STAGED_ROOT") || return
  python3 - "$MR_STAGE/summary.json" "$MR_REVISION" "$MR_VERSION" <<'PY_STAGE'
import json,sys
r=json.load(open(sys.argv[1]));assert r['pass'] is True and r['phase']=='staged' and r['revision']==sys.argv[2] and r['version']==sys.argv[3], 'Exact successful staged validation required'
PY_STAGE
}
mr_step active-contract-scope mr_scope_preflight
if [[ $MR_PHASE == production ]]; then mr_step exact-staged-prerequisite mr_stage_preflight; fi
if [[ $MR_PHASE == staged ]]; then
  # These must precede every other candidate desk request.
  mr_step usa-cold-cpu node scripts/verify-us-version-cpu.mjs "$MR_VERSION" "$MR_OUT/staged-us-cpu.json" 100
  mr_step legacy-cold-cpu node scripts/verify-legacy-version-cpu.mjs "$MR_VERSION" "$MR_OUT/staged-legacy-cpu.json" "$MR_REVISION"
  mr_step remaining-source-fresh-cpu mr_remaining_cpu
  mr_step claimant-www-cold-cpu node scripts/verify-claimant-repeat-cpu.mjs "$MR_VERSION" "$MR_OUT/staged-claimant-cpu.json" "$MR_REVISION"
  mr_step rent-www-cold-cpu node scripts/verify-rent-source-cpu.mjs "$MR_VERSION" "$MR_OUT/staged-rent-cpu.json" "$MR_REVISION"
  mr_step baseline-preserved-through-cpu mr_baseline_unchanged
  mr_step core-capture node scripts/verify-staged-preview.mjs "$MR_OUT/staged-us-cpu.json" "$MR_OUT/staged-legacy-cpu.json" "$MR_OUT/staged-core" "$MR_VERSION" "$MR_REVISION"
  MR_MODE=(staged);MR_DOMAINS=apex
else
  mr_step core-capture env INFORMATION_REPORT_DIR="$MR_OUT/production-core" CHECK_US=1 node scripts/check-information.mjs
  MR_MODE=();MR_DOMAINS=both
fi
mr_step core-offline-derivation-schema-us mr_core_offline
MR_HOSTS=(apex)
if [[ $MR_PHASE == production ]]; then MR_HOSTS+=(www); fi
for MR_HOST in "${MR_HOSTS[@]}"; do
  mr_step "core-semantics-$MR_HOST" python3 /tmp/mr-gap-core-semantic-gate.py "$MR_OUT/$MR_PHASE-$MR_HOST-capture" "$MR_OUT/$MR_PHASE-$MR_HOST-semantic.json"
  mr_step "statsnz-independent-$MR_HOST" python3 scripts/verify-gap-statsnz.py "$MR_OUT/$MR_PHASE-$MR_HOST-capture/_new-zealand.json.response" "$MR_OUT/$MR_PHASE-statsnz-$MR_HOST.json"
done
if [[ $MR_PHASE == production ]]; then
  mr_step core-production-reference-health python3 /tmp/mr-gap-production-health-gate.py "$MR_OUT/production-core" "$MR_US_REF" "$MR_OUT/production-core-validation.json" "$MR_STAGE/staged-apex-semantic-release-gate.json" "$MR_STAGE/staged-apex-semantic.json"
fi
mr_step gdp-capture node scripts/check-statcan-gdp.mjs "$MR_OUT/$MR_PHASE-gdp" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
mr_step gdp-offline python3 scripts/verify-statcan-gdp-captures.py "$MR_OUT/$MR_PHASE-gdp" "$MR_GDP_REF" "$MR_OUT/$MR_PHASE-gdp-validation.json" --expected-revision "$MR_REVISION" --expected-version "$MR_VERSION" --domains "$MR_DOMAINS"
mr_step claimant-capture env CLAIMANT_REFERENCE="$MR_CLAIM_REF" node scripts/check-claimants.mjs "$MR_OUT/$MR_PHASE-claimants" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
mr_step claimant-independent node scripts/verify-claimant-captures.mjs "$MR_OUT/$MR_PHASE-claimants" "$MR_CLAIM_REF" "$MR_OUT/$MR_PHASE-claimant-validation.json" --require-selectors
mr_step claimant-schemas python3 scripts/verify-claimant-schemas.py "$MR_OUT/$MR_PHASE-claimants" "$MR_OUT/$MR_PHASE-claimant-schemas.json" --schema-capture "$MR_OUT/$MR_PHASE-core" --expected-revision "$MR_REVISION" --expected-version "$MR_VERSION"
mr_step rent-capture node scripts/check-market-rent.mjs "$MR_OUT/$MR_PHASE-rent" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
mr_step rent-offline python3 scripts/verify-rent-captures.py "$MR_OUT/$MR_PHASE-rent" "$MR_RENT_REF" "$MR_OUT/$MR_PHASE-rent-validation.json" --expected-revision "$MR_REVISION" --expected-version "$MR_VERSION" --domains "$MR_DOMAINS"
mr_step gap-capture node scripts/check-gap-pass.mjs "$MR_OUT/$MR_PHASE-gap" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
mr_step gap-independent node "$MR_CHECKER/verify-captures.mjs" "$MR_OUT/$MR_PHASE-gap" "$MR_OUT/$MR_PHASE-gap-validation.json" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
mr_step gap-schemas python3 "$MR_CHECKER/verify-schemas.py" "$MR_OUT/$MR_PHASE-gap" "$MR_OUT/$MR_PHASE-gap-schemas.json" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
mr_step remaining-capture node scripts/check-remaining-gaps.mjs "$MR_OUT/$MR_PHASE-remaining" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
mr_step remaining-independent node "$MR_REMAINING_CHECKER/verify-captures.mjs" "$MR_OUT/$MR_PHASE-remaining" "$MR_OUT/$MR_PHASE-remaining-validation.json" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
mr_step remaining-schemas python3 "$MR_REMAINING_CHECKER/verify-schemas.py" "$MR_OUT/$MR_PHASE-remaining" "$MR_OUT/$MR_PHASE-remaining-schemas.json" "$MR_REVISION" "$MR_VERSION" "${MR_MODE[@]}"
MR_STEP=complete
