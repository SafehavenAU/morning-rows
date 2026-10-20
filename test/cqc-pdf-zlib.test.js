import test from 'node:test';
import assert from 'node:assert/strict';
import {zlibSync} from 'fflate';
import {openPdf} from '../lib/cqc-pdf.js';

const encode=text=>new TextEncoder().encode(text);
const concat=parts=>{
 const output=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;
 for(const part of parts){output.set(part,at);at+=part.length;}return output;
};
// A genuine bounded PDF object stream exercises the production zlib/checksum
// decoder without exposing it or replacing it with a test implementation.
function pdfStream(zipped){
 const parts=[encode('%PDF-1.7\n')],offsets=[0];let length=parts[0].length;
 const append=bytes=>{parts.push(bytes);length+=bytes.length;};
 offsets[1]=length;append(encode('1 0 obj\n<< /Type /Catalog >>\nendobj\n'));
 offsets[2]=length;append(concat([encode(`2 0 obj\n<< /Filter /FlateDecode /Length ${zipped.length} >>\nstream\n`),zipped,encode('\nendstream\nendobj\n')]));
 offsets[3]=length;const rows=new Uint8Array(3*7),view=new DataView(rows.buffer);
 for(let i=0;i<3;i++){rows[i*7]=1;view.setUint32(i*7+1,offsets[i+1]);}
 append(concat([encode(`3 0 obj\n<< /Type /XRef /Size 4 /Root 1 0 R /W [1 4 2] /Index [1 3] /Length ${rows.length} >>\nstream\n`),rows,encode(`\nendstream\nendobj\nstartxref\n${offsets[3]}\n%%EOF\n`)]));
 return openPdf(concat(parts));
}
const decoded=(zipped,maxBytes=262144)=>pdfStream(zipped).stream({kind:'ref',id:2,generation:0},{maxBytes});

test('Adler batching preserves complete decoded bytes across block boundaries and repeated blocks',()=>{
 for(const length of [0,1,5551,5552,5553,11103,11104,11105,65536,262144]){
  for(const pattern of ['zero','saturated','varying']){
   const bytes=Uint8Array.from({length},(_,i)=>pattern==='zero'?0:pattern==='saturated'?255:(i*73+(i>>>7))&255);
   assert.deepEqual(decoded(zlibSync(bytes)),bytes,`${pattern}/${length}`);
  }
 }
});

test('checksum mutation, truncation and trailing bytes still refuse through production stream decoder',()=>{
 const bytes=Uint8Array.from({length:11105},(_,i)=>i&255),valid=zlibSync(bytes);
 for(let index=valid.length-4;index<valid.length;index++){
  const changed=valid.slice();changed[index]^=1;
  assert.throws(()=>decoded(changed),/Zlib Adler32 mismatch/);
 }
 assert.throws(()=>decoded(valid.slice(0,-5)));
 assert.throws(()=>decoded(concat([valid,Uint8Array.of(0)])));
 const tailBeforeChecksum=concat([valid.slice(0,-4),Uint8Array.of(0),valid.slice(-4)]);
 assert.throws(()=>decoded(tailBeforeChecksum),/Incomplete or trailing DEFLATE stream/);
});

test('Adler optimization retains expansion-bound refusal before checksum comparison',()=>{
 const bytes=new Uint8Array(5553).fill(255),zipped=zlibSync(bytes);zipped[zipped.length-1]^=1;
 assert.throws(()=>decoded(zipped,5552),/Inflated stream bound exceeded/);
 assert.deepEqual(decoded(zlibSync(bytes),5553),bytes);
});
