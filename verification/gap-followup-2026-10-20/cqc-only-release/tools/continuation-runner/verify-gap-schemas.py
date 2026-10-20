#!/usr/bin/env python3
"""Offline captured Draft 2020-12 validation. No network or runtime imports.

CAPTURE OUTPUT REVISION VERSION [staged]. Run verify-captures.mjs as the
independent numerical/transport gate; this is the separate structural gate.
"""
import copy
from datetime import datetime
from hashlib import sha256
import importlib.util
import json
import os
from decimal import Decimal
from pathlib import Path
import re
import sys
from jsonschema import Draft202012Validator

ROOT=Path(os.environ['MR_REPO'])
# Reuse the established explicit date/time/URI validators and remote-ref refusal.
spec=importlib.util.spec_from_file_location('retained_gdp_schema_helpers',ROOT/'scripts/verify-statcan-gdp-captures.py')
helpers=importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)

def verify(directory,revision,version,staged):
    report={'kind':'Offline captured gap schemas, separate from numerical correctness',
            'pass':False,'revision':revision,'version':version,'staged':staged,
            'inputs':[],'schema_checks':[],'negative_controls':[]}
    def require(ok,label):
        if not ok: raise ValueError(label)
    def load(path):
        raw=path.read_bytes()
        report['inputs'].append({'file':path.name,'bytes':len(raw),'sha256':sha256(raw).hexdigest()})
        return json.loads(raw,parse_float=Decimal)
    try:
        require(bool(re.fullmatch('[a-f0-9]{40}',revision)),'Invalid source revision')
        require(bool(re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',version)),'Invalid Worker version')
        captured=load(directory/'gap-interface-report.json')
        require(captured.get('pass') is True and captured.get('revision')==revision and captured.get('version')==version and captured.get('staged')==staged,'Capture identity or pass mismatch')
        origins=['https://morningrows.com'] if staged else ['https://morningrows.com','https://www.morningrows.com']
        require(len(captured['requests'])==39*len(origins),'Incomplete capture routes')
        bodies={};seen=set()
        for i,r in enumerate(captured['requests']):
            require(r['origin'] in origins and r['headers'].get('x-source-revision')==revision and r['headers'].get('x-worker-version')==version,'Response identity mismatch')
            if 'file' not in r:
                require(r.get('bytes')==0 and (r['method']=='HEAD' or r.get('conditional') is True),'Unexpected uncaptured body')
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
            helpers.reject_remote_refs(schema)
            Draft202012Validator.check_schema(schema)
            validator=Draft202012Validator(schema,format_checker=helpers.FORMATS)
            full={};count=0
            for i,r in enumerate(captured['requests']):
                if r['origin']!=origin or r['status']!=200 or r['method']!='GET' or r['path'] in ('/health.json','/schema.json'): continue
                errors=list(validator.iter_errors(bodies[i]))
                require(not errors,'Captured schema failed '+r['path']+': '+('; '.join(e.message[:180] for e in errors[:2])))
                report['schema_checks'].append({'origin':origin,'path':r['path'],'pass':True});count+=1
                if r['path'] in ('/australia.json','/canada.json','/wales.json'):full[r['path']]=bodies[i]
            require(count==24,'Incomplete successful native/catalog/selection structural coverage')
            controls=[
                ('BoC missing value replaced by null', '/canada.json', lambda b:b['exchange_history']['rows'][0].__setitem__('value',None)),
                ('BoC unknown series', '/canada.json', lambda b:b['exchange_history']['rows'][0].__setitem__('series','FXEURCAD')),
                ('BoC reversed currency unit', '/canada.json', lambda b:b['exchange_history']['rows'][0].__setitem__('unit','USD per CAD')),
                ('Unemployment null', '/canada.json', lambda b:b['jobs'][0].__setitem__('value',None)),
                ('CPI wrong unit', '/canada.json', lambda b:b['price_index']['rows'][0].__setitem__('unit','percent')),
                ('Retail invented UTC', '/canada.json', lambda b:b['shop']['rows'][0].__setitem__('release_timezone','UTC')),
                ('Housing monthly identity', '/canada.json', lambda b:b['homes']['rows'][0].__setitem__('period','2026-07')),
                ('WRA confidential numeric zero', '/wales.json', lambda b:b['land_transaction_tax']['rows'][0].__setitem__('notes','Confidential')),
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
