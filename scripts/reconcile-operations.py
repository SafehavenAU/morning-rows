"""Separate Python extraction, not an independent agent/statistical source.
Fetches only public aggregate data. Retains selected cells + hashes, no staff metadata.
Run: python scripts/reconcile-operations.py <output-directory>
"""
import csv,io,json,hashlib,sys,urllib.request,urllib.parse,datetime,pathlib
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
checked=datetime.datetime.now(datetime.timezone.utc).isoformat();probes=[]
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'MorningRows aggregate verification','Accept':'*/*'})
    try:
        with urllib.request.urlopen(req,timeout=35) as r:
            raw=r.read(2*1024*1024+1)
            if len(raw)>2*1024*1024:raise ValueError('Response too large')
            probes.append({'url':url,'status':r.status,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
            return raw.decode('utf-8-sig')
    except Exception as e:
        probes.append({'url':url,'error':str(e),'at':datetime.datetime.now(datetime.timezone.utc).isoformat()});raise

def save(name,result):
    (out/(name+'.json')).write_text(json.dumps({'checked_at':checked,**result},indent=2)+'\n')
def boc():
    codes=['FXUSDCAD','FXAUDCAD','FXGBPCAD','FXNZDCAD'];base='https://www.bankofcanada.ca/valet/observations/'+','.join(codes)
    data=json.loads(get(base+'/json?recent=1'));text=get(base+'/csv?recent=1')
    lines=list(csv.reader(io.StringIO(text)));header=next(i for i,r in enumerate(lines)if r and r[0]=='date')
    selected=[dict(zip(lines[header],r)) for r in lines[header+1:] if len(r)==len(lines[header])][-1]
    latest=data['observations'][-1];assert latest['d']==selected['date']
    pairs=[{'series':c,'value':float(latest[c]['v']),'csv_value':float(selected[c]),'unit':'CAD per 1 '+c[2:5]} for c in codes]
    assert all(p['value']==p['csv_value'] and p['value']>0 for p in pairs)
    save('boc',{'period':latest['d'],'pairs':pairs,'series_detail':{c:data['seriesDetail'][c] for c in codes},'specimen':{'json':latest,'csv':selected},'licence':'Bank of Canada terms, attribution and accurate presentation','terms':'https://www.bankofcanada.ca/terms/','lineage':'Official Valet JSON and CSV are separate formats of the same underlying observations; no independent statistical confirmation.','comparison':'Exact equality across all four pairs and business date','status':'reconciled'})
def pharmacies():
    p=json.loads(get('https://opendata.nhsbsa.net/api/3/action/package_show?id=pharmacy-openings-and-closures'))['result']
    import re
    resources=[r for r in p['resources'] if re.fullmatch(r'PHARMACY_OPENCLOSE_\d{6}(NEW)?',r['name'])];latest=max(resources,key=lambda r:r['name'][19:25]);rid=latest['id']
    rows=list(csv.DictReader(io.StringIO(get(latest['url']))));row=max(rows,key=lambda r:r['DATE'])
    api='https://opendata.nhsbsa.net/api/3/action/datastore_search?resource_id='+rid+'&limit=1000'
    body=json.loads(get(api))['result'];assert body['total']==len(body['records'])
    alt=max(body['records'],key=lambda r:int(r['DATE']));assert str(alt['DATE'])==row['DATE']
    keys=['TOTAL_PHARMACIES','TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS','TOTAL_DISTANCE_SELLING_PHARMACIES','TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_OPENED','TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_CLOSED','PHARMACIES_EXCLUDING_DISTANCE_SELLERS_NET_CHANGE','DISTANCE_SELLERS_OPENED','DISTANCE_SELLERS_CLOSED','DISTANCE_SELLERS_NET_CHANGE'];row={k:row[k] for k in ['DATE']+keys}
    assert all(int(row[k])==alt[k] for k in keys)
    r={k:int(v)for k,v in row.items()};assert r['TOTAL_PHARMACIES']==r['TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS']+r['TOTAL_DISTANCE_SELLING_PHARMACIES']
    assert r['TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_OPENED']-r['TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_CLOSED']==r['PHARMACIES_EXCLUDING_DISTANCE_SELLERS_NET_CHANGE']
    assert r['DISTANCE_SELLERS_OPENED']-r['DISTANCE_SELLERS_CLOSED']==r['DISTANCE_SELLERS_NET_CHANGE']
    save('pharmacies',{'resource':{k:latest.get(k)for k in ['id','name','url','last_modified','created']},'csv_row':row,'datastore_row':{k:alt[k]for k in row},'licence':p['license_id'],'dataset_modified':p.get('metadata_modified'),'lineage':'Publisher CSV independently parsed with Python and compared with NHSBSA datastore API. Same underlying NHSBSA release; no independent administrative census.','comparison':'All nine fields, month-end date, stock total and both flow identities exact','status':'reconciled'})
def insolvencies():
    collection=json.loads(get('https://www.gov.uk/api/content/government/collections/company-insolvency-statistics-releases'))
    import re
    months=['january','february','march','april','may','june','july','august','september','october','november','december']
    candidates=[]
    for d in collection['links']['documents']:
        m=re.fullmatch(r'/government/statistics/company-insolvencies-([a-z]+)-(\d{4})',d['base_path'])
        if m and m[1] in months and not d.get('withdrawn'):candidates.append((f'{m[2]}-{months.index(m[1])+1:02}',d['base_path']))
    period,path=max(candidates);meta=json.loads(get('https://www.gov.uk/api/content'+path));attachments=meta['details']['attachments']
    dataurl=next(a['url']for a in attachments if a['title'].startswith('Long-Run Series in CSV Format - Company Insolvency Statistics'))
    metaurl=next(a['url']for a in attachments if a['title'].startswith('Metadata for Long-Run Series in CSV Format - Company Insolvency Statistics'))
    data=list(csv.DictReader(io.StringIO(get(dataurl))));row=max(data,key=lambda r:r['period']);assert row['period']==period
    metadata=list(csv.reader(io.StringIO(get(metaurl))))
    codes=[f'{k}_{country}_nsa'for country in ['sc','ni']for k in ['total','compliq','cvl','admin','cva','rec']]
    values={c:int(row[c])for c in codes}
    for country in ['sc','ni']:assert values['total_'+country+'_nsa']==sum(values[k+'_'+country+'_nsa']for k in ['compliq','cvl','admin','cva','rec'])
    definitions=[r for r in metadata if r and r[0] in codes+['Release date','Expiry date','Licence','URL','More information']]
    htmls=[a for a in attachments if a.get('content_type')=='text/html' or 'commentary' in a.get('title','').lower()]
    publication=urllib.parse.urljoin('https://www.gov.uk',htmls[0]['url']) if len(htmls)==1 else None
    # Keep separately presented publication for inspection without staff contacts.
    text=get(publication) if publication else ''
    from html.parser import HTMLParser
    class Tables(HTMLParser):
        def __init__(self):super().__init__();self.depth=0;self.parts=[]
        def handle_starttag(self,t,a):
            if t=='table':self.depth+=1
        def handle_endtag(self,t):
            if t=='table':self.depth-=1
            if self.depth and t in ['td','th','tr']:self.parts.append(' | ')
        def handle_data(self,d):
            if self.depth:self.parts.append(d.strip())
    parser=Tables();parser.feed(text);tables=' '.join(parser.parts)
    save('insolvencies',{'period':period,'values':values,'definitions':definitions,'data_url':dataurl,'metadata_url':metaurl,'publication_url':publication,'publication_tables':tables,'html_options':[{k:a.get(k)for k in ['title','url','content_type']}for a in htmls],'licence':'Open Government Licence v3.0','lineage':'Python CSV extraction and official statistical commentary use the same Insolvency Service release. Table comparison requires explicit matched geography/procedure cells, not number search.','component_totals':'Exact for both national selections','status':'extracted; publication comparison pending'})
for name,fn in [('boc',boc),('pharmacies',pharmacies),('insolvencies',insolvencies)]:
    if len(sys.argv)>2 and name not in sys.argv[2:]:continue
    try:fn();print(name+': evidence retained')
    except Exception as e:save(name+'-blocked',{'status':'blocked','reason':type(e).__name__+': '+str(e)});print(name+': blocked (see evidence)')
save('probes',{'probes':probes})
