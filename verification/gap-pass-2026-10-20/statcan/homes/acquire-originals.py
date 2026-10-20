#!/usr/bin/env python3
"""Acquire three exact public StatCan WDS originals once each; no credentials."""
import concurrent.futures,datetime,hashlib,json,sys,urllib.request
from pathlib import Path
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
ROOT.mkdir(parents=True,exist_ok=True)
PRODUCT=34100136
COORDINATE='1.1.1.0.0.0.0.0.0.0'
BASE='https://www150.statcan.gc.ca/t1/wds/rest/'
REQUESTS=[('wds-selected.json','getDataFromCubePidCoordAndLatestNPeriods',[{'productId':PRODUCT,'coordinate':COORDINATE,'latestN':1}]),('series-metadata.json','getSeriesInfoFromCubePidCoord',[{'productId':PRODUCT,'coordinate':COORDINATE}]),('cube-metadata.json','getCubeMetadata',[{'productId':PRODUCT}])]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def acquire(item):
 name,method,payload=item;url=BASE+method;started=now()
 record={'file':'original/'+name,'url':url,'method':'POST','request_json':payload,'started_at':started}
 try:
  request=urllib.request.Request(url,data=json.dumps(payload,separators=(',',':')).encode(),headers={'Accept':'application/json','Content-Type':'application/json'})
  with urllib.request.urlopen(request,timeout=40) as r:
   raw=r.read(3000001)
   if len(raw)>3000000:raise ValueError('Original metadata bound exceeded')
   record.update(status=r.status,final_url=r.url,content_type=r.headers.get('Content-Type'),retrieved_at=now(),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
  with (ROOT/'original'/name).open('xb') as f:f.write(raw)
 except Exception as e:record.update(error=type(e).__name__+': '+str(e),finished_at=now())
 return record
if __name__=='__main__':
 (ROOT/'original').mkdir(exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:records=list(pool.map(acquire,REQUESTS))
 with (ROOT/'acquisition.json').open('x') as f:json.dump(records,f,indent=2);f.write('\n')
 print(json.dumps({'source':ROOT.name,'records':records}))
