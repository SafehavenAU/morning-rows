#!/usr/bin/env python3
"""Separate stdlib extraction of retained Stats NZ public publication fragments.
Usage: python extract-publications.py /path/to/downloaded-html-directory
Inputs are downloaded public HTML plus adjacent JSON acquisition metadata.
Never reads the runtime reader, network credentials, or publisher API.
"""
import html.parser, json, pathlib, re, hashlib, sys
HERE=pathlib.Path(__file__).resolve().parent
class Embedded(html.parser.HTMLParser):
    def __init__(self):super().__init__();self.data=None
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k=='data-value' and v and 'DateTaxonomyTerm' in v:self.data=json.loads(v)
def retain(rawdir,name,indices):
    raw=(rawdir/(name+'.html')).read_bytes();meta=json.loads((rawdir/(name+'.json')).read_text())
    assert hashlib.sha256(raw).hexdigest()==meta['sha256']
    p=Embedded();p.feed(raw.decode('utf-8'));d=p.data
    blocks=[]
    for i in indices:
        b=d['PageBlocks'][i]
        # Retain original selected aggregate blocks, remove presentation controls.
        wanted={k:b[k] for k in ('ID','Title','ClassName','Content','GraphHeading','SeriesData','Footnote','GraphMetadata','SourceCredit','yAxisTitle') if k in b}
        if 'Content' in wanted:
            # Drop trailing enquiries/contact paragraphs unrelated to evidence.
            wanted['Content']=re.split(r'<h2>Enquiries</h2>',wanted['Content'])[0]
        blocks.append({'json_pointer':f'/PageBlocks/{i}','original_fields':wanted})
    out={'acquisition':meta,'publication_title':d['Title'],'published_local_as_stated':d.get('PageDate'),'extraction':'HTMLParser decodes data-value attribute; json.loads; selected original fields. This file is an extraction, not the whole HTTP body.','selected_blocks':blocks}
    dest=HERE/'sources'/(name+'.json');dest.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
    return {'file':str(dest.relative_to(HERE)),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'whole_response_sha256':meta['sha256'],'url':meta['url']}
def main():
    r=pathlib.Path(sys.argv[1]);entries=[]
    selections={'income-release':[0,1,3,4,7,8,9,10], 'hes':[0,1,5], 'enterprise':[2,3], 'agriculture':[4], 'iwi':[24], 'productivity':[2,3], 'pop-projection':[28], 'leed-annual':[0,1], 'leed-quarter':[0,1,2], 'prison':[0,1,2,5], 'justice':[0,1,2], 'injury':[0,2,3,4], 'lab-projection':[0,2,5], 'household-projection':[0], 'agriculture-2018':[0], 'agriculture-2024':[0]}
    for name,indices in selections.items(): entries.append(retain(r,name,indices))
    # General income collection metadata remains under its explicit CC BY 3.0 NZ notice.
    raw=(r/'income-metadata.html').read_text();meta=json.loads((r/'income-metadata.json').read_text())
    sections={}
    for heading,end in [('Household statistics','<h1>'),('Rounding','<h2>'),('Suppression of data','<h2>'),('Period effects','<h3>')]:
        m=re.search(r'<h[123][^>]*>'+re.escape(heading)+r'</h[123]>',raw)
        assert m,heading
        start=m.start();endpos=(raw.find('</p>',m.end())+4) if heading=='Period effects' else raw.find(end,m.end())
        sections[heading]=raw[start:endpos if endpos!=-1 else len(raw)]
    paras=re.findall(r'<p(?:\s[^>]*)?>.*?</p>',raw,re.S)
    for key,needle in [('survey_period','period of surveying/interviewing'),('population','target population for the HLFS/Income'),('licence','This work is licensed under')]:
        sections[key]=next(p for p in paras if needle in p)
    out={'acquisition':meta,'source_version':'example.org:8d1f8525-746e-43cd-ad82-81a96f46225f:14','extraction':'Selected original HTML sections; excludes contacts and irrelevant page chrome.','sections':sections}
    dest=HERE/'sources/income-metadata.json';dest.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
    entries.append({'file':str(dest.relative_to(HERE)),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'whole_response_sha256':meta['sha256'],'url':meta['url']})
    (HERE/'manifest.json').write_text(json.dumps({'publisher':'Stats NZ','retrieval_date':'2026-10-20','source_lineage':'All numerical evidence derives from Stats NZ statistical lineage. Extraction and official presentation differ from Morning Rows reader; this does not independently re-estimate statistics.','licence':'Stats NZ public data Creative Commons Attribution 4.0; general income DataInfo+ text explicitly CC BY 3.0 New Zealand. Credit Statistics New Zealand.','artifacts':entries},indent=2)+'\n')
if __name__=='__main__':main()
