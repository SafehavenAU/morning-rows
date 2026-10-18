// Remote-dev harness only: fixed fixtures cannot be selected in the site Worker.
import worker from '../../worker.js';
import {handleUsRequest} from '../../lib/us-desk.js';
import {readUnitedStates,CPI_URLS} from '../../lib/us-cpi.js';
import fixture from '../../test/fixtures/us-cpi.json';
export default {async fetch(request,env){
 const url=new URL(request.url),live=url.pathname.startsWith('/live/');
 if(live){url.pathname=url.pathname.slice(5);return worker.fetch(new Request(url,request),env);}
 if(!url.pathname.startsWith('/fixture/'))return new Response('unknown',{status:404});
 const run=url.searchParams.get('run'),fault=url.searchParams.get('fault');
 if(!run||!/^[a-z0-9-]+$/.test(run))return new Response('invalid run',{status:400});
 url.searchParams.delete('run');url.searchParams.delete('fault');url.pathname=url.pathname.slice(8);
 if(!['none','429','timeout','oversize','revision','new-period',null].includes(fault))return new Response('invalid fault',{status:400});
 let calls=0;
 const read=()=>readUnitedStates({deadline:fault==='timeout'?30:20000,maximum:fault==='oversize'?8:8*1024*1024,fetcher:async(input,{signal})=>{
  calls++;
  if(fault==='429')return new Response('constructed refusal',{status:429});
  if(fault==='timeout')return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
  const name=Object.keys(CPI_URLS).find(k=>CPI_URLS[k]===input);let body=fixture.files[name];
  if(fault==='revision'&&name==='data')body=body.replace('336.940\t','336.941\tR');
  if(fault==='new-period'){
   if(name==='data')body+='CUUR0000SA0\t2026\tM10\t337.000\t\n';
   if(name==='series')body=body.replace('2026\tM09','2026\tM10');
  }
  return new Response(body);
 }});
 // Explicit constructed faults force a fresh fill; subsequent requests see its real cache state.
 const cacheKey='us-integration-'+run;
 if(fault)await caches.default.delete(new Request('https://morningrows.com/united-states.json?release='+cacheKey));
 const response=await handleUsRequest(new Request(url,request),{read,cacheKey,successTtl:4,errorTtl:2});
 response.headers.set('x-probe-fetches',String(calls));response.headers.set('x-probe-kind','constructed fixture, actual reader and route');response.headers.set('x-probe-colo',request.cf?.colo||'unknown');
 return response;
}};
