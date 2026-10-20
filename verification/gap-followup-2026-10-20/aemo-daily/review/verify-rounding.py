#!/usr/bin/env python3
"""Independent ZIP/CSV/Decimal evidence. No runtime imports or HTTP.
Run: python verify-rounding.py FRESH_OUTPUT.json [RUNTIME_CAPTURE.json]
The optional runtime capture is compared against the original-file oracle.
"""
import csv,hashlib,io,json,re,sys,zipfile
from datetime import datetime,timedelta,timezone
from decimal import Decimal,ROUND_HALF_UP
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
ORIGINAL=HERE.parent/'original'
MONTHLY=ROOT/'verification/gap-pass-2026-10-20/aemo/original'
DAY=datetime(2026,10,19,tzinfo=timezone(timedelta(hours=10)))
REGIONS=['SA1','VIC1']
FILENAMES=['PUBLIC_PRICES_202610180000_20261019040502.zip','PUBLIC_PRICES_202610190000_20261020040503.zip']
PINNED=['d4f41531f9d1deb496270c02bdf2542cba9ea65443d4cf0167d9b9a43aece03f','f67a8dd7b89f1c94544aa23192f7f29896926a2ba541c098e6a5e30fe57729b9']
MONTHLY_PINS={'SA1':'f816ed96490add2089879dec218cb2a72c52b34e3e1f207c28c4fb079758efc3','VIC1':'d502e515da90a6c55ba71c7bc4d38a35ed77e0fb9e4a91c44c7911daca498d37'}
def need(ok,msg):
 if not ok:raise ValueError(msg)
def decimal(raw):
 need(bool(re.fullmatch(r'-?(?:0|[1-9]\d{0,7})(?:\.\d{1,5})?(?:[Ee][+-]?\d{1,2})?',raw)),'Unsupported decimal token')
 value=Decimal(raw);need(value.is_finite() and value.as_tuple().exponent>=-5,'Excess decimal precision');return value
round_cent=lambda value:value.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
def stamp(raw):return datetime.strptime(raw,'%Y/%m/%d %H:%M:%S').replace(tzinfo=DAY.tzinfo)
def summary(values):
 cents=[round_cent(v) for v in values]
 return {'mean':str(round_cent(sum(cents)/288)),'minimum':str(min(cents)),'maximum':str(max(cents)),'negative_count':sum(v<0 for v in cents),'zero_count':sum(v==0 for v in cents),'interval_count':len(cents),'cent_sum':str(sum(cents))}
def extract():
 chosen={r:{} for r in REGIONS};inputs=[]
 definition=ORIGINAL/'public-prices-definition.yaml';metadata=definition.read_bytes()
 need(hashlib.sha256(metadata).hexdigest()=='da76ccbff14d3b5c0126b63c2cbb2b1f6a149c2ba23e6129c7ade7b75790d3ed','Publisher definition hash')
 text=metadata.decode();need('description: Next Day Public Daily Prices Dispatch Reports' in text,'Publisher dataset is dispatch report')
 fields={};report=None
 for line in text.splitlines():
  match=re.fullmatch('   name: (.+)',line)
  if match:report=match[1];fields[report]=[]
  match=re.fullmatch('      name: (.+)',line)
  if match and report:fields[report].append(match[1])
 need(set(fields)=={'DREGION-NULL-2','DREGION-NULL-3','TREGION-NULL-1','TREGION-NULL-2'},'Explicit mixed publisher report family')
 need(text.count('description: Regional Energy Price - EnergyPrice attribute after capping/flooring and scaling')>=2 and 'format: NUMBER(15,5)' in text,'Publisher RRP adjustment/precision metadata')
 inputs.append({'file':str(definition.relative_to(ROOT)),'bytes':len(metadata),'sha256':hashlib.sha256(metadata).hexdigest(),'DREGION2_fields':len(fields['DREGION-NULL-2']),'DREGION3_fields':len(fields['DREGION-NULL-3'])})
 for i,(name,pin) in enumerate(zip(FILENAMES,PINNED)):
  blob=(ORIGINAL/name).read_bytes();need(hashlib.sha256(blob).hexdigest()==pin,'Original ZIP hash changed')
  with zipfile.ZipFile(io.BytesIO(blob)) as z:
   need(z.namelist()==[name.replace('.zip','.CSV')],'Single exact CSV member required');data=z.read(z.namelist()[0])
  rows=list(csv.reader(io.StringIO(data.decode('utf-8'))));need(rows[-1]==['C','END OF REPORT',str(len(rows))],'Complete record framing')
  need(rows[0][:5]==['C','NEMP.WORLD','PRICES','AEMO','PUBLIC'],'Exact family identity')
  trading_start=(DAY-timedelta(days=1-i)).replace(hour=4);trading_end=trading_start+timedelta(days=1)
  layouts={};group={r:{'2':{},'3':{}} for r in REGIONS}
  for row in rows[1:-1]:
   need(row[1:3]==['DREGION',''],'Only declared DREGION layout')
   if row[0]=='I':need(row[3] not in layouts,'Duplicate header');layouts[row[3]]=row[4:];continue
   need(row[0]=='D' and row[3] in layouts,'Header before data')
   need(len(row)==len(layouts[row[3]])+4,'Complete CSV row')
   entry=dict(zip(layouts[row[3]],row[4:]));region=entry['REGIONID']
   if region not in REGIONS:continue
   ending=stamp(entry['SETTLEMENTDATE']);need(trading_start<ending<=trading_end,'Declared trading interval ownership')
   need((ending-trading_start).total_seconds()%300==0,'Five-minute boundary')
   need(entry['RUNNO']=='1' and entry['INTERVENTION']=='0' and entry['APCFLAG']=='0' and entry['MARKETSUSPENDEDFLAG']=='0','Exact selected run/intervention/flags')
   raw=entry['RRP'];decimal(raw);need(ending not in group[region][row[3]],'Unique regional layout interval');group[region][row[3]][ending]=raw
  need(set(layouts)=={'2','3'},'Both selected layouts')
  for version,names in layouts.items():need(names==fields['DREGION-NULL-'+version],'All CSV headers equal original publisher field definitions')
  for region,versions in group.items():
   expected={trading_start+timedelta(minutes=5*n) for n in range(1,289)}
   need(set(versions['2'])==set(versions['3'])==expected,'Each full regional trading bundle complete')
   for ending,raw in versions['3'].items():
    need(decimal(raw)==decimal(versions['2'][ending]),'Layout prices disagree')
    if not DAY<ending<=DAY+timedelta(days=1):continue
    need(ending not in chosen[region],'Duplicate selected calendar interval')
    chosen[region][ending]={'raw':raw,'layout2_raw':versions['2'][ending],'rounded':str(round_cent(decimal(raw))),'source_filename':name}
  inputs.append({'file':str((ORIGINAL/name).relative_to(ROOT)),'bytes':len(blob),'sha256':pin,'csv_bytes':len(data),'csv_sha256':hashlib.sha256(data).hexdigest(),'report_generated_raw':rows[0][5]+' '+rows[0][6],'report_records':len(rows)})
 output=[];summaries=[]
 for region in REGIONS:
  path=MONTHLY/('monthly-'+region+'-2026-10-19.csv');raw=path.read_bytes();need(hashlib.sha256(raw).hexdigest()==MONTHLY_PINS[region],'Monthly original specimen hash');monthly={}
  for row in csv.DictReader(io.StringIO(raw.decode())):
   need(row['REGION']==region and row['PERIODTYPE']=='TRADE','Monthly exact region/period type')
   ending=stamp(row['SETTLEMENTDATE']);need(ending not in monthly,'Unique monthly interval');monthly[ending]=Decimal(row['RRP'])
  expected=[DAY+timedelta(minutes=5*n) for n in range(1,289)]
  need(set(chosen[region])==set(monthly)==set(expected),'Exactly288 fixed-AEST calendar intervals')
  for ending in expected:
   row=chosen[region][ending];need(Decimal(row['rounded'])==monthly[ending],'Exact cent-rounded daily/monthly disagreement')
   output.append({'region':region,'period_end':ending.isoformat(),**row})
  summaries.append({'region':region,**summary([decimal(chosen[region][t]['raw']) for t in expected])})
  inputs.append({'file':str(path.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
 return inputs,output,summaries

def main():
 need(len(sys.argv) in [2,3],'FRESH_OUTPUT.json [RUNTIME_CAPTURE.json] required')
 inputs,rows,summaries=extract()
 controls=[]
 for raw,expected in [('0.00499','0.00'),('-0.00499','-0.00'),('0.005','0.01'),('-0.005','-0.01'),('1.005','1.01'),('-1.005','-1.01'),('3E-05','0.00'),('-3E-05','-0.00')]:
  result=round_cent(decimal(raw));need(result==Decimal(expected),'Half-away control');controls.append({'raw':raw,'rounded':str(result),'negative_after_rounding':result<0,'zero_after_rounding':result==0})
 need(summary([Decimal('-0.00499')]*288)['negative_count']==0,'Round before negative classification')
 need(summary([Decimal('0.005')]*144+[Decimal('0')]*144)['mean']=='0.01','Positive mean half-away tie')
 need(summary([Decimal('-0.005')]*144+[Decimal('0')]*144)['mean']=='-0.01','Negative mean half-away tie')
 runtime_checks=None
 if len(sys.argv)==3:
  value=json.loads(Path(sys.argv[2]).read_text());need(value['status']=='ok' and value['calendar_day']=='2026-10-19','Runtime target day')
  for expected in summaries:
   region=next(r for r in value['regions'] if r['region']==expected['region']);need(region['interval_count']==288,'Runtime288')
   for key in ['mean','minimum','maximum','negative_count','zero_count']:need(Decimal(str(region['summary'][key]))==Decimal(str(expected[key])),'Runtime derived '+key)
   expected_rows=[r for r in rows if r['region']==region['region']]
   need(len(region['intervals'])==len(expected_rows),'Runtime coverage')
   for actual,exp in zip(region['intervals'],expected_rows):
    need(actual['period_end']==exp['period_end'] and actual['price_raw']==exp['raw'] and actual['layout2_price_raw']==exp['layout2_raw'] and Decimal(str(actual['price']))==Decimal(exp['rounded']) and actual['source_url'].endswith('/'+exp['source_filename']),'Runtime exact original cell/coverage/source')
  runtime_checks={'cells':576,'derived_measures':10,'pass':True,'capture_sha256':hashlib.sha256(Path(sys.argv[2]).read_bytes()).hexdigest(),'meaning':'Local pure parser comparison only; no access/resource/release acceptance'}
 report={'pass':True,'kind':'Independent stdlibZIP/CSV/Decimal full-original review','input_files':inputs,'calendar_day':'2026-10-19','intervals_per_region':288,'exact_cent_comparisons':len(rows),'layout_numeric_agreement_count':len(rows),'tolerance_after_rounding':'0','rounding':'Per-interval cents ROUND_HALF_UP (half away from zero) before summaries and sign counts','summaries':summaries,'rounding_controls':controls,'mean_tie_controls_pass':True,'round_before_sign_control_pass':True,'runtime_comparison':runtime_checks,'observations':rows,'limits':['Original daily/monthly data share AEMO market lineage.','No finality, future-vintage or actual Worker resource acceptance.','Definition describes a mixed report family; only declared DREGION2/3 is selected.']}
 with Path(sys.argv[1]).open('x') as f:json.dump(report,f,indent=2);f.write('\n')
 print(json.dumps({k:report[k] for k in ['pass','exact_cent_comparisons','layout_numeric_agreement_count','runtime_comparison']}))
if __name__=='__main__':main()
