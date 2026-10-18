"""Offline independent verification. Python stdlib; no production JS imports.

Run: python verification/nz-prices-2026-10-19/verify.py
Run adversarial checks: python verification/nz-prices-2026-10-19/verify.py --test
Evidence gaps remain explicit even when the available comparisons pass.
"""
import copy
import csv
import datetime as dt
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import unittest
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
CODES = ('OTA2201', 'HAY2201', 'ISL2201', 'BEN2201', 'INV2201')
COLUMNS = ('TradingDate', 'TradingPeriod', 'PointOfConnection', 'DollarsPerMegawattHour')
BASE = 'https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def day_contract(day):
    date = dt.date.fromisoformat(day)
    zone = ZoneInfo('Pacific/Auckland')
    start = dt.datetime.combine(date, dt.time(), zone).astimezone(dt.timezone.utc)
    end = dt.datetime.combine(date + dt.timedelta(days=1), dt.time(), zone).astimezone(dt.timezone.utc)
    periods = int((end - start).total_seconds() / 1800)
    require(periods in (46, 48, 50), 'Invalid trading-day coverage')
    return periods, end - dt.timedelta(minutes=30), end


def original_cells(text, release):
    day = release['date']
    periods, _, _ = day_contract(day)
    require(release['price_status'] in ('interim', 'final'), 'Unknown release status')
    suffix = '_I' if release['price_status'] == 'interim' else ''
    require(release['source_url'] == BASE + day.replace('-', '') + '_FinalEnergyPrices' + suffix + '.csv', 'Release identity mismatch')
    reader = csv.DictReader(io.StringIO(text))
    require(len(reader.fieldnames or []) == 4 and set(reader.fieldnames) == set(COLUMNS), 'Columns/units mismatch')
    values = {}
    for row in reader:
        require(None not in row and None not in row.values(), 'Incomplete source row')
        require(row['TradingDate'] == day, 'Wrong source date')
        code = row['PointOfConnection']
        require(code in CODES, 'Wrong node in necessary-data specimen')
        require(re.fullmatch(r'[1-9][0-9]*', row['TradingPeriod']) is not None, 'Invalid period')
        period = int(row['TradingPeriod'])
        require(1 <= period <= periods, 'Period outside selected trading day')
        key = (code, period)
        require(key not in values, 'Duplicate node-period')
        raw = row['DollarsPerMegawattHour']
        require(re.fullmatch(r'-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?', raw) is not None, 'Missing/suppressed/invalid price')
        try:
            value = Decimal(raw)
        except InvalidOperation as exc:
            raise ValueError('Invalid price') from exc
        require(value.is_finite(), 'Non-finite price')
        values[key] = value
    expected = {(code, period) for code in CODES for period in range(1, periods + 1)}
    require(values.keys() == expected, 'Incomplete node-period coverage')
    return values


def compare_reader(rows, cells, release, acquired_at):
    periods, start, end = day_contract(release['date'])
    require(len(rows) == 5 and {r['code'] for r in rows} == set(CODES), 'Reader node coverage mismatch')
    local = dt.datetime.fromisoformat(acquired_at.replace('Z', '+00:00')).astimezone(ZoneInfo('Pacific/Auckland')).date()
    latest = local - dt.timedelta(days=1)
    require(dt.date.fromisoformat(release['date']) <= latest, 'Incomplete or future trading day')
    for row in rows:
        for field in ('date', 'price_status', 'source_url'):
            require(row[field] == release[field], 'Reader release mismatch: ' + field)
        require(row['period'] == periods, 'Wrong terminal period')
        require(isinstance(row['price'], (int, float)) and not isinstance(row['price'], bool), 'Non-numeric reader price')
        require(Decimal(str(row['price'])) == cells[(row['code'], periods)], 'Reader numerical mismatch')
        require(row['unit'] == 'NZD per megawatt hour', 'Incompatible units')
        require('point of connection, New Zealand' in row['geography'], 'Wrong geography')
        require(row['timezone'] == 'Pacific/Auckland', 'Wrong timezone')
        require(dt.datetime.fromisoformat(row['period_start'].replace('Z', '+00:00')) == start, 'Wrong start time')
        require(dt.datetime.fromisoformat(row['period_end'].replace('Z', '+00:00')) == end, 'Wrong end time')
        require(row['latest_completed_date'] == latest.isoformat(), 'Hidden age of selected release')
        require(row['publication_lag_days'] == (latest - dt.date.fromisoformat(release['date'])).days, 'Wrong publication lag')
        require(row['licence'] == 'CC BY 4.0' and 'Electricity Authority' in row['attribution'], 'Missing licence/attribution')


def verify():
    manifest = json.loads((ROOT / 'specimen.json').read_text())
    for name, expected in manifest['retained_sha256'].items():
        require(hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, 'Damaged specimen: ' + name)
    preview = json.loads((ROOT / 'reader-preview.json').read_text())
    discovery = json.loads((ROOT / 'discovery.json').read_text())
    require(discovery['selected'] == {k: preview['release'][k] for k in ('date', 'price_status', 'source_url')}, 'Independent selection disagreement')
    require(discovery['listing_sha256'] == preview['directory_sha256'], 'Listing changed between extraction methods')
    cells = original_cells((ROOT / 'source-selected.csv').read_text(), preview['release'])
    compare_reader(preview['reader_result'], cells, preview['release'], preview['retrieved_at'])
    comparison = json.loads((ROOT / 'access-results.json').read_text())
    matched_domains = []
    for item in comparison['production']:
        if item.get('status') != 200 or 'prices' not in item:
            continue
        compare_reader(item['prices'], cells, preview['release'], item['retrieved_at'])
        matched_domains.append(item['url'])
    # No separately presented cells were obtained in this investigation.
    # HTTP success alone must never satisfy this independent numerical gate.
    require(not any(r.get('comparison_complete') for r in comparison['reports']), 'Unexpected comparison claim requires evidence review')
    return {'original_cells_validated': len(cells), 'independent_release_selection_match': True,
            'cloudflare_reader_values_matched': 5, 'production_domains_matched': matched_domains,
            'separate_official_table_reconciled': False, 'contract_accepted': False,
            'limitation': 'Independent Python extraction of the original CSV; no second official presentation. Original CSV and Cloudflare reader share input lineage.'}


class FailureChecks(unittest.TestCase):
    def setUp(self):
        self.preview = json.loads((ROOT / 'reader-preview.json').read_text())
        self.release = self.preview['release']
        self.text = (ROOT / 'source-selected.csv').read_text()
        self.cells = original_cells(self.text, self.release)

    def test_real_evidence(self):
        result = verify()
        self.assertEqual(result['original_cells_validated'], 240)
        self.assertFalse(result['contract_accepted'])

    def test_missing_duplicate_date_node_units_and_suppression(self):
        lines = self.text.splitlines()
        for broken in ( '\n'.join(lines[:8] + lines[9:]), self.text + '\n' + lines[8],
                        self.text.replace('2026-10-17', '2026-10-16', 1),
                        self.text.replace('OTA2201', 'WRONG', 1),
                        self.text.replace('DollarsPerMegawattHour', 'CentsPerKilowattHour')):
            with self.subTest(case=broken[:100]), self.assertRaises(ValueError):
                original_cells(broken, self.release)
        row = lines[1].rsplit(',', 1)
        for marker in ('', '[x]', '..', 'NaN', 'Infinity', 'null'):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                original_cells('\n'.join([lines[0], row[0] + ',' + marker, *lines[2:]]), self.release)

    def test_zero_negative_are_observations(self):
        lines = self.text.splitlines()
        key = (lines[1].split(',')[2], int(lines[1].split(',')[1]))
        for value in ('0', '-12.34'):
            changed = '\n'.join([lines[0], lines[1].rsplit(',', 1)[0] + ',' + value, *lines[2:]])
            self.assertEqual(original_cells(changed, self.release)[key], Decimal(value))

    def test_believable_wrong_answers_and_revisions(self):
        mutations = {'date': '2026-10-16', 'price_status': 'final', 'price': 87.64,
                     'period': 47, 'unit': 'NZ cents per kWh', 'geography': 'Australia',
                     'publication_lag_days': 0, 'latest_completed_date': '2026-10-17'}
        for field, value in mutations.items():
            rows = copy.deepcopy(self.preview['reader_result']); rows[0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                compare_reader(rows, self.cells, self.release, self.preview['retrieved_at'])
        # A changed value cannot pass against an old specimen. It requires a new
        # dated specimen and reconciliation, not a timestamp-only approval.
        rows = copy.deepcopy(self.preview['reader_result']); rows.pop()
        with self.assertRaises(ValueError):
            compare_reader(rows, self.cells, self.release, self.preview['retrieved_at'])

    def test_dst_with_independent_zone_database(self):
        self.assertEqual(day_contract('2026-09-27')[0], 46)
        self.assertEqual(day_contract('2026-04-05')[0], 50)


if __name__ == '__main__':
    if '--test' in sys.argv:
        unittest.main(argv=[sys.argv[0]])
    else:
        result = verify()
        print(json.dumps(result, indent=2))
        if '--require-acceptance' in sys.argv and not result['contract_accepted']:
            sys.exit(2)
