// Fixed-edition original-PDF reader. Production acquisition is pinned to independently
// reviewed complete bytes AND structurally derives every value; no static data fallback.
// The pure parser is also used with explicitly constructed statistical fixtures offline.
// Complete DEFLATE checks deliberately target the pinned fflate 0.8.3 streaming API.
import {Unzlib} from 'fflate';
const need=(ok,message)=>{if(!ok)throw Error('Bounded PDF: '+message);};
const white=b=>b===0||b===9||b===10||b===12||b===13||b===32;
const delimiter=b=>b===40||b===41||b===60||b===62||b===91||b===93||b===123||b===125||b===47||b===37;
const word=(value)=>({kind:'word',value});
const marker=value=>({kind:'delimiter',value});
export const nameOf=value=>value?.kind==='name'?value.value:null;
export const isRef=value=>value?.kind==='ref'&&Number.isSafeInteger(value.id)&&value.id>0&&value.generation===0;
const dict=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===null;
const ascii=bytes=>{let text='';for(let i=0;i<bytes.length;i++)text+=String.fromCharCode(bytes[i]);return text;};
const integer=value=>Number.isSafeInteger(value)&&value>=0;
export class PdfLexer{
 constructor(bytes,{offset=0,end=bytes.length,maxTokens=200000,maxDepth=32,maxString=65536}={}){need(bytes instanceof Uint8Array&&integer(offset)&&integer(end)&&offset<=end&&end<=bytes.length,'Invalid lexer bounds');this.bytes=bytes;this.pos=offset;this.end=end;this.maxTokens=maxTokens;this.maxDepth=maxDepth;this.maxString=maxString;this.tokens=0;}
 skip(){while(this.pos<this.end){const b=this.bytes[this.pos];if(white(b)){this.pos++;continue;}if(b===37){while(this.pos<this.end&&this.bytes[this.pos]!==10&&this.bytes[this.pos]!==13)this.pos++;continue;}break;}}
 next(){
  this.skip();if(this.pos===this.end)return undefined;need(++this.tokens<=this.maxTokens,'Token limit exceeded');const b=this.bytes[this.pos++];
  if(b===91)return marker('[');if(b===93)return marker(']');
  if(b===60){if(this.bytes[this.pos]===60){this.pos++;return marker('<<');}const out=[];let high=null,closed=false;while(this.pos<this.end){const c=this.bytes[this.pos++];if(c===62){closed=true;break;}if(white(c))continue;const hex=String.fromCharCode(c);need(/[0-9a-fA-F]/.test(hex),'Invalid hexadecimal string');const n=parseInt(hex,16);if(high===null)high=n;else{out.push(high*16+n);high=null;}need(out.length<=this.maxString,'Hex string limit exceeded');}need(closed,'Unterminated hexadecimal string');if(high!==null)out.push(high*16);return {kind:'string',bytes:Uint8Array.from(out)};}
  if(b===62){need(this.bytes[this.pos++]===62,'Unexpected dictionary close');return marker('>>');}
  if(b===40){const out=[];let depth=1;while(this.pos<this.end&&depth){let c=this.bytes[this.pos++];if(c===92){need(this.pos<this.end,'Unterminated escape');c=this.bytes[this.pos++];if(c===10)continue;if(c===13){if(this.bytes[this.pos]===10)this.pos++;continue;}const escaped={110:10,114:13,116:9,98:8,102:12};if(Object.hasOwn(escaped,c))out.push(escaped[c]);else if(c>=48&&c<=55){let value=c-48;for(let k=0;k<2&&this.pos<this.end&&this.bytes[this.pos]>=48&&this.bytes[this.pos]<=55;k++)value=value*8+this.bytes[this.pos++]-48;out.push(value&255);}else out.push(c);}else if(c===40){need(++depth<=this.maxDepth,'String nesting exceeded');out.push(c);}else if(c===41){if(--depth)out.push(c);}else if(c===13){if(this.bytes[this.pos]===10)this.pos++;out.push(10);}else out.push(c);need(out.length<=this.maxString,'Literal string limit exceeded');}need(depth===0,'Unterminated literal string');return {kind:'string',bytes:Uint8Array.from(out)};}
  if(b===47){const out=[];while(this.pos<this.end&&!white(this.bytes[this.pos])&&!delimiter(this.bytes[this.pos])){let c=this.bytes[this.pos++];if(c===35){need(this.pos+1<this.end,'Truncated escaped name');const h=ascii(this.bytes.subarray(this.pos,this.pos+2));need(/^[0-9a-fA-F]{2}$/.test(h),'Invalid escaped name');c=parseInt(h,16);this.pos+=2;}need(c>0&&c<128,'Unsupported name character');out.push(c);need(out.length<=256,'Name limit exceeded');}need(out.length>0,'Empty name');return {kind:'name',value:ascii(out)};}
  need(!delimiter(b),'Unexpected delimiter');const start=this.pos-1;while(this.pos<this.end&&!white(this.bytes[this.pos])&&!delimiter(this.bytes[this.pos]))this.pos++;const text=ascii(this.bytes.subarray(start,this.pos));need(text.length<=128,'Token length exceeded');
  if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)){const value=Number(text);need(Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER,'Unsafe number');return value;}
  if(text==='true')return true;if(text==='false')return false;if(text==='null')return null;return word(text);
 }
 value(depth=0){
  need(depth<=this.maxDepth,'Value nesting exceeded');const v=this.next();need(v!==undefined,'Unexpected end of PDF value');
  if(v?.kind==='delimiter'&&v.value==='['){const values=[];for(;;){const saved=this.pos,next=this.next();need(next!==undefined,'Unterminated array');if(next?.kind==='delimiter'&&next.value===']')return values;this.pos=saved;values.push(this.value(depth+1));need(values.length<=32768,'Array limit exceeded');}}
  if(v?.kind==='delimiter'&&v.value==='<<'){const obj=Object.create(null);for(;;){const key=this.next();need(key!==undefined,'Unterminated dictionary');if(key?.kind==='delimiter'&&key.value==='>>')return obj;need(key?.kind==='name'&&!Object.hasOwn(obj,key.value),'Invalid or duplicate dictionary key');obj[key.value]=this.value(depth+1);need(Object.keys(obj).length<=1024,'Dictionary limit exceeded');}}
  if(Number.isSafeInteger(v)&&v>=0){const saved=this.pos,n=this.next();if(Number.isSafeInteger(n)&&n>=0){const r=this.next();if(r?.kind==='word'&&r.value==='R'){need(v>0&&n===0,'Unsupported indirect reference generation');return {kind:'ref',id:v,generation:n};}}this.pos=saved;return v;}
  need(v?.kind!=='delimiter'&&v?.kind!=='word','Unexpected token as PDF value');return v;
 }
 complete(){this.skip();need(this.pos===this.end,'Unexpected trailing value data');}
}
function decodeZlib(raw,maxBytes){
 need(raw.length>=6&&raw.length<=262144,'Compressed stream bound exceeded');need((raw[0]&15)===8&&(raw[0]>>>4)<=7&&((raw[0]<<8)|raw[1])%31===0&&(raw[1]&32)===0,'Unsupported zlib header/dictionary');
 let a=1,b=0,size=0,final=false;const chunks=[];
 const unzip=new Unzlib((chunk,done)=>{size+=chunk.length;need(size<=maxBytes,'Inflated stream bound exceeded');for(let i=0;i<chunk.length;i++){a=(a+chunk[i])%65521;b=(b+a)%65521;}chunks.push(chunk);final=done;});
 // Small compressed chunks bound each expansion step; never inflate the full PDF.
 for(let i=0;i<raw.length;i+=128)unzip.push(raw.subarray(i,Math.min(i+128,raw.length)),i+128>=raw.length);
 need(final&&unzip.s?.f===1&&unzip.s?.l===null&&unzip.p?.length===(unzip.s.p?1:0),'Incomplete or trailing DEFLATE stream');
 const checksum=((raw.at(-4)*0x1000000)+(raw.at(-3)<<16)+(raw.at(-2)<<8)+raw.at(-1))>>>0;
 need(checksum===(((b<<16)|a)>>>0),'Zlib Adler32 mismatch');
 const output=new Uint8Array(size);let at=0;for(const chunk of chunks){output.set(chunk,at);at+=chunk.length;}return output;
}
export function openPdf(bytes){
 need(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=8388608,'PDF byte bound exceeded');need(ascii(bytes.subarray(0,8))==='%PDF-1.7','Unsupported PDF version');
 const trailer=ascii(bytes.subarray(Math.max(0,bytes.length-2048))),tail=/startxref\s+(\d+)\s+%%EOF\s*$/.exec(trailer);need(tail,'Missing final startxref/EOF');
 const entries=new Map(),objects=new Map(),decoded=new Map(),objectStreams=new Map(),resolving=new Set(),xrefOffsets=new Set();let root=null,size=null,totalInflated=0,objectReads=0;
 const stats={xref_sections:0,xref_entries:0,object_reads:0,inflated_streams:0,inflated_bytes:0,compressed_object_streams:0};
 const rawAt=(offset,expectedId=null)=>{
  need(integer(offset)&&offset<bytes.length,'Invalid object offset');const lex=new PdfLexer(bytes,{offset,maxTokens:20000});const id=lex.next(),generation=lex.next(),start=lex.next();
  need(integer(id)&&id>0&&generation===0&&start?.kind==='word'&&start.value==='obj'&&(expectedId===null||expectedId===id),'Indirect object header mismatch');
  const value=lex.value();let next=lex.next(),raw=null;
  if(next?.kind==='word'&&next.value==='stream'){
   need(dict(value),'Stream dictionary missing');let length=value.Length;if(isRef(length)){need(entries.size>0,'Indirect xref stream length unsupported');length=get(length);}need(integer(length)&&length<=bytes.length,'Invalid stream length');
   if(bytes[lex.pos]===13){lex.pos++;if(bytes[lex.pos]===10)lex.pos++;}else{need(bytes[lex.pos]===10,'Stream EOL missing');lex.pos++;}
   need(lex.pos+length<=bytes.length,'Truncated stream');raw=bytes.subarray(lex.pos,lex.pos+length);lex.pos+=length;next=lex.next();need(next?.kind==='word'&&next.value==='endstream','Stream length/end mismatch');next=lex.next();
  }
  need(next?.kind==='word'&&next.value==='endobj','Object end marker missing');return {id,dict:value,raw};
 };
 const inflateRecord=(record,maxBytes=262144)=>{
  need(record.raw!==null,'Object is not a stream');need(maxBytes>0&&maxBytes<=262144,'Invalid inflation limit');
  if(decoded.has(record.id)){const result=decoded.get(record.id);need(result.length<=maxBytes,'Cached stream exceeds requested bound');return result;}
  const d=record.dict;need(nameOf(d.Subtype)!=='Image','Image decoding prohibited');const filter=nameOf(d.Filter);need(d.Filter===undefined||d.Filter===null||filter==='FlateDecode','Unsupported selected stream filter');
  let result=filter==='FlateDecode'?decodeZlib(record.raw,maxBytes):record.raw.slice();need(result.length<=maxBytes,'Stream byte limit exceeded');
  const inflatedLength=result.length;
  if(d.DecodeParms!==undefined&&d.DecodeParms!==null){const parms=d.DecodeParms;need(dict(parms)&&Object.keys(parms).every(k=>['Predictor','Columns','Colors','BitsPerComponent'].includes(k))&&[1,12].includes(parms.Predictor??1)&&(parms.Colors===undefined||parms.Colors===1)&&(parms.BitsPerComponent===undefined||parms.BitsPerComponent===8)&&nameOf(d.Type)==='XRef','Unsupported selected DecodeParms');if(parms.Predictor===12){const columns=parms.Columns;need(integer(columns)&&columns>0&&columns<=12&&Array.isArray(d.W)&&d.W.reduce((a,b)=>a+b,0)===columns,'Invalid xref predictor columns');need(result.length%(columns+1)===0,'Invalid predictor row size');const out=new Uint8Array(result.length/(columns+1)*columns);for(let row=0;row<result.length/(columns+1);row++){need(result[row*(columns+1)]===2,'Unsupported predictor row');for(let c=0;c<columns;c++)out[row*columns+c]=(result[row*(columns+1)+c+1]+(row?out[(row-1)*columns+c]:0))&255;}result=out;}}
  totalInflated+=inflatedLength;need(totalInflated<=2097152,'Cumulative inflation bound exceeded');decoded.set(record.id,result);stats.inflated_streams++;stats.inflated_bytes=totalInflated;return result;
 };
 let pointer=Number(tail[1]);
 for(;;){
  need(!xrefOffsets.has(pointer)&&xrefOffsets.size<4,'Cyclic or excessive xref chain');xrefOffsets.add(pointer);const record=rawAt(pointer),d=record.dict;need(dict(d)&&nameOf(d.Type)==='XRef'&&d.Encrypt===undefined&&d.XRefStm===undefined,'Unsupported or encrypted xref');
  need(Array.isArray(d.W)&&d.W.length===3&&d.W.every(x=>integer(x)&&x<=4)&&d.W[1]>0,'Unsupported xref field widths');const rowWidth=d.W.reduce((a,b)=>a+b,0);need(rowWidth>0,'Empty xref fields');need(integer(d.Size)&&d.Size>0&&d.Size<=32768,'Xref size bound exceeded');
  if(size===null)size=d.Size;else need(d.Size<=size,'Previous xref exceeds current size');
  if(d.Root!==undefined){need(isRef(d.Root),'Invalid catalog reference');if(root===null)root=d.Root;else need(d.Root.id===root.id,'Catalog revision ambiguity');}
  const index=d.Index===undefined?[0,d.Size]:d.Index;need(Array.isArray(index)&&index.length>0&&index.length%2===0&&index.length<=64&&index.every(integer),'Invalid xref index');
  const stream=inflateRecord(record),seen=new Set();let cursor=0;
  for(let k=0;k<index.length;k+=2){const first=index[k],count=index[k+1];need(count>0&&first+count<=d.Size,'Xref index outside bounds');for(let n=0;n<count;n++){const id=first+n;need(!seen.has(id)&&cursor+rowWidth<=stream.length,'Overlapping or truncated xref rows');seen.add(id);const fields=d.W.map((width,i)=>{if(width===0)return i===0?1:0;let v=0;for(let b=0;b<width;b++)v=v*256+stream[cursor++];return v;});const [type,firstField,second]=fields;need(type===0||type===1||type===2,'Unknown xref entry type');if(type===1)need(firstField<bytes.length&&second===0,'Invalid xref offset/generation');if(type===2)need(firstField>0&&firstField<size,'Invalid compressed object reference');if(!entries.has(id))entries.set(id,{type,first:firstField,second});}}
  need(cursor===stream.length,'Unexpected xref trailing rows');stats.xref_sections++;if(d.Prev===undefined)break;need(integer(d.Prev)&&d.Prev<bytes.length,'Invalid previous xref');pointer=d.Prev;
 }
 need(root!==null&&size!==null,'Catalog missing');stats.xref_entries=entries.size;
 function record(id){
  if(objects.has(id))return objects.get(id);need(integer(id)&&id>0&&id<size&&!resolving.has(id),'Invalid/cyclic object reference');need(++objectReads<=2048,'Object resolution bound exceeded');stats.object_reads=objectReads;resolving.add(id);
  try{const entry=entries.get(id);need(entry&&entry.type!==0,'Missing/free object');let result;
   if(entry.type===1)result=rawAt(entry.first,id);
   else{
    const owner=record(entry.first);need(dict(owner.dict)&&nameOf(owner.dict.Type)==='ObjStm'&&integer(owner.dict.N)&&owner.dict.N>0&&owner.dict.N<=256&&integer(owner.dict.First),'Invalid object stream');
    let group=objectStreams.get(entry.first);
    if(!group){const body=inflateRecord(owner),header=new PdfLexer(body,{end:owner.dict.First,maxTokens:2048});need(owner.dict.First<body.length,'Invalid object stream header boundary');const refs=[],seen=new Set();for(let i=0;i<owner.dict.N;i++){const child=header.next(),offset=header.next();need(integer(child)&&child>0&&child<size&&!seen.has(child)&&integer(offset)&&owner.dict.First+offset<body.length&&(i===0?offset===0:offset>refs[i-1].offset),'Invalid object stream header');seen.add(child);refs.push({id:child,offset});}header.complete();group={body,refs,first:owner.dict.First};objectStreams.set(entry.first,group);stats.compressed_object_streams++;}
    need(entry.second<group.refs.length&&group.refs[entry.second].id===id,'Compressed object index mismatch');const item=group.refs[entry.second],end=entry.second+1<group.refs.length?group.first+group.refs[entry.second+1].offset:group.body.length;const lex=new PdfLexer(group.body,{offset:group.first+item.offset,end,maxTokens:20000});const value=lex.value();lex.complete();result={id,dict:value,raw:null};
   }
   objects.set(id,result);return result;
  }finally{resolving.delete(id);}
 }
 function get(ref){const id=typeof ref==='number'?ref:isRef(ref)?ref.id:null;need(id!==null,'Indirect reference required');return record(id).dict;}
 function stream(ref,{maxBytes=262144}={}){const id=typeof ref==='number'?ref:isRef(ref)?ref.id:null;need(id!==null,'Stream reference required');return inflateRecord(record(id),maxBytes);}
 function pages(indices){
  need(Array.isArray(indices)&&indices.length>0&&indices.length<=8&&indices.every(x=>integer(x)&&x<205)&&new Set(indices).size===indices.length,'Invalid selected page indices');const catalog=get(root);need(dict(catalog)&&nameOf(catalog.Type)==='Catalog'&&isRef(catalog.Pages)&&catalog.Encrypt===undefined,'Catalog/page tree invalid');
  const ordered=[],visited=new Set();
  const walk=(ref,parent=null,depth=0,inherited=Object.create(null))=>{
   need(isRef(ref)&&depth<=8&&!visited.has(ref.id)&&visited.size<512,'Invalid or cyclic page hierarchy');visited.add(ref.id);const d=get(ref);need(dict(d),'Invalid page node');if(parent!==null)need(isRef(d.Parent)&&d.Parent.id===parent,'Page parent mismatch');
   const next={...inherited};for(const key of ['Resources','MediaBox','CropBox','Rotate'])if(d[key]!==undefined)next[key]=d[key];
   if(nameOf(d.Type)==='Pages'){need(integer(d.Count)&&d.Count>0&&d.Count<=205&&Array.isArray(d.Kids)&&d.Kids.length>0&&d.Kids.length<=256,'Invalid Pages node');const before=ordered.length;for(const child of d.Kids)walk(child,ref.id,depth+1,next);need(ordered.length-before===d.Count,'Page count/tree mismatch');return;}
   need(nameOf(d.Type)==='Page'&&d.Kids===undefined&&ordered.length<205,'Unexpected page node');ordered.push({id:ref.id,dict:d,inherited:next});
  };
  walk(catalog.Pages);need(ordered.length===205,'Fixed edition page count changed');
  return indices.map(index=>{const p=ordered[index],d=p.dict;let resources=p.inherited.Resources;if(isRef(resources))resources=get(resources);need(dict(resources),'Page resources missing');let contents=d.Contents;need(contents!==undefined,'Selected page contents missing');if(isRef(contents)){const resolved=get(contents);if(Array.isArray(resolved))contents=resolved;else contents=[contents];}need(Array.isArray(contents)&&contents.length>0&&contents.length<=16&&contents.every(isRef)&&new Set(contents.map(x=>x.id)).size===contents.length,'Invalid selected contents');need((p.inherited.Rotate??0)===0,'Rotated selected page unsupported');return {index,id:p.id,dict:d,resources,contents,media_box:p.inherited.MediaBox,crop_box:p.inherited.CropBox??p.inherited.MediaBox};});
 }
 return {object:get,stream,pages,stats,root_ref:root,xref_size:size};
}

import {SourceError,fetchOfficial} from './sources.js';
import {CQC_COHORT_CONTRACT} from './cqc-cohort.js';
// Combined with the bounded PDF object engine in the production candidate.
const CQC_EXPECTED_PAGES=205;
const pdfNeed=(condition,message)=>{if(!condition)throw new SourceError('CQC PDF: '+message);};
const pdfTextBytes=b=>Array.from(b,v=>String.fromCharCode(v)).join('');
const matrixProduct=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const identityMatrix=[1,0,0,1,0,0];
const near=(a,b,e=.1)=>Math.abs(a-b)<=e;
const pdfNextValue=lexer=>{const pos=lexer.pos,t=lexer.next();if(t?.kind==='delimiter'&&['[','<<'].includes(t.value)){lexer.pos=pos;return lexer.value();}return t;};
const plainPdf=s=>s.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim();
function cqcPdfText(pdf,pages){
 const all=[],fontCache=new Map(),active=new Set();let forms=0,operators=0;
 const resolve=x=>isRef(x)?pdf.object(x):x;
 const dict=x=>{const d=resolve(x);pdfNeed(d&&typeof d==='object'&&!Array.isArray(d)&&!d.kind,'Expected PDF dictionary');return d;};
 const resource=(resources,kind,name)=>{const d=dict(resources),group=dict(d[kind]);pdfNeed(Object.hasOwn(group,name),'Unbound '+kind+' resource');return group[name];};
 const cmap=ref=>{
  const bytes=pdf.stream(ref,{maxBytes:16384}),lexer=new PdfLexer(bytes,{maxTokens:8192}),tokens=[];
  for(;;){const token=pdfNextValue(lexer);if(token===undefined)break;tokens.push(token);pdfNeed(tokens.length<=4096,'CMap token bound');}
  const result=new Map();let terminated=false;
  const chars=b=>{pdfNeed(b.length>0&&b.length%2===0&&b.length<=8,'Invalid UTF16 mapping');let s='';for(let i=0;i<b.length;i+=2)s+=String.fromCharCode((b[i]<<8)|b[i+1]);pdfNeed(!/[\ud800-\udfff]/u.test(s),'Unsupported surrogate CMap');return s;};
  const key=b=>Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
  for(let i=0;i<tokens.length;i++){
   const word=tokens[i]?.kind==='word'?tokens[i].value:null;
   if(word==='endcmap')terminated=true;
   if(word==='usecmap')pdfNeed(false,'External CMap unsupported');
   if(!['beginbfchar','beginbfrange'].includes(word))continue;
   const n=tokens[i-1];pdfNeed(Number.isSafeInteger(n)&&n>=1&&n<=1024,'CMap pair count');let at=i+1;
   const put=(a,b)=>{pdfNeed(a?.kind==='string'&&b?.kind==='string'&&[1,2].includes(a.bytes.length),'Invalid CMap pair');const k=key(a.bytes);pdfNeed(!result.has(k),'Duplicate CMap character');result.set(k,chars(b.bytes));};
   for(let j=0;j<n;j++){
    if(word==='beginbfchar'){put(tokens[at],tokens[at+1]);at+=2;}
    else{
     const a=tokens[at++],b=tokens[at++],target=tokens[at++];pdfNeed(a?.kind==='string'&&b?.kind==='string'&&a.bytes.length===b.bytes.length&&[1,2].includes(a.bytes.length),'Invalid CMap range');
     const start=parseInt(key(a.bytes),16),end=parseInt(key(b.bytes),16);pdfNeed(end>=start&&end-start<256,'CMap range bound');
     if(Array.isArray(target))pdfNeed(target.length===end-start+1,'CMap range coverage');else pdfNeed(target?.kind==='string'&&target.bytes.length===2,'Unsupported CMap target range');
     for(let v=start;v<=end;v++){
      const source={kind:'string',bytes:new Uint8Array(a.bytes.length===1?[v]:[v>>8,v&255])};let mapped;
      if(Array.isArray(target))mapped=target[v-start];else{const u=(target.bytes[0]<<8|target.bytes[1])+v-start;pdfNeed(u<=65535,'CMap overflow');mapped={kind:'string',bytes:new Uint8Array([u>>8,u&255])};}put(source,mapped);
     }
    }
   }
   pdfNeed(tokens[at]?.kind==='word'&&tokens[at].value===(word==='beginbfchar'?'endbfchar':'endbfrange'),'Incomplete CMap block');i=at;
  }
  pdfNeed(terminated&&result.size>0,'Incomplete Unicode mapping');return result;
 };
 const font=ref=>{
  const id=isRef(ref)?ref.id:ref; if(fontCache.has(id))return fontCache.get(id);
  const f=dict(ref),subtype=nameOf(f.Subtype),encoding=nameOf(f.Encoding);pdfNeed(nameOf(f.Type)==='Font'&&((subtype==='TrueType'&&encoding==='WinAnsiEncoding')||(subtype==='Type0'&&encoding==='Identity-H')),'Unsupported font/encoding');
  pdfNeed(!f.CharProcs&&!f.FontMatrix,'Unsupported font program');const map=f.ToUnicode?cmap(f.ToUnicode):null;pdfNeed(subtype!=='Type0'||map,'Missing composite Unicode map');
  const decode=bytes=>{
   const width=subtype==='Type0'?2:1;pdfNeed(bytes.length%width===0,'Truncated encoded text');let s='';
   const specials={128:0x20ac,130:0x201a,131:0x192,132:0x201e,133:0x2026,134:0x2020,135:0x2021,136:0x2c6,137:0x2030,138:0x160,139:0x2039,140:0x152,142:0x17d,145:0x2018,146:0x2019,147:0x201c,148:0x201d,149:0x2022,150:0x2013,151:0x2014,152:0x2dc,153:0x2122,154:0x161,155:0x203a,156:0x153,158:0x17e,159:0x178};
   for(let i=0;i<bytes.length;i+=width){if(map){const k=Array.from(bytes.slice(i,i+width),v=>v.toString(16).padStart(2,'0')).join('');pdfNeed(map.has(k),'Unmapped selected character');s+=map.get(k);}else{const b=bytes[i];pdfNeed(b>=32&&!([127,129,141,143,144,157].includes(b)),'Unknown WinAnsi character');s+=String.fromCharCode(specials[b]||b);}}
   return s;
  };fontCache.set(id,decode);return decode;
 };
 function run(bytes,resources,page,owner,depth,parentMatrix=identityMatrix,parentState={}){
  pdfNeed(depth<=10&&++forms<=160,'Form recursion bound');const lexer=new PdfLexer(bytes,{maxTokens:50000}),stack=[],operands=[];
  let state={ctm:[...parentMatrix],tm:[...identityMatrix],line:[...identityMatrix],font:null,inText:false,leading:0,render:0,rise:0,scale:100,alpha:1,...parentState,ctm:[...parentMatrix]},marks=0;const markedReplacements=[];
  const numeric=(n)=>{pdfNeed(operands.length===n&&operands.every(Number.isFinite),'Wrong numeric operator operands');return operands;};
  const text=value=>{pdfNeed(state.inText&&state.font&&value?.kind==='string','Invalid PDF text operation');return font(state.font)(value.bytes);};
  const show=value=>{const words=Array.isArray(value)?value.map(x=>typeof x==='number'?(pdfNeed(Number.isFinite(x),'Invalid text adjustment'),''):text(x)).join(''):text(value);if(markedReplacements.some(Boolean))pdfNeed(!plainPdf(words),'Nonwhitespace ActualText replacement');const m=matrixProduct(state.ctm,state.tm);all.push({page,owner,depth,text:words,x:m[4],y:m[5],render:state.render,rise:state.rise,scale:state.scale,alpha:state.alpha});pdfNeed(all.length<=2048,'Selected text bound');};
  const move=(x,y)=>{state.line=matrixProduct(state.line,[1,0,0,1,x,y]);state.tm=[...state.line];};
  for(;;){
   const token=pdfNextValue(lexer);if(token===undefined)break;if(token?.kind!=='word'){operands.push(token);pdfNeed(operands.length<=2048,'Operand bound');continue;}
   const op=token.value;pdfNeed(++operators<=30000,'Operator bound');
   if(op==='q'){pdfNeed(!operands.length&&stack.length<32,'Bad graphics save');stack.push({...state,ctm:[...state.ctm],tm:[...state.tm],line:[...state.line]});}
   else if(op==='Q'){pdfNeed(!operands.length&&stack.length,'Unbalanced graphics restore');state=stack.pop();}
   else if(op==='cm')state.ctm=matrixProduct(state.ctm,numeric(6));
   else if(op==='BT'){pdfNeed(!state.inText&&!operands.length,'Nested text');state.inText=true;state.tm=[...identityMatrix];state.line=[...identityMatrix];}
   else if(op==='ET'){pdfNeed(state.inText&&!operands.length,'Unbalanced text');state.inText=false;}
   else if(op==='Tf'){pdfNeed(operands.length===2&&nameOf(operands[0])&&Number.isFinite(operands[1])&&operands[1]>0,'Invalid font selection');state.font=resource(resources,'Font',nameOf(operands[0]));}
   else if(op==='Tm'){state.tm=[...numeric(6)];state.line=[...state.tm];}
   else if(op==='Td'||op==='TD'){const [x,y]=numeric(2);if(op==='TD')state.leading=-y;move(x,y);}
   else if(op==='T*'){pdfNeed(!operands.length,'Bad next text line');move(0,-state.leading);}
   else if(op==='TL')state.leading=numeric(1)[0];
   else if(op==='Tr'){state.render=numeric(1)[0];pdfNeed([0,1,2,3].includes(state.render),'Unsupported clipping text');}
   else if(op==='Ts')state.rise=numeric(1)[0];
   else if(op==='Tz'){state.scale=numeric(1)[0];pdfNeed(state.scale>0,'Invisible text scale');}
   else if(op==='Tj'||op==='TJ'){pdfNeed(operands.length===1&&(op==='Tj'||Array.isArray(operands[0])),'Bad shown text');show(operands[0]);}
   else if(op==='Do'){
    pdfNeed(operands.length===1&&nameOf(operands[0]),'Bad Form invocation');const ref=resource(resources,'XObject',nameOf(operands[0]));pdfNeed(isRef(ref)&&!active.has(ref.id),'Cyclic Form');const f=dict(ref);
    pdfNeed(nameOf(f.Subtype)==='Form'&&!f.OC&&!f.Ref&&!f.OPI,'Unsupported external/image Form');
    const m=f.Matrix||identityMatrix;pdfNeed(Array.isArray(m)&&m.length===6&&m.every(Number.isFinite),'Bad Form matrix');
    pdfNeed(Array.isArray(f.BBox)&&f.BBox.length===4&&f.BBox.every(Number.isFinite),'Missing Form box');
    active.add(ref.id);run(pdf.stream(ref,{maxBytes:65536}),f.Resources||resources,page,ref.id,depth+1,matrixProduct(state.ctm,m),{alpha:state.alpha,render:state.render,rise:state.rise,scale:state.scale});active.delete(ref.id);
   }
   else if(op==='gs'){
    pdfNeed(operands.length===1&&nameOf(operands[0]),'Bad graphics state');const g=dict(resource(resources,'ExtGState',nameOf(operands[0])));
    pdfNeed(!g.Font&&(!g.SMask||nameOf(g.SMask)==='None')&&(!g.BM||nameOf(g.BM)==='Normal')&&(g.ca===undefined||Number.isFinite(g.ca)&&g.ca>=0&&g.ca<=1)&&(g.CA===undefined||Number.isFinite(g.CA)&&g.CA>=0&&g.CA<=1),'Unsupported opacity or graphics font');if(g.ca!==undefined)state.alpha=g.ca;
   }
   else if(op==='BDC'||op==='BMC'){pdfNeed(operands.length===(op==='BDC'?2:1)&&nameOf(operands[0])&&nameOf(operands[0])!=='OC','Unknown marked content');if(op==='BDC'){const d=operands[1];pdfNeed(d&&typeof d==='object'&&!d.kind&&!d.OC,'Unsupported marked property');if(d.ActualText)pdfNeed(d.ActualText.kind==='string'&&Array.from(d.ActualText.bytes).join(',')==='254,255,0,9','Unsupported text replacement');markedReplacements.push(!!d.ActualText);}else markedReplacements.push(false);pdfNeed(++marks<=32,'Mark bound');}
   else if(op==='EMC'){pdfNeed(!operands.length&&marks>0,'Unbalanced marked text');marks--;markedReplacements.pop();}
   else if(['Tc','Tw','w','M','j','J','i'].includes(op))numeric(1);
   else if(['CS','cs','ri'].includes(op))pdfNeed(operands.length===1&&nameOf(operands[0]),'Bad named graphics operator');
   else if(['g','G'].includes(op))numeric(1);
   else if(['rg','RG'].includes(op))numeric(3);
   else if(['k','K'].includes(op))numeric(4);
   else if(['scn','SCN','sc','SC'].includes(op))pdfNeed([1,3,4].includes(operands.length)&&operands.every(Number.isFinite),'Unsupported color');
   else if(['m','l'].includes(op))numeric(2);
   else if(['c'].includes(op))numeric(6);
   else if(['v','y','re'].includes(op))numeric(4);
   else if(op==='d')pdfNeed(operands.length===2&&Array.isArray(operands[0])&&operands[0].every(Number.isFinite)&&Number.isFinite(operands[1]),'Bad dash');
   else if(['h','S','s','f','F','f*','B','B*','b','b*','n','W','W*'].includes(op))pdfNeed(!operands.length,'Extra graphics operands');
   else pdfNeed(false,'Unsupported selected content operator '+op);
   operands.length=0;
  }
  pdfNeed(!operands.length&&!stack.length&&!state.inText&&!marks,'Incomplete content stream');
 }
 for(const page of pages){pdfNeed(!page.dict.Rotate||page.dict.Rotate===0,'Rotated selected page');const streams=Array.isArray(page.contents)?page.contents:[page.contents];pdfNeed(streams.length===1,'Unexpected selected content coverage');run(pdf.stream(streams[0],{maxBytes:65536}),page.resources,page.index,page.id,0);}
 return {records:all,forms,operators,font_count:fontCache.size};
}

const CQC_PDF_URL='https://assets.publishing.service.gov.uk/media/68fa3b4fe200d653d8b63735/care-quality-commission-state-of-health-care-and-adult-social-care-England-2024-2025.pdf';
const publicationEvidence=Object.freeze({kind:'retained_same_edition_publication_metadata',path:'verification/remaining-gaps-2026-10-20/prior-audit/cqc/original/state-of-care-index.html',sha256:'987986bb8ad36eda0d21eb30575b6551bdcdbe364c2af5c3a3dba165e4fdeb0d',original_url:'https://www.cqc.org.uk/publications/major-report/state-care',publication_date:'2025-10-24',edition:'State of Care 2024/25',live_retrieved:false});
const pdfContract={...CQC_COHORT_CONTRACT,id:'cqc-adult-social-care-pdf-2025-08-01',source_url:CQC_PDF_URL,edition_bytes:7175967,edition_sha256:'61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef',revision_policy:'Fixed original PDF bytes as well as historical edition and snapshot. Every count is structurally extracted from the fetched original; any changed PDF bytes require new independent evidence and reviewed acceptance. No automatic revision or future-edition substitution.',max_bytes:8388608,timeout_ms:20000,pdf_page_count:205,pdf_page_indices:[187,188],printed_pages:[186,187],publication_evidence:publicationEvidence};
export const CQC_PDF_CONTRACT=Object.freeze(pdfContract);
const fullEqual=(a,b)=>a===b||(Array.isArray(a)||Array.isArray(b)?Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>fullEqual(v,b[i])):a&&b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>Object.hasOwn(a,k)&&fullEqual(a[k],v)));
const pdfInstant=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().replace('.000Z','Z')===s.replace('.000Z','Z');
function cqcClock(value){pdfNeed(pdfInstant(value)&&value.slice(0,10)>=pdfContract.publication_date,'Missing, invalid or prepublication acquisition clock');return value;}
export function cqcPdfDefinitions(){return CQC_COHORT_CONTRACT.measures.map(({measure,label})=>({id:measure,name:label+': adult social care service ratings in the single assessment framework cohort',geography:pdfContract.geography,population:pdfContract.population,unit:pdfContract.unit,kind:pdfContract.kind,cadence:'Fixed historical snapshot; no automatic edition advancement',dimensions:{sector:'Adult social care',framework:pdfContract.framework,snapshot_date:pdfContract.period,rating:label,assessment_unit:'Individual service at a location'},publisher:pdfContract.publisher,licence:pdfContract.licence,licence_url:pdfContract.licence_url,source_url:CQC_PDF_URL,period_convention:pdfContract.period_convention,adjustment:pdfContract.adjustment,limitations:pdfContract.limitations,revision_policy:pdfContract.revision_policy,publication_date:pdfContract.publication_date,edition:pdfContract.edition,publication_evidence:{...publicationEvidence}}));}
function cqcNative(values,provenance=[]){
 pdfNeed(Array.isArray(values)&&values.length===5&&values.every(v=>Number.isSafeInteger(v)&&v>=0),'Five explicit integer counts required');pdfNeed(values.slice(0,4).reduce((a,b)=>a+b,0)===values[4]&&Number.isSafeInteger(values[4]),'Rating categories do not equal narrative total');
 const {id,measures,max_bytes,timeout_ms,pdf_page_count,pdf_page_indices,printed_pages,...semantic}=pdfContract;
 return {status:'ok',contract_id:id,...semantic,rows:measures.map((m,i)=>({...m,measure_id:m.measure,value:values[i],unit:'ratings',period:pdfContract.period,value_state:'observed',geography:'England'})),definitions:cqcPdfDefinitions(),metadata:{count:5,fixed_edition:true,pdf_page_count,pdf_page_indices:[...pdf_page_indices],printed_pages:[...printed_pages],figure:'A1',publication_date_basis:'Retained official publication metadata; PDF printing date is not publication date',publication_evidence:{...publicationEvidence}},published_at:null,publisher_updated_at:null,next_expected_update:null,provenance};
}
function selectedCqcValues(text){
 const rows=text.records,one=rows.filter(r=>r.page===187),two=rows.filter(r=>r.page===188),normalize=rs=>plainPdf(rs.map(r=>r.text).join(' '));
 const a=normalize(one),b=normalize(two),title='The state of health care and adult social care in England 2024/25';
 pdfNeed(one.filter(r=>plainPdf(r.text)===title).length===1&&two.filter(r=>plainPdf(r.text)===title).length===1,'Report title, geography or edition differs');
 pdfNeed(one.some(r=>plainPdf(r.text)==='186')&&two.some(r=>plainPdf(r.text)==='187'),'Printed page identity differs');
 for(const phrase of ['Appendix: CQC ratings charts','ratings published under CQC’s single assessment framework, as at 1 August 2025','not directly comparable with previous years','assessment activity during this time has been based on risk','unlikely to be representative of all services in a sector'])pdfNeed(a.includes(phrase),'Missing cohort/methodology evidence');
 for(const phrase of ['Adult social care','individual adult social care services are now rated separately as individual services at a location','we will publish 2 ratings','previous frameworks were only published for the location','should not be combined with or compared with those under previous frameworks','Figure A1: Adult social care, overall ratings, 2025','Source: CQC ratings data, 1 August 2025'])pdfNeed(b.includes(phrase),'Wrong population, figure or source');
 const totals=[...b.matchAll(/The charts in this section show the ([0-9,]+) ratings for adult social care services that we have published under the single assessment framework\./g)];pdfNeed(totals.length===1,'Missing or ambiguous narrative total');
 const expected=['Inadequate','Requires improvement','Good','Outstanding'];
 const labels=two.filter(r=>r.depth===0&&expected.includes(plainPdf(r.text)));pdfNeed(labels.length===4&&labels.map(r=>plainPdf(r.text)).join('|')===expected.join('|'),'Rating category identity/order differs');
 const counts=two.filter(r=>/^\([0-9,]+\)$/.test(plainPdf(r.text)));
 pdfNeed(counts.length===4&&counts.every((r,i)=>r.depth===1&&r.render===0&&r.alpha===1&&r.rise===0&&r.scale===100&&near(r.y,390.4779)&&near(labels[i].y,437.49)&&r.x>0&&r.x<595&&(i===0||r.x>counts[i-1].x)&&labels[i].render===0&&labels[i].alpha===1&&labels[i].scale===100&&labels[i].rise===0&&(i===0||labels[i].x>labels[i-1].x)),'Unknown/ambiguous rating count positions or visibility');
 // Full selected page/Form text was decoded; an extra bare/marked parenthesised value cannot be ignored.
 pdfNeed(two.filter(r=>/^\([^)]*\)$/.test(plainPdf(r.text))).length===4,'Missing/marked or extra parenthesised rating value');
 const integerText=s=>{pdfNeed(/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/.test(s),'Invalid count syntax');const n=Number(s.replaceAll(',',''));pdfNeed(Number.isSafeInteger(n),'Count exceeds safe integer');return n;};
 return [...counts.map(r=>integerText(plainPdf(r.text).slice(1,-1))),integerText(totals[0][1])];
}
export function parseCqcPdf(bytes,{retrieved_at}={}){
 cqcClock(retrieved_at);try{const pdf=openPdf(bytes),pages=pdf.pages([187,188]),text=cqcPdfText(pdf,pages);return cqcNative(selectedCqcValues(text));}catch(error){if(error instanceof SourceError)throw error;throw new SourceError('CQC PDF: Unsupported or malformed selected PDF structure');}
}
export function validateCqcPdfRepresentation(value,acquisition){
 try{if(arguments.length>1){cqcClock(acquisition?.retrieved_at);pdfNeed(value?.provenance?.length===1,'Live acquisition provenance required');}pdfNeed(value&&Array.isArray(value.rows)&&value.rows.length===5&&Array.isArray(value.provenance)&&[0,1].includes(value.provenance.length),'Incomplete representation');
  for(const p of value.provenance){pdfNeed(p&&Object.keys(p).sort().join(',')==='bytes,retrieved_at,role,sha256,url'&&p.role==='original_pdf'&&p.url===CQC_PDF_URL&&p.bytes===pdfContract.edition_bytes&&p.sha256===pdfContract.edition_sha256,'Invalid PDF provenance');cqcClock(p.retrieved_at);if(arguments.length>1)pdfNeed(Date.parse(p.retrieved_at)<=Date.parse(acquisition.retrieved_at),'PDF retrieval follows public acquisition');}
  return fullEqual(value,cqcNative(value.rows.map(r=>r.value),value.provenance));
 }catch{return false;}
}
export function cqcPdfRows(value){pdfNeed(validateCqcPdfRepresentation(value),'Invalid native representation');return value.rows;}
export async function readCqcPdf({fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}){
 const retrieved_at=cqcClock(now());const response=await fetcher(CQC_PDF_URL,{headers:{accept:'application/pdf'},redirect:'manual',signal:AbortSignal.timeout(20000)});
 pdfNeed(response.ok&&(!response.url||response.url===CQC_PDF_URL),'Unexpected HTTP or redirect');pdfNeed(/^application\/pdf(?:;|$)/i.test(response.headers.get('content-type')||''),'Unexpected content type');
 const length=response.headers.get('content-length');pdfNeed(!length||/^\d+$/.test(length)&&Number(length)<=8388608,'Declared PDF exceeds bound');pdfNeed(response.body,'Missing PDF body');
 const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;pdfNeed(size<=8388608,'PDF stream exceeds bound');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');pdfNeed(size===pdfContract.edition_bytes&&sha256===pdfContract.edition_sha256,'Original PDF bytes changed; new independent review required');
 const native=parseCqcPdf(bytes,{retrieved_at});native.provenance=[{role:'original_pdf',url:CQC_PDF_URL,retrieved_at,bytes:size,sha256}];pdfNeed(validateCqcPdfRepresentation(native,{retrieved_at}),'Acquired representation failed validation');return native;
}
