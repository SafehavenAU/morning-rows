// Read-only public audit. Run from repository root; no credentials or remote writes.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {INVENTORY} from '../../lib/inventory.js';
import {STATS_NZ_SERIES} from '../../lib/stats-nz-series.js';
const run=promisify(execFile), root=new URL('./',import.meta.url);
const at=(v,p)=>p.split('.').reduce((o,k)=>o?.[k],v);
const baseline=JSON.parse(await readFile(new URL('../../verification/monitoring-baseline.json',import.meta.url)));
const reference=JSON.parse(await readFile(new URL('../../verification/structure-2026-10-17/publisher-reference.json',import.meta.url)));
const snapshot={started_at:new Date().toISOString(),kind:'live read-only audit; not a scheduled monitor',requests:[],domains:{},registry:[],changes:[]};
async function get(origin,path){
 const url=new URL(path,origin).href,start=Date.now();
 try {
  const {stdout}=await run('curl',['--silent','--show-error','--max-time','65','--dump-header','-','--write-out','\n%{http_code}',url],{maxBuffer:4*1024*1024});
  const end=stdout.lastIndexOf('\n'),status=Number(stdout.slice(end+1));
  let rest=stdout.slice(0,end), headers={};
  while(rest.startsWith('HTTP/')){const n=rest.indexOf('\r\n\r\n');if(n<0)break; for(const line of rest.slice(0,n).split('\r\n').slice(1)){const a=line.indexOf(':');if(a>0)headers[line.slice(0,a).toLowerCase()]=line.slice(a+1).trim();}rest=rest.slice(n+4);}
  const selected=Object.fromEntries(['content-type','cache-control','etag','last-modified','x-data-status','age','cf-cache-status','link','x-robots-tag'].filter(k=>headers[k]).map(k=>[k,headers[k]]));
  snapshot.requests.push({url,status,checked_at:new Date().toISOString(),ms:Date.now()-start,bytes:Buffer.byteLength(rest),sha256:createHash('sha256').update(rest).digest('hex'),headers:selected});
  let data;try{data=JSON.parse(rest);}catch{}return {status,data,text:rest};
 }catch(e){snapshot.requests.push({url,checked_at:new Date().toISOString(),error:'Transport failed or timed out',ms:Date.now()-start});return {status:0};}
}
const triage=['Resuscitation','Emergency','Urgent','Semi-urgent','Non-urgent'];
function contracts(b){
 const nz=b['new-zealand']?.stats?.rows||[], h=b.australia?.hospital,p=b.wales?.projection,n=b['northern-ireland']?.childhood_bmi;
 return {
  stats_nz_23:nz.length===23&&new Set(nz.map(r=>r.id)).size===23&&STATS_NZ_SERIES.every(s=>nz.some(r=>r.id===s.id&&r.status==='ok'&&Number.isFinite(r.value)&&r.period&&r.unit===s.unit&&r.geography===s.geography)),
  aihw_40_same_vintage:h?.year==='2024-25'&&h.states?.length===8&&new Set(h.states.map(r=>r.code)).size===8&&reference.aihw.every(r=>h.states.find(s=>s.code===r.reporting_unit_code)?.[triage[Number(r.reported_measure_code.slice(-2))-35]]===r.value),
  wales_same_vintage:p?.kind==='projection'&&p.geography==='Wales'&&p.period==='Mid-year 2026'&&p.value===3195431&&p.meaning?.includes('all ages, persons'),
  nisra_same_vintage:n?.period==='2024/25'&&n.rows?.length===4&&new Set(n.rows.map(r=>r.id)).size===4&&n.rows.every(r=>r.geography==='Northern Ireland'&&r.sex==='All Persons'&&r.period===n.period&&r.unit==='percent'&&r.status==='ok')&&reference.nisra.every(r=>n.rows.find(s=>s.id===r.selection.STATISTIC)?.value===r.value)
 };
}
for(const origin of ['https://morningrows.com','https://www.morningrows.com']){
 const info={};snapshot.domains[origin]=info;
 const health=await get(origin,'/health.json'),catalog=await get(origin,'/catalog.json');
 info.identity=health.data;info.catalogue=catalog.data;
 const bodies={};
 for(const c of catalog.data?.countries||[]){const slug=c.records.slice(1,-5),r=await get(origin,c.records);bodies[slug]=r.data;
  const statuses=Object.fromEntries((INVENTORY[slug]||[]).map(([key,path,hp])=>[key,{...at(r.data,hp),data_present:at(r.data,path)!=null}]));
  info[slug]={status:r.status,country:r.data?.country,sources:statuses,successful:Object.values(statuses).filter(s=>s.status==='ok').length};
  if(origin==='https://morningrows.com'){
   const directory=await get(origin,c.catalog);
   for(const card of directory.data?.sources||[])snapshot.registry.push({desk:slug,...card,live_health:statuses[card.key],monitoring_contract:card.representation==='described_measures'?'described: validation maturity must be checked':'native: no complete semantic contract yet'});
  }
  for(const [key,s]of Object.entries(statuses)){
   const previous=baseline.source_status[new URL(c.records,origin).href]?.[key];
   const known=baseline.last_notified_state.known_degradations.some(k=>k.desk===c.records&&k.source===key)||(slug==='new-zealand'&&key==='prices'&&baseline.last_notified_state.nz_prices.state==='error');
   if(s.status!=='ok'&&!known)snapshot.changes.push({origin,desk:slug,source:key,kind:'unacknowledged non-ok observation; needs confirmation',previous,current:s});
   if(s.status==='ok'&&known)snapshot.changes.push({origin,desk:slug,source:key,kind:'recovery candidate; needs confirmation',current:s});
  }
 }
 info.contracts=contracts(bodies);
 info.core_specimen={stats_nz:bodies['new-zealand']?.stats?.rows,aihw:bodies.australia?.hospital,wales:bodies.wales?.projection,nisra:bodies['northern-ireland']?.childhood_bmi,nz_prices:bodies['new-zealand']?.prices};
 for(const p of ['/schema.json','/llms.txt','/robots.txt','/united-states.json','/catalog.v2.json']){const r=await get(origin,p);info[p]={status:r.status,...(p==='/schema.json'?{schema:r.data}:p==='/robots.txt'?{text:r.text}:{})};}
}
snapshot.finished_at=new Date().toISOString();
await mkdir(root,{recursive:true});
await writeFile(new URL(process.env.OPERATIONS_AUDIT_REPORT||'production-audit.json',root),JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({started_at:snapshot.started_at,finished_at:snapshot.finished_at,sources:snapshot.registry.length,domains:Object.fromEntries(Object.entries(snapshot.domains).map(([k,v])=>[k,{identity:v.identity,desks:v.catalogue?.countries?.length,contracts:v.contracts,health:Object.fromEntries(Object.keys(INVENTORY).map(d=>[d,v[d]?.successful]))}])),changes:snapshot.changes},null,2));
