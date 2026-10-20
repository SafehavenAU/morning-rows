// Protected remote-dev transport adapted from scripts/remote-check.mjs.
import {createRequire} from 'node:module';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
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
try{
 const handle=await dev.startWorker({config:root+'wrangler.toml',entrypoint:root+'access-worker.js',dev:{remote:true,watch:false,inspector:{hostname:'127.0.0.1',port:9231},server:{hostname:'127.0.0.1',port:8799}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const run='r'+Date.now();
 const check=async(label,path,expected,etag,head=false)=>{
  const u=new URL(path,'https://preview.invalid');Object.assign(u,proxyData.userWorkerUrl);
  const r=await read(u,{...proxyData.headers,...(etag?{'If-None-Match':etag}:{})},head);
  const entry={label,path,status:r.status,expected,headers:r.headers,bytes:Buffer.byteLength(r.body),body:r.body?JSON.parse(r.body):null,pass:r.status===expected};
  report.checks.push(entry);console.log(JSON.stringify({label,status:r.status,pass:entry.pass,cache:r.headers['x-probe-cache'],fetches:r.headers['x-probe-fetches']}));return entry;
 };
 report.stage='local_proxy_ready';await Promise.race([handle.ready,new Promise((_,fail)=>setTimeout(()=>fail(Error('proxy_ready_timeout')),15000))]);report.stage='local_inspector_discovery';const inspectorUrl=await handle.inspectorUrl;report.inspector_available=Boolean(inspectorUrl);report.inspector_hostname=inspectorUrl?.hostname;if(!inspectorUrl||!['127.0.0.1','localhost','[::1]','0.0.0.0'].includes(inspectorUrl.hostname))throw Error('inspector_failed');const inspector = JSON.parse((await promisify(execFile)('curl',['--silent','--show-error','--noproxy','*','--max-time','5',new URL('/json',inspectorUrl).href])).stdout);
 report.inspector_targets=Array.isArray(inspector)?inspector.length:null;report.stage='inspector_socket';const socket = new WebSocket(inspector[0].webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',()=>fail(Error('inspector_failed')),{once:true});});
 let serial=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {ok,fail,timer}=pending.get(m.id);clearTimeout(timer);pending.delete(m.id);m.error?fail(Error('profiler_unavailable')):ok(m.result);}});
 const cdp=(method,params={})=>new Promise((ok,fail)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);fail(Error('profiler_timeout'));},10000);pending.set(id,{ok,fail,timer});socket.send(JSON.stringify({id,method,params}));});
 try {
  report.stage='profiler_enable';await cdp('Profiler.enable');report.stage='profiler_start';await cdp('Profiler.start');report.stage='cold_reads';
  for(let i=0;i<3;i++)await check('independent real cold read '+(i+1),'/access',200);
  const {profile}=await cdp('Profiler.stop');
  const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame.functionName]));
  let sampledActiveUs=0;for(let i=0;i<(profile.samples||[]).length;i++)if(!['(idle)','(root)'].includes(nodes.get(profile.samples[i])))sampledActiveUs+=profile.timeDeltas?.[i]||0;
  report.cpu_profile={method:'Remote V8 sampling profiler; estimate across three cold reads, not billed CPU',samples:profile.samples?.length||0,sampled_active_ms:sampledActiveUs/1000,duration_ms:(profile.endTime-profile.startTime)/1000};
  report.heap_after=await cdp('Runtime.getHeapUsage');
 } finally {socket.close();}

 report.all_statuses_pass=report.checks.every(c=>c.pass);
 if(!report.all_statuses_pass)process.exitCode=1;
}catch(e){report.error=['preview_start_failed','preview_start_timeout','Preview transport failed','inspector_failed','profiler_unavailable','profiler_timeout'].includes(e.message)?e.message:'rehearsal_failed_details_withheld';process.exitCode=1;}
finally{clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_sha256=Object.fromEntries(['access-worker.js','wrangler.toml','check-access.mjs'].map(f=>[f,createHash('sha256').update(readFileSync(root+f)).digest('hex')]));await writeFile(root+'profile-attempt-6.json',JSON.stringify(report,null,2)+'\n');}
