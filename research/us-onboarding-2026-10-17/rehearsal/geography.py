"""Retain minimal primary-source frame excerpts. No personal or confidential data.
Default uses this session's original downloads; --live DIR independently fetches again.
Requires pdftotext, Python stdlib. Output is JSON on stdout; no originals enter git.
"""
import argparse,datetime,hashlib,json,re,subprocess,urllib.request
from html.parser import HTMLParser
from pathlib import Path
class Text(HTMLParser):
    def __init__(self): super().__init__();self.parts=[]
    def handle_data(self,data): self.parts.append(data)
ap=argparse.ArgumentParser();ap.add_argument('--live',type=Path);a=ap.parse_args()
directory=a.live or Path('/tmp/mr-us-research');directory.mkdir(exist_ok=True,parents=True)
sources=[
 ('faq-current.txt','https://www.bls.gov/cpi/questions-and-answers.htm',['Effective with the 2018 redesign']),
 ('frame-article.txt','https://www.bls.gov/opub/mlr/2016/article/the-2018-revision-of-the-cpi-geographic-sample.htm',['The area sample frame will comprise','Anchorage represents all CBSAs']),
 ('omb-b13-01.txt','https://obamawhitehouse.archives.gov/sites/default/files/omb/bulletins/2013/b13-01.pdf',['388 Metropolitan Statistical Areas','536 in the United States','Of 3,143 counties']),
 ('frame-current.txt','https://www.bls.gov/cpi/additional-resources/geographic-sample.htm',['DC: District of Columbia'])]
evidence=[]
for filename,url,terms in sources:
    path=directory/filename
    raw=directory/('omb-b13-01.pdf' if url.endswith('.pdf') else filename.replace('.txt','.html'))
    if a.live:
        with urllib.request.urlopen(url,timeout=40) as response: raw.write_bytes(response.read())
        if url.endswith('.pdf'):subprocess.run(['pdftotext','-layout',str(raw),str(path)],check=True)
        else:
            parser=Text();parser.feed(raw.read_text());path.write_text('\n'.join(parser.parts))
    s=' '.join(path.read_text().split());excerpts=[]
    for term in terms:
        i=s.index(term);excerpts.append({'locator':term,'text':s[max(0,i-40):i+420]})
    original=raw if raw.exists() else path
    evidence.append({'url':url,'captured_at':datetime.datetime.fromtimestamp(original.stat().st_mtime,datetime.timezone.utc).isoformat(),'input_kind':'original' if raw.exists() else 'HTML text extraction','input_sha256':hashlib.sha256(original.read_bytes()).hexdigest(),'excerpts':excerpts})
pdf=(directory/'omb-b13-01.txt').read_text();section=pdf[pdf.index('Statistical Areas by State'):];section=section[:section.index('Puerto Rico')]
states='Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'.split('|')
headings=[s for s in states if re.search(r'^\s*'+re.escape(s)+r'\s*$',section,re.M)]
assert len(headings)==51
print(json.dumps({'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'licence':'US federal government primary material, public domain; attribution retained','evidence':evidence,'omb_list_6_exact_state_headings_before_puerto_rico':headings,'derivation':'Current CPI FAQ identifies the 2018 design using 2010 Census / 2013 OMB CBSAs. BLS selects 381 metro and 536 micro CBSAs. OMB separates these exact US counts from 7 metro / 5 micro Puerto Rico areas. List 6 covers all 50 states and DC; current CPI appendix independently names DC, and original CPI design explicitly includes Alaska/Hawaii. Other territories are outside this CBSA frame. This supports the national urban states/DC target excluding territories, without promising subnational output.','limits':['Authoritative frame derivation, not a single verbatim all-territories sentence.','Urban target is not total US population.','Sample design vintage is not expenditure-weight vintage.','Does not imply every state has separately sampled or published CPI.']},indent=2))
