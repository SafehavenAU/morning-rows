// Constructed semantic/transport cases applied to the actual isolated JS reader.
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse,acquire,boundedText,URLS} from './reader.js';
import {represent} from './representation.js';
import fixture from './fixture.js';
const results=[];
async function check(name,fn){await fn();results.push({name,pass:true});}
const mutation=(file,from,to)=>({...fixture,[file]:fixture[file].replace(from,to)});
await check('13 slots, 12 numeric, October unavailable X, no M13',()=>{const d=parse(fixture);assert.equal(d.observations.length,13);assert.equal(d.observations.filter(r=>r.value!==null).length,12);assert.equal(d.observations[1].value_state,'unavailable');assert.equal(d.observations[1].footnotes[0].code,'X');assert.equal(d.latest_period,'2026-09');});
for(const [name,file,from,to,error] of [
 ['wrong geography','series','\t0000\t','\t0400\t','incompatible_definition'],
 ['wrong adjustment','series','\tU\t','\tS\t','incompatible_definition'],
 ['wrong index base','series','1982-84=100','2000=100','incompatible_definition'],
 ['wrong periodicity','series','\tR\t','\tA\t','incompatible_definition'],
 ['metadata newer than records','series','2026\tM09','2026\tM10','metadata_release_mismatch'],
 ['incomplete window','data','2025\tM11','2024\tM11','incomplete_window'],
 ['unavailable with numeric','data','           -\tX','     325.000\tX','numeric_with_unavailable_flag'],
 ['unknown missingness flag','data','\tX','\tZZ','unknown_footnote'],
 ['zero index anomaly, not null','data','336.940','0','nonpositive_index_anomaly'],
 ['formatted numeric rejected','data','336.940','336,940','malformed_value'],
 ['bad monthly period','data','M09','Q03','invalid_period']
])await check(name,()=>assert.throws(()=>parse(mutation(file,from,to)),new RegExp(error)));
await check('duplicate period',()=>assert.throws(()=>parse({...fixture,data:fixture.data+'CUUR0000SA0\t2026\tM09\t336.940\t\n'}),/duplicate_period/));
await check('unexplained dash remains missing, not suppressed or zero',()=>assert.equal(parse(mutation('data','\tX','\t')).observations[1].value_state,'missing'));
await check('annual M13 cannot displace December or enter monthly window',()=>{
 let f=structuredClone(fixture);f.data+='CUUR0000SA0\t2026\tM10\t337.000\t\nCUUR0000SA0\t2026\tM11\t338.000\t\nCUUR0000SA0\t2026\tM12\t339.000\t\nCUUR0000SA0\t2026\tM13\t330.000\t\n';f.series=f.series.replace('2026\tM09','2026\tM13');assert.equal(parse(f).latest_period,'2026-12');assert.equal(parse(f).observations.at(-1).value,339);
});
await check('stream size limit without content length',()=>assert.rejects(()=>boundedText(new Response('123456789'),8),/body_limit/));
await check('declared size limit',()=>assert.rejects(()=>boundedText(new Response('1',{headers:{'content-length':'100'}}),8),/body_limit/));
await check('HTTP error',()=>assert.rejects(()=>boundedText(new Response('error',{status:429}),100),/upstream_http_429/));
await check('empty body',()=>assert.rejects(()=>boundedText(new Response(null),100),/empty_body/));
await check('source deadline aborts all outstanding requests',async()=>{let aborted=0;await assert.rejects(()=>acquire((url,opts)=>new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>{aborted++;reject(Error('abort'));})),{deadline:10}),/source_deadline/);assert.equal(aborted,3);});
await check('same success, new retrieval time: stable observation versions',async()=>{const a=await represent(parse(fixture),'2026-10-17T11:00:00Z'),b=await represent(parse(fixture),'2026-10-17T12:00:00Z');assert.deepEqual(a.observations,b.observations);});
await check('one correction changes exactly its observation version',async()=>{const a=await represent(parse(fixture),'2026-10-17T11:00:00Z'),b=await represent(parse(mutation('data','336.940','336.941')),'2026-10-17T12:00:00Z');assert.deepEqual(a.observations.filter((r,i)=>r.version!==b.observations[i].version).map(r=>r.period),['2026-09']);});
await check('failed refresh creates no fabricated observation',async()=>{const r=await represent(null,'2026-10-17T12:00:00Z','upstream_http_403');assert.equal(r.data,null);assert.deepEqual(r.observations,[]);assert.equal(r.retrieval.status,'error');});
const python=JSON.parse(readFileSync(new URL('../results.json',import.meta.url)));
await check('JS parser agrees with independently implemented Python parser on every cell',()=>assert.deepEqual(parse(fixture).observations,python.representation.observations.map(({period,value,value_text,value_state,footnotes})=>({period,value,value_text,value_state,footnotes}))));
writeFileSync(new URL('reader-results.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),method:'Deterministic assertions; faults constructed; original selected aggregate cells',results,reader_sha256:createHash('sha256').update(readFileSync(new URL('reader.js',import.meta.url))).digest('hex')},null,2)+'\n');
console.log(JSON.stringify({reader_checks:results.length,pass:true}));
