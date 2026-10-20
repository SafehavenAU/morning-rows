"""One-time minimisation of already acquired publisher data-value payloads; no HTTP."""
from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parent
for path in sorted((ROOT/'original').glob('*.json')):
 d=json.loads(path.read_text())
 if 'payloads' not in d:continue
 payloads=d.pop('payloads'); page=next((p for p in payloads if isinstance(p,dict)and'PageBlocks'in p),None)
 foot=next((p for p in payloads if isinstance(p,dict)and'Copyright'in p),{})
 d.pop('links',None)
 d['extraction']='Python HTMLParser decoded the original HTML data-value JSON. Retained fields/sections are exact publisher values; acquisition hash binds the full HTTP body, which is not retained.'
 if foot:d['publisher_reuse_notice']=foot.get('Copyright')
 if page:
  d['page']={k:page[k]for k in ['ID','Title','PageDate','PageLink']if k in page}
  if path.stem=='csv-index':
   docs=[]
   for block in page['PageBlocks']:
    for doc in block.get('BlockDocuments',[]):docs.append({'section':block['Title'],**{k:doc[k]for k in ['Title','DocumentLink','DocumentSize']if k in doc}})
   d['published_downloads']=docs
   d['leed_downloads_found']=[x for x in docs if re.search(r'\bleed\b|linked.?employer',json.dumps(x),re.I)]
  elif path.stem.endswith('release'):
   d['page']['PageBlocks']=page['PageBlocks']
  elif path.stem in ['annual-methods-canonical','quarter-methods']:
   content='\n'.join(b.get('Content','')for b in page['PageBlocks'])
   sections=[]
   chunks=re.split(r'(?=<h[23](?:>|\s))',content)
   keep={'annual-methods-canonical':['Data sources','Self-employment data sources','Population','Sources of income','ACC payments','Income-tested benefits','Person counts','Published data tables','Part 1','Rounding and cell suppression','Timing','Time series'],'quarter-methods':['Population','Definitions of measures','Timing of the measures','Timeframe for production']}[path.stem]
   for chunk in chunks:
    m=re.match(r'<h[23][^>]*>(.*?)</h[23]>',chunk,re.S)
    if m:
     title=re.sub('<[^>]+>','',m.group(1)).strip()
     if any(title.startswith(k)for k in keep):sections.append({'heading':title,'html':chunk})
   d['sections']=sections
  else:d['finding']='Discovery context only; no exact selected-cell export retained from this page.'
 else:
  d['finding']='No usable LEED exact-cell table was obtained from this request.'
  d.pop('visible_text',None)
 path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
targets=json.loads((ROOT.parents[2]/'gap-pass-2026-10-20/statsnz/reader-targets.json').read_text())
ids={'LEED_AP1_001','LEED_AP1_002','LEED_Q1W_001'}
out={k:targets[k]for k in ['capture_file','capture_sha256','warning']if k in targets}
out['rows']=[r for r in targets['rows']if r['id']in ids]
(ROOT/'pinned-reader-targets.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
