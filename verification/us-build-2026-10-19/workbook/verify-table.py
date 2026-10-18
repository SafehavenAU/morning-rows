"""Independent HTML token parser; no production regex/parser imported."""
from html.parser import HTMLParser
from pathlib import Path
from decimal import Decimal
from datetime import datetime, timezone
import json
class Table(HTMLParser):
    def __init__(self):
        super().__init__();self.active=False;self.cell=None;self.row=[];self.rows=[]
    def handle_starttag(self,tag,attrs):
        if tag=='table':self.active=dict(attrs).get('id')=='table0'
        if self.active and tag=='tr':self.row=[]
        if self.active and tag in ['th','td']:self.cell=''
    def handle_data(self,text):
        if self.cell is not None:self.cell+=text
    def handle_endtag(self,tag):
        if self.active and tag in ['th','td']:
            self.row.append(self.cell.strip());self.cell=None
        if self.active and tag=='tr':self.rows.append(self.row)
        if tag=='table':self.active=False
root=Path(__file__).parent;p=Table();p.feed((root/'database-table-excerpt.html').read_text())
assert p.rows[0]==['Year','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','HALF1','HALF2']
years={r[0]:r[1:13] for r in p.rows if len(r)==15 and r[0].isdigit()}
workbook=json.loads((root/'independent-comparison.json').read_text());checks=[]
for item in workbook['checks']:
    period=item['period'];v=years[period[:4]][int(period[5:])-1]
    assert v==('-(X)' if item['value_text'] is None else item['value_text'])
    checks.append({'period':period,'table_value':v,'matches_independent_workbook_and_bulk':True})
assert 'X : Data unavailable due to the 2025 lapse in appropriations' in p.rows[-1][0]
assert ((Decimal(years['2026'][8])/Decimal(years['2025'][8])-1)*100).quantize(Decimal('.1'))==Decimal('3.7')
(root/'table-independent-comparison.json').write_text(json.dumps({'verified_at':datetime.now(timezone.utc).isoformat(),'method':'Python HTMLParser, separate from JS regex reader and Python XLSX method','checks':checks,'headline_annual_percent':'3.7','pass':True,'independence_limit':'Original BLS database table, workbook, bulk and release share statistical lineage.'},indent=2)+'\n')
print(json.dumps({'slots':len(checks),'pass':True}))
