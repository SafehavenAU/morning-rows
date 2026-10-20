import assert from 'node:assert/strict';import{readUnitedStates}from'./baseline/us-cpi.js';import{digest}from'./baseline/information.js';import{fixtures}from'./prepare.mjs';const{index,table}=fixtures();
const variant=process.argv[2],count=Number(process.argv[3]||1);const{handleUsRequest}=await import(variant==='baseline'?'./baseline/us-desk.js':'./fragment-desk.mjs');
new Request('https://example.com');await Response.json({health:true}).text();await digest({service:'Morning Rows',source_revision:'a'.repeat(40)});
const call=async()=>{const r=await handleUsRequest(new Request('https://morningrows.com/united-states.json?source=cpi&measure=CUUR0000SA0'),{cache:null,read:()=>readUnitedStates({fetcher:async u=>new Response(u.endsWith('home.htm')?index:table)})});assert.equal(r.status,200);await r.arrayBuffer();};
if(count>1)for(let i=0;i<5;i++)await call();
const cpu=process.cpuUsage();for(let i=0;i<count;i++)await call();const used=process.cpuUsage(cpu);
console.log(JSON.stringify({variant,count,cpu_ms:(used.user+used.system)/1000/count}));
