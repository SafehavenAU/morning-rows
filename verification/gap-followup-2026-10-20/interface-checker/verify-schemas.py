#!/usr/bin/env python3
"""Offline captured NI Draft 2020-12 validation; no HTTP or runtime imports.

CAPTURE OUTPUT REVISION VERSION [staged]. The separate capture/numerical gate
establishes transport and exact publisher comparisons. This checks structure.
"""
import copy
from collections import Counter
from datetime import datetime
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import re
import sys

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[3]
HELPER_PATH = ROOT / 'scripts/verify-statcan-gdp-captures.py'
spec = importlib.util.spec_from_file_location('retained_gdp_schema_helpers', HELPER_PATH)
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)

DESK = '/northern-ireland.json'
SOURCE = DESK + '?source=electricity_balance'
PERIOD = '2025-07-01%2F2026-06-30'
MEASURES = (
    'renewable_share_gfec',
    'gross_final_consumption',
    'renewable_generation',
    'non_renewable_generation',
    'net_imports',
)
SHARE = SOURCE + '&measure=renewable_share_gfec'


def expected_routes():
    paths = ['/health.json', '/schema.json', DESK,
             '/catalog.json?desk=northern-ireland', SOURCE]
    for measure in MEASURES:
        path = SOURCE + '&measure=' + measure
        paths.extend([path, path + '&observation=' + PERIOD])
    rows = [(path, 'GET', False, 200) for path in paths]
    rows.extend([(SHARE, 'GET', True, 304), (SHARE, 'HEAD', False, 200)])
    rows.extend((path, 'GET', False, status) for path, status in [
        (SHARE + '&observation=2024-07-01%2F2025-06-30', 404),
        (SOURCE + '&measure=monthly_average', 404),
        (SHARE + '&date=2026-06-30', 400),
        (SHARE + '&geography=Ireland', 400),
        (SHARE + '&measure=net_imports', 400),
        (SOURCE + '&observation=' + PERIOD, 400),
    ])
    return rows


def verify(directory, revision, version, staged):
    report = {
        'kind': 'Offline captured NI electricity schemas, separate from numerical correctness',
        'pass': False,
        'revision': revision,
        'version': version,
        'staged': staged,
        'source': 'northern-ireland/electricity_balance',
        'limitations': [
            'Structural validation is separate from exact numerical and semantic capture verification.',
            'The fixed 3 September 2026 edition is not a newest-publication or future-vintage claim.',
            'No scheduled-operation acceptance is established.',
        ],
        'inputs': [],
        'schema_checks': [],
        'negative_controls': [],
    }

    def require(ok, label):
        if not ok:
            raise ValueError(label)

    def load(path):
        raw = path.read_bytes()
        report['inputs'].append({
            'file': path.name, 'bytes': len(raw), 'sha256': sha256(raw).hexdigest(),
        })
        return json.loads(raw)

    try:
        require(bool(re.fullmatch('[a-f0-9]{40}', revision)), 'Invalid source revision')
        require(bool(re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', version)),
                'Invalid Worker version')
        captured = load(directory / 'ni-energy-interface-report.json')
        require(captured.get('pass') is True and captured.get('revision') == revision
                and captured.get('version') == version and captured.get('staged') == staged,
                'Capture identity or pass mismatch')
        origins = ['https://morningrows.com'] if staged else [
            'https://morningrows.com', 'https://www.morningrows.com',
        ]
        plan = expected_routes()
        require(len(plan) == 23, 'Internal bounded route count')
        requests = captured['requests']
        require(Counter((r.get('origin'), r.get('path'), r.get('method'),
                         r.get('conditional'), r.get('status')) for r in requests)
                == Counter((origin, *row) for origin in origins for row in plan),
                'Incomplete/duplicate/unknown capture routes')
        bodies = {}
        seen = set()
        empty_hash = sha256(b'').hexdigest()
        for index, request in enumerate(requests):
            require(request['origin'] in origins
                    and request['headers'].get('x-source-revision') == revision
                    and request['headers'].get('x-worker-version') == version,
                    'Response identity mismatch')
            empty = request['method'] == 'HEAD' or request['status'] == 304
            if empty:
                require('file' not in request and request.get('bytes') == 0
                        and request.get('sha256') == empty_hash,
                        'HEAD/304 must have no captured response body')
                continue
            require('file' in request, 'Missing captured JSON response body')
            filename = request['file']
            require(isinstance(filename, str) and re.fullmatch(r'\d{3}\.body', filename)
                    and filename not in seen, 'Unsafe or repeated capture file')
            seen.add(filename)
            body = load(directory / filename)
            require(report['inputs'][-1]['sha256'] == request['sha256']
                    and report['inputs'][-1]['bytes'] == request['bytes'],
                    'Body hash or byte mismatch')
            bodies[index] = body

        for origin in origins:
            schema_rows = [index for index, request in enumerate(requests)
                           if request['origin'] == origin and request['path'] == '/schema.json'
                           and request['method'] == 'GET' and request['status'] == 200]
            require(len(schema_rows) == 1, 'Exactly one captured schema required')
            schema = bodies[schema_rows[0]]
            require(schema.get('$id') == 'https://morningrows.com/schema.json'
                    and schema.get('$schema') == 'https://json-schema.org/draft/2020-12/schema',
                    'Unexpected schema identity or dialect')
            definitions = schema.get('$defs', {})
            required_definitions = ['remainingNiNative', 'remainingNiContext']
            for index in range(5):
                required_definitions.extend([
                    'remainingNiRow' + str(index),
                    'remainingNiObservation' + str(index),
                    'remainingNiDefinition' + str(index),
                ])
            require(all(name in definitions for name in required_definitions),
                    'Missing NI native/row/observation contract')
            require(not any(key.startswith(('remainingCqc', 'remainingOns', 'gapAemo'))
                            for key in definitions),
                    'Held candidate advertised in public schema')
            helpers.reject_remote_refs(schema)
            Draft202012Validator.check_schema(schema)
            validator = Draft202012Validator(schema, format_checker=helpers.FORMATS)
            successful = {}
            count = 0
            for index, request in enumerate(requests):
                if (request['origin'] != origin or request['status'] != 200
                        or request['method'] != 'GET'
                        or request['path'] in ('/health.json', '/schema.json')):
                    continue
                errors = list(validator.iter_errors(bodies[index]))
                require(not errors, 'Captured schema failed ' + request['path'] + ': '
                        + '; '.join(error.message[:180] for error in errors[:2]))
                report['schema_checks'].append({
                    'origin': origin, 'path': request['path'], 'pass': True,
                })
                successful[request['path']] = bodies[index]
                count += 1
            require(count == 13, 'Incomplete native/catalog/source/measure/period coverage')

            def wrong_edition(body):
                native = body['electricity_balance']
                native['edition'] = 'fixed_2026-10-03'
                native['publication_date'] = '2026-10-03'

            controls = [
                ('NI territory replaced by Ireland', DESK,
                 lambda body: body['electricity_balance'].__setitem__('geography', 'Ireland')),
                ('Percentage row changed to GWh', SHARE,
                 lambda body: body['observations'][0]['qualifications'].__setitem__('unit', 'GWh')),
                ('Rolling period replaced by calendar year', SHARE + '&observation=' + PERIOD,
                 lambda body: body['observations'][0]['qualifications'].__setitem__(
                     'period', '2026-01-01/2026-12-31')),
                ('Unreviewed publication edition', DESK, wrong_edition),
                ('Missing electricity balance component', DESK,
                 lambda body: body['electricity_balance']['rows'].pop()),
                ('Retained metadata falsely labelled live acquisition', SOURCE,
                 lambda body: body['context']['metadata']['metadata_evidence'].__setitem__(
                     'live_retrieved', True)),
                ('Missing live article provenance', DESK,
                 lambda body: body['electricity_balance'].__setitem__('provenance', [])),
                ('Superseded consumption method substituted', SHARE,
                 lambda body: body['observations'][0]['qualifications'].__setitem__(
                     'methodology', 'Pre-2026 metered electricity consumption excluding own-use')),
            ]
            for label, path, edit in controls:
                body = copy.deepcopy(successful[path])
                edit(body)
                require(not validator.is_valid(body), 'Schema accepted negative control ' + label)
                report['negative_controls'].append({
                    'origin': origin, 'path': path, 'label': label, 'pass': True,
                })
        report['pass'] = True
    except Exception as error:
        report['error'] = str(error)
    report['verified_at'] = datetime.now().astimezone().isoformat()
    return report


if __name__ == '__main__':
    args = sys.argv[1:]
    if len(args) not in (4, 5) or len(args) == 5 and args[4] != 'staged':
        raise SystemExit('CAPTURE OUTPUT REVISION VERSION [staged] required')
    directory, output, revision, version = args[:4]
    result = verify(Path(directory), revision, version, len(args) == 5)
    with Path(output).open('x') as handle:
        json.dump(result, handle, indent=2)
        handle.write('\n')
    print(json.dumps({
        'pass': result['pass'], 'error': result.get('error'),
        'schema_checks': len(result['schema_checks']),
        'negative_controls': len(result['negative_controls']), 'output': output,
    }))
    raise SystemExit(not result['pass'])
