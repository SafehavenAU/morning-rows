#!/usr/bin/env python3
"""Optionally reproduce the contact-free excerpt from the hash-pinned wire CSV.

Usage: python verify-csv-excerpt.py PATH_TO_ORIGINAL_WIRE_CSV
Reads only; no request, write or full-body retention in the repository.
"""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('wire_csv', type=Path)
args = parser.parse_args()
record = json.loads((ROOT / 'original/quarter-export-excerpt.json').read_text())
wire = args.wire_csv.read_bytes()
assert len(wire) == record['wire_bytes']
assert hashlib.sha256(wire).hexdigest() == record['wire_sha256']
lines = wire.splitlines(keepends=True)
assert len(lines) == record['wire_line_count']
boundary = next(i for i, line in enumerate(lines)
                if line.rstrip(b'\r\n') == b'"Source: Statistics New Zealand"')
assert boundary + 1 == record['retained_original_lines']['last']
assert record['retained_original_lines']['first'] == 1
excerpt = b''.join(lines[:boundary + 1])
assert excerpt == (ROOT / 'original' / record['retained_file']).read_bytes()
assert len(excerpt) == record['retained_bytes']
assert hashlib.sha256(excerpt).hexdigest() == record['retained_sha256']
print(json.dumps({'passed': True, 'original_lines_identical': True,
                  'wire_bytes': len(wire), 'retained_bytes': len(excerpt),
                  'contact_footer_retained': False}))
