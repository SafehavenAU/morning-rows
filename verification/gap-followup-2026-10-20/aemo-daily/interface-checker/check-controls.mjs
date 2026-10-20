// Offline constructed captures exercise actual adapter subjects. No HTTP.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {references,routes,sha,verifyCapture,base,period,source} from './support.mjs';
import {catalogue,INFORMATION_SCHEMA,validateSelection,selectedResponse} from '../../../../lib/information.js';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),evidence=join(root,'verification/gap-followup-2026-10-20/aemo-daily');
const clock='2026-10-20T13:00:00.000Z',revision='a'.repeat(40),version='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const boundFiles=['lib/information.js','lib/gap-information.js','lib/aemo-daily-schema.js','lib/aemo-daily-bundles.js','lib/inventory.js',...['support.mjs','check-controls.mjs','verify-numbers.py','verify-schemas.py'].map(f=>'verification/gap-followup-2026-10-20/aemo-daily/interface-checker/'+f)];
const codeHashes=async()=>Object.fromEntries(await Promise.all(boundFiles.map(async f=>[f,sha(await readFile(join(root,f)))])));
const codeBefore=await codeHashes();
const native=JSON.parse(await readFile(join(evidence,'protected-preview/live-native.json')));
const full={site:'https://morningrows.com',country:'Australia',[source]:native,grid:['NSW1','QLD1','VIC1','SA1','TAS1'].map(code=>({code,region:code,price:1,demand_mw:2,status:'FIRM',at:clock})),sources:{[source]:{status:'ok',fetched_at:clock},grid:{status:'ok',fetched_at:clock}},_meta:{schema_version:'1.0',id:'https://morningrows.com/australia.json',catalog:'https://morningrows.com/catalog.json?desk=australia'}};
const select=async(value,path,now=clock)=>{const selection=validateSelection(new URL('https://morningrows.com'+path));return selection.status?{status:selection.status,body:{error:selection.code}}:selectedResponse(value,selection,{now});};
const results=[];
const failed={...full,[source]:null,sources:{...full.sources,[source]:{status:'error',fetched_at:clock,error:'Constructed failure'}}};
const missing=await select(failed,base+'&measure=SA1.mean');assert.equal(missing.status,503);assert.equal(missing.body.data,null);assert.deepEqual(missing.body.observations,[]);assert.equal(failed.grid.length,5);
results.push({label:'Source failure preserves separate grid and refuses selected substitute',pass:true,constructed:true});
const partial=structuredClone(full);partial.grid_day.status='degraded';partial.sources.grid_day.status='degraded';const old=partial.grid_day.regions[0];partial.grid_day.regions[0]={region:old.region,geography:old.geography,status:'error',calendar_day:period,source_url:old.source_url,source_urls:old.source_urls,error:'Constructed missing interval'};
const partialSource=await select(partial,base),partialGood=await select(partial,base+'&measure=VIC1.mean'),partialBad=await select(partial,base+'&measure=SA1.mean');
assert.equal(partialSource.status,200);assert.equal(partialSource.body.observations.length,5);assert.equal(partialSource.body.unavailable_measures.length,5);assert.equal(partialGood.status,200);assert.equal(partialGood.body.retrieval.status,'degraded');assert.equal(partialBad.status,503);assert.equal(partialBad.body.error,'retrieval_failed');
const expired=await select(full,base,'2026-10-20T14:00:00.000Z');assert.equal(expired.status,503);assert.equal(expired.body.data,null);assert.deepEqual(expired.body.observations,[]);
results.push({label:'Partial region isolation and real request-day refusal',pass:true,constructed:true});
const {manifest}=await references(root),records=[],bodies=new Map();
for(const [i,want]of routes().entries()){
 const u=new URL(want.path,'https://morningrows.com');let body;
 if(want.method==='HEAD'||want.conditional)body=undefined;
 else if(u.pathname==='/health.json')body={source_dirty:false,source_revision:revision,worker_version:version};
 else if(u.pathname==='/schema.json')body=INFORMATION_SCHEMA;
 else if(u.pathname==='/catalog.json')body=catalogue('australia');
 else if(!u.searchParams.has('source'))body=full;
 else{const response=await select(full,want.path);assert.equal(response.status,want.status,want.path);body=response.body;}
 const bytes=body===undefined?Buffer.alloc(0):Buffer.from(JSON.stringify(body)),etag='"'+sha(Buffer.from(want.path))+'"';
 const record={origin:'https://morningrows.com',path:want.path,method:want.method,conditional:want.conditional,status:want.status,expected_status:want.status,...(want.error?{expected_error:want.error}:{}),...(want.conditional?{request_etag:etag}:{}),started_at:clock,completed_at:clock,headers:{'content-type':'application/json','cache-control':'public, max-age=60','x-source-revision':revision,'x-worker-version':version,etag},bytes:bytes.length,sha256:sha(bytes)};
 if(body!==undefined){record.file=String(i+1).padStart(3,'0')+'.body';bodies.set(record.file,bytes);}records.push(record);
}
const original={pass:true,revision,version,staged:true,references:manifest,requests:records},dir=await mkdtemp(join(tmpdir(),'mr-aemo-public-controls-'));
async function run(label,edit,expectedPass){
 const report=structuredClone(original),copy=new Map(bodies);
 const mutate=(path,fn)=>{const record=report.requests.find(r=>r.path===path&&r.file);assert.ok(record,path);const b=JSON.parse(copy.get(record.file));fn(b);const bytes=Buffer.from(JSON.stringify(b));copy.set(record.file,bytes);record.bytes=bytes.length;record.sha256=sha(bytes);};
 edit?.(report,mutate);for(const[file,data]of copy)await writeFile(join(dir,file),data);await writeFile(join(dir,'aemo-daily-interface-report.json'),JSON.stringify(report));
 const result=await verifyCapture(root,dir,{revision,version,staged:true});assert.equal(result.pass,expectedPass,label+': '+result.error);results.push({label,pass:true,expected_capture_pass:expectedPass,...(result.error?{rejected_for:result.error}:{}),checks:result.checks.length});
}
try{
 await run('Complete constructed actual-adapter capture matches all frozen original cells',null,true);
 for(const helper of ['verify-numbers.py','verify-schemas.py']){const out=join(dir,helper+'.json'),result=spawnSync('python3',[join(evidence,'interface-checker',helper),dir,out,revision,version,'staged'],{encoding:'utf8',maxBuffer:1024*1024});assert.equal(result.status,0,result.stdout+result.stderr);const report=JSON.parse(await readFile(out));results.push({label:'Constructed '+helper,pass:true,checks:report.checks?.length,schema_checks:report.schema_checks?.length,negative_controls:report.negative_controls?.length});}
 const selected=base+'&measure=SA1.mean',wrong=selected+'&observation=2026-10-18';
 for(const [label,edit]of [
  ['missing request',r=>r.requests.pop()],['wrong Worker',r=>r.requests[0].headers['x-worker-version']='ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee'],['capture failure mislabelled',r=>r.pass=false],['reference drift',r=>r.references[0].sha256='0'.repeat(64)],['unsafe body path',r=>r.requests[0].file='../outside.body'],['body hash drift',r=>r.requests[0].sha256='0'.repeat(64)],['HEAD payload',r=>r.requests.find(x=>x.method==='HEAD').bytes=1],['conditional ETag drift',r=>r.requests.find(x=>x.conditional).request_etag='"other"'],
  ['wrong raw price with same rounded value',(_,m)=>m('/australia.json',b=>{b.grid_day.regions[0].intervals[0].price_raw='2.091';b.grid_day.regions[0].intervals[0].layout2_price_raw='2.091';})],['wrong cent price',(_,m)=>m('/australia.json',b=>b.grid_day.regions[0].intervals[0].price++)],['duplicate interval',(_,m)=>m('/australia.json',b=>b.grid_day.regions[0].intervals[0].period_end=b.grid_day.regions[0].intervals[1].period_end)],['missing interval',(_,m)=>m('/australia.json',b=>b.grid_day.regions[0].intervals.pop())],['wrong geography',(_,m)=>m('/australia.json',b=>b.grid_day.regions[0].geography='Australia')],['changed negative-count semantics',(_,m)=>m('/australia.json',b=>b.grid_day.regions[0].summary.negative_count++)],['wrong dataset',(_,m)=>m('/australia.json',b=>b.grid_day.regions[0].dataset='TREGION')],['wrong intervention',(_,m)=>m('/australia.json',b=>b.grid_day.regions[0].intervention=1)],['future/older day',(_,m)=>m('/australia.json',b=>b.grid_day.calendar_day='2026-10-18')],['missing provenance',(_,m)=>m('/australia.json',b=>b.grid_day.provenance=[])],['wrong original ZIP',(_,m)=>m('/australia.json',b=>b.grid_day.provenance[1].sha256='0'.repeat(64))],['provenance after completion',(_,m)=>m('/australia.json',b=>b.grid_day.provenance[0].retrieved_at='2026-10-20T13:00:01.000Z')],['lost existing grid',(_,m)=>m('/australia.json',b=>b.grid.pop())],['wrong selected qualification',(_,m)=>m(selected,b=>b.observations[0].qualifications.unit='AUD/kWh')],['same-value wrong context day',(_,m)=>m(base,b=>b.context.calendar_day='2026-10-18')],['wrong statistical version',(_,m)=>m(selected,b=>b.observations[0].version='0'.repeat(64))],['wrong native pointer',(_,m)=>m(selected,b=>b.observations[0].native_pointer='/grid_day/regions/1/summary/mean')],['missing period replaced by zero',(_,m)=>m(wrong,b=>b.data={value:0})],['missing advertised definition',(_,m)=>m('/catalog.json?desk=australia',b=>b.sources.find(s=>s.key===source).measures.pop())],['unbounded TTL',r=>r.requests.find(x=>x.path==='/australia.json').headers['cache-control']='public, max-age=86400'],['TTL crosses AEST midnight',r=>{const x=r.requests.find(x=>x.path==='/australia.json');x.started_at='2026-10-20T13:59:59.000Z';x.completed_at='2026-10-20T13:59:59.500Z';x.headers['cache-control']='public, max-age=60';}],
 ])await run(label,edit,false);
 const codeAfter=await codeHashes();assert.deepEqual(codeAfter,codeBefore,'Source and tooling changed during controls');
 const report={kind:'Constructed offline AEMO public checker controls; no HTTP or release acceptance',pass:true,code_before:codeBefore,code_after:codeAfter,code_unchanged:true,independent_original_intervals:576,independent_summary_measures:10,controls:results.length,results};if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,controls:results.length}));
}finally{await rm(dir,{recursive:true,force:true});}
