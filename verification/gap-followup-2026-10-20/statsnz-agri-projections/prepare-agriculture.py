#!/usr/bin/env python3
"""Offline reproducible minimal excerpts from original public acquisitions; no network."""
import pathlib,json,hashlib,zipfile,xml.etree.ElementTree as E,urllib.parse,re,sys
if len(sys.argv)!=3:raise SystemExit('Usage: prepare-agriculture.py RAW_DIRECTORY FRESH_OUTPUT_DIRECTORY')
T=pathlib.Path(sys.argv[1]);D=pathlib.Path(sys.argv[2]);D.mkdir(parents=True,exist_ok=False);(D/'original').mkdir()
def write(p,o):p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
raw=(T/'agriculture-selected-csv.transient.html').read_bytes(); lines=raw.decode().splitlines(keepends=True)
keep=list(range(1,13))+list(range(26,45))
(D/'original/agriculture-selected.csv').write_bytes(''.join(lines[n-1] for n in keep).encode())
acq=json.loads((T/'infoshare-browse-acquisitions.json').read_text())
for x in acq:
 u=urllib.parse.urlsplit(x['url']); x['url']=urllib.parse.urlunsplit((u.scheme,u.netloc,re.sub(r'/\(X\([^/]+\)\)/','/',u.path),'',''))
 x['privacy_note']='Ephemeral session path/query and hidden form values omitted. Ordinary public form navigation; no credentials.'
for x in json.loads((T/'final-acquisitions.json').read_text()):
 x['outcome']='generic_application_error' if x['name']=='final-agriculture-options' else 'session_expired' if x['name']=='final-agriculture-table' else 'normal_public_navigation'
 acq.append(x)
write(D/'acquisitions.json',{'original_csv':acq[4], 'public_navigation':acq,'selection':{'table_file':'AGR075501.px','table_reference':'AGR001AA','geography':'Total New Zealand','periods':['2018','2024','2025'],'variables':['New Area Planted in Production Forest','Total Sheep','Apples'],'output':'csv'},'retention':{'file':'original/agriculture-selected.csv','transformation':'Original lines1–12 and26–44 concatenated byte-identically. Omitted irrelevant footnotes and all contact footer. Original line endings retained. Numeric cells, labels, units, missing-symbol legend, no-flags warning, table reference and update timestamps unchanged.','original_body_sha256':hashlib.sha256(raw).hexdigest(),'original_body_bytes':len(raw)}})
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/package/2006/relationships'}
selections={'agriculture-2018-workbook':('Table 8',['A2','A3','A5','C5','C6','C7','C8','D8','C9','A34','C34','D34','B36','B37','B38','B39']), 'agriculture-2024-workbook':('Table 9',['A2','A3','A5','C5','C6','C7','D7','C8','A29','C29','D29','B58','B59','B60','B61']), 'agriculture-2025-workbook':('Table 1',['A2','A3','A5','C5','C6','C7','D7','C8','A29','C29','D29','B31','B32','B33','B34'])}
out={}
for name,(sheet,refs) in selections.items():
 z=zipfile.ZipFile(T/(name+'.body')); shared=[]
 if 'xl/sharedStrings.xml' in z.namelist():shared=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml'))]
 rel={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
 w=E.fromstring(z.read('xl/workbook.xml'));s=next(s for s in w.find('s:sheets',ns) if s.attrib['name']==sheet)
 target=rel[s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]; target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
 root=E.fromstring(z.read(target));cells={}
 for c in root.findall('.//s:c',ns):
  ref=c.attrib['r'];v=c.find('s:v',ns)
  if ref not in refs:continue
  if c.attrib.get('t')=='s':value=shared[int(v.text)]
  elif c.attrib.get('t')=='inlineStr':value=''.join(c.find('s:is',ns).itertext())
  elif v is not None:value=float(v.text) if '.' in v.text else int(v.text)
  else:value=None
  cells[ref]=value
 meta=json.loads((T/(name+'.acquisition.json')).read_text())
 out[name]={'acquisition':meta,'sheet':sheet,'method':'Python standard-library zipfile + ElementTree; original shared strings and raw numeric cell values; no Morning Rows reader or openpyxl used.','cells':cells}
write(D/'original/workbook-cells.json',out)
# Contact-free publisher-methodology excerpts selected as complete relevant paragraphs.
from html.parser import HTMLParser
class Text(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.text=[]
 def handle_starttag(self,t,a):
  if t in ['script','style']:self.skip+=1
  if t in ['p','li','div','h1','h2','h3','br']:self.text.append('\n')
 def handle_endtag(self,t):
  if t in ['script','style']:self.skip-=1
  if t in ['p','li']:self.text.append('\n')
 def handle_data(self,d):
  if not self.skip:self.text.append(d)
methods=[]
for name in ['agri-metadata','agri-2025-metadata']:
 p=Text();p.feed((T/(name+'.body')).read_text());paragraphs=[' '.join(x.split()) for x in ''.join(p.text).split('\n')]
 terms=['GST','horticultural','fruit','2025 onwards','2025 survey','final','Creative Commons','geographic locations','Business Register','population']
 selected=[]
 for para in paragraphs:
  if len(para)>50 and any(term.lower() in para.lower() for term in terms) and not re.search(r'@|cookie|telephone',para,re.I):
   if para not in selected:selected.append(para)
 methods.append({'acquisition':json.loads((T/(name+'.acquisition.json')).read_text()),'paragraphs':selected})
write(D/'original/methodology-excerpts.json',methods)
