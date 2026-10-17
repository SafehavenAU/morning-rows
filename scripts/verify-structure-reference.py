"""Replay selected publisher cells without importing the JavaScript reader.
The dated raw aggregate subset is licence-permitted; no patient/person data.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'verification/structure-2026-10-17'
ref = json.loads((ROOT / 'publisher-reference.json').read_text())
snap = json.loads((ROOT / 'selected-snapshot.json').read_text())
triage = dict(zip(['MYH-RM0035', 'MYH-RM0036', 'MYH-RM0037', 'MYH-RM0038', 'MYH-RM0039'],
                  ['Resuscitation', 'Emergency', 'Urgent', 'Semi-urgent', 'Non-urgent']))
rows = ref['aihw']
assert len(rows) == 40
assert len({(r['reporting_unit_code'], r['reported_measure_code']) for r in rows}) == 40
for r in rows:
    assert r['measure_code'] == 'MYH0010' and r['units_name'] == 'percent'
    assert r['reporting_start_date'] == '2024-07-01' and r['reporting_end_date'] == '2025-06-30'
    state = next(s for s in snap['australia']['hospital']['states'] if s['code'] == r['reporting_unit_code'])
    assert state[triage[r['reported_measure_code']]] == r['value']
p, = ref['wales']
assert (p['Area'], p['Age'], p['Sex'], p['Year']) == ('Wales', 'All Ages', 'Persons', 'Mid-year 2026')
assert int(p['Data values']) == snap['wales']['projection']['value']
for r in ref['nisra']:
    assert r['selection']['SEX'] == 'All' and r['selection']['LGD2014'] == 'N92000002'
    assert r['selection']['TLIST(A1)'] == '2024/25' and r['unit'] == '%'
    s = next(x for x in snap['northern-ireland']['childhood_bmi']['rows'] if x['id'] == r['selection']['STATISTIC'])
    assert r['value'] == s['value']
print('45 selected publisher cells reconcile; underlying statistical lineage is shared.')
