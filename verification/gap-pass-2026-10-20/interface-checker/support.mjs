// Validation only. No production reader imports, network, or replacement data.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const pinned={
 boc:'e3090218ac6ecde21dc0a476f2c96c919d905703d4fc6409ab9b1cab356ba94a',
 'statcan/jobs':'2025e83384dad0cb1da0bf47c4f3096f1f7afc276fb8f18e169ba58281038194',
 'statcan/price_index':'47aa8c59fc194102b5b7a7b962e6a26d9bcd431cc5a1fdc6d03d5d87b77e79fb',
 'statcan/shop':'36875770328f809e3eaf9cab2c2bea43e90acdc0d017e19e7fc35aed091e8c69',
 'statcan/homes':'e42b90eb71df2b4f889a76beab183a5470d39cfdd161681e7fc44263970287ba',
 wra:'f906697963ebd32263c16070f802e94167735daac478df7e3d6bae7aca9d4d4d',
};
export const sources=[
 ['canada','exchange_history','FXGBPCAD','2026-10-19'],
 ['canada','jobs','alberta','2026-09'],
 ['canada','price_index','index','2026-09'],
 ['canada','shop','total_retail_sales','2026-07'],
 ['canada','homes','starts','2026-Q3'],
 ['wales','land_transaction_tax','all_disclosed','2025-26'],
];
export function routes(){
 const result=['/health.json','/schema.json',...['australia','canada','wales'].flatMap(d=>['/'+d+'.json','/catalog.json?desk='+d])].map(path=>({path}));
 for(const [desk,source,measure,period] of sources){
  const path=`/${desk}.json?source=${source}`;
  result.push({path},{path:path+'&measure='+measure},{path:path+'&measure='+measure+'&observation='+period});
 }
 for(const [desk,source,measure] of [sources[0],sources[1],sources[5]]){
  const path=`/${desk}.json?source=${source}&measure=${measure}`;
  result.push({path,status:304,conditional:true},{path,method:'HEAD'});
 }
 for(const [path,status,error]of [
  ['/australia.json?source=grid_day',404,'unknown_source'],
  ['/canada.json?source=exchange_history&measure=FXUSDCAD&observation=2026-10-12',404,'not_published_on_date'],
  ['/canada.json?source=exchange_history&measure=FXUSDCAD&observation=2020-01-01',404,'observation_not_retained'],
  ['/canada.json?source=exchange_history&measure=FXUSDCAD&observation=2026-09-31',400,'invalid_observation'],
  ['/canada.json?source=jobs&measure=outside-reviewed-contract',404,'unknown_measure'],
  ['/canada.json?source=jobs&measure=canada&geography=Ontario',400,'unsupported_query'],
  ['/canada.json?source=homes&measure=starts&observation=2026-07',404,'observation_not_retained'],
  ['/wales.json?source=land_transaction_tax&measure=all_inclusive&observation=2024-25',404,'observation_not_retained'],
 ])result.push({path,status,error});
 return result.map(r=>({method:'GET',status:200,conditional:false,...r}));
}
export async function references(root){
 const refs={},manifest=[];
 for(const [key,digest]of Object.entries(pinned)){
  const file=`verification/gap-pass-2026-10-20/${key}/independent-report.json`,bytes=await readFile(join(root,file)),value=JSON.parse(bytes);
  if(sha(bytes)!==digest||!(value.pass===true||value.passed===true))throw Error('Pinned independent reference mismatch: '+key);
  refs[key]=value;manifest.push({file,sha256:digest,bytes:bytes.length});
 }
 return {refs,manifest};
}
export function expected(refs,source){
 if(source==='exchange_history')return refs.boc.cells.map(r=>({id:r.series,period:r.period,value:Number(r.value_text),value_text:r.value_text,unit:r.series==='FXUSDCAD'?'CAD per USD':'CAD per GBP'}));
 if(source==='jobs')return refs['statcan/jobs'].rows.map(r=>({...r,release:refs['statcan/jobs'].release_timestamp_raw}));
 if(['price_index','shop','homes'].includes(source))return refs['statcan/'+source].observations.map(r=>({...r,id:{price_index:'index',shop:'total_retail_sales',homes:'starts'}[source],release:r.publisher_release}));
 return refs.wra.comparisons.map(r=>({...r,id:r.measure,geography:'Wales'}));
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const checked=(check,label,pass)=>check(label,Boolean(pass));
export function nativeChecks(refs,source,native,check,label){
 const exp=expected(refs,source);
 if(source==='exchange_history'){
  check(label+' exact rolling window',same(native?.window,refs.boc.window)&&native.metadata?.date_count===19&&native.metadata.observation_count===38&&native.metadata.latest_period===refs.boc.latest_published_date);
  check(label+' complete 38 dated exchange cells',native.rows?.length===38&&exp.every(e=>native.rows.filter(r=>r.series===e.id&&r.period===e.period&&r.value===e.value&&r.value_text===e.value_text&&r.unit===e.unit&&r.quote_currency==='CAD'&&r.base_currency===(e.id==='FXUSDCAD'?'USD':'GBP')).length===1));
  check(label+' independently acquired newest-date anchor',native.latest_anchor?.length===2&&exp.filter(e=>e.period===refs.boc.latest_published_date).every(e=>native.latest_anchor.some(r=>r.series===e.id&&r.period===e.period&&r.value===e.value)));
  return;
 }
 const rows=source==='jobs'?native:native?.rows;
 check(label+' complete native row coverage',Array.isArray(rows)&&rows.length===exp.length);
 for(const e of exp){
  const row=source==='land_transaction_tax'?rows.find(r=>r.coverage===e.coverage&&r.transaction_type===e.transaction_type):rows.find(r=>r.measure_id===e.id);
  check(label+' '+e.id+' exact period/value/unit/geography',row?.period===e.period&&row.value===e.value&&row.unit===e.unit&&row.geography===e.geography);
  if(source==='land_transaction_tax')check(label+' '+e.id+' revision/disclosure qualifications',row.notes===e.notes&&native.period==='2025-26'&&native.period_start==='2025-04-01'&&native.period_end==='2026-03-31');
  else{
   check(label+' '+e.id+' exact publisher identities/release',row.dimensions?.coordinate===e.coordinate&&row.dimensions.vector===String(e.vector)&&row.release_timestamp_raw===e.release&&row.release_timezone===null);
   check(label+' '+e.id+' accepted published flags',row.status_code===(e.status_code??0)&&row.symbol_code===(e.symbol_code??0)&&row.security_level_code===0);
   if(source==='jobs')check(label+' '+e.id+' preserved correctly labelled legacy row',row.name===e.geography&&row.rate===e.value);
  }
 }
 if(source==='price_index')check(label+' legacy index',native.period==='2026-09'&&native.index===170);
 if(source==='shop')check(label+' legacy retail scale',native.period==='2026-07'&&native.thousand_dollars===73696547);
 if(source==='homes')check(label+' legacy quarter alias and CMHC conditions',native.period==='2026-07'&&native.quarter==='2026-Q3'&&native.starts===57947&&native.licence==='CMHC Licence Agreement for the Use of Data'&&/does not constitute an endorsement/.test(native.licence_notice?.adaptation_notice||'')&&/require recipients to agree/.test(native.licence_notice?.conditions||''));
}
export function bodyChecks(refs,path,body,check,versions=new Map()){
 const u=new URL(path,'https://morningrows.com'),source=u.searchParams.get('source'),desk=u.pathname.slice(1,-5),label=path;
 if(!source){
  if(u.pathname==='/schema.json')check(label+' held AEMO absent from published schema',!JSON.stringify(body).includes('grid_day')&&!Object.keys(body.$defs||{}).some(k=>k.startsWith('gapAemo')));
  if(u.pathname==='/australia.json')check(label+' held AEMO absent from native and health',!Object.hasOwn(body,'grid_day')&&!Object.hasOwn(body.sources||{},'grid_day'));
  if(u.pathname==='/catalog.json'){
   if(u.searchParams.get('desk')==='australia')check(label+' held AEMO not advertised',!body.sources?.some(c=>c.key==='grid_day'));
   const d=u.searchParams.get('desk');
   for(const [,key]of sources.filter(x=>x[0]===d)){
    const card=body.sources?.find(c=>c.key===key),ids=[...new Set(expected(refs,key).map(x=>x.id))].sort();
    check(label+' '+key+' exact discoverable identities',same(card?.measures?.map(x=>x.id).sort(),ids));
   }
  }else for(const [,key]of sources.filter(x=>x[0]===desk)){
   check(label+' '+key+' healthy acquisition',body.sources?.[key]?.status==='ok');
   nativeChecks(refs,key,body[key],check,label+' '+key);
  }
  return;
 }
 if(!sources.some(x=>x[0]===desk&&x[1]===source))throw Error('Unexpected successful source');
 const measure=u.searchParams.get('measure'),period=u.searchParams.get('observation');
 const exp=expected(refs,source).filter(x=>(!measure||x.id===measure)&&(!period||x.period===period));
 check(label+' complete selected observation coverage',exp.length>0&&body.retrieval?.status==='ok'&&Array.isArray(body.observations)&&body.observations.length===exp.length&&new Set(body.observations.map(r=>r.id)).size===exp.length);
 for(const e of exp){
  const id=`https://morningrows.com/${desk}.json?source=${source}&measure=${e.id}&observation=${e.period}`,r=body.observations.find(r=>r.id===id);
  check(label+' '+e.id+' '+e.period+' exact selected value',r?.value===e.value&&r.period===e.period&&r.value_state==='observed'&&r.definition?.id===e.id&&r.definition.unit===e.unit&&/^[a-f0-9]{64}$/.test(r.version||''));
  check(label+' '+e.id+' semantic qualifications',r.qualifications?.value===e.value&&r.qualifications.period===e.period&&r.qualifications.unit===e.unit&&(!e.geography||r.definition.geography===e.geography));
  if(source==='land_transaction_tax')check(label+' disclosure coverage retained',r.qualifications.coverage===e.coverage&&r.qualifications.transaction_type===e.transaction_type&&r.qualifications.notes===e.notes);
  if(e.coordinate)check(label+' coordinate/release retained',r.qualifications.dimensions?.coordinate===e.coordinate&&r.qualifications.dimensions.vector===String(e.vector)&&r.qualifications.release_timestamp_raw===e.release&&r.qualifications.release_timezone===null);
  if(versions.has(id))check(label+' stable selector observation version',versions.get(id)===r.version);else versions.set(id,r.version);
 }
 check(label+' statistical content version',/^[a-f0-9]{64}$/.test(body.content_version||''));
 if(!measure){
  if(source==='exchange_history')nativeChecks(refs,source,{...body.context,rows:body.data},check,label+' selected source');
  else nativeChecks(refs,source,body.data,check,label+' selected source');
 }else{
  const rows=Array.isArray(body.data)?body.data:[body.data];
  check(label+' selected data matches observation selection',rows.length===exp.length&&exp.every(e=>rows.some(r=>r?.period===e.period&&r.value===e.value&&r.unit===e.unit)));
 }
}
export function cacheChecks(record,check){
 if(record.status!==200||!record.path.includes('.json')||record.path.startsWith('/health')||record.path.startsWith('/schema'))return;
 const ttl=record.headers['cache-control']?.match(/(?:^|[,\s])max-age=(\d+)/)?.[1];
 check(record.path+' bounded cache lifetime',ttl!==undefined&&Number(ttl)<=3600);
 if(!record.path.startsWith('/canada.json'))return;
 const start=Date.parse(record.started_at);
 const rollover=(Math.floor(start/86400000)+1)*86400000;
 check(record.path+' cache expires by calendar boundary',Number(ttl)<=Math.floor((rollover-start)/1000));
 check(record.path+' capture did not cross calendar boundary',Date.parse(record.completed_at)<rollover);
}
export async function verifyCapture(root,directory,{revision,version,staged}){
 const {refs,manifest}=await references(root),report=JSON.parse(await readFile(join(directory,'gap-interface-report.json')));
 const checks=[],check=(label,pass)=>{checks.push({label,pass:Boolean(pass)});if(!pass)throw Error(label);};
 try{
  check('capture identity and pass',report.pass===true&&report.revision===revision&&report.version===version&&report.staged===staged);
  check('exact pinned reference manifest',same(report.references,manifest));
  const origins=staged?['https://morningrows.com']:['https://morningrows.com','https://www.morningrows.com'],plan=origins.flatMap(origin=>routes().map(r=>({...r,origin})));
  check('exact complete route count',report.requests?.length===plan.length);
  const files=new Set(),versions=new Map(),etags=new Map();
  for(let i=0;i<plan.length;i++){
   const want=plan[i],record=report.requests[i],key=record.origin+record.path;
   check('request '+i+' exact route/method/status',record.origin===want.origin&&record.path===want.path&&record.method===want.method&&record.conditional===want.conditional&&record.status===want.status&&record.expected_status===want.status);
   check('request '+i+' exact candidate identity',record.headers?.['x-source-revision']===revision&&record.headers?.['x-worker-version']===version);
   check('request '+i+' valid capture interval',Number.isFinite(Date.parse(record.started_at))&&Date.parse(record.completed_at)>=Date.parse(record.started_at));
   if(record.method==='HEAD'||record.conditional){
    check('request '+i+' no conditional/HEAD body',record.bytes===0&&record.sha256===sha(Buffer.alloc(0))&&!record.file);
    check('request '+i+' exact prior GET ETag',Boolean(etags.get(key))&&record.headers.etag===etags.get(key)&&(!record.conditional||record.request_etag===etags.get(key)));
    continue;
   }
   check('request '+i+' safe unique capture path',/^\d{3}\.body$/.test(record.file||'')&&!files.has(record.file));files.add(record.file);
   const bytes=await readFile(join(directory,record.file));
   check('request '+i+' retained bytes/hash',bytes.length===record.bytes&&sha(bytes)===record.sha256);
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   check('request '+i+' JSON media type',/^application\/json(?:;|$)/i.test(record.headers['content-type']||''));
   if(want.error){
    check('request '+i+' exact refusal',body.error===want.error||body.reason===want.error);
    check('request '+i+' no substituted observations',!body.observations?.length&&(body.data===null||body.data===undefined));
    continue;
   }
   if(record.path==='/health.json')check('clean health identity',body.source_dirty===false&&body.source_revision===revision&&body.worker_version===version);
   cacheChecks(record,check);
   bodyChecks(refs,record.path,body,check,versions);
   if(record.headers.etag)etags.set(key,record.headers.etag);
  }
  return {pass:true,checks,references:manifest,requests:plan.length,independent_cells:{boc:38,statcan:14,wra:4},held_sources:['australia/grid_day']};
 }catch(error){return {pass:false,error:error.message,checks,references:manifest};}
}
