"""Retain bounded public original requests; no runtime reader imports."""
import concurrent.futures,datetime,hashlib,json,pathlib,urllib.parse,urllib.request
root=pathlib.Path(__file__).parent/'original';root.mkdir(exist_ok=True)
base='https://www150.statcan.gc.ca/t1/'
coords=[f'{i}.7.1.1.1.1.0.0.0.0' for i in range(1,12)]
requests=[('wds-selected.json',base+'wds/rest/getDataFromCubePidCoordAndLatestNPeriods',[{'productId':14100287,'coordinate':c,'latestN':1} for c in coords]),('series-metadata.json',base+'wds/rest/getSeriesInfoFromCubePidCoord',[{'productId':14100287,'coordinate':c} for c in coords]),('cube-metadata.json',base+'wds/rest/getCubeMetadata',[{'productId':14100287}])]
def get(item):
 name,url,payload=item;start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 req=urllib.request.Request(url,data=None if payload is None else json.dumps(payload,separators=(',',':')).encode(),headers={'Accept':'application/json','Content-Type':'application/json'} if payload is not None else {})
 try:
  with urllib.request.urlopen(req,timeout=40) as response:
   data=response.read(2000001)
   if len(data)>2000000:raise ValueError('bound exceeded')
   (root/name).write_bytes(data)
   return {'file':name,'url':url,'request_json':payload,'started_at':start,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':response.status,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'final_url':response.url}
 except Exception as e:return {'file':name,'url':url,'error':str(e),'started_at':start}
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: rows=list(pool.map(get,requests))
 (root/'acquisition.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows,indent=2))
