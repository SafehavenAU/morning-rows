// Protected remote-dev transport adapted from scripts/remote-check.mjs.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
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

let timer;const report={started_at:new Date().toISOString(),environment:'Cloudflare remote dev; protected preview token not retained',checks:[],limitations:['Single observed location; no global publisher-request ceiling established.','Accelerated 10s success / 2s failure TTL, not elapsed-hour validation.','Faults are constructed, not observed publisher incidents.']};
try{
 await dev.startWorker({config:root+'wrangler.toml',entrypoint:root+'preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8799}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const run='r'+Date.now();
 const check=async(label,path,expected,etag,head=false)=>{
  const u=new URL(path,'https://preview.invalid');Object.assign(u,proxyData.userWorkerUrl);
  const r=await read(u,{...proxyData.headers,...(etag?{'If-None-Match':etag}:{})},head);
  const entry={label,path,status:r.status,expected,headers:r.headers,bytes:Buffer.byteLength(r.body),body:r.body?JSON.parse(r.body):null,pass:r.status===expected};
  report.checks.push(entry);console.log(JSON.stringify({label,status:r.status,pass:entry.pass,cache:r.headers['x-probe-cache'],fetches:r.headers['x-probe-fetches']}));return entry;
 };
 const live=await check('live cold','/live?run='+run,200);
 if(live.status===200){await check('live conditional warm','/live?run='+run,304,live.headers.etag);await check('live HEAD warm','/live?run='+run,200,null,true);}
 if(process.env.REPEAT_LIVE!=='1'){
 const base='/fixture?run='+run;
 const original=await check('fixture cold',base,200);
 await check('fixture conditional warm',base,304,original.headers.etag);
 await new Promise(r=>setTimeout(r,11000));
 await check('fixture expired unchanged',base,304,original.headers.etag);
 const revision=await check('constructed correction',base+'&fault=revision',200,original.headers.etag);
 report.correction_changed_only=revision.body.observations.filter((o,i)=>o.version!==original.body.observations[i].version).map(o=>o.period);
 await check('constructed new period',base+'&fault=new-period',200,revision.headers.etag);
 await check('failed refresh never 304',base+'&fault=429',503,original.headers.etag);
 await check('cached failure never 304',base,503,original.headers.etag);
 await new Promise(r=>setTimeout(r,2200));
 await check('recovery after failure expiry',base,200);
 for(const fault of ['403','500','timeout','body-limit','empty','malformed'])await check('constructed '+fault,'/fixture?run='+run+'-'+fault+'&fault='+fault,503);
 // Concurrent cold fills have no cross-request shared I/O; duplicates are counted explicitly.
 await Promise.all([0,1,2].map(i=>check('concurrent cold '+i,'/fixture?run='+run+'-concurrent',200)));
 }
 report.all_statuses_pass=report.checks.every(c=>c.pass);
 if(!report.all_statuses_pass)process.exitCode=1;
}catch(e){report.error=['preview_start_failed','preview_start_timeout','Preview transport failed'].includes(e.message)?e.message:'rehearsal_failed_details_withheld';process.exitCode=1;}
finally{clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_sha256=Object.fromEntries(['reader.js','representation.js','preview-worker.js','fixture.js','wrangler.toml','run-preview.mjs'].map(f=>[f,createHash('sha256').update(readFileSync(root+f)).digest('hex')]));await writeFile(root+(process.env.REPEAT_LIVE==='1'?'preview-live-repeat.json':'preview-results.json'),JSON.stringify(report,null,2)+'\n');}
