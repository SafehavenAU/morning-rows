"""Isolated CPI retrieval/answer demonstration. Standard library only; no runtime imports.

python demo.py [--specimens /tmp/mr-us-fresh/specimens]
Prints a deterministic report; does not write or deploy anything.
"""
import argparse
import csv
import hashlib
import io
import json
import re
from decimal import Decimal, ROUND_HALF_UP
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERIES = 'CUUR0000SA0'
BASE = 'https://morningrows.com/united-states.json?source=cpi&measure=' + SERIES
SOURCE = 'https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems'
RELEASE = 'https://www.bls.gov/news.release/archives/cpi_10142026.htm'
DEFINITION = {
    'series_id': SERIES, 'name': 'CPI-U, all items, U.S. city average',
    'geography': 'U.S. city average', 'area_code': '0000',
    'population': 'All urban consumers; see BLS population exclusions',
    'unit': 'index', 'base_period': '1982-84=100',
    'adjustment': 'not seasonally adjusted', 'period_convention': 'calendar month',
    'uncertainty': None, 'uncertainty_note': 'No confidence interval supplied in this selected index extract; not zero uncertainty.',
    'boundary_note': 'National urban target in 50 states and DC, excludes territories; no subnational output. Sample design: 2018 redesign, 2010 Census/2013 OMB CBSAs.',
    'revision_policy': 'NSA: no routine seasonal revision; corrections possible; latest values, not vintage history.',
}


class ContractError(ValueError):
    pass


def version(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def tab_rows(text):
    reader = csv.DictReader(io.StringIO(text), delimiter='\t')
    return [{k.strip(): (v or '').strip() for k, v in row.items()} for row in reader]


def decode_value(raw, footnotes):
    if raw != '-' and any(f['code'] == 'X' for f in footnotes):
        raise ContractError('numeric_value_with_unavailable_flag')
    if raw == '-':
        return None, 'unavailable' if any(f['code'] == 'X' for f in footnotes) else 'missing'
    if not re.fullmatch(r'-?\d+(?:\.\d+)?', raw):
        raise ContractError('malformed_value')
    return Decimal(raw), 'observed'


def read_bulk(text, series_text, footnote_text, latest='2026-09'):
    metadata = tab_rows(series_text)
    if len(metadata) != 1:
        raise ContractError('series_metadata_coverage')
    required = {'series_id': SERIES, 'area_code': '0000', 'item_code': 'SA0', 'seasonal': 'U', 'periodicity_code': 'R', 'base_code': 'S', 'base_period': '1982-84=100'}
    if any(metadata[0].get(k) != v for k, v in required.items()):
        raise ContractError('incompatible_definition')
    if metadata[0]['end_year'] + '-' + metadata[0]['end_period'][1:] != latest:
        raise ContractError('metadata_release_mismatch')
    footnote_map = {r['footnote_code']: r['footnote_text'] for r in tab_rows(footnote_text)}
    y, m = map(int, latest.split('-'))
    final = y * 12 + m - 1
    periods = [f'{n // 12:04}-{n % 12 + 1:02}' for n in range(final - 12, final + 1)]
    rows, annual = {}, []
    for row in tab_rows(text):
        if row.get('series_id') != SERIES:
            continue
        if row['period'] == 'M13':
            annual.append(row['year'])
            continue
        if not re.fullmatch(r'M(0[1-9]|1[0-2])', row['period']):
            raise ContractError('invalid_period')
        period = row['year'] + '-' + row['period'][1:]
        if period not in periods:
            continue
        if period in rows:
            raise ContractError('duplicate_period')
        codes = [c.strip() for c in row['footnote_codes'].split(',') if c.strip()]
        if any(c not in footnote_map for c in codes):
            raise ContractError('unknown_footnote')
        notes = [{'code': c, 'text': footnote_map[c]} for c in codes]
        value, state = decode_value(row['value'], notes)
        rows[period] = {'period': period, 'value': None if value is None else float(value),
                        'value_text': row['value'], 'value_state': state, 'footnotes': notes}
    if set(rows) != set(periods):
        raise ContractError('incomplete_window')
    if any(r['value'] is not None and r['value'] <= 0 for r in rows.values()):
        raise ContractError('nonpositive_index_anomaly')
    return [rows[p] for p in periods], annual


def represent(rows, retrieved_at='2026-10-17T10:58:51.968349+00:00', health='ok'):
    context = {'definition': DEFINITION, 'source_url': SOURCE, 'licence': 'Public domain; cite US Bureau of Labor Statistics',
               'release_url': RELEASE, 'release_published_at': '2026-10-14T08:30:00-04:00',
               'next_expected_update': '2026-11-10T08:30:00-05:00',
               'schedule_qualification': 'Publisher schedule, subject to change; not a freshness guarantee',
               'coverage': '13 calendar slots; unavailable months retained; exact periods only; no archived vintages'}
    observations = []
    if health == 'ok':
        for row in rows:
            cell = {**row, 'id': BASE + '&observation=' + row['period'], 'published_at': '2026-10-14T08:30:00-04:00' if row['period'] == '2026-09' else None}
            observations.append({**cell, 'version': version({'cell': cell, 'definition': DEFINITION, 'source': SOURCE})})
    result = {'demo_only': True, 'schema_version': '2.0-proposal', 'id': BASE, 'context': context,
              'retrieval': {'status': health, 'retrieved_at': retrieved_at}, 'observations': observations}
    if health != 'ok':
        result['error'] = 'retrieval_failed'
    result['content_version'] = version({'context': context, 'health': health, 'observations': observations})
    return result


def select(rep, period, geography='U.S. city average', unit='index', adjustment='not seasonally adjusted'):
    if rep['retrieval']['status'] != 'ok':
        raise ContractError('retrieval_failed')
    definition = rep['context']['definition']
    if any(definition[k] != v for k, v in [('geography', geography), ('unit', unit), ('adjustment', adjustment)]):
        raise ContractError('unsupported_dimensions')
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', period):
        raise ContractError('unsupported_period_convention')
    candidates = [r for r in rep['observations'] if r['period'] == period]
    if len(candidates) != 1:
        raise ContractError('observation_not_retained')
    return candidates[0]


def ratio(rep, start, end):
    a, b = select(rep, start), select(rep, end)
    if start > end:
        raise ContractError('reversed_periods')
    if any(r['value_state'] != 'observed' or r['value'] is None for r in [a, b]):
        raise ContractError('non_numeric_period_no_substitution')
    numerator, denominator = Decimal(b['value_text']), Decimal(a['value_text'])
    if numerator <= 0 or denominator <= 0:
        raise ContractError('nonpositive_index_anomaly')
    factor = numerator / denominator
    return {'base_period': start, 'target_period': end, 'base_index': a['value_text'], 'target_index': b['value_text'],
            'factor': str(factor), 'percent_change': str((factor - 1) * 100),
            'percent_change_display_2dp': str(((factor - 1) * 100).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)),
            'citations': [{'id': r['id'], 'version': r['version']} for r in [a, b]],
            'publisher': SOURCE, 'release': RELEASE, 'definition': rep['context']['definition'],
            'qualification': 'Arithmetic from published NSA index levels; no contract clause, monetary rounding rule or CPI substitution inferred.'}


def changes(before, after):
    if after['retrieval']['status'] != 'ok':
        return {'retrieval': 'failed', 'new_periods': [], 'changed_periods': []}
    old = {r['period']: r['version'] for r in before['observations']}
    new = {r['period']: r['version'] for r in after['observations']}
    return {'retrieval': 'recovered' if before['retrieval']['status'] != 'ok' else 'ok',
            'new_periods': sorted(new.keys() - old.keys()),
            'changed_periods': sorted(p for p in new.keys() & old.keys() if new[p] != old[p])}


class ReleaseCells(HTMLParser):
    """Independent HTML extraction uses explicit BLS header IDs, not API positions."""
    def __init__(self):
        super().__init__()
        self.cells, self.current, self.text = {}, None, []

    def handle_starttag(self, tag, attrs):
        if tag in ('td', 'th'):
            a = dict(attrs)
            self.current = a.get('headers') if tag == 'td' else a.get('id')
            self.text = []

    def handle_data(self, data):
        if self.current:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.current:
            self.cells[self.current] = ' '.join(' '.join(self.text).split())
            self.current = None


def reconcile(rep, directory):
    observations = {r['period']: r for r in rep['observations']}
    api = json.loads((directory / 'bls-api-v1').read_text())
    assert api['status'] == 'REQUEST_SUCCEEDED' and not api['message']
    assert len(api['Results']['series']) == 1 and api['Results']['series'][0]['seriesID'] == SERIES
    api_months = [r for r in api['Results']['series'][0]['data'] if r['period'] != 'M13']
    api_rows = {r['year'] + '-' + r['period'][1:]: r for r in api_months}
    assert len(api_rows) == len(api_months)
    assert set(api_rows) == set(observations)
    for period, cell in observations.items():
        assert api_rows[period]['value'] == cell['value_text']
        assert [f for f in api_rows[period]['footnotes'] if f] == cell['footnotes']
    fred_months = list(csv.DictReader(io.StringIO((directory / 'fred-csv').read_text())))
    fred = {r['observation_date'][:7]: r['CPIAUCNS'] for r in fred_months}
    assert len(fred) == len(fred_months)
    assert set(fred) == set(observations)
    for period, cell in observations.items():
        assert (Decimal(fred[period]) if fred[period] else None) == (Decimal(cell['value_text']) if cell['value'] is not None else None)
    parser = ReleaseCells()
    parser.feed((directory / 'bls-archive').read_text())
    c = parser.cells
    assert c['cpipress1.r.1'] == 'All items'
    assert c['cpipress1.h.1.3'] == 'Unadjusted indexes'
    checks = []
    for period, header, label in [('2025-09', '3', 'Sep. 2025'), ('2026-08', '4', 'Aug. 2026'), ('2026-09', '5', 'Sep. 2026')]:
        assert c['cpipress1.h.2.' + header] == label
        cell = c['cpipress1.r.1 cpipress1.h.1.3 cpipress1.h.2.' + header]
        assert Decimal(cell) == Decimal(observations[period]['value_text'])
        checks.append({'period': period, 'value': cell, 'header_id': 'cpipress1.h.2.' + header, 'match': True})
    annual = Decimal(ratio(rep, '2025-09', '2026-09')['percent_change'])
    official = Decimal(c['cpipress1.r.1 cpipress1.h.1.6 cpipress1.h.2.6'])
    assert abs(annual - official) <= Decimal('.05')
    timing = (directory / 'release-timing.txt').read_text()
    assert 'October 14, 2026' in timing and 'November 10, 2026' in timing and '8:30' in timing
    return {'api_slots_equal': len(api_rows), 'fred_slots_equal': len(fred), 'official_table_cells': checks,
            'computed_year_percent': str(annual), 'official_rounded_percent': str(official), 'rounding_tolerance_percentage_points': '0.05',
            'release_timing_verified': True, 'lineage': 'Independent parsers/presentations, same underlying BLS estimates; FRED is a republication, not independent statistical corroboration.',
            'totals': 'Not applicable: an index is non-additive; no category/region sum or average-of-months substitution is valid.'}


def load(directory=ROOT / 'specimens'):
    rows, annual = read_bulk(*( (directory / n).read_text() for n in ['bls-flat', 'bls-series', 'bls-footnote']))
    manifest = json.loads((directory.parent / 'manifest.json').read_text())
    retrieved_at = next(r['retrieved_at'] for r in manifest['specimens'] if r['file'] == 'specimens/bls-flat')
    return represent(rows, retrieved_at=retrieved_at), annual


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--specimens', type=Path, default=ROOT / 'specimens')
    args = ap.parse_args()
    rep, annual = load(args.specimens)
    answer = ratio(rep, '2025-09', '2026-09')
    answer['constructed_money_example'] = {'base_usd': '1000.00', 'reference_usd': str((Decimal('1000') * Decimal(answer['factor'])).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)), 'assumption': 'No cap/floor; only final USD amount rounded half-up to cents. Not an observed agreement or legal recommendation.'}
    report = {'method': 'Deterministic retrieval demonstration, not an independent agent trial',
              'representation': rep, 'annual_average_rows_excluded': annual,
              'comparison': reconcile(rep, args.specimens), 'annual_answer': answer,
              'real_missing_observation': select(rep, '2025-10'),
              'additional_answer': ratio(rep, '2025-12', '2026-06'),
              'compact_bytes': {'representation': len(json.dumps(rep, separators=(',', ':')).encode()), 'annual_answer': len(json.dumps(answer, separators=(',', ':')).encode())}}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
