#!/usr/bin/env python3
"""Prepare explicit NI+CQC+accepted-package coverage; never writes repository or Git."""
import argparse,hashlib,json,pathlib,sys
from auditlib import *
a=argparse.ArgumentParser(description=__doc__);a.add_argument('repository');a.add_argument('new_output');a.add_argument('--preview-payload');args=a.parse_args()
r=pathlib.Path(args.repository).resolve();out=pathlib.Path(args.new_output).resolve();overlay=pathlib.Path(args.preview_payload).resolve()if args.preview_payload else None
need(not out.exists() and not out.is_relative_to(r),'Output must be new and outside repository')
def get(path):
 relative(path);p=r/path
 if not p.exists() and overlay:p=overlay/path
 need(p.is_file() and not p.is_symlink(),'Missing regular input '+path);before=p.stat();data=p.read_bytes();after=p.stat();need((before.st_size,before.st_mtime_ns)==(after.st_size,after.st_mtime_ns),'Input changed while reading '+path);return data
configs={k:json.loads(get(HISTORY+'/'+k+'-audit-config.json'))for k in ['ni','cqc']}
audits={k:json.loads(get(HISTORY+'/'+k+'-committed-tree-audit.json'))for k in ['ni','cqc']}
for k in configs:
 need(audits[k]['pass']is True,'Prior audit failed');need(audits[k]['config_sha256']==sha(get(HISTORY+'/'+k+'-audit-config.json')),'Prior config/audit mismatch')
need(len(audits['ni']['files'])==1729 and audits['ni']['manifest_records_verified']==1335,'Wrong NI baseline coverage')
need(len(audits['cqc']['files'])==593 and len(configs['cqc']['custom_manifest_bindings'])==576,'Wrong CQC source coverage')
relocations=json.loads(get(HISTORY+'/relocations.json'))['records'];mapping={}
for row in relocations:
 key=(row['original_path'],row['sha256']);need(key not in mapping,'Duplicate historical key');mapping[key]=row
 raw=get(row['retained_path']);need(sha(raw)==row['sha256']and len(raw)==row['bytes'],'Historical snapshot mismatch '+row['retained_path'])
def target(path,h):return mapping.get((path,h),{}).get('retained_path',path)
roots=list(dict.fromkeys(configs['ni']['coverage_roots']+configs['cqc']['coverage_roots']+[PKG]))
def covered(p):return any(p==x or p.startswith(x+'/')for x in roots)
files={};prior=[]
def bind(path,expected=None):
 relative(path);need(covered(path),'Outside declared coverage '+path);raw=get(path);row={'path':path,'sha256':sha(raw),'bytes':len(raw)}
 if expected:need(row['sha256']==expected['sha256']and('bytes'not in expected or row['bytes']==expected['bytes']),'Historical expected pin mismatch '+path)
 need(path not in files or files[path]==row,'Conflicting explicit pin '+path);files[path]=row
for key,c in configs.items():
 for i,row in enumerate(c['additional_files']):
  dest=target(row['path'],row['sha256']);bind(dest,row);prior.append({'source_configuration':HISTORY+'/'+key+'-audit-config.json','source_record_index':i,'original_path':row['path'],'retained_path':dest,'sha256':row['sha256'],'bytes':row.get('bytes')})
relations=relationships(configs['cqc'],get)
for row in relations:
 row['retained_target']=target(row['original_target'],row['sha256']);bind(row['retained_target'],{k:row[k]for k in ['sha256','bytes']if row[k]is not None})
# Inventory the actual required physical roots, including ignored logs. Preview
# additionally inventories only explicit prepared historical payload, never claims commit membership.
for root in roots:
 for start in [r/root]+([overlay/root]if overlay else []):
  if not start.exists():continue
  for p in ([start]if start.is_file()else sorted(start.rglob('*'))):
   if p.is_file()and'__pycache__'not in p.parts and p.suffix!='.pyc':bind(str(p.relative_to(overlay if overlay and p.is_relative_to(overlay)else r)))
manifest_specs=[]
for c in configs.values():
 for spec in c['manifests']:
  if spec not in manifest_specs:manifest_specs.append(spec)
package_manifest=PKG+'/packaging-manifest.json'
if not overlay:
 get(package_manifest);manifest_specs.append({'path':package_manifest,'base':PKG,'entries_key':'files','require_pass':False})
config={'coverage_roots':roots,'manifests':manifest_specs,'additional_files':[files[k]for k in sorted(files)],'historical_pin_relationships':prior,'custom_binding_relationships':relations,'historical_relocation_manifest':HISTORY+'/relocations.json','prior_verified_coverage':{'ni':{'files':1729,'direct_manifest_records':1335},'cqc_source':{'files':593,'direct_manifest_records':87,'custom_relationship_records':576}},'final_ready':not bool(overlay),'notes':['Explicit union of previous NI audited coverage, CQC source coverage and new CQC accepted package; not a claim that all repository files were independently manifest-reconciled.','Original historical manifests are unchanged; overwritten source pins resolve only by exact original path plus SHA to exact Git snapshots.','Prior config additional pins, custom manifest relationships and direct package/request records are separately verified; counts are not conflated.','Preview is local preparation only. A final exact committed-tree audit must pass after packaging, documentation updates and commit.']}
out.mkdir();(out/'audit-config.json').write_text(json.dumps(config,indent=2)+'\n');(out/'add-list.txt').write_text('\n'.join(sorted(files))+'\n')
report={'pass':True,'preparation_only':True,'final_ready':not bool(overlay),'covered_physical_files':len(files),'direct_manifests':len(manifest_specs),'historical_pin_relationships':len(prior),'custom_binding_relationships':len(relations),'snapshots':len(relocations),'config_sha256':sha((out/'audit-config.json').read_bytes()),'repository_written':False,'network_calls':0}
(out/'preparation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
