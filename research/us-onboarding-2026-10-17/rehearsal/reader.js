// Isolated planning rehearsal. Not imported by the production Worker.
export const SERIES='CUUR0000SA0';
export const URLS={data:'https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems',series:'https://download.bls.gov/pub/time.series/cu/cu.series',footnotes:'https://download.bls.gov/pub/time.series/cu/cu.footnote'};
export const fail=code=>{throw new Error(code);};
const rows=(text,onlySeries=false)=>{
 const lines=text.split(/\r?\n/),head=lines.shift().split('\t').map(x=>x.trim());
 return lines.filter(line=>line.length&&(!onlySeries||line.split('\t',1)[0].trim()===SERIES)).map(line=>{const cells=line.split('\t');if(cells.length!==head.length)fail('malformed_tsv');return Object.fromEntries(head.map((h,i)=>[h,cells[i].trim()]));});
};
export function parse(files){
 const series=rows(files.series,true);
 if(series.length!==1)fail('metadata_coverage');
 const definition=series[0];
 for(const [key,value] of Object.entries({area_code:'0000',item_code:'SA0',seasonal:'U',periodicity_code:'R',base_code:'S',base_period:'1982-84=100'}))if(definition[key]!==value)fail('incompatible_definition');
 const notes=Object.fromEntries(rows(files.footnotes).map(r=>[r.footnote_code,r.footnote_text]));
 const selected=rows(files.data,true);
 const monthly=selected.filter(r=>r.period!=='M13');
 if(!monthly.length||monthly.some(r=>!/^M(0[1-9]|1[0-2])$/.test(r.period)||!/^\d{4}$/.test(r.year)))fail('invalid_period');
 const latest=monthly.map(r=>`${r.year}-${r.period.slice(1)}`).sort().at(-1);
 const metadataEnd=`${definition.end_year}-${definition.end_period==='M13'?'12':definition.end_period.slice(1)}`;
 if(metadataEnd!==latest)fail('metadata_release_mismatch');
 const [y,m]=latest.split('-').map(Number),end=y*12+m-1;
 const expected=Array.from({length:13},(_,i)=>{const n=end-12+i;return `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;});
 const observations=new Map();
 for(const r of monthly){
  const period=`${r.year}-${r.period.slice(1)}`;
  if(!expected.includes(period))continue;
  if(observations.has(period))fail('duplicate_period');
  const footnotes=r.footnote_codes.split(',').filter(Boolean).map(code=>{if(!notes[code])fail('unknown_footnote');return{code,text:notes[code]};});
  const unavailable=footnotes.some(n=>n.code==='X');
  if(unavailable&&r.value!=='-')fail('numeric_with_unavailable_flag');
  if(r.value!=='-'&&!/^\d+(?:\.\d+)?$/.test(r.value))fail('malformed_value');
  const value=r.value==='-'?null:Number(r.value);
  if(value!==null&&(!Number.isFinite(value)||value<=0))fail('nonpositive_index_anomaly');
  observations.set(period,{period,value,value_text:r.value,value_state:value===null?(unavailable?'unavailable':'missing'):'observed',footnotes});
 }
 if(observations.size!==13)fail('incomplete_window');
 return{series_id:SERIES,definition,latest_period:latest,window:{first:expected[0],last:latest,slots:13},observations:expected.map(p=>observations.get(p)),source_url:URLS.data,licence:'Public domain; cite US Bureau of Labor Statistics',note:'National urban CPI-U, NSA, 1982-84=100; exact monthly indexes, no contract interpretation or substituted dates. Publication times not inferred from retrieval.'};
}
export async function boundedText(response,maximum){
 if(!response.ok){await response.body?.cancel();fail(`upstream_http_${response.status}`);}
 if(Number(response.headers.get('content-length'))>maximum){await response.body?.cancel();fail('body_limit');}
 if(!response.body)fail('empty_body');
 const reader=response.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maximum){await reader.cancel();fail('body_limit');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
 finally{reader.releaseLock();}
 return{text,bytes};
}
export async function acquire(fetcher=fetch,{maximum=8*1024*1024,deadline=20000}={}){
 const controller=new AbortController(),start=Date.now();const timer=setTimeout(()=>controller.abort(),deadline);
 const transport={};
 const results=await Promise.allSettled(Object.entries(URLS).map(async([name,url])=>{const response=await fetcher(url,{signal:controller.signal});transport[name]={status:response.status};const r=await boundedText(response,maximum);transport[name].bytes=r.bytes;return{name,...r};}));
 clearTimeout(timer);
 const metrics={fetches:3,transport,bytes:Object.fromEntries(results.filter(r=>r.status==='fulfilled').map(r=>[r.value.name,r.value.bytes])),elapsed_ms:Date.now()-start};
 if(controller.signal.aborted)throw Object.assign(new Error('source_deadline'),{metrics});
 const rejected=results.find(r=>r.status==='rejected');if(rejected)throw Object.assign(rejected.reason,{metrics});
 const files=Object.fromEntries(results.map(r=>[r.value.name,r.value.text]));
 return{data:parse(files),metrics};
}
