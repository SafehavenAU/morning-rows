import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker, {readCanadaExchange} from '../worker.js';
import {catalogue,DESKS,validateSelection,selectedResponse,digest,finishResponse} from '../lib/information.js';
import {hospitalFromApi} from '../lib/public-data.js';

const snapshot=JSON.parse(readFileSync(new URL('../verification/structure-2026-10-17/selected-snapshot.json',import.meta.url)));
const copy=desk=>structuredClone(snapshot[desk]);
const selection=(desk,source,measure,observation)=>validateSelection(new URL(`https://morningrows.com/${desk}.json?`+new URLSearchParams(Object.fromEntries(Object.entries({source,measure,observation}).filter(([,v])=>v!==undefined)))));
const select=(desk,source,measure,observation,body=copy(desk))=>selectedResponse(body,selection(desk,source,measure,observation));
function cache(t,body) {t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected external request in deterministic test');});globalThis.caches={default:{match:async()=>Response.json(body,{headers:{'Cache-Control':'public, max-age=14400','x-data-status':'degraded','x-mr-cache-expires-at':String(Date.now()+20000)}})}};t.after(()=>{delete globalThis.caches;});}

test('eight desk directories expose every registered source and stable URLs',()=>{
 const root=catalogue();assert.equal(root.countries.length,8);
 for(const desk of Object.keys(DESKS)) {
  const directory=catalogue(desk);assert.ok(directory.sources.length);
  for(const source of directory.sources){const s=validateSelection(new URL(source.records));assert.equal(s.desk,desk);assert.equal(s.source,source.key);assert.ok(s.entry);}
 }
 assert.equal(catalogue('new-zealand').sources.find(s=>s.key==='stats').measure_count,23);
 assert.equal(catalogue('australia').sources.find(s=>s.key==='hospital').measure_count,40);
});
test('unsupported filters, duplicate IDs, wrong source and wrong-country measure are rejected',()=>{
 for(const query of ['date=2026-10-12','geography=Belfast','source=exchange&source=rate','source=','schema_version=2','observation=2026']) assert.equal(validateSelection(new URL('https://morningrows.com/canada.json?'+query)).status,400);
 assert.equal(selection('wales','childhood_bmi').status,404);
 assert.equal(selection('northern-ireland','childhood_bmi','population-2024-based').status,404);
 assert.equal(selection('canada','exchange','FXCADUSD').status,404);
});
test('FX reference amount has exact date, quote direction and publisher citation; holiday is not substituted',async()=>{
 const r=await select('canada','exchange','FXUSDCAD');assert.equal(r.status,200);
 const o=r.body.observations[0];assert.equal(o.value,1.4154);assert.equal(o.period,'2026-10-16');assert.equal(o.definition.unit,'CAD per 1 USD');assert.equal(1000*o.value,1415.4);assert.match(o.source_url,/bankofcanada/);
 const holiday=await select('canada','exchange','FXUSDCAD','2026-10-12');assert.equal(holiday.status,404);assert.equal(holiday.body.data,null);assert.equal(holiday.body.observations.length,0);
});
test('projection keeps base year, population and kind; incompatible semantics fail',async()=>{
 const r=await select('wales','projection','population-2024-based');const o=r.body.observations[0];assert.equal(o.value,3195431);assert.equal(o.definition.kind,'projection');assert.equal(o.definition.population,'All persons, all ages');assert.equal(o.period,'Mid-year 2026');assert.equal(o.published_at,null);
 for(const [key,value] of [['geography','England'],['unit','thousands'],['kind','estimate'],['base_year',2022]]) {const body=copy('wales');body.projection[key]=value;assert.equal((await select('wales','projection',undefined,undefined,body)).status,503);}
});
test('Stats NZ selection retains 23 fixed dimensions, historical labels and projections',async()=>{
 const all=await select('new-zealand','stats');assert.equal(all.status,200);assert.equal(all.body.observations.length,23);
 const r=await select('new-zealand','stats','CORR_FIS_005');const o=r.body.observations[0];assert.equal(o.period,'2025');assert.equal(o.period_label,'2024/2025');assert.equal(o.definition.unit,'people');assert.ok(o.definition.dimensions);
 const body=copy('new-zealand');body.stats.rows[0].dimensions={wrong:'population'};assert.equal((await select('new-zealand','stats',undefined,undefined,body)).status,503);
});
test('partial Stats NZ preserves available rows without fabricated period or identity',async()=>{
 const body=copy('new-zealand');Object.assign(body.stats.rows[0],{value:null,period:null,status:'error',error:'Upstream unavailable'});body.sources.stats.status='degraded';
 const r=await select('new-zealand','stats',undefined,undefined,body);assert.equal(r.status,200);assert.equal(r.body.observations.length,22);assert.equal(r.body.unavailable_measures.length,1);
 assert.equal((await select('new-zealand','stats','AGR_AGR_001',undefined,body)).status,503);
});
test('held-out iwi estimate is not silently relabelled as the whole NZ population',async()=>{
 const r=await select('new-zealand','stats','IWI18_GRP_001');const o=r.body.observations[0];
 assert.equal(o.period,'2018');assert.equal(o.definition.population,'Ngai Tahu Whanui iwi grouping');assert.equal(o.value,snapshot['new-zealand'].stats.rows.find(r=>r.id==='IWI18_GRP_001').value);
 assert.equal((await select('new-zealand','stats','IWI18_GRP_001','2026')).status,404);
});
test('held-out NI academic year is not a calendar year, units/population/geography cannot drift',async()=>{
 const r=await select('northern-ireland','childhood_bmi','Y8BMIOwOb');assert.equal(r.body.observations[0].value,26.5);assert.equal(r.body.observations[0].period,'2024/25');assert.match(r.body.context.note,/incomplete trust coverage/);
 assert.equal((await select('northern-ireland','childhood_bmi','Y8BMIOwOb','2025')).status,404);
 for(const [key,value] of [['geography','Belfast'],['unit','proportion'],['sex','Female'],['period','2024']]){const body=copy('northern-ireland');body.childhood_bmi.rows[0][key]=value;assert.equal((await select('northern-ireland','childhood_bmi',undefined,undefined,body)).status,503);}
});
test('same insolvency measure in distinct nations stays distinct, revision/publication dates separate',async()=>{
 const sc=await select('scotland','company_insolvencies','total-company-insolvencies');const ni=await select('northern-ireland','company_insolvencies','total-company-insolvencies');
 assert.equal(sc.body.observations[0].value,73);assert.equal(ni.body.observations[0].value,7);assert.notEqual(sc.body.observations[0].id,ni.body.observations[0].id);assert.equal(sc.body.observations[0].published_at,'2026-09-18');assert.equal(sc.body.observations[0].period,'2026-08');assert.equal(sc.body.observations[0].definition.adjustment,'Not seasonally adjusted');
});
test('held-out pharmacy stock and flow retain distinct conventions and overlap notes',async()=>{
 const stock=await select('england','pharmacies','total');const flow=await select('england','pharmacies','distance_sellers_net_change');assert.equal(stock.body.observations[0].value,10402);assert.match(stock.body.observations[0].definition.period_convention,/stock/);assert.match(flow.body.observations[0].definition.period_convention,/flow/);assert.ok(stock.body.context.note);
});
test('AIHW zero, explicit suppression and unavailable are three different states',async()=>{
 const data=Object.keys({NSW:1,Vic:1,Qld:1,WA:1,SA:1,Tas:1,ACT:1,NT:1}).flatMap(code=>['MYH-RM0035','MYH-RM0036','MYH-RM0037','MYH-RM0038','MYH-RM0039'].map(measure=>({reporting_unit_code:code,reporting_unit_name:code,reporting_unit_type_code:'S',reported_measure_code:measure,measure_code:'MYH0010',units_name:'percent',reporting_start_date:'2024-07-01',reporting_end_date:'2025-06-30',value:76})));
 data[0].value=0;data[1].suppression_codes='np';data[2].value=null;
 const body=copy('australia');body.hospital=hospitalFromApi({result:{data,pagination:{total_results_available:40,starting_result_index:1}}});body.sources.hospital.status='degraded';
 const r=await select('australia','hospital',undefined,undefined,body);assert.equal(r.status,200);assert.deepEqual(r.body.observations.slice(0,3).map(o=>[o.value,o.value_state]),[[0,'observed'],[null,'suppressed'],[null,'unavailable']]);
 body.hospital.states.pop();assert.equal((await select('australia','hospital',undefined,undefined,body)).status,503);
});
test('held-out AIHW jurisdiction selection and retained notes agree with original desk values',async()=>{
 for(const code of ['WA','NSW']) {const r=await select('australia','hospital',`${code}.MYH-RM0037`);assert.equal(r.status,200);assert.equal(r.body.observations[0].value,snapshot.australia.hospital.states.find(s=>s.code===code).Urgent);assert.equal(r.body.observations[0].definition.dimensions.jurisdiction,code);}
});
test('observation identity survives revised value; changed period is a new identity; retrieval alone is unchanged',async()=>{
 const before=(await select('wales','projection')).body;const body=copy('wales');body.sources.projection.fetched_at='2026-10-18T10:00:00Z';
 const unchanged=(await select('wales','projection',undefined,undefined,body)).body;assert.equal(before.content_version,unchanged.content_version);
 body.projection.value++;const revision=(await select('wales','projection',undefined,undefined,body)).body;assert.equal(before.observations[0].id,revision.observations[0].id);assert.notEqual(before.observations[0].version,revision.observations[0].version);
 body.projection.period='Mid-year 2027';const next=(await select('wales','projection',undefined,undefined,body)).body;assert.notEqual(before.observations[0].id,next.observations[0].id);
 body.projection.period='Mid-year 2026';body.projection.value--;body.projection.notes='Coverage correction';assert.notEqual(before.observations[0].version,(await select('wales','projection',undefined,undefined,body)).body.observations[0].version);
});
test('failed selected source is explicit; an unrelated failure does not change its content version',async()=>{
 const before=(await select('wales','projection')).body;const body=copy('wales');body.sources.job={status:'error',error:'timeout',fetched_at:'2026-10-18'};
 assert.equal(before.content_version,(await select('wales','projection',undefined,undefined,body)).body.content_version);
 body.sources.projection={status:'error',error:'timeout',fetched_at:'2026-10-18'};const r=await select('wales','projection',undefined,undefined,body);assert.equal(r.status,503);assert.equal(r.body.data,null);assert.deepEqual(r.body.observations,[]);
});
test('HTTP weak conditional GET, lists, HEAD and failure responses obey representation semantics',async()=>{
 const url='https://morningrows.com/wales.json?source=projection';
 const first=await finishResponse(new Request(url),Response.json({value:0,fetched_at:'one'}),url);
 const etag=first.headers.get('etag');
 const again=await finishResponse(new Request(url,{headers:{'If-None-Match':`"other", ${etag}`}}),Response.json({value:0,fetched_at:'two'}),url);assert.equal(again.status,304);assert.equal(await again.text(),'');
 const fail=await finishResponse(new Request(url,{headers:{'If-None-Match':'*'}}),Response.json({error:'timeout'},{status:503}),url);assert.equal(fail.status,503);
 const head=await finishResponse(new Request(url,{method:'HEAD'}),Response.json({value:0}),url);assert.equal(head.status,200);assert.equal(await head.text(),'');assert.ok(head.headers.get('etag'));
 assert.notEqual(await digest({value:0}),await digest({value:null}));
});
test('actual handler isolates selections sharing a cached full desk and preserves legacy fields',async t=>{
 const body=copy('wales');cache(t,body);
 const full=await worker.fetch(new Request('https://www.morningrows.com/wales.json'));const legacy=await full.json();for(const k of Object.keys(body))assert.deepEqual(legacy[k],body[k]);assert.ok(legacy._meta);
 assert.ok(Number(full.headers.get('cache-control').match(/max-age=(\d+)/)[1])<=20);assert.equal(full.headers.get('x-mr-cache-expires-at'),null);
 const url='https://www.morningrows.com/wales.json?source=projection&measure=population-2024-based';const one=await worker.fetch(new Request(url));assert.equal(one.status,200);const selected=await one.json();assert.equal(selected.observations.length,1);assert.ok(selected.id.startsWith('https://morningrows.com/'));
 assert.equal((await worker.fetch(new Request(url,{headers:{'If-None-Match':one.headers.get('etag')}}))).status,304);
 assert.equal((await worker.fetch(new Request('https://morningrows.com/wales.json?date=2020'))).status,400);
 assert.equal((await worker.fetch(new Request('https://morningrows.com/wales.json?source=job'))).status,503);
});
test('old Australia alias is canonicalized without a redirect and POST is rejected',async t=>{
 cache(t,copy('australia'));const r=await worker.fetch(new Request('https://morningrows.com/morning.json'));assert.equal(r.status,200);assert.equal(r.headers.get('content-location'),'https://morningrows.com/australia.json');assert.equal((await r.json()).country,'Australia');
 assert.equal((await worker.fetch(new Request('https://morningrows.com/catalog.json',{method:'POST'}))).status,405);
});
test('Canadian reader rejects blank, missing, zero, wrong date and nonnumeric FX cells',async t=>{
 let body; t.mock.method(globalThis,'fetch',async()=>Response.json(body));
 for(const raw of ['',null,undefined,'0','bad','Infinity']) {body={observations:[{d:'2026-10-16',FXUSDCAD:{v:raw}}]};await assert.rejects(readCanadaExchange);}
 body={observations:[{d:'2026-02-30'}]};await assert.rejects(readCanadaExchange);
 body={observations:[{d:'2026-10-16',...Object.fromEntries(['FXUSDCAD','FXAUDCAD','FXGBPCAD','FXNZDCAD'].map(k=>[k,{v:'1.2'}]))}]};assert.equal((await readCanadaExchange()).rows.length,4);
});
