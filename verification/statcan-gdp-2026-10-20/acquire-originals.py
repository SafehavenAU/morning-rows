import json,urllib.request,datetime,hashlib,pathlib,concurrent.futures
import sys
root=pathlib.Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
requests=[
 ('wds-selected.json','https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods',[{'productId':36100104,'coordinate':'1.1.1.30.0.0.0.0.0.0','latestN':2}]),
 ('cube-metadata.json','https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata',[{'productId':36100104}]),
 ('codes.json','https://www150.statcan.gc.ca/t1/wds/rest/getCodeSets',None),
 ('table-page.html','https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610010401',None),
 ('wds-guide.html','https://www.statcan.gc.ca/en/developers/wds/user-guide',None),
]
def acquire(item):
 name,url,payload=item; start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 req=urllib.request.Request(url,data=None if payload is None else json.dumps(payload,separators=(',',':')).encode(),headers={'Accept':'application/json' if name.endswith('json') else 'text/html','Content-Type':'application/json'} if payload is not None else {})
 try:
  with urllib.request.urlopen(req,timeout=40) as r:
   raw=r.read(3000001)
   if len(raw)>3000000:raise ValueError('bound exceeded')
   row={'file':name,'url':url,'method':'GET' if payload is None else 'POST','request_json':payload,'status':r.status,'content_type':r.headers.get('content-type'),'final_url':r.url,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'started_at':start,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
   (root/name).write_bytes(raw);return row
 except Exception as e:return {'file':name,'url':url,'error':type(e).__name__+': '+str(e),'started_at':start}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: rows=list(pool.map(acquire,requests))
(root/'acquisition.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
