"""Reconcile retained public aggregate excerpts without the JavaScript reader or network."""
from pathlib import Path
from html.parser import HTMLParser
from decimal import Decimal, localcontext, ROUND_HALF_UP
import csv, io, json, re, sys
base=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent
root=base/'original' if (base/'original').is_dir() else base
load=lambda name:json.loads((root/name).read_text())
class Text(HTMLParser):
 def __init__(self):super().__init__();self.values=[]
 def handle_data(self,s):self.values.append(s)
def text(s):
 p=Text();p.feed(s);return ' '.join(' '.join(p.values).split())
def cells(s):return [text(x) for x in re.findall(r'<t[dh]\b[^>]*>([\s\S]*?)</t[dh]>',s,re.I)]
def envelope(name):
 value=load(name);assert len(value)==1 and value[0]['status']=='SUCCESS';assert value[0]['object']['responseStatusCode']==0;return value[0]['object']
wds=envelope('wds-selected.json'); series=envelope('series-metadata.json');cube=envelope('cube-metadata.json')
identity={'productId':36100104,'coordinate':'1.1.1.30.0.0.0.0.0.0','vectorId':62305752}
assert all(wds[k]==v and series[k]==v for k,v in identity.items())
labels=['Canada','Chained (2017) dollars','Seasonally adjusted at annual rates','Gross domestic product at market prices']
assert series['SeriesTitleEn']==';'.join(labels)
assert all(series[k]==v for k,v in {'frequencyCode':9,'scalarFactorCode':6,'decimals':0,'terminated':0,'memberUomCode':81}.items())
assert cube['productId']=='36100104' and cube['archiveStatusCode']=='2' and cube['frequencyCode']==9
for position,(label,member_id) in enumerate(zip(labels,[1,1,1,30]),1):
 dimensions=[d for d in cube['dimension'] if d['dimensionPositionId']==position];assert len(dimensions)==1
 members=[m for m in dimensions[0]['member'] if m['memberId']==member_id];assert len(members)==1
 assert members[0]['memberNameEn']==label and members[0]['terminated']==0
points=wds['vectorDataPoint'];assert len(points)==2
assert [p['refPer'] for p in points]==['2026-01-01','2026-04-01']
assert [p['refPerRaw'] for p in points]==['2026-03-01','2026-06-01']
assert [p['value'] for p in points]==[2503604,2524127]
for p in points:
 assert all(p[k]==v for k,v in {'frequencyCode':9,'scalarFactorCode':6,'decimals':0,'symbolCode':0,'statusCode':0,'securityLevelCode':0,'refPer2':'','refPerRaw2':'','releaseTime':'2026-08-28T08:30'}.items())
assert cube['cubeEndDate']==points[-1]['refPer'] and cube['releaseTime']==points[-1]['releaseTime']
records=list(csv.DictReader(io.StringIO((root/'selected-series.csv').read_text(encoding='utf-8-sig'))));assert len(records)==2
for row,p in zip(records,points):
 expected={'REF_DATE':p['refPer'][:7],'GEO':'Canada','DGUID':'2016A000011124','Prices':labels[1],'Seasonal adjustment':labels[2],'Estimates':labels[3],'UOM':'Dollars','UOM_ID':'81','SCALAR_FACTOR':'millions','SCALAR_ID':'6','VECTOR':'v62305752','COORDINATE':'1.1.1.30','STATUS':'','SYMBOL':'','TERMINATED':'','DECIMALS':'0'}
 assert all(row[k]==v for k,v in expected.items()) and Decimal(row['VALUE'])==Decimal(str(p['value']))
presentation=load('selected-table.excerpt.json');headers={h['name']:h for h in presentation['columnHeaders']}
for name,label in zip(['Geography','Prices','Seasonal adjustment'],labels[:3]):assert [v['value'] for v in headers[name]['values']]==[label]
assert [v['value'] for v in headers['Reference period']['values']]==['Q1 2026','Q2 2026']
assert [v['meta']['memberId'] for v in headers['Reference period']['values']]==[20260101,20260401]
assert len(presentation['rows'])==1
row=presentation['rows'][0]['values'];assert row[0]['meta']['memberId']==30 and row[0]['value']==labels[3]
assert [Decimal(v['value']) for v in row[1:]]==[Decimal(p['value']) for p in points]
assert all(v['meta']['scalarFactorDesc']=='6' for v in row[1:])
daily={}
for n in [2,3,4]:
 content=(root/f'daily-{n}.excerpt.html').read_text();rows=re.findall(r'<tr\b[^>]*>[\s\S]*?</tr>',content,re.I)
 selected=[r for r in rows if 'Gross domestic product at market prices' in text(r)];assert len(selected)==1
 assert 'First quarter 2026' in content and 'Second quarter 2026' in content
 daily[n]=cells(selected[0])
assert daily[2][-2:]==daily[3][-2:]==daily[4][1:3]==['2,503,604','2,524,127']
with localcontext() as context:
 context.prec=50
 change=(Decimal(points[1]['value'])/Decimal(points[0]['value'])-1)*100
 annual=((Decimal(points[1]['value'])/Decimal(points[0]['value']))**4-1)*100
 assert change.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)==Decimal('.82')
 assert abs(change-Decimal(daily[2][6]))<Decimal('.05')
 assert abs(annual-Decimal(daily[3][6]))<Decimal('.05')
print(json.dumps({'pass':True,'exact_level_comparisons':6,'levels':[p['value'] for p in points],'ordinary_growth_unrounded':str(change),'ordinary_growth_rounded':'.82','annualized_growth_distinction_only':str(annual),'daily_quarterly_growth':daily[2][6],'daily_annualized_growth':daily[3][6],'independence':'Separate CSV/HTML extraction, same Statistics Canada statistical lineage; no runtime reader imports.'},indent=2))
