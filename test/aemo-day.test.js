import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aemoDayClock,aemoDayCacheSeconds,aemoDayUrl,aemoDayDefinitions,parseAemoDay,readAemoDay,validateAemoDayRepresentation,aemoDayObservationRows,AEMO_DAY_LIMIT} from '../lib/aemo-day.js';
import {readSections} from '../lib/sources.js';
const base=new URL('../research/project-demand-2026-10-17/specimens/',import.meta.url);
const original=Object.fromEntries([['SA1','aemo-sa.csv'],['VIC1','aemo-vic.csv']].map(([key,file])=>[key,readFileSync(new URL(file,base),'utf8')]));
const DAY='2026-10-16',now=()=> '2026-10-17T00:00:00.000Z';
const fetcher=async url=>new Response(original[url.includes('_SA1')?'SA1':'VIC1']);
const read=(options={})=>readAemoDay({fetcher,now,...options});

test('original research day retains288intervals each and published negative/zero distinctions',()=>{
 for(const region of ['SA1','VIC1']){const value=parseAemoDay(original[region],region,DAY);assert.equal(value.interval_count,288);assert.equal(value.intervals[0].period_end,'2026-10-16T00:05:00+10:00');assert.equal(value.intervals.at(-1).period_end,'2026-10-17T00:00:00+10:00');assert.equal(value.timezone,'fixed AEST / UTC+10; not local daylight-saving time');}
 const sa=parseAemoDay(original.SA1,'SA1',DAY),vic=parseAemoDay(original.VIC1,'VIC1',DAY);assert.equal(sa.summary.negative_count+vic.summary.negative_count,136);assert.equal(sa.summary.zero_count+vic.summary.zero_count,4);
});
test('fixedAEST day selection advances at14UTC irrespective ofDST/month/year',()=>{
 for(const [clock,day]of [['2026-10-20T13:59:59Z','2026-10-19'],['2026-10-20T14:00:00Z','2026-10-20'],['2026-09-30T14:00:00Z','2026-09-30'],['2026-12-31T14:00:00Z','2026-12-31'],['2024-03-01T00:00:00Z','2024-02-29']])assert.equal(aemoDayClock(clock).calendar_day,day);
 assert.equal(aemoDayCacheSeconds('2026-10-20T13:59:59.999Z'),0);assert.equal(aemoDayCacheSeconds('2026-10-20T13:59:00Z'),60);assert.equal(aemoDayCacheSeconds('2026-10-20T14:00:00Z'),300);
 assert.equal(aemoDayClock('2026-10-20T13:59:59Z').next_rollover_at,'2026-10-20T14:00:00.000Z');
 assert.throws(()=>aemoDayClock('2026-02-30T00:00:00Z'));assert.throws(()=>aemoDayClock('2026-10-20T00:00:00'));assert.throws(()=>aemoDayUrl('2026-02-30','SA1'));assert.throws(()=>aemoDayUrl(DAY,'NSW1'));
});
test('closingmidnight belongs to selectedstartmonth, notnextmonth',async()=>{
 const target='2026-09-30',texts=Object.fromEntries(Object.entries(original).map(([k,v])=>[k,v.replaceAll('2026/10/16','2026/09/30').replaceAll('2026/10/17','2026/10/01')]));let calls=[];
 const value=await read({now:()=> '2026-10-01T00:00:00Z',fetcher:async url=>{calls.push(url);return new Response(texts[url.includes('_SA1')?'SA1':'VIC1']);}});
 assert.equal(value.status,'ok');assert.equal(value.calendar_day,target);assert.equal(calls.length,2);assert.ok(calls.every(x=>x.includes('202609_')));assert.equal(value.regions[0].intervals.at(-1).period_end,'2026-10-01T00:00:00+10:00');
});
const mutations={wrong_region:s=>s.replace('SA1,','VIC1,'),forecast:s=>s.replace('TRADE','FORECAST'),missing:s=>s.trim().split('\n').slice(0,-1).join('\n'),duplicate:s=>s+s.trim().split('\n')[1]+'\n',off_interval:s=>s.replace('00:05:00','00:06:00'),bad_date:s=>s.replace('2026/10/16','2026/02/30'),missing_value:s=>s.replace(',79.40,',',,'),nonfinite:s=>s.replace(',79.40,',',NaN,'),infinity:s=>s.replace(',79.40,',',Infinity,'),precision:s=>s.replace(',79.40,',',79.401,'),truncated_quote:s=>s+'"',wrong_header:s=>s.replace('RRP','PRICE'),wrong_day:s=>s.replaceAll('2026/10/16','2026/10/15').replaceAll('2026/10/17','2026/10/16')};
for(const [name,mutate]of Object.entries(mutations))test('refuses '+name+' withoutpartialorolderdayfallback',()=>assert.throws(()=>parseAemoDay(mutate(original.SA1),'SA1',DAY)));
test('reverseorder normalizes and equalinterval mean uses signed exactcent ties',()=>{
 const [header,...rows]=original.SA1.trim().split('\n');assert.deepEqual(parseAemoDay([header,...rows.toReversed()].join('\n'),'SA1',DAY),parseAemoDay(original.SA1,'SA1',DAY));
 for(const [negative,expected]of [[false,.01],[true,-.01]]){const changed=rows.map((line,i)=>{const cells=line.split(',');cells[3]=i<144?(negative?'-0.01':'0.01'):'0';return cells.join(',');});const out=parseAemoDay([header,...changed].join('\n'),'SA1',DAY);assert.equal(out.summary.mean,expected);assert.equal(out.summary.zero_count,144);assert.equal(out.summary.negative_count,negative?144:0);}
});
test('typeddefinitions anddailyobservationrows preserve allten meanings',async()=>{
 const value=await read();assert.equal(value.status,'ok');assert.equal(validateAemoDayRepresentation(value,{now:now()}),true);assert.equal(aemoDayDefinitions().length,10);assert.equal(aemoDayObservationRows(value).length,10);assert.equal(aemoDayObservationRows(value)[0].measure,'SA1.mean');assert.ok(value.regions.every(r=>r.provenance.bytes>0&&/^[a-f0-9]{64}$/.test(r.provenance.sha256)));assert.equal(validateAemoDayRepresentation(value,{now:'2026-10-17T14:00:00Z'}),false);
});
test('onefailedregion preserves healthyregion and unrelatedsource',async()=>{
 const value=await read({fetcher:async url=>url.includes('_SA1')?new Response('unavailable',{status:429}):fetcher(url)});assert.equal(value.status,'degraded');assert.equal(value.regions[0].status,'error');assert.equal(value.regions[0].http_status,429);assert.equal(value.regions[1].status,'ok');assert.equal(aemoDayObservationRows(value).length,5);assert.ok(aemoDayObservationRows(value).every(x=>x.region==='VIC1'));
 const sections=await readSections({grid_day:async()=>value,unrelated:async()=>({value:7})});assert.equal(sections.unrelated.value,7);assert.equal(sections.sources.unrelated.status,'ok');
});
for(const [name,response]of [['HTTP',()=>new Response('no',{status:503})],['timeout',()=>{throw new DOMException('timeout','TimeoutError');}],['bound',()=>new Response('x'.repeat(AEMO_DAY_LIMIT+1))],['utf8',()=>new Response(new Uint8Array([255,254]))],['partial',()=>new Response(original.SA1.trim().split('\n').slice(0,20).join('\n'))]])test('bounded acquisition '+name,async()=>{const value=await read({fetcher:async()=>response()});assert.equal(value.status,'error');assert.ok(value.regions.every(x=>x.status==='error'&&!x.summary&&!x.intervals));assert.equal(aemoDayObservationRows(value).length,0);});
test('requestcrossingmidnight refusesmixeddates',async()=>{let i=0;await assert.rejects(read({now:()=>i++?'2026-10-17T14:00:00Z':'2026-10-17T13:59:59Z'}),/crossed fixed-AEST midnight/);});
test('publicrepresentation detects changedvalues,counts,clock,provenance andcoverage',async()=>{
 const originalValue=await read();const mutateCases=[x=>x.regions[0].summary.mean++,x=>x.regions[0].summary.negative_count++,x=>x.regions[0].intervals[0].price++,x=>x.regions[0].intervals.pop(),x=>x.regions[0].provenance.retrieved_at='2026-10-18T00:00:00Z',x=>x.next_rollover_at='2026-10-18T14:00:00.000Z',x=>x.timezone='Australia/Melbourne',x=>x.regions[0].region='NSW1',x=>x.published_at='2026-10-17T00:00:00Z',x=>x.regions[0].provenance.bytes=AEMO_DAY_LIMIT+1];
 for(const mutate of mutateCases){const changed=structuredClone(originalValue);mutate(changed);assert.equal(validateAemoDayRepresentation(changed),false);}
});

test('fresh19Octoberoriginals reproduce separately extracted regional summaries',()=>{
 const base=new URL('../verification/gap-pass-2026-10-20/aemo/original/',import.meta.url);
 for(const [region,mean,negative,zero]of [['SA1',6.73,189,2],['VIC1',-7.80,206,9]]){
  const csv=readFileSync(new URL('monthly-'+region+'-2026-10-19.csv',base),'utf8'),value=parseAemoDay(csv,region,'2026-10-19');
  assert.equal(value.interval_count,288);assert.equal(value.summary.mean,mean);assert.equal(value.summary.negative_count,negative);assert.equal(value.summary.zero_count,zero);
 }
});

test('publicguard fails explicitly missing or malformed acquisition clocks',async()=>{
 const value=await read();assert.equal(validateAemoDayRepresentation(value),true);
 for(const acquisition of [{now:undefined},{now:null},{now:'bad'},{},null,[]])assert.equal(validateAemoDayRepresentation(value,acquisition),false);
});
