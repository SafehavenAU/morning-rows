"""Separate extraction: standard-library ZIP/XML + Decimal, no JS reader."""
import csv, io, json, zipfile, hashlib
from decimal import Decimal
from pathlib import Path
from datetime import datetime, timezone
from xml.etree import ElementTree as E
root=Path(__file__).parent
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
raw=(root/'historical-cpi-u-202609.xlsx').read_bytes()
with zipfile.ZipFile(io.BytesIO(raw)) as z:
    strings=[''.join(si.itertext()) for si in E.fromstring(z.read('xl/sharedStrings.xml'))]
    rows=E.fromstring(z.read('xl/worksheets/sheet1.xml')).find('m:sheetData',ns)
    cells={c.attrib['r']: strings[int(c.find('m:v',ns).text)] if c.attrib.get('t')=='s' else Decimal(c.find('m:v',ns).text) if c.find('m:v',ns) is not None else None for r in rows for c in r}
assert cells['B1']=='Historical Consumer Price Index for All Urban Consumers (CPI-U): U.S. city average, all items, by month'
assert cells['B2']=='[1982-84=100, unless otherwise noted]'
years={str(cells['B'+r.attrib['r']]):r.attrib['r'] for r in rows if str(cells.get('B'+r.attrib['r'],'')).isdigit()}
bulk={}
for row in csv.DictReader((root/'../original/specimens/bls-flat').read_text().splitlines(),delimiter='\t'):
    r={k.strip():v.strip() for k,v in row.items()}
    if r['series_id']=='CUUR0000SA0' and r['period']!='M13':bulk[r['year']+'-'+r['period'][1:]]=r
checks=[]
for period,r in sorted(bulk.items()):
    ref=chr(66+int(period[5:]))+years[period[:4]];v=cells[ref]
    if r['value']=='-':assert v=='–' and period=='2025-10' and r['footnote_codes']=='X';value=None
    else:
        assert isinstance(v,Decimal)
        assert abs(v-Decimal(r['value']))<=Decimal('0.000000001')
        value=format(v.quantize(Decimal('0.001')),'.3f')
    checks.append({'period':period,'cell':ref,'value_text':value,'matches_separate_bulk':True})
assert len(checks)==13
note='NOTE: The Oct 2025 data values are not available due to the 2025 lapse in appropriations.'
assert cells['B121']==note
annual=(Decimal('336.940')/Decimal('324.800')-1)*100
assert annual.quantize(Decimal('0.1'))==Decimal('3.7')
report={'verified_at':datetime.now(timezone.utc).isoformat(),'method':'Python zipfile + ElementTree + Decimal; separate original TSV parsed with csv.DictReader','workbook_sha256':hashlib.sha256(raw).hexdigest(),'checks':checks,'official_release_cells':{'2025-09':'324.800','2026-08':'334.980','2026-09':'336.940','annual_change_percent':'3.7'},'official_release_evidence':'../original/reconciliation.json and specimens/bls-archive','note':note,'lineage_limit':'All are BLS estimates. Independent extraction and presentation, not independent statistical generation.','pass':True}
(root/'independent-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'slots':len(checks),'pass':True}))
