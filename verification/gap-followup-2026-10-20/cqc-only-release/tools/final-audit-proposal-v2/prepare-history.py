#!/usr/bin/env python3
"""Read exact committed bytes; prepare historical payload outside the repository."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path('/workspace/morning-rows-aemo-followup')
O=pathlib.Path('/tmp/mr-cqc-final-audit-proposal-v2')
PKG='verification/gap-followup-2026-10-20/cqc-only-release'
NI='ee599a447a4de49d371a809c7aef690e2f3a01d7'
SOURCE='7d7ed892c469d6f589dabf52283fc31dfef98d8a'
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git','-C',str(R),*args])
def blob(commit,path):return git('show',commit+':'+path)
config_paths={'ni':'/tmp/mr-ni-final-audit-config.json','cqc':'/tmp/mr-cqc-r2-source-precheck-final2/audit-config.json'}
audit_paths={'ni':'/tmp/mr-ni-final-remote-committed-evidence-audit.json','cqc':'/tmp/mr-cqc-r2-source-exact-audit.json'}
configs={k:json.loads(pathlib.Path(p).read_bytes())for k,p in config_paths.items()}
audits={k:json.loads(pathlib.Path(p).read_bytes())for k,p in audit_paths.items()}
assert audits['ni']['pass'] and audits['ni']['commit']==NI and len(audits['ni']['files'])==1729 and audits['ni']['manifest_records_verified']==1335
assert audits['cqc']['pass'] and audits['cqc']['commit']==SOURCE and len(audits['cqc']['files'])==593
for k in configs:assert audits[k]['config_sha256']==sha(pathlib.Path(config_paths[k]).read_bytes())
assert git('rev-parse','HEAD').decode().strip()==SOURCE
assert not git('status','--porcelain')
paths=git('ls-tree','-r','--name-only',SOURCE).decode().splitlines()
payload=[];relocations=[]
def save(target,data,role,**meta):
 p=O/'payload'/target;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb') as f:f.write(data)
 row={'source':str(p),'path':target,'bytes':len(data),'sha256':sha(data),'role':role,**meta};payload.append(row);return row
for k in configs:
 save(PKG+'/audit-history/'+k+'-audit-config.json',pathlib.Path(config_paths[k]).read_bytes(),'historical_audit_configuration',source_commit=audits[k]['commit'])
 save(PKG+'/audit-history/'+k+'-committed-tree-audit.json',pathlib.Path(audit_paths[k]).read_bytes(),'historical_committed_tree_audit',source_commit=audits[k]['commit'])
# Check existing source snapshots first; reuse only exact bytes, not similar names.
candidate_paths=[p for p in paths if '/historical/'in p or p.endswith(('.source','.snapshot'))]
existing={}
for p in candidate_paths:
 b=blob(SOURCE,p);existing.setdefault(sha(b),[]).append((p,len(b)))
def relocate(path,expected,commit,scope,reason):
 raw=blob(commit,path);assert sha(raw)==expected['sha256'];assert 'bytes'not in expected or len(raw)==expected['bytes']
 key=(path,sha(raw))
 if any((x['original_path'],x['sha256'])==key for x in relocations):return
 matches=[(p,n)for p,n in existing.get(sha(raw),[])if n==len(raw)]
 if matches:target=matches[0][0];reuse=True
 else:
  target=PKG+'/historical/'+scope+'/'+path+'.source';save(target,raw,'historical_exact_git_blob',source_commit=commit,original_path=path);reuse=False
 relocations.append({'original_path':path,'sha256':sha(raw),'bytes':len(raw),'retained_path':target,'source_commit':commit,'source_blob':git('rev-parse',commit+':'+path).decode().strip(),'reuses_existing_committed_snapshot':reuse,'reason':reason})
for row in configs['ni']['additional_files']:
 current=blob(SOURCE,row['path'])
 if sha(current)!=row['sha256']:relocate(row['path'],row,NI,'ni-accepted','NI final-audit pin overwritten in later CQC source')
planned=['operations/source-contract-registry.json','operations/us-release-review.json','operations/approved-observations.json','operations/acceptance.json','verification/monitoring-baseline.json','HANDOFF.md','GAP-LEDGER.md','verification/gap-followup-2026-10-20/cqc-only/README.md']
for path in planned:
 raw=blob(SOURCE,path);relocate(path,{'sha256':sha(raw),'bytes':len(raw)},SOURCE,'source-7d7','Anticipated accepted-release append/update; original pin must survive')
record={'kind':'Explicit historical byte-identity relocations; no original manifest rewrite','source_commits':{'ni':NI,'cqc':SOURCE},'records':relocations}
raw=(json.dumps(record,indent=2)+'\n').encode();save(PKG+'/audit-history/relocations.json',raw,'historical_relocation_relationships')
(O/'relocations.json').write_bytes(raw)
(O/'copy-files.json').write_text(json.dumps({'kind':'Outside-repository payload proposal only; no repository copies performed','repository':str(R),'package_root':PKG,'files':payload},indent=2)+'\n')
print(json.dumps({'payload_files':len(payload),'relocations':len(relocations),'existing_snapshot_reuses':sum(x['reuses_existing_committed_snapshot']for x in relocations),'bytes':sum(x['bytes']for x in payload),'repository_written':False,'network_calls':0}))
