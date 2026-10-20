import {readCqcPdf,validateCqcPdfRepresentation,CQC_PDF_CONTRACT} from '../../../lib/cqc-pdf.js';
export default {async fetch(request){
 if(new URL(request.url).pathname!=='/proof')return new Response('Not found',{status:404});
 const report={kind:'Actual protected Worker CQC original-PDF reader; one publisher GET plus constructed refusal controls',started_at:new Date().toISOString(),network_reads:0,cpu_acceptance:false,controls:[]};
 try{
  const native=await readCqcPdf({fetcher:async(url,options)=>{report.network_reads++;return fetch(url,options);}});report.native=native;
  const checked_at=new Date().toISOString();report.checked_at=checked_at;
  const check=(name,pass)=>{report.controls.push({name,pass:!!pass});if(!pass)throw Error('control_failed');};
  check('five values agree with independent PDF/workbook reference',JSON.stringify(native.rows.map(r=>r.value))===JSON.stringify([125,809,2063,65,3062]));
  check('native acquisition, exact original bytes and fixed semantics',validateCqcPdfRepresentation(native,{retrieved_at:checked_at}));
  for(const [name,mutate]of [
   ['wrong geography',v=>v.geography='United Kingdom'],['wrong cohort',v=>v.period='2025-09-01'],['wrong framework',v=>v.framework='Previous framework'],['wrong assessment unit',v=>v.assessment_unit='Unique providers'],['unbalanced category',v=>v.rows[0].value++],['suppression as zero',v=>{v.rows[0].value=0;v.rows[0].value_state='suppressed';v.rows[4].value-=125;}],['partial coverage',v=>v.rows.pop()],['unknown missingness',v=>v.rows[0].value=null],['false live publication metadata',v=>v.metadata.publication_evidence.live_retrieved=true],['wrong original digest',v=>v.provenance[0].sha256='0'.repeat(64)],['changed original size',v=>v.provenance[0].bytes++],['missing live provenance',v=>v.provenance=[]]
  ]){const v=structuredClone(native);mutate(v);check(name,!validateCqcPdfRepresentation(v,{retrieved_at:checked_at}));}
  check('explicit missing acquisition clock',!validateCqcPdfRepresentation(native,{retrieved_at:undefined}));
  check('cache clock before acquisition',!validateCqcPdfRepresentation(native,{retrieved_at:'2025-10-24T00:00:00Z'}));
  for(const [name,response]of [['manual redirect refusal',()=>new Response(null,{status:302,headers:{location:'https://example.invalid'}})],['changed bytes cannot become static fallback',()=>new Response('%PDF-1.7 altered',{headers:{'content-type':'application/pdf'}})],['declared file bound',()=>new Response('x',{headers:{'content-type':'application/pdf','content-length':'8388609'}})]]){let refused=false,calls=0;try{await readCqcPdf({now:()=>checked_at,fetcher:async(_url,options)=>{calls++;if(options.redirect!=='manual')throw Error('wrong_redirect_mode');return response();}});}catch{refused=true;}check(name,refused&&calls===1);}
  report.pass=report.network_reads===1&&report.controls.every(x=>x.pass);report.count=report.controls.length;
 }catch(error){report.pass=false;report.error=error?.name==='SourceError'?error.message:error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':error?.message==='control_failed'?'constructed_control_failed':'reader_or_runtime_failure';}
 report.finished_at=new Date().toISOString();return Response.json(report);
}};
