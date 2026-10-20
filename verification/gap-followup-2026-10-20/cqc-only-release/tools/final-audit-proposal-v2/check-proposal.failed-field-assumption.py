#!/usr/bin/env python3
"""Offline relationship controls against immutable current source documents."""
import copy,json,pathlib,sys
from auditlib import *
r=pathlib.Path('/workspace/morning-rows-aemo-followup');c=json.loads(pathlib.Path('/tmp/mr-cqc-r2-source-precheck-final2/audit-config.json').read_text());results=[]
def get(path):return(r/relative(path)).read_bytes()
rows=relationships(c,get);need(len(rows)==576,'Expected all original relationships');results.append({'control':'all576customrelationships','pass':True,'relationships':len(rows)})
origin=F+'/cqc-pdf/implementation-manifest.json';base=json.loads(get(origin));need(base['files'],'Expected source manifest')
for label,mutate in [
 ('same_hash_wrong_declared_path',lambda d:d['files'][0].update(path='lib/not-the-declared-reader.js')),
 ('changed_declared_hash',lambda d:d['files'][0].update(sha256='0'*64)),
 ('unsafe_declared_path',lambda d:d['files'][0].update(path='../../../../../../outside.js')),
 ('omitted_declared_binding',lambda d:d['files'].pop(0)),
]:
 d=copy.deepcopy(base);mutate(d)
 def modified(path):return json.dumps(d).encode()if path==origin else get(path)
 try:relationships(c,modified);raise AssertionError('Mutation accepted '+label)
 except ValueError as e:results.append({'control':label,'pass':True,'refusal':str(e)})
# Changing a pre-flattened target cannot be justified by merely finding its hash.
d=copy.deepcopy(c);d['custom_manifest_bindings'][0]['path']='lib/cqc-pdf.js'
try:relationships(d,get);raise AssertionError('Changed flattened target accepted')
except ValueError as e:results.append({'control':'wrong_flattened_target','pass':True,'refusal':str(e)})
report={'kind':'Offline audit-proposal controls; not committed acceptance','pass':True,'controls':results,'repository_written':False,'network_calls':0};path=pathlib.Path('/tmp/mr-cqc-final-audit-proposal/proposal-controls.json');path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'pass':True,'controls':len(results)}))
