// Capture the actual Worker; the independent Python reference is the numerical
// oracle. This script does not import the GDP reader or substitute fixtures.
// node scripts/check-statcan-gdp.mjs OUTPUT REVISION VERSION [staged]
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2),[directory,revision,version,mode]=args;
if(args.length<3||args.length>4||!directory||!/^[a-f0-9]{40}$/.test(revision||'')||
   !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(version||'')||
   (mode!==undefined&&mode!=='staged')) throw Error('OUTPUT REVISION VERSION [staged] required');
const root=fileURLToPath(new URL('../',import.meta.url));
const referenceFile=process.env.GDP_REFERENCE
  ?resolve(process.env.GDP_REFERENCE)
  :join(root,'verification/statcan-gdp-2026-10-20/independent-report.json');
const referenceBytes=await readFile(referenceFile),reference=JSON.parse(referenceBytes);
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const referenceValid=reference.pass===true&&reference.product_id===36100104&&
  reference.coordinate==='1.1.1.30.0.0.0.0.0.0'&&reference.vector_id===62305752&&
  same(reference.dimensions,['Canada','Chained (2017) dollars','Seasonally adjusted at annual rates','Gross domestic product at market prices'])&&
  same(reference.quarters,['2026-Q1','2026-Q2'])&&same(reference.levels,[2503604,2524127])&&
  reference.unit==='millions of chained (2017) dollars'&&
  reference.level_adjustment==='Seasonally adjusted at annual rates'&&
  reference.growth_adjustment==='ordinary quarter-to-quarter percent change; not annualized'&&
  reference.release_timestamp_raw==='2026-08-28T08:30'&&reference.release_timezone===null&&
  ['wds_vs_csv','wds_vs_selected_table','wds_vs_dated_daily_table4'].every(key=>reference.exact_comparisons?.[key]===2)&&
  typeof reference.ordinary_growth_two_decimals==='string'&&Number(reference.ordinary_growth_two_decimals)===0.82&&
  Math.round((reference.levels[1]/reference.levels[0]-1)*10000)/100===0.82&&
  typeof reference.verified_at==='string'&&Number.isFinite(Date.parse(reference.verified_at));
if(!referenceValid) throw Error('GDP_REFERENCE does not establish the pinned two-quarter, two-level, 0.82% independently reconciled contract');
const out=resolve(directory),run=promisify(execFile),staged=mode==='staged';
// Never replace a failed run or silently reuse an earlier capture directory.
await mkdir(out);
const report={
  started_at:new Date().toISOString(),
  kind:staged?'Exact zero-percent candidate GDP interface':'Production GDP interface',
  revision,version,staged,
  reference:{
    file:relative(root,referenceFile),
    sha256:createHash('sha256').update(referenceBytes).digest('hex'),
    bytes:referenceBytes.length,verified_at:reference.verified_at,
    quarters:reference.quarters,levels:reference.levels,
    ordinary_growth_two_decimals:reference.ordinary_growth_two_decimals,
    release_timestamp_raw:reference.release_timestamp_raw,release_timezone:null,
    exact_comparisons:reference.exact_comparisons,
  },
  requests:[],checks:[],
};
const check=(label,pass)=>{
  report.checks.push({label,pass:Boolean(pass)});
  if(!pass) throw Error(label);
};
const source='/canada.json?source=product',level=source+'&measure=level',growth=source+'&measure=quarter_change';
const [priorQuarter,latestQuarter]=reference.quarters;

async function request(origin,path,{status=200,method='GET',etag,error}={}){
  if(status===304&&!etag) throw Error('Conditional request requires an actual successful GET ETag');
  const started_at=new Date().toISOString();
  const {stdout}=await run('curl',[
    '--silent','--show-error','--proto','=https','--max-time','90','--include',
    ...(method==='HEAD'?['--head']:[]),
    ...(staged?['-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${version}"`]:[]),
    ...(etag?['-H','If-None-Match: '+etag]:[]),origin+path,
  ],{maxBuffer:2097152,encoding:'buffer'});
  let payload=stdout,actual,headers={};
  while(payload.subarray(0,5).toString()==='HTTP/'){
    const end=payload.indexOf('\r\n\r\n');
    if(end<0) throw Error('Invalid response headers');
    const lines=payload.subarray(0,end).toString().split('\r\n');
    actual=Number(lines[0].split(' ')[1]);headers={};
    for(const line of lines.slice(1)){
      const colon=line.indexOf(':');
      if(colon<1) continue;
      const key=line.slice(0,colon).toLowerCase();
      if(['etag','cache-control','content-type','content-location','x-source-revision','x-worker-version','x-retrieved-at','link'].includes(key)){
        headers[key]=line.slice(colon+1).trim();
      }
    }
    payload=payload.subarray(end+4);
  }
  const record={
    origin,path,method,conditional:Boolean(etag),...(etag?{request_etag:etag}:{}),
    started_at,completed_at:new Date().toISOString(),status:actual,expected_status:status,
    ...(error?{expected_error:error}:{}),headers,bytes:payload.length,
    sha256:createHash('sha256').update(payload).digest('hex'),
  };
  report.requests.push(record);
  if(method==='GET'&&!etag){
    record.file=String(report.requests.length).padStart(3,'0')+'.body';
    await writeFile(join(out,record.file),payload,{flag:'wx'});
  }
  check(`${origin} ${method} ${path}: status`,actual===status);
  check(`${origin} ${method} ${path}: exact identity`,
    headers['x-source-revision']===revision&&headers['x-worker-version']===version);
  if(status===304||method==='HEAD'){
    check(`${origin} ${method} ${path}: empty body`,payload.length===0);
    if(etag) check(`${origin} ${method} ${path}: conditional ETag`,headers.etag===etag);
    return {headers};
  }
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(payload));
  check(`${origin} ${path}: JSON media type`,/^application\/json(?:;|$)/i.test(headers['content-type']||''));
  if(status===200&&path.includes('source=')){
    const ttl=headers['cache-control']?.match(/max-age=(\d+)/)?.[1];
    check(`${origin} ${path}: bounded cache`,ttl!==undefined&&Number(ttl)<=120);
  }
  if(error){
    check(`${origin} ${path}: explicit refusal`,body.error===error||body.reason===error);
    check(`${origin} ${path}: no substituted observations`,
      !body.observations?.length&&(body.data===undefined||body.data===null));
  }
  return {body,headers};
}

function nativeChecks(native,label){
  check(label+': exact two independently reconciled levels',native?.rows?.length===2&&
    native.rows.every((row,i)=>row.period===reference.quarters[i]&&row.value===reference.levels[i]));
  check(label+': exact national real annual-rate semantics',
    native.geography==='Canada'&&native.unit===reference.unit&&
    native.adjustment===reference.level_adjustment&&native.price_basis==='Chained (2017) dollars');
  check(label+': preserved legacy fields',
    native.period==='2026-04'&&native.quarter===latestQuarter&&
    native.level===reference.levels[1]&&native.quarter_change===0.82);
  check(label+': nonannualized growth',native.growth?.value===0.82&&
    native.growth.period===latestQuarter&&native.growth.previous_period===priorQuarter&&
    native.growth.previous_value===reference.levels[0]&&native.growth.current_value===reference.levels[1]&&
    native.growth.unit==='percent'&&native.growth.kind==='derived'&&native.growth.annualized===false);
  check(label+': pinned release and source metadata',
    native.metadata?.count===2&&native.metadata.first_quarter===priorQuarter&&
    native.metadata.latest_quarter===latestQuarter&&native.metadata.cube_end_date==='2026-04-01'&&
    native.metadata.product_id===reference.product_id&&native.metadata.vector_id===reference.vector_id&&
    native.metadata.coordinate===reference.coordinate&&
    native.metadata.release_timestamp_raw===reference.release_timestamp_raw&&native.metadata.release_timezone===null);
}

function selectedChecks(body,measure,expected,label){
  check(label+': complete selected observations',Array.isArray(body?.observations)&&
    body.observations.length===expected.length&&
    new Set(body.observations.map(row=>row.id)).size===expected.length&&
    expected.every(([period,value],i)=>{
      const row=body.observations[i];
      return row.definition?.id===measure&&row.period===period&&row.value===value&&row.value_state==='observed'&&
        row.id===`https://morningrows.com${source}&measure=${measure}&observation=${period}`&&
        /^[a-f0-9]{64}$/.test(row.version||'');
    }));
}

try{
  for(const origin of staged?['https://morningrows.com']:['https://morningrows.com','https://www.morningrows.com']){
    const health=await request(origin,'/health.json');
    check(origin+': clean health',health.body.source_dirty===false&&
      health.body.source_revision===revision&&health.body.worker_version===version);
    await request(origin,'/schema.json');
    const full=await request(origin,'/canada.json');
    check(origin+': healthy GDP source',full.body.sources?.product?.status==='ok');
    nativeChecks(full.body.product,origin+' native GDP');
    const catalog=await request(origin,'/catalog.json?desk=canada');
    const card=catalog.body.sources?.find(item=>item.key==='product');
    check(origin+': exactly two discoverable measures',
      card?.measures?.length===2&&same(card.measures.map(item=>item.id).sort(),['level','quarter_change']));
    const selected=await request(origin,source);
    nativeChecks(selected.body.data,origin+' selected native GDP');
    check(origin+': source retains both levels and derived growth',
      selected.body.observations?.length===3&&
      same(selected.body.observations.map(row=>[row.definition?.id,row.period,row.value]),
        [['level',priorQuarter,reference.levels[0]],['level',latestQuarter,reference.levels[1]],['quarter_change',latestQuarter,0.82]]));
    const levels=await request(origin,level);
    selectedChecks(levels.body,'level',reference.quarters.map((quarter,i)=>[quarter,reference.levels[i]]),origin+' level');
    for(let i=0;i<reference.quarters.length;i++){
      const quarter=reference.quarters[i],exact=await request(origin,level+'&observation='+quarter);
      selectedChecks(exact.body,'level',[[quarter,reference.levels[i]]],origin+' exact '+quarter);
      check(origin+' exact '+quarter+': same observation version',
        exact.body.observations[0].version===levels.body.observations[i].version);
    }
    const change=await request(origin,growth);
    selectedChecks(change.body,'quarter_change',[[latestQuarter,0.82]],origin+' quarter change');
    const exactChange=await request(origin,growth+'&observation='+latestQuarter);
    selectedChecks(exactChange.body,'quarter_change',[[latestQuarter,0.82]],origin+' exact quarter change');
    check(origin+': exact growth has same observation version',
      exactChange.body.observations[0].version===change.body.observations[0].version);
    const repeat=await request(origin,level);
    selectedChecks(repeat.body,'level',reference.quarters.map((quarter,i)=>[quarter,reference.levels[i]]),origin+' repeated level');
    check(origin+': repeated level ETag present',typeof repeat.headers.etag==='string'&&repeat.headers.etag.length>0);
    await request(origin,level,{status:304,etag:repeat.headers.etag});
    const head=await request(origin,level,{method:'HEAD'});
    check(origin+': HEAD ETag matches successful GET',head.headers.etag===repeat.headers.etag);
    for(const [path,status,error] of [
      [level+'&observation=1900-Q1',404,'observation_not_retained'],
      [growth+'&observation='+priorQuarter,404,'observation_not_retained'],
      [source+'&measure=nominal_gdp',404,'unknown_measure'],
      [level+'&geography=Ontario',400,'unsupported_query'],
      [level+'&date=2026-04',400,'unsupported_query'],
      [source+'&source=price_index',400,'unsupported_query'],
    ]) await request(origin,path,{status,error});
  }
  check('complete expected request count',report.requests.length===(staged?19:38));
  report.pass=true;
}catch(error){
  report.pass=false;report.error=error.message;process.exitCode=1;
}finally{
  report.finished_at=new Date().toISOString();
  await writeFile(join(out,'gdp-interface-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({pass:report.pass,error:report.error,checks:report.checks.length,requests:report.requests.length,output:out}));
}
