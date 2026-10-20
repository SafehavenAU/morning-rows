#!/usr/bin/env python3
"""Reacquire only six hash-pinned public inputs; fail if a mutable file changed.

Usage: python reacquire-original.py NEW_RAW_DIRECTORY
This is an explicit network operation. It is not needed for ordinary offline
verification. Original acquisition timestamps remain historical evidence;
reacquisition times and hashes are recorded separately and are never presented
as evidence that the historical day is the current latest completed day.
"""
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('reacquire-original.py NEW_RAW_DIRECTORY')
root = Path(__file__).resolve().parent
ledger = json.loads((root / 'original/acquisition.json').read_text())
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=False)
selected = [row for row in ledger['sources'] if row['role'] == 'selected evidence source']
assert len(selected) == 6
attempts = []
try:
    for source in selected:
        url = source['url']
        assert url.startswith(('https://www.aemo.com.au/', 'https://nemweb.com.au/'))
        destination = out / source['raw_file']
        assert destination.parent == out
        started = datetime.now(timezone.utc).isoformat()
        response = subprocess.run([
            'curl', '--proto', '=https', '--silent', '--show-error', '--fail-with-body',
            '--max-time', '45', '--max-filesize', '3000000', '--output', str(destination),
            '--write-out', '%{http_code}', url,
        ], capture_output=True, text=True)
        raw = destination.read_bytes() if destination.exists() else b''
        actual_hash = hashlib.sha256(raw).hexdigest()
        attempt = {'name': source['name'], 'url': url, 'retrieved_at': started,
                   'completed_at': datetime.now(timezone.utc).isoformat(),
                   'http_status': int(response.stdout) if response.stdout.isdigit() else None,
                   'curl_status': response.returncode, 'wire_bytes': len(raw),
                   'wire_sha256': actual_hash,
                   'matches_original': len(raw) == source['wire_bytes'] and actual_hash == source['wire_sha256']}
        attempts.append(attempt)
        if response.returncode != 0 or attempt['http_status'] != 200 or not attempt['matches_original']:
            raise ValueError('Pinned original could not be reacquired: ' + source['name'])
    # Historical provenance is explicitly labelled; separate attempts above are
    # the actual new retrieval evidence. No new current-day acceptance is made.
    capture = {'provenance_kind': 'Hash-identical replay of retained historical source acquisition',
               'sources': ledger['sources'], 'reacquisition': attempts}
    (out / 'capture.json').write_text(json.dumps(capture, indent=2) + '\n')
finally:
    (out / 'reacquisition.json').write_text(json.dumps(attempts, indent=2) + '\n')
print(json.dumps({'hash_identical_sources': len(attempts), 'raw_directory': str(out)}))
