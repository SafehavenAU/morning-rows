from pathlib import Path
import copy,hashlib,json,datetime,difflib
ROOT=Path('/tmp/mr-dated-release-review/packager-readme-review')
ORIGINAL=Path('/tmp/mr-combined-final-preparation/cqc-continuation-v3/package-evidence.py')
DERIVATIVE=Path('/tmp/mr-combined-final-preparation/cqc-package-readme-derivative/package-evidence-readme.py')
PLAN=Path('/tmp/mr-combined-final-preparation/cqc-continuation-v3/package-plan.final-reviewed-additions.json')
def sha(b):return hashlib.sha256(b).hexdigest()
def pin(p):
 p=Path(p);b=p.read_bytes();return dict(file=str(p),bytes=len(b),sha256=sha(b))
def module(p):
 scope={'__name__':'review_only','__file__':str(p)};exec(compile(p.read_bytes(),str(p),'exec'),scope);return scope
old=module(ORIGINAL);new=module(DERIVATIVE);plan=json.loads(PLAN.read_bytes());checks=[]
def check(x,n):
 assert x,n
 checks.append(dict(name=n,pass_=True))
def refused(c,n):
 try:new['config_check'](c)
 except ValueError:check(True,n)
 else:raise AssertionError(n)
check(sha(ORIGINAL.read_bytes())=='6a2c041ed8ec2c95bcd686fa903e6482b3ce4a595e52cb028d6a6bc2c9606454','Frozen original packager unchanged')
check(sha(DERIVATIVE.read_bytes())=='88416d93f70ce8c66b0f84f3e96872ee911d51014dc8a5eb2986861db6dff92e','Reviewed derivative exact hash')
new['config_check'](plan);payloads,audit,add_list=new['prepare'](plan);manifest=json.loads(payloads['packaging-manifest.json'])
readmes=[s for s in plan['files'] if s['destination']=='README.md'];check(len(readmes)==1,'Actual plan has one explicit README')
check(payloads['README.md']==Path(readmes[0]['source']).read_bytes(),'Explicit accepted-release README preserved byte-identically')
for row in manifest['files']:assert len(payloads[row['file']])==row['bytes'] and sha(payloads[row['file']])==row['sha256'],row['file']
check(True,'Every actual-plan retained manifest member matches output bytes and hash')
for row in audit['additional_files']:
 name=str(Path(row['path']).relative_to(plan['package_root']));assert len(payloads[name])==row['bytes'] and sha(payloads[name])==row['sha256']
check(True,'Audit pins match actual README and manifest payloads')
check(set(add_list['files'])=={plan['package_root']+'/'+name for name in payloads},'Add-list exactly covers prepared payloads')
default=copy.deepcopy(plan);default['files']=[s for s in default['files'] if s['destination']!='README.md']
old['config_check'](default);new['config_check'](default)
prior_default=old['prepare'](default);next_default=new['prepare'](default)
check(prior_default==next_default,'Without explicit README every default payload,audit and add-list remains byte-identical to original')
for name,mutator in [
 ('Reserved manifest destination still refused',lambda c:c['files'].append({**readmes[0],'destination':'packaging-manifest.json'})),
 ('Unpinned explicit README refused',lambda c:c['files'][next(i for i,s in enumerate(c['files']) if s['destination']=='README.md')].pop('expected_original_sha256')),
 ('Transformed explicit README refused',lambda c:c['files'][next(i for i,s in enumerate(c['files']) if s['destination']=='README.md')].update(transform='github_run')),
 ('README directory root refused',lambda c:(c.update(files=[s for s in c['files'] if s['destination']!='README.md']),c['roots'].append({**c['roots'][0],'destination':'README.md'})))
]:
 c=copy.deepcopy(plan);mutator(c);refused(c,name)
try:old['config_check'](plan)
except ValueError as e:original_refusal=str(e)
else:raise AssertionError('Old explicit README configuration must remain refused')
check(original_refusal=='Generated package metadata names are reserved','Original configuration refusal remains a real historical failure')
record=dict(kind='Independent offline review of packaging-only explicit README derivative',pass_=True,reviewed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),original=pin(ORIGINAL),derivative=pin(DERIVATIVE),plan=pin(PLAN),checks=checks,check_count=len(checks),actual_prepare=dict(retained_manifest_members=len(manifest['files']),prepared_payloads=len(payloads),manifest_sha256=sha(payloads['packaging-manifest.json']),explicit_readme_sha256=sha(payloads['README.md']),privacy_findings=manifest['privacy_scan']['findings'],payload_manifest_bindings_match=True),scope=['Pinned exact README auxiliary may replace generated fallback; manifest destination remains reserved.','setdefault retains provided README.','Original count derives from retained manifest entries.'],default_behavior_byte_identical=True,release_validation_changed=False,repository_writes=False,HTTP_requests=0,materialized_package=False)
record['pass']=record.pop('pass_')
for c in record['checks']:c['pass']=c.pop('pass_')
p=ROOT/'review.json';assert not p.exists();p.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(dict(review=pin(p),checks=len(checks),retained=len(manifest['files']),prepared=len(payloads))))
