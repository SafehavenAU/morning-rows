from pathlib import Path
import json,hashlib,datetime,collections
P=Path('/tmp/mr-cqc-r2-production-r1');O=Path('/tmp/mr-cqc-production-independent-review');R=Path('/workspace/morning-rows-aemo-followup');T=Path('/tmp/mr-dated-release-review/cqc-continuation-v3/runner')
sha=lambda b:hashlib.sha256(b).hexdigest()
count=lambda x:len(x)if isinstance(x,list)else x
def j(p):return json.loads(p.read_bytes())
def t(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
raw=(P/'summary.json').read_bytes();assert sha(raw)=='543ef414ba2b2b1573c6759a488dd70d9b0da1d66b0d23ed306a9cb817a20b90';s=json.loads(raw)
revision='7d7ed892c469d6f589dabf52283fc31dfef98d8a';version='16e5a892-be54-4381-a9c3-98ae4e47a309';fp='56c41341c2b38c38'
assert s['pass'] is True and s['phase']=='production' and s['exit_code']==0 and s['last_step']=='complete' and s['revision']==revision and s['version']==version and s['semantic_exceptions_allowed'] is False
assert sorted(str(p.relative_to(P))for p in P.rglob('*')if p.is_file()and p!=P/'summary.json')==sorted(x['file']for x in s['files'])
for x in s['files']:
 p=P/x['file'];assert not p.is_symlink();b=p.read_bytes();assert len(b)==x['bytes']and sha(b)==x['sha256'],x['file']
tool=Path('/tmp/mr-cqc-final-toolchain-v3.json');tb=tool.read_bytes();assert sha(tb)=='f67f446d3b42cc19f69ee5ca441c8a29e9ff1857d154b11880638db783085183';tools=json.loads(tb)
for x in tools['files'].values():
 b=Path(x['file']).read_bytes();assert len(b)==x['bytes']and sha(b)==x['sha256']
promo=j(Path('/tmp/mr-cqc-r2-promotion-exact.json'));assert promo['id']=='4bd01fb3-c03d-4d7b-9533-919fdd434550'and promo['versions']==[{'version_id':version,'percentage':100}];assert sha(Path('/tmp/mr-cqc-r2-promoted-deployments.json').read_bytes())==promo['original_list_sha256']
steps=[json.loads(x)for x in(P/'steps.jsonl').read_text().splitlines()];assert s['steps']==steps and len(steps)==33 and[x['step']for x in steps]==j(T/'step-plan.json')['steps']['production'];assert all(x['pass']is True and x['exit_code']==0 for x in steps)
assert all(t(x['finished_at'])>=t(promo['created_on'])for x in steps)
audit=j(P/'release-gate-audit.json');assert audit['pass']is True and audit['phase']=='production'and audit['completed_steps_before_audit']==32 and audit['semantic_exceptions_allowed']is False and audit['build_fingerprint']==fp
for x in audit['inputs']:
 b=(P/x['file']).read_bytes();assert len(b)==x['bytes']and sha(b)==x['sha256']
def identity(x):assert x['source_revision']==revision and x['worker_version']==version and x['build_fingerprint']==fp and x['source_dirty']is False
for host,smokes in [('apex',18),('www',17)]:
 sem=j(P/('production-'+host+'-semantic.json'));assert sem['pass']is True and len(sem['checks'])==50 and all(x['pass']is True for x in sem['checks']);identity(sem['identity']);assert sem['source_status']['scotland']['river_level']['status']=='ok'
 stats=j(P/('production-statsnz-'+host+'.json'));assert stats['passed']is True and stats['independent_reference_count']==15 and stats['exact_numeric_comparisons']==15 and len(stats['unverified_numeric_ids'])==8
 for k in ['all_23_numeric_acceptance','undisplayed_flags_accepted','future_vintages_approved','scheduled_or_release_acceptance']:assert stats[k]is False
 smoke=j(P/('production-smoke-'+host+'.json'));assert len(smoke['checks'])==smokes and all(x['status']=='pass'for x in smoke['checks']);identity(smoke['identity'])
core=j(P/'production-core/report.json');assert core['pass']is True and len(core['requests'])==104 and len(core['checks'])==151
schema=j(P/'production-core-schemas-us.json');assert schema['pass']is True and count(schema['schema_documents'])==24 and count(schema['us_reference_cells'])==26
gdp=j(P/'production-gdp-validation.json');assert gdp['pass']is True and gdp['counts']=={'transport':38,'native_comparisons':6,'selected_comparisons':22,'schema_checks':18,'schema_negative_controls':36}
claim=j(P/'production-claimant-validation.json');assert claim['pass']is True and claim['native_cells_compared']==130 and count(claim['selectors'])==40 and count(claim['negative_responses'])==30
cs=j(P/'production-claimant-schemas.json');assert cs['pass']is True and count(cs['schema_checks'])==50 and count(cs['negative_contracts'])==370
rent=j(P/'production-rent-validation.json');assert rent['pass']is True and rent['counts']['native_numeric_cells']==232 and rent['counts']['schema_documents']==42 and rent['counts']['schema_negative_controls']==48
contracts={}
for key,manifest,routes,docs,neg,refs in [('gap','gap-interface-report.json',78,48,16,{'boc':38,'statcan':14,'wra':4}),('remaining','remaining-interface-report.json',44,20,16,{'sfc':5,'cmhc':2}),('ni-energy','ni-energy-interface-report.json',46,26,16,{'ni_electricity':5}),('cqc-pdf','cqc-pdf-interface-report.json',46,26,20,{'cqc_ratings':5})]:
 capture=j(P/('production-'+key)/manifest);validation=j(P/('production-'+key+'-validation.json'));schema=j(P/('production-'+key+'-schemas.json'))
 assert capture['pass']is True and capture['staged']is False and capture['revision']==revision and capture['version']==version and len(capture['requests'])==routes
 assert validation['pass']is True and validation.get('independent_cells',validation.get('independent_cells_per_domain'))==refs
 assert schema['pass']is True and count(schema['schema_checks'])==docs and count(schema['negative_controls'])==neg
 contracts[key]={'requests':routes,'offline_checks':count(validation.get('checks',[])),'schemas':docs,'negative_controls':neg,'independent_reference_cells':refs}
held=j(P/'production-held-aemo-refusal.json');assert held['pass']is True and held['source_activated']is False and held['source_contract_accepted']is False and held['original_grid_snapshot_preserved']is True and len(held['requests'])==6
comparison=j(P/'production-core-validation.json');assert comparison['pass']is True and comparison['semantic_exceptions_allowed']is False;identity(comparison['identity']);changes=[];classified=0
for host,cmp in comparison['source_comparison'].items():
 assert cmp['compared_source_states']==120 and len(cmp['states'])==120 and not cmp['requires_review'];classified+=len(cmp['changes'])
 for x in cmp['states']:
  a={k:v for k,v in x['staged'].items()if k!='fetched_at'};b={k:v for k,v in x['production'].items()if k!='fetched_at'}
  if a!=b:
   assert x['classification']in ['known_intermittent_TfL_429','known_ONS_403_429_availability_change'];changes.append({'host':host,'desk':x['desk'],'source':x['source'],'classification':x['classification'],'before':a,'after':b})
assert len(changes)==7 and classified==9
fresh=0;bodies=0;refs=0;core_without_per_request_timestamps=0
for x in s['files']:
 if not x['file'].endswith('.json'):continue
 p=P/x['file'];doc=j(p)
 for row in doc.get('requests',[])if isinstance(doc.get('requests',[]),list)else []:
  if x['file']=='production-core/report.json':
   assert 'started_at'not in row and row['headers']['x-source-revision']==revision and row['headers']['x-worker-version']==version;core_without_per_request_timestamps+=1;continue
  assert t(promo['created_on'])<=t(row['started_at'])<=t(row.get('completed_at',row.get('at')))<=t(s['finished_at']),x['file'];fresh+=1
  assert row['headers']['x-source-revision']==revision and row['headers']['x-worker-version']==version
  if row.get('file'):
   b=(p.parent/row['file']).read_bytes();assert len(b)==row['bytes']and sha(b)==row['sha256'];bodies+=1
  else:assert row['bytes']==0 and row['sha256']==sha(b'')and(row.get('method')=='HEAD'or row.get('conditional')is True)
 for row in doc.get('references',[]):
  b=(R/row['file']).read_bytes();assert len(b)==row['bytes']and sha(b)==row['sha256'];refs+=1
cqc=j(P/'production-cqc-pdf/cqc-pdf-interface-report.json');native=[]
for q in cqc['requests']:
 if q['path']=='/england.json':
  n=j(P/'production-cqc-pdf'/q['file'])['care_assessment_cohort'];assert n['status']=='ok'and n['geography']=='England'and n['period']=='2025-08-01'and n['edition_bytes']==7175967 and n['edition_sha256']=='61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef'
  assert[x['value']for x in n['rows']]==[125,809,2063,65,3062];native.append({'origin':q['origin'],'edition_sha256':n['edition_sha256'],'values':[x['value']for x in n['rows']]})
assert len(native)==2
runlist=j(Path('/tmp/mr-cqc-r2-main-runs-postpromotion.json'));monitor=[x for x in runlist['workflow_runs']if x['head_branch']=='main'and x['path']=='.github/workflows/monitor.yml'];latest=max(monitor,key=lambda x:(x['run_number'],x['run_attempt']));assert latest['id']==39341442350 and latest['run_number']==10 and latest['run_attempt']==1
result={'pass':True,'kind':'Independent actual production evidence review; final packaging and operational acceptance separate','summary_sha256':sha(raw),'source_revision':revision,'worker_version':version,'build_fingerprint':fp,'promotion':promo,'completed_at':s['finished_at'],'production_gates':33,'bound_production_files':len(s['files']),'toolchain_bindings':len(tools['files']),'fresh_request_records_checked':fresh,'core_requests_without_individual_timestamps':core_without_per_request_timestamps,'request_bodies_checked':bodies,'reference_bindings_checked':refs,'core_assertions':151,'core_requests':104,'strict_semantics':100,'core_schemas':24,'BLS_slots':26,'StatsNZ_unique_dated_references':15,'StatsNZ_domain_comparisons':30,'StatsNZ_unresolved':8,'full_smokes':{'apex':18,'www':17},'contracts':contracts,'CQC_native_comparisons':native,'source_states_compared':240,'source_change_entries_classified':classified,'actual_source_state_changes':changes,'unexplained_changes':0,'latest_actual_monitor_run':{'id':latest['id'],'run_number':10,'run_attempt':1},'limitations':['Both previous staged readiness failures and794/636ms resource failures remain failed; production pass does not relabel them.','Five unique CQC source cells produce ten native domain comparisons; aggregate offline checks are not unique observations.','Source comparison lists nine classified entries; seven actual state changes exclude two unchanged TfL429 entries.','No new scheduled collection, delivery acknowledgment, monitoring recovery or sustained operational acceptance is established.','The104 legacy core request records contain identity headers but no individual timestamps; core files remain bound by summary, derivation and actual gate results.','Final accepted evidence still requires packaging and exact committed-tree audit.'],'network_calls_by_reviewer':0,'repository_written':False}
(O/'review.json').write_text(json.dumps(result,indent=2)+'\n');(O/'actual-summary.json.source').write_bytes(raw);(O/'promotion.json.source').write_bytes(Path('/tmp/mr-cqc-r2-promotion-exact.json').read_bytes());(O/'toolchain.json.source').write_bytes(tb)
print(json.dumps({k:result[k]for k in ['pass','production_gates','bound_production_files','fresh_request_records_checked','request_bodies_checked','reference_bindings_checked','unexplained_changes']}))
