// Read-only public/candidate interface checks. Run after the cold CPU capture.
// Usage: node scripts/check-claimants.mjs OUTPUT REVISION VERSION [staged]
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [directory,revision,version,mode]=process.argv.slice(2);
if(!directory||!/^[a-f0-9]{40}$/.test(revision||'')||!/^[a-f0-9-]{36}$/.test(version||'')||(mode!==undefined&&mode!=='staged'))throw Error('OUTPUT REVISION VERSION [staged] required');
const out=resolve(directory),run=promisify(execFile),staged=mode==='staged';
const reference=JSON.parse(await readFile(new URL('../verification/claimant-count-2026-10-20/independent-report.json',import.meta.url)));
const desks=['united-kingdom','england','scotland','wales','northern-ireland'];
const report={started_at:new Date().toISOString(),kind:staged?'Exact zero-percent candidate interface':'Production interface',revision,version,requests:[],checks:[]};
const check=(label,pass)=>{report.checks.push({label,pass:Boolean(pass)});if(!pass)throw Error(label);};
await mkdir(out,{recursive:true});
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
 const file=(staged?path.replaceAll('/','_')+'.response':(origin.includes('www.')?'www':'apex')+'-'+encodeURIComponent(path)+'.body');
 const record={origin,path,method,conditional:Boolean(etag),started_at,completed_at:new Date().toISOString(),status:actual,expected_status:status,headers,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};
 report.requests.push(record);
 if(method==='GET'&&!etag){await writeFile(join(out,file),text);record.file=file;}
 check('status '+path+' '+method,actual===status);
 check('identity '+path,headers['x-source-revision']===revision&&headers['x-worker-version']===version);
 if(status===304||method==='HEAD'){check('empty body '+path,text.length===0);return {headers};}
 const body=JSON.parse(text);
 if(status===200&&path.includes('source=')){const ttl=headers['cache-control']?.match(/max-age=(\d+)/)?.[1];check('bounded cache '+path,ttl!==undefined&&Number(ttl)<=600);}
 return {body,headers};
}
try{
 for(const origin of staged?['https://morningrows.com']:['https://morningrows.com','https://www.morningrows.com']){
  const health=await request(origin,'/health.json');check('clean health '+origin,health.body.source_dirty===false&&health.body.source_revision===revision&&health.body.worker_version===version);
  for(const desk of desks){
   const full=await request(origin,`/${desk}.json`);
   check(desk+' healthy native history',full.body.sources?.claimant_count?.status==='ok'&&full.body.claimant_count?.rows?.length===13);
   const catalog=await request(origin,`/catalog.json?desk=${desk}`);
   check(desk+' discoverable measure',catalog.body.sources?.find(s=>s.id?.includes('claimant_count')||s.key==='claimant_count')?.measures?.some(m=>m.id==='claimants'));
   const source=`/${desk}.json?source=claimant_count`,path=source+'&measure=claimants';
   const sourceBody=await request(origin,source),selected=await request(origin,path);
   for(const result of [sourceBody,selected])check(desk+' thirteen observation identities',result.body.observations?.length===13&&new Set(result.body.observations.map(o=>o.id)).size===13);
   check(desk+' measure retains rows',Array.isArray(selected.body.data)&&selected.body.data.length===13);
   for(const period of [reference.period_start,reference.period_end]){
    const exact=await request(origin,path+'&observation='+period);
    check(desk+' exact month '+period,exact.body.observations?.length===1&&exact.body.observations[0].period===period&&exact.body.data.period===period);
   }
   await request(origin,path,{status:304,etag:selected.headers.etag});
   const head=await request(origin,path,{method:'HEAD'});check(desk+' HEAD ETag',head.headers.etag===selected.headers.etag);
   await request(origin,path+'&observation=1900-01',{status:404});
   await request(origin,path+'&geography=London',{status:400});
   await request(origin,path+'&date='+reference.period_end,{status:400});
  }
 }
 report.pass=true;
}catch(error){report.pass=false;report.error=error.message;process.exitCode=1;}
finally{report.finished_at=new Date().toISOString();await writeFile(join(out,'claimant-interface-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,error:report.error,checks:report.checks.length,requests:report.requests.length,output:out}));}
