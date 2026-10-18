"""Actual Draft 2020-12 validation, including the published schema and alternatives."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker
p=Path(__file__).resolve().parent
r=json.loads((p/'schema-inputs.json').read_text())
validators={k:Draft202012Validator(v,format_checker=FormatChecker()) for k,v in r['schemas'].items()}
for s in r['schemas'].values():Draft202012Validator.check_schema(s)
checks=[]
for d in r['documents']:
    errors=list(validators[d['schema']].iter_errors(d['body']))
    checks.append({'path':d['path'],'schema':d['schema'],'pass':not errors,'errors':[e.message for e in errors]})
assert all(c['pass'] for c in checks)
naive=validators['v1'].is_valid(r['naive_ninth'])
extension=validators['v1'].is_valid(r['additive_property'])
assert not naive and extension
published=json.loads((p/'published-schema.json').read_text())
assert published==r['schemas']['v1']
report={'method':'JSON Schema Draft 2020-12 + format checks','checks':checks,'all_pass':True,'published_schema_matches_local':True,'naive_ninth_valid':naive,'additive_property_valid':extension,'extension_discovery':'Existing countries iterator still sees eight; requires an additional discovery protocol anyway.'}
(p/'schema-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'validated_responses':len(checks),'naive_ninth_valid':naive,'published_schema_matches_local':True}))
