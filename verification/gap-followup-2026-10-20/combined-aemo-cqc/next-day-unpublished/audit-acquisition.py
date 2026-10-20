#!/usr/bin/env python3
"""Offline full-wire to minimal-original derivation audit; no HTTP."""
import csv
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
DAY = datetime(2026, 10, 20, tzinfo=timezone(timedelta(hours=10)))

def need(ok, message):
    if not ok:
        raise ValueError(message)

def main():
    source = ROOT / 'original/acquisition.json'
    raw_acquisition = source.read_bytes()
    acquisition = json.loads(raw_acquisition)
    need(acquisition['pass'] and acquisition['calendar_day'] == '2026-10-20', 'Exact successful acquisition')
    requests = acquisition['requests']
    need(len(requests) == 5 and len(acquisition['bundles']) == len(acquisition['monthly']) == 2,
         'Exactly five original request records')
    need(requests[0]['url'] == 'https://nemweb.com.au/Reports/CURRENT/Public_Prices/' and
         requests[0]['file'] == 'original/index-full.html', 'Exact index request')
    for index, bundle in enumerate(acquisition['bundles'], 1):
        need(all(bundle.get(key) == value for key, value in requests[index].items()),
             'Bundle acquisition record equals retained request record')
        need(bundle['file'] == 'original/' + bundle['filename'] and
             bundle['url'] == requests[0]['url'] + bundle['filename'], 'Exact bundle request path')
    for index, item in enumerate(acquisition['monthly'], 3):
        region = ['SA1', 'VIC1'][index - 3]
        need(item['pass'] and item['region'] == region and item['wire'] == requests[index], 'Exact monthly request-record equality')
        need(requests[index]['file'] == 'original/monthly-' + region + '-full.csv' and
             requests[index]['url'] == 'https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_' + region + '.csv',
             'Exact known monthly original URL/file')
    full_inputs, minimal_inputs = [], []
    previous = None
    raw_sources = []
    for record in requests:
        file = record['file']
        need(re.fullmatch(r'original/[A-Za-z0-9_.-]+', file), 'Safe original full-wire path')
        raw = (ROOT / file).read_bytes()
        need(record['status'] == 200 and len(raw) == record['bytes'] and sha256(raw).hexdigest() == record['sha256'],
             'Exact saved full-wire hash and size')
        started, finished = map(datetime.fromisoformat, [record['requested_at'], record['retrieved_at']])
        need(datetime(2026, 10, 20, 18, 6, tzinfo=timezone.utc) <= started <= finished <
             datetime(2026, 10, 21, 14, tzinfo=timezone.utc) and (previous is None or previous <= started),
             'Actual sequential acquisition clocks')
        previous = finished
        full_inputs.append({key: record[key] for key in ['file', 'url', 'bytes', 'sha256', 'requested_at', 'retrieved_at']})
        raw_sources.append(raw)
    index = raw_sources[0].decode('utf-8', errors='strict')
    title, listing = re.search(r'<title>.*?</title>', index, re.S | re.I), re.search(r'<pre>.*?</pre>', index, re.S | re.I)
    need(title and listing, 'Complete original index blocks')
    expected_excerpt = (title.group(0) + '\n' + listing.group(0) + '\n').encode()
    excerpt = acquisition['index_excerpt']
    need(excerpt['file'] == 'original/index-directory-excerpt.html', 'Safe exact excerpt path')
    need((ROOT / excerpt['file']).read_bytes() == expected_excerpt and len(expected_excerpt) == excerpt['bytes']
         and sha256(expected_excerpt).hexdigest() == excerpt['sha256'], 'Exact telemetry-free index derivation')
    minimal_inputs.append({key: excerpt[key] for key in ['file', 'bytes', 'sha256']})
    for item, raw in zip(acquisition['monthly'], raw_sources[3:]):
        region, retained = item['region'], item['retained']
        need(retained['file'] == 'original/monthly-' + region + '-2026-10-20.csv', 'Safe exact minimal monthly path')
        lines = raw.splitlines(keepends=True)
        header = next(csv.reader([lines[0].decode('utf-8')], strict=True))
        need(header == ['REGION', 'SETTLEMENTDATE', 'TOTALDEMAND', 'RRP', 'PERIODTYPE'], 'Original monthly columns')
        selected, seen = [lines[0]], set()
        for line in lines[1:]:
            values = next(csv.reader([line.decode('utf-8')], strict=True))
            need(len(values) == len(header), 'Full original record')
            row = dict(zip(header, values))
            need(row['REGION'] == region, 'Original geography')
            at = datetime.strptime(row['SETTLEMENTDATE'], '%Y/%m/%d %H:%M:%S').replace(tzinfo=DAY.tzinfo)
            if DAY < at <= DAY + timedelta(days=1):
                need(row['PERIODTYPE'] == 'TRADE' and at not in seen, 'Original unique TRADE interval')
                seen.add(at)
                selected.append(line)
        need(seen == {DAY + timedelta(minutes=5*n) for n in range(1, 289)}, 'Exact full target coverage')
        expected = b''.join(selected)
        need((ROOT / retained['file']).read_bytes() == expected and len(expected) == retained['bytes']
             and sha256(expected).hexdigest() == retained['sha256'], 'Byte-identical unmodified full-wire to minimal derivation')
        minimal_inputs.append({key: retained[key] for key in ['file', 'bytes', 'sha256']})
    report = {'pass': True, 'kind': 'Offline full-wire and exact minimal-original derivation audit',
              'verified_at': datetime.now(timezone.utc).isoformat(), 'calendar_day': '2026-10-20',
              'acquisition_sha256': sha256(raw_acquisition).hexdigest(), 'request_records_consistent': True,
              'full_inputs': full_inputs, 'minimal_inputs': minimal_inputs,
              'limits': ['Full wire bodies remain outside the minimal repository package; this audit binds their exact hashes and derivation.',
                         'Portable numerical verification uses pinned minimal original rows, not omitted full wire bodies.']}
    with (ROOT / 'original/acquisition-audit.json').open('x') as handle:
        json.dump(report, handle, indent=2)
        handle.write('\n')
    print(json.dumps({'pass': True, 'requests': 5, 'minimal_derivations': 3}))

if __name__ == '__main__':
    main()
