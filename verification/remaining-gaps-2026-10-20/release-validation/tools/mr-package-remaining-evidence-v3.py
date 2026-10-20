#!/usr/bin/env python3
"""Offline immutable evidence packager. No Git, network or deployment mutations.

validate-plan CONFIG checks only configuration structure; it never copies inputs.
package CONFIG --output NEW_DIR --audit-config NEW_JSON --add-list NEW_JSON
requires an explicit completed production gate. All timestamps come from CONFIG.
"""
import argparse, hashlib, json, pathlib, re, sys

def need(value, message):
    if not value: raise ValueError(message)
def digest(data): return hashlib.sha256(data).hexdigest()
def encoded(value): return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)+'\n').encode()
def rel(value):
    need(isinstance(value,str) and value and '\\' not in value and '\x00' not in value, 'Invalid relative path')
    p=pathlib.PurePosixPath(value)
    need(not p.is_absolute() and all(x not in ('','.','..') for x in value.split('/')), 'Unsafe relative path')
    return str(p)
def absolute(value):
    p=pathlib.Path(value);need(p.is_absolute(), 'Absolute original path required');return p
PATTERNS={
 'private_header':r'''(?im)(?:^\s*|["'])(?:authorization|proxy-authorization|cookie|set-cookie|cf-access-client-secret|cf-workers-preview-token|x-api-key)["']?\s*:''',
 'signed_url':r'(?i)[?&](?:x-amz-signature|x-goog-signature|sig|signature|token|access_token)=',
 'token_or_private_key':r'(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)',
 'email':r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
}
POLICY_AUTHORIZATION_SHA256={'bounded_verification_continuation': '0c53b861506197e52157d664aa82d9f14d53bc0269cfe7aa0c471a2867c194f7', 'us_desk_candidate': '2db57f31161a4b415c120da0bec63944cfe977bab377123c2cc5ebbb0cc18089', 'claimant_count_release': '7d6e875b900992217b4aca48360ba0ee3f5c6e8a5769fe5275d3b2a47e8fe550', 'nz_market_rent_release': '443ac1c405a4e787aeec13babd8962fee215ab7cae9bae142ddf0912dc150796', 'statcan_gdp_release': '443ac1c405a4e787aeec13babd8962fee215ab7cae9bae142ddf0912dc150796', 'gap_pass_release': '4cf338f050c35c2d5cbc8b499c6bb963ba9b2281c9b9c577ef54a7718216a87e', 'remaining_gaps_release': '4cf338f050c35c2d5cbc8b499c6bb963ba9b2281c9b9c577ef54a7718216a87e'}
def scan(data):
    text=data.decode('utf-8',errors='replace');private_text=text
    # These exact public user-scope sentences are not HTTP credentials. Only
    # their named top-level ledger fields are excluded from the header-key scan.
    try:
        parsed=json.loads(text)
        if isinstance(parsed,dict):
            for key,expected in POLICY_AUTHORIZATION_SHA256.items():
                row=parsed.get(key)
                if isinstance(row,dict) and isinstance(row.get('authorization'),str) and digest(row['authorization'].encode())==expected:
                    del row['authorization']
            private_text=json.dumps(parsed,ensure_ascii=False)
    except (ValueError,TypeError):pass
    return [name for name,pattern in PATTERNS.items() if re.search(pattern,private_text if name=='private_header' else text)]
def read_stable(path):
    need(path.is_file() and not path.is_symlink(),'Original must be a regular file: '+str(path))
    before=path.stat();data=path.read_bytes();after=path.stat()
    need((before.st_size,before.st_mtime_ns)==(after.st_size,after.st_mtime_ns) and len(data)==after.st_size,'Original changed while read: '+str(path))
    return data

def transform(data,kind):
    if kind=='exact': return data,'none; byte-identical'
    d=json.loads(data)
    if kind=='github_run':
        fields=['id','name','head_branch','head_sha','path','display_title','run_number','event','status','conclusion','workflow_id','check_suite_id','url','html_url','created_at','updated_at','run_attempt','run_started_at','jobs_url','artifacts_url','previous_attempt_url','workflow_url']
        need(all(k in d for k in ['id','head_sha','status','conclusion','path']),'Expected original GitHub run response')
        out={k:d[k] for k in fields if k in d}
        out['pull_requests']=[{'number':r['number'],'url':r['url'],'head':{k:r['head'][k] for k in ['ref','sha']},'base':{k:r['base'][k] for k in ['ref','sha']}} for r in d.get('pull_requests',[])]
        if 'head_commit' in d:out['head_commit']={k:d['head_commit'][k] for k in ['id','tree_id','message','timestamp'] if k in d['head_commit']}
        note='Allowlisted original workflow/run/attempt/commit/PR provenance; actor/author/committer/contact and duplicate repository profile fields omitted.'
    elif kind=='github_commit':
        need(all(k in d for k in ['sha','tree','parents','message']),'Expected original GitHub Git-commit response')
        out={k:d[k] for k in ['sha','node_id','url','html_url','tree','message','parents'] if k in d}
        note='Allowlisted commit/tree/parents and repository URLs; author/committer/contact and signature metadata omitted.'
    elif kind=='deployment':
        need(isinstance(d,dict) and all(k in d for k in ['id','versions','created_on']),'Expected original deployment response')
        out={k:v for k,v in d.items() if k!='author_email'}
        note='Removed author_email only; original deployment ID, time, versions, strategy and annotations retained.'
    elif kind=='deployments':
        need(isinstance(d,list) and all(isinstance(x,dict) and all(k in x for k in ['id','versions','created_on']) for x in d),'Expected original deployment collection')
        out=[{k:v for k,v in x.items() if k!='author_email'} for x in d]
        note='Removed author_email only; original deployment order, IDs, times, versions, strategy and annotations retained.'
    else: raise ValueError('Unsupported transformation')
    return encoded(out),note

def config_check(c):
    need(c.get('schema_version')==1,'Schema version1 required')
    need(isinstance(c.get('recorded_at'),str) and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)',c['recorded_at']),'Explicit fixed UTC recorded_at required')
    need(re.fullmatch('[a-f0-9]{40}',c.get('source_revision','')) is not None,'Exact source revision required')
    need(re.fullmatch('[a-f0-9-]{36}',c.get('worker_version','')) is not None,'Exact Worker version required')
    need(isinstance(c.get('build_fingerprint'),str) and re.fullmatch('[a-f0-9]{16}',c['build_fingerprint']),'Exact build fingerprint required')
    rel(c['package_root']);absolute(c['repository']);absolute(c['production_gate'])
    need(isinstance(c.get('roots'),list) and c['roots'],'Explicit original roots required')
    need(isinstance(c.get('files'),list),'Explicit auxiliary file inventory required')
    destinations=[]
    for spec in c['roots']:
        absolute(spec['source']);destinations.append(rel(spec['destination']))
        need(spec.get('role') in ['accepted_stage','accepted_production','failed_attempt','held_evidence'],'Explicit root evidence role required')
        if spec['role'].startswith('accepted_'):need(spec.get('summary') and spec.get('expected_pass') is True,'Accepted root requires successful summary')
        if spec.get('summary'):rel(spec['summary']);need(type(spec.get('expected_pass')) is bool,'Summary pass expectation must be explicit')
    for spec in c['files']:
        absolute(spec['source']);destinations.append(rel(spec['destination']))
        need(spec.get('transform') in ['exact','github_run','github_commit','deployment','deployments'],'Explicit auxiliary transformation required')
        need(isinstance(spec.get('role'),str) and spec['role'],'Auxiliary evidence role required')
    need(len(destinations)==len(set(destinations)),'Duplicate destination')
    need(not set(destinations)&{'packaging-manifest.json','README.md'},'Generated package metadata names are reserved')
    for a in destinations:
        for b in destinations:need(a==b or not a.startswith(b+'/'),'Overlapping destinations')
    return c

def check_summary(raw,root,expected_pass,revision=None,version=None):
    d=json.loads(raw);need(d.get('pass') is expected_pass,'Unexpected original summary outcome')
    if expected_pass:
        need(d.get('last_step')=='complete' and d.get('exit_code')==0,'Original successful run incomplete')
        need(d.get('steps') and all(s.get('pass') is True and s.get('exit_code')==0 for s in d['steps']),'Incomplete or failed accepted step')
    if revision:need(d.get('revision')==revision and d.get('version')==version,'Wrong candidate identity in summary')
    need(isinstance(d.get('files'),list) and d['files'],'Original summary must bind its files')
    for f in d['files']:
        name=rel(f['file']);data=read_stable(root/name)
        need(len(data)==f['bytes'] and digest(data)==f['sha256'],'Original summary file binding failed: '+name)
    return d

def prepare(c):
    need(c.get('production_acceptance_confirmed') is True,'Root production acceptance confirmation required before copying')
    gate=absolute(c['production_gate']);check_summary(read_stable(gate),gate.parent,True,c['source_revision'],c['worker_version'])
    payloads={};entries=[];relocations=[];summaries=[]
    def add(source,destination,role,kind='exact'):
        name=rel(destination);need(name not in payloads,'Duplicate retained file');raw=read_stable(source)
        if role=='source_ci':
            ci=json.loads(raw);need(kind=='github_run' and ci.get('head_sha')==c['source_revision'] and ci.get('status')=='completed' and ci.get('conclusion')=='success','Exact-source completed CI success required')
        out,note=transform(raw,kind)
        findings=scan(out);need(not findings,'Sensitive retained content categories '+','.join(findings)+' in '+name)
        payloads[name]=out;entry={'file':name,'bytes':len(out),'sha256':digest(out),'original_path':str(source),'original_bytes':len(raw),'original_sha256':digest(raw),'role':role,'transformation':note};entries.append(entry)
    for spec in sorted(c['roots'],key=lambda s:s['destination']):
        root=absolute(spec['source']);need(root.is_dir() and not root.is_symlink(),'Original directory missing or symlink')
        if spec.get('summary'):
            s=root/spec['summary'];d=check_summary(read_stable(s),root,spec['expected_pass'],c['source_revision'] if spec['role'].startswith('accepted_') else None,c['worker_version'])
            summaries.append({'file':spec['destination']+'/'+spec['summary'],'sha256':digest(read_stable(s)),'pass':d['pass'],'phase':d.get('phase'),'role':spec['role']})
        sources=sorted(root.rglob('*'));need(any(p.is_file() for p in sources),'Empty original evidence root')
        for p in sources:
            need(not p.is_symlink(),'Symlinks are not evidence originals')
            if p.is_file():add(p,spec['destination']+'/'+str(p.relative_to(root)),spec['role'])
        relocations.append({'original_prefix':str(root),'retained_prefix':c['package_root']+'/'+spec['destination']})
    for spec in sorted(c['files'],key=lambda s:s['destination']):add(absolute(spec['source']),spec['destination'],spec['role'],spec['transform'])
    relocations.append({'original_prefix':c['repository'],'retained_prefix':'repository root'})
    entries.sort(key=lambda e:e['file']);logs=[e['file'] for e in entries if e['file'].endswith('.log')]
    manifest={'kind':'Deterministic immutable phase-two evidence package; no remote or Git mutations','recorded_at':c['recorded_at'],'source_revision':c['source_revision'],'worker_version':c['worker_version'],'build_fingerprint':c['build_fingerprint'],'files':entries,'source_summaries':summaries,'relocations':relocations,'privacy_scan':{'retained_files':len(entries),'findings':0,'categories':list(PATTERNS)},'log_files':logs,'boundary':['Original failures and held-source outcomes retain their original pass/status values.','Only declared GitHub/deployment personal metadata excerpts are transformed; original and retained hashes are distinct.','Original report absolute paths are not rewritten; use relocation mappings.','File-system verification does not establish committed evidence completeness; the emitted committed-tree audit is mandatory.']}
    payloads['packaging-manifest.json']=encoded(manifest)
    payloads['README.md']=('''# Phase-two retained release evidence\n\nOriginal captures, completed runs, explicitly listed failed/held attempts and smoke logs are retained with their exact bytes and original outcomes. `packaging-manifest.json` binds every original by retained/original bytes and SHA-256, records any personal-metadata transformation, and supplies path relocations. No original report was rewritten.\n\nThe package uses explicit inputs and a fixed packaging timestamp. It cannot establish seven-day SHADOW, delivery receipt or acceptance of blocked sources. It requires a passing completed production summary before copying.\n\nGit ignores logs by default. Use the emitted exact add-list and force-add only its reviewed evidence paths, then run `/tmp/mr-verify-committed-evidence.py` against the exact resulting commit and emitted audit configuration. Do not call the package complete based only on local file hashes or `git status`. The committed audit must pass again for the pushed exact tree before merge.\n''').encode()
    audit={'coverage_roots':[c['package_root']],'manifests':[{'path':c['package_root']+'/packaging-manifest.json','base':c['package_root'],'entries_key':'files','require_pass':False}],'additional_files':[{'path':c['package_root']+'/'+name,'bytes':len(payloads[name]),'sha256':digest(payloads[name])} for name in ['packaging-manifest.json','README.md']]}
    add_list={'kind':'Explicit reviewed evidence paths; no Git command is executed','files':[c['package_root']+'/'+name for name in sorted(payloads)],'requires_force_add_logs':[c['package_root']+'/'+name for name in logs]}
    return payloads,audit,add_list

def main():
    ap=argparse.ArgumentParser(description=__doc__);sp=ap.add_subparsers(dest='mode',required=True)
    v=sp.add_parser('validate-plan');v.add_argument('config')
    p=sp.add_parser('package');p.add_argument('config');p.add_argument('--output',required=True);p.add_argument('--audit-config',required=True);p.add_argument('--add-list',required=True)
    a=ap.parse_args();raw=pathlib.Path(a.config).read_bytes();c=config_check(json.loads(raw))
    if a.mode=='validate-plan':print(json.dumps({'valid_plan':True,'roots':len(c['roots']),'auxiliary_files':len(c['files']),'copies':0,'network':0,'git_mutations':0}));return
    output=pathlib.Path(a.output).resolve();auditout=pathlib.Path(a.audit_config).resolve();addout=pathlib.Path(a.add_list).resolve();repo=absolute(c['repository']).resolve()
    need(output==repo/c['package_root'],'Output must equal the exact configured repository package root')
    need(not auditout.is_relative_to(repo) and not addout.is_relative_to(repo),'Audit configuration and add-list must remain outside repository')
    need(not output.exists() and not auditout.exists() and not addout.exists(),'Refusing to overwrite retained evidence or controls')
    payloads,audit,add_list=prepare(c)
    # No file is copied until all originals, summary hashes and privacy scans pass.
    output.mkdir(parents=True,exist_ok=False)
    for name,data in sorted(payloads.items()):
        dst=output/name;dst.parent.mkdir(parents=True,exist_ok=True)
        with dst.open('xb') as f:f.write(data)
        need(dst.read_bytes()==data,'Copied bytes differ')
    with auditout.open('xb') as f:f.write(encoded(audit))
    with addout.open('xb') as f:f.write(encoded(add_list))
    print(json.dumps({'packaged_originals':len(payloads)-2,'packaged_files':len(payloads),'log_files':len(add_list['requires_force_add_logs']),'config_sha256':digest(raw),'manifest_sha256':digest(payloads['packaging-manifest.json']),'audit_config':str(auditout),'add_list':str(addout),'git_mutations':0,'network':0}))
if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,TypeError,OSError,json.JSONDecodeError) as e:print(json.dumps({'pass':False,'error':str(e)}),file=sys.stderr);sys.exit(1)
