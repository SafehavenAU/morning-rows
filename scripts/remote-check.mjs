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
if (paths.some(p => !/^\/[a-z0-9/-]+(?:\.json)?$/.test(p))) throw Error('Only site paths are accepted');
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
   const at = output.lastIndexOf('\n'); ok({status:Number(output.slice(at+1)),body:output.slice(0,at)});
  });
  child.stdin.on('error', () => {});
  child.stdin.end(['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(headers).filter(([,v])=>v!==undefined).map(([k,v])=>`header = ${quote(`${k}: ${v}`)}`)].join('\n'));
 });
}
let timer;
try {
 await dev.startWorker({ config: resolve('wrangler.toml'), entrypoint: resolve(process.argv[2] || 'worker.js'), dev: { remote: true, watch: false, inspector: false, server: {hostname:'127.0.0.1',port:8799} } });
 const {proxyData} = await Promise.race([ready, new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('Preview startup timed out')),60000)})]);
 clearTimeout(timer);
 for(const path of paths) {
  const url = new URL(path, 'https://preview.invalid'); Object.assign(url, proxyData.userWorkerUrl);
  const response = await read(url, proxyData.headers);
  let validJson = false;
  try { JSON.parse(response.body); validJson = true; } catch {}
  if(process.env.REPORT_DIR) { await mkdir(process.env.REPORT_DIR,{recursive:true}); await writeFile(join(process.env.REPORT_DIR,path.replaceAll('/','_')+'.response'),response.body); }
  console.log(JSON.stringify({path,status:response.status,valid_json:validJson}));
  if(response.status!==200 || (path.endsWith('.json')&&!validJson)) process.exitCode=1;
 }
} catch { console.error('Remote check failed; credentials withheld. Check Wrangler authentication and source responses separately.'); process.exitCode=1; }
finally { clearTimeout(timer); await dev.teardown(); }
