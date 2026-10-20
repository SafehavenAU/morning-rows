"""Independent stdlib extraction from original official CSV/HTML and WDS JSON; no reader imports."""
from pathlib import Path
from html.parser import HTMLParser
from decimal import Decimal, localcontext, ROUND_HALF_UP
import csv,io,json,re,hashlib,datetime
import sys
root=Path(sys.argv[1])
load=lambda name:json.loads((root/name).read_text())
def write(name,value):(root/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
class Text(HTMLParser):
 def __init__(self):super().__init__();self.values=[]
 def handle_data(self,s):self.values.append(s)
def text(s):
 p=Text();p.feed(s);return ' '.join(' '.join(p.values).split())
def cells(s):return [text(x) for x in re.findall(r'<t[dh]\b[^>]*>([\s\S]*?)</t[dh]>',s,re.I)]
acquisitions=load('acquisition.json')
for item in acquisitions:
 if 'sha256' in item:assert hashlib.sha256((root/item['file']).read_bytes()).hexdigest()==item['sha256'],item['file']
wds=load('wds-selected.json'); assert len(wds)==1 and wds[0]['status']=='SUCCESS'
obj=wds[0]['object'];points=obj['vectorDataPoint'];assert len(points)==2
assert (obj['responseStatusCode'],obj['productId'],obj['coordinate'],obj['vectorId'])==(0,36100104,'1.1.1.30.0.0.0.0.0.0',62305752)
series=load('series-metadata.json')[0]['object'];cube=load('cube-metadata.json')[0]['object'];codes=load('codes.json')['object']
assert series['SeriesTitleEn']=='Canada;Chained (2017) dollars;Seasonally adjusted at annual rates;Gross domestic product at market prices'
for key,value in {'frequencyCode':9,'scalarFactorCode':6,'decimals':0,'terminated':0,'memberUomCode':81,'vectorId':62305752}.items():assert series[key]==value,key
selected_labels=['Canada','Chained (2017) dollars','Seasonally adjusted at annual rates','Gross domestic product at market prices'];selected_ids=[1,1,1,30]
selected_dimensions=[]
for position,(label,member_id) in enumerate(zip(selected_labels,selected_ids),1):
 d=next(d for d in cube['dimension'] if d['dimensionPositionId']==position)
 m=next(m for m in d['member'] if m['memberId']==member_id);assert m['memberNameEn']==label and m['terminated']==0
 selected_dimensions.append({**{k:v for k,v in d.items() if k!='member'},'member':[m]})
write('cube-selected.excerpt.json',{**{k:v for k,v in cube.items() if k!='dimension'},'dimension':selected_dimensions})
write('codes-selected.excerpt.json',{'scalar':[x for x in codes['scalar'] if x['scalarFactorCode']==6],'frequency':[x for x in codes['frequency'] if x['frequencyCode']==9],'uom':[x for x in codes['uom'] if x['memberUomCode']==81],**{k:codes[k] for k in ['status','symbol','securityLevel']}})
assert [p['refPer'] for p in points]==['2026-01-01','2026-04-01']
assert [p['refPerRaw'] for p in points]==['2026-03-01','2026-06-01']
assert [p['value'] for p in points]==[2503604,2524127]
assert cube['cubeEndDate']==points[-1]['refPer'] and cube['releaseTime']==points[-1]['releaseTime']=='2026-08-28T08:30'
for p in points:
 for k,v in {'frequencyCode':9,'scalarFactorCode':6,'decimals':0,'statusCode':0,'securityLevelCode':0,'symbolCode':0,'refPer2':'','refPerRaw2':''}.items():assert p[k]==v,k
csvrows=list(csv.DictReader(io.StringIO((root/'selected-series.csv').read_text(encoding='utf-8-sig'))));assert len(csvrows)==2
assert len({r['REF_DATE'] for r in csvrows})==2
for row,point in zip(csvrows,points):
 expected={'REF_DATE':point['refPer'][:7],'GEO':'Canada','DGUID':'2016A000011124','Prices':selected_labels[1],'Seasonal adjustment':selected_labels[2],'Estimates':selected_labels[3],'UOM':'Dollars','UOM_ID':'81','SCALAR_FACTOR':'millions','SCALAR_ID':'6','VECTOR':'v62305752','COORDINATE':'1.1.1.30','STATUS':'','SYMBOL':'','TERMINATED':'','DECIMALS':'0'}
 assert all(row[k]==v for k,v in expected.items());assert Decimal(row['VALUE'])==Decimal(str(point['value']))
page=(root/'selected-table.html').read_text(); marker='prepareTable(';start=page.index(marker)+len(marker)
presentation,_=json.JSONDecoder().raw_decode(page[start:]);headers=presentation['headers']['columnHeaders']
by_name={h['name']:h for h in headers}
for name,expected in [('Geography','Canada'),('Prices',selected_labels[1]),('Seasonal adjustment',selected_labels[2])]:assert [v['value'] for v in by_name[name]['values']]==[expected]
assert [v['value'] for v in by_name['Reference period']['values']]==['Q1 2026','Q2 2026']
assert [v['meta']['memberId'] for v in by_name['Reference period']['values']]==[20260101,20260401]
gdp=[r for r in presentation['rows'] if r['values'][0]['meta']['memberId']==30];assert len(gdp)==1
assert gdp[0]['values'][0]['value']==selected_labels[3]
assert [Decimal(v['value']) for v in gdp[0]['values'][1:]]==[Decimal(2503604),Decimal(2524127)]
assert all(v['meta']['scalarFactorDesc']=='6' for v in gdp[0]['values'][1:])
write('selected-table.excerpt.json',{'title':re.search(r'tableTitle\s*=\s*("[^"]+")',page)[1],'columnHeaders':headers,'rows':gdp,'uomLabels':presentation['uomLabels'],'footnotes':presentation['footnotes'],'legend':presentation['legend']})
daily={}
for n in [2,3,4]:
 original=(root/f'daily-{n}.html').read_text();rows=re.findall(r'<tr\b[^>]*>[\s\S]*?</tr>',original,re.I)
 selected=[r for r in rows if 'Gross domestic product at market prices' in text(r)];assert len(selected)==1
 selected_headers=[r for r in rows if 'First quarter 2026' in text(r) or ('quarter-to-quarter' in text(r) and 'Gross domestic' not in text(r)) or ('millions of chained' in text(r) and 'Gross domestic' not in text(r))]
 caption=re.search(r'<h1\b[^>]*>[\s\S]*?</h1>',original,re.I)
 excerpt=(caption[0] if caption else '')+'\n<table>\n'+'\n'.join(selected_headers+selected)+'\n</table>\n'
 (root/f'daily-{n}.excerpt.html').write_text(excerpt)
 daily[n]={'headers':[cells(r) for r in selected_headers],'gdp_cells':cells(selected[0])}
assert daily[2]['gdp_cells'][-2:]==['2,503,604','2,524,127']
assert daily[3]['gdp_cells'][-2:]==['2,503,604','2,524,127']
assert daily[4]['gdp_cells'][1:3]==['2,503,604','2,524,127']
with localcontext() as ctx:
 ctx.prec=50
 previous,current=map(Decimal,[2503604,2524127]);change=(current/previous-1)*100;annual=((current/previous)**4-1)*100
 assert change.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)==Decimal('.82')
 assert abs(change-Decimal(daily[2]['gdp_cells'][6]))<Decimal('.05')
 assert abs(annual-Decimal(daily[3]['gdp_cells'][6]))<Decimal('.05')
assert Decimal(daily[4]['gdp_cells'][3])==Decimal('.820')
# A deliberate request-selection failure is recorded, never silently deduplicated.
rejected=list(csv.DictReader(io.StringIO((root/'selected-download.bin').read_text(encoding='utf-8-sig'))))
assert len(rejected)==18 and len([r for r in rejected if r['VECTOR']=='v62305752'])==4
notes={}
for filename,patterns in [('daily-release.html',['This release of','Percentage changes for expenditure','Unless otherwise']),('wds-guide.html',['refPerRaw','Eastern Standard Time']),('licence.html',['reproduce','acknowledge','adapt'])]:
 content=(root/filename).read_text();paras=re.findall(r'<p\b[^>]*>[\s\S]*?</p>',content,re.I)
 notes[filename]=[text(p) for p in paras if any(term.lower() in text(p).lower() for term in patterns)]
write('publisher-notes.excerpt.json',notes)
report={'kind':'Independent original-publisher preflight, not a runtime release','verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pass':True,'product_id':36100104,'coordinate':obj['coordinate'],'vector_id':62305752,'dimensions':selected_labels,'unit':'millions of chained (2017) dollars','level_adjustment':selected_labels[2],'growth_adjustment':'ordinary quarter-to-quarter percent change; not annualized','quarters':['2026-Q1','2026-Q2'],'levels':[2503604,2524127],'release_timestamp_raw':cube['releaseTime'],'release_timezone':None,'exact_comparisons':{'wds_vs_csv':2,'wds_vs_selected_table':2,'wds_vs_dated_daily_table4':2},'ordinary_growth_unrounded':str(change),'ordinary_growth_two_decimals':'.82','daily_quarterly_growth_one_decimal':daily[2]['gdp_cells'][6],'derived_annualized_growth_for_distinction_only':str(annual),'daily_annualized_growth_one_decimal':daily[3]['gdp_cells'][6],'daily_tables':daily,'rejected_export':{'file':'selected-download.bin','rows':18,'gdp_rows':4,'reason':'Overlapping selected member plus checked hierarchy level duplicated GDP; corrected empty checkedLevels request returned exactly2. No silent deduplication.'},'independence_limit':'All presentations share Statistics Canada national-accounts lineage; extraction and presentation independence only.','remaining_limits':['No wrong current numeric observation demonstrated; legacy semantics are underqualified and parser has unvalidated identity/flag/order risks.','No actual corrected reader, protected preview, typed contract, production release or monitoring acceptance has occurred.','Unzoned publisher release timestamp retained raw.']}
write('independent-report.json',report)
print(json.dumps({'pass':True,'level_cells_compared':6,'quarters':report['quarters'],'levels':report['levels'],'quarter_change':str(change),'annualized_distinction':str(annual)}))
