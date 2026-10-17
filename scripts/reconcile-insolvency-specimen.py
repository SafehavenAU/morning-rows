from pathlib import Path
import json,re,hashlib
from html.parser import HTMLParser
class Paragraphs(HTMLParser):
 def __init__(self):super().__init__();self.active=False;self.text='';self.rows=[]
 def handle_starttag(self,t,a):
  if t=='p':self.active=True;self.text=''
 def handle_data(self,d):
  if self.active:self.text+=d
 def handle_endtag(self,t):
  if t=='p':
   if self.active:self.rows.append(' '.join(self.text.split()))
   self.active=False
# Provide a freshly downloaded official publication HTML; assertions intentionally pin the reviewed August 2026 release.
import sys
html=Path(sys.argv[1]).read_text();p=Paragraphs();p.feed(html)
paragraphs=[r for r in p.rows if r.startswith('In August 2026') and ('in Scotland' in r or 'in Northern Ireland' in r)]
assert len(paragraphs)==2
sc=next(x for x in paragraphs if 'in Scotland' in x);ni=next(x for x in paragraphs if 'in Northern Ireland' in x)
assert '73 company insolvencies registered in Scotland' in sc and '30 CVLs, 35 compulsory liquidations and eight administrations' in sc and 'no CVAs or receivership appointments' in sc
assert 'seven company insolvencies registered in Northern Ireland' in ni and 'two compulsory liquidations and five CVLs' in ni and 'no CVAs, administrations or receivership appointments' in ni
expected={'total_sc_nsa':73,'compliq_sc_nsa':35,'cvl_sc_nsa':30,'admin_sc_nsa':8,'cva_sc_nsa':0,'rec_sc_nsa':0,'total_ni_nsa':7,'compliq_ni_nsa':2,'cvl_ni_nsa':5,'admin_ni_nsa':0,'cva_ni_nsa':0,'rec_ni_nsa':0}
f=Path('verification/operations-2026-10-18/reconciliation-second/insolvencies.json');d=json.loads(f.read_text());assert d['values']==expected
d.pop('publication_tables',None);d.pop('html_options',None);d['publication_paragraphs']=paragraphs;d['publication_values']=expected;d['comparison']='All 12 CSV cells match separately presented official national narrative, including explicitly absent procedures as zero. Exact integer totals; no rounding tolerance needed.';d['status']='reconciled';d['lineage']='Python CSV parsing versus explicit national narrative in official commentary sections 3 and 4. Both use the same Insolvency Service statistical release; administrative records were not independently audited.';f.write_text(json.dumps(d,indent=2)+'\n')
