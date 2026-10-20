import json,urllib.request,urllib.parse,datetime,hashlib,pathlib,concurrent.futures
import sys
root=pathlib.Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
params={'pid':'3610010401','pickMembers[0]':'2.1','pickMembers[1]':'3.1','cubeTimeFrame.startMonth':'01','cubeTimeFrame.startYear':'2026','cubeTimeFrame.endMonth':'04','cubeTimeFrame.endYear':'2026','referencePeriods':'20260101,20260401'}
selected='https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?'+urllib.parse.urlencode(params)
cp={'pid':'3610010401','latestN':'2','startDate':'','endDate':'','csvLocale':'en','selectedMembers':'[[1],[1],[1],[30]]','checkedLevels':'3D1'}
csv='https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?'+urllib.parse.urlencode(cp)
requests=[('series-metadata.json','https://www150.statcan.gc.ca/t1/wds/rest/getSeriesInfoFromCubePidCoord',[{'productId':36100104,'coordinate':'1.1.1.30.0.0.0.0.0.0'}]),('selected-table.html',selected,None),('selected-download.bin',csv,None),('daily-release.html','https://www150.statcan.gc.ca/n1/daily-quotidien/260828/dq260828a-eng.htm',None),('licence.html','https://www.statcan.gc.ca/en/reference/licence',None)]
def acquire(item):
 name,url,payload=item; start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 req=urllib.request.Request(url,data=None if payload is None else json.dumps(payload,separators=(',',':')).encode(),headers={'Accept':'application/json','Content-Type':'application/json'} if payload is not None else {})
 try:
  with urllib.request.urlopen(req,timeout=40) as r:
   raw=r.read(3000001)
   if len(raw)>3000000:raise ValueError('bound exceeded')
   row={'file':name,'url':url,'method':'GET' if payload is None else 'POST','request_json':payload,'status':r.status,'content_type':r.headers.get('content-type'),'final_url':r.url,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'started_at':start,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()};(root/name).write_bytes(raw);return row
 except Exception as e:return {'file':name,'url':url,'error':type(e).__name__+': '+str(e),'started_at':start}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: rows=list(pool.map(acquire,requests))
p=root/'acquisition.json'; old=json.loads(p.read_text());p.write_text(json.dumps(old+rows,indent=2)+'\n');print(json.dumps(rows,indent=2))
