// Protected temporary remote dev only. POST fixtures never contact a publisher.
import {readAemoDailyBundles,validateAemoDailyBundlesRepresentation,AEMO_DAILY_INDEX,AEMO_DAILY_LIMITS} from '../../../../lib/aemo-daily-bundles.js';
import {readSections,readBounded,fetchOfficial,SourceError} from '../../../../lib/sources.js';
const FIXED='2026-10-20T12:30:00.000Z';
const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export default {async fetch(request){
 const url=new URL(request.url),live=url.pathname==='/live';
 if(!live&&url.pathname!=='/fixture')return new Response('Not found',{status:404});
 if(live&&request.method!=='GET'||!live&&request.method!=='POST')return new Response('Method not allowed',{status:405});
 const started_at=new Date().toISOString(),calls=[];let spec;
 if(!live){try{spec=JSON.parse(await readBounded(request,1600000));}catch{return new Response('Invalid fixture',{status:400});}}
 let clockCalls=0;const clock=live?()=>new Date().toISOString():()=>{clockCalls++;if(spec.clock==='bad')return 'invalid';if(spec.clock==='next-day')return '2026-10-21T12:30:00.000Z';if(spec.clock==='post-hash'&&clockCalls>=9||spec.clock==='post-validation'&&clockCalls>=10)return '2026-10-20T14:00:00.000Z';return FIXED;};
 const fetcher=async(target,options)=>{
  calls.push({url:target,accept:options.headers.accept,redirect:options.redirect});
  if(live)return fetchOfficial(target,options);
  const isIndex=target===AEMO_DAILY_INDEX;
  if(isIndex&&spec.transport==='redirect')return new Response(null,{status:302,headers:{location:AEMO_DAILY_INDEX}});
  if(isIndex&&spec.transport==='http406')return new Response('Constructed refusal',{status:406});
  if(isIndex&&spec.transport==='timeout')throw new DOMException('Constructed timeout','TimeoutError');
  if(isIndex&&spec.transport==='index-oversize')return new Response(' '.repeat(AEMO_DAILY_LIMITS.index+1));
  if(!isIndex&&spec.transport==='zip-oversize')return new Response(new Uint8Array(AEMO_DAILY_LIMITS.compressed+1));
  if(isIndex)return new Response(spec.index,{headers:{'content-type':'text/html'}});
  const item=spec.inputs.find(x=>x.url===target);if(!item)throw Error('Unadvertised fixture request');
  return new Response(decode(item.data),{headers:{'content-type':'application/zip'}});
 };
 let native;
 const body=await readSections({grid_day:async()=>{native=await readAemoDailyBundles({fetcher,now:clock});if(native.status==='error')throw new SourceError('Both bounded AEMO regions failed');return native;},sibling:async()=>({value:7})});
 const completed_at=new Date().toISOString();
 const validated=native?validateAemoDailyBundlesRepresentation(native,{now:live?completed_at:FIXED}):null;
 return Response.json({kind:live?'Actual live daily-bundle reader':'Constructed fixture through actual daily-bundle reader',fixture:!live,fixture_clock:live?null:FIXED,started_at,completed_at,calls,clock_calls:clockCalls,validated,body});
}};
