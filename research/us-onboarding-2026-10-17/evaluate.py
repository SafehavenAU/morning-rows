"""Small deterministic task replay. Cases are authored tests, not user transcripts.

Held-out means not used to select the source/initial annual example. The same
researcher implements and evaluates them; this is not a blinded agent study.
"""
import json
import hashlib
from demo import ROOT, load, select, ratio, ContractError

rep, _ = load()
cases = [
    ('R1', 'representative', 'Annual reference change September 2025 to September 2026', lambda: ratio(rep, '2025-09', '2026-09'), '3.74'),
    ('R2', 'representative', 'Explain whether October 2025 is a usable numeric base', lambda: select(rep, '2025-10'), 'unavailable'),
    ('R3', 'representative', 'Exact October 2026 index; do not substitute September', lambda: select(rep, '2026-10'), 'observation_not_retained'),
    ('H1', 'held_out', 'Explicit November 2025 to February 2026 reference change', lambda: ratio(rep, '2025-11', '2026-02'), '0.82'),
    ('H2', 'held_out', 'September 2026 index for District of Columbia separately', lambda: select(rep, '2026-09', geography='District of Columbia'), 'unsupported_dimensions'),
    ('H3', 'held_out', 'Third-quarter 2026 average index', lambda: select(rep, '2026-Q3'), 'unsupported_period_convention'),
]
rows = []
for identifier, group, question, call, expected in cases:
    try:
        answer = call()
        actual = answer.get('percent_change_display_2dp', answer.get('value_state'))
        if 'citations' in answer:
            dimensions = answer['definition']
            scores = {'correctness': actual == expected,
                      'completeness': all(answer.get(k) for k in ['base_period', 'target_period', 'base_index', 'target_index', 'factor']),
                      'caveat_retention': dimensions['adjustment'] == 'not seasonally adjusted' and dimensions['base_period'] == '1982-84=100' and bool(answer['qualification']),
                      'citation_traceability': len(answer['citations']) == 2 and all(c['id'].startswith(rep['id']) and len(c['version']) == 64 for c in answer['citations']) and answer['release'] == rep['context']['release_url']}
        else:
            scores = {'correctness': actual == expected,
                      'completeness': answer['period'] == '2025-10' and answer['value'] is None,
                      'caveat_retention': any(f['code'] == 'X' and 'appropriations' in f['text'] for f in answer['footnotes']),
                      'citation_traceability': bool(answer['id'] and answer['version'] and rep['context']['source_url'])}
    except ContractError as error:
        actual = str(error)
        scores = {'correctness': actual == expected, 'completeness': actual == expected,
                  'caveat_retention': actual in ('observation_not_retained', 'unsupported_dimensions', 'unsupported_period_convention'),
                  'citation_traceability': 'not_applicable_to_refusal; contract and source remain in directory'}
    rows.append({'id': identifier, 'group': group, 'constructed_question': question, 'expected': expected, 'actual': actual, 'checks': scores})
assert all(all(v is True or isinstance(v, str) for v in r['checks'].values()) for r in rows)
result = {'method': 'Deterministic case replay; no independent agent results',
          'held_out_protocol': 'Reader frozen before final H1-H3 inputs: new interval, separately requested DC, quarterly aggregation. No reader changes made after their run. Same researcher and already-seen dataset; not blinded. Earlier December-June example remains an additional development case, not held-out.',
          'reader_sha256': hashlib.sha256((ROOT / 'demo.py').read_bytes()).hexdigest(),
          'evidence_basis': {'R1': 'Docusign price-adjustment workflow; exact annual interval chosen for the test', 'R2': 'Actual BLS October 2025 unavailable index and MCP missingness issue #58', 'R3': 'Docusign latest-available fallback code; explicit future-month request is constructed', 'H1': 'Same two-month index-ratio capability, new interval', 'H2': 'Constructed DC inclusion versus separately available geography adversary', 'H3': 'Constructed aggregation/period-convention adversary'},
          'cases': rows,
          'effort': {'offline_network_calls': 0, 'live_demonstration_source_calls': 6,
                     'live_calls_meaning': 'Bulk, metadata, footnotes, API cross-check, FRED cross-check and archive; not six calls per end-user query.',
                     'planned_known_measure_calls': 1, 'planned_first_discovery_calls': 4,
                     'planned_discovery_path': 'llms.txt -> catalog.v2.json -> US source directory -> selected measure',
                     'qualification': 'Planned route counts only; no US HTTP service exists. Raw BLS API already returns known-series data in one call. Morning Rows is not proven to reduce calls or latency.'}}
print(json.dumps(result, indent=2))
