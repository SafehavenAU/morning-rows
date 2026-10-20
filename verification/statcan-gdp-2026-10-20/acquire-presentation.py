import json,urllib.request,urllib.parse,datetime,hashlib,pathlib,concurrent.futures
import sys
root=pathlib.Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
cp={'pid':'3610010401','latestN':'2','startDate':'','endDate':'','csvLocale':'en','selectedMembers':'[[1],[1],[1],[30]]','checkedLevels':''}
requests=[('selected-series.csv','https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?'+urllib.parse.urlencode(cp))]+[(f'daily-{n}.html',f'https://www150.statcan.gc.ca/n1/daily-quotidien/260828/t{n:03d}a-eng.htm') for n in [2,3,4]]
def get(item):
 name,url=item;start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:
  with urllib.request.urlopen(url,timeout=40) as r:
   raw=r.read(1000001)
   if len(raw)>1000000:raise ValueError('bound exceeded')
   row={'file':name,'url':url,'method':'GET','status':r.status,'content_type':r.headers.get('content-type'),'final_url':r.url,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'started_at':start,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()};(root/name).write_bytes(raw);return row
 except Exception as e:return {'file':name,'url':url,'error':type(e).__name__+': '+str(e),'started_at':start}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as p:rows=list(p.map(get,requests))
p=root/'acquisition.json'; p.write_text(json.dumps(json.loads(p.read_text())+rows,indent=2)+'\n');print(json.dumps(rows,indent=2))
