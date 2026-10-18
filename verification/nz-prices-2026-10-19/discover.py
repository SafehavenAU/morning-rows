"""Independent original-directory selection; input is the original HTML file.

Usage: python discover.py directory.html 2026-10-18T16:45:48.355880+00:00
Does not fetch, execute JavaScript or import the Morning Rows reader.
"""
import datetime as dt
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from zoneinfo import ZoneInfo


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.files = set()

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            for key, value in attrs:
                if key == 'href' and re.fullmatch(r'/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/\d{8}_FinalEnergyPrices(?:_I)?\.csv', value or ''):
                    self.files.add(value)


def discover(raw, acquired_at):
    parser = Links()
    parser.feed(raw.decode('utf-8'))
    instant = dt.datetime.fromisoformat(acquired_at.replace('Z', '+00:00'))
    if instant.tzinfo is None:
        raise ValueError('Acquisition time must include timezone')
    today = instant.astimezone(ZoneInfo('Pacific/Auckland')).date()
    eligible = []
    for path in parser.files:
        date = dt.datetime.strptime(path.rsplit('/', 1)[1][:8], '%Y%m%d').date()
        if date > today:
            raise ValueError('Future listed release requires investigation')
        if dt.date(2022, 11, 1) <= date < today:
            eligible.append({'date': date.isoformat(), 'price_status': 'interim' if path.endswith('_I.csv') else 'final', 'source_url': 'https://www.emi.ea.govt.nz' + path})
    eligible.sort(key=lambda row: (row['date'], row['price_status'] == 'final'), reverse=True)
    if not eligible:
        raise ValueError('No eligible release')
    return {'retrieved_at': acquired_at, 'listing_sha256': hashlib.sha256(raw).hexdigest(),
            'local_date': today.isoformat(), 'latest_completed_date': (today - dt.timedelta(days=1)).isoformat(),
            'listed_file_count': len(parser.files), 'eligible_file_count': len(eligible),
            'most_recent_eligible': eligible[:6], 'selected': eligible[0],
            'method': 'Python HTMLParser href extraction and zoneinfo; does not import production JS'}


if __name__ == '__main__':
    print(json.dumps(discover(Path(sys.argv[1]).read_bytes(), sys.argv[2]), indent=2))
