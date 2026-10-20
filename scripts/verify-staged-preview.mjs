// Actual 0%-version preview, combining previously captured full desks with new
// discovery/selector checks. No network occurs until this script is explicitly run.
// Usage: node scripts/verify-staged-preview.mjs CPU_REPORT LEGACY_REPORT CAPTURE_DIR VERSION REVISION
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {latestDeployment,stagingMatches,identityMatches} from './lib/us-cpu-evidence.mjs';
const [cpuFile,legacyFile,outArg,version,revision]=process.argv.slice(2);
if(process.argv.length!==7||!/^[a-f0-9-]{36}$/.test(version||'')||!/^[a-f0-9]{40}$/.test(revision||''))throw Error('Usage: CPU_REPORT LEGACY_REPORT CAPTURE_DIR VERSION REVISION');
const out=resolve(outArg),repo=fileURLToPath(new URL('..',import.meta.url)),origin='https://morningrows.com',savedPaths=new Set();
const sha=x=>createHash('sha256').update(x).digest('hex');
const report={started_at:new Date().toISOString(),kind:'Actual zero-percent version preview using retained same-version full-desk CPU responses',version,source_revision:revision,inputs:[],imported:[],requests:[],checks:[],limitations:['Imported JSON bodies are reserialized from retained report objects; their file hashes identify that serialization, not original HTTP wire bytes. Source-report hashes and request metadata retain provenance.','Full desks are reused to avoid repeating the nine-desk publisher sweep. Additional selector reads may use the same version cache.','CPU acceptance and semantic validation are separate; run verify-preview-bodies.mjs after this capture.']};
const check=(name,pass,detail)=>{report.checks.push({name,pass:Boolean(pass),...(detail?{detail}:{})});if(!pass)throw Error(name);};
const fileFor=path=>join(out,path.replaceAll('/','_')+'.response');
const approved=JSON.parse(await readFile(repo+'/verification/monitoring-baseline.json','utf8')).identity;
const deployments=async()=>{try{const {stdout}=await promisify(execFile)('/workspace/.morning-rows-tools/node_modules/.bin/wrangler',['deployments','list','--name','morning-rows','--json'],{cwd:repo,env:{...process.env,XDG_CONFIG_HOME:'/workspace/.morning-rows-tools/config',WRANGLER_LOG:'log'},timeout:30000,maxBuffer:1048576});return latestDeployment(JSON.parse(stdout));}catch{throw Error('deployment_metadata_read_failed');}};
const matches=r=>r.headers?.['x-worker-version']===version&&r.headers?.['x-source-revision']===revision&&(r.headers?.['x-source-dirty']===undefined||r.headers['x-source-dirty']==='false');
const load=async(file,label)=>{const text=await readFile(file),d=JSON.parse(text);report.inputs.push({label,path:resolve(file),sha256:sha(text)});check(label+' accepted capture',d.budget_pass===true&&d.version===version&&d.candidate_identity_confirmed===true&&d.production_identity_confirmed===true&&d.deployment_unchanged===true);return d;};
const take=(d,path)=>{const rows=d.checks.filter(c=>c.override&&c.path===path);check('unique imported '+path,rows.length===1);const r=rows[0];check('import identity/status '+path,r.status===200&&matches(r)&&r.body&&typeof r.body==='object');return r;};
let sequence=0;
const request=(path,{method='GET',etag}={})=>new Promise((ok,fail)=>{
 const started_at=new Date().toISOString();
 const child=spawn('curl',['--silent','--show-error','--max-time','90','--proto','=https','--include',...(method==='HEAD'?['--head']:[]),'-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${version}"`,...(etag?['-H','If-None-Match: '+etag]:[]),origin+path],{stdio:['ignore','pipe','ignore']});
 let text='',size=0,overflow=false;child.stdout.on('data',b=>{size+=b.length;if(size>2097152){overflow=true;child.kill();}else text+=b.toString();});child.on('error',()=>fail(Error('curl_start_failed')));
 child.on('close',code=>{if(code||overflow)return fail(Error(overflow?'response_too_large':'curl_failed'));let headers={},status;while(text.startsWith('HTTP/')){const end=text.indexOf('\r\n\r\n');if(end<0)return fail(Error('invalid_headers'));const lines=text.slice(0,end).split('\r\n');status=Number(lines[0].split(' ')[1]);headers={};for(const line of lines.slice(1)){const i=line.indexOf(':');if(i<0)continue;const k=line.slice(0,i).toLowerCase();if(['x-worker-version','x-source-revision','x-source-dirty','x-build-fingerprint','etag','cache-control','content-type','content-location','x-retrieved-at','link'].includes(k))headers[k]=line.slice(i+1).trim();}text=text.slice(end+4);}let body=null,json_valid=false;try{body=JSON.parse(text);json_valid=true;}catch{}ok({path,origin,method,conditional:Boolean(etag),status,headers,body,json_valid,text,started_at,at:new Date().toISOString()});});
});
const run=async(path,expected=200,options={})=>{
 const r=await request(path,options),record={...r,sequence:++sequence,bytes:Buffer.byteLength(r.text),sha256:sha(r.text)};delete record.text;delete record.body;report.requests.push(record);
 if(r.text&&r.method==='GET'&&!r.conditional){record.file='.requests/'+sequence+'.response';await writeFile(join(out,record.file),r.text);if(!savedPaths.has(path)){await writeFile(fileFor(path),r.text);savedPaths.add(path);record.semantic_capture_file=path.replaceAll('/','_')+'.response';}}
 check('exact response identity '+sequence,matches(r));check('response status '+sequence,r.status===expected,{path,expected,observed:r.status});
 if(expected===304||r.method==='HEAD')check('empty body '+sequence,r.text.length===0);else check('JSON body '+sequence,r.json_valid);
 if(expected===200&&path.includes('?source=')){const max=path.startsWith('/canada')||path.startsWith('/united-states')?3600:path.startsWith('/new-zealand')?120:path.startsWith('/australia')?300:600;const ttl=r.headers['cache-control']?.match(/(?:^|[ ,])max-age=(\d+)/)?.[1];check('bounded TTL '+sequence,ttl!==undefined&&Number(ttl)<=max);}
 return r;
};
try{
 await mkdir(join(out,'.requests'),{recursive:true});
 const cpu=await load(cpuFile,'USA CPU'),legacy=await load(legacyFile,'Legacy CPU');
 const health=take(cpu,'/health.json'),legacyHealth=take(legacy,'/health.json');
 const identity={...health.body,worker_version:version,source_revision:revision};
 check('matching clean health identities',identityMatches(health,identity)&&identityMatches(legacyHealth,identity)&&/^[a-f0-9]{16}$/.test(identity.build_fingerprint||''));report.identity=identity;
 report.deployment_before=await deployments();check('candidate remains at zero',stagingMatches(report.deployment_before,version,approved));
 const imported=[...['/health.json','/united-states.json','/united-states.json?source=cpi&measure=CUUR0000SA0'].map(path=>({source:'USA CPU',row:take(cpu,path)})),...['australia','new-zealand','canada','united-kingdom','england','scotland','wales','northern-ireland'].map(desk=>({source:'Legacy CPU',row:take(legacy,'/'+desk+'.json')}))];
 for(const {source,row}of imported){const text=JSON.stringify(row.body,null,2)+'\n';await writeFile(fileFor(row.path),text);savedPaths.add(row.path);report.imported.push({source,path:row.path,status:row.status,headers:row.headers,started_at:row.started_at,at:row.at,bytes:Buffer.byteLength(text),sha256:sha(text),file:row.path.replaceAll('/','_')+'.response'});}
 for(const path of ['/catalog.json','/schema.json','/catalog.v2.json','/schema.v2.json','/catalog.json?desk=canada','/catalog.v2.json?desk=united-states'])await run(path);
 const selections=[['/canada.json?source=exchange&measure=FXUSDCAD',true],['/wales.json?source=projection&measure=population-2024-based',true],['/new-zealand.json?source=stats&measure=CORR_FIS_005',false],['/australia.json?source=hospital&measure=WA.MYH-RM0037',false],['/northern-ireland.json?source=childhood_bmi&measure=Y8BMIOwOb',false],['/scotland.json?source=company_insolvencies&measure=total-company-insolvencies',false],['/england.json?source=pharmacies&measure=total',false]];
 for(const [path,conditional]of selections){const r=await run(path);check('one described finite observation '+path,r.body.observations?.length===1&&Number.isFinite(r.body.observations[0].value)&&r.body.observations[0].definition?.unit&&r.body.observations[0].definition?.geography&&r.body.observations[0].period);if(conditional){check('ETag available '+path,Boolean(r.headers.etag));await run(path,304,{etag:r.headers.etag});}}
 await run('/canada.json?date=2026-10-12',400);await run('/canada.json?source=exchange&measure=FXUSDCAD&observation=2026-10-12',404);
 const usPath='/united-states.json?source=cpi&measure=CUUR0000SA0',us=await run(usPath);
 check('USA thirteen exact slots',us.body.observations?.length===13&&new Set(us.body.observations.map(o=>o.period)).size===13);check('USA ETag available',Boolean(us.headers.etag));
 await run(usPath,304,{etag:us.headers.etag});const head=await run(usPath,200,{method:'HEAD'});check('USA HEAD ETag',head.headers.etag===us.headers.etag);
 const latest=take(cpu,'/united-states.json').body.cpi.latest_period;
 for(const month of [...new Set([latest,...us.body.observations.filter(o=>o.value_state!=='observed').map(o=>o.period)])]){const r=await run(usPath+'&observation='+encodeURIComponent(month));const expected=us.body.observations.find(o=>o.period===month);check('USA exact month '+month,r.body.observations?.length===1&&r.body.observations[0].period===month&&r.body.observations[0].value===expected?.value&&r.body.observations[0].value_state===expected?.value_state);}
 await run('/united-states.json?geography=California',400);await run(usPath+'&observation=1900-01',404);await run('/catalog.json?desk=united-states',404);
 const currentHealth=await run('/health.json');check('final same clean identity',identityMatches(currentHealth,identity));
 report.deployment_after=await deployments();check('staging unchanged',report.deployment_after.id===report.deployment_before.id&&stagingMatches(report.deployment_after,version,approved));
}catch(error){report.error=error.message;}
finally{report.finished_at=new Date().toISOString();report.pass=!report.error&&report.checks.length>0&&report.checks.every(c=>c.pass);await mkdir(out,{recursive:true});await writeFile(join(out,'staged-preview-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,error:report.error,version,revision,imported:report.imported.length,requests:report.requests.length,checks:report.checks.length,output:join(out,'staged-preview-report.json')},null,2));if(!report.pass)process.exitCode=1;}
