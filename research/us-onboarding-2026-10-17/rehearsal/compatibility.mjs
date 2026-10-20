import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../../../worker.js';
import {catalogue,DESKS,INFORMATION_SCHEMA,selectedResponse,validateSelection} from '../../../lib/information.js';
import {parse} from './reader.js';
import {routeV2,catalogueV2,schemaV2} from './representation.js';
import fixture from './fixture.js';
const root=new URL('.',import.meta.url),snapshot=JSON.parse(readFileSync(new URL('../../../verification/structure-2026-10-17/selected-snapshot.json',root)));
globalThis.fetch=()=>{throw Error('External fetch forbidden in compatibility replay');};
globalThis.caches={default:{match:async request=>{let desk=new URL(request.url).pathname.slice(1).replace(/\.json$/,'');if(desk==='morning')desk='australia';return snapshot[desk]?Response.json(snapshot[desk],{headers:{'cache-control':'public, max-age=14400','x-data-status':'degraded','x-mr-cache-expires-at':String(Date.now()+3600000)}}):undefined;}}};
const prototype={fetch:async request=>await routeV2(request,parse(fixture),'2026-10-17T11:00:00Z')||worker.fetch(request,{},{} )};
const paths=new Set(['/catalog.json','/schema.json','/morning.json','/catalog.json?desk=united-states','/canada.json?date=2026-10-12']);
for(const desk of Object.keys(DESKS)){
 paths.add(`/${desk}.json`);paths.add(`/catalog.json?desk=${desk}`);
 for(const s of catalogue(desk).sources){
  paths.add(new URL(s.records).pathname+new URL(s.records).search);
  for(const m of s.measures||[]){
   const u=new URL(m.records);paths.add(u.pathname+u.search);
   const selected=await selectedResponse(snapshot[desk],validateSelection(u));
   for(const o of selected.body.observations||[])paths.add(new URL(o.id).pathname+new URL(o.id).search);
  }
 }
}
const results=[],documents=[];
for(const path of paths){
 const req=new Request('https://morningrows.com'+path),a=await worker.fetch(req,{},{}),b=await prototype.fetch(req);
 const at=await a.text(),bt=await b.text();assert.equal(a.status,b.status,path);assert.equal(at,bt,path);assert.deepEqual([...a.headers],[...b.headers],path);
 const json=JSON.parse(bt);if(a.status===200&&path!='/schema.json')documents.push({path,schema:'v1',body:json});
 results.push({path,status:a.status,identical_body_and_headers:true,sha256:createHash('sha256').update(bt).digest('hex')});
}
const usPaths=['/catalog.v2.json','/catalog.v2.json?desk=united-states','/united-states.json','/united-states.json?source=cpi','/united-states.json?source=cpi&measure=CUUR0000SA0','/united-states.json?source=cpi&measure=CUUR0000SA0&observation=2025-10'];
for(const path of usPaths){const r=await prototype.fetch(new Request('https://morningrows.com'+path));assert.equal(r.status,200);documents.push({path,schema:'v2',body:await r.json()});}
for(const [query,status] of [['geography=California',400],['source=cpi&measure=CUUR0400SA0',404],['source=cpi&measure=CUUR0000SA0&observation=2025-08',404],['source=cpi&measure=CUUR0000SA0&observation=2026',404],['source=cpi&source=cpi',400]])assert.equal((await prototype.fetch(new Request('https://morningrows.com/united-states.json?'+query))).status,status);
const duplicate=structuredClone(snapshot.canada);duplicate.exchange.rows.push({...duplicate.exchange.rows[0]});
const conflict=await selectedResponse(duplicate,validateSelection(new URL('https://morningrows.com/canada.json?source=exchange')));assert.equal(conflict.status,503);
const report={at:new Date().toISOString(),method:'Deterministic prototype delegation replay; not deployed integration or independent agent evaluation',legacy_cases:results.length,results,single_observation_implementation_conflict:{status:conflict.status,error:conflict.body.error},v2_cases:usPaths,alternative_extension_old_iterator_count:catalogue().countries.length,limitations:['Legacy wrapper delegates unchanged code; integration must repeat these checks after real route/registry edits.','Prototype v2 schema is minimal and not a frozen production schema.']};
writeFileSync(new URL('compatibility-results.json',root),JSON.stringify(report,null,2)+'\n');
writeFileSync(new URL('schema-inputs.json',root),JSON.stringify({schemas:{v1:INFORMATION_SCHEMA,v2:schemaV2},documents,naive_ninth:{...catalogue(),countries:catalogueV2().countries},additive_property:{...catalogue(),additional_countries:[catalogueV2().countries.at(-1)]}},null,2)+'\n');
console.log(JSON.stringify({legacy_cases:results.length,v2_cases:usPaths.length,single_observation_conflict:conflict.status}));
