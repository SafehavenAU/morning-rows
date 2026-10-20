#!/usr/bin/env python3
"""Read-only local package and optional existing-Git-object verification."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
COMMIT = '791807e066c54884864db88c0c3f2f85c6d713c5'

def need(ok, message):
    if not ok:
        raise ValueError(message)

def data_at(file):
    path = ROOT / file
    need(not Path(file).is_absolute() and '..' not in Path(file).parts
         and ROOT in path.resolve().parents, 'Unsafe package path')
    return path.read_bytes()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    need(manifest['new_http_requests'] == manifest['new_search_queries'] == 0
         and not manifest['broader_maintenance_complete'], 'Honest package scope')
    for entry in manifest['files']:
        raw = data_at(entry['file'])
        need(len(raw) == entry['bytes'] and sha256(raw).hexdigest() == entry['sha256'],
             'Changed package file: ' + entry['file'])
    original_checks, boundary_checks = 0, 0
    for group in ['statsnz', 'held-sources']:
        directory = ROOT / 'originals' / group
        retained = json.loads((directory / 'manifest.json').read_text())
        for entry in retained['files']:
            raw = data_at('originals/' + group + '/' + entry['path'])
            need(len(raw) == entry['bytes'] and sha256(raw).hexdigest() == entry['sha256'],
                 'Changed retained review file')
            original_checks += 1
        if args.repository:
            boundary = json.loads((directory / 'reviewed-boundary.json').read_text())
            for entry in boundary['files']:
                result = subprocess.run(['git', 'show', COMMIT + ':' + entry['path']],
                                        cwd=args.repository, capture_output=True)
                need(result.returncode == 0 and len(result.stdout) == entry['bytes'] and
                     sha256(result.stdout).hexdigest() == entry['sha256'],
                     'Prior committed boundary changed or unavailable: ' + entry['path'])
                boundary_checks += 1
    stats = json.loads(data_at('originals/statsnz/search-log.json'))
    held = json.loads(data_at('originals/held-sources/search-log.json'))
    need(sum(len(batch['queries']) for batch in stats['queries']) == stats['query_count'] == 23
         and len(held['queries']) == 7, 'Retained bounded query counts')
    findings = json.loads(data_at('disposition.json'))
    expected = {'CORR_FIS_005', 'INC_INC_001', 'INC_INC_011', 'JUS_FIS_001',
                'LEED_AP1_001', 'LEED_AP1_002', 'POPPR_FHH_003', 'POPPR_LAB_003'}
    need(findings['new_numeric_gaps_closed'] == 0 and findings['statsnz']['prior_exact_dated_comparisons'] == 15
         and findings['statsnz']['total_selected'] == 23 and findings['statsnz']['remaining'] == 8,
         'No unsupported completeness claim')
    rows = findings['statsnz']['unresolved']
    need({row['id'] for row in rows} == expected and
         all(row['outcome'] == 'blocked_external_evidence' and not row['numeric_comparison_passed'] for row in rows),
         'All eight exact unresolved contracts preserved')
    print(json.dumps({'pass': True, 'package_bindings': len(manifest['files']),
                      'retained_manifest_bindings': original_checks, 'prior_committed_boundary_bindings_rechecked': boundary_checks,
                      'listed_prior_queries': [23, 7], 'new_http_requests': 0, 'new_numerical_acceptance': False}))

if __name__ == '__main__':
    main()
