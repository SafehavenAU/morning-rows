#!/usr/bin/env python3
"""Independent offline PyMuPDF comparison. Never imports the runtime reader."""
import argparse, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path
import fitz
parser=argparse.ArgumentParser()
parser.add_argument('--pdf', required=True)
parser.add_argument('--reference', required=True)
parser.add_argument('--preview', required=True)
parser.add_argument('--output', required=True)
a=parser.parse_args()
out=Path(a.output)
if out.exists(): raise SystemExit('Output exists; retain previous evidence')
original=Path(a.pdf).read_bytes(); reference_bytes=Path(a.reference).read_bytes(); preview_bytes=Path(a.preview).read_bytes()
expected='61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef'
assert len(original)==7175967 and hashlib.sha256(original).hexdigest()==expected
reference=json.loads(reference_bytes); preview=json.loads(preview_bytes)
assert reference['passed'] and len(reference['references'])==5
with fitz.open(stream=original,filetype='pdf') as pdf:
 assert len(pdf)==205
 first=' '.join(pdf[187].get_text().split());second=' '.join(pdf[188].get_text().split())
for phrase in ['England 2024/25','single assessment framework, as at 1 August 2025','not directly comparable with previous years','based on risk','unlikely to be representative']:
 assert phrase in first, phrase
for phrase in ['individual adult social care services','individual services at a location','we will publish 2 ratings','should not be combined with or compared','Figure A1: Adult social care, overall ratings, 2025','Source: CQC ratings data, 1 August 2025']:
 assert phrase in second, phrase
# PDF extraction order places the source sentence before graph Form text.
# Require exactly four parenthesised integer counts on the complete selected page.
chart=second
counts=[int(x.replace(',','')) for x in re.findall(r'\(([\d,]+)\)',chart)]
total=re.findall(r'The charts in this section show the ([\d,]+) ratings for adult social care services',second)
assert len(counts)==4 and len(total)==1
counts.append(int(total[0].replace(',','')))
assert sum(counts[:4])==counts[4]
assert preview['pass'] and preview['code_unchanged'] and preview['wrapper_status']==200
live=preview['live'];assert live['pass'] and live['network_reads']==1 and len(live['controls'])==19 and all(c['pass'] for c in live['controls'])
native=live['native'];assert native['period']=='2025-08-01' and native['publication_date']=='2025-10-24'
assert len(native['rows'])==5 and len(native['provenance'])==1
assert native['provenance'][0]['sha256']==expected and native['provenance'][0]['bytes']==7175967
comparisons=[]
for actual, independent, row in zip(counts, reference['references'],native['rows']):
 assert actual==independent['value']==row['value']
 assert independent['measure']==row['measure_id'] and row['period']=='2025-08-01' and row['unit']=='ratings'
 comparisons.append({'measure':row['measure_id'],'pdf_value':actual,'workbook_svg_value':independent['value'],'actual_worker_value':row['value'],'pass':True})
report={'pass':True,'verified_at':datetime.now(timezone.utc).isoformat(),'method':'Independent PyMuPDF full-original extraction plus retained stdlib ZIP/XML workbook and SVG reference compared to actual protected Worker output; no runtime reader imported','original_bytes':len(original),'original_sha256':expected,'reference_sha256':hashlib.sha256(reference_bytes).hexdigest(),'preview_sha256':hashlib.sha256(preview_bytes).hexdigest(),'comparisons':comparisons,'shared_cqc_administrative_lineage':True,'same_pdf_independent_extraction':True,'visual_evidence':'original/visual-provenance.json','actual_worker_controls':19,'measured_cpu_accepted':False,'source_activation':False,'limitations':['Exact full-body guard refuses all changed bytes pending independent review.','Fixed risk-prioritised service-rating cohort; not a national census or comparable trend.','Publication date uses separately retained same-edition official metadata; PDF printing date is not publication date.']}
out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pass':True,'independent_values':len(comparisons),'actual_worker_controls':19}))
