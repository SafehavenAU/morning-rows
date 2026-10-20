"""Constructed report-audit refusal controls. No network or release evidence."""
from pathlib import Path
import json,subprocess,tempfile,copy
HERE=Path(__file__).resolve().parent
REV='a'*40;VERSION='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
steps=['local-preflight','active-contract-scope','usa-cold-cpu','legacy-cold-cpu','added-source-fresh-cpu','claimant-www-cold-cpu','rent-www-cold-cpu','baseline-preserved-through-cpu','core-capture','core-offline-derivation-schema-us','core-semantics-apex','statsnz-independent-apex','gdp-capture','gdp-offline','claimant-capture','claimant-independent','claimant-schemas','rent-capture','rent-offline','gap-capture','gap-independent','gap-schemas','remaining-capture','remaining-independent','remaining-schemas','ni-capture','ni-independent','ni-schemas','aemo-capture','aemo-independent','aemo-numbers','aemo-schemas','cqc-capture','cqc-independent','cqc-schemas']
identity={'source_revision':REV,'worker_version':VERSION,'source_dirty':False,'build_fingerprint':'b'*16}
rows=lambda n:[{'pass':True} for _ in range(n)]
files={'steps.jsonl':[{'step':s,'pass':True,'exit_code':0}for s in steps],
 'staged-core/staged-preview-report.json':{'pass':True,'checks':rows(137)},
 'staged-core-derivation.json':{'pass':True},'staged-core-schemas-us.json':{'pass':True,'schema_documents':12,'us_reference_cells':13},
 'staged-apex-semantic.json':{'pass':True,'checks':rows(50),'identity':identity,'source_status':{'scotland':{'river_level':{'status':'ok'}}}},
 'staged-statsnz-apex.json':{'passed':True,'independent_reference_count':15,'exact_numeric_comparisons':15,'unverified_numeric_ids':['x']*8,**{k:False for k in ['all_23_numeric_acceptance','undisplayed_flags_accepted','future_vintages_approved','scheduled_or_release_acceptance']}},
 'staged-added-source-cpu.json':{'pass':True,'sources':[{'source':s,'pass':True,'full_desk_cpu_ms':1}for s in ['scotland/college_activity','canada/rental_benchmark','northern-ireland/electricity_balance','australia/grid_day','england/care_assessment_cohort']]},
 'staged-gdp-validation.json':{'pass':True,'counts':{'transport':19,'native_comparisons':3,'selected_comparisons':11,'schema_checks':9,'schema_negative_controls':18}},
 'staged-claimant-validation.json':{'pass':True,'native_cells_compared':65,'selectors':20,'negative_responses':15},
 'staged-claimant-schemas.json':{'pass':True,'schema_checks':25,'negative_contracts':185},
 'staged-rent-validation.json':{'pass':True,'counts':{'native_numeric_cells':116,'schema_documents':21,'schema_negative_controls':24}},
 'staged-aemo-daily-numbers.json':{'pass':True,'unique_original_intervals_per_domain':576,'unique_derived_measures_per_domain':10},
}
for name,limit in [('us',100),('legacy',500),('claimant',500),('rent',500)]:files[f'staged-{name}-cpu.json']={'budget_pass':True,'version':VERSION,'cpu_limit_ms':limit,'complete_event_coverage':True,'cold_retrieval_confirmed':True}
for key,manifest,routes,docs,negatives in [('gap','gap-interface-report.json',39,24,8),('remaining','remaining-interface-report.json',22,10,8),('ni-energy','ni-energy-interface-report.json',23,13,8),('aemo-daily','aemo-daily-interface-report.json',34,23,8),('cqc-pdf','cqc-pdf-interface-report.json',23,13,10)]:
 files[f'staged-{key}/{manifest}']={'pass':True,'revision':REV,'version':VERSION,'staged':True,'requests':rows(routes)}
 files[f'staged-{key}-schemas.json']={'pass':True,'schema_checks':docs,'negative_controls':negatives}
 files[f'staged-{key}-validation.json']={'pass':True}
files['staged-gap-validation.json']['independent_cells']={'boc':38,'statcan':14,'wra':4}
files['staged-remaining-validation.json']['independent_cells_per_domain']={'sfc':5,'cmhc':2}
files['staged-ni-energy-validation.json'].update(independent_cells_per_domain={'ni_electricity':5},fixed_edition='fixed_2026-09-03',source_presentations_share_statistical_lineage=True)
files['staged-aemo-daily-validation.json'].update(independent_cells_per_domain={'aemo_intervals':576,'aemo_summaries':10},calendar_day='2026-10-19')
files['staged-cqc-pdf-validation.json']['independent_cells_per_domain']={'cqc_ratings':5}
cases=[('complete constructed reports',lambda f:None,True),('missing AEMO numeric step',lambda f:f['steps.jsonl'].pop(30),False),('USA ceiling widened',lambda f:f['staged-us-cpu.json'].update(cpu_limit_ms=500),False),('cold source capture omitted CQC',lambda f:f['staged-added-source-cpu.json']['sources'].pop(),False),('AEMO source CPU exceeds500',lambda f:f['staged-added-source-cpu.json']['sources'][3].update(full_desk_cpu_ms=501),False),('wrong AEMO date',lambda f:f['staged-aemo-daily-validation.json'].update(calendar_day='2026-10-18'),False),('only575 original AEMO cells',lambda f:f['staged-aemo-daily-numbers.json'].update(unique_original_intervals_per_domain=575),False),('CQC incomplete route capture',lambda f:f['staged-cqc-pdf/cqc-pdf-interface-report.json']['requests'].pop(),False),('CQC wrong Worker',lambda f:f['staged-cqc-pdf/cqc-pdf-interface-report.json'].update(version='b'*36),False),('CQC missing negative controls',lambda f:f['staged-cqc-pdf-schemas.json'].update(negative_controls=9),False),('StatsNZ false broad acceptance',lambda f:f['staged-statsnz-apex.json'].update(all_23_numeric_acceptance=True),False),('known SEPA failure gets no waiver',lambda f:f['staged-apex-semantic.json']['source_status']['scotland']['river_level'].update(status='error'),False)]
results=[]
with tempfile.TemporaryDirectory(prefix='mr-combined-audit-controls-') as temp:
 for i,(label,edit,want)in enumerate(cases):
  directory=Path(temp)/str(i);directory.mkdir();subject=copy.deepcopy(files);edit(subject)
  for file,value in subject.items():
   path=directory/file;path.parent.mkdir(exist_ok=True,parents=True);path.write_text('\n'.join(json.dumps(v)for v in value)+'\n' if file=='steps.jsonl' else json.dumps(value))
  process=subprocess.run(['node',str(HERE/'audit-reports.mjs'),str(directory),'staged',REV,VERSION],capture_output=True,text=True)
  result=json.loads((directory/'release-gate-audit.json').read_text());assert result['pass']is want and process.returncode==(0 if want else 1),(label,process.stdout,process.stderr,result.get('error'))
  results.append({'label':label,'expected_pass':want,'pass':True})
print(json.dumps({'kind':'Constructed report audit controls only','pass':True,'controls':len(results),'results':results}))
