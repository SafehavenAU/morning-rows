import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const toolsPackage=resolve(process.env.MR_TOOLS_PACKAGE||'/workspace/.morning-rows-tools/package.json');
const require=createRequire(toolsPackage);
const versions={node:process.version,...Object.fromEntries(['miniflare','esbuild','ws','@jridgewell/trace-mapping','workerd'].map(name=>[name,require(name+'/package.json').version]))};
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild'),WebSocket=require('ws');
const {TraceMap,originalPositionFor}=require('@jridgewell/trace-mapping');
assert(process.argv[2]&&process.argv[3],'Usage: node profile.mjs /tmp/output/baseline-worker.mjs /tmp/output/baseline [trials]');
const entry=resolve(process.argv[2]);
const prefix=resolve(process.argv[3]),trials=Number(process.argv[4]||2);
const relativeOutput=relative(fileURLToPath(new URL('../../../../',import.meta.url)),prefix);
assert(relativeOutput==='..'||relativeOutput.startsWith('..'+sep),'Generated profiles/bundles must stay outside the checkout');
const port=Number(process.env.MR_PROFILE_PORT||8801),inspectorPort=Number(process.env.MR_INSPECTOR_PORT||9234);
await mkdir(dirname(prefix),{recursive:true});
if(!Number.isInteger(trials)||trials<1||trials>4)throw Error('Use 1–4 fresh isolates');
const bundle=prefix+'.bundle.mjs';
await build({entryPoints:[entry],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',sourcemap:'external',outfile:bundle});
const sourcemap=new TraceMap(JSON.parse(await readFile(bundle+'.map','utf8')));
const aggregate=profile=>{
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),sums=new Map();
 for(let i=0;i<profile.samples.length;i++){
  const f=nodes.get(profile.samples[i]).callFrame;
  const p=f.url.endsWith('.mjs')&&f.lineNumber>=0?originalPositionFor(sourcemap,{line:f.lineNumber+1,column:f.columnNumber}):null;
  const key=p?.source?`${p.name||f.functionName} ${p.source}:${p.line}`:`${f.functionName} ${f.url}:${f.lineNumber+1}`;
  const old=sums.get(key)||{samples:0,sampled_us:0};old.samples++;old.sampled_us+=profile.timeDeltas[i];sums.set(key,old);
 }
 return {samples:profile.samples.length,first_sample_delta_us:profile.timeDeltas[0],hotspots:[...sums].sort((a,b)=>b[1].sampled_us-a[1].sampled_us).slice(0,28)};
};
const summaries=[];
for(let trial=0;trial<trials;trial++){
 let ws,mf;
 try{
  mf=new Miniflare(convertV4MiniflareOptions({name:'cpu-fixture',rootPath:dirname(bundle),modulesRoot:dirname(bundle),modules:true,scriptPath:bundle,compatibilityDate:'2026-10-16',host:'127.0.0.1',port,inspectorHost:'127.0.0.1',inspectorPort,cf:false,outboundService:()=>{throw Error('External network forbidden in this diagnostic');}}));
  await mf.ready;
  const ready=await fetch(`http://127.0.0.1:${port}/ready`);if(await ready.text()!=='ready')throw Error('Wrong fixture harness');
  const targets=await (await fetch(`http://127.0.0.1:${inspectorPort}/json/list`)).json();
  const target=targets.find(t=>t.title?.includes('cpu-fixture'))||targets[0];
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,fail)=>{ws.once('open',ok);ws.once('error',fail)});
  const pending=new Map();let id=0;
  ws.on('message',raw=>{const d=JSON.parse(raw);if(pending.has(d.id)){const [ok,fail]=pending.get(d.id);pending.delete(d.id);d.error?fail(Error(d.error.message)):ok(d.result)}});
  const cdp=(method,params={})=>new Promise((ok,fail)=>{const n=++id;pending.set(n,[ok,fail]);ws.send(JSON.stringify({id:n,method,params}))});
  await cdp('Profiler.enable');await cdp('Profiler.setSamplingInterval',{interval:100});
  for(const [label,count] of [['first',1],...(trial===0?[['repeated',100]]:[])]){
   await cdp('Profiler.start');
   let bytes=0;
   for(let i=0;i<count;i++){
    const r=await fetch(`http://127.0.0.1:${port}/united-states.json?source=cpi&measure=CUUR0000SA0`);const body=await r.text();bytes=body.length;
    if(r.status!==200||JSON.parse(body).retrieval?.status!=='ok')throw Error('Invalid fixture response');
   }
   const {profile}=await cdp('Profiler.stop');await writeFile(`${prefix}-${trial+1}-${label}.cpuprofile`,JSON.stringify(profile));
   summaries.push({trial:trial+1,label,requests:count,response_characters:bytes,...aggregate(profile)});
  }
 }finally{ws?.terminate();await mf?.dispose();}
}
const report={entry,bundle,trials,tools_package:toolsPackage,versions,bundle_sha256:createHash('sha256').update(await readFile(bundle)).digest('hex'),method:'Direct Miniflare/workerd, esbuild minify, fresh isolates; /ready warms infrastructure only; 100us V8 CDP sampled profiles. Fixture readers, cache:null, external fetch forbidden. Sampled stack attribution is diagnostic, not billed production CPU or latency.',summaries};
await writeFile(prefix+'-summary.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
