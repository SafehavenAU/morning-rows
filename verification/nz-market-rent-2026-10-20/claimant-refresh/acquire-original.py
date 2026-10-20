#!/usr/bin/env python3
"""Acquire the three exact no-key official Nomis specimens once each."""
import concurrent.futures, datetime, hashlib, json, tempfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = 'https://www.nomisweb.co.uk/api/v01/dataset/NM_162_1'
QUERY = '?geography=K02000001,E92000001,S92000003,W92000004,N92000002&date=latestMINUS12-latest&gender=0&age=0&measure=1&measures=20100'
URLS = [('nomis-national.csv', BASE+'.data.csv'+QUERY), ('nomis-national.excerpt.json', BASE+'.data.json'+QUERY), ('nomis-time.json', BASE+'/time.def.sdmx.json')]
RAW = Path(tempfile.mkdtemp(prefix='mr-claimant-refresh-wire-'))
def clock(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def acquire(item):
    name, url = item
    started = clock()
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Morning-Rows-official-aggregate-verification/1.0'}), timeout=30) as response:
        body = response.read(524289)
        assert len(body) <= 524288, 'Response exceeds bounded specimen size'
        assert response.status == 200 and response.url == url, 'Unexpected response or redirect'
        record = {'url':url,'status':response.status,'content_type':response.headers.get('Content-Type'),'final_url':response.url,'started_at':started,'finished_at':clock(),'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()}
    rawname = name.replace('.excerpt','')
    (RAW/rawname).write_bytes(body)
    record['original_file_outside_repository'] = str(RAW/rawname)
    if name.endswith('.json'):
        document = json.loads(body)
        header = document.get('structure',{}).get('header', document.get('header',{}))
        removed = 'sender' in header
        header.pop('sender', None)
        retained = (json.dumps(document,indent=2,ensure_ascii=False)+'\n').encode()
        record.update(retained_file=name,retained_sha256=hashlib.sha256(retained).hexdigest(),retained_bytes=len(retained),retained_is_wire_original=False,transformation='JSON parsed and reserialized; only publisher contact header.sender removed when present. All observation and time codelist data retained unchanged.',sender_removed=removed)
    else:
        retained = body
        record['file'] = name
    with (ROOT/name).open('xb') as target: target.write(retained)
    return record
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    records = list(executor.map(acquire,URLS))
manifest = {'retrieved_at':clock(),'purpose':'Fresh September 2025–September 2026 national claimant specimen after observed official release; prior August specimen remains unchanged. No candidate or production endpoint queried.','attribution':'ONS / Nomis; Crown copyright, Open Government Licence v3.0','records':records}
with (ROOT/'acquisition.json').open('x') as target: json.dump(manifest,target,indent=2); target.write('\n')
print(json.dumps({'retrieved_at':manifest['retrieved_at'],'records':[{'file':r.get('retained_file',r.get('file')),'bytes':r['bytes'],'sha256':r['sha256']} for r in records]}))
