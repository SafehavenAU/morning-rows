#!/usr/bin/env python3
"""Follow-up compatibility copy: allow NI schema now active; preserve original.
Offline captured Draft 2020-12 validation. No network or runtime imports.

CAPTURE OUTPUT REVISION VERSION [staged]. Run verify-captures.mjs as the
independent numerical/transport gate; this is the separate structural gate.
"""
import copy
from datetime import datetime
from collections import Counter
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import re
import sys
from jsonschema import Draft202012Validator

ROOT=Path(__file__).resolve().parents[3]
# Reuse the established explicit date/time/URI validators and remote-ref refusal.
spec=importlib.util.spec_from_file_location('retained_gdp_schema_helpers',ROOT/'scripts/verify-statcan-gdp-captures.py')
helpers=importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)

def expected_routes():
    desks=['scotland','canada']
    sources=[('scotland','college_activity','total','2024-25'),('canada','rental_benchmark','victoria.two_bedroom_average_rent','2025')]
    paths=['/health.json','/schema.json']
    for desk in desks: paths.extend(['/'+desk+'.json','/catalog.json?desk='+desk])
    for desk,source,measure,period in sources:
        base='/'+desk+'.json?source='+source
        paths.extend([base,base+'&measure='+measure,base+'&measure='+measure+'&observation='+period])
    rows=[(path,'GET',False,200) for path in paths]
    for desk,source,measure,_ in sources:
        path='/'+desk+'.json?source='+source+'&measure='+measure
        rows.extend([(path,'GET',True,304),(path,'HEAD',False,200)])
    rows.extend((path,'GET',False,status) for path,status in [
        ('/scotland.json?source=college_activity&measure=total&observation=2025-26',404),
        ('/canada.json?source=rental_benchmark&measure=victoria.two_bedroom_average_rent&observation=2024',404),
        ('/canada.json?source=rental_benchmark&measure=apartment_only',404),
        ('/canada.json?source=rental_benchmark&measure=victoria.two_bedroom_average_rent&geography=Toronto',400),
        ('/scotland.json?source=college_activity&measure=total&measure=part_time_fe',400),
        ('/canada.json?source=rental_benchmark&observation=2025',400),
    ])
    return rows

def verify(directory,revision,version,staged):
    report={'kind':'Offline existing SFC/CMHC schemas with NI now active; separate from numerical correctness',
            'pass':False,'revision':revision,'version':version,'staged':staged,'excluded_sources':['england/care_assessment_cohort','england/bedroom_rent'],
            'limitations':['Structural validation is separate from exact numerical and semantic capture verification.','No scheduled-operation acceptance or future-vintage approval is established.'],
            'inputs':[],'schema_checks':[],'negative_controls':[]}
    def require(ok,label):
        if not ok: raise ValueError(label)
    def load(path):
        raw=path.read_bytes()
        report['inputs'].append({'file':path.name,'bytes':len(raw),'sha256':sha256(raw).hexdigest()})
        return json.loads(raw)
    try:
        require(bool(re.fullmatch('[a-f0-9]{40}',revision)),'Invalid source revision')
        require(bool(re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',version)),'Invalid Worker version')
        captured=load(directory/'remaining-interface-report.json')
        require(captured.get('pass') is True and captured.get('revision')==revision and captured.get('version')==version and captured.get('staged')==staged,'Capture identity or pass mismatch')
        origins=['https://morningrows.com'] if staged else ['https://morningrows.com','https://www.morningrows.com']
        plan=expected_routes()
        require(len(plan)==22,'Internal bounded route count')
        require(Counter((r.get('origin'),r.get('path'),r.get('method'),r.get('conditional'),r.get('status')) for r in captured['requests'])==Counter((origin,*row) for origin in origins for row in plan),'Incomplete/duplicate/unknown capture routes')
        bodies={};seen=set()
        for i,r in enumerate(captured['requests']):
            require(r['origin'] in origins and r['headers'].get('x-source-revision')==revision and r['headers'].get('x-worker-version')==version,'Response identity mismatch')
            if 'file' not in r:
                require(r.get('bytes')==0 and r.get('sha256')==sha256(b'').hexdigest() and (r['method']=='HEAD' or r.get('conditional') is True),'Unexpected uncaptured body')
                continue
            f=r['file']
            require(isinstance(f,str) and re.fullmatch(r'\d{3}\.body',f) and f not in seen,'Unsafe or repeated capture file')
            seen.add(f);body=load(directory/f)
            require(report['inputs'][-1]['sha256']==r['sha256'] and report['inputs'][-1]['bytes']==r['bytes'],'Body hash or byte mismatch')
            bodies[i]=body
        for origin in origins:
            schema_rows=[i for i,r in enumerate(captured['requests']) if r['origin']==origin and r['path']=='/schema.json' and r['method']=='GET' and r['status']==200]
            require(len(schema_rows)==1,'Exactly one captured schema required')
            schema=bodies[schema_rows[0]]
            require(schema.get('$id')=='https://morningrows.com/schema.json' and schema.get('$schema')=='https://json-schema.org/draft/2020-12/schema','Unexpected schema identity or dialect')
            require(not any(key.startswith(('remainingCqc','remainingOns')) for key in schema.get('$defs',{})),'Blocked candidate advertised in public schema')
            helpers.reject_remote_refs(schema)
            Draft202012Validator.check_schema(schema)
            validator=Draft202012Validator(schema,format_checker=helpers.FORMATS)
            full={};count=0
            for i,r in enumerate(captured['requests']):
                if r['origin']!=origin or r['status']!=200 or r['method']!='GET' or r['path'] in ('/health.json','/schema.json'): continue
                errors=list(validator.iter_errors(bodies[i]))
                require(not errors,'Captured schema failed '+r['path']+': '+('; '.join(e.message[:180] for e in errors[:2])))
                report['schema_checks'].append({'origin':origin,'path':r['path'],'pass':True});count+=1
                if r['path'] in ('/scotland.json','/canada.json'):full[r['path']]=bodies[i]
            require(count==10,'Incomplete successful native/catalog/selection structural coverage')
            controls=[
                ('SFC FTE unit replaced by persons', '/scotland.json', lambda b:b['college_activity']['rows'][0].__setitem__('unit','people')),
                ('SFC population replaced by headcounts', '/scotland.json', lambda b:b['college_activity'].__setitem__('population','Individual student headcounts')),
                ('SFC changed academic year', '/scotland.json', lambda b:b['college_activity'].__setitem__('period','2025-26')),
                ('SFC missing component row', '/scotland.json', lambda b:b['college_activity']['rows'].pop()),
                ('CMHC wrong census area', '/canada.json', lambda b:b['rental_benchmark']['rows'][0].__setitem__('dguid','2011S0503933')),
                ('CMHC monthly rent replaced by annual dollars', '/canada.json', lambda b:b['rental_benchmark']['rows'][0].__setitem__('unit','CAD per year')),
                ('CMHC omitted downstream licence conditions', '/canada.json', lambda b:b['rental_benchmark']['licence_notice'].__setitem__('conditions','Unrestricted')),
                ('CMHC absent acquisition provenance', '/canada.json', lambda b:b['rental_benchmark'].__setitem__('provenance',[])),
            ]
            for label,path,edit in controls:
                body=copy.deepcopy(full[path]);edit(body)
                require(not validator.is_valid(body),'Schema accepted negative control '+label)
                report['negative_controls'].append({'origin':origin,'label':label,'pass':True})
        report['pass']=True
    except Exception as error:
        report['error']=str(error)
    report['verified_at']=datetime.now().astimezone().isoformat()
    return report

if __name__=='__main__':
    args=sys.argv[1:]
    if len(args) not in (4,5) or len(args)==5 and args[4]!='staged':
        raise SystemExit('CAPTURE OUTPUT REVISION VERSION [staged] required')
    directory,output,revision,version=args[:4]
    result=verify(Path(directory),revision,version,len(args)==5)
    with Path(output).open('x') as handle:json.dump(result,handle,indent=2);handle.write('\n')
    print(json.dumps({'pass':result['pass'],'error':result.get('error'),'schema_checks':len(result['schema_checks']),'negative_controls':len(result['negative_controls']),'output':output}))
    raise SystemExit(not result['pass'])
