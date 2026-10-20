"""Retain the strict semantic report; independently review only an observed,
unchanged SEPA upstream 503. This is not a successful SEPA observation."""
import datetime,hashlib,json,pathlib,subprocess,sys
capture,output=sys.argv[1:]
result=subprocess.run(['node','scripts/verify-preview-bodies.mjs',capture,output])
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
        assert scotland['river_level'] is None and health['status']=='error' and health['http_status']==503
        assert health['error']=='timeseries.sepa.org.uk returned HTTP 503'
        prior=pathlib.Path('/tmp/mr-gap-sepa-baseline/report.json')
        p=json.loads(prior.read_bytes())
        assert p['identity_headers']=={
          'x-source-revision':'a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b',
          'x-worker-version':'775bfe2d-491b-4bf5-a257-4d3465003351'}
        assert p['retrieval']['status']=='error' and p['retrieval']['http_status']==503 and p['data'] is None
        assert p['retrieval']['error']==health['error']
        then=datetime.datetime.fromisoformat(p['checked_at'])
        at=datetime.datetime.fromisoformat(health['fetched_at'].replace('Z','+00:00'))
        assert abs((at-then).total_seconds())<=6*3600
        unchanged={}
        for file in ['lib/open-observations.js','lib/sources.js']:
            baseline=subprocess.check_output(['git','rev-parse','a6f3ab6d00de70a08bc304f2ae54a0fb46c7069b:'+file]).strip().decode()
            actual=subprocess.check_output(['git','rev-parse','HEAD:'+file]).strip().decode()
            assert actual==baseline
            unchanged[file]=actual
        assert p['reader_and_fetch_modules_unchanged']=={k:True for k in unchanged}
        review['unresolved_source_availability']=[{
          'source':'scotland/river_level','status':'error','http_status':503,
          'interpretation':'Same publisher refusal under accepted production and candidate; reader and fetch modules unchanged. No successful SEPA observation or source recovery claimed.',
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
