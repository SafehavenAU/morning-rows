"""Independent Python CSV/HTML extraction. Never imports a JavaScript reader."""
import csv,datetime,decimal,hashlib,html,io,json,pathlib,re
root=pathlib.Path(__file__).parent;original=root/'original';D=decimal.Decimal
names=['Canada','Newfoundland and Labrador','Prince Edward Island','Nova Scotia','New Brunswick','Quebec','Ontario','Manitoba','Saskatchewan','Alberta','British Columbia']
vectors=[2062815,2063004,2063193,2063382,2063571,2063760,2063949,2064138,2064327,2064516,2064705]
geo=['11124','10','11','12','13','24','35','46','47','48','59']
read=lambda n:json.loads((original/n).read_text())
data=read('wds-selected.json');series=read('series-metadata.json');cube=read('cube-metadata.json')[0]['object']
assert len(data)==len(series)==11 and cube['cubeEndDate']=='2026-09-01' and cube['releaseTime']=='2026-10-09T08:30'
data_by={r['object']['coordinate']:r['object'] for r in data};series_by={r['object']['coordinate']:r['object'] for r in series}
assert len(data_by)==len(series_by)==11
csvrows=list(csv.DictReader(io.StringIO((original/'selected-series.csv').read_text(encoding='utf-8-sig'))))
assert len(csvrows)==11 and len({r['COORDINATE'] for r in csvrows})==11
csv_by={r['COORDINATE']:r for r in csvrows};daily=(original/'daily-release.html').read_text()
assert 'Labour Force Survey' in daily and 'September&#160;2026' in daily and '2026-10-09' in daily
abbr=['Canada','N.L.','P.E.I.','N.S.','N.B.','Que.','Ont.','Man.','Sask.','Alta.','B.C.']
rows=[]
for i,(name,vector,code) in enumerate(zip(names,vectors,geo),1):
 coordinate=f'{i}.7.1.1.1.1.0.0.0.0'; a=data_by[coordinate];s=series_by[coordinate];p=a['vectorDataPoint'][0]; c=csv_by[f'{i}.7.1.1.1.1']
 assert a['productId']==s['productId']==14100287 and a['vectorId']==s['vectorId']==vector
 assert s['SeriesTitleEn']==name+';Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted'
 assert len(a['vectorDataPoint'])==1 and p['refPer']==p['refPerRaw']=='2026-09-01' and p['releaseTime']=='2026-10-09T08:30'
 assert p['frequencyCode']==6 and p['scalarFactorCode']==0 and p['decimals']==1 and p['statusCode']==p['symbolCode']==p['securityLevelCode']==0
 assert c['GEO']==name and c['REF_DATE']=='2026-09' and c['VECTOR']=='v'+str(vector) and c['DGUID']==('2021A0000' if i==1 else '2021A0002')+code
 for k,v in {'Labour force characteristics':'Unemployment rate','Gender':'Total - Gender','Age group':'15 years and over','Statistics':'Estimate','Data type':'Seasonally adjusted','UOM':'Percent','UOM_ID':'239','SCALAR_FACTOR':'units','SCALAR_ID':'0','DECIMALS':'1','STATUS':'','SYMBOL':'','TERMINATED':''}.items():assert c[k]==v,(name,k)
 chunk=daily.split(f'id="panel2-{i-1}"',1)[1].split('class="panel-footer',1)[0]
 heading=html.unescape(re.search(r'sd-indicator-heading">(.*?)</div>',chunk,re.S).group(1)).strip()
 assert heading=='Unemployment rate — '+abbr[i-1],heading
 value=re.search(r'sd-indicator-value">([\d.]+)%</p>',chunk).group(1)
 assert 'September&#160;2026' in chunk and D(value)==D(c['VALUE'])==D(str(p['value']))
 rows.append({'id':name.lower().replace(' ','_'),'geography':name,'coordinate':coordinate,'vector':vector,'period':'2026-09','value':float(D(value)),'csv_value':c['VALUE'],'dated_daily_value':value,'unit':'percent'})
# The selected-table default presents Canada; do not claim all11 HTML cells.
text=(original/'selected-table.html').read_text();table=json.JSONDecoder().raw_decode(text.split('prepareTable(',1)[1])[0]
assert table['headers']['columnHeaders'][0]['values'][0]['value']=='Canada'
selected=[r for r in table['rows'] if [v['value'] for v in r['values'][:2]]==['Unemployment rate','Seasonally adjusted']]
assert len(selected)==1 and D(selected[0]['values'][2]['value'])==D('6.5')
legacy=[]
for name,r in zip(names,data):
 p=r['object']['vectorDataPoint'][0]
 legacy.append({'name':name,'rate':p['value'],'period':p['refPer'][:7],'source':'Statistics Canada','licence':'Statistics Canada Open Licence'})
(root/'legacy-offline-reproduction.json').write_text(json.dumps({'method':'Exact historical positional map reproduced offline from retained original WDS bytes; no production request.','rows':legacy},indent=2)+'\n')
diffs=[{'geography':x['name'],'prior_positional_rate':x['rate'],'correct_identity_rate':y['value'],'mismatched':x['rate']!=y['value']} for x,y in zip(legacy,rows)]
assert sum(r['mismatched'] for r in diffs)==10
report={'schema_version':1,'pass':True,'verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'period':'2026-09','release_timestamp_raw':cube['releaseTime'],'release_timezone':None,'observations_compared':11,'csv_cells':11,'dated_daily_cells':11,'selected_html_cells':1,'numeric_tolerance':0,'method':'Independent Python csv/HTML/Decimal extraction of original publisher presentations; no runtime-reader import.','shared_lineage':'WDS, CSV, selected table and dated Daily share Statistics Canada Labour Force Survey lineage; separate transport/extraction is not an independent survey.','source_response_geography_order':[r['object']['coordinate'].split('.')[0] for r in data],'rows':rows,'legacy_before_after':diffs,'demonstrated_mislabelled_provinces':10,'originals':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(original.iterdir()) if p.is_file()}}
(root/'independent-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['pass','observations_compared','csv_cells','dated_daily_cells','selected_html_cells','demonstrated_mislabelled_provinces']},indent=2))
