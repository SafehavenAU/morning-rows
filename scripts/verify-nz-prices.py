"""Independent replay of the 2026-10-17 EMI price evidence, Python stdlib only.
Default: compare retained publisher specimens. Optional --source is the original
bulk CSV; --report-dir contains fresh report-CODE.html files from official URLs.
This script does not import or execute the JavaScript reader.
"""
import argparse, csv, datetime, decimal, hashlib, json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / 'verification/nz-prices-2026-10-17'
CODES = ['OTA2201', 'HAY2201', 'ISL2201', 'BEN2201', 'INV2201']

class ReportTable(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows = []; self.row = None; self.cell = None
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row = []
        if tag in ('td', 'th'): self.cell = ''
    def handle_data(self, data):
        if self.cell is not None: self.cell += data
    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            if self.row is not None: self.row.append(self.cell.strip())
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row); self.row = None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=EVIDENCE / 'source-selected.csv')
    parser.add_argument('--report-dir', type=Path)
    args = parser.parse_args()
    with args.source.open() as f: source = list(csv.DictReader(f))
    source = [r for r in source if r['PointOfConnection'] in CODES]
    assert len(source) == 240, 'Expected 48 periods for each of five nodes'
    if args.report_dir:
        reports = []
        for code in CODES:
            html = (args.report_dir / f'report-{code}.html').read_text()
            table = ReportTable(); table.feed(html)
            reports += [r for r in table.rows if len(r) == 5 and r[0] == code]
    else:
        with (EVIDENCE / 'report-selected.csv').open() as f:
            reports = list(csv.reader(f))[1:]
    assert len(reports) == 240, 'Expected complete separately presented report tables'
    final = []
    for code in CODES:
        raw = [r for r in source if r['PointOfConnection'] == code]
        report = [r for r in reports if r[0] == code]
        assert len(raw) == len(report) == 48
        assert {int(r['TradingPeriod']) for r in raw} == set(range(1, 49))
        assert {int(r[2]) for r in report} == set(range(1, 49))
        for r in raw:
            match = [v for v in report if int(v[2]) == int(r['TradingPeriod'])]
            assert len(match) == 1
            v = match[0]
            assert r['TradingDate'] == '2026-10-16'
            assert datetime.datetime.strptime(v[1], '%d/%m/%Y').date().isoformat() == r['TradingDate']
            assert decimal.Decimal(r['DollarsPerMegawattHour']) == decimal.Decimal(v[3])
            assert v[4] == 'Interim'
        last = next(r for r in report if r[2] == '48')
        final.append({'code': code, 'price': last[3], 'status': last[4]})
    manifest = json.loads((EVIDENCE / 'specimen.json').read_text())
    for name, expected in manifest['retained_sha256'].items():
        assert hashlib.sha256((EVIDENCE / name).read_bytes()).hexdigest() == expected
    print(json.dumps({'matching_node_periods': 240, 'final_period': final,
                      'limitation': 'Independent extraction; shared publisher pricing lineage.'}, indent=2))

if __name__ == '__main__':
    main()
