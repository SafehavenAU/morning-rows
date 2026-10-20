import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
process.env.WRANGLER_LOG='error';
const root=fileURLToPath(new URL('.',import.meta.url)),output=process.argv[2]||root+'cloudflare-reader-live.json';
try{readFileSync(output);throw Error('Output exists');}catch(error){if(error.code!=='ENOENT')throw error;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const codeFiles=['live-reader-preview-worker.js','live-reader-integration.toml','check-live-reader-preview.mjs','../../../lib/ni-energy.js','../../../lib/sources.js','../../../package-lock.json'];
const hashes=()=>Object.fromEntries(codeFiles.map(file=>[file,hash(readFileSync(root+file))]));
const referenceBytes=readFileSync(root+'independent-report.json'),reference=JSON.parse(referenceBytes);
const ids=['renewable_share_gfec','gross_final_consumption','renewable_generation','non_renewable_generation','net_imports'];
if(!reference.pass||reference.observations?.length!==5||reference.observations.map(row=>row.measure).join(',')!==ids.join(',')||!reference.checks.every(check=>check.pass))throw Error('Invalid independent reference');
const quote=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
const dev=new unstable_DevEnv();let timer;
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});ready.catch(()=>{});
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',purpose:'One unchanged live NI energy reader invocation; compare all five rolling-year observations against separate Python extraction and official presentation',attempts:1,git_head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),production_version:null,code_before:hashes(),reference:{file:'independent-report.json',sha256:hash(referenceBytes),bytes:referenceBytes.length,publication_date:reference.publication_date},comparisons:[]};
try{
 await dev.startWorker({config:root+'live-reader-integration.toml',entrypoint:root+'live-reader-preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8817}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const url=new URL('/read-once','https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
 const result=await new Promise((ok,fail)=>{
  const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let text='',bytes=0;
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>262144){child.kill();fail(Error('preview_response_too_large'));}else text+=chunk;});
  child.on('error',()=>fail(Error('preview_transport_failed')));child.on('close',code=>{if(code!==0)return fail(Error('preview_transport_failed'));const at=text.lastIndexOf('\n');ok({status:Number(text.slice(at+1)),body:text.slice(0,at)});});
  child.stdin.on('error',()=>{});child.stdin.end(['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(proxyData.headers).filter(([,value])=>value!==undefined).map(([key,value])=>`header = ${quote(key+': '+value)}`)].join('\n'));
 });
 report.wrapper_status=result.status;report.response_sha256=hash(result.body);report.response_bytes=Buffer.byteLength(result.body);
 if(result.status!==200)throw Error('live_wrapper_failed');
 report.live=JSON.parse(result.body);
 const native=report.live.body?.electricity_balance,health=report.live.body?.sources?.electricity_balance;
 report.complete_reader=report.live.fixture===false&&health?.status==='ok'&&native?.status==='ok'&&native.rows?.length===5&&native.rows.map(row=>row.measure_id).join(',')===ids.join(',')&&native.publication_date===reference.publication_date;
 if(report.complete_reader)for(const expected of reference.observations){
  const row=native.rows.find(candidate=>candidate.measure_id===expected.measure);
  report.comparisons.push({measure:expected.measure,expected:expected.value,actual:row.value,period:row.period,unit:row.unit,pass:row.value===expected.value&&row.unit===expected.unit&&row.geography===expected.geography&&row.period===expected.period&&row.period_start===expected.period_start&&row.period_end===expected.period_end&&row.publication_date===expected.publisher_date&&row.value_state==='observed'});
 }
 report.same_report_wire_bytes=native?.provenance?.find(row=>row.role==='report')?.sha256===reference.source_report_sha256;
 report.observations=report.comparisons.length;
 report.pass=report.complete_reader&&report.observations===5&&report.comparisons.every(row=>row.pass);
}catch(error){
 report.error=['preview_start_timeout','preview_start_failed','preview_transport_failed','preview_response_too_large','live_wrapper_failed'].includes(error.message)?error.message:'live_reader_validation_failed';report.pass=false;
}finally{
 clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_after=hashes();report.code_unchanged=JSON.stringify(report.code_before)===JSON.stringify(report.code_after);report.pass=report.pass&&report.code_unchanged;
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:report.pass,complete_reader:report.complete_reader,code_unchanged:report.code_unchanged,observations:report.observations,same_report_wire_bytes:report.same_report_wire_bytes,source_health:report.live?.body?.sources?.electricity_balance,error:report.error}));
 if(!report.pass)process.exitCode=1;
}
