// Bounded official-source diagnostic. No browser impersonation, proxy or fallback.
const targets = [
 ['bulk_accept_any', 'https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems', '*/*'],
 ['official_workbook_index', 'https://www.bls.gov/cpi/tables/supplemental-files/home.htm', 'text/html'],
 ['official_historical_workbook', 'https://www.bls.gov/cpi/tables/supplemental-files/historical-cpi-u-202609.xlsx', '*/*'],
];
export default {async fetch() {
 const results = [];
 for (const [name,url,accept] of targets) {
  const started = Date.now();
  try {
   const r = await fetch(url, {headers:{'User-Agent':'MorningRows/1.0 (+https://morningrows.com)',Accept:accept},signal:AbortSignal.timeout(15000),redirect:'manual'});
   const reader = r.body?.getReader(); let bytes=0; const chunks=[];
   if (reader) {while(true) {const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8*1024*1024){await reader.cancel();throw Error('size');}chunks.push(value);}}
   const body = new Uint8Array(bytes);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length;}
   const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',body))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const errorText = r.ok ? '' : new TextDecoder().decode(body);
   results.push({name,url,accept,status:r.status,content_type:r.headers.get('content-type'),bytes,sha256:digest,elapsed_ms:Date.now()-started,
    error_class:r.ok?null:/access.denied|automated|bot|forbidden/i.test(errorText)?'access_refused':/not.acceptable/i.test(errorText)?'not_acceptable':'unclassified_http_error'});
  } catch {results.push({name,url,accept,error:'bounded_request_failed',elapsed_ms:Date.now()-started});}
 }
 return Response.json({checked_at:new Date().toISOString(),request_identification:'MorningRows/1.0 (+https://morningrows.com)',results});
}};
