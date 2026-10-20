#!/usr/bin/env python3
"""Offline final-document/package-plan proposal. No repository or remote writes.

A completed CQC-only acceptance-helper proposal and held-AEMO proof are
required. This tool formats already verified evidence; it is not an independent
release oracle. It never applies its proposals or runs the packager.
"""
import argparse, datetime as dt, hashlib, importlib.util, json, pathlib, re, sys, tempfile, shutil, os

SCOPE = 'nine-desks-plus-ni-electricity-and-cqc'
UNRESOLVED = sorted(['CORR_FIS_005','INC_INC_001','INC_INC_011','JUS_FIS_001','LEED_AP1_001','LEED_AP1_002','POPPR_FHH_003','POPPR_LAB_003'])
NI = {'source_revision':'8a25fb62bad7096421ac17f6974b3aa421fe37c3','worker_version':'34d6966c-0c3f-40dd-8b61-b4a696b09b89','build_fingerprint':'6a29c7f49e8e2ef3','source_dirty':False}
ROOT = pathlib.Path(__file__).resolve().parent

def need(x, msg):
    if not x: raise ValueError(msg)
def sha(data): return hashlib.sha256(data).hexdigest()
def encode(x): return (json.dumps(x, indent=2, sort_keys=True, ensure_ascii=False)+'\n').encode()
def path(x):
    need(isinstance(x,str) and pathlib.Path(x).is_absolute(), 'Explicit absolute path required')
    p=pathlib.Path(x); need(not p.is_symlink(), 'Symlink input refused'); return p.resolve()
def raw(p):
    p=path(str(p)); need(p.is_file(), 'Missing regular input: '+str(p)); return p.read_bytes()
def load(p): return json.loads(raw(p))
def utc(s):
    need(isinstance(s,str) and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)',s), 'Explicit UTC time required')
    return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
def rel(s):
    need(isinstance(s,str) and s and not s.startswith('/') and '\\' not in s and all(a not in ('','.','..') for a in s.split('/')), 'Unsafe relative path'); return s

def manifest(root, file_name='manifest.json', input_root=None):
    root=path(str(root)); m=load(root/file_name); base=path(str(input_root)) if input_root is not None else root
    if 'files' not in m:
        need(m.get('schema_version')==1 and isinstance(m.get('reference'),dict) and isinstance(m.get('input_files'),list) and isinstance(m.get('checkers'),dict), 'Unrecognized explicit dated oracle manifest schema')
        need(isinstance(m.get('auxiliary',[]),list), 'Dated oracle auxiliary inventory must be explicit list')
        m={**m,'files':[m['reference'],*m['input_files'],*m['checkers'].values(),*m.get('auxiliary',[])]}
    need(isinstance(m.get('files'),list) and m['files'], 'Empty evidence manifest')
    for e in m['files']:
        b=raw(base/rel(e.get('file',e.get('path'))))
        need(sha(b)==e['sha256'] and len(b)==e['bytes'], 'Evidence manifest binding mismatch')
    return m

def bound_file(spec):
    p=path(spec['file']); b=raw(p)
    need(sha(b)==spec['sha256'], 'Explicit reference hash mismatch: '+str(p))
    return p,json.loads(b)

def snapshot_inputs(prep):
    need(isinstance(prep.get('inputs'),list) and prep['inputs'], 'Acceptance input inventory required')
    for e in prep['inputs']:
        b=raw(e['file']); need(len(b)==e['bytes'] and sha(b)==e['sha256'], 'Acceptance input changed: '+e['file'])

def make_template():
    return {'schema_version':1,'production_acceptance_confirmed':False,
        'repository':'/workspace/morning-rows-aemo-followup',
        'proposal_directory':None,'acceptance_config_file':None,
        'package_root':'verification/gap-followup-2026-10-20/cqc-only-release',
        'recorded_at':None,
        'held_evidence':{'stats':'/tmp/mr-remaining-stats-evidence','access':'/tmp/mr-held-access-final-review','aemo':'/tmp/mr-aemo-next-day'},
        'failed_attempt_roots':[],
        'auxiliary_files':[],
        'instructions':'Populate only from actual accepted proof. Blank fields and false confirmation cannot generate accepted prose. List every new failed/incomplete attempt explicitly; historical repository evidence is preserved.'}

def prepare(c, output):
    need(c.get('schema_version')==1 and c.get('production_acceptance_confirmed') is True, 'Actual production acceptance confirmation required; inert template refused')
    repo=path(c['repository']); output=path(str(output))
    need(not output.is_relative_to(repo) and not output.exists(), 'New output must remain outside repository')
    proposal=path(c['proposal_directory']); cfgfile=path(c['acceptance_config_file']); ac=load(cfgfile)
    need(path(ac['repo'])==repo, 'Acceptance configuration repository mismatch')
    p=load(proposal/'preparation.json'); a=load(proposal/'release-acceptance.json')
    need(p.get('pass') is True and p.get('proposal_only') is True and p.get('active_files_written') is False and p.get('checkpoint_written') is False and p.get('actual_scheduled_cycles_added')==0, 'Passing proposal-only preparation required')
    need(p['config_sha256']==sha(raw(cfgfile)), 'Acceptance configuration binding mismatch')
    snapshot_inputs(p)
    prepared_inputs={str(path(e['file'])):e for e in p['inputs']}
    need(len(prepared_inputs)==len(p['inputs']), 'Duplicate acceptance input inventory')
    need(a.get('release_accepted') is True and a.get('deployed') is True and a.get('phase')=='released_awaiting_scheduled_observation', 'Actual implementation acceptance required')
    need(a.get('scope')==SCOPE and p['scope']==SCOPE and ac['scope']==SCOPE, 'Only reviewed CQC-only eighth-edge scope supported')
    identity=a['identity']; need(identity=={'source_revision':ac['source_revision'],'worker_version':ac['version'],'build_fingerprint':ac['fingerprint'],'source_dirty':False}, 'Exact clean identity mismatch')
    need(a['rollback_identity']==NI, 'Accepted NI rollback must remain exact')
    proposed_acceptance=load(proposal/'acceptance.json'); proposed_baseline=load(proposal/'baseline.json')
    need(proposed_acceptance.get('aemo_cqc_release')==a and proposed_baseline.get('aemo_cqc_release')==a and proposed_acceptance.get('complete') is False, 'Proposed ledgers must carry the same incomplete-operational-acceptance record')
    prior_review=load(proposal/'prior-review.json'); next_review=load(proposal/'review.json')
    need(len(prior_review['continuations'])==6 and len(next_review['continuations'])==7, 'Exact seventh-to-eighth review increment required')
    restored_review={**next_review,'continuations':next_review['continuations'][:-1]}
    need(restored_review==prior_review, 'Existing exact reviewed prefix changed')
    edge=next_review['continuations'][-1]
    need(edge['from']==NI and edge['to']==identity and edge['scope']==SCOPE and edge['evidence']==a['evidence'], 'Exact accepted eighth edge mismatch')
    prior_approvals=load(proposal/'prior-approvals.json'); next_approvals=load(proposal/'approvals.json')
    need(len(prior_approvals)==24 and len(next_approvals)==25 and all(next_approvals.get(k)==v for k,v in prior_approvals.items()), 'Prior exact observation approvals changed')
    need(set(next_approvals)-set(prior_approvals)=={'england/care_assessment_cohort'}, 'Only the one reviewed CQC source approval may be added')
    for source in ['england/care_assessment_cohort']:
        versions=set(a['capture_proofs'][source]['versions'].values())
        need(len(versions)==1 and next_approvals[source]['version'] in versions and next_approvals[source]['reviewed_at']==a['accepted_at'], 'Approval must bind both actual source versions and acceptance time')
    need(len(load(proposal/'registry.json')['sources'])==120, 'Actual proposed cumulative registry must contain 120 obligations')
    need(a['accepted_at']==p['accepted_at']==ac['accepted_at'] and a['promoted_at']==ac['promoted_at'] and a['deployment_id']==ac['deployment_id'], 'Actual promotion/acceptance binding mismatch')
    need(utc(a['promoted_at'])<=utc(a['accepted_at'])<=utc(c['recorded_at'])<=dt.datetime.now(dt.timezone.utc), 'Actual ordered timestamps required')
    expected={'reviewed_edges':8,'source_obligations':120,'public_probes':24,'exact_approvals':25,'actual_checkpoint_sequence':5,'actual_legacy_scheduled_cycles':2,'new_scope_actual_scheduled_cycles':0,'new_scope_started_at':None,'checkpoint_written':False,'source_alerts_enabled':False,'delivery_receipt_exists':False}
    need(a['monitoring']==expected, 'Checkpoint, schedule, delivery or count boundary changed; separate review required')
    v=a['validation']; continuation=v.get('staged_continuation'); need(isinstance(continuation,dict) and continuation.get('verified') is True and continuation.get('kind')=='cqc-r2-rent-readiness-continuation-v3' and continuation.get('actual_attempt_count')==3 and continuation.get('rent_startup_wait_ms')==20000 and continuation.get('imported_prefix_steps')==6 and continuation.get('fresh_suffix_steps')==27 and continuation.get('original_attempt_pass') is False and continuation.get('prior_continuation_pass') is False and continuation.get('original_failure')=='tail_not_ready' and continuation.get('prior_continuation_failure')=='tail_not_ready', 'Exact reviewed six-plus-twenty-seven staged continuation proof required')
    need(v['staged_steps']==33 and v['production_steps']==33, 'All33 reviewed gates required in each phase')
    need(v['stats_nz_dated_numeric_references']==15 and sorted(v['stats_nz_unresolved_ids'])==UNRESOLVED, 'Stats NZ evidence boundary changed')
    need(sorted(a['capture_proofs'])==['england/care_assessment_cohort'], 'Wrong accepted source set')
    need(all(a['capture_proofs'][s]['proof'].get('pass') is True for s in a['capture_proofs']), 'Passing actual capture proofs required')
    replay=load(proposal/'monitor-transition-replay.json')
    need(replay.get('pass') is True and replay.get('constructed') is True and replay.get('run_scheduled') is False and replay.get('actual_checkpoint_sequence_unchanged')==5 and replay.get('actual_scheduled_cycles_added')==0, 'Constructed preservation proof required; never scheduled acceptance')
    need(a.get('task_id')=='cqc-only-eighth-edge-2026-10-20','Only the separately reviewed CQC-only acceptance is allowed')
    held_proof=v.get('held_aemo_refusal');need(isinstance(held_proof,dict) and held_proof['staged'].get('pass') is True and held_proof['production'].get('pass') is True,'Actual held-AEMO discovery/refusal proof required')
    aemo_root=path(c['held_evidence']['aemo']); acquisition=load(aemo_root/'original/acquisition.json')
    need(acquisition.get('pass') is False and acquisition.get('calendar_day')=='2026-10-20' and len(acquisition.get('requests',[]))==1 and acquisition.get('bundles')==[] and acquisition.get('monthly')==[], 'Actual failed single-index AEMO publication evidence must remain failed')
    request=acquisition['requests'][0];need(request['url']=='https://nemweb.com.au/Reports/CURRENT/Public_Prices/' and request['status']==200,'Original bounded directory response required')
    original=raw(aemo_root/rel(request['file']));need(len(original)==request['bytes'] and sha(original)==request['sha256'],'Original unsuccessful-publication index binding changed')
    # Full telemetry-bearing index is verification input only. Retain only the
    # independently frozen twelve-member minimal failure inventory and manifest.
    failure_name='evidence/failure-manifest.json';failure_bytes=raw(aemo_root/failure_name)
    need(sha(failure_bytes)=='021935d2448feb5cf9eb8580b49ef0716d21a889398d6d44ac38cb8a76554cff','Frozen minimal failed-publication inventory changed')
    failure_manifest=manifest(aemo_root,'evidence/failure-manifest.json')
    need(failure_manifest.get('accepted') is False and failure_manifest.get('request_count')==1 and failure_manifest.get('zip_request_count')==0 and failure_manifest.get('monthly_request_count')==0 and failure_manifest.get('retry_count')==0 and len(failure_manifest['files'])==12,'Original unsuccessful publication boundary changed')
    failure_members=[row['file'] for row in failure_manifest['files']]+[failure_name]
    need(request['file'] not in failure_members and not any('__pycache__' in f for f in failure_members),'Full wire and interpreter cache must not be packaged')
    spec=importlib.util.spec_from_file_location('package_evidence',ROOT/'package-evidence.py'); pack=importlib.util.module_from_spec(spec); spec.loader.exec_module(pack)
    staged=path(ac['staged_root']); production=path(ac['production_root'])
    for phase,root in [('staged',staged),('production',production)]:
        summary=pack.check_summary(raw(root/'summary.json'),root,True,identity['source_revision'],identity['worker_version'])
        need(summary['phase']==phase and len(summary['steps'])==v[phase+'_steps'], 'Accepted summary phase/count mismatch')
    stats_root=path(c['held_evidence']['stats']); access_root=path(c['held_evidence']['access']); manifest(stats_root); manifest(access_root)
    stats=load(stats_root/'findings.json'); held=load(access_root/'findings.json')
    need(stats['new_numeric_gaps_closed']==0 and stats['prior_dated_comparisons_preserved']==15 and stats['remaining']==8 and sorted(r['id'] for r in stats['rows'])==UNRESOLVED, 'Bounded Stats research does not change acceptance')
    need(held['new_qualifying_original_specimens']==0 and held['status']=='bounded_review_complete_both_contracts_still_held', 'ONS/AER bounded review must remain held')
    roots=[{'source':str(staged),'destination':'staged','role':'accepted_stage','summary':'summary.json','expected_pass':True},{'source':str(production),'destination':'production','role':'accepted_production','summary':'summary.json','expected_pass':True},{'source':str(stats_root),'destination':'remaining-stats-evidence','role':'held_evidence'},{'source':str(access_root),'destination':'held-access-review','role':'held_evidence'}]
    need(isinstance(c['failed_attempt_roots'],list),'Explicit failed/incomplete attempt roots required')
    for f in c['failed_attempt_roots']:
        need(f.get('role')=='failed_attempt', 'Historical failed attempts must retain failed role')
        roots.append(f)
    files=[{'source':str(proposal/f.name),'destination':'acceptance/'+f.name,'role':'accepted_release_proposal','transform':'exact'} for f in sorted(proposal.iterdir()) if f.is_file()]
    need(any(f['destination']=='acceptance/release-acceptance.json' for f in files), 'Release acceptance record missing')
    files += [{'source':str(aemo_root/name),'destination':'held-aemo-publication/'+name,'role':'held_evidence','transform':'exact'} for name in failure_members]
    files += [{'source':str(path(ac['source_ci_file'])),'destination':'source/ci.json','role':'source_ci','transform':'github_run'},{'source':str(path(ac['deployments_file'])),'destination':'deployment/deployments-after.json','role':'deployment_confirmation','transform':'deployments'},{'source':str(ROOT/'package-evidence.py'),'destination':'tools/package-evidence.py','role':'immutable_packaging_tool','transform':'exact'},{'source':str(path(__file__)),'destination':'tools/prepare-final-evidence.py','role':'proposal_generator','transform':'exact'}]
    files.append({'source':str(cfgfile),'destination':'acceptance/acceptance-helper-config.json','role':'acceptance_configuration','transform':'exact'})
    need(isinstance(c['auxiliary_files'],list), 'Explicit auxiliary file list required'); files+=c['auxiliary_files']
    # Every actual unaccepted attempt explicitly retained by the acceptance helper
    # must also be retained by the package plan, directly or inside a failed root.
    for attempt in a['proof_bindings']['retained_unaccepted_attempts']:
        original=path(attempt['file']); need(sha(raw(original))==attempt['sha256'] and attempt['accepted'] is False, 'Historical unaccepted attempt binding failed')
        need(any(path(f['source'])==original for f in files) or any(original.is_relative_to(path(r['source'])) for r in roots if r['role']=='failed_attempt'), 'Unaccepted attempt omitted from package plan: '+str(original))
    package_root=rel(c['package_root'])
    plan={'schema_version':1,'recorded_at':c['recorded_at'],'source_revision':identity['source_revision'],'worker_version':identity['worker_version'],'build_fingerprint':identity['build_fingerprint'],'repository':str(repo),'package_root':package_root,'production_gate':str(production/'summary.json'),'production_acceptance_confirmed':True,'roots':roots,'files':files}
    for entry in files:
        body=raw(entry['source']);entry['expected_original_bytes']=len(body);entry['expected_original_sha256']=sha(body)
    for entry in roots:
        root=path(entry['source']);need(root.is_dir(),'Original package root missing')
        inventory=[]
        for member in sorted(root.rglob('*')):
            need(not member.is_symlink(),'Original package root contains symlink')
            if member.is_file():
                body=raw(member);inventory.append({'file':str(member.relative_to(root)),'bytes':len(body),'sha256':sha(body)})
        entry['expected_original_files']=inventory
    pack.config_check(plan)
    for file in ['HANDOFF.md','GAP-LEDGER.md','verification/gap-followup-2026-10-20/cqc-only/README.md']: raw(repo/file)  # Never rewrite historical records.
    evidence_link=package_root+'/acceptance/release-acceptance.json'
    cpu=', '.join(k+' '+str(d['max_sampled_cpu_ms'])+' ms' for k,d in v['sampled_cpu'].items())
    common=f'''Both domains are accepted at clean source `{identity['source_revision']}`, Worker `{identity['worker_version']}`, fingerprint `{identity['build_fingerprint']}`. Deployment `{a['deployment_id']}` promoted that exact version to 100% at `{a['promoted_at']}`; acceptance completed `{a['accepted_at']}`. Rollback is accepted NI source `{NI['source_revision']}`, Worker `{NI['worker_version']}`, fingerprint `{NI['build_fingerprint']}`. Evidence/merge revisions are not deployed source. See [accepted evidence]({evidence_link}).

AEMO completed-day remains disconnected. The one authorized original-directory request at 18:06 UTC returned HTTP 200 but did not advertise the required 20 October trading ZIP. No ZIP or monthly data was acquired, no new oracle was emitted, and no older-day fallback was used. Prior 19 October independent proof and the old failed 406 route remain historical evidence. The original five-region `grid` snapshot is preserved. Actual staged and both-domain production captures verify that `grid_day` is absent from discovery/native output and is refused by explicit source selection; this does not certify any completed-day data.

CQC `england/care_assessment_cohort` retains five unique independently extracted historical source-reference cells: Inadequate 125, Requires improvement 809, Good 2,063, Outstanding 65 and Total 3,062. These are ratings for individual adult social-care services at a location in England, published under the single assessment framework as at 1 August 2025 in State of Care 2024/25. The total overlaps the four categories and must not be added to them. CQC prioritised assessment by risk: this is not an all-England service census, a count of unique locations/providers, a representative quality estimate, a comparable trend or current availability. The original PDF, independent same-edition presentations and shared CQC administrative lineage remain explicit. Original workbook refusal and earlier parser/access attempts remain failed evidence.

Actual exact-source CI `{a['proof_bindings']['source_ci']}` passed. Validation passed all {v['staged_steps']} staged gates across six passing gates from the exact two-predecessor chain and a separately reviewed 27-gate continuation, plus {v['production_steps']} production gates. Both predecessor attempts remain failed. The first stopped at claimant trace readiness after five passing gates; the second retained those five, passed the fresh claimant gate at 53 ms, then stopped at rent trace readiness. Each failed capture contains only health checks, with no target desk request or trace event. The six passing gates retain exact original provenance; all remaining 27 gates ran afresh. The external rent harness uses a reviewed 20 s initial tail-startup allowance in place of 4 s. Its retained derivation records the required import relocation and startup metadata; one candidate health request, the 10 s correlation deadline and every CPU, freshness and validation check remain unchanged. The cause of the earlier missing trace events is not claimed as proven. Strict core semantics remain 50 per domain and 15 exact dated Stats NZ references per domain. Sampled CPU: {cpu}; existing USA 100 ms and legacy/claimant/rent 500 ms gates and 1,000 ms Worker ceiling remain. Repeated interface assertions and both-domain comparisons do not increase the number of unique independently extracted source-reference cells. Original failed or interrupted attempts retain their original outcomes.

The exact eighth reviewed edge preserves seven prior edges and all 24 prior approvals; it adds only the accepted exact CQC source version: 25 approvals, 120 obligations and the same 24 public probes. Both-domain constructed replay establishes preservation only. It is not a checkpoint, scheduled collection or delivery receipt.

The durable checkpoint remains sequence 5 / run `39341442350` #10 attempt 1 / artifact `12229261618`, complete `2026-10-19T23:26:10.163Z`, digest `665f9d491c95c54f01a0d168b573300900f2665b614bc214e357d4e7545b132f`: 33 incidents, 36 pending repairs, two actual legacy scheduled cycles and zero expanded-scope observations. Pending delivery event `12b8734c33128602e2ac5398acaea12b9580aaadfc48f218847f91696d086db6` has no receipt. Never repeat the delivery test or infer acknowledgment from build requests or release acceptance. Follow every intervening run, attempt, write and restoration audit; apply only the exact remaining reviewed suffix in the next normal serialized collection.

Original SHADOW start remains `2026-10-18T23:22:22.161Z`; next nominal daily cron `2026-10-20T23:17Z` and complete-checkpoint deadline `2026-10-21T01:26:10.163Z` retain existing allowances. Each expanded scope starts only on its actual complete scheduled observation. Eight actual daily checkpoints, seven elapsed completion days, no gap over 26 hours, independent watchdog proof and genuine delivery evidence remain required. Keep hourly watchdog, daily collector, disabled ordinary source alerts, credentials, infrastructure and disconnected Builds unchanged.

Stats NZ remains **15 of 23**, with eight unresolved exact cells: {', '.join('`'+x+'`' for x in UNRESOLVED)}. The retained bounded search adds zero numerical comparisons; search absence is not proof that an official table does not exist. Income, household, tax-year, adult-person and projection scenario/precision distinctions remain binding. ONS Manchester bedroom rent remains held for actual-reader access, despite its four earlier exact cells; the old concurrent-request error does not identify the failed URL. AER remains held for usable original five-region quarterly data and applicable upstream reuse/attribution binding. No denied-route retries or new permission are inferred from indexed search. NZ-PRICES remains blocked for the exact 17 October Interim specimen, UK CPI remains parked and PHW remains excluded. The broader gap list, sustained operational acceptance and genuine delivery remain incomplete.
'''
    docs={'HANDOFF-prefix.md':'# Current release — CQC historical cohort with AEMO held\n\n'+common+'\n---\n\n', 'GAP-LEDGER-prefix.md':'## Current disposition — CQC historical cohort with AEMO held\n\n'+common+'\n---\n\n', 'release-evidence-proposal.md':'# Accepted CQC-only release evidence\n\n'+common.replace(evidence_link,'acceptance/release-acceptance.json')+'\nThe immutable package manifest records original/retained hashes and path relocations. The exact committed-tree audit must pass for the final evidence tree; a local package is not proof of committed completeness.\n'}
    cqc_append_link=os.path.relpath(evidence_link,'verification/gap-followup-2026-10-20/cqc-only')
    docs['CQC-only-README-append.md']='\n\n## Accepted continuation release\n\nThe later accepted evidence is retained in [the CQC-only release acceptance record]('+cqc_append_link+'). Clean source `'+identity['source_revision']+'`, Worker `'+identity['worker_version']+'`, was accepted at `'+a['accepted_at']+'`. All 33 staged gates are proved across six passing gates from the exact two-predecessor chain plus the reviewed 27-gate continuation; both prior claimant/rent trace-readiness failures remain failed. Five unique independently extracted CQC source-reference cells are verified. Production validation and remaining operational limits are recorded in the linked acceptance package. Earlier evidence remains unchanged.\n'
    # This writes only an outside-repository proposal. There is deliberately no
    # apply, deployment, acknowledgement, Git, checkpoint, or network operation.
    payloads={name:body.encode() for name,body in docs.items()};payloads['package-plan.json']=encode(plan)
    proof={'pass':True,'proposal_only':True,'active_files_written':False,'package_invoked':False,'checkpoint_written':False,'scheduled_cycles_added':0,'receipt_written':False,'accepted_at':a['accepted_at'],'aemo_remains_disconnected':True,'held_aemo_acquisition_sha256':sha(raw(aemo_root/'original/acquisition.json')),'source_identity':identity,'retained_attempts':a['proof_bindings']['retained_unaccepted_attempts'],'historical_document_inputs':[{'file':str(repo/f),'sha256':sha(raw(repo/f))} for f in ['HANDOFF.md','GAP-LEDGER.md','verification/gap-followup-2026-10-20/cqc-only/README.md']],'outputs':[{'file':name,'bytes':len(body),'sha256':sha(body)} for name,body in sorted(payloads.items())]}
    payloads['proposal-proof.json']=encode(proof)
    stage=pathlib.Path(tempfile.mkdtemp(prefix='.final-proposal-incomplete-',dir=output.parent))
    try:
        for name,body in payloads.items(): (stage/name).write_bytes(body)
        snapshot_inputs(p)
        for entry in files:
            body=raw(entry['source']);need(len(body)==entry['expected_original_bytes'] and sha(body)==entry['expected_original_sha256'],'Auxiliary input changed before final proposal')
        for entry in roots:
            root=path(entry['source']); actual={str(f.relative_to(root)) for f in root.rglob('*') if f.is_file()}
            need(actual=={e['file'] for e in entry['expected_original_files']},'Evidence membership changed before final proposal')
            for member in entry['expected_original_files']:
                body=raw(root/member['file']);need(len(body)==member['bytes'] and sha(body)==member['sha256'],'Evidence changed before final proposal')
        need(not output.exists(),'Output appeared while preparing proposal');os.rename(stage,output)
    finally:
        if stage.exists(): shutil.rmtree(stage)
    return {'pass':True,'proposal_only':True,'output':str(output),'package_plan_only':True,'aemo_remains_disconnected':True}

def main():
    ap=argparse.ArgumentParser(description=__doc__); sub=ap.add_subparsers(dest='mode',required=True)
    t=sub.add_parser('template');t.add_argument('output')
    p=sub.add_parser('prepare');p.add_argument('config');p.add_argument('output')
    a=ap.parse_args()
    if a.mode=='template':
        out=path(a.output);need(not out.is_relative_to(path(make_template()['repository'])),'Template output must remain outside repository');need(not out.exists(),'Refusing overwrite');out.write_bytes(encode(make_template())); print(json.dumps({'template_only':True,'accepted_record_emitted':False}));return
    print(json.dumps(prepare(load(a.config),a.output)))
if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,TypeError,OSError,json.JSONDecodeError) as e: print(json.dumps({'pass':False,'error':str(e)}),file=sys.stderr);sys.exit(1)
