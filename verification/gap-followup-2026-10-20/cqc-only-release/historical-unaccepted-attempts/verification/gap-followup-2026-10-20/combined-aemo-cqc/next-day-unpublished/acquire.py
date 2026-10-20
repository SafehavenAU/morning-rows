#!/usr/bin/env python3
"""ONE guarded index attempt, its two ZIPs and two authorized monthly evidence reads."""
import csv
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
import io
from pathlib import Path
import re
import signal
import sys
from urllib.parse import urljoin, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request

HERE = Path(__file__).resolve().parent
ORIGINAL = HERE / 'original'
INDEX = 'https://nemweb.com.au/Reports/CURRENT/Public_Prices/'
TZ = timezone(timedelta(hours=10))
EARLIEST = datetime(2026, 10, 20, 18, 6, tzinfo=timezone.utc)
ROLLOVER = datetime(2026, 10, 21, 14, tzinfo=timezone.utc)
REQUIRED = ['2026-10-19', '2026-10-20']
MONTHLY = {
    'SA1': 'https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_SA1.csv',
    'VIC1': 'https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_VIC1.csv',
}
PATTERN = re.compile(r'PUBLIC_PRICES_(\d{8})0000_(\d{14})\.zip')

def need(ok, message):
    if not ok:
        raise ValueError(message)

def now():
    return datetime.now(timezone.utc)

def clock():
    value = now()
    need(EARLIEST <= value < ROLLOVER, 'Outside single authorized actual-clock acquisition window')
    return value.isoformat()

def write(path, value):
    with path.open('x') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            self.links.extend(v for k, v in attrs if k.lower() == 'href' and v)

def discover(data, retrieved_at):
    text = data.decode('utf-8', errors='strict')
    need(re.search(r'<title>\s*[^<]*/Reports/CURRENT/Public_Prices/\s*</title>', text, re.I),
         'Unexpected official directory title')
    parser = Links()
    parser.feed(text)
    found = {day: {} for day in REQUIRED}
    for href in parser.links:
        url = urljoin(INDEX, href)
        parts = urlsplit(url)
        if parts.scheme != 'https' or parts.netloc.lower() != 'nemweb.com.au' or parts.query or parts.fragment:
            continue
        name = parts.path.rsplit('/', 1)[-1]
        match = PATTERN.fullmatch(name)
        if not match or parts.path != '/Reports/CURRENT/Public_Prices/' + name:
            continue
        day = datetime.strptime(match[1], '%Y%m%d').strftime('%Y-%m-%d')
        if day not in found:
            continue
        generated = datetime.strptime(match[2], '%Y%m%d%H%M%S').replace(tzinfo=TZ)
        completion = datetime.strptime(day, '%Y-%m-%d').replace(tzinfo=TZ) + timedelta(days=1, hours=4)
        need(completion <= generated <= datetime.fromisoformat(retrieved_at),
             'Advertised generation contradicts trading completion or actual retrieval')
        found[day][url] = {'url': url, 'filename': name, 'trading_day': day,
                           'report_generated_at': generated.isoformat()}
    need(all(len(found[day]) == 1 for day in REQUIRED),
         'Both exact required trading dates must each have one advertised bundle; no fallback')
    return [next(iter(found[day].values())) for day in REQUIRED]

def main():
    need(len(sys.argv) == 1, 'No URL, clock or retry override is supported')
    started = clock()
    write(HERE / 'attempt-started.json', {'started_at': started, 'index': INDEX,
          'calendar_day': '2026-10-20', 'max_index_requests': 1, 'max_bundle_requests': 2,
          'max_monthly_presentation_requests': 2})
    report = {'calendar_day': '2026-10-20', 'started_at': started, 'pass': False,
              'requests': [], 'bundles': [], 'monthly': [],
              'independence': 'Independent Python extraction and separate monthly presentation; shared AEMO market lineage'}
    opener = build_opener(NoRedirect())
    def timed_out(_signum, _frame):
        raise TimeoutError('Original acquisition exceeded 20 seconds')
    signal.signal(signal.SIGALRM, timed_out)
    def get(url, limit, accept, filename):
        record = {'url': url, 'requested_at': clock(), 'file': 'original/' + filename}
        report['requests'].append(record)
        request = Request(url, headers={'Accept': accept, 'User-Agent': 'MorningRows independent evidence review'})
        try:
            signal.setitimer(signal.ITIMER_REAL, 20)
            try:
                with opener.open(request, timeout=20) as response:
                    record['status'] = response.status
                    need(response.status == 200 and response.url == url, 'Unexpected status or redirect')
                    declared = response.headers.get('Content-Length')
                    need(declared is None or declared.isdigit() and int(declared) <= limit, 'Declared body exceeds bound')
                    record['content_type'] = response.headers.get('Content-Type')
                    data = response.read(limit + 1)
                    need(0 < len(data) <= limit, 'Empty or oversized original body')
            finally:
                signal.setitimer(signal.ITIMER_REAL, 0)
            record.update(retrieved_at=clock(), bytes=len(data), sha256=sha256(data).hexdigest())
            with (ORIGINAL / filename).open('xb') as handle:
                handle.write(data)
            return data, record
        except Exception as error:
            record['error'] = str(error)
            record['finished_at'] = now().isoformat()
            raise
    try:
        data, index_record = get(INDEX, 131072, 'text/html', 'index-full.html')
        text = data.decode('utf-8', errors='strict')
        title = re.search(r'<title>.*?</title>', text, re.S | re.I)
        listing = re.search(r'<pre>.*?</pre>', text, re.S | re.I)
        need(title and listing, 'Complete original index listing required')
        excerpt = (title.group(0) + '\n' + listing.group(0) + '\n').encode()
        with (ORIGINAL / 'index-directory-excerpt.html').open('xb') as handle:
            handle.write(excerpt)
        report['index_excerpt'] = {'file': 'original/index-directory-excerpt.html', 'bytes': len(excerpt),
                                   'sha256': sha256(excerpt).hexdigest(), 'derivation': 'Unaltered original title and PRE blocks; telemetry omitted'}
        selected = discover(data, index_record['retrieved_at'])
        report['advertised_bundles'] = selected
        for item in selected:
            _, record = get(item['url'], 524288, 'application/zip', item['filename'])
            report['bundles'].append({**item, **record})
        for region, url in MONTHLY.items():
            item = {'region': region, 'pass': False}
            report['monthly'].append(item)
            try:
                raw, record = get(url, 1048576, 'text/csv', 'monthly-' + region + '-full.csv')
                item['wire'] = record
                lines = raw.splitlines(keepends=True)
                need(lines, 'Empty monthly presentation')
                header = next(csv.reader([lines[0].decode('utf-8')], strict=True))
                need(header == ['REGION', 'SETTLEMENTDATE', 'TOTALDEMAND', 'RRP', 'PERIODTYPE'],
                     'Exact monthly presentation header')
                retained = [lines[0]]
                times = set()
                start = datetime(2026, 10, 20, tzinfo=TZ)
                end = start + timedelta(days=1)
                for line in lines[1:]:
                    values = next(csv.reader([line.decode('utf-8')], strict=True))
                    need(len(values) == len(header), 'Complete monthly CSV row')
                    row = dict(zip(header, values))
                    need(row['REGION'] == region, 'Exact monthly geography')
                    ending = datetime.strptime(row['SETTLEMENTDATE'], '%Y/%m/%d %H:%M:%S').replace(tzinfo=TZ)
                    if not start < ending <= end:
                        continue
                    need(row['PERIODTYPE'] == 'TRADE' and ending not in times, 'Exact unique monthly TRADE interval')
                    times.add(ending)
                    retained.append(line)
                need(times == {start + timedelta(minutes=5 * n) for n in range(1, 289)},
                     'All 288 exact 20 October monthly presentation intervals required')
                minimal = b''.join(retained)
                filename = 'monthly-' + region + '-2026-10-20.csv'
                with (ORIGINAL / filename).open('xb') as handle:
                    handle.write(minimal)
                item.update(pass_=True)
                item['pass'] = item.pop('pass_')
                item['retained'] = {'file': 'original/' + filename, 'bytes': len(minimal),
                                    'sha256': sha256(minimal).hexdigest(), 'rows': 288,
                                    'transformation': 'Unmodified original header and 288 complete original lines; other days omitted'}
            except Exception as error:
                item['error'] = str(error)
        need(len(report['monthly']) == 2 and all(item['pass'] for item in report['monthly']),
             'Separate same-day official monthly presentation gate remains unresolved')
        report['pass'] = True
    except Exception as error:
        report['error'] = str(error)
    report['finished_at'] = now().isoformat()
    write(ORIGINAL / 'acquisition.json', report)
    print(json.dumps({'pass': report['pass'], 'error': report.get('error'),
                      'requests': len(report['requests']), 'bundles': [b['filename'] for b in report['bundles']]}))
    return 0 if report['pass'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
