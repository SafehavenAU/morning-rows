import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateSfcActivity,sfcActivityRows} from '../../../lib/sfc-activity.js';
import {validateCqcCohort,cqcCohortRows} from '../../../lib/cqc-cohort.js';
import {validateOnsRent} from '../../../lib/ons-rent.js';
import {validateCmhcRentRepresentation} from '../../../lib/cmhc-rent.js';
process.env.XDG_CONFIG_HOME='/workspace/.morning-rows-tools/config';
process.env.WRANGLER_LOG='error';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
const root=fileURLToPath(new URL('./',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const specs=[
  {source:'college_activity',ref:'../sfc/independent-report.json',count:5,validator:validateSfcActivity,rows:sfcActivityRows,
    reference:r=>r.observations.map(x=>({measure_id:x.measure,value:x.value,period:r.period,unit:r.unit})),publication:r=>r.publication_date,
    actualPublication:r=>r.publication_date,originalHash:r=>r.source_sha256['tables.xlsx']},
  {source:'care_assessment_cohort',ref:'../cqc/independent-reference.json',count:5,validator:validateCqcCohort,rows:cqcCohortRows,
    reference:r=>r.references.map(x=>({...x,measure_id:x.measure})),publication:()=> '2025-10-24',
    actualPublication:r=>r.publication_date,originalHash:r=>r.files.find(f=>f.path.endsWith('ratings.xlsx')).sha256},
  {source:'bedroom_rent',ref:'../ons-rent/independent-report.json',count:4,validator:validateOnsRent,rows:r=>r.rows,
    reference:r=>r.rows,publication:r=>r.release_date,actualPublication:r=>r.release_date,originalHash:r=>r.original_json_sha256},
  {source:'rental_benchmark',ref:'../cmhc-rent/independent-report.json',count:2,validator:validateCmhcRentRepresentation,rows:r=>r.rows,
    reference:r=>r.rows,publication:r=>r.release_timestamp_raw,actualPublication:r=>r.metadata.release_timestamp_raw},
];
const references=Object.fromEntries(specs.map(spec=>{
  const bytes=readFileSync(root+spec.ref),json=JSON.parse(bytes),rows=spec.reference(json);
  if(!(json.pass===true||json.passed===true)||rows.length!==spec.count||new Set(rows.map(r=>r.measure_id+':'+r.period)).size!==spec.count||rows.some(r=>!Number.isFinite(r.value)))throw Error('Invalid independent reference: '+spec.source);
  return [spec.source,{file:spec.ref,sha256:hash(bytes),bytes:bytes.length,json}];
}));
const codeFiles=['worker.js','wrangler.toml','check-live.mjs','../../../lib/sfc-activity.js','../../../lib/cqc-cohort.js','../../../lib/ons-rent.js','../../../lib/cmhc-rent.js','../../../lib/workbook.js','../../../lib/sources.js'];
const hashes=()=>Object.fromEntries(codeFiles.map(file=>[file,hash(readFileSync(root+file))]));
if(process.argv.includes('--validate-reference')){
  console.log(JSON.stringify({pass:true,sources:specs.length,cells:specs.reduce((sum,s)=>sum+s.count,0),references:Object.fromEntries(Object.entries(references).map(([k,v])=>[k,v.sha256]))}));
  process.exit(0);
}
const output=process.argv[2]||root+'cloudflare-reader-live.json';
const selected=process.argv[3]?process.argv[3].split(','):specs.map(s=>s.source);
if(!selected.length||new Set(selected).size!==selected.length||selected.some(key=>!specs.some(s=>s.source===key)))throw Error('Invalid source selection');
if(existsSync(output))throw Error('Output exists; previous proof must not be overwritten');
const quote=value=>'"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
const report={
  started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',attempts:1,
  purpose:'One actual-clock invocation per selected source with exact retained independent-vintage comparisons; NI is separately owned and is not fetched here.',
  selected_sources:selected,
  git_head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  production_version:null,code_before:hashes(),
  references:Object.fromEntries(Object.entries(references).map(([key,{json,...ref}])=>[key,ref])),
  sources:{},cpu_ms:null,cpu_evidence:'Not measured by remote-dev response. Exact integrated version trace is still required; wall duration is not CPU.',
};
const dev=new unstable_DevEnv();let timer;
const ready=new Promise((resolve,reject)=>{dev.once('reloadComplete',resolve);dev.once('error',()=>reject(Error('preview_start_failed')));});
ready.catch(()=>{});
try{
  await dev.startWorker({config:root+'wrangler.toml',entrypoint:root+'worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8824}}});
  const {proxyData}=await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
  const url=new URL('/read-once','https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
  url.searchParams.set('sources',selected.join(','));
  const result=await new Promise((resolve,reject)=>{
    const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let text='',bytes=0;
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>524288){child.kill();reject(Error('preview_response_too_large'));}else text+=chunk;});
    child.on('error',()=>reject(Error('preview_transport_failed')));
    child.on('close',code=>{if(code!==0)return reject(Error('preview_transport_failed'));const at=text.lastIndexOf('\n');resolve({status:Number(text.slice(at+1)),body:text.slice(0,at)});});
    child.stdin.on('error',()=>{});
    child.stdin.end(['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(proxyData.headers).filter(([,v])=>v!==undefined).map(([k,v])=>`header = ${quote(k+': '+v)}`)].join('\n'));
  });
  report.wrapper_status=result.status;report.response_sha256=hash(result.body);report.response_bytes=Buffer.byteLength(result.body);
  if(result.status!==200)throw Error('preview_wrapper_failed');
  const live=report.live=JSON.parse(result.body);
  report.actual_clock=live.fixture===false&&live.clock==='Actual Worker UTC clock'&&Date.parse(live.started_at)>=Date.parse(report.started_at)-1000&&Date.parse(live.finished_at)>=Date.parse(live.started_at)&&Date.parse(live.finished_at)<=Date.now()+1000;
  report.injected_failure_isolated=live.body?.injected_isolation_failure===null&&live.body.sources?.injected_isolation_failure?.status==='error';
  report.selected_sources_match=JSON.stringify(live.selected_sources)===JSON.stringify(selected);
  for(const spec of specs.filter(s=>selected.includes(s.source))){
    const native=live.body?.[spec.source],health=live.body?.sources?.[spec.source],timing=live.timings?.[spec.source],reference=references[spec.source].json;
    const check={health,timing,pass:false,comparisons:[]};
    report.sources[spec.source]=check;
    check.fresh_completion=!!timing&&Date.parse(timing.started_at)>=Date.parse(live.started_at)&&Date.parse(timing.finished_at)>=Date.parse(timing.started_at)&&Date.parse(timing.finished_at)<=Date.parse(live.finished_at);
    check.valid_native=!!native&&check.fresh_completion&&spec.validator(native,{retrieved_at:timing.finished_at});
    if(!check.valid_native)continue;
    const rows=spec.rows(native),expected=spec.reference(reference);
    check.publication_matches=spec.actualPublication(native)===spec.publication(reference);
    check.coverage=rows.length===spec.count&&new Set(rows.map(r=>r.measure_id+':'+r.period)).size===spec.count;
    check.provenance_captured=Array.isArray(native.provenance)&&native.provenance.length>0&&native.provenance.every(p=>p.bytes>0&&/^[a-f0-9]{64}$/.test(p.sha256)&&Date.parse(p.retrieved_at)>=Date.parse(timing.started_at)&&Date.parse(p.retrieved_at)<=Date.parse(timing.finished_at));
    check.original_bytes_match=spec.originalHash?native.provenance.some(p=>p.sha256===spec.originalHash(reference)):null;
    for(const wanted of expected){
      const row=rows.find(row=>row.measure_id===wanted.measure_id&&row.period===wanted.period);
      check.comparisons.push({measure_id:wanted.measure_id,period:wanted.period,unit:wanted.unit,expected:wanted.value,actual:row?.value??null,pass:row?.value===wanted.value&&row?.unit===wanted.unit&&row?.value_state==='observed'});
    }
    check.pass=health?.status==='ok'&&check.valid_native&&check.publication_matches&&check.coverage&&check.provenance_captured&&(check.original_bytes_match===null||check.original_bytes_match)&&check.comparisons.every(c=>c.pass);
  }
  report.pass=report.actual_clock&&report.selected_sources_match&&report.injected_failure_isolated&&Object.keys(report.sources).length===selected.length&&Object.values(report.sources).every(r=>r.pass);
}catch(error){
  report.error=['preview_start_timeout','preview_start_failed','preview_transport_failed','preview_response_too_large','preview_wrapper_failed'].includes(error.message)?error.message:'live_reader_validation_failed';
  report.pass=false;
}finally{
  clearTimeout(timer);await dev.teardown();
  report.finished_at=new Date().toISOString();report.code_after=hashes();report.code_unchanged=JSON.stringify(report.code_before)===JSON.stringify(report.code_after);
  report.references_unchanged=Object.values(references).every(ref=>hash(readFileSync(root+ref.file))===ref.sha256);
  report.pass=report.pass&&report.code_unchanged&&report.references_unchanged;
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({pass:report.pass,code_unchanged:report.code_unchanged,references_unchanged:report.references_unchanged,actual_clock:report.actual_clock,injected_failure_isolated:report.injected_failure_isolated,sources:Object.fromEntries(Object.entries(report.sources).map(([k,v])=>[k,{pass:v.pass,health:v.health?.status,error:v.health?.error,cells:v.comparisons?.length,valid_native:v.valid_native,original_bytes_match:v.original_bytes_match}])),error:report.error}));
  if(!report.pass)process.exitCode=1;
}
