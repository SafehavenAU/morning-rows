#!/usr/bin/env python3
"""Offline inspection of the public quarterly ZIP as an alternative income source.
Usage: python inspect-labour-export.py ZIP OUTPUT_JSON
No HTTP. The observed ZIP is not retained because it is 18.6 MB and not an
income-supplement source. Download URL and original hash are in the output.
"""
import sys,zipfile,pathlib,hashlib,io,csv,json
EXPECTED='f7f867ab76b6bae2177ba1c3960f9a4ca7f7fb01a8325b5cdd7ee37b5cecab26'
MEMBER='labour-market-statistics-june-2026/lms-jun26qtr-tables.csv'
p,out=map(pathlib.Path,sys.argv[1:]);raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==EXPECTED
z=zipfile.ZipFile(io.BytesIO(raw));info=z.getinfo(MEMBER);assert info.file_size==286458785
subjects=set();groups=set();prefixes=set();rows=0;matches=[]
with z.open(MEMBER) as f:
 for row in csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig',newline='')):
  rows+=1;groups.add(row['Group']);subjects.add(row['Subject']);prefixes.add(row['Series_reference'].split('.')[0])
  terms=' '.join([row.get('Subject',''),row.get('Group',''),*(row.get('Series_title_'+str(i),'')for i in range(1,6))]).lower()
  if any(term in terms for term in ['median weekly','household income','paid employment']):
   if len(matches)<20:matches.append(row)
result={'zip_sha256':EXPECTED,'member':MEMBER,'member_bytes':info.file_size,'rows_examined':rows,'subjects':sorted(subjects),'series_prefixes':sorted(prefixes),'groups':sorted(groups),'income_target_term_matches':matches}
out.write_text(json.dumps(result,indent=2)+'\n')
print('Rows inspected:',rows,'; exact income evidence found:',len(matches))
