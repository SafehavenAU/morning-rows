// Capture the real versioned Worker. Numerical/schema reconciliation is a
// separate Python check against independently extracted official presentations.
// node scripts/check-market-rent.mjs OUTPUT REVISION VERSION [staged]
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [directory,revision,version,mode]=process.argv.slice(2);
if(!directory||!/^[a-f0-9]{40}$/.test(revision||'')||!/^[a-f0-9-]{36}$/.test(version||'')||(mode!==undefined&&mode!=='staged'))throw Error('OUTPUT REVISION VERSION [staged] required');
const out=resolve(directory),run=promisify(execFile),staged=mode==='staged';
// A new directory is mandatory: failed captures cannot be overwritten by retry.
await mkdir(out);
const report={started_at:new Date().toISOString(),kind:staged?'Exact zero-percent candidate interface':'Production interface',revision,version,requests:[],checks:[]};
const check=(label,pass)=>{report.checks.push({label,pass:Boolean(pass)});if(!pass)throw Error(label);};
async function request(origin,path,{status=200,method='GET',etag}={}){
 const started_at=new Date().toISOString();
 const {stdout}=await run('curl',['--silent','--show-error','--proto','=https','--max-time','90','--include',...(method==='HEAD'?['--head']:[]),...(staged?['-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${version}"`]:[]),...(etag?['-H','If-None-Match: '+etag]:[]),origin+path],{maxBuffer:2097152});
 let text=stdout,actual,headers={};
 while(text.startsWith('HTTP/')){
  const i=text.indexOf('\r\n\r\n');if(i<0)throw Error('invalid_headers');
  const lines=text.slice(0,i).split('\r\n');actual=Number(lines[0].split(' ')[1]);headers={};
  for(const line of lines.slice(1)){const n=line.indexOf(':'),key=line.slice(0,n).toLowerCase();if(['etag','cache-control','content-type','content-location','x-source-revision','x-worker-version','x-retrieved-at','link'].includes(key))headers[key]=line.slice(n+1).trim();}
  text=text.slice(i+4);
 }
 const record={origin,path,method,conditional:Boolean(etag),started_at,completed_at:new Date().toISOString(),status:actual,expected_status:status,headers,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};
 report.requests.push(record);
 if(method==='GET'&&!etag){record.file=String(report.requests.length).padStart(3,'0')+'.body';await writeFile(join(out,record.file),text,{flag:'wx'});}
 check('status '+path+' '+method,actual===status);
 check('identity '+path,headers['x-source-revision']===revision&&headers['x-worker-version']===version);
 if(status===304||method==='HEAD'){check('empty body '+path,text.length===0);return {headers};}
 const body=JSON.parse(text);
 if(status===200&&path.includes('source=')){const ttl=headers['cache-control']?.match(/max-age=(\d+)/)?.[1];check('bounded cache '+path,ttl!==undefined&&Number(ttl)<=120);}
 return {body,headers};
}
const source='/new-zealand.json?source=market_rent';
try{
 for(const origin of staged?['https://morningrows.com']:['https://morningrows.com','https://www.morningrows.com']){
  const health=await request(origin,'/health.json');
  check('clean health '+origin,health.body.source_dirty===false&&health.body.source_revision===revision&&health.body.worker_version===version);
  await request(origin,'/schema.json');
  const full=await request(origin,'/new-zealand.json'),native=full.body.market_rent;
  check('two healthy supported places',full.body.sources?.market_rent?.status==='ok'&&native?.locations?.length===2&&native.locations.every(x=>x.status==='ok'));
  check('reported native rows only',native.rows.length===29&&new Set(native.rows.map(r=>`${r.location_id}.${r.dwelling_key}.${r.bedroom_key}`)).size===29);
  const catalog=await request(origin,'/catalog.json?desk=new-zealand');
  const card=catalog.body.sources?.find(s=>s.key==='market_rent');
  check('finite discoverable selectors',card?.measures?.length===200&&new Set(card.measures.map(m=>m.id)).size===200);
  const selected=await request(origin,source);
  check('116 reported observations',selected.body.observations?.length===116&&new Set(selected.body.observations.map(o=>o.id)).size===116);
  for(const location of ['nz-auckland-avondale','nz-wellington-kelburn']){
   for(const statistic of ['lower_quartile','median','upper_quartile','active_bonds']){
    const id=`${location}.apartment.2.${statistic}`,path=source+'&measure='+id;
    const measure=await request(origin,path),expected=selected.body.observations.find(o=>o.definition?.id===id);
    check('one exact selected statistic '+id,Boolean(expected)&&measure.body.observations?.length===1&&measure.body.observations[0].value===expected.value&&measure.body.observations[0].period===expected.period);
    const exact=await request(origin,path+'&observation='+encodeURIComponent(expected.period));
    check('exact six-month period '+id,exact.body.observations?.length===1&&exact.body.observations[0].id===expected.id&&exact.body.observations[0].version===expected.version);
   }
  }
  const five=await request(origin,source+'&measure=nz-wellington-kelburn.house.5-plus.median');
  check('five or more category preserved',five.body.observations?.[0]?.definition?.dimensions?.bedroom_key==='5-plus'||five.body.data?.bedroom_key==='5-plus');
  const example=source+'&measure=nz-auckland-avondale.apartment.2.median';
  const repeat=await request(origin,example);
  await request(origin,example,{status:304,etag:repeat.headers.etag});
  const head=await request(origin,example,{method:'HEAD'});
  check('HEAD ETag matches',head.headers.etag===repeat.headers.etag);
  for(const [path,status,error]of [
   [source+'&measure=nz-auckland-avondale.apartment.4.median',404,'not_reported'],
   [source+'&measure=nz-christchurch-avondale.apartment.2.median',404,'unknown_measure'],
   [example+'&observation=1900-01-01%2F1900-06-30',404,'observation_not_retained'],
   [example+'&geography=Christchurch',400,'unsupported_query'],
   [example+'&date=2026-08',400,'unsupported_query'],
   [source+'&source=prices',400,'unsupported_query'],
  ]){
   const refused=await request(origin,path,{status});
   check('explicit refusal '+path,refused.body.error===error||refused.body.reason===error);
  }
 }
 report.pass=true;
}catch(error){report.pass=false;report.error=error.message;process.exitCode=1;}
finally{
 report.finished_at=new Date().toISOString();
 await writeFile(join(out,'rent-interface-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:report.pass,error:report.error,checks:report.checks.length,requests:report.requests.length,output:out}));
}
