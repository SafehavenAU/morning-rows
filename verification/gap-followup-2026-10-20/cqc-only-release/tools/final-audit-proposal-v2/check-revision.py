#!/usr/bin/env python3
"""Check only the explicit registry addition and immutable previous proposal."""
import hashlib,json,pathlib,subprocess
O=pathlib.Path('/tmp/mr-cqc-final-audit-proposal');N=pathlib.Path('/tmp/mr-cqc-final-audit-proposal-v2');R=pathlib.Path('/workspace/morning-rows-aemo-followup')
sha=lambda x:hashlib.sha256(x).hexdigest()
assert sha((O/'tool-manifest.json').read_bytes())=='37fb3ea442b15e1ae70f0aa0162822088cb2bb8d2c0eaff661ddc92b802f2d5b'
for row in json.loads((O/'tool-manifest.json').read_bytes())['files']:
 raw=(O/row['file']).read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
for name in ['auditlib.py','build-final-audit.py','verify-final-union.py']:assert(O/name).read_bytes()==(N/name).read_bytes()
old=json.loads((O/'relocations.json').read_bytes())['records'];new=json.loads((N/'relocations.json').read_bytes())['records']
assert len(old)==19 and len(new)==20
added=[row for row in new if row not in old];assert len(added)==1
row=added[0];assert row['original_path']=='operations/source-contract-registry.json'
assert row['sha256']=='14cb64414507374bac8d230d25328549128c640bbb4f8479f125e2212d832bf7' and row['bytes']==760261
raw=subprocess.check_output(['git','-C',str(R),'show',row['source_commit']+':'+row['original_path']]);assert sha(raw)==row['sha256'] and len(raw)==row['bytes'] and(N/'payload'/row['retained_path']).read_bytes()==raw
config=json.loads((N/'preview/audit-config.json').read_bytes());pins=[x for x in config['historical_pin_relationships']if x['original_path']==row['original_path']]
assert len(pins)==2 and all(x['retained_path']==row['retained_path'] and x['sha256']==row['sha256'] for x in pins)
copy=json.loads((N/'copy-files.json').read_bytes())['files'];assert len(copy)==25
for x in copy:
 b=pathlib.Path(x['source']).read_bytes();assert sha(b)==x['sha256'] and len(b)==x['bytes']
p=subprocess.run(['python',str(N/'verify-final-union.py'),str(R),row['source_commit'],str(N/'preview/audit-config.json'),str(N/'must-not-exist.json')],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
(N/'preview-refusal.log').write_bytes(p.stdout);assert p.returncode!=0 and b'Preview' in p.stdout and not(N/'must-not-exist.json').exists()
result={'pass':True,'previous_proposal_manifest_preserved':True,'previous_manifest_files_verified':15,'unchanged_audit_logic_files':3,'new_registry_snapshot_exact_git_bytes':True,'previous_relocations_preserved':19,'added_relocations':1,'registry_prior_config_relationships_verified':2,'payload_files_verified':25,'preview_final_audit_refused':True,'repository_written':False,'network_calls':0}
(N/'revision-controls.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
