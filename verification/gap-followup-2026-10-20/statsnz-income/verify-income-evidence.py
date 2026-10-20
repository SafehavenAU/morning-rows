#!/usr/bin/env python3
"""Offline independent checks of retained metadata; never accepts an income value.
Usage: python verify-income-evidence.py [OUTPUT_JSON]
"""
import pathlib,json,hashlib,xml.etree.ElementTree as ET,sys
HERE=pathlib.Path(__file__).resolve().parent
N={'s':'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure','c':'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common'}
def read(path):return json.loads((HERE/path).read_text())
refs=read('original/prior-evidence-references.json')
for ref in refs:
 p=(HERE/'original'/ref['file']).resolve();assert hashlib.sha256(p.read_bytes()).hexdigest()==ref['sha256']
old=json.loads((HERE/'original'/refs[2]['file']).resolve().read_text());targets={r['id']:r for r in old['rows']}
structures={}
for id,expectedtitle in [('INC_INC_001','Earnings for people in paid employment by region, sex, age groups and ethnic groups'),('INC_INC_011','Household income by region, household type, and source of household income')]:
 d=read('original/'+id+'-structure.json');xml=ET.fromstring('<root xmlns:structure="'+N['s']+'" xmlns:common="'+N['c']+'">'+d['original_xml_fragments'][0]+'</root>');flow=xml[0]
 assert flow.attrib['id']==id;assert flow.findtext('c:Name',namespaces=N)==d['title']==expectedtitle
 assert d['dimensions']['PERIOD_'+id]['code']=='202606'
 for column,selected in targets[id]['dimensions'].items():assert d['dimensions'][column]['code']==selected['code']
 assert targets[id]['unit']=='NZD per week';assert targets[id]['period']=='202606'
 structures[id]=d
paid=read('original/paid-employment-browser.json');wages=read('original/wages-salaries-browser.json');methods=read('original/june-2026-methods-browser.json')
assert 'L30: Working for wages and salaries and/or self-employed.' in paid['selected_lines']
assert any('June 2026 quarter' in s for s in paid['selected_lines'])
assert 'L30: Is the remuneration paid to employees.' in wages['selected_lines']
assert 'L35: We collected data in this release in the June 2026 quarter (April to June).' in methods['selected_lines']
release=json.loads((HERE/'original'/refs[0]['file']).resolve().read_text())
block=next(x['original_fields']['Content']for x in release['selected_blocks']if x['json_pointer']=='/PageBlocks/3')
assert '$1,419 in the June 2026 quarter' in block
inspection=read('original/labour-market-export-inspection.json');assert inspection['rows_examined']==1511151;assert inspection['income_target_term_matches']==[];assert inspection['series_prefixes']==['HLFA','HLFQ','LCIQ','QEMQ']
ui=read('original/income-infoshare-hlfs-tables.json');assert len(ui['table_links'])==192
assert not any(any(w in t['label'].lower()for w in ['income','earn','wage','salary','median'])for t in ui['table_links'])
result={'status':'metadata_evidence_checked_numeric_gates_remain_open','scope':['INC_INC_001','INC_INC_011'],'exact_numeric_comparisons_passed':0,'runtime_or_checkpoint_changed':False,'rows':[
 {'id':'INC_INC_001','period':targets['INC_INC_001']['period'],'target':targets['INC_INC_001']['value'],'unit':'NZD per week','numeric_status':'blocked_exact_official_cell','metadata_status':'paid_employment_scope_clarified','separate_headline':{'value':1419,'measure':'Median weekly earnings from wages and salaries','comparable':False},'conclusion':'The original dataflow title plus current official concept establish paid employment includes wages/salaries and/or self-employment. This disqualifies a wages-only headline replacement. It does not independently verify the 1,391 cell or establish its vintage.','remaining_requirement':'Dated original official INC_INC_001 selected 202606 export or exact separate presentation for total ethnicity/region/sex/age, MED_WEEK_INC, with revision/vintage evidence.'},
 {'id':'INC_INC_011','period':targets['INC_INC_011']['period'],'target':targets['INC_INC_011']['value'],'unit':'NZD per week','numeric_status':'blocked_exact_official_cell','metadata_status':'prior_household_population_and_snapshot_qualification_retained','remaining_requirement':'Dated original official INC_INC_011 selected 202606 total-region/household-type MED_INC_ALL_SOUR cell, household aggregation/tax basis, and revision/vintage evidence. The individual wages headline, individual all-source income and HES/HILS annual household income are not valid substitutes.'}
 ],'lineage':'Original Stats NZ survey/dataflow lineage; metadata extraction differs from runtime. Browser-rendered concept excerpts are explicitly not raw HTTP bodies.','exclusions':['No main-job-only inference','No change to 1391 or 2438','No household gross/net basis inference','No annualisation by 52','No future vintage approval','No numeric use of third-party republication']}
text=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
if len(sys.argv)>1:pathlib.Path(sys.argv[1]).write_text(text)
else:print(text)
