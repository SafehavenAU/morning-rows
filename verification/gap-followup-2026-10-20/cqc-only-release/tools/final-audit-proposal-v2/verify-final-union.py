#!/usr/bin/env python3
"""Verify exact committed union bytes and original historical/custom relationships."""
import json,pathlib,subprocess,sys,tempfile
from auditlib import *
need(len(sys.argv)==5,'REPO EXACT_COMMIT CONFIG NEW_OUTPUT required')
r=pathlib.Path(sys.argv[1]).resolve();commit=sys.argv[2];config_path=pathlib.Path(sys.argv[3]).resolve();out=pathlib.Path(sys.argv[4]).resolve()
need(re.fullmatch('[a-f0-9]{40}',commit),'Exact commit required');need(not out.exists()and not out.is_relative_to(r),'New output must be outside repository')
raw=config_path.read_bytes();c=json.loads(raw);need(c.get('final_ready')is True,'Preview configuration cannot establish final acceptance')
def git(*args):return subprocess.check_output(['git','-C',str(r),*args],stderr=subprocess.PIPE)
need(git('rev-parse','--verify',commit+'^{commit}').decode().strip()==commit,'Exact commit unavailable')
cache={}
def get(path):
 relative(path)
 if path not in cache:cache[path]=git('show',commit+':'+path)
 return cache[path]
# Execute the existing verifier from this exact committed tree, never worktree code.
verifier=F+'/release-validation/tools/verify-committed-evidence.py'
with tempfile.TemporaryDirectory(prefix='mr-cqc-committed-union-')as temp:
 base_output=pathlib.Path(temp)/'base.json'
 run=subprocess.run([sys.executable,'-c',get(verifier).decode(),str(r),commit,str(config_path),str(base_output)],capture_output=True,text=True)
 need(base_output.exists(),'Base verifier did not produce a report: '+run.stderr)
 report=json.loads(base_output.read_bytes())
failures=list(report['failures']);counts={'historical_pin_relationships':0,'custom_binding_relationships':0,'exact_git_snapshots':0}
try:
 configs={k:json.loads(get(HISTORY+'/'+k+'-audit-config.json'))for k in ['ni','cqc']}
 audits={k:json.loads(get(HISTORY+'/'+k+'-committed-tree-audit.json'))for k in ['ni','cqc']}
 for k in configs:
  need(audits[k]['pass']is True and audits[k]['config_sha256']==sha(get(HISTORY+'/'+k+'-audit-config.json')),'Historical audit/config identity mismatch')
 need(audits['ni']['commit']=='ee599a447a4de49d371a809c7aef690e2f3a01d7'and len(audits['ni']['files'])==1729 and audits['ni']['manifest_records_verified']==1335,'NI audited boundary changed')
 need(audits['cqc']['commit']=='7d7ed892c469d6f589dabf52283fc31dfef98d8a'and len(audits['cqc']['files'])==593,'CQC source boundary changed')
 mapping={}
 for row in json.loads(get(c['historical_relocation_manifest']))['records']:
  key=(row['original_path'],row['sha256']);need(key not in mapping,'Duplicate historical relocation');mapping[key]=row
  original=git('show',row['source_commit']+':'+row['original_path']);retained=get(row['retained_path'])
  need(original==retained and sha(retained)==row['sha256']and len(retained)==row['bytes'],'Snapshot is not exact original Git bytes '+row['retained_path'])
  need(git('rev-parse',row['source_commit']+':'+row['original_path']).decode().strip()==row['source_blob'],'Snapshot source Git blob changed');counts['exact_git_snapshots']+=1
 def target(path,h):return mapping.get((path,h),{}).get('retained_path',path)
 expected=[]
 for key,config in configs.items():
  for i,row in enumerate(config['additional_files']):
   dest=target(row['path'],row['sha256']);expected.append({'source_configuration':HISTORY+'/'+key+'-audit-config.json','source_record_index':i,'original_path':row['path'],'retained_path':dest,'sha256':row['sha256'],'bytes':row.get('bytes')})
 need(expected==c['historical_pin_relationships'],'Historical configuration relationships changed or omitted')
 for row in expected:
  b=get(row['retained_path']);need(sha(b)==row['sha256']and(row['bytes']is None or len(b)==row['bytes']),'Historical pin mismatch '+row['retained_path']);counts['historical_pin_relationships']+=1
 custom=relationships(configs['cqc'],get)
 for row in custom:row['retained_target']=target(row['original_target'],row['sha256'])
 need(custom==c['custom_binding_relationships'],'Original custom manifest declaration relationships changed or omitted')
 for row in custom:
  b=get(row['retained_target']);need(sha(b)==row['sha256']and(row['bytes']is None or len(b)==row['bytes']),'Custom manifest pin mismatch '+row['retained_target']);counts['custom_binding_relationships']+=1
except (ValueError,KeyError,TypeError,OSError,subprocess.CalledProcessError)as e:failures.append(str(e))
report.update({'kind':'Exact committed NI+CQC+accepted-package union verification; no release/scheduled acceptance','pass':not failures,'failures':failures,'relationship_records_verified':counts,'coverage_claim':'Union of previous NI audited coverage, CQC source coverage and the new accepted CQC package; not all repository manifests','base_verifier_sha256':sha(get(verifier)),'worktree_evidence_read':False,'repository_written':False,'network_calls':0})
with out.open('x')as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({'pass':report['pass'],'commit':commit,'files':len(report['files']),'direct_manifest_records':report['manifest_records_verified'],**counts,'failures':len(failures),'output':str(out)}));sys.exit(0 if report['pass']else 1)
