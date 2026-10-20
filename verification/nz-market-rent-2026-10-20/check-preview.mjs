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

const codeFiles=['../../lib/nz-market-rent.js','../../lib/information.js','../../lib/sources.js','original/avondale-ajax.html','original/kelburn-ajax.html','preview-worker.js','integration.toml','check-preview.mjs'];
const codeHashes=()=>Object.fromEntries(codeFiles.map(f=>[f,createHash('sha256').update(readFileSync(root+f)).digest('hex')]));
const output=process.argv[2]||root+'fault-preview.json';
try {readFileSync(output);throw Error('Output exists');}catch(e){if(e.code!=='ENOENT')throw e;}
let timer;
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',kind:'Constructed faults through actual rent reader and selector; no live publisher proof',checks:[],code_sha256_before:codeHashes()};
const m='nz-auckland-avondale.apartment.2.median';
const cases=[
 ['none',null,null,200,116],['none',m,'2026-03-01/2026-08-31',200,1],['none',m,'1900-01-01/1900-06-30',404,0],
 ['none','nz-auckland-avondale.apartment.4.median',null,404,0],['revision',null,null,200,116],['zero',null,null,200,116],
 ['one-http',null,null,200,64],['one-http',m,null,503,0],['one-http','nz-wellington-kelburn.apartment.2.median',null,200,1],
 ...['http','timeout','oversize','invalid-json','wrong-geography','unknown-token','bedroom-five','currency','quartiles','truncated','mixed-period','future-period'].map(f=>[f,null,null,503,0])
];
const positives={};
try {
 await dev.startWorker({config:root+'integration.toml',entrypoint:root+'preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8799}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 for(const [fault,measure,period,expected,count] of cases){
  const path='/case?'+new URLSearchParams({fault,...(measure?{measure}:{}),...(period?{observation:period}:{})});
  const url=new URL(path,'https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
  const result=await read(url,proxyData.headers),body=JSON.parse(result.body);
  const pass=result.status===200&&body.selected_status===expected&&body.sibling?.value===7&&body.sibling_health?.status==='ok'&&body.selected.observations.length===count&&(expected!==503||typeof body.selected.error==='string');
  report.checks.push({fault,measure,period,expected,expected_observations:count,status:result.status,selected_status:body.selected_status,source_health:body.source_health,selected_error:body.selected.error||null,observations:body.selected.observations.length,pass});
  if(!measure&&['none','revision','zero'].includes(fault))positives[fault]=body.selected;
  console.log(JSON.stringify({fault,measure,pass,selected_status:body.selected_status}));
 }
 const original=positives.none,revision=positives.revision;
 const changes=revision.observations.filter(o=>o.version!==original.observations.find(x=>x.id===o.id)?.version).map(o=>o.definition.id);
 report.revision={changes,pass:changes.length===1&&changes[0]===m};
 const z=positives.zero.observations.find(o=>o.definition.id==='nz-auckland-avondale.apartment.1.active_bonds');
 report.zero={value:z?.value,state:z?.value_state,pass:z?.value===0&&z?.value_state==='observed'};
 report.pass=report.checks.every(c=>c.pass)&&report.revision.pass&&report.zero.pass;
 if(!report.pass)process.exitCode=1;
}catch(e){report.error=['preview_start_timeout','preview_start_failed','Preview transport failed'].includes(e.message)?e.message:'preview_validation_failed';report.pass=false;process.exitCode=1;}
finally {clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_sha256=codeHashes();report.code_unchanged=JSON.stringify(report.code_sha256)===JSON.stringify(report.code_sha256_before);report.pass=report.pass&&report.code_unchanged;if(!report.pass)process.exitCode=1;await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
