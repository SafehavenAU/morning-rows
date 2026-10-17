// Remote-dev only; NEVER use as deployed entrypoint. Runs the real Worker with
// fetch accounting. No URL queries, headers, response bodies or secrets logged.
import worker from '../worker.js';
import {BUILD_CACHE_KEY} from '../.generated/build-info.js';
const original=globalThis.fetch;
let active=null;
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url||String(input));
 const row={host:url.hostname,status:null,ms:null},start=Date.now();
 active?.push(row);
 try{const response=await original(input,init);row.status=response.status;row.ms=Date.now()-start;return response;}
 catch(error){row.failed=true;row.ms=Date.now()-start;throw error;}
};
export default {async fetch(request,env,ctx){
 if(active) return Response.json({error:'Preview measurement overlap rejected'},{status:409});
 const url=new URL(request.url),path=url.pathname,mode=url.searchParams.get('mode');
 // Cache deletion is restricted to this protected preview origin.
 url.hostname='operations-preview.invalid';url.port='';url.search='';
 if(mode==='cold'||mode==='concurrent')await caches.default.delete(new Request(`${url.origin}${path}?release=${BUILD_CACHE_KEY}`));
 const calls=[];active=calls;const start=Date.now();
 try{
  const responses=await Promise.all(Array.from({length:mode==='concurrent'?2:1},()=>worker.fetch(new Request(url,request),env,ctx)));
  const response=responses[0],text=await response.text();
  for(const extra of responses.slice(1))await extra.body?.cancel();
  let body;try{body=JSON.parse(text);}catch{}
  const sectionStatus=body?.sources?Object.fromEntries(Object.entries(body.sources).map(([k,v])=>[k,v.status])):null;
  return Response.json({path,mode:mode||'warm',requests:responses.length,measured_at:new Date().toISOString(),runtime:'Cloudflare remote dev; candidate Worker includes unreleased CPI reader',colo:request.cf?.colo||null,status:response.status,bytes:new TextEncoder().encode(text).length,cache_control:response.headers.get('cache-control'),cache_age:response.headers.get('age'),wall_ms:Date.now()-start,cpu_ms:null,cpu_limitation:'Wall time includes network; CPU cannot be inferred.',publisher_fetches:calls.length,calls,source_status:sectionStatus});
 }finally{active=null;}
}};
