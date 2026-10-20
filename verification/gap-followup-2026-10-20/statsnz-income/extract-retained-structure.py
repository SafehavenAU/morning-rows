#!/usr/bin/env python3
"""Extract exact selected public SDMX metadata from previously retained responses.
Usage: python extract-retained-structure.py INPUT_DIRECTORY OUTPUT_DIRECTORY
No HTTP, runtime reader imports, credential access, or observation acceptance.
"""
import sys,json,hashlib,re,pathlib,xml.etree.ElementTree as ET
NS={'s':'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure','c':'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common','m':'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message'}
SELECTIONS={'INC_INC_001':{'PERIOD_INC_INC_001':'202606','ETHGP_INC_INC_001':'98','LGR_INC_INC_001':'98','SEX_INC_INC_001':'98','AGEGP_INC_INC_001':'98','MEASURE_INC_INC_001':'MED_WEEK_INC'},'INC_INC_011':{'PERIOD_INC_INC_011':'202606','LGR_INC_INC_011':'98','HHTYPE_INC_INC_011':'98','MEASURE_INC_INC_011':'MED_INC_ALL_SOUR'}}
def extract(src,id):
 raw=src.read_bytes();d=json.loads(raw);assert d['status']==200;body=d['body'];xml=ET.fromstring(body)
 flow=xml.find('.//s:Dataflow',NS);assert flow.attrib['id']==id
 selected={}
 for column,code in SELECTIONS[id].items():
  hits=[]
  for cl in xml.findall('.//s:Codelist',NS):
   if column not in cl.attrib['id']:continue
   for c in cl.findall('s:Code',NS):
    if c.attrib['id']==code:hits.append({'codelist_id':cl.attrib['id'],'code':code,'labels':[x.text for x in c.findall('c:Name',NS)]})
  assert len(hits)==1,(column,hits);selected[column]=hits[0]
 # Keep exact string excerpts in addition to separately parsed fields.
 fragments=[re.search(r'<structure:Dataflow\b.*?</structure:Dataflow>',body,re.S).group()]
 for column,code in SELECTIONS[id].items():
  for m in re.finditer(r'<structure:Codelist\b[^>]*>.*?</structure:Codelist>',body,re.S):
   cl=ET.fromstring('<root xmlns:structure="'+NS['s']+'" xmlns:common="'+NS['c']+'">'+m.group()+'</root>')[0]
   if column not in cl.attrib['id']:continue
   c=re.search(r'<structure:Code id="'+re.escape(code)+r'"(?:\s[^>]*)?>.*?</structure:Code>',m.group(),re.S)
   assert c;fragments.append(c.group())
 return {'provenance':{'kind':'previously_retained_original_publisher_structure','source_path_at_review':str(src),'source_file_sha256':hashlib.sha256(raw).hexdigest(),'original_response_status':d['status'],'original_content_type':d['type'],'original_size_field':d['size'],'body_utf8_bytes':len(body.encode()),'body_sha256':hashlib.sha256(body.encode()).hexdigest(),'publisher_prepared':xml.findtext('m:Header/m:Prepared',namespaces=NS),'retrieved_at':None,'request_url':None,'limitation':'Original wrapper retains body/status/type/size only; no acquisition timestamp or request URL. Publisher Prepared is not invented retrieval time. No new request and no credentials used.'},'id':id,'title':flow.findtext('c:Name',namespaces=NS),'dimensions':selected,'dataflow_annotations':[{x.tag.split('}')[-1]:x.text for x in a}for a in flow.findall('c:Annotations/c:Annotation',NS)],'annotation_interpretation':'NonProductionDataflow annotation retained verbatim and not interpreted as a numeric acceptance or live-source failure.','original_xml_fragments':fragments}
def main():
 root,out=map(pathlib.Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
 for id in SELECTIONS:
  d=extract(root/('remote_structure_id_'+id+'.json'),id);(out/(id+'-structure.json')).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n');print(id,d['title'])
if __name__=='__main__':main()
