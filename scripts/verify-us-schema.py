"""Validate actual Worker replay using Draft 2020-12, including negative contracts."""
import json,sys
from copy import deepcopy
from pathlib import Path
from jsonschema import Draft202012Validator,FormatChecker
p=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/morning-rows-us-contract')
r=json.loads((p/'schema-inputs.json').read_text())
validators={k:Draft202012Validator(s,format_checker=FormatChecker()) for k,s in r['schemas'].items()}
for s in r['schemas'].values():Draft202012Validator.check_schema(s)
checks=[]
for d in r['documents']:
    errors=list(validators[d['schema']].iter_errors(d['body']))
    checks.append({'path':d['path'],'schema':d['schema'],'pass':not errors,'errors':[e.message for e in errors]})
assert all(c['pass'] for c in checks),[c for c in checks if not c['pass']]
legacy=next(d['body'] for d in r['documents'] if d['path']=='/catalog.json')
ninth=deepcopy(legacy);ninth['countries'].append({'name':'United States'})
assert not validators['v1'].is_valid(ninth)
selected=next(d['body'] for d in r['documents'] if d['path']=='/united-states.json?source=cpi&measure=CUUR0000SA0')
wrong_geo=deepcopy(selected);wrong_geo['observations'][0]['definition']['geography']='California'
assert not validators['v2'].is_valid(wrong_geo)
wrong_null=deepcopy(selected);wrong_null['observations'][1]['value']=0
assert not validators['v2'].is_valid(wrong_null)
(p/'schema-results.json').write_text(json.dumps({'method':'Draft 2020-12 + format assertions; actual Worker outputs','checks':checks,'all_pass':True,'negative_contracts':['v1 ninth desk','wrong geography','unavailable turned into zero']},indent=2)+'\n')
print(json.dumps({'responses_validated':len(checks),'negative_contracts':3,'pass':True}))
