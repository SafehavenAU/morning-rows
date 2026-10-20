#!/usr/bin/env python3
"""Constructed local controls only: never an actual-reader or release proof."""
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SPEC = importlib.util.spec_from_file_location('followup_statsnz_verifier', ROOT / 'scripts/verify-followup-statsnz.py')
V = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(V)


def baseline():
    old = V.legacy_verifier()
    rows = deepcopy(V.read_json(old.EVIDENCE / 'reader-targets.json')['rows'])
    refs = {**old.independent_references(), **V.independent_references()}
    metadata = V.read_json(old.EVIDENCE / 'capture-metadata-contract.json')
    for id_, entry in V.metadata_contract().items():
        metadata.setdefault(id_, {}).setdefault('fields', {}).update(entry['fields'])
    for row in rows:
        row.update(metadata.get(row['id'], {}).get('fields', {}))
        if row['id'] in refs:
            ref = refs[row['id']]
            row['period'] = ref['period']
            row['value'] = int(ref['value']) if ref['value'] == ref['value'].to_integral_value() else float(ref['value'])
    return {'country': 'New Zealand', 'stats': {'present': True, 'status': 'ok', 'rows': rows}}


def row(capture, id_):
    return next(r for r in capture['stats']['rows'] if r['id'] == id_)


base = baseline()
positive = V.verify(base)
assert positive['passed'], positive['errors']
assert positive['exact_numeric_comparisons'] == 15
assert len(positive['unverified_numeric_ids']) == 8
assert positive['all_23_numeric_acceptance'] is False
assert positive['undisplayed_flags_accepted'] is False
assert positive['future_vintages_approved'] is False
controls = []


def reject(label, mutate):
    candidate = deepcopy(base)
    mutate(candidate)
    result = V.verify(candidate)
    assert not result['passed'] and result['errors'], label
    controls.append({'control': label, 'rejected': True, 'errors': result['errors']})


for id_ in sorted(V.NEW_IDS):
    for field, value in [
        ('value', row(base, id_)['value'] + 1),
        ('value', str(row(base, id_)['value'])),
        ('value', True),
        ('value', float('nan')),
        ('value', None),
        ('value', 0),
        ('geography', 'Auckland'),
        ('unit', 'thousands'),
        ('period', '2027'),
        ('status', 'error'),
    ]:
        name = f'{id_}_{field}_{repr(value)}'
        reject(name, lambda c, id_=id_, field=field, value=value: row(c, id_).__setitem__(field, value))
    reject(id_ + '_missing_value', lambda c, id_=id_: row(c, id_).pop('value'))
    dimension = next(iter(row(base, id_)['dimensions']))
    reject(id_ + '_wrong_dimension', lambda c, id_=id_, dimension=dimension:
           row(c, id_)['dimensions'][dimension].__setitem__('code', 'WRONG'))
for id_, contract in V.metadata_contract().items():
    for field in contract['fields']:
        reject(id_ + '_missing_' + field, lambda c, id_=id_, field=field: row(c, id_).pop(field))
        reject(id_ + '_false_' + field, lambda c, id_=id_, field=field:
               row(c, id_).__setitem__(field, 'All people; calendar-year final unadjusted estimate'))
reject('historical_reference_value_is_still_enforced',
       lambda c: row(c, 'BDS_BDS_004').__setitem__('value', row(c, 'BDS_BDS_004')['value'] + 1))
reject('duplicate_native_row', lambda c: c['stats']['rows'].__setitem__(0, deepcopy(c['stats']['rows'][1])))
reject('missing_native_row', lambda c: c['stats']['rows'].pop())
reject('missing_native_rows', lambda c: c['stats'].pop('rows'))
reject('wrong_native_country', lambda c: c.__setitem__('country', 'Australia'))

# An unresolved cell remains unresolved even if its number changes.
unresolved = deepcopy(base)
row(unresolved, 'LEED_AP1_001')['value'] = 1
unresolved_result = V.verify(unresolved)
assert unresolved_result['passed']
assert 'LEED_AP1_001' in unresolved_result['unverified_numeric_ids']
assert unresolved_result['all_23_numeric_acceptance'] is False

tampering = []
with tempfile.TemporaryDirectory(prefix='mr-followup-reference-controls-') as tmp:
    temporary = Path(tmp)
    copied = temporary / 'evidence'
    for directory in ['statsnz-agri-projections', 'statsnz-income', 'statsnz-cumulative']:
        shutil.copytree(V.FOLLOWUP / directory, copied / directory)
    cases = [
        ('agriculture_reference', 'statsnz-agri-projections/original/agriculture-selected.csv'),
        ('leed_reference', 'statsnz-income/leed/original/quarter-full-jobs-2025Q2.csv'),
        ('income_metadata_reference', 'statsnz-income/metadata-contract.json'),
        ('cumulative_metadata_reference', 'statsnz-cumulative/metadata-contract.json'),
        ('frozen_manifest', 'statsnz-agri-projections/manifest.json'),
    ]
    for label, relative in cases:
        path = copied / relative
        original = path.read_bytes()
        path.write_bytes(original + b' ')
        try:
            V.verify(base, evidence_root=copied)
        except ValueError as error:
            tampering.append({'control': label, 'rejected': True, 'error': str(error)})
        else:
            raise AssertionError('Tampered reference accepted: ' + label)
        finally:
            path.write_bytes(original)
    # Rehashing a changed reference in a changed manifest cannot authorize it.
    reference = copied / 'statsnz-agri-projections/original/agriculture-selected.csv'
    manifest = copied / 'statsnz-agri-projections/manifest.json'
    original_ref, original_manifest = reference.read_bytes(), manifest.read_bytes()
    reference.write_bytes(original_ref.replace(b'8293', b'8294'))
    altered = json.loads(original_manifest)
    entry = next(e for e in altered['files'] if e['path'] == 'original/agriculture-selected.csv')
    entry['sha256'] = hashlib.sha256(reference.read_bytes()).hexdigest()
    manifest.write_text(json.dumps(altered))
    try:
        V.verify(base, evidence_root=copied)
    except ValueError as error:
        tampering.append({'control': 'rewritten_reference_and_manifest', 'rejected': True, 'error': str(error)})
    else:
        raise AssertionError('Rewritten manifest authorized changed reference')
    reference.write_bytes(original_ref)
    manifest.write_bytes(original_manifest)

    cli = []
    for name, payload, expected_code in [
        ('constructed_positive', json.dumps(base), 0),
        ('invalid_json', '{invalid', 1),
        ('nonfinite_json', '{"country":NaN}', 1),
        ('missing_native', '{}', 1),
    ]:
        capture, output = temporary / 'capture.json', temporary / 'result.json'
        capture.write_text(payload)
        process = subprocess.run(
            [sys.executable, str(ROOT / 'scripts/verify-followup-statsnz.py'), str(capture), str(output)],
            capture_output=True, text=True)
        assert process.returncode == expected_code, (name, process.stderr)
        result = json.loads(output.read_text())
        assert result['passed'] is (expected_code == 0), name
        cli.append({'control': name, 'exit_code': process.returncode, 'report_written': True})

report = {
    'passed': True,
    'method': 'Clearly constructed local capture and isolated temporary evidence mutations; no network or actual reader execution',
    'actual_reader_capture_tested': False,
    'constructed_positive': {'passed': True, 'exact_numeric_comparisons': 15, 'remaining_numeric_ids': positive['unverified_numeric_ids']},
    'negative_capture_controls': len(controls), 'reference_tampering_controls': len(tampering),
    'controls': controls, 'tampering_controls': tampering, 'cli_controls': cli,
    'unresolved_numeric_cell_does_not_gain_acceptance': True,
    'all_23_numeric_acceptance': False, 'undisplayed_flags_accepted': False,
    'future_vintages_approved': False, 'scheduled_or_release_acceptance': False,
    'checker_sha256': V.sha256(ROOT / 'scripts/verify-followup-statsnz.py'),
    'legacy_checker_sha256': V.LEGACY_SHA256,
    'cumulative_metadata_contract_sha256': V.CUMULATIVE_METADATA_SHA256,
}
(HERE / 'verifier-controls.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: report[key] for key in [
    'passed', 'negative_capture_controls', 'reference_tampering_controls', 'actual_reader_capture_tested']}))
