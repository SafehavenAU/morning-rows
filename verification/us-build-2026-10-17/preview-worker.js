// Remote-dev harness only: fixed fixtures cannot be selected in the site Worker.
import worker from '../../worker.js';
import {handleUsRequest} from '../../lib/us-desk.js';
import {readUnitedStates} from '../../lib/us-cpi.js';
import fixture from '../../test/fixtures/us-cpi-workbook.json';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
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
  if(fault==='oversize')return new Response('x'.repeat(262145));
  if(input.endsWith('home.htm'))return new Response(fault==='new-period'?fixture.index.replaceAll('202609','202610').replace('September','October'):fixture.index);
  let body=Uint8Array.from(atob(fixture.workbook_base64),c=>c.charCodeAt(0));
  if(fault==='revision'||fault==='new-period'){
   const files=unzipSync(body),part='xl/worksheets/sheet1.xml';let xml=strFromU8(files[part]);
   if(fault==='revision')xml=xml.replace('<v>336.94</v>','<v>336.941</v>');
   if(fault==='new-period')xml=xml.replace('<c r="L119" s="4" t="s"><v>130</v></c>','<c r="L119" s="7"><v>337</v></c>');
   files[part]=strToU8(xml);body=zipSync(files);
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
