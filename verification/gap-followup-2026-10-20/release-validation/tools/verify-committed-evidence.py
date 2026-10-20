"""Read-only committed evidence verification; never reads worktree evidence bytes.
Usage: python /tmp/mr-verify-committed-evidence.py REPO COMMIT CONFIG_JSON NEW_OUTPUT
CONFIG {coverage_roots:[repo-relative directories], manifests:[{path,base,
entries_key:'files'|'requests', require_pass:true|false}], additional_files:[
{path,sha256,bytes?}]}. Every required input path must exist as a normal Git blob.
The output is a standalone committed-tree package manifest, not release approval.
"""
import hashlib,json,pathlib,re,subprocess,sys

def require(condition,message):
    if not condition: raise ValueError(message)
def relative(value):
    require(isinstance(value,str) and value and '\x00' not in value and '\\' not in value,'Invalid relative path')
    p=pathlib.PurePosixPath(value)
    require(not p.is_absolute() and all(x not in ('','.','..') for x in value.split('/')),'Unsafe relative path: '+value)
    return str(p)
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    require(len(sys.argv)==5,'REPO COMMIT CONFIG_JSON NEW_OUTPUT required')
    repo=pathlib.Path(sys.argv[1]).resolve();commit=sys.argv[2];config_path=pathlib.Path(sys.argv[3]).resolve();out=pathlib.Path(sys.argv[4]).resolve()
    require(re.fullmatch('[a-f0-9]{40}',commit) is not None,'Exact40-character commit required')
    require(not out.exists(),'Output must be new')
    require(not out.is_relative_to(repo),'Output must remain outside repository')
    config_bytes=config_path.read_bytes();config=json.loads(config_bytes)
    def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],stderr=subprocess.PIPE)
    require(git('rev-parse','--verify',commit+'^{commit}').decode().strip()==commit,'Exact commit object required')
    tree=git('rev-parse',commit+'^{tree}').decode().strip();index={}
    for entry in git('ls-tree','-rz','--full-tree',commit).split(b'\0'):
        if not entry:continue
        meta,path=entry.split(b'\t',1);mode,kind,oid=meta.decode().split();name=path.decode('utf-8')
        index[name]={'mode':mode,'kind':kind,'git_blob':oid}
    roots=[relative(x) for x in config['coverage_roots']];require(roots and len(roots)==len(set(roots)),'Unique nonempty coverage roots required')
    def covered(path):return any(path==r or path.startswith(r+'/') for r in roots)
    failures=[];verified={};manifests=[];checked_records=0
    proc=subprocess.Popen(['git','-C',str(repo),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    cache={}
    def blob(path):
        path=relative(path);require(covered(path),'Required file outside coverage roots: '+path)
        require(path in index,'Missing committed blob: '+path)
        entry=index[path];require(entry['kind']=='blob' and entry['mode'] in ('100644','100755'),'Symlink or non-regular evidence: '+path)
        oid=entry['git_blob']
        if oid not in cache:
            proc.stdin.write((oid+'\n').encode());proc.stdin.flush();header=proc.stdout.readline().decode().strip().split()
            require(len(header)==3 and header[0]==oid and header[1]=='blob','Invalid cat-file response')
            data=proc.stdout.read(int(header[2]));require(len(data)==int(header[2]) and proc.stdout.read(1)==b'\n','Truncated Git blob')
            cache[oid]=data
        data=cache[oid];verified[path]={'path':path,**entry,'bytes':len(data),'sha256':sha(data)};return data
    try:
        for spec in config['manifests']:
            path=relative(spec['path']);base=relative(spec['base']);key=spec.get('entries_key','files');require(key in ('files','requests'),'Supported manifest entries required')
            try:
                data=blob(path);manifest=json.loads(data)
                if spec.get('require_pass',False):require(manifest.get('pass') is True,'Required successful manifest: '+path)
                rows=manifest.get(key);require(isinstance(rows,list) and rows,'Nonempty manifest records required: '+path)
                seen=set();local_count=0
                for row in rows:
                    if key=='requests' and not row.get('file'):
                        require((row.get('method')=='HEAD' or row.get('conditional') is True) and row.get('bytes')==0 and row.get('sha256')==sha(b''),'Unretained request body in '+path)
                        continue
                    name=relative(row.get('file'));full=relative(base+'/'+name);require(full not in seen,'Duplicate manifest file: '+full);seen.add(full)
                    require(type(row.get('bytes')) is int and row['bytes']>=0 and re.fullmatch('[a-f0-9]{64}',row.get('sha256','')) is not None,'Invalid expected byte/hash metadata: '+full)
                    try:
                        actual=blob(full);require(len(actual)==row['bytes'],'Committed length mismatch: '+full);require(sha(actual)==row['sha256'],'Committed SHA256 mismatch: '+full);local_count+=1;checked_records+=1
                    except (ValueError,OSError) as error:failures.append(str(error))
                manifests.append({'path':path,'git_blob':index[path]['git_blob'],'bytes':len(data),'sha256':sha(data),'entries_key':key,'verified_records':local_count,'expected_records':len(seen),'source_pass':manifest.get('pass'),'require_pass':spec.get('require_pass',False)})
            except (ValueError,KeyError,TypeError,OSError) as error:failures.append(str(error))
        for item in config.get('additional_files',[]):
            try:
                path=relative(item['path']);expected=item['sha256'];require(re.fullmatch('[a-f0-9]{64}',expected) is not None,'Explicit additional evidence hash required');data=blob(path);require(sha(data)==expected,'Additional evidence hash mismatch: '+path)
                if 'bytes' in item:require(len(data)==item['bytes'],'Additional evidence length mismatch: '+path)
            except (ValueError,KeyError,TypeError,OSError) as error:failures.append(str(error))
        for root in roots:require(any(name==root or name.startswith(root+'/') for name in index),'Missing committed coverage root: '+root)
        for path in sorted(index):
            if covered(path):
                try:blob(path)
                except (ValueError,OSError) as error:failures.append(str(error))
    finally:
        proc.stdin.close();proc.stdout.close();proc.stderr.close();require(proc.wait()==0,'Git object reader failed')
    report={'kind':'Read-only committed-tree evidence package verification; no release or scheduled acceptance','pass':not failures,'commit':commit,'tree':tree,'config_sha256':sha(config_bytes),'coverage_roots':roots,'manifest_records_verified':checked_records,'manifests':manifests,'files':[verified[p] for p in sorted(verified)],'failures':failures,'ignored_worktree_files_do_not_count':True,'worktree_evidence_read':False,'repository_written':False,'network_calls':0}
    with out.open('x') as stream:json.dump(report,stream,indent=2);stream.write('\n')
    print(json.dumps({'pass':report['pass'],'commit':commit,'tree':tree,'verified_files':len(verified),'verified_manifest_records':checked_records,'failure_count':len(failures),'output':str(out)}))
    return 0 if report['pass'] else 1
if __name__=='__main__':
    try:sys.exit(main())
    except (ValueError,KeyError,TypeError,OSError,subprocess.CalledProcessError) as error:print(json.dumps({'pass':False,'error':str(error)}),file=sys.stderr);sys.exit(2)
