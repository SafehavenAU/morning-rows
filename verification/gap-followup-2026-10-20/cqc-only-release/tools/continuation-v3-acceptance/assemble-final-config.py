#!/usr/bin/env python3
"""Assemble one explicit, reviewed two-predecessor CQC continuation config; never run validators.

Usage: assemble-final-config.py ACTUAL_FACTS_JSON REVIEWED_V3_TOOLCHAIN_JSON NEW_CONFIG
No Git/network/subprocesses. Reads immutable inputs and writes only NEW_CONFIG outside
all supplied evidence roots and the repository. The output enables the separate
acceptance helper; this assembler does not establish release or scheduled acceptance.
Facts and the independent tool review must use the exact documented schema below.
"""
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import tempfile

BASE_FILE = '/tmp/mr-combined-final-preparation/cqc-7d7ed892-v3-actual-config/actual-source-config.v3.failed-v2.inert.json'
BASE_SHA = '336fa500a8eda585d5a745b1e59906fe70af4b7e6b8c25adbc264e8e0bee7f8f'
SOURCE = '7d7ed892c469d6f589dabf52283fc31dfef98d8a'
TREE = '3c849466947f893e17c71f7b3e594bad24131b0c'
VERSION = '16e5a892-be54-4381-a9c3-98ae4e47a309'
FINGERPRINT = '56c41341c2b38c38'
SCOPE = 'nine-desks-plus-ni-electricity-and-cqc'
CHAIN_SHA = '45b80fa3c7241858589c7e944e974117ee9f9750e8d336bc880920d63ecb8f1d'
FAILED_SUMMARY_SHAS = ['f7949781f726a243dd1cc69218d7659fda537bfdd9746c2b8c0a52c302999202',
                       'ed8523fea451170768886c9d7a121dc98eb90302a1adb114cc0d181b664366b5']
KIND = 'cqc-r2-rent-readiness-continuation-v3'
IDENTITY = dict(source_revision=SOURCE, source_tree=TREE, version=VERSION,
                fingerprint=FINGERPRINT, scope=SCOPE)
REQUIRED_TOOLS = ('runner', 'runner_manifest', 'gap_support', 'replay',
                  'continuation', 'chain_manifest', 'step_plan', 'assembler',
                  'acceptance', 'formatter', 'packager', 'continuation_acceptance_guard', 'rent_harness', 'rent_harness_derivation', 'review')
UTC = dt.timezone.utc


def need(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def absolute(path, *, directory=False):
    need(isinstance(path, str) and path.startswith('/'), 'Absolute path required')
    p = Path(path)
    need(str(p) == path and '..' not in p.parts, 'Canonical path spelling required')
    for parent in reversed([p, *p.parents]):
        info = parent.lstat()
        need(not stat.S_ISLNK(info.st_mode), f'Symlink forbidden: {parent}')
    info = p.stat()
    need(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode),
         f'Wrong file type: {p}')
    return p


def relative(value):
    need(isinstance(value, str) and value and not value.startswith('/'), 'Relative member required')
    p = PurePosixPath(value)
    need(str(p) == value and '..' not in p.parts and '.' not in p.parts,
         'Unsafe relative member')
    return value


def instant(value):
    need(isinstance(value, str) and re.fullmatch(
        r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)', value),
        'Explicit UTC timestamp required')
    t = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    need(t <= dt.datetime.now(UTC), 'Future evidence timestamp refused')
    return t


def pin_of(path, data):
    return dict(file=str(path), bytes=len(data), sha256=sha(data))


def normalized_pin(row):
    need(isinstance(row, dict), 'File binding object required')
    need(type(row.get('bytes')) is int and row['bytes'] >= 0, 'Exact byte count required')
    need(isinstance(row.get('sha256'), str) and re.fullmatch('[a-f0-9]{64}', row['sha256']),
         'Exact SHA256 required')
    return {key: row[key] for key in ('file', 'bytes', 'sha256')}


class Inputs:
    def __init__(self):
        self.pins = {}

    def read(self, path):
        p = absolute(path)
        data = p.read_bytes()
        pin = pin_of(p, data)
        if str(p) in self.pins:
            need(self.pins[str(p)] == pin, f'Input changed during assembly: {p}')
        self.pins[str(p)] = pin
        return data

    def pinned(self, row):
        pin = normalized_pin(row)
        data = self.read(pin['file'])
        need(pin_of(pin['file'], data) == pin, f'Hash/bytes mismatch: {pin["file"]}')
        return data

    def obj(self, row):
        return json.loads(self.pinned(row))

    def member(self, root, row):
        path = str(root / relative(row['file']))
        return self.pinned({**row, 'file': path})

    def recheck(self):
        for path, pin in list(self.pins.items()):
            need(pin_of(path, absolute(path).read_bytes()) == pin, f'Input changed: {path}')


def exact_inventory(root, rows, inputs):
    need(isinstance(rows, list) and rows, 'Nonempty manifest required')
    names = [relative(row['file']) for row in rows]
    need(len(set(names)) == len(names), 'Duplicate manifest member')
    actual = []
    for p in root.rglob('*'):
        need(not p.is_symlink(), 'Manifest tree symlink forbidden')
        if p.is_file():
            actual.append(p.relative_to(root).as_posix())
        else:
            need(p.is_dir(), 'Only regular files/directories allowed')
    need(sorted(names) == sorted(actual), 'Exact failed-attempt membership required')
    for row in rows:
        inputs.member(root, row)


def stage_continuation(facts, root, summary, chain, tools, inputs):
    proof_pin = normalized_pin(facts['staged_continuation'])
    need(proof_pin['file'] == str(root / 'continuation-verification.json'),
         'Exact staged continuation proof required')
    proof = inputs.obj(proof_pin)
    raw = inputs.read(str(root / 'continuation.json'))
    continuation = json.loads(raw)
    expected = dict(kind=KIND, state='complete', revision=SOURCE, version=VERSION,
                    uninterrupted=False, original_attempt_pass=False,
                    original_summary_sha256s=FAILED_SUMMARY_SHAS,
                    chain_manifest_sha256=CHAIN_SHA, continuation_sha256=sha(raw),
                    imported_gate_count=6, fresh_gate_count=27, logical_gate_count=33,
                    actual_attempt_count=3, previous_failed_gate_attempts=2)
    expected['pass'] = True
    need(proof == expected, 'Exact complete two-predecessor continuation proof required')
    for key in ('uninterrupted', 'original_attempt_pass', 'imported_gate_count', 'fresh_gate_count'):
        need(summary.get(key) == expected[key], f'Continuation summary mismatch: {key}')
    need(summary.get('previous_failed_attempt_count') == 2, 'Both prior failures must remain explicit')
    need(summary.get('continuation') == continuation and
         summary.get('continuation_sha256') == sha(raw), 'Summary must bind exact continuation')
    attempts = [{k: v for k, v in attempt.items() if k != 'files'}
                for attempt in chain['original_attempts']]
    need([a['label'] for a in attempts] == ['v1', 'v2'] and
         [a['summary_sha256'] for a in attempts] == FAILED_SUMMARY_SHAS,
         'Exact two failed predecessors required')
    for key, value in dict(kind=KIND, revision=SOURCE, version=VERSION, prefix_count=6,
                           required_fresh_suffix_count=27, original_attempt_pass=False,
                           uninterrupted=False, original_attempts=attempts,
                           chain_manifest_sha256=CHAIN_SHA, rent_startup_wait_ms=20000).items():
        need(continuation.get(key) == value, f'Continuation mismatch: {key}')
    need(continuation.get('pass') is True, 'Continuation preparation failed')
    prior = {}
    for attempt in chain['original_attempts']:
        label = attempt['label']
        need(attempt['pass'] is False, 'Prior attempted suite cannot be relabelled passing')
        original_root = absolute(attempt['root'], directory=True)
        copied_root = absolute(str(root / ('prior-failed-attempt-' + label)), directory=True)
        exact_inventory(original_root, attempt['files'], inputs)
        exact_inventory(copied_root, attempt['files'], inputs)
        old_raw = inputs.read(str(copied_root / 'summary.json'))
        old = json.loads(old_raw)
        need(sha(old_raw) == attempt['summary_sha256'], 'Original failed summary altered')
        need(old.get('pass') is False and old['exit_code'] == 1 and
             old['last_step'] == attempt['failed_gate'], 'Original attempt must remain failed')
        old_steps = [json.loads(line) for line in inputs.read(str(copied_root / 'steps.jsonl')).decode().strip().splitlines()]
        need(old['steps'] == old_steps, 'Failed predecessor steps differ from summary')
        prior[label] = dict(attempt=attempt, root=copied_root, summary=old, steps=old_steps)
    v1, v2 = prior['v1'], prior['v2']
    need(len(v1['steps']) == 6 and len(v2['steps']) == 7 and
         all(s['pass'] is True and s['exit_code'] == 0 for s in v1['steps'][:5]) and
         all(s['pass'] is True and s['exit_code'] == 0 for s in v2['steps'][:6]) and
         v1['steps'][5]['pass'] is False and v2['steps'][6]['pass'] is False,
         'Predecessor success/failure pattern changed')
    exact_inventory(v2['root'] / 'prior-failed-attempt', v1['attempt']['files'], inputs)
    need(continuation['predecessor_failure_finished_at'] == v2['summary']['finished_at'],
         'Second failure clock mismatch')
    prepared = instant(continuation['prepared_at'])
    need(instant(v1['summary']['finished_at']) <= instant(v2['summary']['finished_at']) <= prepared,
         'Continuation precedes failed predecessors')
    copied_expected = []
    for index in range(6):
        item = v2 if index == 5 else v1
        name = 'logs/' + item['steps'][index]['step'] + '.log'
        row = next(x for x in item['attempt']['files'] if x['file'] == name)
        copied_expected.append({**row, 'source_attempt': item['attempt']['label'], 'source_file': name})
    for name, label in [('staged-us-cpu.json', 'v1'), ('staged-legacy-cpu.json', 'v1'),
                        ('staged-added-source-cpu.json', 'v1'), ('staged-claimant-cpu.json', 'v2')]:
        row = next(x for x in prior[label]['attempt']['files'] if x['file'] == name)
        copied_expected.append({**row, 'source_attempt': label, 'source_file': name})
    need(continuation['copied_prefix_files'] == copied_expected,
         'Exact five-v1/one-v2 imported files required')
    need([row['file'] for row in continuation['v3_preflight_files']] ==
         ['logs/continuation-v3-preflight.log', 'logs/continuation-v3-scope.log'],
         'Exact v3 preflight files required')
    for row in continuation['copied_prefix_files'] + continuation['v3_preflight_files']:
        inputs.member(root, row)
    preflight = json.loads(inputs.read(str(root / 'logs/continuation-v3-preflight.log')))
    need(preflight.get('pass') is True and preflight.get('bundle') == inputs.obj(tools['runner_manifest']),
         'Preflight must bind exact v3 runner manifest')
    steps = [json.loads(line) for line in inputs.read(str(root / 'steps.jsonl')).decode().strip().splitlines()]
    need(steps == summary['steps'], 'Summary and actual step log differ')
    for index in range(6):
        item = v2 if index == 5 else v1
        attempt = item['attempt']
        origin = dict(kind='imported_chain_gate', continuation_id=KIND,
                      source_attempt=attempt['label'], original_attempt_pass=False,
                      original_summary_sha256=attempt['summary_sha256'],
                      original_steps_sha256=next(x['sha256'] for x in attempt['files'] if x['file'] == 'steps.jsonl'),
                      original_step_index=index)
        need(steps[index] == {**item['steps'][index], 'provenance': origin},
             'Imported gate differs from exact predecessor success')
    for step in steps[6:]:
        need(step.get('provenance') == dict(kind='fresh_continuation_gate', continuation_id=KIND),
             'Fresh suffix provenance required')
        need(instant(step['finished_at']) >= prepared, 'Suffix gate precedes continuation')
    derivative = inputs.obj(tools['rent_harness_derivation'])
    original = inputs.pinned(derivative['original'])
    need(derivative['original']['file'] == '/workspace/morning-rows-aemo-followup/scripts/verify-rent-source-cpu.mjs',
         'Original rent evaluator/source harness changed')
    harness = inputs.pinned(tools['rent_harness'])
    need(derivative['derivative']['sha256'] == sha(harness) and
         derivative['derivative']['bytes'] == len(harness) and
         derivative['startup_wait_ms'] == 20000 and derivative['cpu_limit_ms'] == 500 and
         derivative['health_correlation_deadline_ms'] == 10000 and derivative['retries'] == 0 and
         derivative['candidate_health_requests'] == 1, 'Bounded startup derivative changed')
    restored = harness.decode()
    need(len(derivative['exact_replacements']) == 5, 'Exact five startup/relocation changes required')
    for row in reversed(derivative['exact_replacements']):
        need(restored.count(row['derivative']) == 1, 'Ambiguous derivative replacement')
        restored = restored.replace(row['derivative'], row['original'])
    need(restored.encode() == original, 'Runtime rent evaluator or other harness logic changed')
    rent = json.loads(inputs.read(str(root / 'staged-rent-cpu.json')))
    need(rent.get('budget_pass') is True and not rent.get('error') and
         rent.get('version') == VERSION and rent.get('expected_source_revision') == SOURCE and
         rent.get('startup_wait_ms') == 20000 and rent.get('cpu_limit_ms') == 500,
         'Exact fresh passing rent capture with bounded startup required')
    need(instant(rent['started_at']) >= prepared, 'Fresh rent capture predates continuation')
    targets = [x for x in rent['checks'] if x.get('override')]
    need([x['path'] for x in targets] == ['/health.json', '/new-zealand.json?source=market_rent'],
         'Only one candidate health and one rent request allowed')
    before = [x for x in rent['checks'] if not x.get('override') and x.get('phase') == 'before']
    need(len(before) == 2 and instant(targets[0]['started_at']) >=
         max(instant(x['at']) for x in before) + dt.timedelta(milliseconds=20000),
         'Observed startup allowance missing before only candidate health request')
    need(rent['deployment_before']['id'] == rent['deployment_after']['id'] == chain['staging_deployment_id'],
         'Zero-percent candidate deployment changed across continuation')
    return proof, prepared


def assemble(facts_file, toolchain_file, output_file):
    inputs = Inputs()
    facts = json.loads(inputs.read(facts_file))
    need(facts.get('schema_version') == 1 and facts.get('kind') == 'actual-cqc-continuation-v3-facts',
         'Explicit actual-facts schema required')
    allowed_facts = {'schema_version', 'kind', 'identity', 'base_config', 'toolchain', 'toolchain_review',
                     'source_ci', 'staged_summary', 'production_summary', 'staged_continuation',
                     'deployments', 'latest_runs', 'latest_runs_checked_at', 'deployment_id',
                     'promoted_at', 'accepted_at', 'additional_retained_attempts', 'supplemental_inputs'}
    need(set(facts) <= allowed_facts, 'Unknown facts fields refused')
    need(facts.get('identity') == IDENTITY, 'Immutable source identity changed')
    base_pin = normalized_pin(facts['base_config'])
    need(base_pin['file'] == BASE_FILE and base_pin['sha256'] == BASE_SHA, 'Exact v3 failed-v2 inert base required')
    base = inputs.obj(base_pin)
    need(base['template_only'] is True and base['retained_attempt_inventory_incomplete'] is True,
         'Original inert flags altered')
    need({key: base[key] for key in IDENTITY} == IDENTITY, 'Base identity changed')
    repo = absolute(base['repo'], directory=True)
    need(len(base['retained_attempts']) == 119, 'Original119 retained files required')
    for row in base['retained_attempts']:
        inputs.pinned(row)
        need(row.get('accepted') is False and row.get('classification'), 'Retained outcomes altered')
    inventory_raw = inputs.read(base['source_inventory_file'])
    need(sha(inventory_raw) == base['source_inventory_sha256'], 'Source inventory changed')
    inventory = json.loads(inventory_raw)
    need(inventory['source_revision'] == SOURCE and inventory['source_tree'] == TREE and
         inventory['file_count'] == len(inventory['files']) == 593, 'Exact source inventory required')
    for row in inventory['files']:
        inputs.member(repo, {**row, 'file': row['path']})
    audit = inputs.obj(inventory['audit'])
    inputs.pinned(inventory['audit_config'])
    need(audit.get('pass') is True and audit.get('commit') == SOURCE and audit.get('tree') == TREE,
         'Committed-tree audit failed or substituted')
    tc_pin = normalized_pin(facts['toolchain'])
    need(tc_pin['file'] == toolchain_file, 'CLI toolchain and pinned facts differ')
    tc = inputs.obj(tc_pin)
    need(tc.get('revision') == 3 and tc.get('scope') == SCOPE, 'Reviewed revision3 required')
    need(tc.get('actual_release_accepted') is False, 'Toolchain is preparation evidence only')
    tools = tc['files']
    need(all(key in tools for key in REQUIRED_TOOLS), 'Missing explicit reviewed tool binding')
    for row in tools.values():
        inputs.pinned(row)
    need(normalized_pin(tools['assembler']) == pin_of(__file__, inputs.read(__file__)),
         'Assembler is not the reviewed version')
    review_pin = normalized_pin(facts['toolchain_review'])
    need(review_pin == normalized_pin(tools['review']), 'Tool review binding mismatch')
    review = inputs.obj(review_pin)
    need(review.get('pass') is True and review.get('proposal_only') is True,
         'Independent passing proposal-tool review required')
    reviewed = review['reviewed_files']
    need(isinstance(reviewed, dict), 'Explicit reviewed_files map required')
    for row in reviewed.values():
        inputs.pinned(row)
    for key, row in tools.items():
        if key != 'review':
            need(key in reviewed and normalized_pin(reviewed[key]) == normalized_pin(row),
                 'Tool omitted from independent review: ' + key)
    manifest = inputs.obj(tools['runner_manifest'])
    need(manifest.get('revision') == 3, 'Runner manifest revision mismatch')
    bundle_root = Path(tools['runner_manifest']['file']).parent
    members = {relative(row['file']): row for row in manifest['files']}
    need(len(members) == len(manifest['files']), 'Duplicate runner manifest member')
    for row in manifest['files']:
        inputs.member(bundle_root, row)
    for key, name in [('runner', 'validate-release.sh'), ('gap_support', 'gap-support.mjs'),
                      ('continuation', 'continuation.mjs'), ('chain_manifest', 'chain-manifest.json'),
                      ('rent_harness', 'verify-rent-source-cpu-startup.mjs'),
                      ('rent_harness_derivation', 'rent-harness-derivation.json'),
                      ('step_plan', 'step-plan.json')]:
        need(normalized_pin(tools[key]) == normalized_pin({**members[name], 'file': str(bundle_root / name)}),
             'Toolchain and runner manifest differ: ' + key)
    prefix = inputs.obj(tools['chain_manifest'])
    need(tools['chain_manifest']['sha256'] == CHAIN_SHA, 'Exact reviewed failed chain required')
    plan = inputs.obj(tools['step_plan'])
    need(plan.get('scope') == SCOPE and plan.get('source_obligations_if_accepted') == 120 and
         plan.get('public_probes') == 24 and plan.get('exact_approvals_if_accepted') == 25,
         'Scope or acceptance count changed')
    promoted, accepted = instant(facts['promoted_at']), instant(facts['accepted_at'])
    need(promoted <= accepted, 'Acceptance precedes promotion')
    ci = inputs.obj(facts['source_ci'])
    need(ci.get('id') == 39477874197 and ci.get('head_sha') == SOURCE and
         ci.get('status') == 'completed' and ci.get('conclusion') == 'success' and
         ci.get('path') == '.github/workflows/check.yml' and ci.get('event') == 'pull_request',
         'Exact successful source CI required')
    need(instant(ci['updated_at']) <= promoted, 'Promotion precedes completed source CI')
    deployments = inputs.obj(facts['deployments'])
    need(isinstance(deployments, list) and deployments, 'Actual deployment list required')
    ordered = sorted(deployments, key=lambda d: instant(d['created_on']), reverse=True)
    deployment = ordered[0]
    need(deployment['id'] == facts['deployment_id'] and deployment['created_on'] == facts['promoted_at'],
         'Selected deployment is not exact latest promotion')
    need([row for row in deployment['versions'] if row['percentage'] > 0] ==
         [dict(version_id=VERSION, percentage=100)], 'Exact 100% promoted Worker required')
    phase_roots = {}
    for phase in ('staged', 'production'):
        summary_pin = normalized_pin(facts[phase + '_summary'])
        root = absolute(str(Path(summary_pin['file']).parent), directory=True)
        need(summary_pin['file'] == str(root / 'summary.json'), 'Exact summary filename required')
        need(not root.is_relative_to(repo), 'Evidence root must remain outside repository')
        summary = inputs.obj(summary_pin)
        need(summary.get('pass') is True and summary.get('phase') == phase and
             summary.get('revision') == SOURCE and summary.get('version') == VERSION and
             summary.get('exit_code') == 0 and summary.get('last_step') == 'complete' and
             summary.get('semantic_exceptions_allowed') is False, 'Complete exact-identity phase required')
        need(summary.get('runner_sha256') == tools['runner']['sha256'] and
             summary.get('tool_bundle_manifest_sha256') == tools['runner_manifest']['sha256'],
             'Phase used another runner/toolchain')
        need(summary.get('baseline_sha256_before_cpu') == prefix['baseline_sha256'] ==
             sha(inputs.read(str(repo / 'verification/monitoring-baseline.json'))), 'Accepted baseline changed')
        steps = summary['steps']
        need(len(steps) == len(plan['steps'][phase]) == 33 and
             [s['step'] for s in steps] == plan['steps'][phase], 'Every exact gate must appear once in order')
        need(all(s.get('pass') is True and s.get('exit_code') == 0 for s in steps), 'Failed gate retained in phase')
        clocks = [instant(s['finished_at']) for s in steps]
        need(clocks == sorted(clocks), 'Gate completion times out of order')
        need(clocks[-1] <= instant(summary['finished_at']) <= (promoted if phase == 'staged' else accepted),
             'Phase chronology invalid')
        if phase == 'production':
            need(clocks[0] >= promoted, 'Production validation predates promotion')
        rows = summary['files']
        need(len({row['file'] for row in rows}) == len(rows), 'Duplicate summary member')
        for row in rows:
            inputs.member(root, row)
        audit_name = 'release-gate-audit.json'
        need(any(row['file'] == audit_name for row in rows), 'Summary must bind release audit')
        phase_audit = json.loads(inputs.read(str(root / audit_name)))
        need(phase_audit.get('pass') is True and phase_audit.get('phase') == phase and
             phase_audit.get('revision') == SOURCE and phase_audit.get('version') == VERSION and
             phase_audit.get('build_fingerprint') == FINGERPRINT and
             phase_audit.get('semantic_exceptions_allowed') is False and
             phase_audit.get('completed_steps_before_audit') == 32, 'Exact full phase audit required')
        for row in phase_audit['inputs']:
            inputs.member(root, row)
        if phase == 'staged':
            proof, prepared = stage_continuation(facts, root, summary, prefix, tools, inputs)
            need(instant(tc['frozen_at']) <= prepared, 'Continuation predates reviewed tool freeze')
        phase_roots[phase] = root
    need(phase_roots['staged'] != phase_roots['production'], 'Stage and production evidence must be distinct')
    current_runs = inputs.obj(facts['latest_runs'])
    runs = current_runs['workflow_runs']
    monitors = [r for r in runs if r.get('head_branch') == 'main' and r.get('path') == '.github/workflows/monitor.yml']
    need(monitors, 'Main monitor metadata absent; pagination needed')
    monitors.sort(key=lambda r: (r['run_number'], r['run_attempt']), reverse=True)
    expected_monitor = dict(id=39341442350, run_number=10, run_attempt=1, status='completed',
                            conclusion='success', event='schedule',
                            head_sha='9d9d23cd4b343c6d076e1586a366314d733c490e')
    need(all(monitors[0].get(k) == v for k, v in expected_monitor.items()),
         'Newer/changed monitor execution needs independent lineage review')
    need(promoted <= instant(facts['latest_runs_checked_at']) <= accepted,
         'Fresh postpromotion monitor metadata required')
    extras = facts.get('additional_retained_attempts', [])
    for row in extras:
        inputs.pinned(row)
        need(row.get('accepted') is False and row.get('classification'), 'Extra attempts need original outcomes')
    all_attempts = copy.deepcopy(base['retained_attempts']) + copy.deepcopy(extras)
    need(len({row['file'] for row in all_attempts}) == len(all_attempts), 'Duplicate retained attempt path')
    for row in facts.get('supplemental_inputs', []):
        inputs.pinned(row)
        need(row.get('role') == 'read_only_research', 'Supplemental research is not a runtime gate')
    result = copy.deepcopy(base)
    for key in ('deployment_id', 'promoted_at', 'accepted_at', 'latest_runs_checked_at'):
        result[key] = facts[key]
    for key, fact in [('deployments_file', 'deployments'), ('source_ci_file', 'source_ci'),
                      ('latest_runs_file', 'latest_runs')]:
        result[key] = facts[fact]['file']
    result.update(staged_root=str(phase_roots['staged']), production_root=str(phase_roots['production']),
                  reviewed_continuation_revision=3, staged_continuation=copy.deepcopy(facts['staged_continuation']),
                  reviewed_toolchain=copy.deepcopy(facts['toolchain']),
                  reviewed_toolchain_review=copy.deepcopy(facts['toolchain_review']),
                  retained_attempts=all_attempts, template_only=False,
                  retained_attempt_inventory_incomplete=False,
                  instructions='Actual facts assembled for the separately reviewed acceptance helper. '
                  'Both original failed staged attempts are preserved; continuation combines six imported '
                  'successes and 27 fresh gates. This config is not itself release acceptance, a checkpoint '
                  'or a delivery receipt. The acceptance helper must independently recheck all evidence.')
    for prefix_key, tool_key in [('runner', 'runner'), ('tool_bundle_manifest', 'runner_manifest'),
                                 ('gap_support', 'gap_support'), ('replay', 'replay')]:
        result[prefix_key + '_file'] = tools[tool_key]['file']
        result[prefix_key + '_sha256'] = tools[tool_key]['sha256']
    result['continuation_preparation'] = {**result['continuation_preparation'],
        'reviewed_revision': 3, 'prepared_or_executed': True,
        'interpretation': 'Complete staged continuation supplied and byte-bound; separate acceptance helper still required.'}
    result['config_assembly'] = dict(kind='Pinned actual-facts assembly only', release_accepted=False,
        checkpoint_written=False, receipt_created=False, source_identity=IDENTITY,
        facts=inputs.pins[facts_file], reviewed_toolchain=tc_pin,
        inputs=sorted(inputs.pins.values(), key=lambda x: x['file']))
    output = Path(output_file)
    need(output.is_absolute() and str(output) == output_file and '..' not in output.parts,
         'Canonical absolute new output path required')
    parent = absolute(str(output.parent), directory=True)
    need(not output.exists() and not output.is_symlink(), 'Output must be new')
    need(not output.is_relative_to(repo) and all(not output.is_relative_to(root) for root in phase_roots.values()),
         'Output cannot mutate repository or actual evidence roots')
    need(str(output) not in inputs.pins, 'Output cannot overwrite an input')
    payload = (json.dumps(result, indent=2, ensure_ascii=False) + '\n').encode()
    inputs.recheck()
    fd, tmp = tempfile.mkstemp(prefix='.assemble-cqc-', dir=parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        inputs.recheck()
        os.link(tmp, output)  # Atomic exclusive creation, never replace existing output.
    finally:
        os.unlink(tmp)
    return dict(config=pin_of(output, payload), release_accepted=False,
                staged_logical_gates=33, staged_imported_gates=6, staged_fresh_gates=27,
                production_gates=33, retained_file_count=len(all_attempts))


def main():
    need(len(sys.argv) == 4, __doc__.splitlines()[2])
    print(json.dumps(assemble(*sys.argv[1:]), indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError) as exc:
        print('REFUSED: ' + str(exc), file=sys.stderr)
        sys.exit(1)
