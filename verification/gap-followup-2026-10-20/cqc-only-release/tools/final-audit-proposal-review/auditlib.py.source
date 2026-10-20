import hashlib,json,pathlib,posixpath,re
PKG='verification/gap-followup-2026-10-20/cqc-only-release'
HISTORY=PKG+'/audit-history'
F='verification/gap-followup-2026-10-20'
def sha(b):return hashlib.sha256(b).hexdigest()
def need(ok,msg):
 if not ok:raise ValueError(msg)
def relative(s):
 need(isinstance(s,str) and s and not s.startswith('/') and '\\'not in s and all(x not in ('','.','..')for x in s.split('/')),'Unsafe relative path: '+str(s));return s
def normalized(s):return relative(posixpath.normpath(s))
def field(doc,pointer):
 for part in pointer:doc=doc[part]
 return doc
def candidates(obj,pointer=()):
 if isinstance(obj,dict):
  h=obj.get('sha256');decl=obj.get('path',obj.get('file'))
  if h and decl:yield {'declared':decl,'sha256':h,'bytes':obj.get('bytes'),'pointer':list(pointer)}
  for k,v in obj.items():
   if isinstance(v,str) and re.fullmatch('[0-9a-f]{64}',v) and k!='sha256':yield {'declared':k,'sha256':v,'bytes':None,'pointer':list(pointer)+( [k] )}
   elif isinstance(v,dict) and v.get('sha256') and not v.get('path') and not v.get('file'):
    yield {'declared':k,'sha256':v['sha256'],'bytes':v.get('bytes'),'pointer':list(pointer)+[k]}
   if isinstance(v,(dict,list)):yield from candidates(v,pointer+(k,))
 elif isinstance(obj,list):
  for i,v in enumerate(obj):yield from candidates(v,pointer+(i,))
def origin_parts(label):
 m=re.fullmatch(r'([^#]+\.json)(?:#([^ ]+))?(?: \[harness_root=([^\]]+)\])?',label);need(m,'Unknown manifest origin '+label);return m.groups()
def resolve_declared(origin,declared,expected,source_config,snapshot_records):
 path,section,harness=origin_parts(origin);key=path+('#'+section if section else '')+'::'+declared
 if key in source_config.get('historical_relocations',{}):return source_config['historical_relocations'][key]
 if declared=='worker.js'or declared.startswith(('lib/','test/','scripts/','verification/','operations/')):target=relative(declared)
 else:
  base=harness or str(pathlib.PurePosixPath(path).parent)
  if path==F+'/combined-aemo-cqc/next-day-unpublished/evidence/failure-manifest.json':base=str(pathlib.PurePosixPath(base).parent)
  target=normalized(base+'/'+declared)
 for row in snapshot_records:
  if (row['original_path'],row['sha256'])==(target,expected):return row['path']
 return target
def relationships(source_config,get):
 old_snapshots=json.loads(get(F+'/cqc-only/historical-relocations.json'))['records'];out=[]
 for i,row in enumerate(source_config.get('custom_manifest_bindings',[])):
  origin,section,_=origin_parts(row['manifest']);doc=json.loads(get(origin));selected=doc[section]if section else doc;prefix=[section]if section else []
  matches=[]
  for candidate in candidates(selected):
   if candidate['sha256']!=row['sha256']or candidate['bytes']not in (None,row.get('bytes')):continue
   try:target=resolve_declared(row['manifest'],candidate['declared'],row['sha256'],source_config,old_snapshots)
   except ValueError:continue
   if target==row['path']:matches.append({**candidate,'pointer':prefix+candidate['pointer']})
  need(matches,'Cannot reconstruct original custom binding '+str(i)+' '+row['manifest']+' -> '+row['path'])
  # Duplicate identical declarations are retained by pointer; no hash-only association.
  chosen=matches[0];out.append({'source_record_index':i,'manifest':row['manifest'],'origin_file':origin,'origin_pointer':chosen['pointer'],'declared_path':chosen['declared'],'original_target':row['path'],'sha256':row['sha256'],'bytes':row.get('bytes')})
 return out
