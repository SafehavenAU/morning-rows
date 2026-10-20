// Constructed transport/body refusal controls only; no HTTP or source acceptance.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyHeldAemoCapture} from './held-aemo-refusal.mjs';
const here=dirname(fileURLToPath(import.meta.url)),output=process.argv[2],revision='1'.repeat(40),version='22222222-2222-4222-8222-222222222222',hash=b=>createHash('sha256').update(b).digest('hex');assert.ok(output);
const base=[{sources:{grid:{status:'ok'}},grid:['NSW1','QLD1','SA1','TAS1','VIC1'].map(code=>({code}))},{sources:[{key:'grid'}]},{error:'unknown_source',data:null,observations:[]}],paths=['/australia.json','/catalog.json?desk=australia','/australia.json?source=grid_day'];
const cases=[
 ['complete staged refusal proof',true,()=>{},true],['complete both-domain refusal proof',false,()=>{},true],
 ['unexpected daily native payload',true,b=>{b[0].grid_day={status:'ok'};},false],['unexpected daily health entry',true,b=>{b[0].sources.grid_day={status:'error'};},false],
 ['daily catalogue discovery',true,b=>b[1].sources.push({key:'grid_day'}),false],['lost original grid region',true,b=>b[0].grid.pop(),false],['duplicate original grid region',true,b=>b[0].grid[0].code='VIC1',false],['original grid source failed',true,b=>b[0].sources.grid.status='error',false],['lost snapshot catalogue',true,b=>b[1].sources=[],false],
 ['wrong refusal reason',true,b=>b[2].error='upstream_unavailable',false],['refusal substitutes zero',true,b=>b[2].data={value:0},false],['refusal leaks observation',true,b=>b[2].observations=[{value:0}],false],
 ['wrong Worker',true,(_b,r)=>r.requests[0].headers['x-worker-version']='33333333-3333-4333-8333-333333333333',false],['wrong refusal HTTP status',true,(_b,r)=>r.requests[2].status=503,false],['incomplete request count',true,(_b,r)=>r.requests.pop(),false],['changed byte digest',true,(_b,r)=>r.requests[0].sha256='0'.repeat(64),false],['wrong body path',true,(_b,r)=>r.requests[0].file='../outside',false],['claimed active source',true,(_b,r)=>r.source_activated=true,false]
];
const temporary=await mkdtemp(join(here,'.constructed-held-')),results=[];
try{for(let n=0;n<cases.length;n++){
 const[name,staged,mutate,want]=cases[n],dir=join(temporary,String(n)),phase=staged?'staged':'production';await mkdir(dir);await mkdir(join(dir,phase+'-held-aemo'));
 const bodies=structuredClone(base),report={pass:true,revision,version,staged,source_activated:false,source_contract_accepted:false,requests:[]};
 const origins=staged?['https://morningrows.com']:['https://morningrows.com','https://www.morningrows.com'];
 for(const origin of origins)for(let i=0;i<3;i++)report.requests.push({origin,path:paths[i],method:'GET',status:i===2?404:200,started_at:'2026-10-20T18:00:00.000Z',completed_at:'2026-10-20T18:00:01.000Z',headers:{'content-type':'application/json','x-source-revision':revision,'x-worker-version':version},file:phase+'-held-aemo/'+String(report.requests.length+1).padStart(3,'0')+'.body'});
 // Mutate semantic bodies before rehashing: superficial checksum validity is preserved.
 if(n>=12){for(let i=0;i<report.requests.length;i++){const raw=Buffer.from(JSON.stringify(bodies[i%3]));report.requests[i].bytes=raw.length;report.requests[i].sha256=hash(raw);await writeFile(join(dir,report.requests[i].file),raw);}mutate(bodies,report);}
 else{mutate(bodies,report);for(let i=0;i<report.requests.length;i++){const raw=Buffer.from(JSON.stringify(bodies[i%3]));report.requests[i].bytes=raw.length;report.requests[i].sha256=hash(raw);await writeFile(join(dir,report.requests[i].file),raw);}}
 await writeFile(join(dir,phase+'-held-aemo-refusal.json'),JSON.stringify(report));const proof=await verifyHeldAemoCapture('/workspace/morning-rows-aemo-followup',dir,{revision,version,staged});assert.equal(proof.pass,want,name);results.push({name,expected_pass:want,observed_pass:proof.pass,pass:true});
}}finally{await rm(temporary,{recursive:true,force:true});}
await writeFile(output,JSON.stringify({pass:true,constructed_controls_only:true,actual_source_or_release_acceptance:false,remote_actions:0,controls:results,control_count:results.length},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,controls:results.length,constructed_controls_only:true}));
