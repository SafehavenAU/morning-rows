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

const codeFiles=['../../lib/claimant-count.js','../../lib/information.js','../../lib/sources.js','original/nomis-national.csv','original/nomis-time.json','preview-worker.js','integration.toml','check-preview.mjs'];
const codeHashes=()=>Object.fromEntries(codeFiles.map(f=>[f,createHash('sha256').update(readFileSync(root+f)).digest('hex')]));
let timer;
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',kind:'Constructed faults through actual claimant reader and selector; no live publisher proof',checks:[],code_sha256_before:codeHashes()};
try {
 await dev.startWorker({config:root+'integration.toml',entrypoint:root+'preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8799}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 for(const [fault,period,expected] of [['none',null,200],['none','2025-08',200],['none','2026-08',200],['none','1900-01',404],['revision',null,200],...['http','timeout','oversize','invalid-json','partial','wrong-geography','suppression'].map(f=>[f,null,503])]) {
  const path='/case?fault='+fault+(period?'&observation='+period:'');
  const url=new URL(path,'https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
  const result=await read(url,proxyData.headers),body=JSON.parse(result.body);
  const pass=result.status===200&&body.selected_status===expected&&body.sibling?.value===7&&body.sibling_health?.status==='ok'&&(expected===503?body.source_health?.status==='error'&&body.selected.observations.length===0:body.source_health?.status==='ok')&&(expected!==200||body.selected.observations.length===(period?1:13));
  report.checks.push({fault,period,expected,status:result.status,body,pass});
  console.log(JSON.stringify({fault,period,pass,selected_status:body.selected_status}));
 }
 const original=report.checks.find(c=>c.fault==='none'&&!c.period).body.selected;
 const revised=report.checks.find(c=>c.fault==='revision').body.selected;
 const changed=revised.observations.filter((o,i)=>o.version!==original.observations[i].version).map(o=>o.period);
 report.revision={changed,pass:changed.length===1&&changed[0]==='2026-08'};
 report.pass=report.checks.every(c=>c.pass)&&report.revision.pass;
 if(!report.pass)process.exitCode=1;
} catch(e) { report.error=['preview_start_timeout','preview_start_failed','Preview transport failed'].includes(e.message)?e.message:'preview_validation_failed';report.pass=false;process.exitCode=1; }
finally {clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_sha256=codeHashes();report.code_unchanged=JSON.stringify(report.code_sha256)===JSON.stringify(report.code_sha256_before);report.pass=report.pass&&report.code_unchanged;if(!report.pass)process.exitCode=1;await writeFile(root+'fault-preview.json',JSON.stringify(report,null,2)+'\n');}
