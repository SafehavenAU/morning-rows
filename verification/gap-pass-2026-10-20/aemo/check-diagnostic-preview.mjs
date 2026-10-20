import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
process.env.WRANGLER_LOG='error';
const root=fileURLToPath(new URL('.',import.meta.url)),output=process.argv[2]||root+'cloudflare-access-diagnostic.json';
try{readFileSync(output);throw Error('Output exists');}catch(e){if(e.code!=='ENOENT')throw e;}
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const codeFiles=['diagnostic-preview-worker.js','diagnostic-integration.toml','check-diagnostic-preview.mjs'];
const hashes=()=>Object.fromEntries(codeFiles.map(file=>[file,hash(root+file)]));
const quote=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
const dev=new unstable_DevEnv();let timer;
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});ready.catch(()=>{});
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',purpose:'Single bounded same-URL request to diagnose existing live HTTP406; no header/URL variation or bypass',code_before:hashes()};
try{
 await dev.startWorker({config:root+'diagnostic-integration.toml',entrypoint:root+'diagnostic-preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8816}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const url=new URL('/probe','https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
 const result=await new Promise((ok,fail)=>{
  const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let text='',bytes=0;
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>32768){child.kill();fail(Error('preview_response_too_large'));}else text+=chunk;});
  child.on('error',()=>fail(Error('preview_transport_failed')));child.on('close',code=>{if(code!==0)return fail(Error('preview_transport_failed'));const at=text.lastIndexOf('\n');ok({status:Number(text.slice(at+1)),body:text.slice(0,at)});});
  child.stdin.on('error',()=>{});child.stdin.end(['silent','show-error','max-time = 45',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(proxyData.headers).filter(([,v])=>v!==undefined).map(([k,v])=>`header = ${quote(k+': '+v)}`)].join('\n'));
 });
 if(result.status!==200)throw Error('diagnostic_wrapper_failed');
 report.diagnostic=JSON.parse(result.body);
 report.probe_completed=report.diagnostic.request.requests===1&&typeof report.diagnostic.response.status==='number';
}catch(error){report.error=['preview_start_timeout','preview_start_failed','preview_transport_failed','preview_response_too_large','diagnostic_wrapper_failed'].includes(error.message)?error.message:'diagnostic_failed';report.probe_completed=false;}
finally{
 clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_after=hashes();report.code_unchanged=JSON.stringify(report.code_before)===JSON.stringify(report.code_after);
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({probe_completed:report.probe_completed,code_unchanged:report.code_unchanged,status:report.diagnostic?.response.status,content_type:report.diagnostic?.response.content_type,public_text_excerpt:report.diagnostic?.response.public_text_excerpt,error:report.error}));
 if(!report.probe_completed||!report.code_unchanged)process.exitCode=1;
}
