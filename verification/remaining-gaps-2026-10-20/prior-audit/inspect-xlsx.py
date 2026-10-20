"""Independent stdlib XML inspection of retained public aggregate workbook cells."""
import zipfile,xml.etree.ElementTree as E,posixpath,json,sys,pathlib
p=pathlib.Path(sys.argv[1]);z=zipfile.ZipFile(p);n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ss=[''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',n)] if 'xl/sharedStrings.xml' in z.namelist() else []
rels={r.get('Id'):posixpath.normpath('xl/'+r.get('Target')) for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))};rr={}
for sheet in E.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',n):
 cells=[];path=rels[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
 for r in E.fromstring(z.read(path)).findall('.//s:sheetData/s:row',n):
  row=[]
  for c in r.findall('s:c',n):
   v=c.find('s:v',n);inline=c.find('s:is',n);x=v.text if v is not None else ''.join(inline.itertext()) if inline is not None else ''
   if c.get('t')=='s':x=ss[int(x)]
   if x:row.append([c.get('r'),x])
  if row:cells.append(row)
 rr[sheet.get('name')]=cells
print(json.dumps(rr,indent=2))
