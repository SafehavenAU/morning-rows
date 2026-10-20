import importlib.util,json,urllib.parse,concurrent.futures
from pathlib import Path
p=Path(__file__).parent
spec=importlib.util.spec_from_file_location('acquire',p/'acquire.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
params={'pid':'1410028701','latestN':'1','startDate':'','endDate':'','csvLocale':'en','selectedMembers':json.dumps([list(range(1,12)),[7],[1],[1],[1],[1]],separators=(',',':')),'checkedLevels':''}
tp={'pid':'1410028701','pickMembers[0]':'2.7','pickMembers[1]':'3.1','pickMembers[2]':'4.1','pickMembers[3]':'5.1','pickMembers[4]':'6.1','cubeTimeFrame.startMonth':'09','cubeTimeFrame.startYear':'2026','cubeTimeFrame.endMonth':'09','cubeTimeFrame.endYear':'2026','referencePeriods':'20260901,20260901'}
reqs=[('selected-series.csv',m.base+'tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?'+urllib.parse.urlencode(params),None),('selected-table.html',m.base+'tbl1/en/tv.action?'+urllib.parse.urlencode(tp),None),('daily-release.html','https://www150.statcan.gc.ca/n1/daily-quotidien/261009/dq261009a-eng.htm',None)]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(m.get,reqs))
manifest=m.root/'acquisition.json';manifest.write_text(json.dumps(json.loads(manifest.read_text())+rows,indent=2)+'\n');print(json.dumps(rows,indent=2))
