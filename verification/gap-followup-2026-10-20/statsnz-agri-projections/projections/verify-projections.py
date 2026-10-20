#!/usr/bin/env python3
"""Offline stdlib extraction of minimal original publisher fragments, not a runtime reader.
The output verifies evidence boundaries; a passing verifier does NOT close either gap.
"""
from pathlib import Path
import csv,io,json,xml.etree.ElementTree as ET,sys,hashlib,copy
ROOT=Path(__file__).resolve().parent
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def cells(name):
 strings=json.loads((ROOT/'original'/f'{name}-strings.json').read_text());out={}
 for c in ET.parse(ROOT/'original'/f'{name}.xml').findall('.//m:c',NS):
  v=c.find('m:v',NS)
  if v is not None:out[c.attrib['r']]=strings[v.text] if c.attrib.get('t')=='s' else v.text
 return out
def readcsv(name):return list(csv.reader(io.StringIO((ROOT/'original'/name).read_text(encoding='utf-8-sig'))))
checks=[]
def check(name,value):
 if not value:raise AssertionError(name)
 checks.append(name)
lab=cells('labour-table1');h1=cells('household-table1');h3=cells('household-table3')
check('labour_exact_year_is_2026',lab['A13']=='2026')
check('labour_direct_median_column_bound',lab['E7']=='50th\n(Median)')
check('labour_direct_unit_is_thousands',lab['A9']=='Labour force (000)')
check('labour_direct_value_is_3144_thousand',lab['E13']=='3144')
check('labour_base_and_reference_day_bound',lab['A4']=='2024(base)–2078' and lab['A6']=='Year at\n30 June')
check('publisher_median_additivity_exception_retained','except the 50th percentile (median)' in lab['A433'])
check('publisher_component_rounding_warning_retained','Owing to rounding' in lab['A432'])
graph=readcsv('labour-broad-age-2026.csv');check('graph_exact_year_bound',graph[0]==['June year','2026'])
ages={r[0]:int(r[1]) for r in graph[1:]};check('graph_four_age_groups',ages=={'15–24':463200,'25–44':1357600,'45–64':1088700,'65+':234600})
check('sum_is_qualified_corroboration_only',sum(ages.values())==3144100)
check('household_rounded_table_is_medium_B',h1['A19'].startswith('Medium B:'))
check('household_rounded_2028_total_is_2029_thousand',h1['A23']=='2028' and h1['E23']=='2029')
check('household_national_precise_B_control',h3['A58']=='New Zealand(8)' and h3['B58']=='Medium' and h3['E7']=='2028' and h3['E58']=='2028700')
check('household_national_aggregation_and_rounding_retained',h3['A68'].startswith('8. Sum of North Island and South Island') and 'rounding' in h3['A70'])
old=readcsv('infoshare-household-2013base.csv');check('infoshare_base_is_2013_not_2018','2013-Base' in old[0][0]);check('infoshare_medium_A_exact_selected',"'A' Living Arrangement Type Rates" in old[1][1] and old[2][1]=='Total');check('infoshare_target_year_different_value_and_thousands',old[3]==['2028','2021'] and ['Number, Magnitude = Thousands'] in old)
meta=json.loads((ROOT/'original/household-2018-collection-excerpt.json').read_text());text='\n'.join(meta['sections'])
check('household_A_constant_2018_versus_B_modelled',all(v in text for v in ['A\nwhich assumes LATRs will remain constant at 2018 levels','B\nmodelled LATRs based on 2001-2018 census results.','30 June 2018','five-year intervals']))
# Falsifiable controls: reject plausible wrong identities and never promote rounding/sums.
def identity_accepts(kind,year,scenario,base,unit,value):
 return kind=='direct_total' and (year,scenario,base,unit,value)==('2026','P50','2024','people',3144100)
controls={
 'rounded_thousands_do_not_establish_extra_hundred':not identity_accepts('direct_total','2026','P50','2024','thousand_people',3144),
 'component_sum_is_not_direct_total':not identity_accepts('component_sum','2026','P50','2024','people',sum(ages.values())),
 'different_year_refused':not identity_accepts('direct_total','2025','P50','2024','people',3144100),
 'different_percentile_refused':not identity_accepts('direct_total','2026','P25','2024','people',3144100),
 'different_base_refused':not identity_accepts('direct_total','2026','P50','2020','people',3144100),
 'household_mediumB_is_not_mediumA':('MEDIUMB',int(h3['E58']))!=('MEDIUMA',2087100),
 '2013base_is_not_2018base':('2013',int(old[3][1])*1000)!=('2018',2087100),
}
check('all_seven_boundary_controls_hold',all(controls.values()))
result={'schema_version':1,'scope':'Two exact Stats NZ projection cells, evidence-only follow-up','evidence_assertions_passed':len(checks),'evidence_assertions':checks,'boundary_controls':controls,'gap_completion':False,'targets':[{'id':'POPPR_LAB_003','dimensions':{'SCENARIO':'P50','SEX':'SEX3','AGE':'TOTALALLAGES'},'period':'2026','period_end':'2026-06-30','base':'2024','target_value':3144100,'unit':'people','kind':'projection','release_date':'2025-06-25','status':'blocked_exact_direct_total','observed_direct_total':{'value':3144,'unit':'thousand people','cell':'Table1!E13'},'qualified_corroboration':{'age_groups':ages,'sum':sum(ages.values()),'publisher_median_additivity':True,'rounding_warning':True,'closes_exact_direct_total':False},'required_to_close':'Permitted exact-precision official direct total for P50/SEX3/TOTALALLAGES at30June2026,2024-base; same-vintage separate presentation if available.'},{'id':'POPPR_FHH_003','dimensions':{'PROJECTION':'MEDIUMA','MEASURE':'HH'},'period':'2028','period_end':'2028-06-30','target_value':2087100,'unit':'households','kind':'projection','expected_base':'2018','release_date':'2021-12-15','status':'blocked_exact_selected_scenario','assumptions':{'population':'Medium fertility,medium mortality,medium migration','A':'Living-arrangement type rates constant at2018 levels','B':'Modelled living-arrangement type rates based on2001–2018 Census results'},'incompatible_comparisons':[{'base':'2018','scenario':'MediumB','value':2028700,'unit':'households','cell':'Table3!E58'},{'base':'2013','scenario':'MediumA','value':2021,'unit':'thousand households','table':'DNH009AA'}],'required_to_close':'Permitted exact MediumA/HH 2028 export, explicitbase/vintage and same-vintage official independent presentation where available; never substitute MediumB or2013-base.'}],'independence':'Python stdlib XML/CSV extraction is separate from production StatsNZ SDMX reader. Graph/workbook/metadata share StatsNZ statistical lineage; no separate statistical sample or exact-total validation claimed.','acquisition_log':'acquisitions.json','failed_route':'original/legacy-table-attempt.json','limitations':['ADE request returned only a public application shell with no selected observations. Authenticated data API was not retried.','Legacy NZ.Stat TABLECODE8602 failed at environment proxy tunnel, before a publisher response; no publisher HTTP403 claim.','Public Infoshare exposed2013-base household data only in inspected group; absence is not a claim about every possible publisher route.','All tests validate retained evidence and refusal boundaries, not runtime code or broader coverage.']}
output=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'independent-report.json';output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':'evidence_verified_gaps_remain_blocked','assertions':len(checks),'boundary_controls':len(controls),'exact_gaps_closed':0,'output':str(output)}))
