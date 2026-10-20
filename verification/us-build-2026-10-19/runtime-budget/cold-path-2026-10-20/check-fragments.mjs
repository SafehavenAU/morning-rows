import assert from 'node:assert/strict';
import {readUnitedStates} from './baseline/us-cpi.js';
import {selectedUsResponse as base,finishV2Response as finishBase,US_MEASURE_URL} from './baseline/information-v2.js';
import {selectedUsResponse as fast,finishV2Response as finishFast} from './fragment-information.mjs';
import {semantic} from './baseline/information.js';
import {fixtures} from './prepare.mjs';
const {index,table}=fixtures();
const body=await readUnitedStates({fetcher:async u=>new Response(u.endsWith('home.htm')?index:table)});
body.sources.cpi.fetched_at='2026-10-20T00:00:00Z';
assert.equal(body.sources.cpi.status,'ok');
const scenarios=[['original',x=>{}],['object-timing-note',x=>{x.cpi.timing_note={z:'qualification',a:{retrieved_at:'omitted',fetched_at:'omitted',period:'2026-09'}};}],['missing',x=>Object.assign(x.cpi.rows[5],{value:null,value_text:'-',value_state:'missing',footnotes:[]})],['unavailable',x=>Object.assign(x.cpi.rows[5],{value:null,value_text:'-',value_state:'unavailable',footnotes:[{code:'X',text:'Lapse in appropriations'}]})],['revised',x=>x.cpi.rows[5].footnotes.push({code:'R',text:'Revised'})],['nested-property-order',x=>{x.cpi.rows[5].footnotes.push({code:'R',text:'Revised',anything:{period:'fake',value:123}});}],['last-sorting-extra',x=>{x.cpi.rows[5].zz='last';}],['numeric-extra',x=>{x.cpi.rows[5]['1']='integer key before other keys';}],['extra-row',x=>{x.cpi.rows[5].qualification={z:1,number:3.54,nested:{fetched_at:'excluded',qual:'retained'}};}],['extra-footnote',x=>x.cpi.rows[5].footnotes.push({code:'R',text:'Revised',arbitrary:{qualification:'Retained',retrieved_at:'excluded'}})],['escaping',x=>{x.cpi.provenance[0].note='\"\\\n\t ,"period": "💡"';x.cpi.timing_note='Line\n2 "quoted"';x.cpi.rows[5].footnotes.push({code:'X',text:'Lapse in appropriations ,"period": "💡"'});Object.assign(x.cpi.rows[5],{value:null,value_text:'-',value_state:'unavailable'});}],['retrieval-error',x=>{x.sources.cpi={status:'error',error:'Refused',http_status:403,fetched_at:'2026-10-20T00:00:00Z'};x.cpi=null;}],['invalid-representation',x=>{x.cpi.rows[3].value=0;}] ];
let n=0;
for(const [name,mutate] of scenarios){const v=structuredClone(body);mutate(v);for(const selection of [{source:'cpi'},{source:'cpi',measure:'CUUR0000SA0'},{source:'cpi',measure:'CUUR0000SA0',observation:body.cpi.rows[5].period},{source:'cpi',measure:'CUUR0000SA0',observation:'2000-01'}]){
 const a=await base(v,selection),b=await fast(v,selection);assert.deepEqual(b.body,a.body,name);assert.equal(b.status,a.status,name);if(b.canonical)assert.equal(b.canonical,JSON.stringify(semantic(b.body)),name);
 for(const method of ['GET','HEAD']){const req=new Request(US_MEASURE_URL,{method});const ra=await finishBase(req,Response.json(a.body,{status:a.status}),a.body.id,'2026-10-20T00:00:00Z',a.body);const rb=await finishFast(req,Response.json(b.body,{status:b.status}),b.body.id,'2026-10-20T00:00:00Z',b.body,b.canonical);assert.equal(await ra.text(),await rb.text(),name);assert.deepEqual([...rb.headers],[...ra.headers],name);n++;}
}}
console.log(JSON.stringify({checks:n,status:'all bodies, observation versions, content_version, etag and headers byte-equal'}));
