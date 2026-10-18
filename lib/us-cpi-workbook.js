import {unzipSync, strFromU8} from 'fflate';
import {SourceError} from './sources.js';
import {CPI_SERIES, cpiWindow, cpiResult, readCpiText} from './us-cpi.js';
export const CPI_INDEX='https://www.bls.gov/cpi/tables/supplemental-files/home.htm';
const fail=reason=>{throw new SourceError('BLS CPI workbook: '+reason);};
const requireValue=(test,reason)=>{if(!test)fail(reason);};
const title='Historical Consumer Price Index for All Urban Consumers (CPI-U): U.S. city average, all items, by month';
const note='NOTE: The Oct 2025 data values are not available due to the 2025 lapse in appropriations.';
const months=['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sep.','Oct.','Nov.','Dec.'];
const unescape=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[x]));
function attributes(text){
 const out={};let end=0;
 for(const m of text.matchAll(/\s+([\w:.-]+)="([^"<>]*)"/g)){
  requireValue(!text.slice(end,m.index).trim()&&!Object.hasOwn(out,m[1])&&!/&(?!(?:amp|lt|gt|quot|apos);)/.test(m[2]),'invalid_attributes');out[m[1]]=unescape(m[2]);end=m.index+m[0].length;
 }
 requireValue(!text.slice(end).trim(),'invalid_attributes');return out;
}
export function selectCpiWorkbook(html){
 const choices=[];
 for(const m of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
  if(!m[1].includes('historical-cpi-u-'))continue;
  const links=[...m[1].matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi)];
  for(const link of links){const url=new URL(unescape(link[1]),CPI_INDEX);const part=/^\/cpi\/tables\/supplemental-files\/historical-cpi-u-(\d{4})(0[1-9]|1[0-2])\.xlsx$/.exec(url.pathname);
   if(!part)continue;requireValue(url.origin==='https://www.bls.gov'&&!url.search&&!url.hash,'unexpected_workbook_origin');
   requireValue(/^Historical CPI-U, /.test(link[2])&&links.some(l=>new URL(unescape(l[1]),CPI_INDEX).href===`https://data.bls.gov/timeseries/${CPI_SERIES}?years_option=all_years`),'series_link_mismatch');
   choices.push({url:url.href,period:part[1]+'-'+part[2]});
  }
 }
 requireValue(choices.length>0,'no_published_edition');choices.sort((a,b)=>b.period.localeCompare(a.period));requireValue(choices.filter(c=>c.period===choices[0].period).length===1,'ambiguous_latest_edition');return choices[0];
}
// Deliberately narrow, bounded XLSX reader for this publisher layout. It reads
// only cached scalar cells, never formulas, macros, external data or HTML.
export function parseCpiWorkbook(bytes,edition){
 requireValue(bytes instanceof Uint8Array&&bytes.length<=131072,'input_limit');let expanded=0,count=0;const names=new Set();
 const files=unzipSync(bytes,{filter(f){requireValue(++count<=32&&!names.has(f.name),'zip_entries');names.add(f.name);const wanted=/^xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet\d+.xml)$/.test(f.name);if(wanted){expanded+=f.originalSize;requireValue(f.originalSize<=262144&&expanded<=524288,'expanded_limit');}return wanted;}});
 const xml=path=>{requireValue(files[path],'missing_part');const s=strFromU8(files[path]);requireValue(!/<!|<f(?:\s|>)|<extLst\b/.test(s),'unsupported_xml');return s;};
 const book=xml('xl/workbook.xml'),rels=xml('xl/_rels/workbook.xml.rels');
 const sheets=[...book.matchAll(/<sheet\s([^<>]*?)\/>/g)].map(m=>attributes(' '+m[1])).filter(s=>s.name==='Index values');requireValue(sheets.length===1,'sheet_identity');
 const relationships=[...rels.matchAll(/<Relationship\s([^<>]*?)\/>/g)].map(m=>attributes(' '+m[1]));requireValue(relationships.every(r=>!r.TargetMode),'external_relationship');
 const rel=relationships.filter(r=>r.Id===sheets[0]['r:id']);requireValue(rel.length===1&&rel[0].Type==='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'&&/^worksheets\/sheet\d+\.xml$/.test(rel[0].Target),'sheet_relationship');
 const shared=xml('xl/sharedStrings.xml'),strings=[];
 const stringBody=shared.match(/<sst\b[^>]*>([\s\S]*)<\/sst>/);requireValue(stringBody,'shared_strings');let offset=0;
 for(const m of stringBody[1].matchAll(/<si><t(?: xml:space="preserve")?(?:\/>|>([^<]*)<\/t>)<\/si>/g)){
  requireValue(!stringBody[1].slice(offset,m.index).trim()&&!/&(?!(?:amp|lt|gt|quot|apos);)/.test(m[1]||''),'unsupported_string');strings.push(unescape(m[1]||''));offset=m.index+m[0].length;
 }
 requireValue(!stringBody[1].slice(offset).trim()&&strings.length<=512,'unsupported_string');
 const sheet=xml('xl/'+rel[0].Target),data=sheet.match(/<sheetData>([\s\S]*?)<\/sheetData>/);requireValue(data,'sheet_data');
 const yearRows=new Map(),special=new Map();let last=0;const rowIds=new Set();
 const cells=raw=>{const out=new Map();let pos=0;
  for(const m of raw.matchAll(/<c\s([^<>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   requireValue(!raw.slice(pos,m.index).trim(),'unsupported_cell');pos=m.index+m[0].length;const a=attributes(' '+m[1]);requireValue(/^[A-N][1-9]\d{0,3}$/.test(a.r||'')&&!out.has(a.r),'cell_identity');
   let value=null;if(m[2]){const v=/^<v>([^<>]*)<\/v>$/.exec(m[2]);requireValue(v,'unsupported_cell_value');if(a.t==='s'){requireValue(/^\d+$/.test(v[1])&&Number(v[1])<strings.length,'string_index');value=strings[Number(v[1])];}else{requireValue((!a.t||a.t==='n')&&/^-?\d+(?:\.\d+)?$/.test(v[1]),'numeric_type');value=Number(v[1]);requireValue(Number.isFinite(value),'nonfinite');}}
   out.set(a.r,value);
  }
  requireValue(!raw.slice(pos).trim(),'unsupported_cell');return out;
 };
 for(const m of data[1].matchAll(/<row\s([^<>]*?)>([\s\S]*?)<\/row>/g)){
  requireValue(!data[1].slice(last,m.index).trim(),'unsupported_row');last=m.index+m[0].length;const id=attributes(' '+m[1]).r;requireValue(/^[1-9]\d{0,3}$/.test(id||'')&&!rowIds.has(id),'row_identity');rowIds.add(id);
  // Determine year using the published B-column shared string before parsing
  // unrelated historical cells. Only two years enter the 13-month contract.
  const b=new RegExp('<c r="B'+id+'"[^>]* t="s"><v>(\\d+)</v></c>').exec(m[2]);
  const year=b?strings[Number(b[1])]:null;
  if(/^\d{4}$/.test(year||'')){requireValue(!yearRows.has(year),'duplicate_year');yearRows.set(year,{id,raw:m[2]});}
  else special.set(id,cells(m[2]));
 }
 requireValue(!data[1].slice(last).trim(),'unsupported_row');
 requireValue(special.get('1')?.get('B1')===title&&special.get('2')?.get('B2')==='[1982-84=100, unless otherwise noted]','definition_changed');
 requireValue(special.get('4')?.get('B4')==='Year'&&months.every((m,i)=>special.get('4').get(String.fromCharCode(67+i)+'4')===m),'month_headers');
 const allowedText=new Set(['',title,'[1982-84=100, unless otherwise noted]','Indent Level','Year',...months,note]);
 requireValue([...special.values()].every(c=>[...c.values()].every(v=>v===null||v===0||allowedText.has(v))),'unknown_sheet_text');
 const notes=[...special.values()].flatMap(c=>[...c.values()]).filter(v=>typeof v==='string'&&v.startsWith('NOTE'));
 requireValue(notes.length<=1&&notes.every(n=>n===note),'unknown_qualification');
 const window=cpiWindow(edition),year=edition.slice(0,4);requireValue([...yearRows.keys()].sort().at(-1)===year,'edition_mismatch');
 const selected=new Map();for(const y of new Set(window.map(p=>p.slice(0,4)))){requireValue(yearRows.has(y),'missing_year');const r=yearRows.get(y),values=cells(r.raw);requireValue([...values.keys()].every(k=>k.slice(1)===r.id)&&values.get('B'+r.id)===y,'year_mapping');selected.set(y,{...r,values});}
 const latest=selected.get(year);for(let m=Number(edition.slice(5))+1;m<=12;m++)requireValue(latest.values.get(String.fromCharCode(66+m)+latest.id)==='–','future_month');
 const rows=window.map(period=>{const r=selected.get(period.slice(0,4)),ref=String.fromCharCode(66+Number(period.slice(5)))+r.id;requireValue(r.values.has(ref),'missing_cell');const v=r.values.get(ref);
  if(v==='–'){const unavailable=period==='2025-10'&&notes.includes(note);return {period,value:null,value_text:'-',value_state:unavailable?'unavailable':'missing',footnotes:unavailable?[{code:'X',text:'Data unavailable due to the 2025 lapse in appropriations'}]:[]};}
  requireValue(typeof v==='number'&&v>0&&Math.abs(v-Number(v.toFixed(3)))<=1e-9,'invalid_index');requireValue(!(period==='2025-10'&&notes.includes(note)),'numeric_unavailable');return {period,value:Number(v.toFixed(3)),value_text:v.toFixed(3),value_state:'observed',footnotes:[]};
 });requireValue(rows.at(-1).value!==null,'latest_missing');return cpiResult(rows,edition);
}
export async function readUsCpiWorkbook({fetcher=fetch,deadline=20000}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),deadline);const headers={'User-Agent':'MorningRows/1.0 (+https://morningrows.com)',accept:'*/*'};
 const get=url=>fetcher(url,{signal:controller.signal,headers});
 try{
  const index=await readCpiText(await get(CPI_INDEX),262144),edition=selectCpiWorkbook(index.text),response=await get(edition.url);
  if(!response.ok){await response.body?.cancel();throw new SourceError(`BLS CPI returned HTTP ${response.status}`,response.status);}
  requireValue(response.body&&Number(response.headers.get('content-length'))<=131072,'input_limit');const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;requireValue(size<=131072,'input_limit');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;for(const b of chunks){bytes.set(b,at);at+=b.length;}
  const result=parseCpiWorkbook(bytes,edition.period);
  const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
  result.provenance=[{kind:'publisher_index',url:CPI_INDEX,bytes:index.bytes,sha256:await hash(new TextEncoder().encode(index.text)),hash_basis:'Decoded UTF-8 publisher index'},{kind:'publisher_workbook',url:edition.url,bytes:size,sha256:await hash(bytes),hash_basis:'Original XLSX bytes',edition:edition.period,sheet:'Index values',mapping:'Year column B; Jan.–Dec. columns C:N; exact 13 calendar cells',rounding:'Three decimal places, accepting only binary XLSX artifacts within 1e-9 index point'}];
  requireValue(!controller.signal.aborted,'source_deadline');return result;
 }finally{clearTimeout(timer);}
}
