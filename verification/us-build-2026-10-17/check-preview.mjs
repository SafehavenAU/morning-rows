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

let timer;const report={started_at:new Date().toISOString(),environment:'Cloudflare remote dev; protected preview token not retained',checks:[],limitations:['Single observed location; no global publisher-request ceiling established.','Accelerated 4s success / 2s failure TTL; one-hour expiry also covered with controlled-clock Node tests.','Faults are constructed, not observed publisher incidents.']};
try{
 await dev.startWorker({config:root+'integration.toml',entrypoint:root+'preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8799}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const run='r'+Date.now();
 const check=async(label,path,expected,etag,head=false)=>{
  const u=new URL(path,'https://preview.invalid');Object.assign(u,proxyData.userWorkerUrl);
  const r=await read(u,{...proxyData.headers,...(etag?{'If-None-Match':etag}:{})},head);
  const entry={label,path,status:r.status,expected,headers:r.headers,bytes:Buffer.byteLength(r.body),body:r.body?JSON.parse(r.body):null,pass:r.status===expected};
  report.checks.push(entry);console.log(JSON.stringify({label,status:r.status,pass:entry.pass,cache:r.headers['x-probe-cache'],fetches:r.headers['x-probe-fetches']}));return entry;
 };
 const base='/fixture/united-states.json?run='+run+'&source=cpi&measure=CUUR0000SA0';
 const live=await check('actual live original reader','/live/united-states.json?source=cpi&measure=CUUR0000SA0',200);
 report.live_source_gate=live.status===200&&live.body?.observations?.length===13;
 await check('actual live full desk keeps explicit source health','/live/united-states.json',200);
 await check('actual current catalogue','/live/catalog.v2.json',200);
 await check('actual legacy catalogue','/live/catalog.json',200);
 await check('actual v2 schema','/live/schema.v2.json',200);
 await check('actual unsupported country filter','/live/united-states.json?geography=California',400);
 const original=await check('fixture actual reader cold',base,200);
 await check('fixture warm conditional',base,304,original.headers.etag);
 await check('fixture HEAD warm',base,200,null,true);
 await check('fixture conditional HEAD warm',base,304,original.headers.etag,true);
 await check('fixture unavailable exact month',base+'&observation=2025-10',200);
 await check('fixture out-of-window refusal',base+'&observation=2025-08',404);
 await new Promise(r=>setTimeout(r,4200));
 await check('fixture expired unchanged',base,304,original.headers.etag);
 const revised=await check('fixture corrected value',base+'&fault=revision',200,original.headers.etag);
 report.changed_observations=revised.body.observations.filter((o,i)=>o.version!==original.body.observations[i].version).map(o=>o.period);
 await check('fixture newly available month',base+'&fault=new-period',200,revised.headers.etag);
 const failure=await check('fixture failed refresh with old ETag',base+'&fault=429',503,original.headers.etag);
 await check('fixture same failure not 304',base,503,failure.headers.etag);
 const failedFull=await check('fixture full failed desk','/fixture/united-states.json?run='+run,200);
 await check('fixture full failed desk not 304','/fixture/united-states.json?run='+run,200,failedFull.headers.etag);
 await new Promise(r=>setTimeout(r,2200));
 await check('fixture recovered after expiry',base,200);
 for(const fault of ['timeout','oversize'])await check('fixture '+fault,base+'&fault='+fault,503);
 report.all_statuses_pass=report.checks.every(c=>c.pass);
 if(!report.all_statuses_pass)process.exitCode=1;
}catch(e){report.error=['preview_start_failed','preview_start_timeout','Preview transport failed'].includes(e.message)?e.message:'rehearsal_failed_details_withheld';process.exitCode=1;}
finally{clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_sha256=Object.fromEntries(['../../lib/us-cpi.js','../../lib/information-v2.js','../../lib/us-desk.js','../../worker.js','preview-worker.js','integration.toml','check-preview.mjs'].map(f=>[f,createHash('sha256').update(readFileSync(root+f)).digest('hex')]));await writeFile(process.env.US_PREVIEW_REPORT || root+'integration-preview.json',JSON.stringify(report,null,2)+'\n');}
