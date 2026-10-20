// Run with run-first.mjs so fixture validation/module preparation happens in
// the parent process, outside this fresh child's initialization and CPU probe.
import {readFileSync} from 'node:fs';
import {readUnitedStates} from '../../../../lib/us-cpi.js';
const label=process.argv[2],candidateUrl=process.argv[3];
if(!['original','candidate'].includes(label))throw Error('Expected original or candidate');
const {handleUsRequest}=await import(label==='candidate'?candidateUrl:'../../../../lib/us-desk.js');
const index=readFileSync(new URL('inputs/publisher-index.html',import.meta.url),'utf8'),table=readFileSync(new URL('inputs/database-table.html',import.meta.url),'utf8');
const read=()=>readUnitedStates({fetcher:async u=>new Response(u.endsWith('home.htm')?index:table)});
if(process.argv.includes('--warm-transport')){await new Response('warm transport').text();new Request('https://morningrows.com/health.json');}
const start=process.cpuUsage();
const response=await handleUsRequest(new Request('https://morningrows.com/united-states.json?source=cpi&measure=CUUR0000SA0'),{read,cache:null});
if(response.status!==200)throw Error('not200');await response.text();const cpu=process.cpuUsage(start);
console.log(JSON.stringify({label,cpu_ms:(cpu.user+cpu.system)/1000}));
