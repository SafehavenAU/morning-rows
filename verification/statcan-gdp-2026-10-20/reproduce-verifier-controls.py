#!/usr/bin/env python3
"""Reproduce constructed GDP capture-verifier controls without any HTTP request.

python verification/statcan-gdp-2026-10-20/reproduce-verifier-controls.py OUTPUT

Uses retained originals with the actual reader/selector to construct temporary
captures. The independent verifier checks those captures, then altered copies.
These are tooling controls, not a protected-preview, live-source or release gate.
Requires existing Node >=22 and Python jsonschema. Does not install dependencies.
"""
import argparse
from datetime import datetime, timezone
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

GENERATOR = r"""
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [root,dir]=process.argv.slice(2);
const {readStatcanGdp,STATCAN_GDP_URLS}=await import(pathToFileURL(root+'lib/statcan-gdp.js'));
const {INFORMATION_SCHEMA,catalogue,selectedResponse,validateSelection}=await import(pathToFileURL(root+'lib/information.js'));
await mkdir(dir);
const mapping={data:'wds-selected.json',series:'series-metadata.json',cube:'cube-metadata.json'};
const native=await readStatcanGdp({fetcher:async(url)=>new Response(await readFile(root+'verification/statcan-gdp-2026-10-20/original/'+mapping[Object.keys(STATCAN_GDP_URLS).find(k=>STATCAN_GDP_URLS[k]===url)]))});
const t=new Date().toISOString(),revision='1'.repeat(40),version='11111111-1111-1111-1111-111111111111',origin='https://morningrows.com';
const full={site:origin,country:'Canada',product:native,sources:{product:{status:'ok',fetched_at:t}},_meta:{schema_version:'1.0',id:origin+'/canada.json',catalog:origin+'/catalog.json?desk=canada'}};
const source='/canada.json?source=product',level=source+'&measure=level',growth=source+'&measure=quarter_change';
const routes=[...['/health.json','/schema.json','/canada.json','/catalog.json?desk=canada',source,level,level+'&observation=2026-Q1',level+'&observation=2026-Q2',growth,growth+'&observation=2026-Q2',level].map(p=>[p,'GET',false,200]),[level,'GET',true,304],[level,'HEAD',false,200],...[[level+'&observation=1900-Q1',404],[growth+'&observation=2026-Q1',404],[source+'&measure=nominal_gdp',404],[level+'&geography=Ontario',400],[level+'&date=2026-04',400],[source+'&source=price_index',400]].map(([p,s])=>[p,'GET',false,s])];
const ref=await readFile(root+'verification/statcan-gdp-2026-10-20/independent-report.json'),hash=b=>createHash('sha256').update(b).digest('hex');
const report={kind:'CONSTRUCTED OFFLINE TOOLING CONTROL ONLY, no HTTP or release proof',pass:true,revision,version,reference:{bytes:ref.length,sha256:hash(ref)},requests:[]};
for(const[path,method,conditional,status]of routes){let body;
 if(path==='/health.json')body={source_dirty:false,source_revision:revision,worker_version:version};
 else if(path==='/schema.json')body=INFORMATION_SCHEMA;
 else if(path==='/canada.json')body=full;
 else if(path.startsWith('/catalog'))body=catalogue('canada');
 else if(!conditional&&method!=='HEAD'){const sel=validateSelection(new URL(origin+path));body=sel.status?{error:sel.code}:(await selectedResponse(full,sel)).body;}
 const raw=body?JSON.stringify(body):'',record={origin,path,method,conditional,status,expected_status:status,headers:{'x-source-revision':revision,'x-worker-version':version,etag:'"constructed"','cache-control':'max-age=120'},bytes:Buffer.byteLength(raw),sha256:hash(raw),started_at:t,completed_at:t};
 if(body){record.file=String(report.requests.length+1).padStart(3,'0')+'.body';await writeFile(dir+'/'+record.file,raw,{flag:'wx'});}report.requests.push(record);
}
await writeFile(dir+'/gdp-interface-report.json',JSON.stringify(report),{flag:'wx'});

"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Output exists; preserve it and use another output path')
    root = Path(__file__).resolve().parents[2]
    evidence = root / 'verification/statcan-gdp-2026-10-20'
    verifier = root / 'scripts/verify-statcan-gdp-captures.py'
    reference = evidence / 'independent-report.json'
    spec = importlib.util.spec_from_file_location('gdp_capture_verifier', verifier)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    revision, version = '1' * 40, '11111111-1111-1111-1111-111111111111'
    files = [Path(__file__).resolve(), verifier, reference,
             root / 'lib/statcan-gdp.js', root / 'lib/information.js',
             root / 'lib/sources.js', root / 'lib/inventory.js',
             *[evidence / 'original' / name for name in
               ['wds-selected.json', 'series-metadata.json', 'cube-metadata.json']]]
    hashes = {str(p.relative_to(root)): sha256(p.read_bytes()).hexdigest()
              for p in files}
    report = {
        'kind': 'Constructed offline capture-verifier controls; no HTTP, protected preview, publisher freshness or release proof',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'pass': False, 'code_and_reference_sha256': hashes,
        'temporary_files_retained': False,
        'fixture_identity_is_constructed': True,
        'controls': [],
    }
    with tempfile.TemporaryDirectory(prefix='morning-rows-gdp-controls-') as temporary:
        scratch = Path(temporary)
        generator = scratch / 'generate.mjs'
        generator.write_text(GENERATOR)
        original = scratch / 'constructed-capture'
        result = subprocess.run(['node', str(generator), str(root) + '/', str(original)],
                                capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError('Constructed generator failed; no remote operation was attempted')
        baseline = module.verify(original, reference, revision, version, 'apex')
        report['baseline'] = {'pass': baseline['pass'], 'counts': baseline.get('counts'),
                              'error': baseline.get('error')}
        if not baseline['pass']:
            raise RuntimeError('Constructed baseline failed: ' + str(baseline.get('error')))
        report['cache_boundary_controls'] = []
        for limit, expected_pass in [(3600, True), (3601, False)]:
            directory = scratch / ('cache-' + str(limit))
            shutil.copytree(original, directory)
            capture_path = directory / 'gdp-interface-report.json'
            capture = json.loads(capture_path.read_text())
            for record in capture['requests']:
                if record['status'] == 200 and record['method'] == 'GET' and 'source=' in record['path']:
                    record['headers']['cache-control'] = 'max-age=' + str(limit)
            capture_path.write_text(json.dumps(capture))
            boundary = module.verify(directory, reference, revision, version, 'apex')
            report['cache_boundary_controls'].append({
                'max_age': limit, 'expected_pass': expected_pass,
                'actual_pass': boundary['pass'], 'reason': boundary.get('error'),
                'pass': boundary['pass'] == expected_pass,
            })
        cases = ['wrong_identity', 'modified_hash', 'missing_route',
                 'negative_status_200', 'changed_level', 'wrong_release',
                 'invalid_datetime', 'refused_body_substitution']
        for case in cases:
            directory = scratch / case
            shutil.copytree(original, directory)
            capture_path = directory / 'gdp-interface-report.json'
            capture = json.loads(capture_path.read_text())
            # Keep report.pass true: it must never substitute for actual checks.
            if case == 'wrong_identity':
                capture['requests'][0]['headers']['x-worker-version'] = '22222222-2222-2222-2222-222222222222'
            elif case == 'modified_hash':
                capture['requests'][2]['sha256'] = '0' * 64
            elif case == 'missing_route':
                capture['requests'].pop()
            elif case == 'negative_status_200':
                capture['requests'][-1]['status'] = 200
            else:
                record = capture['requests'][-1] if case == 'refused_body_substitution' else capture['requests'][2]
                body_file = directory / record['file']
                body = json.loads(body_file.read_text())
                if case == 'changed_level':
                    body['product']['rows'][0]['value'] += 1
                elif case == 'wrong_release':
                    body['product']['metadata']['release_timestamp_raw'] = '2026-09-28T08:30'
                elif case == 'invalid_datetime':
                    body['product']['provenance'][0]['retrieved_at'] = '2026-02-30T08:30:00Z'
                else:
                    body['data'] = {'value': 0}
                raw = json.dumps(body).encode()
                body_file.write_bytes(raw)
                record['bytes'], record['sha256'] = len(raw), sha256(raw).hexdigest()
            capture_path.write_text(json.dumps(capture))
            altered = module.verify(directory, reference, revision, version, 'apex')
            report['controls'].append({'case': case, 'rejected': not altered['pass'],
                                       'reason': altered.get('error')})
        report['pass'] = all(control['rejected'] for control in report['controls']) and all(control['pass'] for control in report['cache_boundary_controls'])
    report['code_unchanged'] = all(sha256(p.read_bytes()).hexdigest() == hashes[str(p.relative_to(root))]
                                   for p in files)
    report['pass'] = report['pass'] and report['code_unchanged']
    with args.output.open('x') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'pass': report['pass'], 'controls': len(report['controls']),
                      'baseline': report['baseline']['counts'], 'output': str(args.output)}))
    raise SystemExit(0 if report['pass'] else 1)


if __name__ == '__main__':
    main()
