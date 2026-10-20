#!/usr/bin/env python3
"""Reacquire the documented public presentation requests into a NEW directory.
Usage: python acquire-presentations.py /tmp/fresh-price_index
Does not overwrite retained originals, use credentials, or query Morning Rows.
"""
import concurrent.futures,datetime,hashlib,json,sys,urllib.request
from pathlib import Path
ROOT=Path(sys.argv[1]); ROOT.mkdir(parents=True,exist_ok=False)
REQUESTS=[{'file': 'original/selected-series.csv', 'url': 'https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?pid=1810000401&latestN=1&startDate=&endDate=&csvLocale=en&selectedMembers=%5B%5B2%5D%2C%5B2%5D%5D&checkedLevels='}, {'file': 'original/selected-table.html', 'url': 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401&pickMembers%5B0%5D=1.2&pickMembers%5B1%5D=2.2&cubeTimeFrame.startMonth=09&cubeTimeFrame.startYear=2026&cubeTimeFrame.endMonth=09&cubeTimeFrame.endYear=2026&referencePeriods=20260901'}, {'file': 'original/codes.json', 'url': 'https://www150.statcan.gc.ca/t1/wds/rest/getCodeSets'}, {'file': 'original/daily-index.html', 'url': 'https://www150.statcan.gc.ca/n1/daily-quotidien/261019/tdq261019-eng.htm'}, {'file': 'original/selected-table-valid.html', 'url': 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401&pickMembers%5B0%5D=1.2&pickMembers%5B1%5D=2.2&cubeTimeFrame.startMonth=09&cubeTimeFrame.startYear=2026&cubeTimeFrame.endMonth=09&cubeTimeFrame.endYear=2026&referencePeriods=20260901%2C20260901'}, {'file': 'original/daily-release.html', 'url': 'https://www150.statcan.gc.ca/n1/daily-quotidien/261019/dq261019a-eng.htm'}, {'file': 'original/statcan-licence.html', 'url': 'https://www.statcan.gc.ca/en/reference/licence'}, {'file': 'original/daily-table-1.html', 'url': 'https://www150.statcan.gc.ca/n1/daily-quotidien/261019/t001a-eng.htm'}]

def get(request):
 row=dict(request,method='GET',started_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
 try:
  with urllib.request.urlopen(request['url'],timeout=40) as r:
   raw=r.read(1500001)
   if len(raw)>1500000:raise ValueError('size bound exceeded')
   row.update(status=r.status,final_url=r.url,content_type=r.headers.get('Content-Type'),retrieved_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
  p=ROOT/request['file'];p.parent.mkdir(exist_ok=True)
  with p.open('xb') as f:f.write(raw)
 except Exception as e:row['error']=type(e).__name__+': '+str(e)
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(get,REQUESTS))
(ROOT/'acquisition.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
