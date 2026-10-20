#!/usr/bin/env python3
"""Derive native data from a captured wrapper; no HTTP or runtime reader imports."""
from pathlib import Path
import hashlib,json,sys
if len(sys.argv)!=3:raise SystemExit('CAPTURE.json FRESH_NATIVE.json')
source=Path(sys.argv[1]);target=Path(sys.argv[2]);raw=source.read_bytes();body=json.loads(raw)
assert body['fixture'] is False and body['body']['sources']['grid_day']['status']=='ok'
native=body['body']['grid_day'];assert native['status']=='ok'
data=(json.dumps(native,separators=(',',':'),ensure_ascii=False)+'\n').encode()
with target.open('xb') as f:f.write(data)
proof={'transformation':'Parse captured JSON and serialize body.grid_day without changing values; this is not a new acquisition.','source_file':source.name,'source_bytes':len(raw),'source_sha256':hashlib.sha256(raw).hexdigest(),'output_file':target.name,'output_bytes':len(data),'output_sha256':hashlib.sha256(data).hexdigest()}
with target.with_suffix('.derivation.json').open('x') as f:json.dump(proof,f,indent=2);f.write('\n')
print(json.dumps(proof))
