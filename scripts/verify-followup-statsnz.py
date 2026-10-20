#!/usr/bin/env python3
"""Check an actual 23-row NZ native capture against 15 dated official cells.

Usage: python scripts/verify-followup-statsnz.py CAPTURE_JSON OUTPUT
Offline stdlib only. Calls the unchanged historical 11-cell checker, then
independently extracts three agriculture and one LEED cell from official CSVs.
Exact numerical agreement does not establish undisplayed flags, future vintages,
all 23 numerical cells, scheduled operation or a production release.
"""
import argparse
import csv
from decimal import Decimal, InvalidOperation
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import sys
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
FOLLOWUP = ROOT / 'verification/gap-followup-2026-10-20'
LEGACY_PATH = ROOT / 'scripts/verify-gap-statsnz.py'
LEGACY_SHA256 = '9418d9adc548fe70be0baf806a5b15dd1d5766aa1a467c8a8a817bf30c03055d'
MANIFESTS = {
    'statsnz-agri-projections': '776aa350ab8d1773deee72a81e3b1071ed814307a9dfdde9e0c8911edb4ba074',
    'statsnz-income/leed': '9df6dd564235aa9e22283927c0f5d784b91e0bcf8b1c4c9df0963d954706726b',
    'statsnz-income': 'db996398790ea1428ef380cd3aa6f76e5006552f3c7856b563e72c3bde64dcb3',
}
NEW_IDS = frozenset(['AGR_AGR_001', 'AGR_AGR_002', 'AGR_AGR_003', 'LEED_Q1W_001'])
INC_FIELDS = frozenset(['name', 'population_group', 'period_convention', 'limitations'])
CUMULATIVE_METADATA_SHA256 = 'a047b6269bacac816c31f58a69eca467f6109fd5e43418015b1cf7f1bcee47b5'
LEED_IDS = frozenset(['LEED_AP1_001', 'LEED_AP1_002', 'LEED_Q1W_001'])


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    def nonfinite(value):
        raise ValueError('Nonfinite JSON number: ' + value)
    return json.loads(path.read_text(), parse_constant=nonfinite)


def legacy_verifier():
    require(sha256(LEGACY_PATH) == LEGACY_SHA256, 'Historical 11-cell checker digest differs')
    spec = importlib.util.spec_from_file_location('historical_statsnz_verifier', LEGACY_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify_manifests(evidence_root):
    """The caller cannot make a changed reference valid by rewriting its manifest."""
    counts = {}
    for package, expected_hash in MANIFESTS.items():
        directory = evidence_root / package
        manifest_path = directory / 'manifest.json'
        require(sha256(manifest_path) == expected_hash, 'Frozen manifest digest differs: ' + package)
        manifest = read_json(manifest_path)
        entries = manifest.get('files', manifest.get('artifacts'))
        require(isinstance(entries, list) and entries, 'Missing manifest entries: ' + package)
        seen = set()
        for entry in entries:
            relative = entry.get('path', entry.get('file'))
            require(isinstance(relative, str) and relative and relative not in seen,
                    'Missing or duplicate manifest path: ' + package)
            path = Path(relative)
            require(not path.is_absolute() and '..' not in path.parts, 'Unsafe manifest path')
            seen.add(relative)
            raw = (directory / path).read_bytes()
            require(len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256'],
                    'Evidence digest/length mismatch: ' + package + '/' + relative)
        counts[package] = len(entries)
    return counts


def csv_rows(path):
    # Preserve original bytes; newline='' accepts the original CSV CRLF.
    return [r for r in csv.reader(io.StringIO(path.read_bytes().decode('utf-8-sig'), newline='')) if r]


def singletons(rows):
    return [r[0] for r in rows if len(r) == 1]


def extract_agriculture(evidence_root):
    path = evidence_root / 'statsnz-agri-projections/original/agriculture-selected.csv'
    rows = csv_rows(path)
    variables = ['New Area Planted in Production Forest', 'Total Sheep', 'Apples']
    require(rows[:3] == [
        ['Variable by Total New Zealand (Annual-Jun)', '', '', ''],
        ['', 'Total New Zealand', '', ''],
        [' ', *variables]], 'Agriculture original table/geography/variables differ')
    matrix = rows[3:6]
    require([r[0] for r in matrix] == ['2018', '2024', '2025'] and all(len(r) == 4 for r in matrix),
            'Agriculture original selected year matrix differs')
    values = {}
    for row in matrix:
        for variable, value in zip(variables, row[1:]):
            require(value == '..' or re.fullmatch(r'[0-9]+', value), 'Invalid agriculture cell')
            values[(row[0], variable)] = None if value == '..' else Decimal(value)
    require({key for key, value in values.items() if value is None} == {
        ('2018', 'Apples'), ('2024', variables[0]), ('2025', variables[0]), ('2025', 'Apples')},
        'Agriculture missing-value pattern differs')
    metadata = singletons(rows[6:])
    for item in [
        'AGR001AA', 'Source: Statistics New Zealand', 'Status flags are not displayed',
        '.. figure not available', 'C: Confidential', 'E: Early Estimate',
        'P: Provisional', 'R: Revised', 'S: Suppressed',
        'New Area Planted in Production Forest: Hectares, Magnitude = Units',
        'Total Sheep: Number, Magnitude = Units', 'Apples: Hectares, Magnitude = Units',
        *[name + ': 16 April 2026 10:45am' for name in variables],
    ]:
        require(metadata.count(item) == 1, 'Agriculture original metadata differs: ' + item)
    specs = [
        ('AGR_AGR_001', '2018', variables[0], 'hectares', 'Year to 31 March 2018; new exotic planting, not replanting'),
        ('AGR_AGR_002', '2024', variables[2], 'hectares', 'At 30 June 2024'),
        ('AGR_AGR_003', '2025', variables[1], 'animals', 'At 30 June 2025'),
    ]
    return {id_: {
        'period': period, 'value': values[(period, variable)], 'unit': unit,
        'geography': 'New Zealand', 'official_selection': 'Total New Zealand / ' + variable,
        'period_convention': convention, 'table': 'AGR001AA',
        'evidence': str(path.relative_to(evidence_root)),
        'publisher_updated_raw': '16 April 2026 10:45am',
        'publisher_updated_timezone': 'not stated; no UTC instant inferred',
        'observation_status': 'not displayed; not independently verified',
    } for id_, period, variable, unit, convention in specs}


def extract_leed(evidence_root):
    path = evidence_root / 'statsnz-income/leed/original/quarter-full-jobs-2025Q2.csv'
    excerpt = read_json(path.parent / 'quarter-export-excerpt.json')
    require(excerpt['retained_sha256'] == sha256(path) and excerpt['retained_bytes'] == path.stat().st_size,
            'LEED retained excerpt identity differs')
    require(excerpt['retained_original_lines'] == {'first': 1, 'last': 28}
            and excerpt['wire_bytes'] == 619 and excerpt['retained_bytes'] == 521
            and excerpt['wire_sha256'] == '77d1c5e9b3f37d44a86b76717b0d5c05c47afba79f9337e837f19700c784e3a4'
            and excerpt['wire_body_retained_in_repository'] is False,
            'LEED wire/excerpt provenance boundary differs')
    rows = csv_rows(path)
    require(rows[:4] == [
        ['Sex and Age (Qrtly-Mar/Jun/Sep/Dec)', ''],
        ['', 'Total All Sexes'], [' ', 'Total All Ages'], [' ', 'Median Earnings - All']],
        'LEED original table/population/measure differs')
    cells = [r for r in rows if r and re.fullmatch(r'\d{4}Q[1-4]', r[0])]
    require(len(cells) == 1 and len(cells[0]) == 2 and cells[0][0] == '2025Q2',
            'LEED original period/cell coverage differs')
    require(re.fullmatch(r'[0-9]+', cells[0][1]), 'LEED original cell missing or nonnumeric')
    metadata = singletons(rows)
    for item in ['$, Magnitude = Units', 'LED005AA', 'Source: Statistics New Zealand',
                 'Status flags are not displayed',
                 'Median Earnings - All: 25 August 2026 10:45am',
                 '.. figure not available', 'C: Confidential', 'E: Early Estimate',
                 'P: Provisional', 'R: Revised', 'S: Suppressed']:
        require(metadata.count(item) == 1, 'LEED original metadata differs: ' + item)
    return {'LEED_Q1W_001': {
        'period': '202506', 'value': Decimal(cells[0][1]), 'unit': 'NZD per quarter',
        'geography': 'New Zealand', 'official_selection': 'Total All Sexes / Total All Ages / Median Earnings - All',
        'period_convention': '2025Q2; 1 April–30 June 2025; gross earnings including lump sums of full-quarter jobs',
        'table': 'LED005AA', 'evidence': str(path.relative_to(evidence_root)),
        'original_specimen': 'Byte-identical original lines1–28; contact footer omitted',
        'wire_sha256': excerpt['wire_sha256'], 'retained_excerpt_sha256': excerpt['retained_sha256'],
        'publisher_updated_raw': '25 August 2026 10:45am',
        'publisher_updated_timezone': 'not stated; no UTC instant inferred',
        'observation_status': 'not displayed; not independently verified',
    }}


def independent_references(evidence_root=FOLLOWUP):
    evidence_root = Path(evidence_root)
    verify_manifests(evidence_root)
    refs = {**extract_agriculture(evidence_root), **extract_leed(evidence_root)}
    require(set(refs) == NEW_IDS, 'New exact reference set differs')
    require(all(isinstance(r['value'], Decimal) and r['value'].is_finite() for r in refs.values()),
            'Invalid exact original reference')
    return refs


def metadata_contract(evidence_root=FOLLOWUP):
    path = Path(evidence_root) / 'statsnz-cumulative/metadata-contract.json'
    require(sha256(path) == CUMULATIVE_METADATA_SHA256, 'Cumulative metadata contract digest differs')
    combined = read_json(path)['series']
    require(set(combined) == LEED_IDS | {'INC_INC_001'}, 'Cumulative metadata contract identity set differs')
    income = read_json(Path(evidence_root) / 'statsnz-income/metadata-contract.json')
    require(combined['INC_INC_001']['fields'] == income['INC_INC_001']['fields'],
            'Cumulative income metadata differs from original reviewed contract')
    for id_, row in combined.items():
        require(row['numeric_acceptance'] is False, 'Metadata cannot grant numerical acceptance')
        require(set(row['fields']) == (INC_FIELDS if id_ == 'INC_INC_001' else INC_FIELDS - {'name'}),
                'Cumulative metadata contract required fields differ')
    return combined


def verify(capture, *, evidence_root=FOLLOWUP):
    # evidence_root exists for isolated tampering controls; the CLI has no
    # override and every root must satisfy the same pinned manifest hashes.
    evidence_root = Path(evidence_root)
    legacy = legacy_verifier()
    previous = legacy.verify(capture)
    refs = independent_references(evidence_root)
    metadata = metadata_contract(evidence_root)
    errors = list(previous['errors'])
    rows = capture.get('stats', {}).get('rows', []) if isinstance(capture, dict) and isinstance(capture.get('stats'), dict) else []
    by_id = {r['id']: r for r in rows if isinstance(r, dict) and isinstance(r.get('id'), str)} if isinstance(rows, list) else {}
    targets = {r['id']: r for r in read_json(legacy.EVIDENCE / 'reader-targets.json')['rows']}
    metadata_checks = 0
    for id_, contract in metadata.items():
        for field, expected in contract['fields'].items():
            metadata_checks += 1
            if by_id.get(id_, {}).get(field) != expected:
                errors.append(id_ + '.' + field + ' missing or differs from follow-up source-backed metadata contract')
    comparisons = list(previous['comparisons'])
    for id_, reference in refs.items():
        row = by_id.get(id_)
        if row is None:
            errors.append(id_ + ' missing for exact follow-up comparison')
            continue
        for field in ['geography', 'unit', 'dimensions', 'kind', 'selection']:
            metadata_checks += 1
            if row.get(field) != targets[id_][field]:
                errors.append(id_ + '.' + field + ' differs from fixed selected identity')
        require(targets[id_]['unit'] == reference['unit'] and targets[id_]['geography'] == reference['geography'],
                'Original-to-target unit/geography crosswalk differs: ' + id_)
        if row.get('status') != 'ok':
            errors.append(id_ + ' unavailable for exact follow-up comparison')
        if row.get('period') != reference['period']:
            errors.append(id_ + ' different period; no new vintage approved')
        value = row.get('value')
        actual = None
        if not isinstance(value, bool) and isinstance(value, (int, float)):
            try:
                actual = Decimal(str(value))
            except InvalidOperation:
                pass
        if actual is None or not actual.is_finite() or actual != reference['value']:
            errors.append(id_ + ' differs from exact published numeric reference; no rounding/substitution allowed')
        comparisons.append({
            'id': id_, 'period': row.get('period'),
            'actual_value': str(value) if isinstance(value, float) and not Decimal(str(value)).is_finite() else value,
            **{('official_' + key if key in ['period', 'value'] else key): str(item) if isinstance(item, Decimal) else item
               for key, item in reference.items()},
            'exact_tolerance': 0,
        })
    # Counts describe reference scope/attempts even when the actual capture fails.
    unresolved = sorted(set(targets) - (set(legacy.independent_references()) | set(refs)))
    require(len(unresolved) == 8, 'Cumulative unresolved identity count differs')
    return {
        'passed': not errors, 'errors': errors,
        'expected_native_rows': 23, 'actual_native_rows': previous['actual_native_rows'],
        'metadata_checks': previous['metadata_checks'] + metadata_checks,
        'historical_reference_count': 11, 'followup_reference_count': 4,
        'independent_reference_count': 15, 'exact_numeric_comparisons': len(comparisons),
        'comparisons': comparisons, 'unverified_numeric_ids': unresolved,
        'unverified_numeric_row_errors': sorted(id_ for id_ in unresolved if by_id.get(id_, {}).get('status') != 'ok'),
        'legacy_verifier_sha256': LEGACY_SHA256,
        'followup_evidence_manifest_sha256': MANIFESTS,
        'cumulative_metadata_contract_sha256': CUMULATIVE_METADATA_SHA256,
        'all_23_numeric_acceptance': False, 'undisplayed_flags_accepted': False,
        'future_vintages_approved': False, 'scheduled_or_release_acceptance': False,
        'vintage_limit': previous['vintage_limit'],
        'scope': '15 fixed dated numerical references; eight native numeric cells remain unresolved. New CSV flags are explicitly undisplayed. Independent presentation/extraction shares Stats NZ statistical lineage. No whole-source or future acceptance.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture_json', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    try:
        capture_raw = args.capture_json.read_bytes()
        capture = read_json(args.capture_json)
        report = verify(capture)
        report['capture_sha256'] = hashlib.sha256(capture_raw).hexdigest()
        report['capture_path'] = str(args.capture_json)
    except (ValueError, OSError, KeyError, TypeError, StopIteration, IndexError, zipfile.BadZipFile) as error:
        report = {'passed': False, 'errors': [f'{type(error).__name__}: {error}'],
                  'all_23_numeric_acceptance': False, 'undisplayed_flags_accepted': False,
                  'future_vintages_approved': False, 'scheduled_or_release_acceptance': False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({key: report[key] for key in [
        'passed', 'errors', 'all_23_numeric_acceptance', 'undisplayed_flags_accepted', 'future_vintages_approved']}))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
