// Protected remote-dev transport adapted from scripts/remote-check.mjs.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
process.env.WRANGLER_LOG='error';
const root=fileURLToPath(new URL('.',import.meta.url));
const dev=new unstable_DevEnv();
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});
ready.catch(()=>{});
const quote = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\r', '').replaceAll('\n', '') + '"';
function read(url, headers, head=false) {
 return new Promise((ok, fail) => {
  // The ephemeral preview token is passed only through stdin, never argv/logs.
  const child = spawn('curl', ['--config', '-'], { stdio: ['pipe', 'pipe', 'ignore'] });
  let output = '', size = 0;
  child.stdout.on('data', b => { size += b.length; if(size > 2097152) { child.kill(); fail(Error('Preview response too large')); } else output += b; });
  child.on('error', () => fail(Error('curl could not start')));
  child.on('close', code => {
   if(code !== 0) return fail(Error('Preview transport failed'));
   const at = output.lastIndexOf('\n'), status=Number(output.slice(at+1));
   let payload=output.slice(0,at), publicHeaders={};
   // curl -i may contain a proxy CONNECT header and then the origin header.
   while(payload.startsWith('HTTP/')) {
    const end=payload.indexOf('\r\n\r\n'); if(end<0) throw Error('Invalid preview headers');
    for(const line of payload.slice(0,end).split('\r\n').slice(1)) {const i=line.indexOf(':');const key=line.slice(0,i).toLowerCase();if((['etag','cache-control','content-type','content-location','x-retrieved-at','link'].includes(key)||key.startsWith('x-probe-')))publicHeaders[key]=line.slice(i+1).trim();}
    payload=payload.slice(end+4);
   }
   ok({status,body:payload,headers:publicHeaders});
  });
  child.stdin.on('error', () => {});
  child.stdin.end(['silent','show-error','include',...(head?['head']:[]),'max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(headers).filter(([,v])=>v!==undefined).map(([k,v])=>`header = ${quote(`${k}: ${v}`)}`)].join('\n'));
 });
}

let timer;const report={started_at:new Date().toISOString(),environment:'Cloudflare remote dev; protected preview token not retained',checks:[],limitations:['One bounded diagnostic per documented official route; no production change or retry loop.']};
const cpuEvents=[];const originalEmit=EventEmitter.prototype.emit;
// Observe only numeric resource fields from Wrangler's existing trace-v1 tail.
// Never retain event URLs, request/response headers, log messages or transport data.
EventEmitter.prototype.emit=function(event,...args){
 if(event==='message')try{const d=JSON.parse(String(args[0]));if(typeof d.cpuTime==='number'&&typeof d.wallTime==='number')cpuEvents.push({cpu_ms:d.cpuTime,wall_ms:d.wallTime,outcome:d.outcome,event_timestamp:d.eventTimestamp});}catch{}
 return originalEmit.call(this,event,...args);
};
try{
 await dev.startWorker({config:root+'wrangler.toml',entrypoint:root+'access-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8799}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const run='r'+Date.now();
 const check=async(label,path,expected,etag,head=false)=>{
  const u=new URL(path,'https://preview.invalid');Object.assign(u,proxyData.userWorkerUrl);
  const r=await read(u,{...proxyData.headers,...(etag?{'If-None-Match':etag}:{})},head);
  const entry={label,path,status:r.status,expected,headers:r.headers,bytes:Buffer.byteLength(r.body),body:r.body?JSON.parse(r.body):null,pass:r.status===expected};
  report.checks.push(entry);console.log(JSON.stringify({label,status:r.status,pass:entry.pass,cache:r.headers['x-probe-cache'],fetches:r.headers['x-probe-fetches']}));return entry;
 };
 for(let i=0;i<3;i++)await check('real cold read '+(i+1),'/access',200);
 await new Promise(ok=>setTimeout(ok,1500));
 report.all_statuses_pass=report.checks.every(c=>c.pass);
 if(!report.all_statuses_pass)process.exitCode=1;
}catch(e){report.error=['preview_start_failed','preview_start_timeout','Preview transport failed'].includes(e.message)?e.message:'rehearsal_failed_details_withheld';process.exitCode=1;}
finally{clearTimeout(timer);await dev.teardown();EventEmitter.prototype.emit=originalEmit;report.runtime_cpu_events=cpuEvents;report.cpu_measurement_available=cpuEvents.length>0;report.finished_at=new Date().toISOString();report.code_sha256=Object.fromEntries(['access-worker.js','wrangler.toml','check-access.mjs'].map(f=>[f,createHash('sha256').update(readFileSync(root+f)).digest('hex')]));await writeFile(root+'cold-read-results.json',JSON.stringify(report,null,2)+'\n');}
