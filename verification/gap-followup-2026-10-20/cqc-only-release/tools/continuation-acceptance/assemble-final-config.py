#!/usr/bin/env python3
"""Assemble one explicit, reviewed CQC continuation config; never run validators.

Usage: assemble-final-config.py ACTUAL_FACTS_JSON REVIEWED_V2_TOOLCHAIN_JSON NEW_CONFIG
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

BASE_FILE = '/tmp/mr-combined-final-preparation/cqc-7d7ed892-actual-config/actual-source-config.v4.incomplete-staged.inert.json'
BASE_SHA = 'ca01d297d05f604ddfd2ef2cf47d0d0a4eca174e0855883001630d1507c1a292'
SOURCE = '7d7ed892c469d6f589dabf52283fc31dfef98d8a'
TREE = '3c849466947f893e17c71f7b3e594bad24131b0c'
VERSION = '16e5a892-be54-4381-a9c3-98ae4e47a309'
FINGERPRINT = '56c41341c2b38c38'
SCOPE = 'nine-desks-plus-ni-electricity-and-cqc'
PREFIX_SHA = '5ff163fbd149ce45e5bc199ba52bbfbc92aec13318f9f3429912fefc97b98c56'
FAILED_SUMMARY_SHA = 'f7949781f726a243dd1cc69218d7659fda537bfdd9746c2b8c0a52c302999202'
KIND = 'cqc-r2-tail-readiness-continuation-v2'
IDENTITY = dict(source_revision=SOURCE, source_tree=TREE, version=VERSION,
                fingerprint=FINGERPRINT, scope=SCOPE)
REQUIRED_TOOLS = ('runner', 'runner_manifest', 'gap_support', 'replay',
                  'continuation', 'prefix_manifest', 'step_plan', 'assembler',
                  'acceptance', 'formatter', 'packager', 'continuation_acceptance_guard', 'review')
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


def stage_continuation(facts, root, summary, prefix, tools, inputs):
    proof_pin = normalized_pin(facts['staged_continuation'])
    need(proof_pin['file'] == str(root / 'continuation-verification.json'),
         'Exact staged continuation proof required')
    proof = inputs.obj(proof_pin)
    expected = dict(kind=KIND, pass_=True, state='complete', revision=SOURCE, version=VERSION,
                    uninterrupted=False, original_attempt_pass=False,
                    original_summary_sha256=FAILED_SUMMARY_SHA,
                    prefix_manifest_sha256=PREFIX_SHA, imported_gate_count=5,
                    fresh_gate_count=28, logical_gate_count=33, actual_attempt_count=2,
                    previous_failed_gate_attempts=1)
    expected['pass'] = expected.pop('pass_')
    raw = inputs.read(str(root / 'continuation.json'))
    continuation = json.loads(raw)
    expected['continuation_sha256'] = sha(raw)
    need(proof == expected, 'Exact complete continuation proof required')
    for key in ('uninterrupted', 'original_attempt_pass', 'imported_gate_count', 'fresh_gate_count'):
        need(summary.get(key) == expected[key], f'Continuation summary mismatch: {key}')
    need(summary.get('continuation') == continuation and
         summary.get('continuation_sha256') == sha(raw), 'Summary must bind exact continuation')
    for key, value in dict(kind=KIND, revision=SOURCE, version=VERSION, prefix_count=5,
                           required_fresh_suffix_count=28, original_attempt_pass=False,
                           uninterrupted=False, original_summary_sha256=FAILED_SUMMARY_SHA,
                           prefix_manifest_sha256=PREFIX_SHA,
                           original_failed_gate_requested_claimant_desk=False).items():
        need(continuation.get(key) == value, f'Continuation mismatch: {key}')
    need(continuation.get('pass') is True, 'Continuation preparation failed')
    original_root = absolute(prefix['original_attempt_root'], directory=True)
    copied_root = absolute(str(root / 'prior-failed-attempt'), directory=True)
    exact_inventory(original_root, prefix['files'], inputs)
    exact_inventory(copied_root, prefix['files'], inputs)
    old = json.loads(inputs.read(str(copied_root / 'summary.json')))
    need(sha(inputs.read(str(copied_root / 'summary.json'))) == FAILED_SUMMARY_SHA,
         'Original failed summary altered')
    need(old.get('pass') is False and old['exit_code'] == 1 and
         old['last_step'] == 'claimant-www-cold-cpu', 'Original attempt must remain failed')
    need(continuation['original_failure_finished_at'] == old['finished_at'], 'Original clock mismatch')
    prepared = instant(continuation['prepared_at'])
    need(instant(old['finished_at']) <= prepared, 'Continuation precedes original failure')
    for row in continuation['copied_prefix_files'] + continuation['v2_preflight_files']:
        inputs.member(root, row)
    need(continuation['copied_prefix_files'] == [
        next(row for row in prefix['files'] if row['file'] == name)
        for name in [*['logs/' + s['step'] + '.log' for s in old['steps'][:5]],
                     'staged-us-cpu.json', 'staged-legacy-cpu.json', 'staged-added-source-cpu.json']],
         'Unexpected imported prefix files')
    raw_steps = inputs.read(str(root / 'steps.jsonl')).decode().strip().splitlines()
    steps = [json.loads(line) for line in raw_steps]
    need(steps == summary['steps'], 'Summary and actual step log differ')
    steps_sha = next(row['sha256'] for row in prefix['files'] if row['file'] == 'steps.jsonl')
    for index in range(5):
        origin = dict(kind='imported_original_gate', continuation_id=KIND,
                      original_attempt_pass=False, original_summary_sha256=FAILED_SUMMARY_SHA,
                      original_steps_sha256=steps_sha, original_step_index=index)
        need(steps[index] == {**old['steps'][index], 'provenance': origin},
             'Imported gate provenance differs from exact original')
    for step in steps[5:]:
        need(step.get('provenance') == dict(kind='fresh_continuation_gate', continuation_id=KIND),
             'Fresh suffix provenance required')
        need(instant(step['finished_at']) >= prepared, 'Suffix gate precedes continuation')
    for name in ('staged-claimant-cpu.json', 'staged-rent-cpu.json'):
        result = json.loads(inputs.read(str(root / name)))
        need(result.get('budget_pass') is True and not result.get('error'), 'Fresh CPU evidence failed')
        need(result.get('version') == VERSION and result.get('expected_source_revision') == SOURCE,
             'Fresh CPU identity mismatch')
        need(instant(result['started_at']) >= prepared, 'Fresh CPU capture predates continuation')
    return proof, prepared


def assemble(facts_file, toolchain_file, output_file):
    inputs = Inputs()
    facts = json.loads(inputs.read(facts_file))
    need(facts.get('schema_version') == 1 and facts.get('kind') == 'actual-cqc-continuation-v2-facts',
         'Explicit actual-facts schema required')
    allowed_facts = {'schema_version', 'kind', 'identity', 'base_config', 'toolchain', 'toolchain_review',
                     'source_ci', 'staged_summary', 'production_summary', 'staged_continuation',
                     'deployments', 'latest_runs', 'latest_runs_checked_at', 'deployment_id',
                     'promoted_at', 'accepted_at', 'additional_retained_attempts', 'supplemental_inputs'}
    need(set(facts) <= allowed_facts, 'Unknown facts fields refused')
    need(facts.get('identity') == IDENTITY, 'Immutable source identity changed')
    base_pin = normalized_pin(facts['base_config'])
    need(base_pin['file'] == BASE_FILE and base_pin['sha256'] == BASE_SHA, 'Exact v4 base required')
    base = inputs.obj(base_pin)
    need(base['template_only'] is True and base['retained_attempt_inventory_incomplete'] is True,
         'Original inert flags altered')
    need({key: base[key] for key in IDENTITY} == IDENTITY, 'Base identity changed')
    repo = absolute(base['repo'], directory=True)
    need(len(base['retained_attempts']) == 86, 'Original 86 retained files required')
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
    need(tc.get('revision') == 2 and tc.get('scope') == SCOPE, 'Reviewed revision2 required')
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
    need(manifest.get('revision') == 2, 'Runner manifest revision mismatch')
    bundle_root = Path(tools['runner_manifest']['file']).parent
    members = {relative(row['file']): row for row in manifest['files']}
    need(len(members) == len(manifest['files']), 'Duplicate runner manifest member')
    for row in manifest['files']:
        inputs.member(bundle_root, row)
    for key, name in [('runner', 'validate-release.sh'), ('gap_support', 'gap-support.mjs'),
                      ('continuation', 'continuation.mjs'), ('prefix_manifest', 'prefix-manifest.json'),
                      ('step_plan', 'step-plan.json')]:
        need(normalized_pin(tools[key]) == normalized_pin({**members[name], 'file': str(bundle_root / name)}),
             'Toolchain and runner manifest differ: ' + key)
    prefix = inputs.obj(tools['prefix_manifest'])
    need(tools['prefix_manifest']['sha256'] == PREFIX_SHA, 'Exact reviewed failed prefix required')
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
                  reviewed_continuation_revision=2, staged_continuation=copy.deepcopy(facts['staged_continuation']),
                  reviewed_toolchain=copy.deepcopy(facts['toolchain']),
                  reviewed_toolchain_review=copy.deepcopy(facts['toolchain_review']),
                  retained_attempts=all_attempts, template_only=False,
                  retained_attempt_inventory_incomplete=False,
                  instructions='Actual facts assembled for the separately reviewed acceptance helper. '
                  'The original failed staged attempt is preserved; continuation combines five imported '
                  'successes and 28 fresh gates. This config is not itself release acceptance, a checkpoint '
                  'or a delivery receipt. The acceptance helper must independently recheck all evidence.')
    for prefix_key, tool_key in [('runner', 'runner'), ('tool_bundle_manifest', 'runner_manifest'),
                                 ('gap_support', 'gap_support'), ('replay', 'replay')]:
        result[prefix_key + '_file'] = tools[tool_key]['file']
        result[prefix_key + '_sha256'] = tools[tool_key]['sha256']
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
                staged_logical_gates=33, staged_imported_gates=5, staged_fresh_gates=28,
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
