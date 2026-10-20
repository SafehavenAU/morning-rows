import urllib.request, pathlib, datetime, hashlib, json, sys
from concurrent.futures import ThreadPoolExecutor
base=pathlib.Path(__file__).parent
def grab(item):
    group,name,url=item; p=base/group/'original'/name; p.parent.mkdir(parents=True,exist_ok=True)
    if p.exists(): raise RuntimeError('refuse overwrite '+str(p))
    row={'url':url,'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'MorningRows verification research','Accept':'*/*'}),timeout=35) as r:
            raw=r.read(35000000); row.update(status=r.status,final_url=r.url,content_type=r.headers.get('Content-Type'))
    except urllib.error.HTTPError as e: raw=e.read();row.update(status=e.code,error=str(e))
    except Exception as e: raw=b'';row.update(error=str(e))
    p.write_bytes(raw);row.update(path=str(p.relative_to(base)),retrieved_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
    (p.parent/(name+'.request.json')).write_text(json.dumps(row,indent=2)+'\n');return row
items=json.loads(pathlib.Path(sys.argv[1]).read_text())
for row in ThreadPoolExecutor(max_workers=4).map(grab,items):print(json.dumps(row))
