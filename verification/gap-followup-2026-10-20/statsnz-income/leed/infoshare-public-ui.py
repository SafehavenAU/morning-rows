#!/usr/bin/env python3
"""Authorized ordinary public browse interaction; no keys, hidden-state output or retries.
The prior plain GET403 remains separate. This script identifies itself transparently
and uses normal cookies and fields returned by the visible ASP.NET form.
"""
from pathlib import Path
import http.cookiejar,urllib.request,urllib.parse,urllib.error,html.parser,re,json,datetime,hashlib,sys
ROOT=Path(__file__).resolve().parent
class Page(html.parser.HTMLParser):
 def __init__(self):super().__init__();self.fields={};self.links=[];self.active=None;self.action=None;self.selects=[];self.select=None;self.option=None;self.controls=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='input'and a.get('type')=='hidden':self.fields[a['name']]=a.get('value','')
  elif t=='input':self.controls.append({k:v for k,v in a.items()if k in ['name','type','value']})
  if t=='form':self.action=a.get('action')
  if t=='a':self.active=[a.get('href',''),'']
  if t=='select':self.select={'name':a.get('name'),'options':[]};self.selects.append(self.select)
  if t=='option'and self.select is not None:self.option={'value':a.get('value'),'label':''};self.select['options'].append(self.option)
 def handle_endtag(self,t):
  if t=='a'and self.active:self.links.append(self.active);self.active=None
  if t=='option':self.option=None
  if t=='select':self.select=None
 def handle_data(self,d):
  if self.active:self.active[1]+=d
  if self.option is not None:self.option['label']+=d
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));opener.addheaders=[('User-Agent','Morning-Rows-evidence-review/1.0')]
records=[];page=None;current=None
manifest=ROOT/'ui-acquisitions.json'
if manifest.exists():raise RuntimeError('Refuse to overwrite existing capture')
def public_url(url):
 p=urllib.parse.urlsplit(url);path=re.sub(r'/\(X\([^/]+\)\)/','/',p.path)
 return urllib.parse.urlunsplit((p.scheme,p.netloc,path,'',''))
def save():manifest.write_text(json.dumps({'method':'Ordinary documented public Infoshare form navigation, transparent project user agent, standard cookies; no protected API, keys or alternate proxy. Session paths, query identifiers, cookie values and hidden fields are not retained. The prior403 remains separate and its cause is unknown.','requests':records},indent=2)+'\n')
def request(url,data=None,label='entry',export=None):
 global page,current
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:r=opener.open(url,urllib.parse.urlencode(data,doseq=True).encode()if data is not None else None,timeout=30)
 except urllib.error.HTTPError as e:r=e
 body=r.read(2000001);assert len(body)<=2000000
 record={'label':label,'url':public_url(url),'method':'POST'if data is not None else'GET','started_at':start,'completed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':r.status,'content_type':r.headers.get('content-type'),'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()}
 records.append(record);save();print(json.dumps(record),flush=True)
 if r.status!=200:raise RuntimeError('Request refused; stop without retry')
 current=r.url;page=Page();page.feed(body.decode('utf8','replace'))
 if export:
  if page.action or b'<html'in body.lower():raise RuntimeError('Expected CSV, obtained HTML; no export retained')
  (ROOT/'original'/export).write_bytes(body);print(body.decode('utf8','replace')[:16000],flush=True)
 else:
  print(json.dumps({'visible_links':[label.strip()for _,label in page.links if label.strip()],'selection_controls':page.selects,'nonhidden_inputs':page.controls},ensure_ascii=False),flush=True)
def follow(label):
 matches=[href for href,text in page.links if text.strip()==label]
 if len(matches)!=1:raise RuntimeError('Visible label is not unique')
 href=matches[0];m=re.fullmatch(r"javascript:__doPostBack\('([^']*)','((?:[^'\\]|\\.)*)'\)",href)
 if not m:raise RuntimeError('Visible link is not an ordinary form event')
 target,arg=m.groups();arg=arg.replace('\\\\','\\').replace("\\'", "'")
 request(urllib.parse.urljoin(current,page.action),{**page.fields,'__EVENTTARGET':target,'__EVENTARGUMENT':arg},label)
request('https://infoshare.stats.govt.nz/',label='public browse landing')
while True:
 try:line=input()
 except EOFError:break
 if not line:continue
 command=json.loads(line)
 if command.get('stop'):break
 if 'follow'in command:follow(command['follow'])
 elif 'export'in command:
  selection=command['selection'];request(urllib.parse.urljoin(current,page.action),{**page.fields,**selection},command.get('label','selected CSV'),command['export'])
 else:raise RuntimeError('Unsupported command')
