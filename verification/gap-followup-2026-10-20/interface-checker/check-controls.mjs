// Constructed offline checker tests, never actual Worker evidence. Runtime
// modules create subjects; support.mjs is an independently pinned value oracle.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {references,routes,sha,verifyCapture,base,period,source} from './support.mjs';
import {readNiEnergySummary} from '../../../lib/ni-energy-summary.js';
import {readSectionsWithCompletion} from '../../../lib/source-completion.js';
import {SourceError} from '../../../lib/sources.js';
import {catalogue,INFORMATION_SCHEMA,validateSelection,selectedResponse} from '../../../lib/information.js';
const root=fileURLToPath(new URL('../../../',import.meta.url)),evidence=join(root,'verification/gap-followup-2026-10-20');
const clock='2026-10-20T15:00:00.000Z',revision='a'.repeat(40),version='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const fixture=await readFile(join(evidence,'access-review/ni-article/statistical-article.excerpt.html'));
const native=await readNiEnergySummary({now:()=>clock,fetcher:async()=>new Response(fixture,{headers:{'content-type':'text/html'}})});
const full={site:'https://morningrows.com',country:'Northern Ireland',[source]:native,sources:{[source]:{status:'ok',fetched_at:clock}},_meta:{schema_version:'1.0',id:'https://morningrows.com/northern-ireland.json',catalog:'https://morningrows.com/catalog.json?desk=northern-ireland'}};
const results=[];
const warn=console.warn;console.warn=()=>{};
let isolated;
try{isolated=await readSectionsWithCompletion({[source]:async()=>{throw new SourceError('Constructed NI transport refusal',503);},weather:async()=>({summary:'Retained sibling sentinel'})},[source],{now:()=>clock});}finally{console.warn=warn;}
assert.equal(isolated[source],null);assert.equal(isolated.sources[source].status,'error');assert.deepEqual(isolated.weather,{summary:'Retained sibling sentinel'});assert.equal(isolated.sources.weather.status,'ok');
const failed=await selectedResponse({...full,[source]:null,sources:{...full.sources,[source]:isolated.sources[source]}},validateSelection(new URL('https://morningrows.com'+base+'&measure=renewable_share_gfec')),{now:clock});
assert.equal(failed.status,503);assert.equal(failed.body.error,'retrieval_failed');assert.equal(failed.body.data,null);assert.deepEqual(failed.body.observations,[]);
results.push({label:'Constructed NI source failure preserves successful sibling and refuses selected substitution',pass:true,constructed:true});
const {manifest}=await references(root),records=[],bodies=new Map();
for(const [i,want]of routes().entries()){
 const u=new URL(want.path,'https://morningrows.com');let body;
 if(want.method==='HEAD'||want.conditional)body=undefined;
 else if(u.pathname==='/health.json')body={source_dirty:false,source_revision:revision,worker_version:version};
 else if(u.pathname==='/schema.json')body=INFORMATION_SCHEMA;
 else if(u.pathname==='/catalog.json')body=catalogue('northern-ireland');
 else if(!u.searchParams.has('source'))body=full;
 else{const selection=validateSelection(u),response=selection.status?{status:selection.status,body:{error:selection.code}}:await selectedResponse(full,selection,{now:clock});assert.equal(response.status,want.status,want.path);body=response.body;}
 const data=body===undefined?Buffer.alloc(0):Buffer.from(JSON.stringify(body)),etag='"'+sha(Buffer.from(want.path))+'"';
 const record={origin:'https://morningrows.com',path:want.path,method:want.method,conditional:want.conditional,status:want.status,expected_status:want.status,...(want.error?{expected_error:want.error}:{}),...(want.conditional?{request_etag:etag}:{}),started_at:clock,completed_at:clock,headers:{'content-type':'application/json','cache-control':'public, max-age=60','x-source-revision':revision,'x-worker-version':version,etag},bytes:data.length,sha256:sha(data)};
 if(body!==undefined){record.file=String(i+1).padStart(3,'0')+'.body';bodies.set(record.file,data);}records.push(record);
}
const original={pass:true,revision,version,staged:true,references:manifest,requests:records},dir=await mkdtemp(join(tmpdir(),'mr-ni-energy-checker-'));
async function run(label,edit,expectedPass){
 const report=structuredClone(original),copy=new Map(bodies);
 const mutate=(path,fn)=>{const r=report.requests.find(r=>r.path===path&&r.file);assert.ok(r,path);const b=JSON.parse(copy.get(r.file));fn(b);const data=Buffer.from(JSON.stringify(b));copy.set(r.file,data);r.bytes=data.length;r.sha256=sha(data);};
 edit?.(report,mutate);
 for(const [file,data]of copy)await writeFile(join(dir,file),data);
 await writeFile(join(dir,'ni-energy-interface-report.json'),JSON.stringify(report));
 const result=await verifyCapture(root,dir,{revision,version,staged:true});
 assert.equal(result.pass,expectedPass,label+': '+result.error);results.push({label,pass:true,expected_capture_pass:expectedPass,...(result.error?{rejected_for:result.error}:{}),checks:result.checks.length});
}
try{
 await run('Constructed complete native/selectors match five independent cells',null,true);
 const output=join(dir,'schema-report.json'),schemas=spawnSync('python3',[join(evidence,'interface-checker/verify-schemas.py'),dir,output,revision,version,'staged'],{encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(schemas.status,0,schemas.stdout+schemas.stderr);
 const schemaReport=JSON.parse(await readFile(output));results.push({label:'Constructed captured Draft2020-12 schema positives/negatives',pass:true,schema_checks:schemaReport.schema_checks.length,negative_controls:schemaReport.negative_controls.length});
 const selected=base+'&measure=renewable_share_gfec',wrong=selected+'&observation='+encodeURIComponent('2024-07-01/2025-06-30');
 for(const [label,edit]of [
  ['missing request',r=>r.requests.pop()],
  ['wrong Worker identity',r=>{r.requests[0].headers['x-worker-version']='ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee';}],
  ['failed capture falsely accepted',r=>{r.pass=false;}],
  ['independent reference substitution',r=>{r.references[0].sha256='0'.repeat(64);}],
  ['unsafe body path',r=>{r.requests[0].file='../outside.body';}],
  ['retained body hash mismatch',r=>{r.requests[0].sha256='0'.repeat(64);}],
  ['HEAD payload',r=>{r.requests.find(x=>x.method==='HEAD').bytes=1;}],
  ['HEAD unbounded cache',r=>{r.requests.find(x=>x.method==='HEAD').headers['cache-control']='public, max-age=86400';}],
  ['conditional ETag mismatch',r=>{r.requests.find(x=>x.conditional).request_etag='"other"';}],
  ['wrong exact renewable value',(_,m)=>m('/northern-ireland.json',b=>{b[source].rows[0].value=51;})],
  ['share denominator silently generation',(_,m)=>m('/northern-ireland.json',b=>{b[source].rows[0].methodology='Share of total generation';})],
  ['annual instead of rolling period',(_,m)=>m('/northern-ireland.json',b=>{b[source].rows[1].period='2026';})],
  ['changed same-value edition',(_,m)=>m('/northern-ireland.json',b=>{b[source].publication_date='2026-12-03';})],
  ['claim fixed report metadata retrieved live',(_,m)=>m('/northern-ireland.json',b=>{b[source].metadata.metadata_evidence.live_retrieved=true;})],
  ['missing public provenance',(_,m)=>m('/northern-ireland.json',b=>{b[source].provenance=[];})],
  ['provenance after source completion',(_,m)=>m('/northern-ireland.json',b=>{b[source].provenance[0].retrieved_at='2026-10-20T15:00:01.000Z';})],
  ['invalid source completion',(_,m)=>m('/northern-ireland.json',b=>{b.sources[source].fetched_at=null;})],
  ['selected same-value wrong qualification',(_,m)=>m(selected,b=>{b.observations[0].qualifications.edition='fixed_2026-12-03';})],
  ['selected same-value wrong context edition',(_,m)=>m(base,b=>{b.context.metadata.latest_reference_month='2026-09';})],
  ['selected observation fake version',(_,m)=>m(selected,b=>{b.observations[0].version='0'.repeat(64);})],
  ['missing period replaced by zero',(_,m)=>m(wrong,b=>{b.data={value:0};})],
  ['catalogue loses exact measure',(_,m)=>m('/catalog.json?desk=northern-ireland',b=>{b.sources.find(s=>s.key===source).measures.pop();})],
  ['unbounded cache lifetime',r=>{r.requests.find(x=>x.path==='/northern-ireland.json').headers['cache-control']='public, max-age=86400';}],
 ])await run(label,edit,false);
 const report={kind:'Constructed offline NI checker controls; not actual Worker access or release acceptance',pass:true,independent_cells:5,controls:results.length,results};
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:true,controls:results.length,schema_checks:schemaReport.schema_checks.length,schema_negative_controls:schemaReport.negative_controls.length}));
}finally{await rm(dir,{recursive:true,force:true});}
