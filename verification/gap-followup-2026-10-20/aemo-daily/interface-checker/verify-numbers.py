#!/usr/bin/env python3
"""Independent original ZIP/CSV/Decimal versus retained public captures; no HTTP.
CAPTURE OUTPUT REVISION VERSION [staged]. Repeated selectors do not add original cells.
"""
from pathlib import Path
from decimal import Decimal
from hashlib import sha256
from datetime import datetime,timezone
import importlib.util,json,re,sys
ROOT=Path(__file__).resolve().parents[4]
SPEC=importlib.util.spec_from_file_location('original_aemo_extraction',Path(__file__).resolve().parent.parent/'review/verify-rounding.py')
original=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(original)
PERIOD='2026-10-19';BASE='/australia.json?source=grid_day';STATS=['mean','minimum','maximum','negative_count','zero_count']
def verify(directory,revision,version,staged):
 report={'kind':'Independent Python original ZIP/CSV/Decimal public-capture comparison','pass':False,'revision':revision,'version':version,'staged':staged,'inputs':[],'checks':[],'unique_original_intervals_per_domain':576,'unique_derived_measures_per_domain':10,'shared_aemo_market_lineage':True}
 def need(ok,msg):
  if not ok:raise ValueError(msg)
 def load(path):
  raw=path.read_bytes();report['inputs'].append({'file':str(path.relative_to(directory)),'bytes':len(raw),'sha256':sha256(raw).hexdigest()});return json.loads(raw)
 def native(value,label):
  need(value['status']=='ok' and value['calendar_day']==PERIOD and [r['region'] for r in value['regions']]==['SA1','VIC1'],label+' day/regions')
  for region in value['regions']:
   cells=by_region[region['region']];need(len(region['intervals'])==288,label+' exact interval count')
   for actual,expected in zip(region['intervals'],cells):
    need(actual['period_end']==expected['period_end'] and actual['price_raw']==expected['raw'] and actual['layout2_price_raw']==expected['layout2_raw'] and Decimal(str(actual['price']))==Decimal(expected['rounded']) and actual['source_url'].endswith('/'+expected['source_filename']),label+' exact raw/rounded/period/ownership')
   for stat in STATS:need(Decimal(str(region['summary'][stat]))==Decimal(str(by_summary[region['region']][stat])),label+' derived '+stat)
  report['checks'].append({'label':label,'pass':True,'repeated_original_interval_comparisons':576,'repeated_derived_comparisons':10})
 try:
  need(bool(re.fullmatch('[a-f0-9]{40}',revision)) and bool(re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',version)),'Invalid identity')
  inputs,rows,summaries=original.extract();report['publisher_inputs']=inputs
  by_region={region:[row for row in rows if row['region']==region] for region in ['SA1','VIC1']};by_summary={row['region']:row for row in summaries}
  captured=load(directory/'aemo-daily-interface-report.json');need(captured['pass'] and captured['revision']==revision and captured['version']==version and captured['staged']==staged,'Capture identity')
  origins=['https://morningrows.com'] if staged else ['https://morningrows.com','https://www.morningrows.com'];counts={origin:{'native':0,'source':0,'measures':set(),'observations':set()}for origin in origins}
  need(len(captured['requests'])==34*len(origins),'Exact bounded capture count')
  seen=set()
  for request in captured['requests']:
   need(request['origin'] in origins and request['headers']['x-source-revision']==revision and request['headers']['x-worker-version']==version,'Response identity')
   if not(request['method']=='GET' and not request['conditional'] and request['status']==200):continue
   filename=request['file'];need(bool(re.fullmatch(r'\d{3}\.body',filename)) and filename not in seen,'Safe unique capture');seen.add(filename)
   body=load(directory/filename);need(report['inputs'][-1]['bytes']==request['bytes'] and report['inputs'][-1]['sha256']==request['sha256'],'Retained body hash')
   path=request['path'];count=counts[request['origin']]
   if path=='/australia.json':native(body['grid_day'],request['origin']+' native');count['native']+=1
   elif path.startswith(BASE):
    from urllib.parse import urlsplit,parse_qs
    query=parse_qs(urlsplit(path).query);measure=query.get('measure',[None])[0];native(body['context'],request['origin']+' '+path+' context')
    expected=[r+'.'+s for r in ['SA1','VIC1'] for s in STATS] if measure is None else [measure]
    need(len(body['observations'])==len(expected),'Typed coverage')
    for actual,want in zip(body['observations'],expected):
     region,stat=want.split('.');need(actual['period']==PERIOD and actual['definition']['id']==want and actual['value_state']=='observed' and Decimal(str(actual['value']))==Decimal(str(by_summary[region][stat])),'Exact typed independent statistic')
     q=actual['qualifications'];need(q['region']==region and q['statistic']==stat and q['period']==PERIOD and q['unit']==('five-minute intervals' if stat.endswith('_count') else 'AUD/MWh'),'Typed geography/period/units')
    if measure is None:native(body['data'],request['origin']+' selected source');count['source']+=1
    else:
     q=body['data'];region,stat=measure.split('.');need(q['period']==PERIOD and Decimal(str(q['value']))==Decimal(str(by_summary[region][stat])),'Selected data statistic')
     key='observations' if 'observation' in query else 'measures';need(measure not in count[key],'Duplicate selected measure');count[key].add(measure)
  wanted={r+'.'+s for r in ['SA1','VIC1'] for s in STATS}
  for count in counts.values():need(count['native']==count['source']==1 and count['measures']==count['observations']==wanted,'Complete independent numeric route coverage')
  report['pass']=True
 except Exception as error:report['error']=str(error)
 report['verified_at']=datetime.now(timezone.utc).isoformat();return report
if __name__=='__main__':
 args=sys.argv[1:]
 if len(args)not in(4,5)or len(args)==5 and args[4]!='staged':raise SystemExit('CAPTURE OUTPUT REVISION VERSION [staged]')
 directory,output,revision,version=args[:4];r=verify(Path(directory),revision,version,len(args)==5)
 with Path(output).open('x')as f:json.dump(r,f,indent=2);f.write('\n')
 print(json.dumps({'pass':r['pass'],'error':r.get('error'),'checks':len(r['checks']),'unique_intervals_per_domain':576,'unique_summaries_per_domain':10}));raise SystemExit(not r['pass'])
