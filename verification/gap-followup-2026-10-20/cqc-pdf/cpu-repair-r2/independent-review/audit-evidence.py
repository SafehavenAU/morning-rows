from pathlib import Path
import json,hashlib,statistics,math,subprocess,datetime
root=Path('/workspace/morning-rows-cqc-cpu-r2');p=root/'verification/gap-followup-2026-10-20/cqc-pdf/cpu-repair-r2';out=Path('/tmp/mr-cqc-r2-independent-review')
sha=lambda b:hashlib.sha256(b).hexdigest();mbytes=(p/'manifest.json').read_bytes();assert sha(mbytes)=='56b78987e46b0f0e893c547f0084e74737fd0bc3499fcfa59016eed930f72c5d';m=json.loads(mbytes)
checks=[]
for entry in m['copy_files']:
 b=(root/entry['path']).read_bytes();assert len(b)==entry['bytes'] and sha(b)==entry['sha256'],entry['path'];checks.append({'path':entry['path'],'sha256':sha(b),'pass':True})
assert len(checks)==51
for name,copy in [('manifest.json','author-manifest-reviewed.json'),('README.md','author-README-reviewed.md'),('local-comparison.json','author-local-comparison-reviewed.json')]:
 (out/copy).write_bytes((p/name).read_bytes())
comparison=json.loads((p/'local-comparison.json').read_text());medians=[]
def same(a,b): assert math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-10),(a,b)
for name,c in comparison['warm'].items():
 d=json.loads((p/'profiles'/name).read_text());s=d['samples'];assert len(s)==c['count'];assert d['module_sha256']==c['module_sha256'];assert d['native_sha256']==comparison['native_sha256'];assert d['input_sha256']==comparison['input_sha256'];same(s[0]['wall_ms'],c['first_wall_ms']);same(statistics.median(x['wall_ms'] for x in s[1:]),c['median_following_wall_ms']);same(statistics.median(x['user_cpu_ms']+x['system_cpu_ms'] for x in s[1:]),c['median_following_process_cpu_ms']);medians.append({'file':name,'kind':'following parse median','pass':True})
for name,c in comparison['cold'].items():
 d=json.loads((p/'profiles'/name).read_text())
 for variant,wanted in c.items():
  records=[x for x in d['results'] if x['module_sha256']==wanted['module_sha256']];s=[x['samples'][0] for x in records];assert len(s)==wanted['count'];assert all(x['module_sha256']==wanted['module_sha256'] and x['native_sha256']==comparison['native_sha256'] and x['input_sha256']==comparison['input_sha256'] for x in records);same(statistics.median(x['wall_ms'] for x in s),wanted['median_wall_ms']);same(statistics.median(x['user_cpu_ms']+x['system_cpu_ms'] for x in s),wanted['median_process_cpu_ms']);same(min(x['wall_ms'] for x in s),wanted['minimum_wall_ms']);same(max(x['wall_ms'] for x in s),wanted['maximum_wall_ms'])
 medians.append({'file':name,'kind':'first parse of each fresh process','pass':True})
base=subprocess.check_output(['git','show','79e251cab4314c328e84d9ac4ca7bf5e5408bdbb:lib/cqc-pdf.js'],cwd=root);assert base==(p/'prior-reader.js.source').read_bytes()
base_tests=subprocess.check_output(['git','show','79e251cab4314c328e84d9ac4ca7bf5e5408bdbb:test/cqc-pdf.test.js'],cwd=root);assert base_tests==(p/'prior-reader-tests.js.source').read_bytes()
source=(root/'lib/cqc-pdf.js').read_text();without=source.replace('  // Replay the original token-budget check and position after the depth check;\n  // an array\'s already-read token needs no second byte decoding in this same call.\n','');assert without==(p/'adler-array-trial.js.source').read_text()
for name,n in [('focused-tests-77.tap',77),('worker-tests-2.tap',2)]:
 t=(p/name).read_text();assert f'ℹ tests {n}\n' in t and f'ℹ pass {n}\n' in t and 'ℹ fail 0\n' in t and 'ℹ skipped 0\n' in t
report={'pass':True,'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'author_manifest_sha256':sha(mbytes),'bindings':checks,'binding_count':len(checks),'median_reconciliations':medians,'prior_reader_and_test_snapshots_match_git':True,'selected_final_diff_from_trial_is_only_two_comments':True,'author_focused_logs_report':{'passed':79,'failed':0,'skipped':0,'independently_rerun_here':False},'cold_candidate_outlier_retained_ms':comparison['cold']['mr-cqc-r2-selected-fresh-process-comparison.json']['after']['maximum_wall_ms'],'selected_cold_comparison':comparison['cold']['mr-cqc-r2-selected-fresh-process-comparison.json'],'limitations':comparison['limitations'],'no_http':True,'no_repository_writes':True,'cpu_acceptance':False}
(out/'evidence-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'pass':True,'bindings':len(checks),'timing_summaries_recomputed':len(medians),'prior_snapshots_match':True,'cpu_acceptance':False}))
