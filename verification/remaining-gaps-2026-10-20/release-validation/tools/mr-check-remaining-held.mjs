// Separate owner-invoked held-source gate. No runtime imports or publisher URLs are requested.
// Capture: node /tmp/mr-check-remaining-held.mjs OUTPUT REVISION VERSION [staged]
// Replay:  node /tmp/mr-check-remaining-held.mjs --verify CAPTURE OUTPUT REVISION VERSION [staged]
// Offline controls: node /tmp/mr-check-remaining-held.mjs --controls FRESH_OUTPUT
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const run=promisify(execFile),self=fileURLToPath(import.meta.url),MAX_BODY=256*1024,MAX_HEADERS=64*1024;
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const holds=Object.freeze([
 {path:'/australia.json?source=grid_day',country:'Australia',source:'AEMO completed-day SA1/VIC1 monthly price CSV',status:406,note:'Held: both regions were refused from the exact production Worker after intermittent preview success on 20 October 2026. No daily summaries are served; the existing grid snapshot remains available.'},
 {path:'/northern-ireland.json?source=electricity_balance',country:'Northern Ireland',source:'DfE/NISRA electricity consumption and renewable generation report',status:'invalid_response',checked:'2026-10-20',note:'The actual protected reader refused the report identity. One bounded diagnosis received a 247-byte HTTP 200 Request Rejected page, not the statistical report. No observations were accepted and this candidate remains disconnected.',url:'https://datavis.nisra.gov.uk/Economy/electricity-consumption-and-renewable-generation-report.html'},
 {path:'/england.json?source=care_assessment_cohort',country:'England',source:'CQC State of Care assessment cohort workbook',status:403,checked:'2026-10-20',note:'The official 2024-25 ratings workbook returned HTTP 403 from the protected Cloudflare runtime. This candidate remains disconnected; the result does not establish a block on other CQC publications.',url:'https://www.cqc.org.uk/system/files/2025-10/20251024_stateofcare2425_ratingsdata.xlsx'},
 {path:'/england.json?source=bedroom_rent',country:'England',source:'ONS Manchester bedroom rent benchmark',status:429,checked:'2026-10-20',note:"The bounded reader's normal official access returned HTTP 429 from the protected Cloudflare runtime. Offline original-data comparisons passed, but no actual native result was accepted and this candidate remains disconnected.",url:'https://www.ons.gov.uk/visualisations/housingpriceslocal/E08000003/'},
]);
export const routes=()=>[{path:'/keys.json',status:200},...holds.map(h=>({path:h.path,status:404}))];
const headerNames=['etag','cache-control','content-type','content-location','x-source-revision','x-worker-version','x-source-dirty','x-build-fingerprint','x-retrieved-at','link'];
const contractHash=sha(Buffer.from(JSON.stringify(holds)));
function options(revision,version,mode){
 assert.match(revision||'',/^[a-f0-9]{40}$/,'Exact revision required');assert.match(version||'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,'Exact Worker version required');assert.ok(mode===undefined||mode==='staged','Mode must be omitted or staged');return {revision,version,staged:mode==='staged'};
}
const planFor=staged=>(staged?['https://morningrows.com']:['https://morningrows.com','https://www.morningrows.com']).flatMap(origin=>routes().map(r=>({...r,origin,method:'GET'})));
export function validateRecord(record,bytes,want,{revision,version},check){
 const label=want.origin+want.path;
 check(label+' exact route/status',record.origin===want.origin&&record.path===want.path&&record.method==='GET'&&record.status===want.status&&record.expected_status===want.status);
 check(label+' bounded complete bytes/hash',bytes.length<=MAX_BODY&&record.bytes===bytes.length&&record.sha256===sha(bytes));
 check(label+' exact source and Worker identity',record.headers?.['x-source-revision']===revision&&record.headers?.['x-worker-version']===version);
 check(label+' allowlisted response metadata',Object.keys(record.headers||{}).every(k=>headerNames.includes(k)));
 check(label+' valid capture interval',Number.isFinite(Date.parse(record.started_at))&&Date.parse(record.completed_at)>=Date.parse(record.started_at));
 check(label+' JSON media type',/^application\/json(?:;|$)/i.test(record.headers['content-type']||''));
 const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));check(label+' JSON object',body!==null&&typeof body==='object'&&!Array.isArray(body));
 if(want.path==='/keys.json'){
  check(label+' blocked list',Array.isArray(body.blocked));
  for(const {path,...expected}of holds){
   const matches=body.blocked.filter(row=>row?.source===expected.source);
   check(label+' one exact '+expected.source,matches.length===1);
   for(const [key,value]of Object.entries(expected))check(label+' '+expected.source+' '+key,matches[0]?.[key]===value);
  }
  const active=/college_activity|rental_benchmark|\bSFC\b|Scottish Funding Council|\bCMHC\b|Canada Mortgage and Housing Corporation|college learning.activity/i;
  check(label+' active SFC and CMHC not blocked',!body.blocked.some(row=>active.test([row?.source,row?.note].filter(Boolean).join(' '))));
 }else{
  check(label+' explicit unknown_source refusal',body.error==='unknown_source');
  check(label+' no substituted data or observations',(body.data===null||body.data===undefined)&&(body.observations===undefined||Array.isArray(body.observations)&&body.observations.length===0)&&!Object.hasOwn(body,'value')&&!Object.hasOwn(body,'rows')&&!Object.hasOwn(body,'context')&&!holds.some(h=>Object.hasOwn(body,new URL(h.path,'https://morningrows.com').searchParams.get('source'))));
  check(label+' refusal is not cached',record.headers['cache-control']==='no-store');
 }
}
function parseResponse(buffer){
 let bytes=buffer,status,headers={},used=0;
 while(bytes.subarray(0,5).toString()==='HTTP/'){
  const end=bytes.indexOf('\r\n\r\n');assert.ok(end>=0,'Invalid response framing');used+=end+4;assert.ok(used<=MAX_HEADERS,'Oversized response metadata');
  const lines=bytes.subarray(0,end).toString('utf8').split('\r\n');status=Number(lines[0].split(' ')[1]);headers={};
  for(const line of lines.slice(1)){const at=line.indexOf(':');if(at<1)continue;const key=line.slice(0,at).toLowerCase();if(headerNames.includes(key))headers[key]=line.slice(at+1).trim();}
  bytes=bytes.subarray(end+4);
 }
 assert.ok(Number.isInteger(status)&&bytes.length<=MAX_BODY,'Invalid or oversized response');return {status,headers,bytes};
}
async function capture(directory,opt){
 const out=resolve(directory);await mkdir(out);
 const report={kind:'Separate actual final-version held-source gate; no publisher endpoint requested by this tool',started_at:new Date().toISOString(),...opt,contract_sha256:contractHash,tool_sha256:sha(await readFile(self)),limits:{requests_per_domain:5,max_body_bytes:MAX_BODY,max_headers_bytes:MAX_HEADERS,timeout_seconds:30,no_redirects:true,no_retries:true},requests:[],checks:[],limitations:['This gate verifies public held-source refusal and discovery text, not source accessibility.','Local worker tests establish that these held selectors do not invoke publishers; response captures alone do not trace internal fetches.','This gate adds no monitoring acceptance, scheduled evidence or receipt.']};
 const check=(label,pass)=>{report.checks.push({label,pass:Boolean(pass)});assert.ok(pass,label);};
 try{
  for(const want of planFor(opt.staged)){
   const record={origin:want.origin,path:want.path,method:'GET',expected_status:want.status,started_at:new Date().toISOString()};report.requests.push(record);
   let response;
   try{const {stdout}=await run('curl',['--silent','--show-error','--proto','=https','--max-time','30','--max-filesize',String(MAX_BODY),'--include',...(opt.staged?['-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${opt.version}"`]:[]),want.origin+want.path],{encoding:'buffer',maxBuffer:MAX_BODY+MAX_HEADERS,timeout:35000});response=parseResponse(stdout);}
   catch{record.completed_at=new Date().toISOString();record.transport_error='capture_transport_failed_or_response_bound_exceeded';throw Error(record.transport_error);}
   const {status,headers,bytes}=response;Object.assign(record,{completed_at:new Date().toISOString(),status,headers,bytes:bytes.length,sha256:sha(bytes),file:String(report.requests.length).padStart(3,'0')+'.body'});
   await writeFile(join(out,record.file),bytes,{flag:'wx'});validateRecord(record,bytes,want,opt,check);
  }
  check('complete exact route coverage',report.requests.length===planFor(opt.staged).length);report.pass=true;
 }catch(error){report.pass=false;report.error=error.message;process.exitCode=1;}
 report.finished_at=new Date().toISOString();await writeFile(join(out,'held-interface-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:report.pass,error:report.error,requests:report.requests.length,checks:report.checks.length,output:out}));
}
export async function verify(directory,opt){
 const raw=await readFile(join(directory,'held-interface-report.json')),capture=JSON.parse(raw),report={kind:'Offline replay of retained held-source capture bytes',pass:false,...opt,capture_report_sha256:sha(raw),checks:[],files:[]};
 const check=(label,pass)=>{report.checks.push({label,pass:Boolean(pass)});assert.ok(pass,label);};
 try{
  check('capture pass and exact identity/mode',capture.pass===true&&capture.revision===opt.revision&&capture.version===opt.version&&capture.staged===opt.staged);
  check('unchanged held-source contract',capture.contract_sha256===contractHash);check('exact executed gate tool',capture.tool_sha256===sha(await readFile(self)));
  const plan=planFor(opt.staged);check('exact request coverage',capture.requests?.length===plan.length);const files=new Set();
  for(let i=0;i<plan.length;i++){const record=capture.requests[i];check('safe unique body path '+i,/^\d{3}\.body$/.test(record.file||'')&&!files.has(record.file));files.add(record.file);const bytes=await readFile(join(directory,record.file));validateRecord(record,bytes,plan[i],opt,check);report.files.push({file:record.file,bytes:bytes.length,sha256:sha(bytes)});}
  report.pass=true;
 }catch(error){report.error=error.message;}
 report.verified_at=new Date().toISOString();return report;
}
async function controls(output){
 const opt={revision:'a'.repeat(40),version:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',staged:true},clock='2026-10-20T12:00:00.000Z';
 const make=(want,body)=>{const bytes=Buffer.from(JSON.stringify(body));return {bytes,record:{...want,expected_status:want.status,started_at:clock,completed_at:clock,headers:{'x-source-revision':opt.revision,'x-worker-version':opt.version,'content-type':'application/json','cache-control':want.status===404?'no-store':'public, max-age=300'},bytes:bytes.length,sha256:sha(bytes)}};};
 const good=planFor(true).map(want=>({...make(want,want.status===200?{blocked:holds.map(({path,...h})=>structuredClone(h))}:{error:'unknown_source',message:'Selection not supported'}),want}));
 const results=[],check=(label,pass)=>assert.ok(pass,label);
 for(const item of good)validateRecord(item.record,item.bytes,item.want,opt,check);results.push({label:'Five complete constructed routes pass',pass:true});
 const cases=[
  ['wrong Worker version',x=>x[0].record.headers['x-worker-version']='ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee'],
  ['missing held entry',x=>{const b=JSON.parse(x[0].bytes);b.blocked.splice(1,1);Object.assign(x[0],make(x[0].want,b));}],
  ['wrong held HTTP status meaning',x=>{const b=JSON.parse(x[0].bytes);b.blocked[1].status=200;Object.assign(x[0],make(x[0].want,b));}],
  ['erroneous activation with returned data',x=>{Object.assign(x[1],make(x[1].want,{error:'unknown_source',data:{value:1}}));}],
  ['erroneous activation with HTTP200',x=>x[1].record.status=200],
  ['accepted CMHC falsely blocked',x=>{const b=JSON.parse(x[0].bytes);b.blocked.push({country:'Canada',source:'CMHC rental benchmark',status:403});Object.assign(x[0],make(x[0].want,b));}],
  ['body hash mismatch',x=>x[0].record.sha256='0'.repeat(64)],
 ];
 for(const [label,edit]of cases){const copy=good.map(x=>({...x,record:structuredClone(x.record),bytes:Buffer.from(x.bytes)}));edit(copy);assert.throws(()=>{for(const x of copy)validateRecord(x.record,x.bytes,x.want,opt,check);},undefined,label);results.push({label,pass:true,rejected:true});}
 const report={kind:'Constructed offline held-gate controls; no HTTP, actual capture or acceptance',pass:true,tool_sha256:sha(await readFile(self)),contract_sha256:contractHash,positive_routes:5,rejected_controls:cases.length,results};await writeFile(resolve(output),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,positive_routes:5,rejected_controls:cases.length,output:resolve(output)}));
}
async function main(args){
 if(args[0]==='--controls'){assert.equal(args.length,2,'--controls FRESH_OUTPUT');return controls(args[1]);}
 if(args[0]==='--verify'){const [,directory,output,revision,version,mode,...extra]=args;assert.ok(directory&&output&&!extra.length,'--verify CAPTURE OUTPUT REVISION VERSION [staged]');const result=await verify(resolve(directory),options(revision,version,mode));await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:result.pass,error:result.error,checks:result.checks.length,output:resolve(output)}));if(!result.pass)process.exitCode=1;return;}
 const [directory,revision,version,mode,...extra]=args;assert.ok(directory&&!extra.length,'OUTPUT REVISION VERSION [staged]');return capture(directory,options(revision,version,mode));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main(process.argv.slice(2));
