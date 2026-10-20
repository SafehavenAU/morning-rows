"""Retain the strict semantic report; independently review only an observed,
unchanged SEPA reader transport unavailability: exact503 or exact timeout, always null. This is not a successful SEPA observation."""
import datetime,hashlib,json,os,pathlib,subprocess,sys
capture,output=sys.argv[1:]
assert not pathlib.Path(output).exists(), 'Refusing to overwrite strict report'
assert not pathlib.Path(output).with_name(pathlib.Path(output).stem+'-release-gate.json').exists(), 'Refusing to overwrite release gate'
environment=dict(os.environ)
environment.setdefault('EXPECTED_REVISION',json.loads(pathlib.Path(capture,'_health.json.response').read_bytes())['source_revision'])
result=subprocess.run(['node','scripts/verify-preview-bodies.mjs',capture,output],env=environment)
report=json.loads(pathlib.Path(output).read_bytes())
review={'kind':'Implementation release semantic gate with explicit upstream availability boundary',
        'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'strict_report':output,'strict_report_sha256':hashlib.sha256(pathlib.Path(output).read_bytes()).hexdigest(),
        'strict_semantics_pass':report.get('pass') is True,'release_gate_pass':False,
        'unresolved_source_availability':[]}
try:
    if result.returncode==0:
        assert report['pass'] is True
    else:
        failed=[c for c in report['checks'] if not c['pass']]
        assert len(failed)==1 and failed[0]['name']=='SEPA Galashiels observation'
        assert len(report['checks'])==50 and sum(c['pass'] for c in report['checks'])==49
        raw=pathlib.Path(capture,'_scotland.json.response').read_bytes()
        scotland=json.loads(raw);health=scotland['sources']['river_level']
        assert scotland['river_level'] is None and health['status']=='error'
        refused=health.get('http_status')==503 and health.get('error')=='timeseries.sepa.org.uk returned HTTP 503'
        timedout='http_status' not in health and health.get('error')=='Source request timed out'
        assert refused or timedout
        prior=pathlib.Path('/tmp/mr-gap-sepa-baseline/report.json')
        p=json.loads(prior.read_bytes())
        assert p['identity_headers']=={
          'x-source-revision':'a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b',
          'x-worker-version':'775bfe2d-491b-4bf5-a257-4d3465003351'}
        assert p['retrieval']['status']=='error' and p['retrieval']['http_status']==503 and p['data'] is None
        assert p['retrieval']['error']=='timeseries.sepa.org.uk returned HTTP 503'
        baseline_body=prior.with_name('response.json').read_bytes()
        assert hashlib.sha256(baseline_body).hexdigest()==p['response_sha256']
        assert json.loads(baseline_body)['data'] is None
        then=datetime.datetime.fromisoformat(p['checked_at'])
        at=datetime.datetime.fromisoformat(health['fetched_at'].replace('Z','+00:00'))
        assert abs((at-then).total_seconds())<=6*3600
        unchanged={}
        for file in ['lib/open-observations.js','lib/sources.js']:
            baseline=subprocess.check_output(['git','rev-parse','a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b:'+file]).strip().decode()
            actual=subprocess.check_output(['git','rev-parse',report['identity']['source_revision']+':'+file]).strip().decode()
            working=subprocess.check_output(['git','hash-object',file]).strip().decode()
            assert working==actual
            assert actual==baseline
            unchanged[file]=actual
        assert p['reader_and_fetch_modules_unchanged']=={k:True for k in unchanged}
        review['unresolved_source_availability']=[{
          'source':'scotland/river_level','status':'error','http_status':health.get('http_status'),'error':health['error'],
          'approved_transport_states':['exact publisher HTTP503','exact source timeout with no HTTPstatus and null native value'],
          'interpretation':'Existing reader remains unavailable: accepted production returned503; this capture reports the exact recorded503 or timeout with null native value. Reader and fetch modules are unchanged. Transport outcomes are distinguished; no successful observation or numerical recovery is claimed.',
          'candidate_scotland_sha256':hashlib.sha256(raw).hexdigest(),
          'accepted_production_comparison_sha256':hashlib.sha256(prior.read_bytes()).hexdigest(),
          'unchanged_git_blobs':unchanged,
          'monitoring':'Existing source remains enabled with honest error and independent siblings. No checkpoint, receipt, schedule or source alert changed.'}]
    review['release_gate_pass']=True
except Exception as error:
    review['error']=str(error) or 'Exact reviewed availability condition did not match'
path=pathlib.Path(output).with_name(pathlib.Path(output).stem+'-release-gate.json')
with path.open('x') as f:json.dump(review,f,indent=2);f.write('\n')
print(json.dumps(review,indent=2))
sys.exit(0 if review['release_gate_pass'] else 1)
