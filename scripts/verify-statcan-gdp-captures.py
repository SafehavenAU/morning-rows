#!/usr/bin/env python3
"""Verify retained actual GDP captures against independently extracted evidence.

CAPTURE_DIR REFERENCE_JSON OUTPUT --expected-revision SHA --expected-version UUID
[--domains apex|both]. Offline only; no runtime imports or replacement fixtures.
"""
import argparse
import calendar
from collections import Counter
import copy
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, urlsplit
from jsonschema import Draft202012Validator, FormatChecker

APEX='https://morningrows.com'
WWW='https://www.morningrows.com'
SOURCE='/canada.json?source=product'
UNIT='millions of chained (2017) dollars'
ADJUSTMENT='Seasonally adjusted at annual rates'
SOURCE_URL='https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610010401'
DIMS={'product':'36100104','coordinate':'1.1.1.30.0.0.0.0.0.0','vector':'62305752','geography':'1','prices':'1','seasonal_adjustment':'1','estimates':'30'}
PROVENANCE={role:'https://www150.statcan.gc.ca/t1/wds/rest/'+endpoint for role,endpoint in [('data','getDataFromCubePidCoordAndLatestNPeriods'),('series','getSeriesInfoFromCubePidCoord'),('cube','getCubeMetadata')]}
FORMATS=FormatChecker()

def require(ok,message):
    if not ok: raise ValueError(message)

def digest(data): return sha256(data).hexdigest()

@FORMATS.checks('date-time', raises=(ValueError,TypeError))
def valid_datetime(value):
    if not isinstance(value,str): return True
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})',value): return False
    parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
    return parsed.tzinfo is not None

@FORMATS.checks('date', raises=(ValueError,TypeError))
def valid_date(value):
    return not isinstance(value,str) or bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',value)) and date.fromisoformat(value).isoformat()==value

@FORMATS.checks('uri', raises=(ValueError,TypeError))
def valid_uri(value):
    if not isinstance(value,str): return True
    if not value.isascii() or re.search(r'[\x00-\x20<>"{}|\\^`\x7f]|%(?![a-fA-F0-9]{2})',value): return False
    parsed=urlsplit(value)
    if not re.fullmatch('[A-Za-z][A-Za-z0-9+.-]*',parsed.scheme): return False
    if parsed.scheme in ('http','https'):
        if not parsed.hostname or parsed.username or parsed.password: return False
        parsed.port
    return True

def reject_remote_refs(value):
    if isinstance(value,dict):
        for key,item in value.items():
            if key in ('$ref','$dynamicRef'): require(isinstance(item,str) and item.startswith('#'),'External schema reference')
            reject_remote_refs(item)
    elif isinstance(value,list):
        for item in value: reject_remote_refs(item)

def expected_routes(quarters):
    level=SOURCE+'&measure=level'; growth=SOURCE+'&measure=quarter_change'
    routes=[(p,'GET',False,200,None) for p in ['/health.json','/schema.json','/canada.json','/catalog.json?desk=canada',SOURCE,level,*[level+'&observation='+q for q in quarters],growth,growth+'&observation='+quarters[-1],level]]
    routes.extend([(level,'GET',True,304,None),(level,'HEAD',False,200,None)])
    routes.extend((p,'GET',False,s,e) for p,s,e in [
        (level+'&observation=1900-Q1',404,'observation_not_retained'),
        (growth+'&observation='+quarters[0],404,'observation_not_retained'),
        (SOURCE+'&measure=nominal_gdp',404,'unknown_measure'),
        (level+'&geography=Ontario',400,'unsupported_query'),
        (level+'&date=2026-04',400,'unsupported_query'),
        (SOURCE+'&source=price_index',400,'unsupported_query')])
    return routes

def verify(directory,reference_file,revision,version,domains):
    report={'pass':False,'method':'Offline exact capture identity/hash/schema binding; independently extracted original publisher levels and Decimal ordinary growth; no runtime parser imported',
            'expected_revision':revision,'expected_version':version,'domains':domains,'inputs':[],'transport':[],'native_comparisons':[],'selected_comparisons':[],'schema_checks':[],'schema_negative_controls':[],
            'limitations':['All official views share Statistics Canada national-accounts lineage.','This verifies retained evidence consistency, not independent authentication of supplied captures.','Constructed controls are not live publisher or sustained scheduled evidence.']}
    def load(path):
        raw=path.read_bytes();report['inputs'].append({'file':str(path),'sha256':digest(raw),'bytes':len(raw)});return json.loads(raw)
    try:
        require(re.fullmatch('[a-f0-9]{40}',revision),'Invalid expected revision')
        require(re.fullmatch('[a-f0-9-]{36}',version),'Invalid expected Worker version')
        ref=load(reference_file);refhash=report['inputs'][-1]['sha256'];refbytes=report['inputs'][-1]['bytes']
        require(ref.get('pass') is True and ref.get('product_id')==36100104 and ref.get('coordinate')==DIMS['coordinate'] and ref.get('vector_id')==62305752,'Independent reference identity/pass')
        quarters=ref['quarters'];levels=ref['levels']
        require(len(quarters)==len(set(quarters))==len(levels)==2 and all(re.fullmatch(r'\d{4}-Q[1-4]',q) for q in quarters),'Independent quarter coverage')
        indices=[int(q[:4])*4+int(q[-1])-1 for q in quarters]
        require(indices[1]==indices[0]+1 and all(type(v) is int and v>0 for v in levels),'Independent adjacency/positive levels')
        derived=(100*(Decimal(levels[1])/Decimal(levels[0])-1)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
        require(derived==Decimal(ref['ordinary_growth_two_decimals']),'Independent decimal growth mismatch')
        require(ref['unit']==UNIT and ref['level_adjustment']==ADJUSTMENT and ref['release_timezone'] is None,'Independent units/timezone')
        require(ref['exact_comparisons']=={'wds_vs_csv':2,'wds_vs_selected_table':2,'wds_vs_dated_daily_table4':2},'Independent evidence coverage')
        report.update(reference_sha256=refhash,verified_quarters=quarters,verified_levels=levels,ordinary_growth=str(derived))
        capture=load(directory/'gdp-interface-report.json')
        require(capture.get('revision')==revision and capture.get('version')==version and capture.get('pass') is True,'Capture identity or runner failure')
        reference_meta=capture.get('reference',{})
        require(reference_meta.get('sha256')==refhash and reference_meta.get('bytes')==refbytes,'Capture reference is not the pinned supplied evidence')
        routes=expected_routes(quarters);rules={(p,m,c):(s,e) for p,m,c,s,e in routes}
        origins=[APEX] if domains=='apex' else [APEX,WWW]
        records=capture['requests'];expected=Counter((o,p,m,c) for o in origins for p,m,c,_,_ in routes)
        require(Counter((r.get('origin'),r.get('path'),r.get('method'),r.get('conditional')) for r in records)==expected,'Missing/extra/unknown captured route')
        bodies={};seen=set();latest={}
        for i,r in enumerate(records):
            status,error=rules[(r['path'],r['method'],r['conditional'])];h=r['headers'];label=r['origin']+' '+r['method']+' '+r['path']
            require(type(r['conditional']) is bool and r['status']==status and r['expected_status']==status,'Wrong status: '+label)
            require(h.get('x-source-revision')==revision and h.get('x-worker-version')==version,'Wrong response identity: '+label)
            require(valid_datetime(r['started_at']) and valid_datetime(r['completed_at']) and r['started_at']<=r['completed_at'],'Invalid capture timestamps')
            if r['method']=='HEAD' or r['conditional']:
                require(r['bytes']==0 and r['sha256']==digest(b'') and not r.get('file'),'Unexpected body for HEAD/304')
                require(latest.get((r['origin'],r['path']))==h.get('etag') and bool(h.get('etag')),'Conditional/HEAD identity not bound to earlier GET')
            else:
                f=r.get('file');require(isinstance(f,str) and re.fullmatch(r'\d{3}\.body',f) and f not in seen,'Invalid/duplicate capture filename');seen.add(f)
                raw=(directory/f).read_bytes();require(len(raw)==r['bytes'] and digest(raw)==r['sha256'],'Body hash/length mismatch: '+f)
                body=json.loads(raw);bodies[i]=body
                if status==200:
                    latest[(r['origin'],r['path'])]=h.get('etag')
                    if 'source=' in r['path']:
                        ttl=re.search(r'(?:^|[, ])max-age=(\d+)',h.get('cache-control',''));require(ttl and int(ttl[1])<=120,'Unbounded selected cache')
                else:
                    require(body.get('error')==error or body.get('reason')==error,'Incorrect refusal reason')
                    require(body.get('data') is None and not body.get('observations'),'Refusal substituted observations')
            report['transport'].append({'request':i,'label':label,'status':status,'pass':True})
        def row_check(row,index):
            q=quarters[index];y=int(q[:4]);m=(int(q[-1])-1)*3+1
            start=f'{y:04}-{m:02}-01';end=f'{y:04}-{m+2:02}-{calendar.monthrange(y,m+2)[1]:02}'
            expected={'period':q,'quarter':q,'value':levels[index],'value_state':'observed','reference_date':start,'period_start':start,'period_end':end,'ref_per_raw':f'{y:04}-{m+2:02}-01','ref_per2':'','ref_per_raw2':'','unit':UNIT,'geography':'Canada','adjustment':ADJUSTMENT,'price_basis':'Chained (2017) dollars','dimensions':DIMS,'scalar_code':6,'unit_code':81,'frequency_code':9,'decimals':0,'status_code':0,'security_level_code':0,'symbol_code':0,'symbol':'none','release_timestamp_raw':ref['release_timestamp_raw'],'release_timezone':None}
            require(row==expected,'Level/reference semantics mismatch '+q)
        def growth_check(growth,inputs=False):
            require(growth['period']==quarters[1] and Decimal(str(growth['value']))==derived and growth['previous_period']==quarters[0] and growth['previous_value']==levels[0] and growth['current_value']==levels[1],'Derived growth values/periods')
            require(growth['kind']=='derived' and growth['annualized'] is False and growth['unit']=='percent' and growth['value_state']=='observed' and growth['formula']=='100 * (current_value / previous_value - 1)','Growth interpretation')
            if inputs:
                require(len(growth['inputs'])==2,'Derived input coverage')
                for n,row in enumerate(growth['inputs']):row_check(row,n)
        def native_check(native):
            require(len(native['rows'])==2,'Native two-quarter coverage')
            for n,row in enumerate(native['rows']):row_check(row,n)
            growth_check(native['growth'])
            require(native['level']==levels[1] and Decimal(str(native['quarter_change']))==derived and native['quarter']==quarters[1] and native['period']==native['rows'][1]['reference_date'][:7],'Legacy fields differ')
            require(native['geography']=='Canada' and native['unit']==UNIT and native['adjustment']==ADJUSTMENT and native['source_url']==SOURCE_URL,'Native semantics/source')
            meta=native['metadata'];require(meta['first_quarter']==quarters[0] and meta['latest_quarter']==quarters[1] and meta['cube_end_date']==native['rows'][1]['reference_date'] and meta['release_timestamp_raw']==ref['release_timestamp_raw'] and meta['release_timezone'] is None,'Cube/release anchor changed')
            require(len(native['provenance'])==3 and {p['role'] for p in native['provenance']}==set(PROVENANCE),'Actual acquisition provenance absent')
            for p in native['provenance']:require(p['url']==PROVENANCE[p['role']] and valid_datetime(p['retrieved_at']) and p['retrieved_at'].endswith('Z') and p['retrieved_at'][:10]>=native['rows'][1]['period_end'],'Provenance URL/time')
        for origin in origins:
            docs=[(i,r,bodies[i]) for i,r in enumerate(records) if r['origin']==origin and i in bodies and r['status']==200]
            schema=next(b for _,r,b in docs if r['path']=='/schema.json');require(schema.get('$id')==APEX+'/schema.json' and schema.get('$schema')=='https://json-schema.org/draft/2020-12/schema','Unexpected captured schema identity/dialect');reject_remote_refs(schema);Draft202012Validator.check_schema(schema)
            validator=Draft202012Validator(schema,format_checker=FORMATS)
            native=next(b['product'] for _,r,b in docs if r['path']=='/canada.json');native_check(native)
            full=next(b for _,r,b in docs if r['path']=='/canada.json');require(full.get('country')=='Canada' and full['sources']['product']['status']=='ok','Product source health')
            report['native_comparisons'].extend({'origin':origin,'measure':m,'period':q,'expected':v,'pass':True} for m,q,v in [('level',quarters[0],levels[0]),('level',quarters[1],levels[1]),('quarter_change',quarters[1],float(derived))])
            health=next(b for _,r,b in docs if r['path']=='/health.json');require(health.get('source_dirty') is False and health.get('source_revision')==revision and health.get('worker_version')==version,'Health identity/clean state')
            versions={}
            for i,r,body in docs:
                if r['path'] in ('/health.json','/schema.json'):continue
                errors=list(validator.iter_errors(body));require(not errors,'Captured schema failed '+r['path']+': '+('; '.join(e.message[:180] for e in errors[:2])))
                report['schema_checks'].append({'origin':origin,'path':r['path'],'pass':True})
                if r['path'].startswith('/catalog'):
                    card=next(x for x in body['sources'] if x['key']=='product');require([m['id'] for m in card['measures']]==['level','quarter_change'],'GDP discovery IDs');continue
                if not r['path'].startswith(SOURCE):continue
                query=parse_qs(urlsplit(r['path']).query);measure=query.get('measure',[None])[0];period=query.get('observation',[None])[0]
                expected_cells=[('level',q,v) for q,v in zip(quarters,levels)]+[('quarter_change',quarters[1],float(derived))]
                expected_cells=[x for x in expected_cells if (measure is None or x[0]==measure) and (period is None or x[1]==period)]
                require(len(body['observations'])==len(expected_cells) and body['retrieval']['status']=='ok' and not body.get('unavailable_measures'),'Selector coverage/health')
                require({k:v for k,v in body['context'].items() if k!='provenance'}=={k:v for k,v in native.items() if k not in ('rows','provenance')},'Selected statistical context differs from captured native')
                native_check({**body['context'],'rows':native['rows']})
                if measure is None:
                    native_check(body['data'])
                    require({k:v for k,v in body['data'].items() if k!='provenance'}=={k:v for k,v in native.items() if k!='provenance'},'Source selector statistical native differs')
                elif measure=='level':require(body['data']==(native['rows'][quarters.index(period)] if period else native['rows']),'Level selected data differs')
                else:growth_check(body['data'],True)
                for obs,(m,q,value) in zip(body['observations'],expected_cells):
                    require(obs['definition']['id']==m and obs['period']==q and obs['value']==value and obs['value_state']=='observed','Selected numeric/reference mismatch')
                    require(obs['id']==APEX+SOURCE+'&measure='+m+'&observation='+q and obs['measure']==APEX+SOURCE+'&measure='+m,'Canonical observation identity')
                    if m=='level':row_check(obs['qualifications'],quarters.index(q))
                    else:growth_check(obs['qualifications'],True)
                    previous=versions.setdefault(obs['id'],obs['version']);require(previous==obs['version'],'Same observation changed within captured selectors')
                    report['selected_comparisons'].append({'origin':origin,'request':i,'measure':m,'period':q,'value':value,'pass':True})
            # Demonstrate the captured schema rejects meaningful semantic/format drift.
            mutations=[('geography',lambda n:n.update(geography='Ontario')),('unit',lambda n:n.update(unit='dollars')),('scalar',lambda n:n['rows'][0].update(scalar_code=3)),('suppression',lambda n:n['rows'][0].update(security_level_code=1)),('status',lambda n:n['rows'][0].update(status_code=1)),('zero',lambda n:n['rows'][0].update(value=0)),('null',lambda n:n['rows'][0].update(value=None)),('annualized',lambda n:n['growth'].update(annualized=True)),('growthkind',lambda n:n['growth'].update(kind='observation')),('timezone',lambda n:n['metadata'].update(release_timezone='UTC')),('badtime',lambda n:n['provenance'][0].update(retrieved_at='unknown')),('unzonetime',lambda n:n['provenance'][0].update(retrieved_at='2026-10-20T10:00:00')),('badcalendar',lambda n:n['provenance'][0].update(retrieved_at='2026-02-30T10:00:00Z')),('baduri',lambda n:n['provenance'][0].update(url='relative')),('symbol',lambda n:n['rows'][0].update(symbol='final')),('symbolmismatch',lambda n:n['rows'][0].update(symbol_code=1)),('missingrow',lambda n:n['rows'].pop()),('extraquarter',lambda n:n['rows'].append(copy.deepcopy(n['rows'][0])))]
            native_schema={'$schema':schema['$schema'],'$defs':schema['$defs'],'$ref':'#/$defs/statcanGdpNative'}
            nv=Draft202012Validator(native_schema,format_checker=FORMATS)
            for label,mutate in mutations:
                changed=copy.deepcopy(native);mutate(changed);require(not nv.is_valid(changed),'Schema accepted negative '+label);report['schema_negative_controls'].append({'origin':origin,'mutation':label,'pass':True})
        report['counts']={key:len(report[key]) for key in ['transport','native_comparisons','selected_comparisons','schema_checks','schema_negative_controls']}
        report['pass']=True
    except Exception as error:report['error']=str(error)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('capture_dir',type=Path);parser.add_argument('reference',type=Path);parser.add_argument('output',type=Path);parser.add_argument('--expected-revision',required=True);parser.add_argument('--expected-version',required=True);parser.add_argument('--domains',choices=['apex','both'],default='both');args=parser.parse_args()
    if args.output.exists():parser.error('Output already exists; retain failed evidence and use a new path')
    result=verify(args.capture_dir,args.reference,args.expected_revision,args.expected_version,args.domains)
    with args.output.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'pass':result['pass'],'counts':result.get('counts'),'error':result.get('error'),'output':str(args.output)}));sys.exit(0 if result['pass'] else 1)
