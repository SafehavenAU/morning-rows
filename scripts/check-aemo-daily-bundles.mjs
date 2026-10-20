// Actual interface capture only. No publisher substitutions, runtime parsers or
// fixture fallback. Run only after the exact candidate has been frozen.
// node scripts/check-aemo-daily-bundles.mjs OUTPUT REVISION VERSION [staged]
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha,references,routes,bodyChecks,cacheChecks} from '../verification/gap-followup-2026-10-20/aemo-daily/interface-checker/support.mjs';
const [directory,revision,version,mode,...extra]=process.argv.slice(2);
if(!directory||!/^[a-f0-9]{40}$/.test(revision||'')||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(version||'')||extra.length||(mode!==undefined&&mode!=='staged'))throw Error('OUTPUT REVISION VERSION [staged] required');
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(directory),staged=mode==='staged',run=promisify(execFile);
const {refs,manifest}=await references(root);
await mkdir(out);
const report={kind:staged?'Exact zero-percent candidate AEMO completed fixed-AEST daily interface':'Production AEMO completed fixed-AEST daily interface',started_at:new Date().toISOString(),revision,version,staged,references:manifest,requests:[],attempts:[],checks:[]};
const check=(label,pass)=>{report.checks.push({label,pass:Boolean(pass)});if(!pass)throw Error(label);};
const etags=new Map(),versions=new Map();
try{
 for(const origin of staged?['https://morningrows.com']:['https://morningrows.com','https://www.morningrows.com']){
  for(const want of routes()){
   const {path,method,status,error,conditional}=want,key=origin+path,etag=conditional?etags.get(key):undefined;
   if(conditional&&!etag)throw Error('Conditional capture requires actual preceding successful GET ETag');
   const started_at=new Date().toISOString();
   report.attempts.push({origin,path,method,conditional,started_at});
   const {stdout}=await run('curl',['--silent','--show-error','--proto','=https','--max-time','90','--include',
    ...(method==='HEAD'?['--head']:[]),
    ...(staged?['-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${version}"`]:[]),
    ...(etag?['-H','If-None-Match: '+etag]:[]),origin+path],{encoding:'buffer',maxBuffer:4*1024*1024});
   let payload=stdout,actual,headers={};
   while(payload.subarray(0,5).toString()==='HTTP/'){
    const end=payload.indexOf('\r\n\r\n');if(end<0)throw Error('Invalid response headers');
    const lines=payload.subarray(0,end).toString().split('\r\n');actual=Number(lines[0].split(' ')[1]);headers={};
    for(const line of lines.slice(1)){
     const at=line.indexOf(':');if(at<1)continue;const name=line.slice(0,at).toLowerCase();
     if(['etag','cache-control','content-type','content-location','x-source-revision','x-worker-version','x-retrieved-at','link'].includes(name))headers[name]=line.slice(at+1).trim();
    }
    payload=payload.subarray(end+4);
   }
   const record={origin,path,method,conditional,...(etag?{request_etag:etag}:{}),started_at,completed_at:new Date().toISOString(),status:actual,expected_status:status,...(error?{expected_error:error}:{}),headers,bytes:payload.length,sha256:sha(payload)};
   report.requests.push(record);
   if(method==='GET'&&!conditional){record.file=String(report.requests.length).padStart(3,'0')+'.body';await writeFile(join(out,record.file),payload,{flag:'wx'});}
   check(key+' status',actual===status);
   check(key+' exact source/Worker identity',headers['x-source-revision']===revision&&headers['x-worker-version']===version);
   if(method==='HEAD'||conditional){
    check(key+' empty HEAD/304',payload.length===0);
    check(key+' unchanged actual GET ETag',Boolean(etags.get(key))&&headers.etag===etags.get(key));
    cacheChecks(record,check);
    continue;
   }
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(payload));
   check(key+' JSON media type',/^application\/json(?:;|$)/i.test(headers['content-type']||''));
   if(error){check(key+' explicit refusal',body.error===error||body.reason===error);check(key+' no substituted observations',!body.observations?.length&&(body.data===null||body.data===undefined));continue;}
   if(path==='/health.json')check(key+' clean health',body.source_dirty===false&&body.source_revision===revision&&body.worker_version===version);
   cacheChecks(record,check);bodyChecks(refs,path,body,check,versions,record);
   if(headers.etag)etags.set(key,headers.etag);
  }
 }
 check('complete bounded route count',report.requests.length===routes().length*(staged?1:2));
 report.pass=true;
}catch(error){report.pass=false;report.error=error.message;process.exitCode=1;}
finally{
 report.finished_at=new Date().toISOString();
 await writeFile(join(out,'aemo-daily-interface-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:report.pass,error:report.error,requests:report.requests.length,checks:report.checks.length,output:out}));
}
