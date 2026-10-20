#!/usr/bin/env python3
"""Offline stdlib extraction: no runtime reader, network, or original mutation."""
import csv
import hashlib
import io
import json
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERIES = {'FXUSDCAD': ('USD/CAD', 'US dollar'), 'FXGBPCAD': ('GBP/CAD', 'UK pound sterling')}
class Table(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows=[]; self.row=None; self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='tr': self.row=[]
        elif tag in ('th','td'): self.cell=[]
    def handle_data(self,text):
        if self.cell is not None:self.cell.append(text)
    def handle_endtag(self,tag):
        if tag in ('th','td') and self.cell is not None:
            self.row.append(''.join(self.cell).strip().replace('\u2011','-'));self.cell=None
        elif tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None

def verify():
    acquired=json.loads((ROOT/'acquisition.json').read_text())
    for f in acquired['files']+acquired['excerpts']:
        if 'file' not in f:continue
        b=(ROOT/f['file']).read_bytes()
        assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'],f['file']
    original=json.loads((ROOT/'original/window.json').read_text())
    latest=json.loads((ROOT/'original/latest.json').read_text())
    j={}
    for series,(label,name) in SERIES.items():
        detail=original['seriesDetail'][series]
        assert detail['label']==label
        assert detail['description']==f'Daily average exchange rate of the {name} in Canadian dollars.'
        assert detail['metadata']=={'unit':f'Canadian dollars per {name}','frequency':'Business daily'}
        assert detail['dimension']=={'key':'d','name':'Date'} and detail['dateFormat']=='daily'
    assert original['terms']['url']=='https://www.bankofcanada.ca/terms/'
    for row in original['observations']:
        assert set(row)=={'d',*SERIES}
        for series in SERIES:
            key=(row['d'],series);assert key not in j
            j[key]=Decimal(row[series]['v']);assert j[key]>0
    assert len(j)==38 and len(original['observations'])==19
    records=list(csv.reader(io.StringIO((ROOT/'original/window.csv').read_text(encoding='utf-8-sig'))))
    index=records.index(['SERIES']);header=records[index+1]
    assert header==['id','label','description','date_format']
    metadata={r[0]:dict(zip(header,r)) for r in records[index+2:] if len(r)==4}
    for series,(label,name) in SERIES.items():
        assert metadata[series]['label']==label and metadata[series]['description']==original['seriesDetail'][series]['description'] and metadata[series]['date_format']=='daily'
    index=records.index(['OBSERVATIONS']);header=records[index+1]
    assert set(header)=={'date',*SERIES} and len(header)==3
    c={}
    for raw in records[index+2:]:
        if not raw:continue
        assert len(raw)==3
        r=dict(zip(header,raw))
        for series in SERIES:
            key=(r['date'],series);assert key not in c;c[key]=Decimal(r[series])
    assert c==j,'JSON/CSV window disagreement'
    table=Table();table.feed((ROOT/'original/daily-table.html').read_text())
    assert len(table.rows)==3 and table.rows[0][0]=='Currency'
    dates=table.rows[0][1:];assert dates==['2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-19']
    t={};names={name:series for series,(_,name) in SERIES.items()}
    for row in table.rows[1:]:
        assert row[0] in names and len(row)==len(dates)+1
        for d,value in zip(dates,row[1:]):t[d,names[row[0]]]=Decimal(value)
    assert len(t)==10 and all(j[k]==v for k,v in t.items()),'Official table disagreement'
    assert latest['seriesDetail']==original['seriesDetail'] and len(latest['observations'])==1
    anchor=latest['observations'][0];assert anchor['d']==max(d for d,s in j)
    assert all(Decimal(anchor[s]['v'])==j[anchor['d'],s] for s in SERIES)
    return {'pass':True,'method':'Python stdlib json/csv/html.parser with Decimal; no runtime imports or network',
        'window':{'start':'2026-09-20','end':'2026-10-20','calendar_days':31},'date_count':19,
        'json_csv_exact_cells':len(j),'separately_presented_table_exact_cells':len(t),'latest_anchor_exact_cells':2,
        'latest_published_date':anchor['d'],'numeric_tolerance':'Exact decimal equality',
        'cells':[{'period':d,'series':s,'value_text':str(v),'table_compared':(d,s) in t} for (d,s),v in sorted(j.items())],
        'absence':'Unreported dates are not zero, are not carried forward, and are not classified as holidays.',
        'independence_limit':'All presentations share Bank of Canada financial-market lineage; JSON and CSV use Valet. Separate extraction/presentation, not independent price discovery. Table covers10 of38 cells;28 are cross-format only.'}
if __name__=='__main__':
    report=verify();(ROOT/'independent-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='cells'},indent=2))
