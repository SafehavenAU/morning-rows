#!/usr/bin/env python3
"""Offline independent refresh reconciliation. No JavaScript reader or network."""
import argparse, csv, datetime, hashlib, importlib.util, json, re
from decimal import Decimal
from pathlib import Path
HERE = Path(__file__).resolve().parent
HISTORICAL = HERE.parents[1] / 'claimant-count-2026-10-20'
SPEC = importlib.util.spec_from_file_location('historical_independent_extractor', HISTORICAL/'verify-original.py')
OLD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OLD)
require = OLD.require
GEOS = OLD.GEOGRAPHIES
DESKS = dict(zip(GEOS, ['united-kingdom','england','scotland','wales','northern-ireland']))
NOMIS_CODES = dict(zip(GEOS,['2092957697','2092957699','2013265931','2013265930','2013265932']))
SOURCE = 'f85224e6a9ee601d9e706ffab2cd133d3697c272'
VERSION = 'b2a562a7-d137-4376-a6ca-54f29f1415ad'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_text())
def verify(here, capture):
    manifest = read(here/'acquisition.json')
    require(len(manifest['records']) == 3, 'exactly three fresh Nomis acquisitions required')
    inputs=[]
    for entry in manifest['records']:
        name=entry.get('retained_file',entry.get('file')); path=here/name
        require(entry['status']==200 and entry['url']==entry['final_url'],'failed or redirected acquisition')
        require(sha(path)==entry.get('retained_sha256',entry['sha256']),'retained digest changed')
        require(path.stat().st_size==entry.get('retained_bytes',entry['bytes']),'retained bytes changed')
        inputs.append({'file':name,'retained_sha256':sha(path),'retained_bytes':path.stat().st_size,'wire_sha256':entry['sha256'],'wire_bytes':entry['bytes'],'url':entry['url']})
    values=OLD.extract_csv(here/'nomis-national.csv')
    json_values,header=OLD.extract_json(here/'nomis-national.excerpt.json')
    require(values==json_values,'CSV/JSON independent extraction mismatch')
    codes=OLD.codelist(here/'nomis-time.json','TIME')
    require(len(codes)==len({c['value'] for c in codes}),'duplicate metadata period')
    by_period={c['value']:OLD.annotations(c) for c in codes}
    live=[p for p,a in by_period.items() if a.get('CurrentRevisionStatus')=='Live']
    latest=max(live)
    require(latest=='2026-09','unexpected refresh vintage; review required')
    periods=OLD.preceding_months(latest)
    require(set(values)=={(g,p) for g in GEOS for p in periods},'not five exact thirteen-month windows')
    selected_metadata=[]
    for p in periods:
        a=by_period[p]
        require(a['CurrentRevisionStatus']=='Live','non-live month')
        require(datetime.date.fromisoformat(a['taken on']).isoformat().startswith(p),'reference month mismatch')
        require(type(a['CurrentRevisionVersion']) is int and a['CurrentRevisionVersion']>=0,'invalid revision version')
        release=datetime.datetime.strptime(a['CurrentRevisionReleased'],'%Y-%m-%d %H:%M:%S')
        require(release.date()>=datetime.date.fromisoformat(a['taken on']),'revision predates reference')
        selected_metadata.append({'period':p,**a,'release_timezone':None})
    csv_rows=list(csv.DictReader((here/'nomis-national.csv').open(encoding='utf-8-sig',newline='')))
    json_rows={(x['geography']['geogcode'],x['time']['value']):x for x in read(here/'nomis-national.excerpt.json')['obs']}
    for row in csv_rows:
        g,p=row['GEOGRAPHY_CODE'],row['DATE']; a=by_period[p]
        encoded=int(p[:4])*16+int(p[5:]); expected=f'Nm-162d1d{encoded}e{a["CurrentRevisionVersion"]}d{NOMIS_CODES[g]}d0d0d0d1d20100'
        require(row['URN']==json_rows[g,p]['urn']==expected,'URN dimensions/month/revision mismatch')
    old_manifest=read(HISTORICAL/'original/acquisition.json')
    old_values=OLD.extract_csv(HISTORICAL/'original/nomis-national.csv')
    # Historical dimension metadata is reused explicitly, never described as a fresh acquisition.
    metadata_inputs=[]
    for name in ['nomis-dataset.json','nomis-gender.json','nomis-age.json','nomis-measure.json','nomis-measures.json','nomis-countries.json','nomis-regions.json']:
        entry=next(e for e in old_manifest['records'] if e.get('retained_file',e.get('file'))==name)
        path=HISTORICAL/'original'/name
        require(sha(path)==entry['retained_sha256'],'historical metadata changed')
        metadata_inputs.append({'file':str(path.relative_to(HERE.parents[2])),'sha256':sha(path),'retrieved_at':entry['finished_at'],'fresh':False})
    old_meta={x['value']:OLD.annotations(x) for x in OLD.codelist(HISTORICAL/'original/nomis-time.json','TIME')}
    revisions=[]
    for (g,p),n in values.items():
        if (g,p) in old_values and (n!=old_values[g,p] or by_period[p]['CurrentRevisionVersion']!=old_meta[p]['CurrentRevisionVersion']):
            revisions.append({'geography':GEOS[g],'geography_code':g,'period':p,'previous_value':old_values[g,p],'refreshed_value':n,'delta':n-old_values[g,p],'previous_revision':old_meta[p]['CurrentRevisionVersion'],'refreshed_revision':by_period[p]['CurrentRevisionVersion']})
    rounding=[]
    for p in periods:
        uk=values['K02000001',p]; total=sum(values[g,p] for g in GEOS if g!='K02000001')
        require(abs(Decimal(uk-total))<=Decimal('12.5'),'UK/nations rounding discrepancy')
        rounding.append({'period':p,'uk':uk,'four_nation_sum':total,'residual_persons':uk-total})
    report=read(capture); captures=[]
    for g,desk in DESKS.items():
        matches=[c for c in report['checks'] if c.get('override') is True and c.get('path')==f'/{desk}.json']
        require(len(matches)==1,'missing or ambiguous candidate capture')
        c=matches[0]; h=c['headers']; native=c['body']['claimant_count']; health=c['body']['sources']['claimant_count']
        require(c['status']==200 and c['json_valid'] is True and h['x-source-revision']==SOURCE and h['x-worker-version']==VERSION,'wrong candidate capture identity')
        require(health['status']=='ok','candidate source not healthy')
        require(native['dataset']=='NM_162_1' and native['measure']=='claimants' and native['geography_code']==g and native['geography']==GEOS[g],'candidate series mismatch')
        require(native['unit']=='persons' and native['adjustment']=='not seasonally adjusted','candidate units/adjustment mismatch')
        require(native['metadata']['first_period']==periods[0] and native['metadata']['latest_period']==latest and native['metadata']['count']==13 and native['metadata']['acquisition_record_count']==65,'candidate coverage mismatch')
        require(len(native['rows'])==13 and [r['period'] for r in native['rows']]==periods,'candidate periods mismatch')
        for r in native['rows']:
            p=r['period']; a=by_period[p]
            require(type(r['value']) is int and r['value']==values[g,p],'candidate numerical mismatch')
            require(r['geography_code']==g and r['geography']==GEOS[g] and r['unit']=='persons' and r['adjustment']=='not seasonally adjusted' and r['value_state']=='observed' and r['obs_status']=='A' and r['obs_conf']=='F','candidate row semantics mismatch')
            require(r['dimensions']=={'dataset':'NM_162_1','gender':'0','age':'0','measure':'1','measures':'20100','geography':g},'candidate dimensions mismatch')
            require(r['reference_date']==a['taken on'] and r['release_timestamp_raw']==a['CurrentRevisionReleased'] and r['release_timezone'] is None and r['revision_version']==a['CurrentRevisionVersion'],'candidate revision/reference mismatch')
        counts=[x for x in native['provenance'] if x['kind']=='publisher_national_counts']
        require(len(counts)==1 and counts[0]['sha256']==sha(here/'nomis-national.csv'),'candidate CSV differs from refreshed original')
        captures.append({'desk':desk,'observations_compared':13,'at':c['at'],'source_fetched_at':health['fetched_at'],'latest_count':values[g,latest],'pass':True})
    return {'pass':True,'kind':'independent_local_reconciliation_of_retained_publisher_refresh_and_existing_candidate_capture','verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Python csv.DictReader/Decimal and independently acquired Nomis JSON; exact time/URN revision checks; no production reader imports and no endpoint requests by this verifier','observations_compared':65,'observations_compared_csv_json':65,'observations_compared_candidate':65,'period_start':periods[0],'period_end':latest,'acquisition_completed_at':manifest['retrieved_at'],'inputs':inputs,'verifier_sha256':sha(Path(__file__)),'historical_extractor_sha256':sha(HISTORICAL/'verify-original.py'),'historical_dimension_metadata':metadata_inputs,'publisher_json_prepared_raw':header.get('prepared'),'publisher_json_extracted_raw':header.get('extracted'),'period_metadata':selected_metadata,'history':[{'geography':GEOS[g],'geography_code':g,'observations':[{'period':p,'count':values[g,p],'obs_status':'A','obs_conf':'F'} for p in periods],'latest_count':values[g,latest]} for g in GEOS],'revisions_against_retained_august_release':revisions,'uk_nation_rounding_checks':rounding,'candidate_capture':{'file':str(capture),'sha256':sha(capture),'source_revision':SOURCE,'worker_version':VERSION,'checks':captures},'limitations':['CSV and JSON are distinct representations and extraction methods with shared Nomis statistical lineage.','Candidate values are reader outputs, compared only after independent publisher extraction; they are not an independent population enumeration.','NISRA independently presented comparable latest NI cell is recorded separately; it does not independently verify all65 cells.','Publisher release/revision strings have no established timezone; original strings retained and release_timezone=null.','Publisher prepared/extracted clocks are not independently verified local retrieval timestamps.','Historical dimension codelists are pinned prior evidence, not newly downloaded.','This proves retained September2026 vintage only and creates no collection checkpoint, release approval, source alert, or scheduled observation evidence.']}
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture',type=Path,default=HERE.parent/'legacy-cpu.json')
    parser.add_argument('--output',type=Path,default=HERE/'independent-report.json')
    args=parser.parse_args(); result=verify(HERE,args.capture)
    with args.output.open('x') as f: json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({k:result[k] for k in ['pass','observations_compared_csv_json','observations_compared_candidate','period_start','period_end']}))
