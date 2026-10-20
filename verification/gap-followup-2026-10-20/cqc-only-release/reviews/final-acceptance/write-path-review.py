from pathlib import Path
import hashlib,json,datetime
base=Path('/tmp/mr-dated-release-review/final-acceptance-review');prior=base/'prior';prop=Path('/tmp/mr-cqc-r2-acceptance-proposal');docs=Path('/tmp/mr-cqc-r2-document-proposal');out=base/'reviewed-active-projection'
def sha(b):return hashlib.sha256(b).hexdigest()
def pin(p):
 p=Path(p);b=p.read_bytes();return dict(file=str(p),bytes=len(b),sha256=sha(b))
jsonmap={'operations/us-release-review.json':'review.json','operations/approved-observations.json':'approvals.json','operations/source-contract-registry.json':'registry.json','operations/acceptance.json':'acceptance.json','verification/monitoring-baseline.json':'baseline.json'}
rows=[]
for dest,source in jsonmap.items():
 body=(prop/source).read_bytes();p=out/dest;p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_bytes(body)
 rows.append(dict(path=dest,mode='exact proposal copy',source=pin(prop/source),reviewed_result=pin(p),prior=pin(prior/dest)))
for dest,source,mode in [('HANDOFF.md','HANDOFF-prefix.md','prefix'),('GAP-LEDGER.md','GAP-LEDGER-prefix.md','prefix'),('verification/gap-followup-2026-10-20/cqc-only/README.md','CQC-only-README-append.md','append')]:
 old=(prior/dest).read_bytes();new=(docs/source).read_bytes();body=new+old if mode=='prefix' else old+new;p=out/dest;p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_bytes(body)
 assert body.endswith(old) if mode=='prefix' else body.startswith(old)
 rows.append(dict(path=dest,mode=mode+' with exact historical bytes preserved',source=pin(docs/source),reviewed_result=pin(p),prior=pin(prior/dest)))
r=json.loads((prop/'monitor-transition-replay.json').read_bytes())
for k in ['incidents_equal','all_repairs_equal','outbox_equal','original_other_102_source_states_equal','original_shadow_start_unchanged','new_scope_scheduled_starts_absent']:assert r[k] is True
assert r['incident_count']==33 and r['repair_count']==36 and r['prior_sequence']==5 and r['retained_review_edges']==7 and r['final_review_edges']==8 and r['retained_approval_count']==24 and r['final_approval_count']==25 and r['checkpoint_written'] is False and r['notification_delivered'] is False and r['remote_calls']==0
assert r['direct']['constructed_runs_added']==1 and len(r['direct']['release_audit']['reviewed_chain'])==8
assert all(x['observed_in_collection'] is False for x in r['direct']['release_audit']['reviewed_chain'][:-1])
assert len(r['hypothetical_prefixes'])==7 and all(x['prefix_is_hypothetical'] is True and x['prior_history_preserved'] is True and len(x['release_audit']['reviewed_chain'])==8-x['reviewed_prefix_edges'] and x['constructed_runs_added']==2 for x in r['hypothetical_prefixes'])
report=dict(kind='Independent exact eight-active-path and release README proposal review',pass_=True,checked_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),active_repository_files_written=False,actual_HTTP_requests=0,reviewed_active_paths=rows,release_readme=dict(destination='verification/gap-followup-2026-10-20/cqc-only-release/README.md',source=pin(docs/'release-evidence-proposal.md')),acceptance_and_format_review=pin(base/'proposal-and-formatted-review.json'),source_state_reconciliation=pin(base/'source-state-reconciliation.json'),replay=pin(prop/'monitor-transition-replay.json'),replay_findings=dict(prior_sequence=5,preserved_incidents=33,preserved_repairs=36,preserved_outbox=True,preserved_shadow_start=True,reviewed_edges=8,all_exact_prefix_suffix_paths_checked=7,constructed_direct_collection_increments=1,actual_scheduled_cycles_added=0),scope=dict(obligations=120,public_probes=24,exact_approvals=25,only_new_approval='england/care_assessment_cohort',stats_nz_exact_comparisons=15,stats_nz_total_cells=23),source_state=dict(compared=240,reported_entries=9,actual_changes=7,ONS=4,TfL=3,unchanged_TfL_entries=2),limitations=['Root applies only reviewed bytes; this review writes no active files.','The raw nine-entry source comparison remains unchanged and does not establish nine actual changes.','The formatter does not claim a source-change count; independent evidence establishes seven actual changes.','Implementation acceptance remains separate from scheduled,delivery and broader-gap acceptance.'])
report['pass']=report.pop('pass_');p=base/'final-eight-path-review.json';assert not p.exists();p.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(pin(p)))
