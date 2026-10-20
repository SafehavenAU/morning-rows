import assert from 'node:assert/strict';
import {handleUsRequest as original} from '../../../../lib/us-desk.js';
import {readUnitedStates} from '../../../../lib/us-cpi.js';
import {semantic} from '../../../../lib/information.js';
import {serialize} from './prototype.mjs';
import {makeCandidate,fixtures} from './prepare.mjs';

const generated=makeCandidate();
try {
 const {handleUsRequest:candidate}=await import(generated.url);
 const {index,table}=fixtures();
 const read=async()=>{const body=await readUnitedStates({fetcher:async u=>new Response(u.endsWith('home.htm')?index:table)});body.sources.cpi.fetched_at='2026-10-20T00:00:00Z';return body;};
 const route='/united-states.json?source=cpi&measure=CUUR0000SA0';
 const invoke=async fn=>{const r=await fn(new Request('https://morningrows.com'+route),{read,cache:null,now:()=>1792454400000});assert.equal(r.status,200);return{body:await r.text(),headers:[...r.headers]};};
 for(const v of [{b:2,a:1},{x:undefined,a:[,undefined,NaN,Infinity,-0],retrieved_at:'now'}, {'20':20,'1':1,'10':10,z:9,a:1},null,42,'text',[],{def:{unit:'index'},rows:[]}])assert.equal(serialize(v),JSON.stringify(semantic(v)));
 assert.deepEqual(await invoke(candidate),await invoke(original));
 const results=[];
 if(!process.argv.includes('--smoke'))for(let round=0;round<6;round++){
  for(const [label,fn]of round%2?[['candidate',candidate],['original',original]]:[['original',original],['candidate',candidate]]){
   const cpu=process.cpuUsage(),time=performance.now();for(let i=0;i<150;i++)await invoke(fn);const used=process.cpuUsage(cpu);
   results.push({round,label,cpu_ms_per_request:(used.user+used.system)/1000/150,wall_ms_per_request:(performance.now()-time)/150});
  }
 }
 console.log(JSON.stringify({scope:'Local Node diagnostic, retained fixtures; not edge CPU acceptance',equivalent:true,results},null,2));
}finally{generated.remove();}
