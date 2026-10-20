import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {NI_ENERGY_SUMMARY_CONTRACT as C,niEnergySummaryDefinitions,parseNiEnergySummary,readNiEnergySummary,validateNiEnergySummaryRepresentation as valid,niEnergySummaryRows} from '../lib/ni-energy-summary.js';
import {readSections} from '../lib/sources.js';
const article=fs.readFileSync(new URL('../verification/gap-followup-2026-10-20/access-review/ni-article/statistical-article.excerpt.html',import.meta.url),'utf8');
const clock='2026-10-20T12:30:00Z',parse=(s=article,t=clock)=>parseNiEnergySummary(s,{retrieved_at:t});
const expected=JSON.parse(fs.readFileSync(new URL('../verification/gap-followup-2026-10-20/access-review/ni-article/comparison.json',import.meta.url))).comparisons;
const copy=x=>structuredClone(x);
const changed=(from,to)=>{assert.ok(article.includes(from));return article.replace(from,to);};
const response=(body=article,options={})=>new Response(body,{headers:{'content-type':'text/html; charset=utf-8'},...options});

test('five exact independent article/workbook values and fixed semantic definitions',()=>{
 const native=parse();assert.equal(valid(native),true);assert.deepEqual(native.rows.map(r=>({id:r.measure_id,value:r.value})),expected.map(r=>({id:r.measure,value:r.original_workbook})));
 assert.deepEqual(niEnergySummaryRows(native),native.rows);assert.equal(native.rows.length,5);assert.equal(native.metadata.fixed_edition,true);assert.ok(native.limitations.includes('does not claim the newest'));
 assert.equal(native.metadata.history_month_count,undefined);assert.equal(native.provenance.length,0);assert.equal(native.published_at,null);
 for(const d of niEnergySummaryDefinitions()){assert.equal(d.source_url,C.source_url);assert.equal(d.edition,'fixed_2026-09-03');assert.match(d.methodology,/own-use/);assert.equal(d.metadata_evidence.live_retrieved,false);}
 const evidence=fs.readFileSync(new URL('../'+C.metadata_evidence.path,import.meta.url));assert.equal(createHash('sha256').update(evidence).digest('hex'),C.metadata_evidence.sha256);
});
test('known one-GWh rounded residual is not silently recomputed',()=>{const v=parse().rows.map(r=>r.value);assert.equal(v[1]-v[2]-v[3]-v[4],1);assert.equal(v[1],8865);});
for(const [label,from,to] of [
 ['title','Electricity Consumption and Renewable Generation Statistics</h1>','Electricity Consumption and Renewable Generation Statistics UK</h1>'],
 ['territory','Generation in Northern Ireland are published','Generation in Ireland are published'],
 ['new edition','Latest results published 3 September 2026','Latest results published 3 December 2026'],
 ['old edition','Latest results published 3 September 2026','Latest results published 3 June 2026'],
 ['future edition','Latest results published 3 September 2026','Latest results published 3 September 2027'],
 ['mixed period','Key points for the 12-month period July 2025 to June 2026','Key points for the 12-month period July 2024 to June 2025'],
 ['monthly period','Key points for the 12-month period','Key points for the 1-month period'],
 ['method','approach in March 2026','approach in March 2025'],
 ['denominator','50% of gross final electricity consumption','50% of total electricity generation'],
 ['balance meaning','generation plus imports minus exports','generation plus exports minus imports'],
 ['unit','(4,431 GWh)','(4,431 MWh)'],
 ['missing','(4,431 GWh)','(N/A GWh)'],
 ['suppression','(4,431 GWh)','(.. GWh)'],
 ['blank','(4,431 GWh)','( GWh)'],
 ['zero denominator','consumption (8,865 GWh)','consumption (0 GWh)'],
 ['previous172 swapped','with net imports of 578 GWh','with net imports of 172 GWh'],
 ['wrong current year','In the year to June 2026, Northern Ireland','In the year to June 2025, Northern Ireland'],
 ['wrong repeated total','to 8,865 GWh in the year to June 2026','to 8,864 GWh in the year to June 2026'],
 ['wrong repeated generation','of which 4,431 GWh','of which 4,432 GWh'],
 ['wrong repeated fuel total','Of the 4,431 GWh','Of the 4,430 GWh'],
 ['wrong generation total','8,286 GWh of total','8,000 GWh of total'],
 ['wrong generation percentage','sources (53%)','sources (50%)'],
 ['wrong share','equivalent to 50%','equivalent to 49%'],
 ['wrong signed narrative','with net imports of 578 GWh','with net imports of -578 GWh'],
 ['wrong report URL',C.report_url,C.report_url+'?different=true'],
 ['wrong link vintage','Ireland July 2025 to June 2026</a>','Ireland July 2024 to June 2025</a>'],
 ['unknown extra item','<ul><li>The volume','<ul><li>New unreviewed current statistics</li><li>The volume'],
])test('rejects '+label,()=>assert.throws(()=>parse(changed(from,to))));
test('duplicated current section refuses',()=>assert.throws(()=>parse(article+article)));
test('an unsupported extra statistical sentence cannot hide in same list item',()=>assert.throws(()=>parse(changed('This can be compared to the year','In the year to June 2026, Northern Ireland imported 172 GWh. This can be compared to the year'))));
test('negative net imports accepted with consistent direction and rounded balance',()=>{
 const s=article.replaceAll('8,865','8,000').replace('equivalent to 50%','equivalent to 55%').replace('In the year to June 2026, Northern Ireland imported more than it exported with net imports of 578','In the year to June 2026, Northern Ireland exported more than it imported with net imports of -286');
 const x=parse(s);assert.equal(x.rows.at(-1).value,-286);assert.equal(valid(x),true);
});
test('genuine zero imports accepted without absent-to-zero coercion',()=>{
 const s=article.replaceAll('8,865','8,286').replace('equivalent to 50%','equivalent to 53%').replace('In the year to June 2026, Northern Ireland imported more than it exported with net imports of 578','In the year to June 2026, Northern Ireland imported as much as it exported with net imports of 0');assert.equal(parse(s).rows.at(-1).value,0);
});
test('genuine zero renewable generation accepted with consistent repeats and shares',()=>{
 const s=article.replaceAll('4,431','0').replaceAll('8,865','8,864').replace('equivalent to 50%','equivalent to 0%').replace('sources (53%)','sources (0%)').replace('3,855 GWh (47%)','8,286 GWh (100%)');assert.equal(parse(s).rows[2].value,0);
});
for(const t of [undefined,null,'unknown','2026-09-02T23:59:59Z','2026-02-30T12:00:00Z','2026-10-20T12:30:00+00:00'])test('invalid parser acquisition '+String(t),()=>assert.throws(()=>parseNiEnergySummary(article,{retrieved_at:t})));
test('fixed unchanged edition remains valid after later dates; does not imply newest',()=>assert.equal(valid(parse(article,'2027-01-01T00:00:00Z'),{retrieved_at:'2027-01-01T00:00:00Z'}),true));
for(const [label,mutate] of [
 ['geography',x=>x.geography='United Kingdom'],['row meaning',x=>x.rows[0].measure_id='gross_final_consumption'],['row units',x=>x.rows[0].unit='GWh'],['row period',x=>x.rows[0].period='2024-07-01/2025-06-30'],['publication',x=>x.publication_date='2027-01-01'],['edition',x=>x.edition='latest'],['fixed flag',x=>x.metadata.fixed_edition=false],['metadata anchor',x=>x.metadata.metadata_evidence.sha256='0'.repeat(64)],['missing metadata',x=>delete x.metadata.metadata_evidence],['count',x=>x.metadata.count=4],['missing row',x=>x.rows.pop()],['value null',x=>x.rows[0].value=null],['numeric string',x=>x.rows[0].value='50'],['history invention',x=>x.metadata.history_month_count=91],['live anchor invented',x=>x.metadata.metadata_evidence.live_retrieved=true],['definition meaning',x=>x.definitions[0].population='Metered only'],['publication time invented',x=>x.published_at='2026-09-03T00:00:00Z'],['value state',x=>x.rows[0].value_state='suppressed']
])test('native refuses '+label,()=>{const x=copy(parse());mutate(x);assert.equal(valid(x,{retrieved_at:clock}),false);});
test('public clocks fail closed including explicitly undefined',()=>{const x=parse();assert.equal(valid(x),true);for(const a of [undefined,null,{}, {retrieved_at:'unknown'},{retrieved_at:'2026-09-02T23:59:59Z'}])assert.equal(valid(x,a),false);});
test('actual-reader injection uses one bounded request and one live article provenance',async()=>{
 let calls=0;const x=await readNiEnergySummary({now:()=>clock,fetcher:async(url,options)=>{calls++;assert.equal(url,C.source_url);assert.equal(options.redirect,'manual');assert.equal(options.headers.accept,'text/html');assert.ok(options.signal instanceof AbortSignal);return response();}});
 assert.equal(calls,1);assert.equal(valid(x,{retrieved_at:clock}),true);assert.equal(x.provenance.length,1);assert.equal(x.provenance[0].role,'article');assert.equal(x.provenance[0].sha256,createHash('sha256').update(article).digest('hex'));assert.equal(x.provenance[0].bytes,Buffer.byteLength(article));
 const future=copy(x);future.provenance[0].retrieved_at='2026-10-21T12:30:00Z';assert.equal(valid(future,{retrieved_at:clock}),false);
 const wrong=copy(x);wrong.provenance[0].url=C.report_url;assert.equal(valid(wrong),false);
 const history=copy(x);history.provenance.push({...history.provenance[0],role:'figure_3'});assert.equal(valid(history),false);
});
for(const [name,fetcher] of [
 ['http403',async()=>response('Refused',{status:403})],['http429',async()=>response('Rate limited',{status:429})],['redirect',async()=>response(null,{status:302,headers:{location:C.report_url}})],['wrong content type',async()=>response(article,{headers:{'content-type':'application/json'}})],['declared oversized',async()=>response(article,{headers:{'content-type':'text/html','content-length':String(C.max_bytes+1)}})],['stream oversized',async()=>response(' '.repeat(C.max_bytes+1))],['invalid utf8',async()=>response(new Uint8Array([0xff]))],['access page',async()=>response('<html><h1>Request Rejected</h1></html>')],['truncated',async()=>response(article.slice(0,4000))],['timeout',async()=>{throw new DOMException('Timed out','TimeoutError');}],['wrong final URL',async()=>{const r=response();Object.defineProperty(r,'url',{value:C.report_url});return r;}]
])test('reader refuses '+name+' without retry',async()=>{let n=0;await assert.rejects(readNiEnergySummary({now:()=>clock,fetcher:async(...args)=>{n++;return fetcher(...args);}}));assert.equal(n,1);});
test('invalid reader clock fails before publisher request',async()=>{let calls=0;await assert.rejects(readNiEnergySummary({now:()=>undefined,fetcher:async()=>{calls++;return response();}}));assert.equal(calls,0);});
test('oversized multibyte parser payload refuses by bytes',()=>assert.throws(()=>parse(article+'é'.repeat(C.max_bytes/2))));
test('unrelated success survives malformed NI response',async()=>{const x=await readSections({electricity_balance:()=>readNiEnergySummary({now:()=>clock,fetcher:async()=>response('Request Rejected')}),sibling:async()=>({value:42})});assert.equal(x.electricity_balance,null);assert.equal(x.sources.electricity_balance.status,'error');assert.equal(x.sibling.value,42);assert.equal(x.sources.sibling.status,'ok');});
