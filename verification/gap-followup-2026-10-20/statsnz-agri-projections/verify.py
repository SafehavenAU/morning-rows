#!/usr/bin/env python3
"""Offline independent Stats NZ evidence check; standard library, no reader imports.

Default: parse retained publisher CSV and independently extracted workbook cells.
--original-dir DIR: additionally reproduce selected OOXML cells from the three
hash-pinned XLSX bodies named agriculture-{2018,2024,2025}-workbook.body in DIR.
No network requests are made. A changed release is a failure, never a refresh.
"""
import argparse, copy, csv, hashlib, io, json, pathlib, xml.etree.ElementTree as ET, zipfile
ROOT = pathlib.Path(__file__).resolve().parent
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
VARIABLES = ['New Area Planted in Production Forest', 'Total Sheep', 'Apples']
SPEC = [
 ('AGR_AGR_001', '2018', VARIABLES[0], 8293, 'hectares', 'agriculture-2018-workbook', 'Table 8', 'D34', 100, 1),
 ('AGR_AGR_002', '2024', VARIABLES[2], 9522, 'hectares', 'agriculture-2024-workbook', 'Table 9', 'D29', 10, 1),
 ('AGR_AGR_003', '2025', VARIABLES[1], 23252463, 'animals', 'agriculture-2025-workbook', 'Table 1', 'D29', 1000, 1000),
]
def require(condition, label):
 if not condition: raise ValueError(label)
def parse_export(text):
 rows = list(csv.reader(io.StringIO(text)))
 require(rows[0] == ['Variable by Total New Zealand (Annual-Jun)', '', '', ''], 'table title')
 require(rows[1] == ['', 'Total New Zealand', '', ''], 'national geography')
 require(rows[2] == [' ', *VARIABLES], 'exact variable identities/order')
 values = rows[3:6]
 require([x[0] for x in values] == ['2018', '2024', '2025'], 'period set/order')
 require(all(len(x) == 4 for x in values), 'rectangular selected matrix')
 for row in values:
  require(all(v == '..' or v.isascii() and v.isdigit() for v in row[1:]), 'strict integer or unavailable symbol')
 singletons = [x[0] for x in rows[6:] if len(x) == 1]
 for label in [
  'New Area Planted in Production Forest: Hectares, Magnitude = Units',
  'Total Sheep: Number, Magnitude = Units', 'Apples: Hectares, Magnitude = Units',
  '.. figure not available', 'C: Confidential', 'E: Early Estimate', 'P: Provisional',
  'R: Revised', 'S: Suppressed', 'Status flags are not displayed', 'AGR001AA',
  'Source: Statistics New Zealand',
  *[v + ': 16 April 2026 10:45am' for v in VARIABLES],
 ]: require(label in singletons, 'metadata: ' + label)
 # These non-target absences are explicit missingness, never numeric zero.
 require([(r[0], VARIABLES[i]) for r in values for i,v in enumerate(r[1:]) if v == '..'] ==
  [('2018', 'Apples'), ('2024', VARIABLES[0]), ('2025', VARIABLES[0]), ('2025', 'Apples')], 'missing-cell meanings')
 return {(r[0], VARIABLES[i]): None if v == '..' else int(v) for r in values for i,v in enumerate(r[1:])}
def extract_ooxml(path, sheet, coordinates):
 with zipfile.ZipFile(path) as z:
  shared = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml'))]
  rels = {x.attrib['Id']:x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  tabs = ET.fromstring(z.read('xl/workbook.xml')).find('s:sheets', NS)
  tab = next(x for x in tabs if x.attrib['name'] == sheet)
  target = rels[tab.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
  target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
  out = {}
  for cell in ET.fromstring(z.read(target)).findall('.//s:c', NS):
   ref = cell.attrib['r']
   if ref not in coordinates: continue
   v = cell.find('s:v', NS)
   if cell.get('t') == 's': value = shared[int(v.text)]
   elif cell.get('t') == 'inlineStr': value = ''.join(cell.find('s:is', NS).itertext())
   elif v is None: value = None
   else: value = float(v.text) if '.' in v.text else int(v.text)
   out[ref] = value
  return out

def verify(text, books):
 values = parse_export(text)
 checks = []
 for id_, year, variable, expected, unit, name, sheet, cell, quantum, scale in SPEC:
  actual = values[(year, variable)]
  require(actual == expected, id_ + ' exact comparison (zero tolerance)')
  b = books[name]; c = b['cells']
  require(b['sheet'] == sheet, id_ + ' separate workbook sheet')
  require(c['A34' if year == '2018' else 'A29'] == 'Total New Zealand', id_ + ' workbook geography')
  require(c['D8' if year == '2018' else 'D7'] == int(year), id_ + ' workbook year')
  require(c['C5'] == ('Year to 31 March' if year == '2018' else 'At 30 June'), id_ + ' period convention')
  require(c['C6'] == ('Exotic planting' if year == '2018' else 'Apples' if year == '2024' else 'Total sheep'), id_ + ' measure')
  require(c['C9' if year == '2018' else 'C8'] == ('(000)' if year == '2025' else '(Hectares)'), id_ + ' workbook units')
  if year == '2018': require(c['C7'] == 'New area' and 'nearest 100' in c['B38'], 'forest new area and rounding')
  if year == '2024': require('nearest 10' in c['B60'], 'apples rounding')
  rounded = c[cell] * scale
  require((actual + quantum // 2) // quantum * quantum == rounded, id_ + ' separate rounded publication')
  checks.append({'id':id_, 'period':year, 'exact_export_value':actual, 'expected_reader_value':expected, 'unit':unit,
   'exact_tolerance':0, 'exact_match':True, 'infoshare_variable':variable, 'geography':'Total New Zealand',
   'infoshare_table':'AGR001AA', 'publisher_updated_raw':'16 April 2026 10:45am', 'publisher_updated_timezone':'not stated; no UTC suffix inferred',
   'separate_workbook': {'name':name,'sheet':sheet,'cell':cell,'displayed_value':c[cell],'scale':scale,'precision_in_base_units':quantum,'rounded_match':True},
   'flags':'not displayed in export; no per-cell status verification claim',
   'result':'exact_numeric_gap_closed_for_this_dated_specimen'})
 return checks

def controls(text, books):
 bad = {
  'wrong_geography':text.replace('"","Total New Zealand"','"","Auckland"',1),
  'wrong_year':text.replace('2018,8293','2019,8293',1),
  'wrong_measure':text.replace('"Total Sheep","Apples"','"Total Cattle","Apples"',1),
  'wrong_units':text.replace('Hectares, Magnitude = Units','Hectares, Magnitude = Thousands',1),
  'rounded_value_substitution':text.replace('2018,8293','2018,8300',1),
  'suppressed_to_zero':text.replace('2018,8293','2018,0',1),
  'missing_to_zero':text.replace('".."','0',1),
  'wrong_release':text.replace('16 April 2026','16 April 2025'),
  'wrong_table':text.replace('AGR001AA','AGR002AA'),
  'dropped_year':text.replace(next(x for x in text.splitlines(True) if x.startswith('2024,')),''),
  'status_claim_removed':text.replace('Status flags are not displayed','Status final'),
 }
 results = []
 for name, altered in bad.items():
  try: verify(altered, books)
  except (ValueError, IndexError, KeyError): results.append({'control':name,'rejected':True})
  else: raise AssertionError('control unexpectedly accepted: '+name)
 wrong=copy.deepcopy(books);wrong['agriculture-2018-workbook']['cells']['C7']='Replanted'
 try: verify(text,wrong)
 except ValueError: results.append({'control':'forest_replanting_substitution','rejected':True})
 else: raise AssertionError('replanting accepted')
 return results

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--original-dir',type=pathlib.Path);ap.add_argument('--output',type=pathlib.Path);args=ap.parse_args()
 text=(ROOT/'original/agriculture-selected.csv').read_text();books=json.loads((ROOT/'original/workbook-cells.json').read_text())
 reproduced=[]
 if args.original_dir:
  for name,b in books.items():
   p=args.original_dir/(name+'.body')
   require(hashlib.sha256(p.read_bytes()).hexdigest()==b['acquisition']['sha256'],name+' original hash')
   require(extract_ooxml(p,b['sheet'],b['cells'])==b['cells'],name+' independently reproduced OOXML')
   reproduced.append(name)
 report={'pass':True,'method':'Python stdlib CSV extraction and separate OOXML cell extraction; no production reader imports',
  'exact_comparisons':verify(text,books),'negative_controls':controls(text,books),'reproduced_original_workbooks':reproduced,
  'limits':['Exact matches do not verify undisplayed flags.','Infoshare and publication workbooks share Stats NZ survey lineage; this is independent extraction/presentation, not an independent survey.','No future release is approved by this dated specimen.','Projection blockers are described separately; they are not accepted by these checks.']}
 out=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
 if args.output:args.output.write_text(out)
 else:print(out,end='')
if __name__=='__main__':main()
