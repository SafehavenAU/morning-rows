#!/usr/bin/env python3
"""Offline captured AEMO Draft 2020-12 validation; no HTTP or runtime imports.

CAPTURE OUTPUT REVISION VERSION [staged]. The separate capture/numerical gate
establishes transport and exact publisher comparisons. This checks structure.
"""
import copy
from collections import Counter
from datetime import datetime
from decimal import Decimal
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import re
import sys

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[4]
HELPER_PATH = ROOT / 'scripts/verify-statcan-gdp-captures.py'
spec = importlib.util.spec_from_file_location('retained_gdp_schema_helpers', HELPER_PATH)
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)

DESK = '/australia.json'
SOURCE = DESK + '?source=grid_day'
PERIOD = '2026-10-19'
MEASURES = [region + '.' + statistic for region in ['SA1', 'VIC1']
            for statistic in ['mean', 'minimum', 'maximum', 'negative_count', 'zero_count']]
SHARE = SOURCE + '&measure=SA1.mean'


def expected_routes():
    paths = ['/health.json', '/schema.json', DESK, '/catalog.json?desk=australia', SOURCE]
    for measure in MEASURES:
        path = SOURCE + '&measure=' + measure
        paths.extend([path, path + '&observation=' + PERIOD])
    rows = [(path, 'GET', False, 200) for path in paths]
    rows.extend([(SHARE, 'GET', True, 304), (SHARE, 'HEAD', False, 200)])
    rows.extend((path, 'GET', False, status) for path, status in [
        (SHARE + '&observation=2026-10-18', 404),
        (SOURCE + '&measure=NSW1.mean', 404),
        (SHARE + '&observation=2026-10', 400),
        (SHARE + '&date=' + PERIOD, 400),
        (SHARE + '&geography=Australia', 400),
        (SHARE + '&measure=SA1.maximum', 400),
        (SOURCE + '&observation=' + PERIOD, 400),
    ])
    return rows


def verify(directory, revision, version, staged):
    report = {
        'kind': 'Offline captured AEMO electricity schemas, separate from numerical correctness',
        'pass': False,
        'revision': revision,
        'version': version,
        'staged': staged,
        'source': 'australia/grid_day',
        'limitations': [
            'Structural validation is separate from exact numerical and semantic capture verification.',
            'The retained 19 October specimen does not approve another calendar day.',
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
        return json.loads(raw, parse_float=Decimal)

    try:
        require(bool(re.fullmatch('[a-f0-9]{40}', revision)), 'Invalid source revision')
        require(bool(re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', version)),
                'Invalid Worker version')
        captured = load(directory / 'aemo-daily-interface-report.json')
        require(captured.get('pass') is True and captured.get('revision') == revision
                and captured.get('version') == version and captured.get('staged') == staged,
                'Capture identity or pass mismatch')
        origins = ['https://morningrows.com'] if staged else [
            'https://morningrows.com', 'https://www.morningrows.com',
        ]
        plan = expected_routes()
        require(len(plan) == 34, 'Internal bounded route count')
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
            required_definitions = ['aemoDailyNative'] + [
                'aemoDaily' + kind + str(index)
                for index in range(10) for kind in ['Row', 'Observation', 'Definition']] 
            require(all(name in definitions for name in required_definitions),
                    'Missing AEMO native contract')
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
            require(count == 23, 'Incomplete native/catalog/source/measure/period coverage')

            controls = [
                ('Wrong national geography', DESK,
                 lambda body: body['grid_day']['regions'][0].__setitem__('geography', 'Australia')),
                ('Missing interval', DESK,
                 lambda body: body['grid_day']['regions'][0]['intervals'].pop()),
                ('Count becomes price unit', SOURCE + '&measure=SA1.negative_count',
                 lambda body: body['observations'][0]['qualifications'].__setitem__('unit', 'AUD/MWh')),
                ('Unsupported dataset', SHARE,
                 lambda body: body['observations'][0]['qualifications'].__setitem__('dataset', 'TREGION')),
                ('Five-minute summary becomes forecast', SHARE,
                 lambda body: body['observations'][0]['definition'].__setitem__('kind', 'projection')),
                ('Missing acquisition provenance', DESK,
                 lambda body: body['grid_day'].__setitem__('provenance', [])),
                ('Intervention pricing substituted', SOURCE,
                 lambda body: body['context']['regions'][0].__setitem__('intervention', 1)),
                ('Wrong selected native pointer', SHARE,
                 lambda body: body['observations'][0].__setitem__('native_pointer', '/grid_day/regions/1/summary/mean')),
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
