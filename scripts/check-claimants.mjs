// Read-only public/candidate interface checks. Run after the cold CPU capture.
// Usage: node scripts/check-claimants.mjs OUTPUT REVISION VERSION [staged]
// CLAIMANT_REFERENCE optionally selects a separately verified reference JSON.
// Validate only, with no output directory or requests:
//   CLAIMANT_REFERENCE=PATH node scripts/check-claimants.mjs --validate-reference
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const [directory,revision,version,mode]=process.argv.slice(2);
const validationOnly=process.argv.length===3&&directory==='--validate-reference';
if(!validationOnly&&(!directory||!/^[a-f0-9]{40}$/.test(revision||'')||!/^[a-f0-9-]{36}$/.test(version||'')||(mode!==undefined&&mode!=='staged')||process.argv.length>6))throw Error('OUTPUT REVISION VERSION [staged] required');
const out=resolve(directory),run=promisify(execFile),staged=mode==='staged';
const configuredReference=process.env.CLAIMANT_REFERENCE;
if(configuredReference!==undefined&&!configuredReference.trim())throw Error('CLAIMANT_REFERENCE must name a nonempty file path');
const referencePath=configuredReference===undefined
 ?fileURLToPath(new URL('../verification/claimant-count-2026-10-20/independent-report.json',import.meta.url))
 :resolve(configuredReference);
const referenceBytes=await readFile(referencePath),reference=JSON.parse(referenceBytes);
const requireReference=(condition,message)=>{if(!condition)throw Error('Invalid claimant reference: '+message);};
const referenceGeographies={K02000001:'United Kingdom',E92000001:'England',S92000003:'Scotland',W92000004:'Wales',N92000002:'Northern Ireland'};
requireReference(reference?.pass===true&&reference.observations_compared===65,'must pass all 65 independent cells');
requireReference(/^\d{4}-(0[1-9]|1[0-2])$/.test(reference.period_end||''),'invalid latest month');
const [latestYear,latestMonth]=reference.period_end.split('-').map(Number),latest=latestYear*12+latestMonth-1;
const referencePeriods=Array.from({length:13},(_,i)=>{const month=latest-12+i;return `${Math.floor(month/12)}-${String(month%12+1).padStart(2,'0')}`;});
requireReference(reference.period_start===referencePeriods[0],'start/end must span thirteen consecutive months');
requireReference(Array.isArray(reference.history)&&reference.history.length===5
 &&new Set(reference.history.map(h=>h?.geography_code)).size===5,'five unique national histories required');
for(const history of reference.history){
 requireReference(Object.hasOwn(referenceGeographies,history?.geography_code)&&history.geography===referenceGeographies[history.geography_code],'wrong national geography');
 requireReference(Array.isArray(history.observations)&&history.observations.length===13
  &&history.observations.every((row,i)=>row?.period===referencePeriods[i]&&Number.isSafeInteger(row.count)&&row.count>=0&&row.count%5===0&&row.obs_status==='A'&&row.obs_conf==='F'),'invalid, missing or nonconsecutive national cells');
}
requireReference(Array.isArray(reference.period_metadata)&&reference.period_metadata.length===13
 &&new Set(reference.period_metadata.map(p=>p?.period)).size===13
 &&referencePeriods.every(period=>reference.period_metadata.some(p=>p.period===period)),'period metadata must cover the same thirteen months');
const referenceEvidence={file:referencePath,bytes:referenceBytes.length,sha256:createHash('sha256').update(referenceBytes).digest('hex'),period_start:reference.period_start,period_end:reference.period_end,observations_compared:65};
if(validationOnly){console.log(JSON.stringify({pass:true,reference:referenceEvidence,network_requests:0}));process.exit(0);}
const desks=['united-kingdom','england','scotland','wales','northern-ireland'];
const report={started_at:new Date().toISOString(),kind:staged?'Exact zero-percent candidate interface':'Production interface',revision,version,reference:referenceEvidence,requests:[],checks:[]};
const check=(label,pass)=>{report.checks.push({label,pass:Boolean(pass)});if(!pass)throw Error(label);};
// A new directory is required. Preserve every earlier capture, including failures.
await mkdir(out);
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
 if(method==='GET'&&!etag){await writeFile(join(out,file),text,{flag:'wx'});record.file=file;}
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
finally{report.finished_at=new Date().toISOString();await writeFile(join(out,'claimant-interface-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:report.pass,error:report.error,checks:report.checks.length,requests:report.requests.length,output:out}));}
