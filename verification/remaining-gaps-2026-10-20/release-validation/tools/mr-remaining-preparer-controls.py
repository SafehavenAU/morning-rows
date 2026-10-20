from pathlib import Path
import tempfile,json,subprocess,hashlib
root=Path('/workspace/morning-rows-remaining'); script='/tmp/mr-prepare-remaining-monitor.mjs'
paths=['operations/us-release-review.json','operations/approved-observations.json','operations/acceptance.json','operations/source-contract-registry.json','verification/monitoring-baseline.json','verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before={p:sha(root/p) for p in paths}
with tempfile.TemporaryDirectory(prefix='mr-remaining-preparer-refusals-') as td:
 td=Path(td);cfg=td/'config.json';base={'target':{'source_revision':'ba0812b493f7cc4ca47a9f726211d96903bd9597','source_dirty':False,'build_fingerprint':'6877bf601fbb4b71','worker_version':'3eae0d8f-e4ad-4c31-97f2-6b98845e3ba9'},'deployment_id':'302dc69e-1456-48f7-83aa-bedb6abc2ae8','accepted_at':'2026-10-20T10:24:10.000Z','promoted_at':'2026-10-20T10:21:09.400348Z'};cfg.write_text(json.dumps(base))
 cases=[]
 def run(label,args,expected,out=None):
  p=subprocess.run(['node',script,*args],capture_output=True,text=True)
  assert p.returncode!=0 and expected in p.stderr,(label,p.stderr)
  if out:assert not out.exists()
  cases.append({'control':label,'pass':True,'refusal':expected,'output_created':False})
 run('missing arguments',[],'REPO CONFIG_JSON NEW_PLAN_DIR required')
 run('existing output directory',[str(root),str(cfg),str(td)],'Output directory must not already exist')
 run('repository output forbidden',[str(root),str(cfg),str(root/'new-monitor-proposal-forbidden')],'Output must remain outside repository')
 symlink=td/'alias';symlink.symlink_to(root,target_is_directory=True)
 run('repository symlink forbidden',[str(root),str(cfg),str(symlink/'new-monitor-proposal-forbidden')],'Output must remain outside repository')
 run('rolled back candidate forbidden',[str(root),str(cfg),str(td/'failed-candidate-proposal')],'Rolled-back AEMO candidate cannot be approved',td/'failed-candidate-proposal')
 base['target']={'source_revision':'bf3110e3bcbbc7db6d629254a886356e80f4c24a','source_dirty':False,'build_fingerprint':'f815539b2fa5b866','worker_version':'7f93e660-666c-435a-9b8b-bc37c060ac02'}
 base['production_root']=str(td);base['staged_root']=str(td)
 base['prior_review_sha256']='invalid';cfg.write_text(json.dumps(base))
 run('invalid prior review pin',[str(root),str(cfg),str(td/'invalid-review-pin')],'Explicit accepted phase-one review digest required',td/'invalid-review-pin')
 base['prior_review_sha256']='a'*64;base['prior_approvals_sha256']='invalid';cfg.write_text(json.dumps(base))
 run('invalid prior approvals pin',[str(root),str(cfg),str(td/'invalid-approval-pin')],'Explicit accepted phase-one approval digest required',td/'invalid-approval-pin')
 base['prior_approvals_sha256']='b'*64;base['prior_review_file']=str(root/'operations/us-release-review.json');base['prior_approvals_file']=str(root/'operations/approved-observations.json');cfg.write_text(json.dumps(base))
 run('wrong retained prior review hash',[str(root),str(cfg),str(td/'wrong-prior-pin')],'Exact retained predecessor required',td/'wrong-prior-pin')
 assert before=={p:sha(root/p) for p in paths}
 result={'kind':'Offline refusal controls only; no release or scheduled acceptance','pass':True,'controls':cases,'script_sha256':sha(Path(script)),'protected_input_hashes':before,'active_inputs_unchanged':True,'successful_production_preparation':'not run; accepted phase-one pins and phase-two candidate/captures pending','publisher_requests':0,'repository_writes':0,'checkpoint_written':False}
 Path('/tmp/mr-remaining-preparer-controls.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'pass':True,'controls':len(cases),'active_inputs_unchanged':True,'script_sha256':result['script_sha256']}))
