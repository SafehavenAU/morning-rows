const url='https://assets.publishing.service.gov.uk/media/68fa3b4fe200d653d8b63735/care-quality-commission-state-of-health-care-and-adult-social-care-England-2024-2025.pdf';
export default {async fetch(request){
 if(new URL(request.url).pathname!=='/probe')return new Response('Not found',{status:404});
 const report={kind:'One ordinary protected Worker GET of new official GOV.UK PDF route',url,started_at:new Date().toISOString(),max_bytes:8388608,timeout_ms:20000,redirect_mode:'manual',retries:0,parser_accepted:false};
 try{
  const r=await fetch(url,{headers:{accept:'application/pdf'},redirect:'manual',signal:AbortSignal.timeout(20000)});report.status=r.status;report.content_type=r.headers.get('content-type');
  if(!r.ok||r.url!==url)throw Error('bad_status_or_redirect');
  const size=r.headers.get('content-length');if(size&&(!/^\d+$/.test(size)||Number(size)>8388608))throw Error('declared_size');
  if(!r.body)throw Error('missing_body');const reader=r.body.getReader(),chunks=[];let bytes=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8388608)throw Error('stream_size');chunks.push(value);}}finally{await reader.cancel();}
  const all=new Uint8Array(bytes);let n=0;for(const chunk of chunks){all.set(chunk,n);n+=chunk.length;}
  report.bytes=bytes;report.sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',all)),b=>b.toString(16).padStart(2,'0')).join('');report.pdf_header=new TextDecoder().decode(all.slice(0,8));report.matches_independent_original=bytes===7175967&&report.sha256==='61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef';report.pass=report.matches_independent_original&&report.content_type?.startsWith('application/pdf')&&report.pdf_header.startsWith('%PDF-');
 }catch(error){report.error=['bad_status_or_redirect','declared_size','missing_body','stream_size'].includes(error.message)?error.message:error.name==='TimeoutError'||error.name==='AbortError'?'timeout':'transport_or_runtime_failure';report.pass=false;}
 report.finished_at=new Date().toISOString();return Response.json(report);
}};
