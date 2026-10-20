"""Offline, independent Python XML/Plotly/news reconciliation; never calls a reader."""
import pathlib,hashlib,json,re,base64,zipfile,io,xml.etree.ElementTree as E,datetime
from html.parser import HTMLParser
b=pathlib.Path(__file__).parent
class P(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.jsons=[];self.text=[];self.skip=0;self.typ=None;self.buf=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='a' and a.get('href','').startswith('data:'):self.links.append(a)
  if t in ('script','style'):self.skip+=1;self.typ=a.get('type');self.buf=[]
 def handle_endtag(self,t):
  if t in ('script','style'):
   if self.typ=='application/json':self.jsons.append(json.loads(''.join(self.buf)))
   self.skip=max(0,self.skip-1);self.typ=None
 def handle_data(self,d):
  if not self.skip:self.text.append(d)
  elif self.typ=='application/json':self.buf.append(d)
def workbook(raw):
 z=zipfile.ZipFile(io.BytesIO(raw));n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 ss=[''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',n)] if 'xl/sharedStrings.xml' in z.namelist() else []
 out={}
 for c in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:c',n):
  v=c.find('s:v',n);ins=c.find('s:is',n);x=v.text if v is not None else ''.join(ins.itertext()) if ins is not None else ''
  if c.get('t')=='s':x=ss[int(x)]
  out[c.get('r')]=x
 return out
h=(b/'original/report.html').read_bytes();p=P();p.feed(h.decode());n=P();n.feed((b/'original/news.html').read_text());news=' '.join(n.text);text=' '.join(p.text)
checks=[]
def check(name,value):
 checks.append({'check':name,'pass':bool(value)})
 if not value:raise ValueError(name)
check('exact_report_period', 'July 2025 to June 2026' in text)
check('publication_date', '03 September 2026' in text)
check('gross_final_definition', 'plus imports of electricity minus exports' in text)
check('own_use_included', 'own use' in text)
check('revision_policy', 'may be subject to revision' in text)
expected=[('renewable_share_gfec',1,'B94',50,'%',0,'Rolling 12-month renewable generation'),('gross_final_consumption',5,'B94',8865,'GWh',2,'Gross Final Electricity Consumption'),('renewable_generation',5,'C94',4431,'GWh',2,'Total renewable generation'),('non_renewable_generation',5,'D94',3855,'GWh',2,'Total non-renewable generation'),('net_imports',5,'E94',578,'GWh',2,'Net imports (Imports - Exports)')]
obs=[]
for name,link,cell,val,unit,chart,trace in expected:
 raw=base64.b64decode(p.links[link]['href'].split(',',1)[1]);cells=workbook(raw)
 check(name+'_xlsx_value',float(cells[cell])==val)
 date=(datetime.date(1899,12,30)+datetime.timedelta(days=float(cells['A94']))).isoformat()
 check(name+'_xlsx_month',date=='2026-06-01')
 ts=[t for t in p.jsons[chart]['x']['data'] if t.get('name')==trace]
 check(name+'_unique_trace',len(ts)==1)
 check(name+'_plotly_value_period',ts[0]['x'][-1]=='2026-06-01' and ts[0]['y'][-1]==val)
 check(name+'_dated_news',f'{val:,}' in news if unit=='GWh' else '50%' in news)
 obs.append({'measure':name,'value':val,'unit':unit,'geography':'Northern Ireland','period_start':'2025-07-01','period_end':'2026-06-30','period_convention':'rolling 12-month total or ratio of those totals','publisher_date':'2026-09-03','xlsx_html_link_index':link+1,'cell':cell,'xlsx_sha256':hashlib.sha256(raw).hexdigest(),'plotly_trace':trace})
check('rounded_component_sum_tolerance',abs(8865-(4431+3855+578))<=2)
check('rounded_share_tolerance',abs(100*4431/8865-50)<=0.5)
report={'pass':True,'verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Python stdlib XML extraction against separately decoded chart JSON and separately written dated DfE news; shared publisher/source lineage','independent_statistical_lineage':False,'checks':checks,'observations':obs,'original_report_sha256':hashlib.sha256(h).hexdigest(),'news_sha256':hashlib.sha256((b/'original/news.html').read_bytes()).hexdigest(),'production_acceptance':False}
print(json.dumps(report,indent=2))
