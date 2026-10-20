#!/usr/bin/env python3
"""Offline negative controls; synthetic fixture is never an actual-reader proof."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import sys
import subprocess
import tempfile
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('capture_verifier', ROOT / 'scripts/verify-gap-statsnz.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

def baseline():
    targets = json.loads((HERE / 'reader-targets.json').read_text())['rows']
    rows = deepcopy(targets)
    refs = v.independent_references()
    metadata = json.loads((HERE / 'capture-metadata-contract.json').read_text())
    for row in rows:
        id = row['id']
        row.update(metadata.get(id, {}).get('fields', {}))
        if id in refs:
            row['period'] = refs[id]['period']
            value = refs[id]['value']
            row['value'] = int(value) if value == value.to_integral_value() else float(value)
    return {'country': 'New Zealand', 'stats': {'present': True, 'status': 'ok', 'rows': rows}}

def row(c, id):
    return next(r for r in c['stats']['rows'] if r['id'] == id)

def set_field(id, key, value):
    return lambda c: row(c, id).__setitem__(key, value)

def remove_field(id, key):
    return lambda c: row(c, id).pop(key)

def dimension(id, key, code):
    return lambda c: row(c, id)['dimensions'][key].__setitem__('code', code)

cases = [
    ('wrong_period_new_vintage', set_field('POPPR_NAT_007', 'period', '2027')),
    ('wrong_projection_scenario', dimension('POPPR_NAT_007', 'SCENARIO_POPPR_NAT_007', 'P90')),
    ('wrong_held_household_scenario', dimension('POPPR_FHH_003', 'PROJECTION_POPPR_FHH_003', 'MEDIUMB')),
    ('wrong_measure', dimension('INC_INC_010', 'MEASURE_INC_INC_010', 'MEAN_PAY_GAP')),
    ('rounded_numeric', set_field('HES_HES_001', 'value', 1598)),
    ('missing_numeric', remove_field('BDS_BDS_004', 'value')),
    ('numeric_string', set_field('BDS_BDS_004', 'value', '617334')),
    ('numeric_boolean', set_field('BDS_BDS_004', 'value', True)),
    ('numeric_nan', set_field('BDS_BDS_004', 'value', float('nan'))),
    ('suppression_converted_to_zero', set_field('BDS_BDS_004', 'value', 0)),
    ('wrong_kind', set_field('POPPR_NAT_007', 'kind', 'observation')),
    ('wrong_geography', set_field('HES_HES_001', 'geography', 'Auckland')),
    ('wrong_unit', set_field('HES_HES_001', 'unit', 'NZD per year')),
    ('missing_population', remove_field('INC_INC_011', 'population_group')),
    ('wrong_household_population', set_field('INC_INC_011', 'population_group', 'All households')),
    ('missing_snapshot_convention', remove_field('INC_INC_011', 'period_convention')),
    ('missing_snapshot_limitation', remove_field('INC_INC_011', 'limitations')),
    ('missing_prison_discontinuation', remove_field('CORR_FIS_005', 'publication_status')),
    ('missing_justice_discontinuation', remove_field('JUS_FIS_001', 'publication_status')),
    ('missing_index_reference', remove_field('PRD_PRD_001', 'index_reference')),
    ('reference_row_error', set_field('IWI18_GRP_001', 'status', 'error')),
    ('duplicate_row', lambda c: c['stats']['rows'].__setitem__(0, deepcopy(c['stats']['rows'][1]))),
    ('missing_row', lambda c: c['stats']['rows'].pop()),
    ('missing_native_rows', lambda c: c['stats'].pop('rows')),
]
base = baseline()
positive = v.verify(base)
assert positive['passed'], positive['errors']
assert positive['exact_numeric_comparisons'] == 11
assert positive['all_23_numeric_acceptance'] is False
assert positive['future_vintages_approved'] is False
assert positive['scheduled_or_release_acceptance'] is False
results = []
for name, mutate in cases:
    candidate = deepcopy(base)
    mutate(candidate)
    result = v.verify(candidate)
    assert not result['passed'], name
    assert result['errors'], name
    results.append({'control': name, 'rejected': True, 'errors': result['errors']})
# Deliberately modifying an unresolved numeric cell must not be represented as
# its independent numerical acceptance. Identity/metadata coverage stays fixed.
unverified = deepcopy(base)
row(unverified, 'INC_INC_011')['value'] = 999999
unverified_result = v.verify(unverified)
assert unverified_result['passed']
assert 'INC_INC_011' in unverified_result['unverified_numeric_ids']
assert unverified_result['all_23_numeric_acceptance'] is False
cli_checks = []
with tempfile.TemporaryDirectory(prefix='mr-statsnz-verifier-') as tmp:
    src, out = Path(tmp) / 'capture.json', Path(tmp) / 'result.json'
    for label, payload, expected_code in [
        ('synthetic_valid_cli', json.dumps(base), 0),
        ('invalid_json_cli', '{bad json', 1),
    ]:
        src.write_text(payload)
        process = subprocess.run([sys.executable, str(ROOT / 'scripts/verify-gap-statsnz.py'), str(src), str(out)], capture_output=True, text=True)
        assert process.returncode == expected_code, (label, process.stderr)
        decoded = json.loads(out.read_text())
        assert decoded['passed'] is (expected_code == 0), label
        cli_checks.append({'control': label, 'exit_code': process.returncode, 'report_written': True})
    nan_capture = deepcopy(base)
    row(nan_capture, 'BDS_BDS_004')['value'] = float('nan')
    src.write_text(json.dumps(nan_capture))
    process = subprocess.run([sys.executable, str(ROOT / 'scripts/verify-gap-statsnz.py'), str(src), str(out)], capture_output=True, text=True)
    assert process.returncode == 1, process.stderr
    decoded = json.loads(out.read_text())
    assert decoded['passed'] is False
    cli_checks.append({'control': 'nonfinite_json_cli', 'exit_code': 1, 'report_written': True})
report = {'passed': True, 'synthetic_positive_fixture': True,
          'actual_reader_capture_tested': False,
          'independent_references_extracted': 11,
          'negative_controls': len(results), 'rejected': len(results),
          'controls': results, 'cli_checks': cli_checks,
          'unverified_cell_does_not_gain_numeric_acceptance': True,
          'all_23_numeric_acceptance': False, 'future_vintages_approved': False}
(HERE / 'capture-verifier-controls.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['passed', 'negative_controls', 'rejected', 'actual_reader_capture_tested']}))
