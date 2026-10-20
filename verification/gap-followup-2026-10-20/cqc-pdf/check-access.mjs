import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
process.env.WRANGLER_LOG='error';
const root=fileURLToPath(new URL('.',import.meta.url)),output=process.argv[2]||root+'worker-access.json';
try{readFileSync(output);throw Error('Output exists');}catch(error){if(error.code!=='ENOENT')throw error;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const codeFiles=['access-preview.js','access-integration.toml','check-access.mjs'];
const hashes=()=>Object.fromEntries(codeFiles.map(file=>[file,hash(readFileSync(root+file))]));
const quote=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
const dev=new unstable_DevEnv();let timer;
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});ready.catch(()=>{});
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',purpose:'One bounded protected Worker acquisition of new official CQC GOV.UK PDF route; no parser or release claim',attempts:1,git_head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),production_version:null,code_before:hashes()};
try{
 await dev.startWorker({config:root+'access-integration.toml',entrypoint:root+'access-preview.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8824}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const url=new URL('/probe','https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
 const result=await new Promise((ok,fail)=>{
  const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let text='',bytes=0;
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>262144){child.kill();fail(Error('preview_response_too_large'));}else text+=chunk;});
  child.on('error',()=>fail(Error('preview_transport_failed')));child.on('close',code=>{if(code!==0)return fail(Error('preview_transport_failed'));const at=text.lastIndexOf('\n');ok({status:Number(text.slice(at+1)),body:text.slice(0,at)});});
  child.stdin.on('error',()=>{});child.stdin.end(['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(proxyData.headers).filter(([,value])=>value!==undefined).map(([key,value])=>`header = ${quote(key+': '+value)}`)].join('\n'));
 });
 report.wrapper_status=result.status;report.response_sha256=hash(result.body);report.response_bytes=Buffer.byteLength(result.body);
 if(result.status!==200)throw Error('live_wrapper_failed');
 report.live=JSON.parse(result.body);
 report.pass=report.live.pass===true;
}catch(error){
 report.error=['preview_start_timeout','preview_start_failed','preview_transport_failed','preview_response_too_large','live_wrapper_failed'].includes(error.message)?error.message:'live_reader_validation_failed';report.pass=false;
}finally{
 clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_after=hashes();report.code_unchanged=JSON.stringify(report.code_before)===JSON.stringify(report.code_after);report.pass=report.pass&&report.code_unchanged;
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:report.pass,code_unchanged:report.code_unchanged,status:report.live?.status,bytes:report.live?.bytes,sha256:report.live?.sha256,error:report.error||report.live?.error}));
 if(!report.pass)process.exitCode=1;
}
