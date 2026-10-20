// Fixed official URLs only. No keys, proxy service, fallback or production route.
import {URLS,boundedText} from '../../research/us-onboarding-2026-10-17/rehearsal/reader.js';
export default {async fetch(){
 const results=[];
 for(const [name,url] of Object.entries(URLS)){
  const start=Date.now();
  try{
   const response=await fetch(url,{headers:{'User-Agent':'MorningRows/1.0 (+https://morningrows.com)','Accept':'text/plain'},signal:AbortSignal.timeout(20000)});
   const status=response.status;
   if(!response.ok){await response.body?.cancel();results.push({name,url,status,elapsed_ms:Date.now()-start});continue;}
   const body=await boundedText(response,8*1024*1024);
   results.push({name,url,status,bytes:body.bytes,elapsed_ms:Date.now()-start});
  }catch{results.push({name,url,error:'bounded_request_failed',elapsed_ms:Date.now()-start});}
 }
 return Response.json({checked_at:new Date().toISOString(),request_identification:'MorningRows/1.0 (+https://morningrows.com)',all_accessible:results.every(r=>r.status===200),results});
}};
