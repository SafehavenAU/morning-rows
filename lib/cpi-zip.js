import {SourceError} from './sources.js';
const requireValue=(ok,message)=>{if(!ok)throw new SourceError('BLS CPI ZIP: '+message);};
const decoder=new TextDecoder('utf-8',{fatal:true});
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=b=>{let n=0xffffffff;for(let i=0;i<b.length;i++)n=crcTable[(n^b[i])&255]^(n>>>8);return (n^0xffffffff)>>>0;};
// Restricted single-disk XLSX ZIP. Native inflation avoids a JavaScript DEFLATE
// implementation on every cold read. Validate central/local identity, sizes and
// CRC; no ZIP64, encryption, paths, external resources or unbounded expansion.
export function openCpiZip(bytes){
 requireValue(bytes instanceof Uint8Array&&bytes.length>=22&&bytes.length<=131072,'input_limit');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=p=>view.getUint16(p,true),u32=p=>view.getUint32(p,true);
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break;}
 requireValue(end>=0&&u16(end+4)===0&&u16(end+6)===0&&u16(end+8)===u16(end+10),'zip_directory');const count=u16(end+10),size=u32(end+12),start=u32(end+16);requireValue(count<=32&&start+size===end,'zip_directory');
 const entries=new Map();let p=start,expanded=0;const ranges=[];
 for(let i=0;i<count;i++){
  requireValue(p+46<=end&&u32(p)===0x02014b50,'directory_entry');const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),compressed=u32(p+20),original=u32(p+24),nameLength=u16(p+28),extra=u16(p+30),comment=u16(p+32),local=u32(p+42);
  requireValue(p+46+nameLength+extra+comment<=end&&u16(p+34)===0&&!(flags&1)&&[0,8].includes(method),'unsupported_zip');const name=decoder.decode(bytes.subarray(p+46,p+46+nameLength));requireValue(!entries.has(name)&&!name.includes('..')&&!name.startsWith('/')&&/^[A-Za-z0-9_./\[\]-]+$/.test(name),'entry_name');
  requireValue(local+30<=start&&u32(local)===0x04034b50&&u16(local+6)===flags&&u16(local+8)===method,'local_header');const nl=u16(local+26),el=u16(local+28),begin=local+30+nl+el;requireValue(begin+compressed<=start&&decoder.decode(bytes.subarray(local+30,local+30+nl))===name,'entry_bounds');
  requireValue((flags&8)||u32(local+14)===crc&&u32(local+18)===compressed&&u32(local+22)===original,'local_sizes');ranges.push([local,begin+compressed]);expanded+=original;requireValue(original<=262144&&expanded<=524288,'expanded_limit');entries.set(name,{begin,compressed,original,crc,method});p+=46+nameLength+extra+comment;
 }
 requireValue(p===end,'directory_size');ranges.sort((a,b)=>a[0]-b[0]);requireValue(ranges.every((r,i)=>!i||r[0]>=ranges[i-1][1]),'overlapping_entries');
 return {async read(name){const e=entries.get(name);requireValue(e,'missing_part');const raw=bytes.subarray(e.begin,e.begin+e.compressed);let out;
  if(e.method===0)out=raw;else{
   const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')),reader=stream.getReader(),chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;requireValue(size<=e.original,'expanded_size');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}
   out=new Uint8Array(size);let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length;}
  }
  requireValue(out.length===e.original&&crc32(out)===e.crc,'size_or_crc');return decoder.decode(out);
 }};
}
