#!/usr/bin/env python3
"""Two bounded original publisher presentation acquisitions; no credentials."""
import concurrent.futures,datetime,hashlib,json,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent/'original'
REQUESTS=[('nz-fleet-named-tool.html','https://www.mot-dev.link/fleet/annual-motor-vehicle-fleet-statistics/'),('scotland-chapter-5.html','https://www.transport.gov.scot/publication/scottish-transport-statistics-2025/chapter-5-road-traffic/')]
def get(item):
 file,url=item;r={'file':file,'url':url,'method':'GET','started_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(url,timeout=40) as response:
   body=response.read(1500001)
   if len(body)>1500000:raise ValueError('size bound exceeded')
   r.update(status=response.status,final_url=response.url,content_type=response.headers.get('Content-Type'),retrieved_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
  with (ROOT/file).open('xb') as f:f.write(body)
 except Exception as e:r['error']=type(e).__name__+': '+str(e)
 return r
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(get,REQUESTS))
 p=ROOT/'acquisition.json';p.write_text(json.dumps(json.loads(p.read_text())+results,indent=2)+'\n');print(json.dumps(results,indent=2))
