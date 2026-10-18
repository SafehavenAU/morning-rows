// Read-only remote-dev checks through the workspace HTTP proxy. Pinned to
// Wrangler 4.151.1's unstable_DevEnv reloadComplete event; recheck on upgrades.
// Usage: node scripts/remote-check.mjs worker.js /health.json /england.json
// Optional REPORT_DIR writes public response bodies only, never preview headers.
import { unstable_DevEnv } from 'wrangler';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
process.env.WRANGLER_LOG = 'error';
const paths = process.argv.slice(3);
if (!paths.length) paths.push('/health.json');
if (paths.some(p => !/^\/[a-z0-9/.-]+(?:\?[A-Za-z0-9_=&%.+-]+)?$/.test(p))) throw Error('Only site paths and public selectors are accepted');
const dev = new unstable_DevEnv();
const ready = new Promise((ok, fail) => { dev.once('reloadComplete', ok); dev.once('error', () => fail(Error('Remote preview startup failed'))); });
// Attach rejection handling before configuration can emit an error.
ready.catch(() => {});
const quote = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\r', '').replaceAll('\n', '') + '"';
function read(url, headers) {
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
    for(const line of payload.slice(0,end).split('\r\n').slice(1)) {const i=line.indexOf(':');const key=line.slice(0,i).toLowerCase();if(['etag','cache-control','content-type','content-location','x-retrieved-at','link'].includes(key))publicHeaders[key]=line.slice(i+1).trim();}
    payload=payload.slice(end+4);
   }
   ok({status,body:payload,headers:publicHeaders});
  });
  child.stdin.on('error', () => {});
  child.stdin.end(['silent','show-error','include','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(headers).filter(([,v])=>v!==undefined).map(([k,v])=>`header = ${quote(`${k}: ${v}`)}`)].join('\n'));
 });
}
let timer;
try {
 await dev.startWorker({ config: resolve('wrangler.toml'), entrypoint: resolve(process.argv[2] || 'worker.js'), dev: { remote: true, watch: false, inspector: false, server: {hostname:'127.0.0.1',port:8799} } });
 const {proxyData} = await Promise.race([ready, new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('Preview startup timed out')),60000)})]);
 clearTimeout(timer);
 const checks=paths.map(path=>({path,status:200}));
 if(process.env.CHECK_INFORMATION==='1') checks.push(
  {path:'/catalog.json?desk=canada',status:200},
  {path:'/canada.json?source=exchange&measure=FXUSDCAD',status:200,conditional:true},
  {path:'/canada.json?date=2026-10-12',status:400},
  {path:'/canada.json?source=exchange&measure=FXUSDCAD&observation=2026-10-12',status:404},
  {path:'/wales.json?source=projection&measure=population-2024-based',status:200,conditional:true},
  {path:'/new-zealand.json?source=stats&measure=CORR_FIS_005',status:200},
  {path:'/australia.json?source=hospital&measure=WA.MYH-RM0037',status:200},
  {path:'/northern-ireland.json?source=childhood_bmi&measure=Y8BMIOwOb',status:200},
  {path:'/scotland.json?source=company_insolvencies&measure=total-company-insolvencies',status:200},
  {path:'/england.json?source=pharmacies&measure=total',status:200});
 for(const check of checks) {
  const {path}=check;
  const url = new URL(path, 'https://preview.invalid'); Object.assign(url, proxyData.userWorkerUrl);
  const response = await read(url, proxyData.headers);
  let validJson = false;
  try { JSON.parse(response.body); validJson = true; } catch {}
  if(process.env.REPORT_DIR) { await mkdir(process.env.REPORT_DIR,{recursive:true}); await writeFile(join(process.env.REPORT_DIR,path.replaceAll('/','_')+'.response'),response.body); }
  console.log(JSON.stringify({path,status:response.status,expected:check.status,valid_json:validJson,bytes:Buffer.byteLength(response.body),headers:response.headers}));
  if(response.status!==check.status || (new URL(path,'https://preview.invalid').pathname.endsWith('.json')&&!validJson)) process.exitCode=1;
  if(check.conditional) {
   const repeat=await read(url,{...proxyData.headers,'If-None-Match':response.headers.etag});
   console.log(JSON.stringify({path,conditional_status:repeat.status,bytes:Buffer.byteLength(repeat.body),cache_control:repeat.headers['cache-control']}));
   if(repeat.status!==304||repeat.body.length)process.exitCode=1;
  }
  if(path.includes('?source=')&&response.status===200) {
   const maximum=path.startsWith('/canada')||path.startsWith('/united-states')?3600:path.startsWith('/new-zealand')?120:path.startsWith('/australia')?300:600;
   const age=response.headers['cache-control']?.match(/max-age=(\d+)/)?.[1];
   if(age===undefined||Number(age)>maximum)process.exitCode=1;
  }
 }
} catch { console.error('Remote check failed; credentials withheld. Check Wrangler authentication and source responses separately.'); process.exitCode=1; }
finally { clearTimeout(timer); await dev.teardown(); }
