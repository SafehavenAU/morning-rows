import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
process.env.WRANGLER_LOG='error';
const root=fileURLToPath(new URL('.',import.meta.url)),output=process.argv[2]||root+'cloudflare-reader-live.json';
try{readFileSync(output);throw Error('Output exists');}catch(e){if(e.code!=='ENOENT')throw e;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const codeFiles=['live-reader-preview-worker.js','live-reader-integration.toml','check-live-reader-preview.mjs','../../../lib/aemo-day.js','../../../lib/sources.js'];
const hashes=()=>Object.fromEntries(codeFiles.map(file=>[file,hash(readFileSync(root+file))]));
const referenceBytes=readFileSync(root+'independent-report.json'),reference=JSON.parse(referenceBytes);
if(!reference.pass||reference.comparison_rows!==576||reference.observations.length!==576||reference.summaries.length!==2||reference.regions.join(',')!=='SA1,VIC1')throw Error('Invalid independent reference');
const quote=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
const dev=new unstable_DevEnv();let timer;
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});ready.catch(()=>{});
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',purpose:'One complete live readAemoDay invocation using the actual clock and unchanged module; compare576 interval prices and10 summaries to independently extracted retained original CSV',attempts:1,git_head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),production_version:null,code_before:hashes(),reference:{file:'independent-report.json',sha256:hash(referenceBytes),bytes:referenceBytes.length,target_day:reference.target_day},comparisons:[]};
try{
 await dev.startWorker({config:root+'live-reader-integration.toml',entrypoint:root+'live-reader-preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8816}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 const url=new URL('/read-once','https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
 const result=await new Promise((ok,fail)=>{
  const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let text='',bytes=0;
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>524288){child.kill();fail(Error('preview_response_too_large'));}else text+=chunk;});
  child.on('error',()=>fail(Error('preview_transport_failed')));child.on('close',code=>{if(code!==0)return fail(Error('preview_transport_failed'));const at=text.lastIndexOf('\n');ok({status:Number(text.slice(at+1)),body:text.slice(0,at)});});
  child.stdin.on('error',()=>{});child.stdin.end(['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(proxyData.headers).filter(([,v])=>v!==undefined).map(([k,v])=>`header = ${quote(k+': '+v)}`)].join('\n'));
 });
 report.wrapper_status=result.status;report.response_sha256=hash(result.body);report.response_bytes=Buffer.byteLength(result.body);
 if(result.status!==200)throw Error('live_wrapper_failed');
 report.live=JSON.parse(result.body);
 const native=report.live.body?.grid_day,health=report.live.body?.sources?.grid_day;
 report.complete_reader=report.live.fixture===false&&health?.status==='ok'&&native?.status==='ok'&&native.calendar_day===reference.target_day&&native.regions?.length===2&&native.regions.map(r=>r.region).join(',')==='SA1,VIC1';
 if(report.complete_reader)for(const region of ['SA1','VIC1']){
  const value=native.regions.find(r=>r.region===region),cells=reference.observations.filter(r=>r.region===region),summary=reference.summaries.find(r=>r.region===region);
  const valid=value.status==='ok'&&value.interval_count===288&&value.intervals?.length===288&&cells.length===288&&value.calendar_day===reference.target_day&&value.period_type==='TRADE'&&value.unit==='AUD/MWh'&&value.interval_minutes===5&&value.period_start===reference.calendar_start&&value.period_end===reference.calendar_end_exclusive;
  report.complete_reader&&=valid;
  if(!valid)continue;
  for(let i=0;i<288;i++){
   const row=value.intervals[i],cell=cells[i];
   report.comparisons.push({region,period_end:cell.interval_end,expected:cell.rrp_decimal,actual:row.price,raw:row.price_raw,pass:row.period_end===cell.interval_end&&row.price===Number(cell.rrp_decimal)&&Number(row.price_raw)===Number(cell.rrp_decimal)});
  }
  for(const [statistic,key]of Object.entries({mean:'mean_rounded_2dp',minimum:'minimum_decimal',maximum:'maximum_decimal',negative_count:'negative_interval_count',zero_count:'zero_interval_count'}))report.comparisons.push({region,statistic,expected:summary[key],actual:value.summary[statistic],pass:value.summary[statistic]===Number(summary[key])});
 }
 report.interval_cells=report.comparisons.filter(r=>r.period_end).length;report.summary_cells=report.comparisons.filter(r=>r.statistic).length;
 report.pass=report.complete_reader&&report.interval_cells===576&&report.summary_cells===10&&report.comparisons.every(r=>r.pass);
}catch(error){report.error=['preview_start_timeout','preview_start_failed','preview_transport_failed','preview_response_too_large','live_wrapper_failed'].includes(error.message)?error.message:'live_reader_validation_failed';report.pass=false;}
finally{
 clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_after=hashes();report.code_unchanged=JSON.stringify(report.code_before)===JSON.stringify(report.code_after);report.pass=report.pass&&report.code_unchanged;
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:report.pass,complete_reader:report.complete_reader,code_unchanged:report.code_unchanged,interval_cells:report.interval_cells,summary_cells:report.summary_cells,source_health:report.live?.body?.sources?.grid_day,region_results:report.live?.body?.grid_day?.regions?.map(r=>({region:r.region,status:r.status,http_status:r.http_status,error:r.error})),error:report.error}));
 if(!report.pass)process.exitCode=1;
}
