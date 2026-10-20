#!/usr/bin/env python3
"""Offline Python extraction of retained CSV, WDS, metadata and official presentations.
Uses no application reader, no network and no live site output. Configuration is the
pre-implementation falsifiable contract, not an emitted runtime representation.
"""
import csv,datetime,hashlib,html,json,re
from decimal import Decimal,ROUND_HALF_UP
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CHECKS=[]
def check(name,ok):
 CHECKS.append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def read(name):return json.loads((ROOT/name).read_text())
def load_wds(name):
 o=read('original/'+name);check(name+' single SUCCESS response',len(o)==1 and o[0]['status']=='SUCCESS');return o[0]['object']
def norm(x):return ' '.join(html.unescape(str(x)).split())
class TableRows(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
 def handle_starttag(self,t,a):
  if t=='tr':self.row=[]
  elif t in ['th','td'] and self.row is not None:self.cell=[]
 def handle_endtag(self,t):
  if t in ['th','td'] and self.cell is not None:self.row.append(norm(' '.join(self.cell)));self.cell=None
  elif t=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
 def handle_data(self,d):
  if self.cell is not None:self.cell.append(d)
c=read('selected-config.json');s=ROOT.name;manifest=read('acquisition.json');hashes=[]
for rec in manifest:
 if 'sha256' not in rec:continue
 raw=(ROOT/rec['file']).read_bytes();check('retained SHA256 '+rec['file'],hashlib.sha256(raw).hexdigest()==rec['sha256']);check('retained byte count '+rec['file'],len(raw)==rec['bytes']);hashes.append({'file':rec['file'],'sha256':rec['sha256'],'retrieved_at':rec['retrieved_at']})
d=load_wds('wds-selected.json');m=load_wds('series-metadata.json');cube=load_wds('cube-metadata.json')
check('data product / coordinate / vector',d['productId']==c['product_id'] and d['coordinate']==c['coordinate'] and d['vectorId']==c['vector_id'])
check('one selected latest observation',len(d['vectorDataPoint'])==1)
p=d['vectorDataPoint'][0]
check('series identity',m['productId']==c['product_id'] and m['coordinate']==c['coordinate'] and m['vectorId']==c['vector_id'])
check('series title and UOM',m['SeriesTitleEn']==c['series_title'] and m['memberUomCode']==c['member_uom_code'])
check('cube identity and title',str(cube['productId'])==str(c['product_id']) and cube['cubeTitleEn']==c['cube_title'])
check('series/cube active',m['terminated']==0 and str(cube['archiveStatusCode'])=='2')
check('frequency consistency',p['frequencyCode']==m['frequencyCode']==cube['frequencyCode']==c['frequency_code'])
check('scale and precision',p['scalarFactorCode']==m['scalarFactorCode']==c['scalar_factor_code'] and p['decimals']==m['decimals']==c['decimals'])
check('all exact dimensions',len(cube['dimension'])==len(c['selected_dimensions']))
for selected,dim in zip(c['selected_dimensions'],cube['dimension']):
 check('dimension '+selected['name'],dim['dimensionPositionId']==selected['position'] and dim['dimensionNameEn']==selected['name'] and dim['hasUom']==selected['has_uom'])
 chosen=[a for a in dim['member'] if a['memberId']==selected['member']['memberId']];check('exact member '+selected['name'],len(chosen)==1 and chosen[0]==selected['member'])
check('latest cube end exact',p['refPer']==cube['cubeEndDate']==c['latest_anchor']['cube_end_date'])
check('release current specimen exact',p['releaseTime']==cube['releaseTime']==c['latest_anchor']['release_time'])
check('raw period convention',p['refPerRaw']==c['latest_anchor']['ref_per_raw'] and p['refPer2']==p['refPerRaw2']=='')
check('published value exact frozen anchor',Decimal(str(p['value']))==Decimal(str(c['latest_anchor']['value'])))
check('accepted flags',p['statusCode'] in c['flags']['accepted_status_codes'] and p['symbolCode'] in c['flags']['accepted_symbol_codes'] and p['securityLevelCode']==0)
rows=list(csv.DictReader((ROOT/'original/selected-series.csv').read_text(encoding='utf-8-sig').splitlines()));check('one CSV observation',len(rows)==1);row=rows[0]
codebytes=(ROOT.parent/'price_index/original/codes.json').read_bytes();check('shared official code-set SHA256',hashlib.sha256(codebytes).hexdigest()=='323e8c8e674092cf975f3f03b4096105bf8bda15da9ee55c30522d19110d8b33')
codes=json.loads(codebytes)['object']
uom=next(x['memberUomEn'] for x in codes['uom'] if x['memberUomCode']==c['member_uom_code']);scalar=next(x['scalarFactorDescEn'] for x in codes['scalar'] if x['scalarFactorCode']==c['scalar_factor_code']);status=next(x for x in codes['status'] if int(x['statusCode'])==p['statusCode']);symbol=next(x for x in codes['symbol'] if int(x['symbolCode'])==p['symbolCode'])
check('CSV selected identity',row['VECTOR']=='v'+str(c['vector_id']) and row['COORDINATE']=='.'.join(c['coordinate'].split('.')[:len(c['selected_dimensions'])]))
check('CSV date and exact value',row['REF_DATE']==p['refPer'][:7] and Decimal(row['VALUE'])==Decimal(str(p['value'])))
check('CSV UOM/scalar/precision',row['UOM']==uom and int(row['UOM_ID'])==c['member_uom_code'] and row['SCALAR_FACTOR']==scalar and int(row['SCALAR_ID'])==c['scalar_factor_code'] and int(row['DECIMALS'])==c['decimals'])
check('CSV quality/symbol/not terminated',row['STATUS']==(status['statusRepresentationEn'] or '') and row['SYMBOL']==(symbol['symbolRepresentationEn'] or '') and row['TERMINATED']=='')
for dimension in c['selected_dimensions']:
 field='GEO' if dimension['name']=='Geography' else dimension['name'];label=dimension['member']['memberNameEn'];label=label+' ['+dimension['member']['classificationCode']+']' if field=='North American Industry Classification System (NAICS)' else label
 check('CSV dimension '+field,norm(row[field])==norm(label))
check('CSV Canada DGUID',row['DGUID']==('2021A000011124' if s=='shop' else '2016A000011124'))
text=(ROOT/'original/selected-table-valid.html').read_text();start=text.index('prepareTable(')+len('prepareTable(');table,_=json.JSONDecoder().raw_decode(text[start:])
rowlabel={'price_index':'All-items','shop':'Canada','homes':'Housing starts'}[s];matched=[x for x in table['rows'] if norm(x['values'][0]['value'])==rowlabel];check('HTML exact row selection',len(matched)==1 and len(matched[0]['values'])==2);cell=matched[0]['values'][1];check('HTML exact numerical value',Decimal(cell['value'])==Decimal(str(p['value'])) and Decimal(cell['meta']['formattedValue'].replace(',',''))==Decimal(str(p['value'])))
headers={x['name']:x['values'] for x in table['headers']['columnHeaders']};period={'price_index':'September 2026','shop':'July 2026','homes':'Q3 2026'}[s];check('HTML exact reference period',len(headers['Reference period'])==1 and headers['Reference period'][0]['value']==period)
check('HTML quality/scalar',cell['meta']['reference']==row['STATUS'] and int(cell['meta']['scalarFactorDesc'])==c['scalar_factor_code'])
check('HTML UOM',next(x['value'] for x in table['uomLabels'] if x['id']==cell['meta']['uom'])==uom)
if s=='shop':
 for field,label in [('North American Industry Classification System (NAICS)','Retail trade [44-45]'),('Sales','Total retail sales'),('Adjustments','Seasonally adjusted')]:check('HTML dimension '+field,len(headers[field])==1 and norm(headers[field][0]['value'])==label)
else:
 check('HTML Canada selection',len(headers['Geography'])==1 and headers['Geography'][0]['value']=='Canada')
 if s=='homes':check('HTML total units selection',len(headers['Type of unit'])==1 and headers['Type of unit'][0]['value']=='Total units')
daily=None
if s in ['price_index','shop']:
 parser=TableRows();dailytext=(ROOT/'original/daily-table-1.html').read_text();parser.feed(dailytext);columns=parser.rows[0];units=parser.rows[1];selected=[r for r in parser.rows if r and r[0]==rowlabel];check('Daily exact row',len(selected)==1);indices=[i for i,x in enumerate(columns) if x==period or x==period+' p'];check('Daily exact period',len(indices)==1);i=indices[0];value=Decimal(selected[0][i].replace(',',''));expected=Decimal(str(p['value']))
 if s=='price_index':check('Daily exact index and base',units[i]=='(2002=100)' and value==expected);tolerance=Decimal(0);display=expected;difference=Decimal(0)
 else:
  display=expected/1000;tolerance=Decimal('0.5');difference=abs(display-value);check('Daily millions rounding',units[i]=='millions of dollars' and display.quantize(Decimal(1),rounding=ROUND_HALF_UP)==value and difference<=tolerance)
 daily={'file':'original/daily-table-1.html','row':rowlabel,'column':columns[i],'unit':units[i],'displayed_value':str(value),'source_value_in_display_units':str(display),'absolute_difference':str(difference),'permitted_rounding_tolerance':str(tolerance),'passed':True,'publication_preliminary':columns[i].endswith(' p'),'wds_symbol_code':p['symbolCode'],'qualification_discrepancy':'Dated Daily marks July preliminary; WDS symbol0 and CSV blank. Preserve publication qualification separately.' if s=='shop' else None}
report={'pass':True,'source':s,'verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Independent Python standard-library CSV/JSON/HTML extraction; no JavaScript reader and no site output used.','passed':True,'observations_compared':1,'wds_csv_observations_compared':1,'official_table_observations_compared':1,'dated_publication_observations_compared':1 if daily else 0,'observations':[{'period':c['latest_anchor']['period'],'value':p['value'],'unit':c['unit'],'vector':c['vector_id'],'coordinate':c['coordinate'],'publisher_release':p['releaseTime'],'publisher_release_timezone':None,'status_code':p['statusCode'],'status':status['statusDescEn'],'symbol_code':p['symbolCode'],'geography':'Canada','coverage':c['population']}],'csv_row':row,'official_table':{'file':'original/selected-table-valid.html','selected_row':rowlabel,'period':period,'value':cell['value'],'formatted_value':cell['meta']['formattedValue'],'passed':True},'dated_publication':daily,'checks':CHECKS,'hashes':hashes,'limitations':['WDS, CSV and table viewer share publisher statistical lineage. A separate extraction/presentation detects parsing/selection mistakes; it is not an independent statistical measurement.','Dated Daily adds a separately edited presentation for CPI/retail, still using the same statistical series.']+(['No separate dated CMHC publication compared; table viewer explicitly presents the same quarter and value. CMHC agreement is retained; downstream terms condition must be communicated and is not actual recipient-assent evidence.'] if s=='homes' else [])+(['Daily preliminary qualification and blank WDS symbol differ; no finality claim is justified by blank WDS symbol.'] if s=='shop' else [])}
(ROOT/'independent-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'source':s,'passed':True,'checks':len(CHECKS),'value':p['value'],'period':c['latest_anchor']['period'],'dated_publication':daily}))
