// Deterministic HTTP-handler replay, not an autonomous-agent benchmark.
// Uses dated public aggregates; no credentials or upstream requests.
import {readFile,writeFile} from 'node:fs/promises';
import worker from '../worker.js';
const directory=new URL('../verification/structure-2026-10-17/',import.meta.url);
const snapshots=JSON.parse(await readFile(new URL('selected-snapshot.json',directory)));
const before=JSON.parse(await readFile(new URL('before.json',directory)));
const refs=JSON.parse(await readFile(new URL('publisher-reference.json',directory)));
const datasets={
 'canada': ['exchange','FXUSDCAD',1.4154,'development'],
 'wales':['projection','population-2024-based',Number(refs.wales[0]['Data values']),'development'],
 'new-zealand':['stats','CORR_FIS_005',snapshots['new-zealand'].stats.rows.find(r=>r.id==='CORR_FIS_005').value,'development'],
 'scotland':['company_insolvencies','total-company-insolvencies',73,'development'],
 'northern-ireland':['childhood_bmi','Y8BMIOwOb',refs.nisra.find(r=>r.selection.STATISTIC==='Y8BMIOwOb').value,'held_out'],
 'england':['pharmacies','total',10402,'held_out'],
 'australia':['hospital','WA.MYH-RM0037',refs.aihw.find(r=>r.reporting_unit_code==='WA'&&r.reported_measure_code==='MYH-RM0037').value,'held_out'],
};
globalThis.caches={default:{match:async request=>{
 const desk=new URL(request.url).pathname.slice(1,-5);
 if(!snapshots[desk]) throw Error('Unknown fixture desk');
 return Response.json(snapshots[desk],{headers:{'Cache-Control':'public, max-age=30','x-data-status':'degraded','x-mr-cache-expires-at':String(Date.now()+30000)}});
}}};
globalThis.fetch=()=>{throw Error('No network in offline replay');};
const report={evaluated_at:new Date().toISOString(),method:'Deterministic handler replay on fixed dated aggregate fixtures; no independent agent answers or retention measurement.',reference_limits:'AIHW/Wales/NISRA: original publisher responses selected independently in Python. Canada: prior research JSON/CSV/official table. Remaining values: previously verified reader output and existing regression evidence, not a new independent upstream reconciliation.',conditions:{before_source:before.identity,after_source:'Working tree; release identity in release evidence',transport:'Worker fetch handler with cached fixtures; HTTP headers/status/body asserted. Edge behavior checked separately in remote preview and production.',cold_discovery:'Before: llms + root catalogue + full desk = 3 requests. After: llms + root catalogue + desk directory + selected response = 4. Source discovery adds one hop. Repeat visit needs one conditional request.'},tasks:[]};
let failed=false;
for(const [desk,[source,measure,value,set]] of Object.entries(datasets)) {
 const trace=[];
 const url=`https://morningrows.com/${desk}.json?`+new URLSearchParams({source,measure});
 for(const path of ['/llms.txt','/catalog.json',`/catalog.json?desk=${desk}`,url]) {
  const requestUrl=new URL(path,'https://morningrows.com').href;
  const r=await worker.fetch(new Request(requestUrl));const body=await r.text();
  trace.push({url:requestUrl,status:r.status,body_bytes:Buffer.byteLength(body),etag:r.headers.get('etag')});
  if(path===url) {
   const data=JSON.parse(body),o=data.observations?.[0];
   const checks={correct_value:o?.value===value,exact_period:Boolean(o?.period),explicit_geography:Boolean(o?.definition.geography),explicit_unit:Boolean(o?.definition.unit),publisher_citation:Boolean(o?.source_url),stable_observation_url:Boolean(o?.id.includes('&observation=')),qualified_context:Boolean(data.context),zero_not_missing:o?.value_state==='observed'};
   failed ||= Object.values(checks).some(x=>!x);
   const repeat=await worker.fetch(new Request(url,{headers:{'If-None-Match':r.headers.get('etag')}}));
   const repeatBytes=Buffer.byteLength(await repeat.text());failed ||= repeat.status!==304||repeatBytes!==0;
   const beforeBytes=before.requests.find(r=>r.path===`/${desk}.json`).bytes;
   report.tasks.push({desk,set,source,measure,checks,answer:{value:o?.value,unit:o?.definition.unit,geography:o?.definition.geography,period:o?.period,kind:o?.definition.kind,citation:o?.source_url},before_full_desk_bytes:beforeBytes,after_selected_bytes:Buffer.byteLength(body),saved_body_percent:Math.round(100*(1-Buffer.byteLength(body)/beforeBytes)),repeat:{status:repeat.status,body_bytes:repeatBytes},trace});
  }
 }
}
const unsupported=await worker.fetch(new Request('https://morningrows.com/canada.json?date=2026-10-12'));
report.unsupported_date={before:before.probes.find(p=>p.test==='unsupported-filter'),after:{status:unsupported.status,body:await unsupported.json()}};failed ||= unsupported.status!==400;
const ai=await worker.fetch(new Request('https://morningrows.com/.well-known/ai-catalog.json'));const body=await ai.json();report.discovery={before_advertised_desks:1,after_advertised_desks:body.services.filter(s=>Object.keys(snapshots).some(d=>s.path===`/${d}.json`)).length};failed ||=report.discovery.after_advertised_desks!==8;
report.pass=!failed;
await writeFile(new URL('evaluation.json',directory),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,tasks:report.tasks.map(t=>({desk:t.desk,before:t.before_full_desk_bytes,after:t.after_selected_bytes,repeat:t.repeat.status})),discovery:report.discovery},null,2));
if(failed) process.exitCode=1;
