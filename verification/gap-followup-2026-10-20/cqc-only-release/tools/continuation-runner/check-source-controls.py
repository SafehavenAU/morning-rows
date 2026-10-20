"""Constructed offline refusal controls only; never run the network runner."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

HERE=Path(__file__).resolve().parent
REV='1'*40
VERSION='22222222-2222-4222-8222-222222222222'
DESKS=['australia','new-zealand','canada','united-kingdom','england','scotland','wales','northern-ireland','united-states']
base={'pass':True,'checks':[{'pass':True} for _ in range(50)],
      'identity':{'source_revision':REV,'worker_version':VERSION,'source_dirty':False,'build_fingerprint':'3'*16},
      'source_status':{desk:{'source_'+str(i):{'status':'ok'}} for i,desk in enumerate(DESKS)}}
base['source_status']['scotland']['river_level']={'status':'ok'}
base['source_status']['england']['service']={'status':'error','http_status':429,'error':'api.tfl.gov.uk returned HTTP 429'}
base['source_status']['england']['ons_example']={'status':'error','http_status':403,'error':'www.ons.gov.uk returned HTTP 403'}
for i in range(108):
    base['source_status']['australia']['filler_'+str(i)]={'status':'ok'}
assert sum(map(len,base['source_status'].values()))==120
cases=[]
def case(name,change,expected):
    stage,apex,www=deepcopy(base),deepcopy(base),deepcopy(base)
    change(stage,apex,www)
    cases.append((name,stage,apex,www,expected))
case('all 120 unchanged states pass',lambda s,a,w:None,True)
case('known TfL recovery allowed',lambda s,a,w:a['source_status']['england'].__setitem__('service',{'status':'ok'}),True)
case('known ONS 403 to 429 allowed',lambda s,a,w:a['source_status']['england'].__setitem__('ons_example',{'status':'error','http_status':429,'error':'www.ons.gov.uk returned HTTP 429'}),True)
case('strict 49 checks rejected',lambda s,a,w:a['checks'].pop(),False)
case('strict failed numeric check rejected',lambda s,a,w:a['checks'][0].update(pass_=False,**{'pass':False}),False)
case('SEPA failure never receives waiver',lambda s,a,w:a['source_status']['scotland'].__setitem__('river_level',{'status':'error','http_status':503,'error':'upstream unavailable'}),False)
case('both domains same SEPA failure still rejected',lambda s,a,w:[x['source_status']['scotland'].__setitem__('river_level',{'status':'error','http_status':503,'error':'upstream unavailable'}) for x in [s,a,w]],False)
case('unknown new failure rejected',lambda s,a,w:a['source_status']['canada']['source_2'].update(status='error',http_status=503,error='upstream unavailable'),False)
case('missing source rejected',lambda s,a,w:a['source_status']['australia'].pop('filler_0'),False)
case('extra source rejected',lambda s,a,w:a['source_status']['australia'].__setitem__('unreviewed',{'status':'ok'}),False)
case('wrong production identity rejected',lambda s,a,w:w['identity'].update(source_revision='4'*40),False)
case('dirty candidate rejected',lambda s,a,w:a['identity'].update(source_dirty=True),False)
results=[]
with TemporaryDirectory(prefix='constructed-source-controls-',dir=HERE) as tmp:
    directory=Path(tmp)
    for index,(name,stage,apex,www,expected) in enumerate(cases):
        paths=[]
        for host,data in [('stage',stage),('apex',apex),('www',www)]:
            path=directory/f'{index}-{host}.json'
            path.write_text(json.dumps(data))
            paths.append(str(path))
        output=directory/f'{index}-result.json'
        process=subprocess.run([sys.executable,str(HERE/'verify-source-states.py'),*paths,str(output),REV,VERSION],capture_output=True,text=True)
        result=json.loads(output.read_text())
        assert result['pass'] is expected and process.returncode==(0 if expected else 1),(name,process.stdout,process.stderr)
        results.append({'name':name,'expected_pass':expected,'observed_pass':result['pass'],'pass':True})
report={'kind':'Constructed offline runner refusal controls; not actual HTTP, CPU, release or scheduled evidence',
        'pass':True,'controls':results,'source_helper_sha256':hashlib.sha256((HERE/'verify-source-states.py').read_bytes()).hexdigest()}
if len(sys.argv)==2:
    with Path(sys.argv[1]).open('x') as stream:
        json.dump(report,stream,indent=2)
        stream.write('\n')
else:
    assert len(sys.argv)==1
print(json.dumps({'pass':True,'controls':len(results)}))
