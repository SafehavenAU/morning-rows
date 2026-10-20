from pathlib import Path
import json,hashlib,datetime,re
P=Path('/tmp/mr-cqc-r2-staged-continuation-v3');O=Path('/tmp/mr-cqc-continuation-v3-actual-independent-review');R=Path('/workspace/morning-rows-aemo-followup');T=Path('/tmp/mr-dated-release-review/cqc-continuation-v3/runner')
sha=lambda b:hashlib.sha256(b).hexdigest()
count=lambda x:len(x)if isinstance(x,list)else x
def j(p):return json.loads(p.read_bytes())
def t(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
summary_bytes=(P/'summary.json').read_bytes();assert sha(summary_bytes)=='3d176b00836c5c15213b7ba4b7452accdebf85d352ded3190568ce00768ebad7';s=json.loads(summary_bytes)
assert s['pass'] is True and s['phase']=='staged' and s['exit_code']==0 and s['last_step']=='complete'
assert s['revision']=='7d7ed892c469d6f589dabf52283fc31dfef98d8a' and s['version']=='16e5a892-be54-4381-a9c3-98ae4e47a309'
assert s['semantic_exceptions_allowed'] is False and s['uninterrupted'] is False and s['original_attempt_pass'] is False
assert (s['imported_gate_count'],s['fresh_gate_count'],s['previous_failed_attempt_count'])==(6,27,2)
physical=sorted(str(p.relative_to(P))for p in P.rglob('*')if p.is_file() and p!=P/'summary.json');assert physical==sorted(x['file']for x in s['files'])
for x in s['files']:
 p=P/x['file'];assert not p.is_symlink();b=p.read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['file']
tool=Path('/tmp/mr-cqc-final-toolchain-v3.json');tb=tool.read_bytes();assert sha(tb)=='f67f446d3b42cc19f69ee5ca441c8a29e9ff1857d154b11880638db783085183';toolchain=json.loads(tb)
for x in toolchain['files'].values():
 b=Path(x['file']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
c=j(P/'continuation.json');assert t(toolchain['frozen_at'])<t(c['prepared_at'])<t(s['finished_at'])
chain=j(T/'chain-manifest.json')
for a in chain['original_attempts']:
 root=Path(a['root']);copy=P/('prior-failed-attempt-'+a['label']);assert j(root/'summary.json')['pass'] is False
 assert sorted(str(p.relative_to(copy))for p in copy.rglob('*')if p.is_file())==sorted(x['file']for x in a['files'])
 for x in a['files']:assert (root/x['file']).read_bytes()==(copy/x['file']).read_bytes() and sha((copy/x['file']).read_bytes())==x['sha256']
steps=[json.loads(x)for x in(P/'steps.jsonl').read_text().splitlines()];assert s['steps']==steps and len(steps)==33 and [x['step']for x in steps]==j(T/'step-plan.json')['steps']['staged'];assert all(x['pass'] is True and x['exit_code']==0 for x in steps)
for i,x in enumerate(steps):
 if i<6:
  source=chain['original_attempts'][i==5];old=j(Path(source['root'])/'summary.json')['steps'][i];assert x['finished_at']==old['finished_at'] and x['provenance']['source_attempt']==source['label'] and x['provenance']['original_summary_sha256']==source['summary_sha256']
 else:assert x['provenance']=={'kind':'fresh_continuation_gate','continuation_id':c['kind']} and t(x['finished_at'])>=t(c['prepared_at'])
audit=j(P/'release-gate-audit.json');assert audit['pass'] is True and audit['semantic_exceptions_allowed'] is False and audit['completed_steps_before_audit']==32 and audit['build_fingerprint']=='56c41341c2b38c38'
for x in audit['inputs']:
 b=(P/x['file']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
sem=j(P/'staged-apex-semantic.json');assert sem['pass'] is True and len(sem['checks'])==50 and all(x['pass'] is True for x in sem['checks']) and sem['source_status']['scotland']['river_level']['status']=='ok'
stats=j(P/'staged-statsnz-apex.json');assert stats['passed'] is True and stats['independent_reference_count']==15 and stats['exact_numeric_comparisons']==15 and len(stats['unverified_numeric_ids'])==8
for k in ['all_23_numeric_acceptance','undisplayed_flags_accepted','future_vintages_approved','scheduled_or_release_acceptance']:assert stats[k] is False
expected={'gdp':{'transport':19,'native_comparisons':3,'selected_comparisons':11,'schema_checks':9,'schema_negative_controls':18}}
assert j(P/'staged-gdp-validation.json')['counts']==expected['gdp']
claim=j(P/'staged-claimant-validation.json');assert claim['pass'] is True and claim['native_cells_compared']==65 and count(claim['selectors'])==20 and count(claim['negative_responses'])==15
cs=j(P/'staged-claimant-schemas.json');assert cs['pass'] is True and count(cs['schema_checks'])==25 and count(cs['negative_contracts'])==185
rent=j(P/'staged-rent-validation.json');assert rent['pass'] is True and rent['counts']['native_numeric_cells']==116 and rent['counts']['schema_documents']==21 and rent['counts']['schema_negative_controls']==24
for key,manifest,routes,schemas,neg,refs in [('gap','gap-interface-report.json',39,24,8,{'boc':38,'statcan':14,'wra':4}),('remaining','remaining-interface-report.json',22,10,8,{'sfc':5,'cmhc':2}),('ni-energy','ni-energy-interface-report.json',23,13,8,{'ni_electricity':5}),('cqc-pdf','cqc-pdf-interface-report.json',23,13,10,{'cqc_ratings':5})]:
 capture=j(P/('staged-'+key)/manifest);validation=j(P/('staged-'+key+'-validation.json'));schema=j(P/('staged-'+key+'-schemas.json'))
 assert capture['pass'] is True and capture['staged'] is True and capture['revision']==s['revision'] and capture['version']==s['version'] and len(capture['requests'])==routes
 assert validation['pass'] is True and validation.get('independent_cells',validation.get('independent_cells_per_domain'))==refs
 assert schema['pass'] is True and count(schema['schema_checks'])==schemas and count(schema['negative_controls'])==neg
held=j(P/'staged-held-aemo-refusal.json');assert held['pass'] is True and held['source_activated'] is False and held['source_contract_accepted'] is False and held['original_grid_snapshot_preserved'] is True and len(held['requests'])==3
# Every fresh request has exact candidate headers, retained body bytes and post-preparation chronology.
imported={x['file']for x in c['copied_prefix_files']};fresh_requests=0;retained_bodies=0;references=0
for x in s['files']:
 if not x['file'].endswith('.json') or x['file'].startswith('prior-failed-attempt-') or x['file'] in imported:continue
 p=P/x['file'];doc=j(p)
 for row in doc.get('requests',[]):
  assert t(c['prepared_at'])<=t(row['started_at'])<=t(row.get('completed_at',row.get('at')))<=t(s['finished_at']),x['file'];fresh_requests+=1
  assert row['headers']['x-source-revision']==s['revision'] and row['headers']['x-worker-version']==s['version']
  if row.get('file'):
   b=(p.parent/row['file']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'];retained_bodies+=1
  else:assert row['bytes']==0 and row['sha256']==sha(b'') and (row.get('method')=='HEAD' or row.get('conditional') is True)
 for row in doc.get('references',[]):
  b=(R/row['file']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'];references+=1
r=j(P/'staged-rent-cpu.json');assert r['budget_pass'] is True and r['startup_wait_ms']==20000 and r['cpu_limit_ms']==500 and not r.get('error')
target=[x for x in r['checks']if x['override']];assert [x['path']for x in target]==['/health.json','/new-zealand.json?source=market_rent'] and len(r['events'])==2
assert t(target[0]['started_at'])-max(t(x['at'])for x in r['checks']if x['phase']=='before')>=20
for x in target:
 assert x['status']==200 and x['headers']['x-worker-version']==s['version'] and x['headers']['x-source-revision']==s['revision']
 matches=[e for e in r['events']if e['request_path']==x['path'] and e['script_version']['id']==s['version'] and t(x['started_at'])*1000-1000<=e['event_timestamp']<=t(x['at'])*1000];assert len(matches)==1 and matches[0]['outcome']=='ok' and not matches[0]['exception_names'] and 0<=matches[0]['cpu_ms']<=500
assert r['cpu_by_path']['/new-zealand.json?source=market_rent']==[225]
rent_capture=target[1];body=rent_capture['body'];assert len(body['data'])==29 and len(body['observations'])==116
prov=body['context']['provenance'];assert len(prov)==2 and len({x['location_id']for x in prov})==2
for x in prov:assert t(rent_capture['started_at'])<=t(x['retrieved_at'])<=t(body['retrieval']['retrieved_at'])<=t(rent_capture['at']) and re.fullmatch('[a-f0-9]{64}',x['sha256']) and 0<x['bytes']<=131072
for phase in ['before','after']:
 for origin in ['https://morningrows.com','https://www.morningrows.com']:
  old=[x for x in r['checks']if not x['override'] and x['phase']==phase and x['origin']==origin];assert len(old)==1 and old[0]['body']['worker_version']=='34d6966c-0c3f-40dd-8b61-b4a696b09b89' and old[0]['body']['source_revision']=='8a25fb62bad7096421ac17f6974b3aa421fe37c3'
assert r['deployment_before']==r['deployment_after'] and r['deployment_after']['id']=='01e386af-a142-4a33-b4fb-3c1fd467a28b'
assert {x['version_id']:x['percentage']for x in r['deployment_after']['versions']}=={'34d6966c-0c3f-40dd-8b61-b4a696b09b89':100,s['version']:0}
result={'pass':True,'kind':'Independent offline review of actual staged v3 continuation; production acceptance pending','summary_sha256':sha(summary_bytes),'source_revision':s['revision'],'worker_version':s['version'],'build_fingerprint':'56c41341c2b38c38','logical_gates':33,'imported_gates':6,'fresh_gates':27,'attempts':3,'prior_failed_attempts':2,'uninterrupted':False,'bound_stage_files':len(s['files']),'toolchain_bindings':len(toolchain['files']),'fresh_request_records_checked':fresh_requests,'retained_request_bodies_checked':retained_bodies,'reference_bindings_checked':references,'strict_core_checks':50,'stats_nz_exact_references':15,'stats_nz_unresolved':8,'new_cqc_unique_reference_cells':5,'rent_cpu_ms':225,'rent_startup_wait_ms':20000,'rent_rows':29,'rent_selected_observations':116,'rent_publisher_provenance':prov,'NI_production_unchanged_during_stage':True,'AEMO_daily_held':True,'stage_finished_at':s['finished_at'],'limitations':['Staged candidate only; both-domain production validation and release acceptance remain separate.','33 logical gates combine six preserved successes and27 fresh gates across three actual attempts. Both earlier attempts remain failed.','Original794ms and636ms CPU failures remain failed historical evidence.','The longer startup allowance does not establish the cause of either earlier readiness failure.','No scheduled observation, delivery acknowledgment or broader operational acceptance is established.'],'network_calls_by_reviewer':0,'repository_written':False}
(O/'review.json').write_text(json.dumps(result,indent=2)+'\n');(O/'actual-summary.json.source').write_bytes(summary_bytes);(O/'toolchain.json.source').write_bytes(tb)
print(json.dumps({k:result[k]for k in ['pass','logical_gates','bound_stage_files','fresh_request_records_checked','rent_cpu_ms']}))
