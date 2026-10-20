#!/usr/bin/env python3
"""Offline, independent stdlib XLSX cell extraction; no runtime reader imports."""
import argparse,csv,hashlib,json,posixpath,re,zipfile
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree as ET
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
MONTHS={m:i+1 for i,m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}
EXPECTED_SHA256='f6670eaa786d93646b14a619957fa3b8cc49659bf1e16957f215fc7cbd606119'
def require(condition,message):
 if not condition:raise ValueError(message)
def dated_period(label):
 match=re.fullmatch(r'(\d{4}) ([A-Z][a-z]{2})(?: \[[^]]+\])*',label)
 return f'{match[1]}-{MONTHS[match[2]]:02d}' if match and match[2] in MONTHS else None
def extract(path):
 with zipfile.ZipFile(path) as z:
  shared=[''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',NS)] if 'xl/sharedStrings.xml' in z.namelist() else []
  rels={e.attrib['Id']:posixpath.normpath('xl/'+e.attrib['Target']) for e in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  result={}
  for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',NS):
   values={}
   for c in ET.fromstring(z.read(rels[sheet.attrib['{'+REL+'}id']])).findall('.//s:sheetData/s:row/s:c',NS):
    v=c.find('s:v',NS); inline=c.find('s:is',NS)
    value=v.text if v is not None else ''.join(inline.itertext()) if inline is not None else None
    if c.attrib.get('t')=='s' and value is not None:value=shared[int(value)]
    if value is not None:values[c.attrib['r']]=value
   result[sheet.attrib['name']]=values
  return result
def main():
 p=argparse.ArgumentParser();p.add_argument('workbook',type=Path);p.add_argument('nomis_csv',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
 source_hash=hashlib.sha256(a.workbook.read_bytes()).hexdigest()
 require(source_hash==EXPECTED_SHA256,'Workbook bytes do not match this dated September 2026 contract')
 d=extract(a.workbook);h=d['Headline'];lgd=d['LGD_11']
 require(d['Cover Sheet']['A1']=='Claimant Count Tables, September 2026','Unexpected workbook release')
 require(d['Cover Sheet']['A5']=='The data tables within this spreadsheet were published at 7.00am on 15 September 2026','Unexpected publication date')
 require('Non seasonally adjusted' in h['I6'] and 'thousands' in h['I6'],'Unexpected headline measure or units')
 require(h['N7']=='Claimant count all people','Unexpected headline population')
 require(lgd['A19']=='Northern Ireland' and lgd['D7']=='Total number of claimants','Unexpected LGD geography or measure')
 csvrows=list(csv.DictReader(a.nomis_csv.open(encoding='utf-8-sig',newline='')))
 ni=[r for r in csvrows if r.get('GEOGRAPHY_NAME')=='Northern Ireland' or r.get('GEOGRAPHY_CODE')=='N92000002' or r.get('GEOGRAPHY')=='N92000002']
 require(len(ni)==13,'Expected exactly 13 Northern Ireland observations')
 for r in ni:
  expected={'GEOGRAPHY':'N92000002','GEOGRAPHY_CODE':'N92000002','GEOGRAPHY_NAME':'Northern Ireland','GENDER':'0','GENDER_CODE':'0','GENDER_NAME':'Total','AGE':'0','AGE_CODE':'0','AGE_NAME':'All categories: Age 16+','MEASURE':'1','MEASURE_CODE':'1','MEASURE_NAME':'Claimant count','MEASURES':'20100','MEASURES_NAME':'Value','OBS_STATUS':'A','OBS_CONF':'F'}
  require(all(r.get(k)==v for k,v in expected.items()),'Unexpected Nomis NI geography, dimension, status or confidentiality flag')
  require(bool(re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',r['DATE'])) and r.get('DATE_CODE')==r['DATE'],'Unexpected monthly date or code')
  v=Decimal(r['OBS_VALUE']);require(v.is_finite() and v>=0 and v==v.to_integral_value() and v%5==0,'Expected finite nonnegative rounded-five claimant count')
 periods={r['DATE']:r for r in ni};require(len(periods)==13,'Duplicate NI period')
 month_indices=sorted(int(m[:4])*12+int(m[5:]) for m in periods)
 require(month_indices==list(range(month_indices[0],month_indices[0]+13)),'NI months are not consecutive')
 latest=max(periods)
 workbook_periods={key:dated_period(label) for key,label in h.items() if re.fullmatch(r'[AI]\d+',key) and dated_period(label)}
 require(workbook_periods,'No dated Headline observations found')
 require(max(workbook_periods.values())==latest,'Workbook latest period differs from Nomis latest; do not substitute a vintage')
 require(max(v for k,v in workbook_periods.items() if k.startswith('I'))==latest,'Workbook NSA latest differs from Nomis latest')
 require(max(v for k,v in workbook_periods.items() if k.startswith('A'))==latest,'Workbook SA/NSA latest periods differ')
 history=[]; selected={'Cover Sheet':{k:d['Cover Sheet'][k]for k in ['A1','A5']},'Headline':{k:h[k] for k in ['A1','A2','A5','I6','I7','N7']},'LGD_11':{k:lgd[k]for k in ['A1','A4','A5','A6','A7','D7','A19','D19']},'Notes':{k:d['Notes'][k]for k in ['B3','B4','B5','B7','B8','B10']}}
 for key,label in h.items():
  if not re.fullmatch(r'I\d+',key):continue
  period=workbook_periods.get(key)
  if not period:continue
  if period not in periods:continue
  raw=h['N'+key[1:]];scaled=Decimal(raw)*1000
  require(scaled.is_finite() and scaled>=0 and scaled==scaled.to_integral_value(),'Unexpected raw headline value or scaling')
  value=int(scaled);nomis=int(Decimal(periods[period]['OBS_VALUE']))
  selected['Headline'][key]=label;selected['Headline']['N'+key[1:]]=raw
  history.append({'period':period,'period_cell':key,'value_cell':'N'+key[1:],'raw_thousands':raw,'count':value,'nomis_geographically_classified_rounded_5':nomis,'difference':value-nomis,'comparison_kind':'context_only_different_geographical_classification_and_rounding'})
 history.sort(key=lambda x:x['period']);require(len(history)==13 and {r['period'] for r in history}==set(periods),'Incomplete or duplicate headline context coverage')
 latest_lgd=int(lgd['D19']);nomis_latest=int(Decimal(periods[latest]['OBS_VALUE']));require(latest_lgd==nomis_latest,'Direct NI latest count comparison failed')
 result={'source_url':'https://www.nisra.gov.uk/system/files/statistics/2026-09/lmr-claimant-count-tables-september-2026.xlsx','source_sha256':source_hash,'workbook_latest_period':max(workbook_periods.values()),'nomis_latest_period':latest,'nomis_csv_sha256':hashlib.sha256(a.nomis_csv.read_bytes()).hexdigest(),'extraction':'Python stdlib zipfile and ElementTree; worksheet relationships and shared strings; no production reader used','attribution':'NISRA; Crown copyright / Open Government Licence','selected_cells':selected,'exact_comparisons':[{'period':latest,'geography':'Northern Ireland','nisra_cell':'LGD_11!D19','nisra_value':latest_lgd,'nomis_value':nomis_latest,'difference':0,'unit':'people, rounded to nearest 5','adjustment':'not seasonally adjusted','coverage':'Geographically classified claimant records; records without sufficient geography can be excluded','pass':True}],'headline_context':history,'limitations':['One directly comparable official NI observation is reconciled; 13 headline cells are context, not 13 like-for-like matches or confirmation of matching revision vintages.','Headline table 1b counts include a different geography-classification boundary and are published as unrounded counts in thousands. Do not force their agreement with geographically classified rounded counts.','NISRA and Nomis share upstream administrative statistical lineage. The workbook is an independent extraction and presentation, not an independent population enumeration.','September workbook published 15 September 2026; latest observation August 2026. Do not silently substitute later-vintage values.','NISRA claimant count is administrative JSA and relevant UC count, not ILO unemployment or a count of available recruits.']}
 a.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'output':str(a.output),'exact_comparisons':len(result['exact_comparisons']),'headline_context':len(history),'latest_period':latest,'nisra_value':latest_lgd,'nomis_value':nomis_latest,'headline_latest_count':history[-1]['count'],'source_sha256':result['source_sha256']},indent=2))
if __name__=='__main__':main()
