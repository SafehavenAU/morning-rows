import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
process.env.WRANGLER_LOG='error';
const root=fileURLToPath(new URL('.',import.meta.url)),output=process.argv[2]||root+'cloudflare-report-diagnostic.json';
try{readFileSync(output);throw Error('Output exists');}catch(error){if(error.code!=='ENOENT')throw error;}
const hash=input=>createHash('sha256').update(input).digest('hex');
const files=['diagnostic-preview-worker.js','diagnostic-integration.toml','check-diagnostic-preview.mjs','../../../lib/ni-energy.js'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,hash(readFileSync(root+file))]));
const quote=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
const report={started_at:new Date().toISOString(),purpose:'One bounded same-URL protected Cloudflare content diagnosis following title-guard failure; no route/header workaround',code_before:hashes(),attempts:1,production_version:null};
const dev=new unstable_DevEnv();let timer;
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});ready.catch(()=>{});
try{
 await dev.startWorker({config:root+'diagnostic-integration.toml',entrypoint:root+'diagnostic-preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8817}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const url=new URL('/diagnose-once','https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
 const result=await new Promise((ok,fail)=>{
  const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let text='',bytes=0;
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>32768){child.kill();fail(Error('preview_response_too_large'));}else text+=chunk;});
  child.on('error',()=>fail(Error('preview_transport_failed')));child.on('close',code=>{if(code!==0)return fail(Error('preview_transport_failed'));const at=text.lastIndexOf('\n');ok({status:Number(text.slice(at+1)),body:text.slice(0,at)});});
  child.stdin.on('error',()=>{});child.stdin.end(['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(proxyData.headers).filter(([,value])=>value!==undefined).map(([key,value])=>`header = ${quote(key+': '+value)}`)].join('\n'));
 });
 report.wrapper_status=result.status;report.response_sha256=hash(result.body);report.response_bytes=Buffer.byteLength(result.body);report.diagnosis=JSON.parse(result.body);
}catch(error){report.error=['preview_start_failed','preview_start_timeout','preview_response_too_large','preview_transport_failed'].includes(error.message)?error.message:'diagnostic_failed';}
finally{clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_after=hashes();report.code_unchanged=JSON.stringify(report.code_before)===JSON.stringify(report.code_after);writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({code_unchanged:report.code_unchanged,diagnosis:report.diagnosis,error:report.error}));if(report.error)process.exitCode=1;}
