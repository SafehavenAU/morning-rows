from pathlib import Path
from html.parser import HTMLParser
import json,hashlib,zipfile,xml.etree.ElementTree as ET,re,csv,io,sys
ROOT=Path(sys.argv[1]);OUT=Path(sys.argv[2]);(OUT/'original').mkdir(parents=True,exist_ok=True)
def put(path,value):
 p=OUT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def metadata(name):return json.loads((ROOT/(name+'.json')).read_text())
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
selections=[('labour-workbook','labour-table1',[1,3,4,6,7,9,13,422,423,432,433,434],'xl/worksheets/sheet2.xml'),('household-workbook','household-table1',[1,3,4,6,7,19,20,23,48,49,50,52],'xl/worksheets/sheet2.xml'),('household-workbook','household-table3',[1,3,4,6,7,58,61,62,63,68,70,71],'xl/worksheets/sheet4.xml')]
for source,name,rows,path in selections:
 with zipfile.ZipFile(ROOT/(source+'.body')) as z:
  ss=[''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml'))];sheet=ET.fromstring(z.read(path));root=ET.Element('selected-original-rows');used={}
  for row in sheet.findall('.//m:row',NS):
   if int(row.attrib['r']) in rows:
    root.append(row)
    for cell in row.findall('m:c',NS):
     v=cell.find('m:v',NS)
     if cell.attrib.get('t')=='s' and v is not None:used[v.text]=ss[int(v.text)]
  raw=ET.tostring(root,encoding='utf-8',xml_declaration=True);(OUT/'original'/f'{name}.xml').write_bytes(raw)
  put(f'original/{name}-strings.json',used)
  put(f'original/{name}-mapping.json',{'original':metadata(source),'sheet_xml_path':path,'selected_row_numbers':rows,'transformation':'Original selected row nodes serialized with ElementTree; shared-string indexes resolved from original xl/sharedStrings.xml into a separate index/value mapping. Other worksheet rows and unrelated strings omitted; cell numbers and numeric v text unchanged. XML namespace prefix and serialization may differ.','retained_xml_sha256':hashlib.sha256(raw).hexdigest()})
# Embedded graph is a selected original block with no page contacts or unrelated data.
class Embedded(HTMLParser):
 def __init__(self):super().__init__();self.value=None
 def handle_starttag(self,tag,attrs):
  value=dict(attrs).get('data-value')
  if value:
   try: obj=json.loads(value)
   except ValueError:return
   if isinstance(obj,dict) and 'PageBlocks' in obj and 'DateTaxonomyTerm' in obj:self.value=obj
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,value):
  if value.strip():self.parts.append(value.strip())
e=Embedded();e.feed((ROOT/'labour.body').read_text());d=e.value;b=d['PageBlocks'][8]
series=b['SeriesData'][0];rawcsv=series['GraphCsvData'];rows=list(csv.reader(io.StringIO(rawcsv)))
column=rows[0].index('2026');selected=[[r[0],r[column]] for r in rows if r]
buf=io.StringIO();csv.writer(buf,lineterminator='\n').writerows(selected);(OUT/'original'/'labour-broad-age-2026.csv').write_text(buf.getvalue())
put('original/labour-graph-mapping.json',{'original':metadata('labour'),'json_pointer':'/PageBlocks/8/SeriesData/0/GraphCsvData','block_id':b.get('ID'),'graph_heading':b.get('GraphHeading'),'source_credit':b.get('SourceCredit'),'footnote':b.get('Footnote'),'series':{k:series[k] for k in series if k!='GraphCsvData'},'transformation':'HTML entity-decoded embedded JSON; selected original GraphCsvData row labels and2026 column, independently parsed using Python stdlib csv. Unrelated periods omitted.','selected_csv_sha256':hashlib.sha256(buf.getvalue().encode()).hexdigest()})
# Text fragments supporting exact scenario and period definitions; markup only removed.
for source,segments in [('household-2018-collection',[('Reference period','Overview of changes'),('Which projection should I use?','Consistency with other projections')]),('labour-2024-collection',[('Reference period','Method\n'),('Method\n','Main changes')])]:
 t=Text();t.feed((ROOT/(source+'.body')).read_text());text='\n'.join(t.parts);parts=[]
 for a,b in segments:
  start=text.index(a);end=text.index(b,start+len(a));parts.append(text[start:end].strip())
 put('original/'+source+'-excerpt.json',{'original':metadata(source),'transformation':'Visible text from selected original metadata sections; HTMLParser decoded text nodes joined with newlines. Navigation, contacts and other metadata omitted.','sections':parts})
# Public Infoshare specimen excludes only the contact trailer; this is a wrong-vintage control.
raw=(ROOT/'household-selected-csv.transient.html').read_text();end=raw.index('"Contact:');selected=raw[:end]
(OUT/'original'/'infoshare-household-2013base.csv').write_text(selected)
records=json.loads((ROOT/'infoshare-acquisitions.json').read_text())
for entry in records:entry['url']=entry['url'].split('?')[0]
record=next(x for x in records if x['name']=='household-selected-csv')
put('original/infoshare-household-mapping.json',{'original':record,'navigation':['Population','Demography National Family and Household Projections - DNH','Projected Households by Household Type,2013-Base(Annual-Jun)'],'table_code':'DNH479801.px','table_reference':'DNH009AA','selection':{'projection_label':"Medium Fertility, Medium Mortality, Medium Migration, and 'A' Living Arrangement Type Rates",'household_type':'Total','year':'2028'},'transformation':'Original public CSV text through Source line; Contact/Telephone/Email trailer removed. UTF-8 text and newlines normalized by Python text read/write. Public session path/hidden controls never retained in deliverable.','retained_sha256':hashlib.sha256(selected.encode()).hexdigest()})
# Failed route distinguished from publisher failure.
put('original/legacy-table-attempt.json',{'url':'https://nzdotstat.stats.govt.nz/wbos/Index.aspx?DataSetCode=TABLECODE8602','attempt_date':'2026-10-20','attempted_at':None,'publisher_status':None,'response_sha256':None,'outcome':'environment_proxy_tunnel_refusal','error':'Tunnel connection failed:403 Forbidden','timestamp_limitation':'The initial urllib fetcher did not persist its timestamp on URLerror; no exact request timestamp is claimed. No publisher body was received. No retry.'})
# All retained acquisition metadata includes no cookies or credential/session fields.
acq=[]
for path in ROOT.glob('*.json'):
 try:item=json.loads(path.read_text())
 except Exception:continue
 if isinstance(item,dict) and 'retrieved_at' in item and 'url' in item:acq.append({'local_original_name':path.stem,**item})
put('acquisitions.json',{'official_public_gets':acq,'infoshare_public_browse_and_export':records,'legacy_refusal':'original/legacy-table-attempt.json','excluded':'Raw full pages and transient form/session values are not part of the retained deliverable. No authenticated Stats NZ API request or credentials were used.'})
