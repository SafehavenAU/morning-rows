// Requires an already reviewed 0%-traffic version; this script does not upload or deploy.
// Tail is filtered to that version. Store only allowlisted numeric metadata, never raw events.
// Usage: node scripts/verify-us-version-cpu.mjs VERSION OUTPUT [10|100]
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {CPU_PATHS,PRODUCTION_ORIGINS,latestDeployment,stagingMatches,identityMatches,evaluateCpuEvidence,validateCpuBudget} from './lib/us-cpu-evidence.mjs';
import {writeFile,readFile} from 'node:fs/promises';
const version=process.argv[2],output=process.argv[3]||'/tmp/morning-rows-version-cpu.json';
if(!/^[a-f0-9-]{36}$/.test(version||''))throw Error('Exact staged version ID required');
const budgetArgument=process.argv[4];
if(process.argv.length>5||(budgetArgument!==undefined&&!/^(10|100)$/.test(budgetArgument)))throw Error('invalid_cpu_budget');
const cpuLimitMs=validateCpuBudget(budgetArgument===undefined?10:Number(budgetArgument));
const approved=JSON.parse(await readFile(new URL('../verification/monitoring-baseline.json',import.meta.url),'utf8')).identity;
const report={started_at:new Date().toISOString(),version,cpu_limit_ms:cpuLimitMs,events:[],checks:[]};
const deployment=async()=>{
 const {stdout}=await promisify(execFile)('/workspace/.morning-rows-tools/node_modules/.bin/wrangler',['deployments','list','--name','morning-rows','--json'],{cwd:new URL('..',import.meta.url),env:{...process.env,XDG_CONFIG_HOME:'/workspace/.morning-rows-tools/config',WRANGLER_LOG:'log'},timeout:30000,maxBuffer:1048576});
 return latestDeployment(JSON.parse(stdout));
};
try{report.deployment_before=await deployment();if(!stagingMatches(report.deployment_before,version,approved))throw Error('candidate_not_staged_at_zero');}
catch(e){report.error=e.message==='candidate_not_staged_at_zero'?e.message:'deployment_preflight_failed';report.budget_pass=false;await writeFile(output,JSON.stringify(report,null,2)+'\n');console.error(report.error);process.exit(1);}

const child=spawn('/workspace/.morning-rows-tools/node_modules/.bin/wrangler',['tail','morning-rows','--format','json','--version-id',version],{cwd:new URL('..',import.meta.url),env:{...process.env,XDG_CONFIG_HOME:'/workspace/.morning-rows-tools/config'},stdio:['ignore','pipe','pipe']});
let buffer='',depth=0,inString=false,escape=false,current='';
child.stdout.on('data',b=>{for(const c of b.toString()){if(depth===0){if(c!=='{')continue;current='';}current+=c;if(escape){escape=false;continue;}if(inString&&c==='\\'){escape=true;continue;}if(c==='"'){inString=!inString;continue;}if(!inString){if(c==='{')depth++;if(c==='}')depth--;if(depth===0){try{const d=JSON.parse(current);let requestPath=null;try{const u=new URL(d.event?.request?.url);if(u.origin==='https://morningrows.com'&&['/health.json','/united-states.json','/catalog.v2.json'].includes(u.pathname)&&[...u.searchParams.keys()].every(k=>['source','measure'].includes(k)))requestPath=u.pathname+u.search;}catch{}report.events.push({request_path:requestPath,outcome:d.outcome,cpu_ms:d.cpuTime,wall_ms:d.wallTime,event_timestamp:d.eventTimestamp,script_version:d.scriptVersion,exception_names:d.exceptions?.map(e=>e.name),keys:Object.keys(d)});}catch{}current='';}}}});
child.stderr.on('data',b=>{if(b.toString().includes('[ERROR]'))report.tail_command_error=true;});
const read=(path,override=true,origin='https://morningrows.com',phase=null)=>new Promise((ok,fail)=>{const started_at=new Date().toISOString();const c=spawn('curl',['-sS','--max-time','60','-i',...(override?['-H',`Cloudflare-Workers-Version-Overrides: morning-rows="${version}"`]:[]),origin+path],{stdio:['ignore','pipe','ignore']});let text='';c.stdout.on('data',b=>{text+=b;if(text.length>2000000)c.kill();});c.on('close',code=>{if(code)return fail(Error('request_failed'));const headers={};let status;while(text.startsWith('HTTP/')){const at=text.indexOf('\r\n\r\n');if(at<0)break;const block=text.slice(0,at);status=Number(block.split(' ')[1]);for(const line of block.split('\r\n').slice(1)){const i=line.indexOf(':');const key=line.slice(0,i).toLowerCase();if(['x-worker-version','x-source-revision','x-source-dirty','x-build-fingerprint','etag','cache-control'].includes(key))headers[key]=line.slice(i+1).trim();}text=text.slice(at+4);}let body;try{body=JSON.parse(text)}catch{body={error_excerpt:text.includes('1102')?'Cloudflare 1102':text.slice(0,150)}}ok({path,override,origin,phase,status,headers,body,started_at,at:new Date().toISOString()});});});
try{for(const origin of PRODUCTION_ORIGINS)report.checks.push(await read('/health.json',false,origin,'before'));if(!report.checks.every(c=>identityMatches(c,approved)))throw Error('production_preflight_identity_mismatch');await new Promise(r=>setTimeout(r,4000));for(const p of CPU_PATHS){const d=await read(p);report.checks.push(d);if(p==='/health.json'){const until=Date.now()+10000;while(!report.events.some(e=>e.request_path===p)&&Date.now()<until)await new Promise(r=>setTimeout(r,250));if(!report.events.some(e=>e.request_path===p))throw Error('tail_not_ready');}console.log(JSON.stringify({path:p,status:d.status,version:d.headers['x-worker-version'],source_status:d.body.sources?.cpi?.status,error:d.body.error_excerpt}));}const until=Date.now()+12000;while(report.events.length<4&&Date.now()<until)await new Promise(r=>setTimeout(r,250));}catch(e){report.error=e.message;}finally{
 child.kill('SIGINT');
 try{for(const origin of PRODUCTION_ORIGINS)report.checks.push(await read('/health.json',false,origin,'after'));report.deployment_after=await deployment();}
 catch{report.error ||= 'production_postflight_failed';}
 report.finished_at=new Date().toISOString();Object.assign(report,evaluateCpuEvidence(report,approved,cpuLimitMs));
 await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cpu_limit_ms:report.cpu_limit_ms,complete_event_coverage:report.complete_event_coverage,cold_retrieval_confirmed:report.cold_retrieval_confirmed,production_identity_confirmed:report.production_identity_confirmed,deployment_unchanged:report.deployment_unchanged,budget_pass:report.budget_pass}));
 if(!report.budget_pass)process.exitCode=1;
}
