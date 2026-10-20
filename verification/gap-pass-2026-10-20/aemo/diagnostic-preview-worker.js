// One explicit read from protected remote dev. No alternate URL/header probes.
const target='https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_SA1.csv';
const bound=8192;
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export default {async fetch(request){
 if(new URL(request.url).pathname!=='/probe')return new Response('Not found',{status:404});
 const started_at=new Date().toISOString();
 const response=await fetch(target,{headers:{accept:'text/csv'},redirect:'manual',signal:AbortSignal.timeout(20000)});
 const reader=response.body?.getReader(),chunks=[];let bytes=0,complete=false;
 if(reader)try{
  while(bytes<bound){const item=await reader.read();if(item.done){complete=true;break;}const keep=item.value.subarray(0,bound-bytes);chunks.push(keep);bytes+=keep.length;if(keep.length<item.value.length)break;}
 }finally{await reader.cancel();}
 const retained=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){retained.set(chunk,offset);offset+=chunk.length;}
 const text=new TextDecoder().decode(retained);
 const excerpt=text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')
  .replace(/(?:\d{1,3}\.){3}\d{1,3}/g,'[IP redacted]').replace(/(?:support|incident|reference|request)\s*(?:ID|number|#)\s*:?\s*[A-Za-z0-9_.-]+/gi,'[request identifier redacted]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email redacted]').replace(/\s+/g,' ').trim().slice(0,1200);
 return Response.json({started_at,finished_at:new Date().toISOString(),request:{url:target,method:'GET',accept:'text/csv',redirect:'manual',timeout_ms:20000,requests:1},response:{status:response.status,content_type:response.headers.get('content-type'),declared_content_length:response.headers.get('content-length'),retained_bytes:bytes,body_complete:complete,retained_body_sha256:await sha(retained),public_text_excerpt:excerpt},retention:'HTML scripts/styles and tags removed; email/IP/request identifiers redacted; excerpt limited to1200 characters. Hash identifies the bounded original response prefix; no response cookies or private headers retained.'});
}};
