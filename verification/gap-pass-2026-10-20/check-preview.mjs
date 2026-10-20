// Protected remote-dev transport; ephemeral token remains in memory/curl stdin.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {dirname,resolve,relative} from 'node:path';
const {unstable_DevEnv}=createRequire('/workspace/.morning-rows-tools/package.json')('wrangler');
process.env.WRANGLER_LOG='error';
const root=fileURLToPath(new URL('.',import.meta.url)),repo=resolve(root,'../..');
const dev=new unstable_DevEnv();
const ready=new Promise((ok,fail)=>{dev.once('reloadComplete',ok);dev.once('error',()=>fail(Error('preview_start_failed')));});ready.catch(()=>{});
const quote=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','').replaceAll('\n','')+'"';
const sha=value=>createHash('sha256').update(value).digest('hex');
function read(url,headers){
 return new Promise((ok,fail)=>{
  const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','ignore']});let output='',size=0;
  child.stdout.on('data',bytes=>{size+=bytes.length;if(size>2097152){child.kill();fail(Error('preview_response_too_large'));}else output+=bytes;});
  child.on('error',()=>fail(Error('preview_transport_failed')));
  child.on('close',code=>{
   if(code!==0)return fail(Error('preview_transport_failed'));
   const at=output.lastIndexOf('\n'),status=Number(output.slice(at+1));ok({status,body:output.slice(0,at)});
  });
  child.stdin.on('error',()=>{});
  child.stdin.end(['silent','show-error','max-time = 60',`url = ${quote(url.href)}`,'write-out = "\\n%{http_code}"',...Object.entries(headers).filter(([,v])=>v!==undefined).map(([k,v])=>`header = ${quote(k+': '+v)}`)].join('\n'));
 });
}
function codeHashes(){
 const files=new Map(),pending=[resolve(root,'preview-worker.js'),resolve(root,'integration.toml'),fileURLToPath(import.meta.url),resolve(repo,'package-lock.json')];
 while(pending.length){
  const path=pending.pop();if(files.has(path))continue;
  if(!path.startsWith(repo+'/'))throw Error('Unexpected source path');
  const bytes=readFileSync(path);files.set(path,sha(bytes));
  if(/\.(?:js|mjs)$/.test(path))for(const match of bytes.toString().matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]/g))pending.push(resolve(dirname(path),match[1]));
 }
 return Object.fromEntries([...files].map(([path,digest])=>[relative(root,path),digest]).sort(([a],[b])=>a.localeCompare(b)));
}
const output=process.argv[2]||resolve(root,'fault-preview.json');
try{readFileSync(output);throw Error('Output exists');}catch(e){if(e.code!=='ENOENT')throw e;}
// source,fault,measure,period,selected status,count,source health,exact first value
const cases=[
 ['grid_day','none',null,null,200,10,'ok',6.73],
 ['grid_day','none','SA1.mean','2026-10-19',200,1,'ok',6.73],
 ['grid_day','none','SA1.mean','2026-10-18',404,0,'ok'],
 ...['wrong-region','forecast','missing-day'].map(f=>['grid_day',f,null,null,200,5,'degraded',-7.8]),
 ['grid_day','http',null,null,503,0,'error'],
 ['grid_day','timeout','SA1.mean',null,503,0,'degraded'],
 ...['reversed','acquisition-only','balanced-revision'].map(f=>['grid_day',f,null,null,200,10,'ok',6.73]),
 ['exchange_history','none',null,null,200,38,'ok',1.4021],
 ['exchange_history','none','FXUSDCAD','2026-10-19',200,1,'ok',1.4097],
 ['exchange_history','none','FXUSDCAD','2026-10-12',404,0,'ok'],
 ...['wrong-direction','missing-pair','stale-tail'].map(f=>['exchange_history',f,null,null,503,0,'error']),
 ['exchange_history','acquisition-only',null,null,200,38,'ok',1.4021],
 ['exchange_history','revision',null,null,200,38,'ok',1.4022],
 ['jobs','none',null,null,200,11,'ok',6.5],
 ['jobs','none','newfoundland_and_labrador','2026-09',200,1,'ok',9.1],
 ['jobs','wrong-province',null,null,503,0,'error'],
 ...['reversed','acquisition-only'].map(f=>['jobs',f,null,null,200,11,'ok',6.5]),
 ['price_index','none',null,null,200,1,'ok',170],
 ['price_index','unit',null,null,503,0,'error'],
 ['shop','none',null,null,200,1,'ok',73696547],
 ['shop','suppression',null,null,503,0,'error'],
 ['homes','none',null,null,200,1,'ok',57947],
 ['homes','none','starts','2026-07',404,0,'ok'],
 ['homes','quarter-unit',null,null,503,0,'error'],
 ['land_transaction_tax','none',null,null,200,4,'ok',371],
 ['land_transaction_tax','none','all_inclusive','2025-26',200,1,'ok',371],
 ['land_transaction_tax','missing',null,null,503,0,'error'],
 ['land_transaction_tax','suppression',null,null,503,0,'error'],
 ['land_transaction_tax','null-native-row',null,null,503,0,'ok'],
];
const report={started_at:new Date().toISOString(),environment:'Protected Cloudflare remote dev',kind:'Constructed faults through actual AEMO, BoC and StatCan readers and typed selectors; WRA actual bounded-read/parser and selector, not its live fetch wrapper',fixture_clock:'2026-10-20T10:00:00.000Z',freshness_evidence:false,checks:[],code_sha256_before:codeHashes()};
let timer;const selected={};
const versions=value=>value.observations.map(o=>[o.id,o.version]);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
try{
 await dev.startWorker({config:root+'integration.toml',entrypoint:root+'preview-worker.js',dev:{remote:true,watch:false,inspector:false,server:{hostname:'127.0.0.1',port:8800}}});
 const {proxyData}=await Promise.race([ready,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('preview_start_timeout')),60000);})]);clearTimeout(timer);
 for(const [source,fault,measure,period,expected,count,health,value] of cases){
  const path='/case?'+new URLSearchParams({source,fault,...(measure?{measure}:{}),...(period?{observation:period}:{})}),url=new URL(path,'https://preview.invalid');Object.assign(url,proxyData.userWorkerUrl);
  const result=await read(url,proxyData.headers),body=JSON.parse(result.body),rows=body.selected?.observations||[],calls=source==='grid_day'||source==='exchange_history'?2:source==='land_transaction_tax'?1:3;
  const pass=result.status===200&&body.constructed===true&&body.fixture_clock===report.fixture_clock&&body.selected_status===expected&&body.source_health?.status===health&&body.sibling?.value===7&&body.sibling_health?.status==='ok'&&body.calls.length===calls&&new Set(body.calls.map(c=>c.role)).size===calls&&rows.length===count&&(value===undefined||rows[0]?.value===value)&&(expected===200||typeof body.selected.error==='string');
  report.checks.push({source,fault,measure,period,expected,expected_observations:count,status:result.status,selected_status:body.selected_status,source_health:body.source_health.status,selected_error:body.selected.error||null,observations:rows.map(o=>({id:o.id,value:o.value,period:o.period,version:o.version,publisher_status:o.publisher_status})),content_version:body.selected.content_version||null,body_sha256:sha(result.body),bytes:Buffer.byteLength(result.body),calls:body.calls,pass});
  if(!measure&&expected===200)selected[source+':'+fault]=body.selected;
  console.log(JSON.stringify({source,fault,measure,pass,selected_status:body.selected_status}));
 }
 report.order=Object.fromEntries(['grid_day','jobs'].map(source=>{
  const before=selected[source+':none'],after=selected[source+':reversed'];return [source,{pass:same(versions(before),versions(after))&&before.content_version===after.content_version}];
 }));
 const provenance=s=>s==='grid_day'?selected[s+':none'].data.regions[0].provenance:s==='jobs'?selected[s+':none'].data[0].provenance[0]:selected[s+':none'].context.provenance[0];
 const afterProvenance=s=>s==='grid_day'?selected[s+':acquisition-only'].data.regions[0].provenance:s==='jobs'?selected[s+':acquisition-only'].data[0].provenance[0]:selected[s+':acquisition-only'].context.provenance[0];
 report.acquisition_only=Object.fromEntries(['grid_day','exchange_history','jobs'].map(source=>{
  const before=selected[source+':none'],after=selected[source+':acquisition-only'];return [source,{pass:same(versions(before),versions(after))&&before.content_version===after.content_version&&provenance(source).sha256!==afterProvenance(source).sha256}];
 }));
 const grid=selected['grid_day:none'],balanced=selected['grid_day:balanced-revision'];
 report.aemo_inputs={pass:grid.data.regions.every(r=>r.intervals.length===288)&&same(grid.data.regions.map(r=>[r.summary.negative_count,r.summary.zero_count]),[[189,2],[206,9]])&&same(versions(grid),versions(balanced))&&grid.content_version!==balanced.content_version};
 const fx=selected['exchange_history:none'],revised=selected['exchange_history:revision'];
 const changed=revised.observations.filter(o=>o.version!==fx.observations.find(p=>p.id===o.id)?.version);
 report.fx_revision={changed:changed.map(o=>o.id),pass:changed.length===1&&changed[0].value===1.4022&&revised.content_version!==fx.content_version};
 const house=selected['homes:none'].observations[0];
 report.qualifiers={pass:house.period==='2026-Q3'&&house.qualifications.release_timezone===null&&house.qualifications.licence_notice.source_notice.includes('2026-Q3')&&house.definition.population.includes('10,000')&&selected['shop:none'].observations[0].publisher_status.quality.includes('excellent')&&selected['land_transaction_tax:none'].observations.every(o=>o.definition.limitations.includes('overlap'))};
 report.pass=report.checks.every(x=>x.pass)&&Object.values(report.order).every(x=>x.pass)&&Object.values(report.acquisition_only).every(x=>x.pass)&&report.aemo_inputs.pass&&report.fx_revision.pass&&report.qualifiers.pass;
}catch(error){report.error=['preview_start_timeout','preview_start_failed','preview_transport_failed','preview_response_too_large'].includes(error.message)?error.message:'preview_validation_failed';report.pass=false;}
finally{
 clearTimeout(timer);await dev.teardown();report.finished_at=new Date().toISOString();report.code_sha256=codeHashes();report.code_unchanged=same(report.code_sha256,report.code_sha256_before);report.pass=report.pass&&report.code_unchanged;
 if(!report.pass)process.exitCode=1;await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
