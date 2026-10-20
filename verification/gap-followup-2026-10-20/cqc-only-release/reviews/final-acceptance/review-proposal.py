#!/usr/bin/env python3
"""Independent offline review of completed proposals; no runtime or network calls."""
import datetime as dt,hashlib,json,sys
from pathlib import Path
BASE=Path('/tmp/mr-dated-release-review/final-acceptance-review')
PRIOR=BASE/'prior'
SOURCE='7d7ed892c469d6f589dabf52283fc31dfef98d8a'
VERSION='16e5a892-be54-4381-a9c3-98ae4e47a309'
CQC='england/care_assessment_cohort'
IDENTITY=dict(source_revision=SOURCE,worker_version=VERSION,build_fingerprint='56c41341c2b38c38',source_dirty=False)
UNRESOLVED=['CORR_FIS_005','INC_INC_001','INC_INC_011','JUS_FIS_001','LEED_AP1_001','LEED_AP1_002','POPPR_FHH_003','POPPR_LAB_003']
def sha(b):return hashlib.sha256(b).hexdigest()
def pin(p):
 p=Path(p); b=p.read_bytes();return dict(file=str(p),bytes=len(b),sha256=sha(b))
def read(p):return json.loads(Path(p).read_bytes())
def require(value,label):
 assert value,label
 checks.append(dict(name=label,pass_=True))
checks=[]
proposal=Path(sys.argv[1]).resolve(); formatted=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else None
prep=read(proposal/'preparation.json'); record=read(proposal/'release-acceptance.json')
require(prep['pass'] is True and prep['proposal_only'] is True and prep['active_files_written'] is False and prep['checkpoint_written'] is False and prep['actual_scheduled_cycles_added']==0,'Completed proposal changes no active files, checkpoint or scheduled count')
for row in prep['inputs']: require(pin(row['file'])==row,'Input immutable: '+row['file'])
oldreview=read(PRIOR/'operations/us-release-review.json'); newreview=read(proposal/'review.json')
require(read(proposal/'prior-review.json')==oldreview,'Exact prior reviewed chain retained')
require({**newreview,'continuations':newreview['continuations'][:-1]}==oldreview and len(newreview['continuations'])==7,'Seven prior edges preserved; exactly eighth edge appended')
oldbaseline=read(PRIOR/'verification/monitoring-baseline.json')
oldidentity={k:oldbaseline['identity'][k] for k in IDENTITY}
edge=newreview['continuations'][-1]
require(edge['from']==oldidentity and edge['to']==IDENTITY and edge['scope']=='nine-desks-plus-ni-electricity-and-cqc','Exact NI to CQC eighth edge')
oldapprovals=read(PRIOR/'operations/approved-observations.json');newapprovals=read(proposal/'approvals.json')
require(len(oldapprovals)==24 and len(newapprovals)==25 and all(newapprovals[k]==v for k,v in oldapprovals.items()) and set(newapprovals)-set(oldapprovals)=={CQC},'24 prior approvals preserved plus only exact CQC approval')
require(set(record['capture_proofs'])=={CQC} and set(record['source_contracts'])=={CQC},'CQC is the only newly approved source')
proof=record['capture_proofs'][CQC]
require(proof['proof']['pass'] is True and set(proof['versions'].values())=={newapprovals[CQC]['version']},'Both-domain exact CQC version matches sole new approval')
oldreg=read(PRIOR/'operations/source-contract-registry.json');newreg=read(proposal/'registry.json')
oldrows={r['key']:r for r in oldreg['sources']};newrows={r['key']:r for r in newreg['sources']}
require(len(oldrows)==119 and len(newrows)==120 and set(newrows)-set(oldrows)=={CQC},'119 old active registry rows plus only CQC gives120 obligations')
require(all(newrows[k]==v for k,v in oldrows.items()),'All119 active prior registry definitions remain exact')
require('australia/grid_day' not in newrows,'Daily AEMO remains disconnected')
cqc_defs=newrows[CQC]['definitions']
require(len(cqc_defs)==5 and all(d['unit']=='ratings' and d['geography']=='England' and d['dimensions']['assessment_unit']=='Individual service at a location' and d['dimensions']['snapshot_date']=='2025-08-01' and 'total overlaps' in d['limitations'] for d in cqc_defs),'All five CQC registry definitions preserve ratings,service unit,England,fixed snapshot and overlapping total')
acceptance=read(proposal/'acceptance.json');baseline=read(proposal/'baseline.json')
oldacceptance=read(PRIOR/'operations/acceptance.json')
require(acceptance['complete'] is False and acceptance['tasks']==oldacceptance['tasks'] and acceptance['bounded_verification_continuation']==oldacceptance['bounded_verification_continuation'],'Broader completion false; bounded NZ task and all task evidence unchanged')
require(acceptance['aemo_cqc_release']==record and baseline['aemo_cqc_release']==record,'Acceptance and baseline bind identical release record')
protected=lambda b:{k:v for k,v in b['checkpoint_watch'].items() if k!='pending_release_transition'}
require(protected(baseline)==protected(oldbaseline),'Full durable checkpoint watch unchanged except reviewed pending release transition')
for key in ['last_notified_state','notification_policy','bounded_data_verification','stats_nz_remaining_numeric_ids']:
 require(baseline.get(key)==oldbaseline.get(key),'Preserved baseline field: '+key)
require({k:baseline['identity'][k] for k in IDENTITY}==IDENTITY and record['identity']==IDENTITY and record['rollback_identity']==oldidentity,'Exact clean live and accepted NI rollback identities')
watch=baseline['checkpoint_watch']
transition=watch['pending_release_transition']
require(transition['approved_live_identity']==IDENTITY and transition['reviewed_edges']==8 and sorted(transition['source_contracts'])==['canada/rental_benchmark',CQC,'northern-ireland/electricity_balance','scotland/college_activity'],'Pending transition contains exact accepted target and cumulative four-source addition set')
require(watch['sequence']==5 and watch['incident_count']==33 and watch['pending_repair_count']==36 and watch['delivery_test_acknowledged'] is False and watch['scheduled_success_count']==2,'Sequence5,33 incidents,36 repairs,two cycles and no receipt remain')
expected=dict(reviewed_edges=8,source_obligations=120,public_probes=24,exact_approvals=25,actual_checkpoint_sequence=5,actual_legacy_scheduled_cycles=2,new_scope_actual_scheduled_cycles=0,new_scope_started_at=None,checkpoint_written=False,source_alerts_enabled=False,delivery_receipt_exists=False)
require(record['monitoring']==expected,'Exact release and unresolved operational boundary')
v=record['validation'];cont=v['staged_continuation']
require(v['staged_steps']==33 and v['production_steps']==33 and cont['verified'] is True and cont['imported_prefix_steps']==6 and cont['fresh_suffix_steps']==27 and cont['actual_attempt_count']==3 and cont['original_attempt_pass'] is False and cont['prior_continuation_pass'] is False and cont['uninterrupted'] is False,'33 logical staged gates across3 attempts,6 imported27 fresh; full33 production')
require(cont['rent_startup_wait_ms']==20000 and cont['original_failure']=='tail_not_ready' and cont['prior_continuation_failure']=='tail_not_ready','Bounded rent wait and both original failures remain explicit')
require(v['stats_nz_dated_numeric_references']==15 and sorted(v['stats_nz_unresolved_ids'])==UNRESOLVED,'Stats NZ15 of23 and exact eight unresolved cells retained')
require(v['held_aemo_refusal']['staged']['pass'] is True and v['held_aemo_refusal']['production']['pass'] is True,'Actual staged and production held AEMO refusal passed')
replay=read(proposal/'monitor-transition-replay.json')
require(replay['pass'] is True and replay['constructed'] is True and replay['run_scheduled'] is False and replay['actual_checkpoint_sequence_unchanged']==5 and replay['actual_scheduled_cycles_added']==0,'Constructed replay is preservation only, zero actual scheduled observations')
require(record['release_accepted'] is True and record['phase']=='released_awaiting_scheduled_observation','Implementation acceptance explicitly awaits scheduled observation')
if formatted:
 p=read(formatted/'proposal-proof.json')
 require(p['pass'] is True and p['proposal_only'] is True and p['active_files_written'] is False and p['checkpoint_written'] is False and p['scheduled_cycles_added']==0 and p['receipt_written'] is False,'Formatted proposal makes no active, checkpoint, cycle or receipt writes')
 for row in p['outputs']:require(pin(formatted/row['file'])=={**row,'file':str(formatted/row['file'])},'Formatted output binding: '+row['file'])
 for name in ['HANDOFF-prefix.md','GAP-LEDGER-prefix.md','release-evidence-proposal.md']:
  text=(formatted/name).read_text()
  terms=['Inadequate 125','Requires improvement 809','Good 2,063','Outstanding 65','Total 3,062','individual adult social-care services at a location','total overlaps','1 August 2025','not an all-England service census','shared CQC administrative lineage','Both predecessor attempts remain failed','27-gate continuation','20 s','10 s','cause of the earlier missing trace events is not claimed as proven','120 obligations','25 approvals','sequence 5','33 incidents','36 pending repairs','has no receipt','15 of 23','AEMO completed-day remains disconnected','ONS Manchester bedroom rent remains held','AER remains held','17 October Interim','UK CPI remains parked','PHW remains excluded']+UNRESOLVED
  require(all(t in text for t in terms),'Semantic and evidence limits retained in '+name)
report=dict(kind='Independent offline acceptance and final-format review',pass_=True,release_execution_performed_by_reviewer=False,checked_at=dt.datetime.now(dt.timezone.utc).isoformat(),proposal=str(proposal),formatted=str(formatted) if formatted else None,identity=IDENTITY,monitoring=expected,checks=checks,original_input_manifest=pin(BASE/'prior-manifest.json'),proposal_files=[pin(p) for p in sorted(proposal.iterdir()) if p.is_file()])
report['pass']=report.pop('pass_')
for c in report['checks']:c['pass']=c.pop('pass_')
output=BASE/('proposal-and-formatted-review.json' if formatted else 'proposal-review.json')
assert not output.exists(),output
output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(dict(output=pin(output),checks=len(checks))))
