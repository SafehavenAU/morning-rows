#!/usr/bin/env python3
"""Verify an actual native NZ capture against 11 frozen official Stats NZ cells.
Usage: python scripts/verify-gap-statsnz.py CAPTURE_JSON OUTPUT
Offline Python stdlib only. All 23 row identities/dimensions are pinned, but only
11 numeric cells have independent original official evidence. No new-vintage,
whole-source, scheduled-operation or production-release acceptance is implied.
"""
import argparse
import csv
from decimal import Decimal, InvalidOperation
import hashlib
import html
import io
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / 'verification/gap-pass-2026-10-20/statsnz'
TARGET_SHA256 = 'b7339b8f0946cf5b535cca61862db70aec42d50454893e72c19fb4ee4ca36665'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def block(name, index):
    page = json.loads((EVIDENCE / 'sources' / (name + '.json')).read_text())
    return next(x['original_fields'] for x in page['selected_blocks']
                if x['json_pointer'] == f'/PageBlocks/{index}')


def graph(name, index, row_label, period):
    rows = list(csv.reader(io.StringIO(
        block(name, index)['SeriesData'][0]['GraphCsvData'].lstrip('\ufeff'))))
    if rows[0].count(period) != 1:
        raise ValueError('Official graph period is not unique')
    selected = [r for r in rows[1:] if r[0] == row_label]
    if len(selected) != 1:
        raise ValueError('Official graph row is not unique')
    return Decimal(selected[0][rows[0].index(period)])


def table(content):
    return [[html.unescape(re.sub('<[^>]+>', '', c)).strip()
             for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)]
            for r in re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.S)]


def population_cells():
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(EVIDENCE / 'sources/pop-sub-workbook.xlsx') as z:
        strings = [''.join(x.itertext()) for x in
                   ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns)]
        sheets = ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', ns)
        sheet = next(s for s in sheets if s.attrib['name'] == 'Table 1')
        rid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = next(r.attrib['Target'] for r in
                      ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
                      if r.attrib['Id'] == rid)
        cells = {}
        for c in ET.fromstring(z.read('xl/' + target)).findall('.//m:sheetData/m:row/m:c', ns):
            v = c.find('m:v', ns)
            if v is not None:
                cells[c.attrib['r']] = strings[int(v.text)] if c.attrib.get('t') == 's' else v.text
    if not (cells['A25'] == 'New Zealand(3)' and cells['B6'] == '2023'
            and cells['D6'] == '2025 P' and 'Estimated resident population' in cells['A2']
            and '2023 census usually resident' in cells['A26']):
        raise ValueError('Population workbook identity/period metadata differs')
    return cells


def independent_references():
    """Extract values from original official evidence, never reader target values."""
    refs = {}
    def add(id, period, value, locator):
        if not value.is_finite():
            raise ValueError('Nonfinite official reference')
        refs[id] = {'period': period, 'value': value, 'evidence': locator}
    add('BDS_BDS_004', '2025', graph('enterprise', 3, 'Enterprises', '2025'),
        'sources/enterprise.json /PageBlocks/3; February 2025')
    add('HES_HES_001', '2023', graph('hes', 5, 'Expenditure ($)', '2023'),
        'sources/hes.json /PageBlocks/5; year ended June 2023')
    add('INC_INC_010', '202606', graph('income-release', 8, 'Gender pay gap', 'Jun-26'),
        'sources/income-release.json /PageBlocks/8')
    row = next(r for r in table(block('iwi', 24)['Content']) if r and r[0] == '03 Ngāi Tahu Whānui')
    add('IWI18_GRP_001', '2018', Decimal(row[2].replace(',', '')),
        'sources/iwi.json /PageBlocks/24; 2018 estimated count')
    add('POPPR_NAT_007', '2026', graph('pop-projection', 28, '50th percentile', '2026'),
        'sources/pop-projection.json /PageBlocks/28; 2024-base median projection')
    add('PRD_PRD_001', '2025', graph('productivity', 3, 'Measured sector', '2025'),
        'sources/productivity.json /PageBlocks/3; 1996=1000, year ended March')
    prows = table(block('productivity', 2)['Content'])
    for id, label in [('PRD_PRD_002', 'Labour productivity'), ('PRD_PRD_003', 'Value added')]:
        row = next(r for r in prows if r and r[0] == label)
        add(id, '2025', Decimal(row[5]),
            'sources/productivity.json /PageBlocks/2; latest annual 2025 column')
    cells = population_cells()
    add('POPES_SUB_001', '2025', Decimal(cells['D25']), 'sources/pop-sub-workbook.xlsx Table 1 D25')
    add('POPES_ERP_005', '2023', Decimal(cells['B25']),
        'sources/pop-sub-workbook.xlsx Table 1 B25; national all-person total only')
    with (EVIDENCE / 'sources/injury-current-selected.csv').open() as f:
        found = [r for r in csv.DictReader(f) if r['Series_reference'] == 'W_I21'
                 and r['Period'] == '2021' and r['Type'] == 'Single year'
                 and r['Severity'] == 'Serious' and r['Cause'] == 'All'
                 and r['Population'] == 'Whole pop' and r['Age'] == 'All ages'
                 and r['Indicator'] == 'Number' and r['Units'] == 'Injuries']
    if len(found) != 1:
        raise ValueError('Injury official cell is not unique')
    add('INJ_INJ_001', '2021', Decimal(found[0]['Data_value']),
        'sources/injury-current-selected.csv W_I21/2021; updated 2000–2024 release')
    if len(refs) != 11:
        raise ValueError('Independent reference count differs')
    return refs


def verify(capture):
    errors = []
    manifest = json.loads((EVIDENCE / 'manifest.json').read_text())
    for artifact in manifest['artifacts']:
        if sha256(EVIDENCE / artifact['file']) != artifact['sha256']:
            raise ValueError('Evidence digest mismatch: ' + artifact['file'])
    if sha256(EVIDENCE / 'reader-targets.json') != TARGET_SHA256:
        raise ValueError('Fixed metadata-target digest mismatch')
    target_rows = json.loads((EVIDENCE / 'reader-targets.json').read_text())['rows']
    targets = {r['id']: r for r in target_rows}
    if len(target_rows) != 23 or len(targets) != 23:
        raise ValueError('Fixed target identity set differs')
    refs = independent_references()
    metadata = json.loads((EVIDENCE / 'capture-metadata-contract.json').read_text())
    if not isinstance(capture, dict) or capture.get('country') != 'New Zealand':
        errors.append('capture.country must identify New Zealand')
    stats = capture.get('stats') if isinstance(capture, dict) else None
    rows = stats.get('rows') if isinstance(stats, dict) else None
    if not isinstance(rows, list):
        errors.append('Missing native stats.rows array')
        rows = []
    by_id = {}
    if len(rows) != 23:
        errors.append('Expected exactly 23 native Stats NZ rows')
    for i, row in enumerate(rows):
        if not isinstance(row, dict) or not isinstance(row.get('id'), str):
            errors.append(f'Invalid native row at index {i}')
            continue
        id = row['id']
        if id in by_id:
            errors.append('Duplicate row id: ' + id)
        else:
            by_id[id] = row
    if set(by_id) != set(targets):
        errors.append('Native Stats NZ row id set differs from the fixed 23 definitions')
    comparisons = []
    checks = 0
    for id, expected in targets.items():
        row = by_id.get(id)
        if row is None:
            continue
        # Identity only: no value/period from the reader target is an oracle.
        fields = ['dimensions', 'geography', 'unit', 'kind', 'selection']
        if 'population_group' in expected:
            fields.append('population_group')
        for field in fields:
            checks += 1
            if field not in row or row[field] != expected[field]:
                errors.append(f'{id}.{field} differs from pinned selection metadata')
        for field, value in metadata.get(id, {}).get('fields', {}).items():
            checks += 1
            if field not in row or row[field] != value:
                errors.append(f'{id}.{field} missing or differs from source-backed metadata contract')
        if id not in refs:
            continue
        ref = refs[id]
        if row.get('status') != 'ok':
            errors.append(id + ' is not available for exact numerical verification')
        if row.get('period') != ref['period']:
            errors.append(id + ' has a different period; new vintage not approved')
        value = row.get('value')
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            errors.append(id + ' is not a native finite numeric value')
            actual = None
        else:
            try:
                actual = Decimal(str(value))
            except InvalidOperation:
                actual = None
            if actual is None or not actual.is_finite() or actual != ref['value']:
                errors.append(id + ' differs from exact official reference; rounding/substitution not permitted')
        comparisons.append({'id': id, 'period': row.get('period'), 'actual_value': (str(value) if isinstance(value, float) and not Decimal(str(value)).is_finite() else value),
                            'official_period': ref['period'], 'official_value': str(ref['value']),
                            'evidence': ref['evidence']})
    return {'passed': not errors, 'errors': errors, 'expected_native_rows': 23,
            'actual_native_rows': len(rows), 'metadata_checks': checks,
            'independent_reference_count': 11, 'exact_numeric_comparisons': len(comparisons),
            'comparisons': comparisons, 'unverified_numeric_ids': sorted(set(targets) - set(refs)),
            'unverified_numeric_row_errors': sorted(id for id in set(targets) - set(refs)
                                                    if by_id.get(id, {}).get('status') != 'ok'),
            'all_23_numeric_acceptance': False, 'future_vintages_approved': False,
            'scheduled_or_release_acceptance': False,
            'vintage_limit': 'Native rows have no publisher release-vintage identifier. A pass is agreement with these dated reference cells, never approval of an unspecified or future publisher vintage.',
            'scope': 'Fixed dated cells only. Population 2023 comparison covers national all-person total, not ethnic disaggregation. All evidence shares Stats NZ statistical lineage.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture_json', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    try:
        raw = args.capture_json.read_bytes()
        report = verify(json.loads(raw))
        report['capture_sha256'] = hashlib.sha256(raw).hexdigest()
        report['capture_path'] = str(args.capture_json)
        report['evidence_manifest_sha256'] = sha256(EVIDENCE / 'manifest.json')
    except (ValueError, OSError, KeyError, TypeError, StopIteration, zipfile.BadZipFile) as error:
        report = {'passed': False, 'errors': [f'{type(error).__name__}: {error}'],
                  'all_23_numeric_acceptance': False, 'future_vintages_approved': False,
                  'scheduled_or_release_acceptance': False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({k: report[k] for k in ['passed', 'errors', 'all_23_numeric_acceptance', 'future_vintages_approved']}))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
