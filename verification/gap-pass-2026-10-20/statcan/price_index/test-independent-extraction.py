#!/usr/bin/env python3
"""Offline negative controls; mutate publisher bytes and update only acquisition hashes.
This bypasses the hash mismatch shortcut so semantic extraction must reject errors.
No production reader, network request or retained original is modified.
"""
import csv,hashlib,io,json,shutil,subprocess,tempfile,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def csv_change(path,kind):
 rows=list(csv.DictReader(path.read_text(encoding='utf-8-sig').splitlines()));fields=list(rows[0])
 if kind=='wrong_geography':rows[0]['GEO']='Ontario'
 if kind=='wrong_value':rows[0]['VALUE']=str(float(rows[0]['VALUE'])+1)
 if kind=='wrong_period':rows[0]['REF_DATE']='2025-01'
 if kind=='extra_observation':rows.append(dict(rows[0]))
 out=io.StringIO();writer=csv.DictWriter(out,fieldnames=fields,lineterminator='\n');writer.writeheader();writer.writerows(rows);path.write_text(out.getvalue())

def main():
 results=[]
 for kind in ['wrong_geography','wrong_value','wrong_period','extra_observation','wrong_metadata_member']:
  with tempfile.TemporaryDirectory(prefix='statcan-negative-') as d:
   p=Path(d)/ROOT.name;shutil.copytree(ROOT,p)
   if ROOT.name!='price_index':
    codes=Path(d)/'price_index/original';codes.mkdir(parents=True);shutil.copy2(ROOT.parent/'price_index/original/codes.json',codes/'codes.json')
   file='original/cube-metadata.json' if kind=='wrong_metadata_member' else 'original/selected-series.csv'
   if kind=='wrong_metadata_member':
    body=json.loads((p/file).read_text());config=json.loads((p/'selected-config.json').read_text());selected=config['selected_dimensions'][0]['member']['memberId'];member=next(m for m in body[0]['object']['dimension'][0]['member'] if m['memberId']==selected);member['memberNameEn']='Wrong geography';(p/file).write_text(json.dumps(body))
   else:csv_change(p/file,kind)
   raw=(p/file).read_bytes();manifest=json.loads((p/'acquisition.json').read_text())
   for record in manifest:
    if record.get('file')==file and 'sha256'in record:record['sha256']=hashlib.sha256(raw).hexdigest();record['bytes']=len(raw)
   (p/'acquisition.json').write_text(json.dumps(manifest))
   run=subprocess.run(['python',str(p/'verify-retained.py')],capture_output=True,text=True)
   rejected=run.returncode!=0 and 'AssertionError:' in run.stderr
   reason=run.stderr.strip().splitlines()[-1] if run.stderr.strip() else None
   assert rejected and 'SHA256' not in reason and 'byte count' not in reason,(kind,run.stdout,run.stderr)
   results.append({'mutation':kind,'rejected':True,'hashes_updated_to_exercise_semantics':True,'reason':reason})
 report={'source':ROOT.name,'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'pass':True,'tests':results,'method':'Temporary copy mutation controls; retained original untouched; updated mutation hash/byte counts to require semantic rejection rather than hash mismatch.'}
 (ROOT/'negative-controls.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'source':ROOT.name,'passed':True,'negative_controls':len(results)}))
if __name__=='__main__':main()
