import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zlibSync} from 'fflate';
import {CQC_PDF_CONTRACT,parseCqcPdf,readCqcPdf,validateCqcPdfRepresentation,cqcPdfRows,cqcPdfDefinitions,openPdf,PdfLexer} from '../lib/cqc-pdf.js';
const fixture=new Uint8Array(readFileSync(new URL('../verification/gap-followup-2026-10-20/cqc-pdf/original/statistical-structure-fixture.pdf',import.meta.url)));
const now='2026-10-20T12:00:00Z',encode=s=>new TextEncoder().encode(s),decode=b=>new TextDecoder('latin1').decode(b);
const parse=b=>parseCqcPdf(b,{retrieved_at:now});
const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const serialize=v=>v===null?'null':typeof v==='number'||typeof v==='boolean'?String(v):Array.isArray(v)?'['+v.map(serialize).join(' ')+']':v?.kind==='name'?'/'+v.value:v?.kind==='ref'?`${v.id} 0 R`:v?.kind==='string'?'<'+[...v.bytes].map(x=>x.toString(16).padStart(2,'0')).join('')+'>':'<<'+Object.entries(v).map(([k,x])=>'/'+k+' '+serialize(x)).join(' ')+'>>';
// Append real incremental objects/xref entries. Every mutation is parsed through
// the production object/content engine, never a mocked extracted-text oracle.
function revise(changes,{trailer={}}={}){
 const pdf=openPdf(fixture),parts=[fixture,encode('\n')],entries=[];let length=fixture.length+1;
 for(const {id,dict,stream,corrupt}of changes){const start=length;let bytes;
  if(stream!==undefined){let zipped=zlibSync(typeof stream==='string'?encode(stream):stream);if(corrupt==='checksum')zipped[zipped.length-1]^=1;if(corrupt==='truncated')zipped=zipped.slice(0,-5);bytes=concat([encode(`${id} 0 obj\n${serialize({...dict,Filter:{kind:'name',value:'FlateDecode'},DecodeParms:null,Length:zipped.length})}\nstream\n`),zipped,encode('\nendstream\nendobj\n')]);}
  else bytes=encode(`${id} 0 obj\n${serialize(dict)}\nendobj\n`);
  parts.push(bytes);length+=bytes.length;entries.push([id,start]);
 }
 const xref=pdf.xref_size;entries.push([xref,length]);entries.sort((a,b)=>a[0]-b[0]);
 const data=new Uint8Array(entries.length*7);for(let i=0;i<entries.length;i++){data[i*7]=1;new DataView(data.buffer).setUint32(i*7+1,entries[i][1]);}
 const prev=Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(decode(fixture))[1]);
 const dict={Type:{kind:'name',value:'XRef'},Size:xref+1,Root:pdf.root_ref,Prev:prev,W:[1,4,2],Index:entries.flatMap(([id])=>[id,1]),Length:data.length,...trailer};
 parts.push(encode(`${xref} 0 obj\n${serialize(dict)}\nstream\n`),data,encode(`\nendstream\nendobj\nstartxref\n${length}\n%%EOF\n`));return concat(parts);
}
const model=openPdf(fixture),pages=model.pages([187,188]),main=pages[1].contents[0],count=pages[1].resources.XObject.Fm3;
function editStream(ref,fn){const original=decode(model.stream(ref)),changed=fn(original);assert.notEqual(changed,original,'Mutation must change bytes');return {id:ref.id,dict:model.object(ref),stream:changed};}
function value(){return parse(fixture);}
test('independent statistical fixture derives five counts; metadata preserves service-level fixed cohort',()=>{const v=value();assert.deepEqual(v.rows.map(r=>r.value),[125,809,2063,65,3062]);assert.equal(cqcPdfRows(v).length,5);assert.equal(cqcPdfDefinitions().length,5);assert.equal(v.metadata.publication_evidence.live_retrieved,false);assert.match(v.assessment_unit,/not unique locations/);assert.match(v.revision_policy,/changed PDF bytes require/);assert.equal(validateCqcPdfRepresentation(v),true);assert.equal(validateCqcPdfRepresentation(v,{retrieved_at:now}),false);});
test('fixture with real appended xref and unchanged content preserves values',()=>{const bytes=revise([{id:count.id,dict:model.object(count),stream:model.stream(count)}]);assert.deepEqual(parse(bytes).rows.map(r=>r.value),[125,809,2063,65,3062]);});
for(const [name,change]of [
 ['negative count',s=>s.replace('125','-125')],['suppressed count',s=>s.replace('125','*')],['missing count',s=>s.replace('125','')],['fractional count',s=>s.replace('125','125.5')],['unbalanced total',s=>s.replace('125','126')],['invisible text rendering',s=>s.replace('0 Tr','3 Tr')],['wrong count position',s=>s.replace('390.4779','10')],['duplicate count',s=>s.replace('(\\(125\\))Tj','(\\(125\\))Tj (\\(125\\))Tj')],['unknown operator',s=>s+'\nunknown\n'],['partial content state',s=>s.replace('ET\nQ','ET')],['unsupported ActualText replacement',s=>s.replace('(\\(125\\))Tj','/Span << /ActualText (999) >> BDC (\\(125\\))Tj EMC')]
])test(name+' refuses through PDF parser',()=>{const bytes=revise([editStream(count,change)]);assert.throws(()=>parse(bytes));});
test('genuine zero is not missing in the pure parser; coherent corrected total derives from PDF',()=>{const bytes=revise([editStream(count,s=>s.replace('125','0')),editStream(main,s=>s.replace('3,062','2,937'))]);assert.deepEqual(parse(bytes).rows.map(r=>r.value),[0,809,2063,65,2937]);});
for(const [name,change]of [
 ['old-framework total substitution',s=>s.replace('3,062','20,467')],['wrong source cohort',s=>s.replaceAll('2025','2024')],['wrong category',s=>s.replace('(Good)Tj','(Poor)Tj')],['wrong population',s=>s.replaceAll('individu','combined')],['wrong assessment unit',s=>s.replace('(ublish 2 r)','(ublish 1 r)')]
])test(name+' refuses',()=>{const bytes=revise([editStream(main,change)]);assert.throws(()=>parse(bytes));});
test('wrong geography in actual report-header Form refuses',()=>{const ref=pages[0].resources.XObject.Fm0;const bytes=revise([editStream(ref,s=>s.replace('e in Eng','e in Sco'))]);assert.throws(()=>parse(bytes));});
test('unsupported font encoding refuses',()=>{const f=model.object(count).Resources.Font.TT0;assert.throws(()=>parse(revise([{id:f.id,dict:{...model.object(f),Encoding:{kind:'name',value:'MacRomanEncoding'}}}])));});
test('original byte guard rejects the well-formed statistical fixture without substituting counts',async()=>{let calls=0;await assert.rejects(readCqcPdf({now:()=>now,fetcher:async(url,options)=>{calls++;assert.equal(url,CQC_PDF_CONTRACT.source_url);assert.equal(options.redirect,'manual');assert.equal(options.headers.accept,'application/pdf');return new Response(fixture,{headers:{'content-type':'application/pdf'}});}}),/Original PDF bytes changed/);assert.equal(calls,1);});
for(const [name,result]of [
 ['redirect',()=>new Response(null,{status:302,headers:{location:'https://example.invalid'}})],['HTTP failure',()=>new Response(null,{status:503})],['wrong media type',()=>new Response('html',{headers:{'content-type':'text/html'}})],['declared size bound',()=>new Response('pdf',{headers:{'content-type':'application/pdf','content-length':'8388609'}})],['missing response body',()=>new Response(null,{headers:{'content-type':'application/pdf'}})],['stream bound',()=>new Response(new Uint8Array(8388609),{headers:{'content-type':'application/pdf'}})]
])test(name+' refuses once',async()=>{let calls=0;await assert.rejects(readCqcPdf({now:()=>now,fetcher:async()=>{calls++;return result();}}));assert.equal(calls,1);});
test('timeout is propagated with no retry',async()=>{let calls=0;await assert.rejects(readCqcPdf({now:()=>now,fetcher:async()=>{calls++;throw new DOMException('timed out','TimeoutError');}}));assert.equal(calls,1);});
for(const [name,change]of [
 ['period',v=>v.rows[0].period='2025-09-01'],['geography',v=>v.geography='United Kingdom'],['service unit',v=>v.assessment_unit='Providers'],['publication',v=>v.publication_date='2026-10-24'],['cohort',v=>v.period='2025-08-02'],['framework',v=>v.framework='Previous framework'],['missingness',v=>v.rows[0].value_state='suppressed'],['numeric string',v=>v.rows[0].value='125'],['partial rows',v=>v.rows.pop()],['row reordering',v=>v.rows.reverse()],['false live metadata',v=>v.metadata.publication_evidence.live_retrieved=true],['wrong edition digest',v=>v.edition_sha256='0'.repeat(64)],['wrong licence',v=>v.licence='unknown'],['wrong definition population',v=>v.definitions[0].population='All England care providers']
])test('public native '+name+' mutation refuses',()=>{const v=value();change(v);assert.equal(validateCqcPdfRepresentation(v),false);});
test('exact provenance and acquisition clocks fail closed',()=>{const v=value();v.provenance=[{role:'original_pdf',url:CQC_PDF_CONTRACT.source_url,retrieved_at:now,bytes:CQC_PDF_CONTRACT.edition_bytes,sha256:CQC_PDF_CONTRACT.edition_sha256}];assert.equal(validateCqcPdfRepresentation(v,{retrieved_at:now}),true);for(const clock of [undefined,null,'2025-10-23T12:00:00Z','2026-02-30T12:00:00Z','2026-10-20T11:00:00Z'])assert.equal(validateCqcPdfRepresentation(v,{retrieved_at:clock}),false);v.provenance[0].sha256='0'.repeat(64);assert.equal(validateCqcPdfRepresentation(v,{retrieved_at:now}),false);});
for(const [name,change]of [
 ['missing EOF',b=>b.slice(0,-10)],['bad startxref',b=>encode(decode(b).replace(/startxref\s+\d+/,'startxref\n1'))],['wrong PDF version',b=>{b[7]=56;return b;}],['exceeded byte bound',()=>new Uint8Array(8388609)]
])test('PDF envelope '+name+' refuses',()=>assert.throws(()=>parse(change(fixture.slice()))));
test('encrypted trailer refuses',()=>assert.throws(()=>parse(revise([],{trailer:{Encrypt:{kind:'ref',id:1,generation:0}}}))));
test('changed page count refuses actual tree',()=>{const root=model.object(model.root_ref),ref=root.Pages;assert.throws(()=>parse(revise([{id:ref.id,dict:{...model.object(ref),Count:204}}])));});
for(const text of ['<< /A 1 /A 2 >>','(unterminated','1 1 R','<< /A 1 >> 2'])test('malformed PDF value '+text+' refuses',()=>assert.throws(()=>{const l=new PdfLexer(encode(text));l.value();l.complete();}));

for(const corrupt of ['checksum','truncated'])test('incomplete or corrupt zlib '+corrupt+' refuses',()=>{const bytes=revise([{id:count.id,dict:model.object(count),stream:model.stream(count),corrupt}]);assert.throws(()=>parse(bytes));});
test('content decompression bound refuses a compressible oversized stream',()=>{const bytes=revise([{id:count.id,dict:model.object(count),stream:' '.repeat(300000)}]);assert.throws(()=>parse(bytes));});
