"""Reconcile current monitor values with retained original publisher selections.
This certifies only listed value/period cells; the monitor handles dimensions.
"""
import json,pathlib,urllib.parse,sys
root=pathlib.Path(__file__).resolve().parent.parent
report=json.loads(pathlib.Path(sys.argv[1]).read_text());base=root/'verification/operations-2026-10-18'
ref=json.loads((root/'verification/structure-2026-10-17/publisher-reference.json').read_text())
expected={};evidence={}
def set_expected(key,pairs,path):expected[key]=pairs;evidence[key]=path
set_expected('australia/hospital',{r['reporting_unit_code']+'.'+r['reported_measure_code']:(r['value'],'2024-25')for r in ref['aihw']},'verification/structure-2026-10-17/publisher-reference.json')
set_expected('wales/projection',{'population-2024-based':(int(ref['wales'][0]['Data values']),ref['wales'][0]['Year'])},'verification/structure-2026-10-17/publisher-reference.json')
set_expected('northern-ireland/childhood_bmi',{r['selection']['STATISTIC']:(r['value'],r['selection']['TLIST(A1)'])for r in ref['nisra']},'verification/structure-2026-10-17/publisher-reference.json')
boc=json.loads((base/'reconciliation/boc.json').read_text());set_expected('canada/exchange',{r['series']:(r['value'],boc['period'])for r in boc['pairs']},'verification/operations-2026-10-18/reconciliation/boc.json')
ph=json.loads((base/'reconciliation-second/pharmacies.json').read_text());fields={'total':'TOTAL_PHARMACIES','excluding_distance_sellers':'TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS','distance_sellers':'TOTAL_DISTANCE_SELLING_PHARMACIES','excluding_distance_sellers_opened':'TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_OPENED','excluding_distance_sellers_closed':'TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_CLOSED','excluding_distance_sellers_net_change':'PHARMACIES_EXCLUDING_DISTANCE_SELLERS_NET_CHANGE','distance_sellers_opened':'DISTANCE_SELLERS_OPENED','distance_sellers_closed':'DISTANCE_SELLERS_CLOSED','distance_sellers_net_change':'DISTANCE_SELLERS_NET_CHANGE'}
set_expected('england/pharmacies',{k:(int(ph['csv_row'][v]),'2026-09')for k,v in fields.items()},'verification/operations-2026-10-18/reconciliation-second/pharmacies.json')
ins=json.loads((base/'reconciliation-second/insolvencies.json').read_text());assert ins['values']==ins['publication_values']
fields={'total-company-insolvencies':'total','compulsory-liquidations':'compliq','creditors-voluntary-liquidations':'cvl','administrations':'admin','company-voluntary-arrangements':'cva','administrative-receiverships':'rec'}
for desk,code in [('scotland','sc'),('northern-ireland','ni')]:set_expected(desk+'/company_insolvencies',{k:(ins['values'][v+'_'+code+'_nsa'],ins['period'])for k,v in fields.items()},'verification/operations-2026-10-18/reconciliation-second/insolvencies.json')
approvals={};comparisons=[]
for key,pairs in expected.items():
    outcomes=report['results'][key];assert len(outcomes)==2,key+' both domains required'
    versions=set()
    for origin,data in outcomes.items():
        assert data['kind']=='success',key
        got={urllib.parse.parse_qs(urllib.parse.urlparse(o['id']).query)['measure'][0]:(o['value'],o['period'])for o in data['observations']}
        assert got==pairs,(key,got,pairs)
        versions.add(data['version']);comparisons.append({'source':key,'origin':origin,'cells':len(got),'match':True})
    assert len(versions)==1,key
    approvals[key]={'version':versions.pop(),'evidence':evidence[key],'reviewed_at':report['finished_at'],'assurance':'Exact retained publisher value/period match; monitor separately validates dimensions. Original extraction lineage and dates remain in cited file.'}
(root/'operations/approved-observations.json').write_text(json.dumps(approvals,indent=2)+'\n')
(base/'reconciled-production.json').write_text(json.dumps({'checked_at':report['finished_at'],'report':str(pathlib.Path(sys.argv[1])),'comparisons':comparisons,'limits':'Not a fresh publisher fetch for retained annual AIHW/Wales/NISRA references; unchanged current cells match their dated official specimen. Same publisher statistical lineage. NZ prices, Stats NZ and CPI not approved here.'},indent=2)+'\n')
print('Both domains: 70 selected value/period cells reconcile; evidence approvals written.')
