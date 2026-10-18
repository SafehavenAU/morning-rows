"""Retain minimal public aggregate specimens; never touches runtime or credentials.

Initial capture: python capture.py --from-dir /tmp/mr-us-research
Fresh independent capture: python capture.py --live --output /tmp/mr-us-fresh
The fixed window/release deliberately make this reproducible, not a latest-data job.
"""
import argparse
import csv
import hashlib
import io
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERIES = 'CUUR0000SA0'
URLS = {
    'bls-flat': 'https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems',
    'bls-series': 'https://download.bls.gov/pub/time.series/cu/cu.series',
    'bls-footnote': 'https://download.bls.gov/pub/time.series/cu/cu.footnote',
    'bls-api-v1': 'https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0?startyear=2025&endyear=2026',
    'fred-csv': 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS&cosd=2025-01-01',
    'bls-archive': 'https://www.bls.gov/news.release/archives/cpi_10142026.htm',
}


def selected(row):
    return (row['year'] == '2025' and row['period'] in ('M09', 'M10', 'M11', 'M12', 'M13')) or (row['year'] == '2026' and re.fullmatch(r'M0[1-9]', row['period']))


def table_subset(text, predicate):
    lines = text.splitlines(keepends=True)
    names = [s.strip() for s in lines[0].split('\t')]
    return lines[0] + ''.join(line for line in lines[1:] if predicate(dict(zip(names, [s.strip() for s in line.split('\t')]))))


def release_subset(text):
    table = re.search(r'<table\b[^>]*id="cpipress1".*?</table>', text, re.S).group()
    head = re.search(r'<thead>.*?</thead>', table, re.S).group()
    caption = re.search(r'<caption>.*?</caption>', table, re.S).group()
    row = next(r for r in re.findall(r'<tr\b.*?</tr>', table, re.S) if 'id="cpipress1.r.1"' in r)
    return '<!-- Original BLS archived Table 1: caption, headers and all-items row only. -->\n<table id="cpipress1">' + caption + head + '<tbody>' + row + '</tbody></table>\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from-dir', type=Path)
    ap.add_argument('--live', action='store_true')
    ap.add_argument('--output', type=Path, default=ROOT)
    args = ap.parse_args()
    if args.live == bool(args.from_dir):
        ap.error('Choose --live OR --from-dir')
    if args.live and args.output.resolve() == ROOT:
        ap.error('Fresh live evidence must use a separate --output directory')
    out = args.output / 'specimens'
    out.mkdir(parents=True, exist_ok=True)
    manifest = {'captured_at': datetime.now(timezone.utc).isoformat(), 'window': ['2025-09', '2026-09'], 'specimens': [], 'notes': 'BLS public-domain aggregate data; FRED data attributed to BLS via FRED. Selected records only, no images or third-party code. M13 retained solely to test its exclusion.'}
    prior = json.loads((args.from_dir / 'probes.json').read_text()) if args.from_dir else []
    for key, url in URLS.items():
        if args.live:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'MorningRowsResearch/1.0'}), timeout=30) as response:
                raw = response.read()
            retrieved = datetime.now(timezone.utc).isoformat()
        else:
            raw = (args.from_dir / key).read_bytes()
            retrieved = next(r['checked_at'] for r in prior if r['name'] == key)
        text = raw.decode('utf-8-sig')
        if key == 'bls-flat':
            selected_text = table_subset(text, lambda r: r.get('series_id') == SERIES and selected(r))
        elif key == 'bls-series':
            selected_text = table_subset(text, lambda r: r.get('series_id') == SERIES)
        elif key == 'bls-footnote':
            selected_text = text
        elif key == 'bls-api-v1':
            obj = json.loads(text)
            for series in obj['Results']['series']:
                series['data'] = [r for r in series['data'] if selected(r)]
            selected_text = json.dumps(obj, indent=2) + '\n'
        elif key == 'fred-csv':
            lines = text.splitlines(keepends=True)
            selected_text = lines[0] + ''.join(line for line in lines[1:] if '2025-09-01' <= line.split(',')[0] <= '2026-09-01')
        else:
            selected_text = release_subset(text)
            # Necessary official publication/cadence text only; no full-page copy.
            stripped = re.sub('<[^>]+>', ' ', text)
            stripped = re.sub(r'\s+', ' ', stripped)
            release = re.search(r'Transmission of material.*?USDL-26-1574', stripped).group()
            schedule = re.search(r'The Consumer Price Index news release for October 2026.*?\(ET\)\.', stripped).group()
            (out / 'release-timing.txt').write_text(release + '\n' + schedule + '\n')
        path = out / key
        path.write_text(selected_text)
        manifest['specimens'].append({'file': str(path.relative_to(args.output)), 'url': url, 'retrieved_at': retrieved, 'original_bytes': len(raw), 'original_sha256': hashlib.sha256(raw).hexdigest(), 'retained_bytes': path.stat().st_size, 'retained_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'transformation': 'Exact selected text rows/header, or API envelope with data array filtered to selected periods; archived HTML retains original Table 1 headers and all-items row.'})
    timing = out / 'release-timing.txt'
    manifest['specimens'].append({'file': str(timing.relative_to(args.output)), 'url': URLS['bls-archive'], 'retained_sha256': hashlib.sha256(timing.read_bytes()).hexdigest(), 'transformation': 'Strip HTML, collapse whitespace, select release embargo and next-release sentences.'})
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'output': str(args.output), 'specimens': len(manifest['specimens'])}))


if __name__ == '__main__':
    main()
