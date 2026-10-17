import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
const run = promisify(execFile);
const base = process.env.SITE_URL || 'https://morningrows.com';
const expected = process.env.EXPECTED_REVISION;
async function read(path, origin = base) {
 const { stdout } = await run('curl', ['--silent','--show-error','--max-time','90','--write-out','\n%{http_code}',new URL(path,origin).href], { maxBuffer: 2 * 1024 * 1024 });
 const at=stdout.lastIndexOf('\n');return {status:Number(stdout.slice(at+1)),text:stdout.slice(0,at)};
}
if (expected) {
 let matched=false;
 for (let attempt=0;attempt<30;attempt++) {
  try { const r=await read('/health.json'); matched=r.status===200 && JSON.parse(r.text).source_revision===expected && JSON.parse(r.text).source_dirty===false; } catch {}
  if(matched)break;
  if(attempt<29)await new Promise(resolve=>setTimeout(resolve,20000));
 }
 if(!matched)throw Error('Expected source revision has not reached production; check Workers Builds');
}
const desks=['australia','new-zealand','canada','united-kingdom','england','scotland','wales','northern-ireland'];
const report={checked_at:new Date().toISOString(),base,checks:[],degraded:[]};
let failed=false;
function problems(value,path='') {
 if(!value||typeof value!=='object')return [];
 if(value.error)return [{path,error:value.error,http_status:value.http_status}];
 return Object.entries(value).flatMap(([k,v])=>problems(v,path?`${path}.${k}`:k));
}
for(const path of ['/health.json','/llms.txt','/catalog.json','/keys.json',...desks.map(d=>`/${d}.json`),'/morning.json','/missing-route-check']) {
 try {
  const r=await read(path);const wanted=path==='/missing-route-check'?404:200;
  if(r.status!==wanted)throw Error(`HTTP ${r.status}; expected ${wanted}`);
  if(path.endsWith('.json')) {
   const d=JSON.parse(r.text);
   if(path==='/health.json') {
    if(!/^[0-9a-f]{40}$/.test(d.source_revision || '') || typeof d.source_dirty!=='boolean' || !d.worker_version)throw Error('Release identity missing');
    report.identity={source_revision:d.source_revision,source_dirty:d.source_dirty,worker_version:d.worker_version,build_fingerprint:d.build_fingerprint};
   }
   if(path==='/catalog.json'&&d.countries?.length!==8)throw Error('Eight desks missing from catalogue');
   if(desks.some(name=>path===`/${name}.json`)||path==='/morning.json') {
    if(d.error||!d.country||!d.sources)throw Error('Desk contract or whole-desk failure');
    const good=Object.values(d.sources).filter(s=>s.status==='ok').length;
    if(!good)throw Error('No successful sources on desk');
    report.degraded.push(...problems(d).map(issue=>({desk:path,...issue})));
   }
   if(path==='/new-zealand.json') {
    const rows=d.stats?.rows||[];
    if(!d.stats?.present||rows.length!==23||rows.some(row=>row.status!=='ok'||!row.period||!Number.isFinite(row.value)||!row.geography||!row.unit))throw Error('Stats NZ requires 23 valid, described observations');
   }
  }
  report.checks.push({path,status:'pass'});
 } catch(e){failed=true;report.checks.push({path,status:'fail',error:e.message});}
}
if(base==='https://morningrows.com') {
 let ok=false;try {
  const r=await read('/health.json','https://www.morningrows.com'); const d=JSON.parse(r.text);
  ok=r.status===200&&d.worker_version===report.identity?.worker_version&&d.source_revision===report.identity?.source_revision&&(!expected||d.source_revision===expected && d.source_dirty===false);
 }catch{}
 report.checks.push({path:'www health',status:ok?'pass':'fail'});if(!ok)failed=true;
}
await writeFile(process.env.REPORT_PATH||'smoke-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.env.STRICT_SOURCES==='1'&&report.degraded.length)failed=true;
process.exitCode=failed?1:0;
