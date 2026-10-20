#!/usr/bin/env python3
"""Independent standard-library XLSX extraction, official-edition and presentation checks."""
import datetime,hashlib,json,posixpath,re,zipfile,xml.etree.ElementTree as ET
from decimal import Decimal,ROUND_HALF_UP
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parent
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
checks=[]
def check(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def workbook(path):
 with zipfile.ZipFile(path) as z:
  strings=[''.join(t.text or '' for t in si.iter('{'+N['s']+'}t')) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
  relationships={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  sheets={}
  for s in ET.fromstring(z.read('xl/workbook.xml')).find('s:sheets',N):
   if s.attrib['name'] not in ['Contents','1.1, 1.2','T5.1']:continue
   target=relationships[s.attrib['{'+N['r']+'}id']];target=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
   cells={}
   for c in ET.fromstring(z.read(target)).iter('{'+N['s']+'}c'):
    assert c.attrib['r'] not in cells,'duplicate cell';v=c.find('s:v',N);text=v.text if v is not None else None
    if c.attrib.get('t')=='s' and text is not None:value=strings[int(text)]
    elif c.attrib.get('t')=='inlineStr':value=''.join(t.text or '' for t in c.find('s:is',N).iter('{'+N['s']+'}t'))
    elif text is not None and c.attrib.get('t') not in ['e','str','b']:
     number=Decimal(text);value=int(number) if number==number.to_integral_value() else float(number)
    else:value=text if c.attrib.get('t')=='str' else None
    cells[c.attrib['r']]=value
   sheets[s.attrib['name']]={'xml_part':target,'cells':cells}
  return sheets
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,d):self.parts.append(d)
def plain(p):
 parser=Text();parser.feed(p.read_text());return ' '.join(' '.join(parser.parts).split())
manifest=json.loads((ROOT/'original/acquisition.json').read_text());hashes=[]
for r in manifest:
 if 'sha256' not in r:continue
 b=(ROOT/'original'/r['file']).read_bytes();check('SHA256 '+r['file'],hashlib.sha256(b).hexdigest()==r['sha256']);check('bytes '+r['file'],len(b)==r['bytes']);hashes.append({'file':'original/'+r['file'],'sha256':r['sha256'],'retrieved_at':r['retrieved_at']})
nz=workbook(ROOT/'original/nz-fleet.xlsx');scot=workbook(ROOT/'original/scotland-traffic.xlsx');nc=nz['1.1, 1.2']['cells'];sc=scot['T5.1']['cells']
check('NZ named2024 workbook',nz['Contents']['cells']['A1']=='The New Zealand 2024 Vehicle Fleet : Data Spreadsheet')
check('NZ table1.1 header',nc['B1']=='Fleet Composition' and nc['A2']=='Period')
labels=['Light passenger','Light commercial','MCycle','Trucks','Bus','Other','Total','Total light'];check('NZ exact columns',all(nc[f'{col}2']==label for col,label in zip('BCDEFGHI',labels)))
years=[(int(k[1:]),v) for k,v in nc.items() if re.fullmatch('A[0-9]+',k) and isinstance(v,int) and v>=2000];check('NZ unique dated periods',len({y for _,y in years})==len(years) and max(y for _,y in years)==2024)
row=next(i for i,y in years if y==2024);nzobs=[{'id':label,'display_category':'Motorcycles' if label=='MCycle' else label,'value':nc[f'{col}{row}'],'cell':f'{col}{row}','sheet':'1.1, 1.2','period':'2024','unit':'vehicles','geography':'New Zealand'} for col,label in zip('BCDEFGHI',labels)]
check('NZ eight finite integer counts',len(nzobs)==8 and all(isinstance(o['value'],int) and o['value']>=0 for o in nzobs));check('NZ components total',sum(o['value'] for o in nzobs[:6])==nzobs[6]['value']);check('NZ overlapping Total light',nzobs[0]['value']+nzobs[1]['value']==nzobs[7]['value'])
check('Scotland table5.1 units',sc['A1']=='Table 5.1  Traffic by road class and type  (million vehicle kilometres) [note 3]');check('Scotland statistical status',sc['A4']=='Source:  Department for Transport - Not Accredited Official Statistics')
sy=[]
for key,value in sc.items():
 if re.fullmatch('[A-Z]+5',key) and key!='A5' and value is not None:
  m=re.fullmatch(r'(\d{4})(?: \[note \d+\])*',str(value));check('Scotland parse year '+key,m is not None);sy.append((key[:-1],int(m[1])))
check('Scotland unique dated periods',len({y for _,y in sy})==len(sy) and max(y for _,y in sy)==2024);column=next(c for c,y in sy if y==2024)
sobs=[]
for label,row in [('Motorways',6),('All A roads Total',15),('All minor roads',19),('All roads',23)]:
 check('Scotland exact label '+label,sc[f'A{row}']==label);sobs.append({'id':label,'value':sc[f'{column}{row}'],'cell':f'{column}{row}','sheet':'T5.1','period':'2024','unit':'million vehicle kilometres','geography':'Scotland'})
check('Scotland four numeric estimates',len(sobs)==4 and all(isinstance(o['value'],(int,float)) and o['value']>=0 for o in sobs));difference=sum(o['value'] for o in sobs[:3])-sobs[3]['value'];check('Scotland sum tolerance2million vehiclekm',abs(difference)<=2)
index=(ROOT/'original/scotland-index.html').read_text();editions=[int(y) for y in re.findall(r'href="/publication/scottish-transport-statistics-(\d{4})/',index)];check('Scotland newest named STS index entry2025',len(editions)>0 and max(editions)==2025)
edition=(ROOT/'original/scotland-edition.html').read_text();check('Scotland exact workbook link', 'href="/media/rjzlatp0/chapter-5-road-traffic-excel.xlsx"' in edition);check('Scotland edition date25March2026','25 Mar 2026' in edition)
nt=plain(ROOT/'original/nz-fleet-named-tool.html');check('NZ current named tool2024','Annual Motor Vehicle Fleet Statistics (2024)' in nt);check('NZ version4 release window','Version 4.0: Annual update to 2024 Vehicle Fleet. Released in October/November 2025.' in nt);check('NZ named tool attribution/CCBY','Creative Commons Attribution 4.0' in nt)
chapter=plain(ROOT/'original/scotland-chapter-5.html');presentations=[]
patterns=[('Motorways',r'Traffic on Motorways accounted for ([\d.]+) billion vehicle km',Decimal('0.1')),('All A roads Total',r'A roads total of ([\d.]+) billion vehicle km',Decimal('0.1')),('All minor roads',r'an estimated ([\d.]+) billion vehicle km',Decimal('0.1')),('All roads',r'volume of traffic on Scotland.s roads in 2024 was around ([\d.]+) billion',Decimal('1'))]
for label,pattern,quantum in patterns:
 m=re.search(pattern,chapter);check('Scotland chapter matched '+label,m is not None);shown=Decimal(m[1]);exact=Decimal(str(next(o['value'] for o in sobs if o['id']==label)))/1000;tolerance=quantum/2;check('Scotland chapter rounding '+label,exact.quantize(quantum,rounding=ROUND_HALF_UP)==shown and abs(exact-shown)<=tolerance);presentations.append({'category':label,'workbook_million_vehicle_km':str(exact*1000),'publication_billion_vehicle_km':str(shown),'difference_billion':str(abs(exact-shown)),'tolerance_billion':str(tolerance),'pass':True})
report={'pass':True,'passed':True,'independently_verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Python zipfile + ElementTree OOXML extraction; cached published cells only, no formulas evaluated and no production workbook parser used.','observations_compared':12,'observations':nzobs+sobs,'new_zealand':{'period':'2024','named_release':'Annual Motor Vehicle Fleet Statistics 2024, version4.0, October/November2025','rows':nzobs,'discovery':'Official index browser-tool open links exact2024 workbook and named official tool; urllib original is an Incapsula challenge and is retained as failure evidence. The named linked tool was directly downloaded and still identifies2024. No replacement edition identified.','independence_gap':'All8 numerical comparisons use the same publisher workbook with separate Python extraction. Named tool confirms edition/semantics but no separately displayed8cell presentation was captured.'},'scotland':{'period':'2024','named_release':'Scottish Transport Statistics2025,25March2026','rows':sobs,'total_difference_million_vehicle_km':difference,'total_tolerance_million_vehicle_km':2,'independent_chapter_presentations':presentations,'discovery':'Current official index maximum named STS edition2025; its25March2026 page links exact workbook.','independence_gap':'Python XML and actual reader use the same official workbook; independently edited chapter provides rounded corroboration of all4 cells, still the same underlying DfT estimates.'},'checks':checks,'hashes':hashes,'scope_limit':'No newer named edition found; this is dated discovery, not a guarantee against future releases. Unchanged annual data remain valid. No runtime release or scheduled acceptance claimed.'}
(ROOT/'independent-report.json').write_text(json.dumps(report,indent=2)+'\n');(ROOT/'minimal-cells.json').write_text(json.dumps({'nz_fleet':{name:{'xml_part':data['xml_part'],'cells':{k:v for k,v in data['cells'].items() if (name=='Contents' and k=='A1') or (name=='1.1, 1.2' and (k in ['A2','B1','A27'] or re.fullmatch('[B-I](2|27)',k)))}} for name,data in nz.items()},'scotland':{'T5.1':{'xml_part':scot['T5.1']['xml_part'],'cells':{k:v for k,v in sc.items() if k in ['A1','A4','A5','AE5','A6','A15','A19','A23','AE6','AE15','AE19','AE23']}}}},indent=2)+'\n');print(json.dumps({'pass':True,'checks':len(checks),'observations':nzobs+sobs}))
