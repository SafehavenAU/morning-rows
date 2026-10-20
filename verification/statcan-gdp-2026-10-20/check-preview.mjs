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

const codeFiles=['../../lib/statcan-gdp.js','../../lib/information.js','../../lib/sources.js','original/wds-selected.json','original/series-metadata.json','original/cube-metadata.json','preview-worker.js','integration.toml','check-preview.mjs'];
const codeHashes=()=>Object.fromEntries(codeFiles.map(f=>[f,createHash('sha256').update(readFileSync(root+f)).digest('hex')]));
const output=process.argv[2]||root+'fault-preview.json';
try {readFileSync(output);throw Error('Output exists');}catch(e){if(e.code!=='ENOENT')throw e;}
let timer;
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',kind:'Constructed faults through actual GDP reader and selector; no live publisher proof',checks:[],code_sha256_before:codeHashes()};
const cases=[
 ['none',null,null,200,3],['none','level',null,200,2],['none','level','2026-Q1',200,1],['none','quarter_change','2026-Q2',200,1],
 ['none','level','1900-Q1',404,0],['none','quarter_change','2026-Q1',404,0],
 ...['reversed','preliminary','revised','revision','acquisition-only'].map(f=>[f,null,null,200,3]),
 ...['http','timeout','oversize','invalid-json','invalid-utf8','wrong-geography','scalar','suppression','status','stale-quarter','missing-metadata','zero-denominator'].map(f=>[f,null,null,503,0])
];
const positives={};
try {
 await dev.startWorker({config:root+'integration.toml',entrypoint:root+'preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8800}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 for(const [fault,measure,period,expected,count] of cases){
  const path='/case?'+new URLSearchParams({fault,...(measure?{measure}:{}),...(period?{observation:period}:{})});
  const url=new URL(path,'https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
  const result=await read(url,proxyData.headers),body=JSON.parse(result.body);
  const pass=result.status===200&&body.selected_status===expected&&body.sibling?.value===7&&body.sibling_health?.status==='ok'&&body.calls.length===3&&new Set(body.calls.map(c=>c.role)).size===3&&body.selected.observations.length===count&&(expected!==503||typeof body.selected.error==='string');
  report.checks.push({fault,measure,period,expected,expected_observations:count,status:result.status,selected_status:body.selected_status,source_health:body.source_health,selected_error:body.selected.error||null,observations:body.selected.observations.length,pass});
  if(!measure&&['none','reversed','preliminary','revised','revision','acquisition-only'].includes(fault))positives[fault]=body.selected;
  console.log(JSON.stringify({fault,measure,pass,selected_status:body.selected_status}));
 }
 const original=positives.none;
 const versions=value=>value.observations.map(o=>[o.id,o.version]);
 const changes=value=>value.observations.filter(o=>o.version!==original.observations.find(x=>x.id===o.id)?.version).map(o=>o.definition.id+':'+o.period);
 report.order={pass:JSON.stringify(versions(original))===JSON.stringify(versions(positives.reversed))&&original.content_version===positives.reversed.content_version};
 report.acquisition_only={pass:JSON.stringify(versions(original))===JSON.stringify(versions(positives['acquisition-only']))&&original.content_version===positives['acquisition-only'].content_version&&original.context.provenance[0].sha256!==positives['acquisition-only'].context.provenance[0].sha256};
 report.flags=Object.fromEntries(['preliminary','revised'].map(f=>[f,{symbol:positives[f].data.rows[1].symbol,changes:changes(positives[f]),pass:positives[f].data.rows[1].symbol===f&&changes(positives[f]).join(',')==='level:2026-Q2,quarter_change:2026-Q2'}]));
 report.revision={changes:changes(positives.revision),growth:positives.revision.data.quarter_change,pass:changes(positives.revision).join(',')==='level:2026-Q2,quarter_change:2026-Q2'&&positives.revision.data.quarter_change!==original.data.quarter_change};
 report.pass=report.checks.every(c=>c.pass)&&report.order.pass&&report.acquisition_only.pass&&Object.values(report.flags).every(x=>x.pass)&&report.revision.pass;
 if(!report.pass)process.exitCode=1;
}catch(e){report.error=['preview_start_timeout','preview_start_failed','Preview transport failed'].includes(e.message)?e.message:'preview_validation_failed';report.pass=false;process.exitCode=1;}
finally {clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_sha256=codeHashes();report.code_unchanged=JSON.stringify(report.code_sha256)===JSON.stringify(report.code_sha256_before);report.pass=report.pass&&report.code_unchanged;if(!report.pass)process.exitCode=1;await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
