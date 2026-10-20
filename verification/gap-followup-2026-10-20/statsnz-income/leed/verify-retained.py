#!/usr/bin/env python3
"""Offline original-metadata checks and independent Infoshare CSV extraction.

No runtime reader/parser import or network request. Exact numerical comparison
is separate from missing observation-status evidence and future-vintage approval.
"""
from pathlib import Path
from html.parser import HTMLParser
import csv,io,json,re,hashlib,copy
ROOT=Path(__file__).resolve().parent
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,x):self.parts.append(x)
def plain(html):
 p=Text();p.feed(html);return re.sub(r'\s+',' ',' '.join(p.parts)).strip()
def load(name):return json.loads((ROOT/'original'/f'{name}.json').read_text())
def section(doc,heading):return plain(next(s['html']for s in doc['sections']if s['heading']==heading))
annual=load('annual-methods-canonical');quarter=load('quarter-methods');ar=load('annual-release');qr=load('quarter-release');index=load('csv-index');landing=load('infoshare-landing')
checks=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
check('annual notes exact title and dated2025 update',annual['page']['Title']=='LEED annual technical notes – 2025 update' and annual['page']['PageDate']=='2025-12-01 10:45:00')
check('annual notes original HTTP200',annual['acquisition']['status']==200)
check('quarter notes original HTTP200',quarter['acquisition']['status']==200)
p=section(annual,'Population')
for label,term in [('annual person-level tax identity','unique IRD number'),('annual age at tax-year start','aged 15 years and over at the start of the tax year'),('annual non-zero coverage','received non-zero income'),('annual valid tax identity','valid IRD identifier')]:check(label,term in p)
check('annual before-tax metadata','before tax' in section(annual,'Published data tables'))
check('annual March-year convention','April 1 to March 31' in section(annual,'Published data tables'))
part=section(annual,'Part 1 – Annual sources of income')
check('annual total earnings combines wages and self-employment','sum of earnings from wages and salaries and self-employment' in part)
check('annual1.1 count differs from1.2 median','Table 1.1 Source of taxable income Count of people' in part and 'Table 1.2 Median annual earnings' in part)
check('negative self-employment retained','Negative income from self-employment is included' in section(annual,'Self-employment data sources'))
check('annual rounding and small-cell suppression','less than 25 are suppressed' in section(annual,'Rounding and cell suppression'))
check('annual latest-year provisional policy','provisional (for one year) until the next release' in section(annual,'Time series'))
p=section(quarter,'Population')
check('quarter valid PAYE paid-job population','15 years of age and over' in p and 'PAYE tax deducted at source' in p and 'valid IRD identifier' in p and 'social assistance payment' in p)
d=section(quarter,'Definitions of measures')
check('quarter continuous full-quarter jobs','jobs that exist continuously over the reference quarter' in d)
check('quarter earnings gross including lumpsums','inclusive of tax' in d and 'lump sums' in d)
check('quarter confidentiality rounding','base 10 or base 100' in d)
check('quarter median distinct from continuing/new-hire measures','Mean/median earnings Mean (average) or median earnings of all full-quarter jobs' in d and 'Mean/median earnings for continuing jobs' in d and 'Mean/median earnings for new hires' in d)
check('quarter revision window','additional two quarters' in section(quarter,'Timeframe for production') and '18 months' in section(quarter,'Timeframe for production'))
check('annual selected release exact title/date',ar['page']['Title']=='Linked employer-employee data: March 2024 year' and ar['page']['PageDate']=='2025-12-01 10:45:00')
check('quarter selected release exact title/date',qr['page']['Title']=='Linked employer-employee data: June 2025 quarter' and qr['page']['PageDate']=='2026-08-25 10:45:00')
texts=[plain(b.get('Content',''))for pub in [ar,qr]for b in pub['page']['PageBlocks']]
check('no target number in acquired selected release bodies',not any(re.search(r'4,?091,?334|57,?610|18,?100',t)for t in texts))
check('no LEED download in published CSV index',index['leed_downloads_found']==[] and len(index['published_downloads'])>20)
check('initial Infoshare request refusal preserved',landing['acquisition']['status']==403)
targets=json.loads((ROOT/'pinned-reader-targets.json').read_text())
metadata_checks=list(checks)
checks=[]
ui=json.loads((ROOT/'ui-acquisitions.json').read_text())
csv_path=ROOT/'original'/'quarter-full-jobs-2025Q2.csv'
csv_bytes=csv_path.read_bytes()
excerpt=load('quarter-export-excerpt')
check('ordinary public UI five bounded requests succeeded',len(ui['requests'])==5 and all(r['status']==200 for r in ui['requests']))
check('wire CSV acquisition digest and length preserved',excerpt['wire_sha256']==ui['requests'][-1]['sha256']=='77d1c5e9b3f37d44a86b76717b0d5c05c47afba79f9337e837f19700c784e3a4' and excerpt['wire_bytes']==ui['requests'][-1]['bytes']==619)
check('retained CSV excerpt digest length and original line boundary',hashlib.sha256(csv_bytes).hexdigest()==excerpt['retained_sha256']=='6f55fecfedd91ca5d371294c22a7018beffe01aff51b47c70a1ddac0c0cba2ad' and len(csv_bytes)==excerpt['retained_bytes']==521 and excerpt['retained_original_lines']=={'first':1,'last':28} and excerpt['wire_body_retained_in_repository'] is False)
check('CSV acquisition is original public form output',ui['requests'][-1]['method']=='POST' and ui['requests'][-1]['content_type']=='text/csv' and ui['requests'][-1]['url']=='https://infoshare.stats.govt.nz/SelectVariables.aspx')

def extract_quarter(data):
 # csv.reader handles the original CRLF without normalizing retained bytes.
 table=[r for r in csv.reader(io.StringIO(data.decode('utf-8-sig'),newline='')) if r]
 def require(condition,message):
  if not condition:raise ValueError(message)
 require(table[:4]==[
  ['Sex and Age (Qrtly-Mar/Jun/Sep/Dec)',''],
  ['', 'Total All Sexes'],
  [' ', 'Total All Ages'],
  [' ', 'Median Earnings - All']], 'wrong table or selected population/measure')
 values=[r for r in table if r and re.fullmatch(r'\d{4}Q[1-4]',r[0])]
 require(len(values)==1 and values[0][0]=='2025Q2' and len(values[0])==2,'wrong or duplicate reference quarter')
 require(re.fullmatch(r'-?\d+',values[0][1]) is not None,'missing/suppressed/non-numeric value')
 def next_value(label):
  positions=[i for i,r in enumerate(table) if len(r)==1 and r[0].strip()==label]
  require(len(positions)==1 and positions[0]+1<len(table),'missing or ambiguous '+label)
  row=table[positions[0]+1];require(len(row)==1,'invalid '+label);return row[0]
 require(next_value('Units:')=='$, Magnitude = Units','wrong units or magnitude')
 require(next_value('Table reference:')=='LED005AA','wrong table identifier')
 updated=next_value('Last updated:')
 require(updated=='Median Earnings - All: 25 August 2026 10:45am','different update vintage')
 require(['Status flags are not displayed']in table,'observation-status evidence boundary changed')
 require(['Source: Statistics New Zealand']in table,'publisher absent')
 return {'table_reference':'LED005AA','selected_labels':{
  'sex':'Total All Sexes','age':'Total All Ages','measure':'Median Earnings - All'},
  'period':'2025Q2','mapped_period':'202506','value':int(values[0][1]),
  'original_unit':'$, Magnitude = Units','unit':'NZD per quarter',
  'source_updated_raw':'25 August 2026 10:45am',
  'source_updated_timezone':'not stated; no UTC instant inferred',
  'original_excerpt':'original/quarter-full-jobs-2025Q2.csv; original lines1–28, contact footer omitted',
  'original_wire_sha256':excerpt['wire_sha256'],'retained_excerpt_sha256':excerpt['retained_sha256'],
  'observed_status':'unknown; export explicitly does not display status flags',
  'value_precision':'published integer dollars, confidentiality-rounded under LEED methodology'}

quarter_value=extract_quarter(csv_bytes)
target=next(r for r in targets['rows']if r['id']=='LEED_Q1W_001')
def matches_target(extracted,row):
 return (row['id']=='LEED_Q1W_001' and row['period']==extracted['mapped_period']
  and row['value']==extracted['value'] and row['unit']==extracted['unit']
  and row['geography']=='New Zealand'
  and row['dimensions']=={
   'AGE_LEED_Q1W_001':{'code':'A3Z','label':'Total age'},
   'MEASURE_LEED_Q1W_001':{'code':'MEDIAN_EARN','label':'Median earnings of full quarters jobs'}})
check('exact selected quarterly integer matches separately retained reader target',matches_target(quarter_value,target))
check('original update date matches selected official quarterly release',qr['page']['PageDate']=='2026-08-25 10:45:00' and quarter_value['source_updated_raw']=='25 August 2026 10:45am')
check('native empty attributes are not interpreted as final status',target['attributes']=={} and quarter_value['observed_status'].startswith('unknown'))
quarter_checks=list(checks)
checks=[]
for label,old,new in [
 ('wrong value','18100','18101'),
 ('wrong quarter','2025Q2','2025Q1'),
 ('wrong sex','Total All Sexes','Female'),
 ('wrong age','Total All Ages','65+'),
 ('wrong measure','Median Earnings - All','Median Earnings - Continuing'),
 ('wrong magnitude','$, Magnitude = Units','$, Magnitude = Thousands'),
 ('wrong table','LED005AA','LED006AA'),
 ('different update vintage','25 August 2026 10:45am','25 August 2025 10:45am'),
 ('suppression must not become zero','18100','S'),
 ('missing must not become zero','18100','..'),
 ('blank must not become zero','18100',''),
 ('status boundary must remain explicit','Status flags are not displayed','Status flags unknown')]:
 mutated=csv_bytes.replace(old.encode(),new.encode())
 try:rejected=not matches_target(extract_quarter(mutated),target)
 except ValueError:rejected=True
 check('reject '+label,rejected)
for label,key,value in [('wrong reader period','period','202503'),('wrong reader unit','unit','NZD per year'),('wrong reader geography','geography','Auckland')]:
 mutated=copy.deepcopy(target);mutated[key]=value
 check('reject '+label,not matches_target(quarter_value,mutated))
controls=list(checks)
rows=[]
for r in targets['rows']:
 is_quarter=r['id']=='LEED_Q1W_001'
 rows.append({'id':r['id'],'period':r['period'],'target_value':r['value'],'unit':r['unit'],'dimensions':r['dimensions'],
  'independent_exact_value':quarter_value['value'] if is_quarter else None,
  'numeric_comparison':'exact_published_value_match_zero_tolerance' if is_quarter else 'not_performed_no_usable_separate_export',
  'numeric_comparison_complete':is_quarter,'full_status_and_future_acceptance':False,
  'metadata_source':'original/quarter-methods.json' if is_quarter else 'original/annual-methods-canonical.json',
  'reference':quarter_value if is_quarter else None,
  'remaining_evidence':('Exact observation status is not displayed in this export; no future-vintage or finality approval.' if is_quarter else 'Dated official selected annual table/CSV with exact period/value, unit, population, observation status and release/revision vintage; do not substitute a later vintage.')})
def group(items):return {'count':len(items),'pass':all(c['pass']for c in items),'checks':items}
report={'kind':'Research-only separate official CSV extraction, metadata and public export-route review',
 'metadata_checks':group(metadata_checks),'quarter_comparison_checks':group(quarter_checks),'negative_controls':group(controls),
 'exact_numeric_comparisons':1,'completed_exact_cells':1,'remaining_exact_cells':2,
 'all_three_complete':False,'full_status_and_future_acceptance':False,'rows':rows,
 'crosswalk':{
  'official_csv_table':'LED005AA','official_csv_population':'Total All Sexes / Total All Ages',
  'ade_series':'LEED_Q1W_001','ade_key':'.A3Z.MEDIAN_EARN',
  'official_measure':'Median Earnings - All','ade_measure':'Median earnings of full quarters jobs',
  'period_mapping':'2025Q2 is 1 April–30 June 2025; ADE quarter-end code 202506',
  'geography':'New Zealand national table; no selected regional restriction',
  'population':'PAYE jobs for people aged 15+ with valid IRD identifier, continuous throughout the quarter; not a count or median of people, and not continuing-jobs-only or new-hires-only',
  'tax_and_payments':'Quarterly gross earnings including lump sums; social assistance payments excluded',
  'rounding':'Earnings statistics are rounded to base 10 or base 100 for confidentiality; exact equality is to the published value'},
 'scope_note':'No runtime, credentials, production endpoints, approval or monitoring changes. Evidence files only. Empty reader attributes do not establish final revision status.',
 'independence':'Infoshare CSV and ADE reader use separate official presentations and independent Python extraction but share LEED administrative statistical lineage. No independent underlying statistical measurement is claimed.',
 'annual_discovery_boundary':'The 21 visible public LED tables in this bounded visit were quarterly; no usable annual selected table was exposed. This does not establish that no annual public export exists elsewhere.',
 'access_boundary':'Initial plain landing request 403 preserved. Later authorized normal public-form interaction succeeded; no cause for that difference is inferred. No denied ADE request was repeated.'}
(ROOT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'metadata_checks':len(metadata_checks),'quarter_checks':len(quarter_checks),'negative_controls':len(controls),'pass':all(g['pass']for g in [report['metadata_checks'],report['quarter_comparison_checks'],report['negative_controls']]),'exact_numeric_comparisons':1,'remaining_exact_cells':2,'all_three_complete':False}))
