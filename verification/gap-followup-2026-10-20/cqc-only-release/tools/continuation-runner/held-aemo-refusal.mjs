// Bounded public discovery/refusal evidence only. No AEMO publisher request or approval.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),originApex='https://morningrows.com',regions=['NSW1','QLD1','SA1','TAS1','VIC1'];
const phaseFor=staged=>staged?'staged':'production';
const routes=[{path:'/australia.json',status:200},{path:'/catalog.json?desk=australia',status:200},{path:'/australia.json?source=grid_day',status:404}];
function checkIdentity(revision,version){assert.match(revision,/^[a-f0-9]{40}$/);assert.match(version,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);}
function bodyChecks(path,body,check){
 if(path==='/australia.json'){
  check('Original snapshot source remains healthy',body.sources?.grid?.status==='ok');
  check('Original five grid regions preserved',Array.isArray(body.grid)&&body.grid.length===5&&JSON.stringify(body.grid.map(r=>r.code).sort())===JSON.stringify(regions));
  check('Daily source absent from native payload and source health',!Object.hasOwn(body,'grid_day')&&!Object.hasOwn(body.sources||{},'grid_day'));
 }else if(path.startsWith('/catalog.json')){
  check('Daily source is not discoverable',Array.isArray(body.sources)&&!body.sources.some(s=>s.key==='grid_day'));
  check('Original grid snapshot remains discoverable',body.sources.filter(s=>s.key==='grid').length===1);
 }else{
  check('Held source returns exact unknown-source refusal',body.error==='unknown_source'||body.reason==='unknown_source');
  check('Held refusal contains no substituted daily values',!body.observations?.length&&(body.data===null||body.data===undefined)&&!Object.hasOwn(body,'grid_day'));
 }
}
async function verifyReport(directory,report,{revision,version,staged}){
 const checks=[],inputs=[],check=(label,pass)=>{checks.push({label,pass:Boolean(pass)});assert.ok(pass,label);};
 try{
  checkIdentity(revision,version);const phase=phaseFor(staged),origins=staged?[originApex]:[originApex,'https://www.morningrows.com'];
  check('Exact successful capture identity',report.pass===true&&report.revision===revision&&report.version===version&&report.staged===staged);
  check('Held-only evidence never activates a source',report.source_activated===false&&report.source_contract_accepted===false);
  const plan=origins.flatMap(origin=>routes.map(route=>({...route,origin})));check('Exactly three bounded requests per domain',report.requests?.length===plan.length);
  for(let i=0;i<plan.length;i++){
   const want=plan[i],r=report.requests[i];check('Exact ordered request '+i,r.origin===want.origin&&r.path===want.path&&r.method==='GET'&&r.status===want.status);
   check('Exact source and Worker '+i,r.headers?.['x-source-revision']===revision&&r.headers?.['x-worker-version']===version);
   check('Finite ordered actual capture times '+i,Number.isFinite(Date.parse(r.started_at))&&Date.parse(r.completed_at)>=Date.parse(r.started_at));
   check('JSON media type '+i,/^application\/json(?:;|$)/i.test(r.headers?.['content-type']||''));
   const expectedFile=phase+'-held-aemo/'+String(i+1).padStart(3,'0')+'.body';check('Exact retained capture path '+i,r.file===expectedFile);
   const bytes=await readFile(join(directory,r.file));check('Exact retained capture bytes '+i,bytes.length===r.bytes&&sha(bytes)===r.sha256);inputs.push({file:r.file,bytes:bytes.length,sha256:sha(bytes)});
   bodyChecks(r.path,JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),(label,pass)=>check(want.origin+' '+label,pass));
  }
  return {pass:true,revision,version,staged,requests:plan.length,checks,inputs,source_activated:false,source_contract_accepted:false,original_grid_snapshot_preserved:true,limitations:['This is bounded discovery/refusal and existing snapshot preservation evidence, not completed-day AEMO numerical or source-access acceptance.','No AEMO publisher route was requested by this check.']};
 }catch(error){return {pass:false,error:error.message,checks,inputs,source_activated:false,source_contract_accepted:false};}
}
export async function verifyHeldAemoCapture(repo,directory,options){
 assert.ok(typeof repo==='string'&&repo.startsWith('/'),'Explicit repository context required');const file=phaseFor(options.staged)+'-held-aemo-refusal.json',bytes=await readFile(join(directory,file)),report=JSON.parse(bytes);const proof=await verifyReport(directory,report,options);return {...proof,report_binding:{file,bytes:bytes.length,sha256:sha(bytes)}};
}
async function capture(directory,revision,version,staged){
 checkIdentity(revision,version);directory=resolve(directory);const phase=phaseFor(staged);await mkdir(join(directory,phase+'-held-aemo'));const run=promisify(execFile);
 const report={kind:'Actual bounded held AEMO daily discovery/refusal and existing grid preservation',pass:false,revision,version,staged,started_at:new Date().toISOString(),source_activated:false,source_contract_accepted:false,requests:[],attempts:[]};
 try{
  for(const origin of staged?[originApex]:[originApex,'https://www.morningrows.com'])for(const route of routes){
   const started_at=new Date().toISOString();report.attempts.push({origin,path:route.path,method:'GET',started_at});
   const {stdout}=await run('curl',['--silent','--show-error','--proto','=https','--max-time','90','--include',...(staged?['-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${version}"`]:[]),origin+route.path],{encoding:'buffer',maxBuffer:4*1024*1024});
   let payload=stdout,status,headers={};while(payload.subarray(0,5).toString()==='HTTP/'){
    const end=payload.indexOf('\r\n\r\n');assert.ok(end>=0);const lines=payload.subarray(0,end).toString().split('\r\n');status=Number(lines[0].split(' ')[1]);headers={};for(const line of lines.slice(1)){const at=line.indexOf(':');if(at<1)continue;const key=line.slice(0,at).toLowerCase();if(['content-type','cache-control','x-source-revision','x-worker-version'].includes(key))headers[key]=line.slice(at+1).trim();}payload=payload.subarray(end+4);
   }
   const file=phase+'-held-aemo/'+String(report.requests.length+1).padStart(3,'0')+'.body';await writeFile(join(directory,file),payload,{flag:'wx'});report.requests.push({origin,path:route.path,method:'GET',started_at,completed_at:new Date().toISOString(),status,headers,file,bytes:payload.length,sha256:sha(payload)});
   assert.equal(status,route.status,'Unexpected held-source HTTP status');assert.equal(headers['x-source-revision'],revision);assert.equal(headers['x-worker-version'],version);
  }
  const proof=await verifyReport(directory,{...report,pass:true},{revision,version,staged});assert.equal(proof.pass,true,proof.error);report.pass=true;report.checks=proof.checks;report.original_grid_snapshot_preserved=true;
 }catch(error){report.error=error.message;process.exitCode=1;}
 report.finished_at=new Date().toISOString();await writeFile(join(directory,phase+'-held-aemo-refusal.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:report.pass,error:report.error,requests:report.requests.length,output:directory,source_activated:false}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[directory,revision,version,mode,...extra]=process.argv.slice(2);assert.ok(directory&&!extra.length&&(mode===undefined||mode==='staged'),'OUTPUT_ROOT REVISION VERSION [staged] required');await capture(directory,revision,version,mode==='staged');}
