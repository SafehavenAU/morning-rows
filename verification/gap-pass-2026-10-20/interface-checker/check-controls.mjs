// Constructed offline controls, not actual Worker/publisher execution evidence.
// Runtime readers build the test subject only; support.mjs independently reads
// the frozen Python reference and imports no runtime parser.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {references,routes,sha,verifyCapture} from './support.mjs';
import {bocHistoryWindow,parseBocHistory} from '../../../lib/boc-history.js';
import {parseStatcanHeadline} from '../../../lib/statcan-headlines.js';
import {walesTax} from '../../../lib/fiscal-observations.js';
import {catalogue,INFORMATION_SCHEMA,validateSelection,selectedResponse} from '../../../lib/information.js';
const root=fileURLToPath(new URL('../../../',import.meta.url)),base=join(root,'verification/gap-pass-2026-10-20');
const text=path=>readFile(join(base,path),'utf8'),json=async path=>JSON.parse(await text(path));
const clock='2026-10-20T10:00:00.000Z',revision='a'.repeat(40),version='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const boc=parseBocHistory(await json('boc/original/window.json'),await json('boc/original/latest.json'),bocHistoryWindow(clock));
const ca={exchange_history:boc};
for(const source of ['jobs','price_index','shop','homes'])ca[source]=parseStatcanHeadline(source,...await Promise.all(['wds-selected.json','series-metadata.json','cube-metadata.json'].map(f=>json(`statcan/${source}/original/${f}`))));
const desks={australia:{},canada:ca,wales:{land_transaction_tax:walesTax(await readFile(join(root,'test/fixtures/wra-tax.csv'),'utf8'),new Date(clock))}};
for(const [desk,value]of Object.entries(desks)){
 const sources=Object.fromEntries(Object.keys(value).map(key=>[key,{status:'ok',fetched_at:clock}]));
 Object.assign(value,{site:'https://morningrows.com',country:desk[0].toUpperCase()+desk.slice(1),sources,_meta:{schema_version:'1.0',id:`https://morningrows.com/${desk}.json`,catalog:`https://morningrows.com/catalog.json?desk=${desk}`}});
}
const {manifest}=await references(root),records=[],bodies=new Map();
for(const [i,want]of routes().entries()){
 const u=new URL(want.path,'https://morningrows.com'),desk=u.pathname.slice(1,-5);
 let body;
 if(want.method==='HEAD'||want.conditional)body=undefined;
 else if(u.pathname==='/health.json')body={source_dirty:false,source_revision:revision,worker_version:version};
 else if(u.pathname==='/schema.json')body=INFORMATION_SCHEMA;
 else if(u.pathname==='/catalog.json')body=catalogue(u.searchParams.get('desk'));
 else if(!u.searchParams.has('source'))body=desks[desk];
 else{
  const selection=validateSelection(u),result=selection.status?{status:selection.status,body:{error:selection.code}}:await selectedResponse(desks[desk],selection,{now:clock});
  assert.equal(result.status,want.status,want.path);body=result.body;
 }
 const bytes=body===undefined?Buffer.alloc(0):Buffer.from(JSON.stringify(body));
 const etag='"'+sha(Buffer.from(want.path))+'"';
 const record={origin:'https://morningrows.com',path:want.path,method:want.method,conditional:want.conditional,status:want.status,expected_status:want.status,...(want.error?{expected_error:want.error}:{}),...(want.conditional?{request_etag:etag}:{}),started_at:clock,completed_at:clock,headers:{'content-type':'application/json','cache-control':'public, max-age=60','x-source-revision':revision,'x-worker-version':version,etag},bytes:bytes.length,sha256:sha(bytes)};
 if(body!==undefined){record.file=String(i+1).padStart(3,'0')+'.body';bodies.set(record.file,bytes);}
 records.push(record);
}
const original={pass:true,revision,version,staged:true,references:manifest,requests:records},dir=await mkdtemp(join(tmpdir(),'mr-gap-capture-controls-'));
const results=[];
async function run(label,edit,expectedPass){
 const report=structuredClone(original),copy=new Map(bodies);
 const mutate=(path,fn)=>{
  const r=report.requests.find(r=>r.path===path&&r.file),body=JSON.parse(copy.get(r.file));fn(body);
  const bytes=Buffer.from(JSON.stringify(body));copy.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes);
 };
 edit?.(report,mutate,copy);
 for(const [file,bytes]of copy)await writeFile(join(dir,file),bytes);
 await writeFile(join(dir,'gap-interface-report.json'),JSON.stringify(report));
 const result=await verifyCapture(root,dir,{revision,version,staged:true});
 assert.equal(result.pass,expectedPass,label+': '+result.error);
 results.push({label,pass:true,expected_capture_pass:expectedPass,...(result.error?{rejected_for:result.error}:{}),checks:result.checks.length});
}
try{
 await run('Complete constructed actual-adapter outputs agree with independent references',null,true);
 const schemaOutput=join(dir,'schema-controls.json');
 const schemas=spawnSync('python3',[join(base,'interface-checker/verify-schemas.py'),dir,schemaOutput,revision,version,'staged'],{encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(schemas.status,0,schemas.stdout+schemas.stderr);
 const schemaControls=JSON.parse(await readFile(schemaOutput,'utf8'));
 results.push({label:'Captured schema positive and negative controls on constructed adapter outputs',pass:true,schema_checks:schemaControls.schema_checks.length,negative_controls:schemaControls.negative_controls.length});
 const controls=[
  ['missing route',r=>r.requests.pop()],
  ['wrong identity',r=>r.requests[0].headers['x-worker-version']='ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee'],
  ['claimed failed capture',r=>r.pass=false],
  ['reference substitution',r=>r.references[0].sha256='0'.repeat(64)],
  ['unsafe path',r=>r.requests[0].file='../outside.body'],
  ['body hash mismatch',r=>r.requests[0].sha256='0'.repeat(64)],
  ['HEAD payload',r=>r.requests.find(x=>x.method==='HEAD').bytes=1],
  ['conditional wrong ETag',r=>r.requests.find(x=>x.conditional).request_etag='"different"'],
  ['invented missing-date zero',(_,m)=>m('/canada.json?source=exchange_history&measure=FXUSDCAD&observation=2026-10-12',b=>{b.data={value:0};})],
  ['held AEMO native exposed',(_,m)=>m('/australia.json',b=>b.grid_day={status:'ok'})],
  ['held AEMO health exposed',(_,m)=>m('/australia.json',b=>b.sources.grid_day={status:'ok'})],
  ['held AEMO catalog exposed',(_,m)=>m('/catalog.json?desk=australia',b=>b.sources.push({key:'grid_day'}))],
  ['held AEMO schema exposed',(_,m)=>m('/schema.json',b=>b.$defs.gapAemoNative={type:'object'})],
  ['held AEMO substituted data',(_,m)=>m('/australia.json?source=grid_day',b=>b.data={status:'ok'})],
  ['wrong FX quote direction',(_,m)=>m('/canada.json',b=>b.exchange_history.rows[0].quote_currency='USD')],
  ['missing FX date',(_,m)=>m('/canada.json',b=>b.exchange_history.rows.splice(0,2))],
  ['silent old FX tail',(_,m)=>m('/canada.json',b=>{b.exchange_history.rows.splice(-2);b.exchange_history.metadata.observation_count-=2;})],
  ['wrong provincial unemployment assignment',(_,m)=>m('/canada.json',b=>b.jobs[1].value=6.4)],
  ['invented release UTC timezone',(_,m)=>m('/canada.json',b=>b.price_index.rows[0].release_timezone='UTC')],
  ['retail wrong scale',(_,m)=>m('/canada.json',b=>b.shop.rows[0].value/=1000)],
  ['housing month replaces quarter',(_,m)=>m('/canada.json',b=>b.homes.rows[0].period='2026-07')],
  ['lost CMHC conditions',(_,m)=>m('/canada.json',b=>delete b.homes.licence_notice)],
  ['WRA confidential zero',(_,m)=>m('/wales.json',b=>{b.land_transaction_tax.rows[0].notes='Confidential';b.land_transaction_tax.rows[0].value=0;})],
  ['wrong selected observation version',(_,m)=>m('/canada.json?source=jobs&measure=alberta',b=>b.observations[0].version='0'.repeat(64))],
  ['selected plausible wrong number',(_,m)=>m('/wales.json?source=land_transaction_tax&measure=all_disclosed&observation=2025-26',b=>b.observations[0].value=371)],
  ['selected extra observation',(_,m)=>m('/canada.json?source=price_index&measure=index',b=>b.observations.push(b.observations[0]))],
  ['discovery omission',(_,m)=>m('/catalog.json?desk=canada',b=>b.sources.find(s=>s.key==='jobs').measures.pop())],
  ['cache crosses UTC day',r=>{const a=r.requests.find(x=>x.path==='/canada.json');a.started_at='2026-10-20T23:59:50.000Z';a.completed_at=a.started_at;}],
 ];
 for(const [label,edit]of controls)await run(label,edit,false);
 const output=process.argv[2];
 const report={kind:'Constructed offline checker controls; not live capture or operational acceptance',pass:true,controls:results.length,results};
 if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(report));
}finally{await rm(dir,{recursive:true,force:true});}
