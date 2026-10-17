"""Optional live, read-only independent CSV check of the audit's NZ price day.
Saves only five-node aggregate rows. Shares publisher lineage; no report-table
comparison is claimed for this new day. Run from repository root.
"""
import csv, datetime, decimal, hashlib, io, json, subprocess, sys, re
from pathlib import Path
HERE=Path(__file__).resolve().parent
audit=json.loads((HERE/'production-audit.json').read_text())
rows=audit['domains']['https://morningrows.com']['core_specimen']['nz_prices']
url=rows[0]['source_url']
assert url.startswith('https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/')
r=subprocess.run(['curl','-fsSL','--proto','=https','--proto-redir','=https','--max-redirs','3','--max-time','30','--max-filesize','8388608',url],capture_output=True)
if r.returncode:
 status=re.search(r'(?:error: |error:)(\d{3})',r.stderr.decode())
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_url':url,'result':'direct independent retrieval failed','curl_exit':r.returncode,'http_status':int(status.group(1)) if status else None,'redirect_behavior':'Publisher URL redirects to its emidatasets.blob.core.windows.net dataset. HTTPS redirects followed; no old file substituted.','limitation':'Public Worker recovery is checked separately. No new-day independent numeric reconciliation established by this probe.'}
 (HERE/'nz-confirmation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));sys.exit(1)
allrows=list(csv.DictReader(io.StringIO(r.stdout.decode('utf-8-sig'))))
codes={x['code'] for x in rows}; selected=[x for x in allrows if x['PointOfConnection'] in codes]
assert len(codes)==5 and len(selected)==5*rows[0]['periods']
for expected in rows:
 cells=[x for x in selected if x['PointOfConnection']==expected['code']]
 assert len(cells)==expected['periods']
 assert {int(x['TradingPeriod']) for x in cells}==set(range(1,expected['periods']+1))
 assert all(x['TradingDate']==expected['date'] and decimal.Decimal(x['DollarsPerMegawattHour']).is_finite() for x in cells)
 last=next(x for x in cells if int(x['TradingPeriod'])==expected['period'])
 assert decimal.Decimal(last['DollarsPerMegawattHour'])==decimal.Decimal(str(expected['price']))
with (HERE/'nz-price-selected.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(selected[0]));w.writeheader();w.writerows(selected)
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_url':url,'publisher_sha256':hashlib.sha256(r.stdout).hexdigest(),'selected_rows':len(selected),'matched_output_cells':5,'period':rows[0]['date'],'status':rows[0]['price_status'],'licence':'CC BY 4.0','licence_url':'https://www.emi.ea.govt.nz/LegalInformation','attribution':'www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)','limitation':'Independent Python CSV selection from the same source file as production. Separate official report presentation was not rechecked for this day.'}
(HERE/'nz-confirmation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
