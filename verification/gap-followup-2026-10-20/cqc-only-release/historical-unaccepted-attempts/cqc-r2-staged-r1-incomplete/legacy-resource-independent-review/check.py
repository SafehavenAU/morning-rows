from pathlib import Path
import json,hashlib,datetime,subprocess
p=Path('/tmp/mr-cqc-r2-staged-r1/staged-legacy-cpu.json');raw=p.read_bytes();x=json.loads(raw);out=Path('/tmp/mr-cqc-r2-staged-independent-review');sha=lambda b:hashlib.sha256(b).hexdigest();time=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000
candidate={'source_revision':'7d7ed892c469d6f589dabf52283fc31dfef98d8a','source_dirty':False,'build_fingerprint':'56c41341c2b38c38','worker_version':'16e5a892-be54-4381-a9c3-98ae4e47a309'}
production={'source_revision':'8a25fb62bad7096421ac17f6974b3aa421fe37c3','source_dirty':False,'build_fingerprint':'6a29c7f49e8e2ef3','worker_version':'34d6966c-0c3f-40dd-8b61-b4a696b09b89'}
assert x['version']==candidate['worker_version'] and x['expected_source_revision']==candidate['source_revision'] and x['cpu_limit_ms']==500
module=subprocess.check_output(['git','show',candidate['source_revision']+':lib/cqc-pdf.js'],cwd='/workspace/morning-rows-aemo-followup');assert sha(module)=='f161ab460d0e489345edcd38c9bbe5c36b1a09990e5b53494a837f48931e27a9'
ph=[c for c in x['checks'] if c['path']=='/health.json' and not c['override']];assert len(ph)==4
assert {(c['origin'],c['phase']) for c in ph}=={(origin,phase) for origin in ['https://morningrows.com','https://www.morningrows.com'] for phase in ['before','after']}
for c in ph:
 assert c['status']==200 and c['json_valid'] and all(c['body'][k]==v for k,v in production.items())
 assert c['headers']['x-source-revision']==production['source_revision'] and c['headers']['x-worker-version']==production['worker_version']
assert x['deployment_before']==x['deployment_after'];deployment=x['deployment_before'];percent={v['version_id']:v['percentage'] for v in deployment['versions']};assert percent=={production['worker_version']:100,candidate['worker_version']:0}
checks=[c for c in x['checks'] if c['override']];assert len(checks)==9
paths={'/health.json','/australia.json','/new-zealand.json','/canada.json','/united-kingdom.json','/england.json','/scotland.json','/wales.json','/northern-ireland.json'};assert {c['path'] for c in checks}==paths
assert len(x['events'])==9;correlations=[]
for c in checks:
 assert c['status']==200 and c['json_valid'] and c['headers']['x-source-revision']==candidate['source_revision'] and c['headers']['x-worker-version']==candidate['worker_version']
 events=[e for e in x['events'] if e['request_path']==c['path'] and e['script_version']['id']==candidate['worker_version'] and time(c['started_at'])-1000<=e['event_timestamp']<=time(c['at'])];assert len(events)==1;cputrace=events[0];assert cputrace['outcome']=='ok' and cputrace['exception_names']==[] and 0<=cputrace['cpu_ms']<=500
 if c['path']=='/health.json':assert all(c['body'][k]==v for k,v in candidate.items())
 sources=[]
 for name,s in c['body'].get('sources',{}).items():
  if isinstance(s,dict) and s.get('fetched_at'):
   assert time(c['started_at'])-1000<=time(s['fetched_at'])<=time(c['at']);sources.append(name)
 correlations.append({'path':c['path'],'started_at':c['started_at'],'response_at':c['at'],'trace':cputrace,'source_timestamps_rechecked':len(sources)})
england=next(c for c in checks if c['path']=='/england.json');native=england['body']['care_assessment_cohort'];source=england['body']['sources']['care_assessment_cohort'];assert native['status']=='ok' and source['status']=='ok';assert [r['value'] for r in native['rows']]==[125,809,2063,65,3062];assert len(native['provenance'])==1;pdf=native['provenance'][0];assert pdf['role']=='original_pdf' and pdf['bytes']==7175967 and pdf['sha256']=='61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef';assert pdf['url']=='https://assets.publishing.service.gov.uk/media/68fa3b4fe200d653d8b63735/care-quality-commission-state-of-health-care-and-adult-social-care-England-2024-2025.pdf';assert time(england['started_at'])<=time(pdf['retrieved_at'])<=time(source['fetched_at'])<=time(england['at'])
assert x['budget_pass'] is True and x['deployment_unchanged'] is True
assert p.read_bytes()==raw
review={'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'review_pass':True,'legacy_resource_gate_pass':True,'release_accepted':False,'all_33_staged_gates_claimed':False,'capture_sha256':sha(raw),'capture_bytes':len(raw),'candidate':candidate,'reader_sha256':sha(module),'legacy_cpu_ms':{c['path']:c['trace']['cpu_ms'] for c in correlations if c['path']!='/health.json'},'maximum_legacy_cpu_ms':max(c['trace']['cpu_ms'] for c in correlations),'legacy_gate_ms':500,'correlations':correlations,'england_fresh_pdf':pdf,'england_source_completed_at':source['fetched_at'],'england_values':[r['value'] for r in native['rows']],'production_identity_before_and_after':production,'staging_deployment':deployment,'production_unchanged':True,'earlier_actual_cpu_failures_ms':[794,636],'limitations':['Trace association uses exact Worker version, request path and bounded timestamp; no per-request CF-Ray was retained.','One captured request per legacy desk at one location; no percentile or sustained-load conclusion.','Fresh source-health times include failed publisher retrieval attempts and are not claims of source correctness.','This review accepts only this legacy resource capture. Semantic/regression gates, remaining staged gates and production acceptance require their own evidence.','Earlier794ms and636ms failures remain separate failed attempts.'],'no_http':True,'no_repository_writes':True,'no_git_mutations':True}
(out/'review.json').write_text(json.dumps(review,indent=2)+'\n');print(json.dumps({'review_pass':True,'legacy_gate_pass':True,'england_cpu_ms':next(c['trace']['cpu_ms'] for c in correlations if c['path']=='/england.json'),'production_unchanged':True,'capture_sha256':sha(raw),'review_sha256':sha((out/'review.json').read_bytes())}))
