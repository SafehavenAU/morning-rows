// Ephemeral remote-dev harness. No production routes, bindings or secrets.
import {acquire,URLS} from './reader.js';
import {represent,respond} from './representation.js';
import fixture from './fixture.js';
export default {async fetch(request){
 const u=new URL(request.url),mode=u.pathname.slice(1),run=u.searchParams.get('run');
 if(!['live','fixture'].includes(mode)||!run||!/^[a-z0-9-]+$/.test(run))return new Response('Unknown rehearsal',{status:404});
 const fault=u.searchParams.get('fault');
 if(fault&&!['403','429','500','timeout','body-limit','empty','malformed','revision','new-period'].includes(fault))return new Response('Unknown fault',{status:400});
 const key=new Request(`https://rehearsal.invalid/${mode}/${run}`),now=Date.now();
 const cached=fault?null:await caches.default.match(key);
 let result,metrics={fetches:0},hit=false,expires;
 if(cached&&Number(cached.headers.get('x-expires'))>now){result=await cached.json();hit=true;expires=Number(cached.headers.get('x-expires'));}
 else{
  try{
   let fetcher=fetch,deadline=20000,maximum=8*1024*1024;
   if(mode==='fixture'||fault){
    if(fault==='timeout')deadline=30;
    if(fault==='body-limit')maximum=8;
    fetcher=async(url,opts)=>{
     if(['403','429','500'].includes(fault))return new Response('Constructed upstream failure',{status:Number(fault)});
     if(fault==='timeout')return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
     const name=Object.keys(URLS).find(k=>URLS[k]===url);let value=fixture[name];
     if(fault==='empty')return new Response(null);
     if(fault==='malformed')value='<html>upstream maintenance</html>';
     if(fault==='revision'&&name==='data')value=value.replace('336.940','336.941');
     if(fault==='new-period'){
      if(name==='data')value+='CUUR0000SA0\t2026\tM10\t337.000\t\n';
      if(name==='series')value=value.replace('2026\tM09','2026\tM10');
     }
     return new Response(value);
    };
   }
   const acquired=await acquire(fetcher,{deadline,maximum});metrics=acquired.metrics;
   result=await represent(acquired.data,new Date().toISOString());
  }catch(e){metrics=e.metrics||{fetches:3};result=await represent(null,new Date().toISOString(),e.message);}
  // Accelerated test TTL. Production plan is one hour success / 30 seconds failure.
  const ttl=result.retrieval.status==='ok'?10:2;
  expires=Date.now()+ttl*1000;
  await caches.default.put(key,Response.json(result,{headers:{'Cache-Control':`public, max-age=${ttl}`,'x-expires':String(expires)}}));
 }
 return respond(request,result,{'Cache-Control':result.retrieval.status==='ok'?`public, max-age=${Math.max(0,Math.floor((expires-Date.now())/1000))}`:'no-store','x-probe-cache':hit?'hit':'miss','x-probe-fetches':String(metrics.fetches),'x-probe-transport':JSON.stringify(metrics.transport||{}),'x-probe-bytes':JSON.stringify(metrics.bytes||{}),'x-probe-elapsed-ms':String(metrics.elapsed_ms??0),'x-probe-colo':request.cf?.colo||'unknown','x-probe-kind':mode==='live'&&!fault?'original publisher':'constructed fixture'});
}};
