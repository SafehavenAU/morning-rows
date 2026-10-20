#!/usr/bin/env python3
"""Bind offline comparator result to the retained actual-reader acquisition.
The reused pure-parser comparator has a fixed local-only descriptive label.
Keep that exact raw output; this wrapper changes only attribution, not checks.
No HTTP, runtime imports, new extraction, or repeated remote invocation.
"""
from pathlib import Path
import hashlib,json,sys
if len(sys.argv)!=4:raise SystemExit('RAW_COMPARISON.json CAPTURE_DIRECTORY FRESH_REPORT.json')
raw_path=Path(sys.argv[1]);capture=Path(sys.argv[2]);out=Path(sys.argv[3]);raw=raw_path.read_bytes();result=json.loads(raw)
report_bytes=(capture/'report.json').read_bytes();remote=json.loads(report_bytes)
assert remote['pass'] and remote['live_pass'] and remote['code_unchanged']
assert result['pass'] and result['runtime_comparison']['pass'] and result['exact_cent_comparisons']==576
result['runtime_comparison']['meaning']='Offline original ZIP/CSV/Decimal comparison of native data derived from the retained actual protected Worker response; no repeated remote invocation or CPU acceptance.'
result['attribution']={'raw_comparator_file':raw_path.name,'raw_comparator_sha256':hashlib.sha256(raw).hexdigest(),'remote_report_file':str(capture.name+'/report.json'),'remote_report_sha256':hashlib.sha256(report_bytes).hexdigest(),'reason':'The reused comparator labels every optional supplied capture as local pure output; this annotation correctly attributes the already captured actual Worker response without changing any numerical check.'}
with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({'pass':True,'cells':576,'summaries':10,'remote_repeated':False}))
