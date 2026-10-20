import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {AEMO_DAILY_INDEX,AEMO_DAILY_LIMITS,aemoDailyBundleClock,aemoDailyBundleCacheSeconds,discoverAemoDailyBundles,parseAemoDailyBundles,readAemoDailyBundles,validateAemoDailyBundlesRepresentation,aemoDailyBundleDefinitions,aemoDailyBundleObservationRows} from '../lib/aemo-daily-bundles.js';
const DIR=new URL('../verification/gap-followup-2026-10-20/aemo-daily/original/',import.meta.url);
const NOW='2026-10-20T12:30:00.000Z';
const INDEX=readFileSync(new URL('directory-listing-excerpt.html',DIR),'utf8');
const selected=discoverAemoDailyBundles(INDEX,{now:NOW});
const original=selected.map(item=>({url:item.url,data:new Uint8Array(readFileSync(new URL(item.filename,DIR)))}));
const originalTexts=original.map((item,i)=>strFromU8(unzipSync(item.data)[selected[i].filename.replace('.zip','.CSV')]));
const clone=structuredClone;
const parsed=()=>parseAemoDailyBundles(original,{now:NOW});
const entries=text=>text.trimEnd().split(/\r?\n/).map(line=>line.split(',').map(cell=>cell.startsWith('"')?cell.slice(1,-1):cell));
const csv=rows=>rows.map(r=>r.map(s=>'"'+String(s).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
function changed(mutator){return original.map((item,i)=>{let rows=entries(originalTexts[i]);rows=mutator(rows,i)||rows;rows.at(-1)[2]=String(rows.length);const filename=selected[i].filename.replace('.zip','.CSV');return {url:item.url,data:zipSync({[filename]:strToU8(csv(rows))},{level:6})};});}
function oneSaCell(field,value,{layout,remove=false,duplicate=false}={}){
 return changed((rows,i)=>{if(i)return rows;const indexes=[];for(let n=0;n<rows.length;n++){const r=rows[n];if(r[0]==='D'&&r[6]==='SA1'&&r[4]==='2026/10/19 00:05:00'&&(!layout||r[3]===layout)){indexes.push(n);if(!remove&&!duplicate)r[field]=value;}}
  for(const n of indexes.reverse()){if(remove)rows.splice(n,1);if(duplicate)rows.splice(n,0,[...rows[n]]);}return rows;});
}
function mockFetcher({index=INDEX,inputs=original,override}={}){
 const calls=[];
 return {calls,fetcher:async(url,options)=>{calls.push({url,options});if(override){const response=override(url,options,calls.length);if(response)return response;}
  if(url===AEMO_DAILY_INDEX)return new Response(index,{headers:{'content-type':'text/html'}});
  const found=inputs.find(p=>p.url===url);assert.ok(found,'No unadvertised or monthly request');return new Response(found.data,{headers:{'content-type':'application/zip'}});
 }};
}
const read=async options=>{const m=mockFetcher(options);const value=await readAemoDailyBundles({fetcher:m.fetcher,now:()=>NOW});return {value,calls:m.calls};};

test('original two daily ZIPs reconstruct exact full completed day and prior monthly cent summaries',()=>{
 const value=parsed();assert.equal(value.status,'ok');assert.equal(value.calendar_day,'2026-10-19');assert.equal(value.regions.length,2);
 assert.deepEqual(value.regions.map(r=>r.summary),[{mean:6.73,minimum:-169.96,maximum:95.76,negative_count:189,zero_count:2},{mean:-7.8,minimum:-44.47,maximum:75.18,negative_count:206,zero_count:9}]);
 for(const r of value.regions){assert.equal(r.intervals.length,288);assert.equal(r.intervals[0].period_end,'2026-10-19T00:05:00+10:00');assert.equal(r.intervals.at(-1).period_end,'2026-10-20T00:00:00+10:00');assert.equal(r.intervals.filter(x=>x.source_url===selected[0].url).length,48);assert.equal(r.intervals.filter(x=>x.source_url===selected[1].url).length,240);}
 assert.equal(validateAemoDailyBundlesRepresentation(value),true);assert.equal(validateAemoDailyBundlesRepresentation(value,{now:NOW}),false,'pure parser is not public provenance');
 const monthlyDir=new URL('../verification/gap-pass-2026-10-20/aemo/original/',import.meta.url);
 for(const r of value.regions){const rows=entries(readFileSync(new URL(`monthly-${r.region}-2026-10-19.csv`,monthlyDir),'utf8'));assert.equal(rows[0][3],'RRP');assert.equal(rows.length,289);for(let i=1;i<rows.length;i++){assert.equal(rows[i][0],r.region);assert.equal(rows[i][4],'TRADE');assert.equal(r.intervals[i-1].price,Number(rows[i][3]));}}
});
test('definitions and derived rows retain dataset flags, geography, rounding and no invented TRADE/FIRM',()=>{
 const value=parsed(),defs=aemoDailyBundleDefinitions(),rows=aemoDailyBundleObservationRows(value);assert.equal(defs.length,10);assert.equal(new Set(defs.map(d=>d.id)).size,10);assert.equal(rows.length,10);
 for(const row of rows){assert.equal(row.measure,row.measure_id);assert.equal(row.dataset,'DREGION');assert.equal(row.runno,1);assert.equal(row.intervention,0);assert.equal(Object.hasOwn(row,'period_type'),false);assert.equal(Object.hasOwn(row,'price_status'),false);assert.match(row.revision_status,/not established/);}
});
test('latest-day clock is fixed AEST, including month/year boundary and cache clipping',()=>{
 assert.equal(aemoDailyBundleClock('2026-10-20T13:59:59.000Z').calendar_day,'2026-10-19');assert.equal(aemoDailyBundleCacheSeconds('2026-10-20T13:59:59.000Z'),1);
 assert.equal(aemoDailyBundleClock('2026-10-20T14:00:00.000Z').calendar_day,'2026-10-20');assert.equal(aemoDailyBundleClock('2026-12-31T14:00:00.000Z').calendar_day,'2026-12-31');
 assert.equal(aemoDailyBundleClock('2026-03-31T14:00:00.000Z').calendar_day,'2026-03-31');assert.throws(()=>aemoDailyBundleClock('2026-10-20'));assert.throws(()=>aemoDailyBundleCacheSeconds(NOW,-1));
});
test('discovery selects exactly advertised adjacent trading days, not guessed suffix',()=>{assert.equal(selected[0].trading_day,'2026-10-18');assert.equal(selected[1].trading_day,'2026-10-19');assert.equal(selected[1].filename,'PUBLIC_PRICES_202610190000_20261020040503.zip');});
const discoveryControls={
 'missing newest bundle':s=>s.replace(new RegExp('<A HREF="[^"]*'+selected[1].filename.replaceAll('.','\\.')+'">[^<]+</A>','i'),''),
 'duplicate advertised entry':s=>s.replace('</pre>',`<A HREF="/Reports/CURRENT/Public_Prices/${selected[1].filename}">${selected[1].filename}</A></pre>`),
 'ambiguous newer same-day file':s=>s.replace('</pre>','<A HREF="/Reports/CURRENT/Public_Prices/PUBLIC_PRICES_202610190000_20261020040504.zip">PUBLIC_PRICES_202610190000_20261020040504.zip</A></pre>'),
 'mismatched filename text':s=>s.replace('>'+selected[1].filename+'<','>PUBLIC_PRICES_202610190000_20261020040504.zip<'),
 'external href':s=>s.replace('/Reports/CURRENT/Public_Prices/'+selected[1].filename,'https://other.example/'+selected[1].filename),
 'query suffix':s=>s.replace('/Reports/CURRENT/Public_Prices/'+selected[1].filename,'/Reports/CURRENT/Public_Prices/'+selected[1].filename+'?x=1'),
 'wrong title':s=>s.replace('nemweb.com.au -','forecast.example -'),
 'duplicate listing':s=>s+'<pre></pre>',
 'invalid calendar filename':s=>s.replaceAll(selected[1].filename,'PUBLIC_PRICES_202613190000_20261020040503.zip'),
 'future generation':s=>s.replaceAll(selected[1].filename,'PUBLIC_PRICES_202610190000_20261021040503.zip'),
 'early generation':s=>s.replaceAll(selected[1].filename,'PUBLIC_PRICES_202610190000_20261020035959.zip'),
};
for(const [name,mutation]of Object.entries(discoveryControls))test('discovery refuses '+name,()=>assert.throws(()=>discoverAemoDailyBundles(mutation(INDEX),{now:NOW})));
test('before required daily publication is unavailable, not previous-day fallback',()=>assert.throws(()=>discoverAemoDailyBundles(INDEX,{now:'2026-10-19T14:01:00.000Z'}),/future-dated/));
test('strict discovery bounds index and clock',()=>{assert.throws(()=>discoverAemoDailyBundles('x'.repeat(AEMO_DAILY_LIMITS.index+1),{now:NOW}));assert.throws(()=>discoverAemoDailyBundles(INDEX));assert.throws(()=>parseAemoDailyBundles(original,{now:'2026-10-21T12:00:00.000Z'}));assert.throws(()=>parseAemoDailyBundles([...original].reverse(),{now:NOW}));});
for(const [name,field,token]of [['run',5,'2'],['intervention',7,'1'],['administered-price flag',11,'1'],['suspension',12,'1'],['suppressed RRP',8,'..'],['missing RRP',8,''],['NaN RRP',8,'NaN'],['infinite RRP',8,'Infinity'],['six-decimal RRP',8,'1.234567'],['scientific excessive precision',8,'3E-06'],['out-of-bounds magnitude',8,'9999999999999'],['shifted timestamp',4,'2026/10/19 00:04:00'],['wrong trading date',4,'2026/10/21 00:05:00'],['invalid timestamp',4,'2026/02/30 00:05:00']])test(name+' invalidates affected region and preserves sibling',()=>{
 const value=parseAemoDailyBundles(oneSaCell(field,token),{now:NOW});assert.equal(value.status,'degraded');assert.equal(value.regions[0].status,'error');assert.equal(Object.hasOwn(value.regions[0],'summary'),false);assert.deepEqual(value.regions[1],parsed().regions[1]);assert.equal(validateAemoDailyBundlesRepresentation(value),true);
});
for(const [name,args]of [['missing',{remove:true}],['duplicate',{duplicate:true}],['layout disagreement',{layout:'2'}]])test(name+' selected cell never yields partial mean',()=>{const value=parseAemoDailyBundles(oneSaCell(8,'123.45',args),{now:NOW});assert.equal(value.status,'degraded');assert.equal(value.regions[0].status,'error');assert.equal(aemoDailyBundleObservationRows(value).length,5);});
test('wrong supported region cannot replace SA1',()=>{const value=parseAemoDailyBundles(oneSaCell(6,'NSW1'),{now:NOW});assert.equal(value.status,'degraded');assert.equal(value.regions[0].status,'error');});
for(const [raw,price,negative,zero]of [['0.005',0.01,0,0],['-0.005',-0.01,288,0],['-0.00499',0,0,288],['3E-05',0,0,288],['-3E-05',0,0,288],['1.23456',1.23,0,0],['-1.23500',-1.24,288,0],['0',0,0,288]])test('exact per-interval half-away rounding '+raw,()=>{
 const inputs=changed(rows=>{for(const r of rows)if(r[0]==='D'&&r[6]==='SA1')r[8]=raw;return rows;});const value=parseAemoDailyBundles(inputs,{now:NOW});assert.equal(value.status,'ok');const r=value.regions[0];assert.equal(r.summary.mean,price);assert.equal(r.summary.minimum,price);assert.equal(r.summary.maximum,price);assert.equal(r.summary.negative_count,negative);assert.equal(r.summary.zero_count,zero);assert.equal(r.intervals[0].price_raw,raw);
});
for(const sign of [-1,1])test('mean rounds half away after per-interval cents '+sign,()=>{
 const inputs=changed(rows=>{for(const r of rows)if(r[0]==='D'&&r[6]==='SA1')r[8]=r[4]>='2026/10/19 00:05:00'&&r[4]<='2026/10/19 12:00:00'?String(sign/100):'0';return rows;});
 const value=parseAemoDailyBundles(inputs,{now:NOW});assert.equal(value.regions[0].summary.mean,sign/100);assert.equal(value.regions[0].summary.negative_count,sign===-1?144:0);assert.equal(value.regions[0].summary.zero_count,144);
});
function replaceZip(zip,mutator){const copy=new Uint8Array(zip);mutator(copy,new DataView(copy.buffer),copy.length-22);return [{url:original[0].url,data:copy},original[1]];}
const zipControls={
 'corrupt CRC':(b,d,e)=>{d.setUint32(14,0,true);d.setUint32(d.getUint32(e+16,true)+16,0,true);},
 'advertised oversized expansion':(b,d,e)=>{d.setUint32(22,AEMO_DAILY_LIMITS.expanded+1,true);d.setUint32(d.getUint32(e+16,true)+24,AEMO_DAILY_LIMITS.expanded+1,true);},
 'lying expansion size':(b,d,e)=>{d.setUint32(22,30,true);d.setUint32(d.getUint32(e+16,true)+24,30,true);},
 'encryption flags':(b,d,e)=>{d.setUint16(6,1,true);d.setUint16(d.getUint32(e+16,true)+8,1,true);},
 'descriptor flags':(b,d,e)=>{d.setUint16(6,8,true);d.setUint16(d.getUint32(e+16,true)+8,8,true);},
 'multi-volume':(b,d,e)=>d.setUint16(e+4,1,true),
 'multiple members':(b,d,e)=>{d.setUint16(e+8,2,true);d.setUint16(e+10,2,true);},
 'central outside archive':(b,d,e)=>d.setUint32(e+16,b.length+5,true),
 'header disagreement':(b,d)=>d.setUint32(22,12345,true),
 'ZIP extra field':(b,d,e)=>d.setUint16(d.getUint32(e+16,true)+30,1,true),
 'ZIP comment':(b,d,e)=>d.setUint16(e+20,1,true),
 'symlink member':(b,d,e)=>d.setUint32(d.getUint32(e+16,true)+38,0xa0000000,true),
};
for(const [name,mutator]of Object.entries(zipControls))test('ZIP refuses '+name,()=>assert.throws(()=>parseAemoDailyBundles(replaceZip(original[0].data,mutator),{now:NOW})));
test('ZIP refuses raw non-ZIP, truncated, too big and nested/path-traversal/wrong member',()=>{
 for(const data of [new Uint8Array(100),original[0].data.slice(0,-5),new Uint8Array(AEMO_DAILY_LIMITS.compressed+1),zipSync({'../prices.CSV':strToU8('x')}),zipSync({'nested.zip':strToU8('x')}),zipSync({'wrong.CSV':strToU8('x')})])assert.throws(()=>parseAemoDailyBundles([{url:original[0].url,data},original[1]],{now:NOW}));
});
for(const [name,mutation]of [
 ['wrong report identity',rows=>{rows[0][2]='PREDISPATCH';return rows;}],
 ['generation mismatch',rows=>{rows[0][6]='04:05:04';return rows;}],
 ['unknown layout',rows=>rows.map(r=>r[1]==='DREGION'?[r[0],r[1],r[2],'4',...r.slice(4)]:r)],
 ['wrong table',rows=>rows.map(r=>r[1]==='DREGION'?[r[0],'PREDISPATCH',...r.slice(2)]:r)],
 ['duplicate column',rows=>{for(const r of rows)if(r[0]==='I')r[9]='RRP';return rows;}],
 ['missing layout',rows=>rows.filter(r=>r[1]!=='DREGION'||r[3]!=='2')],
 ['invalid row width',rows=>{rows.find(r=>r[0]==='D').pop();return rows;}],
 ['unknown region',rows=>{rows.find(r=>r[0]==='D')[6]='AU';return rows;}],
 ['duplicate header',rows=>{rows.splice(2,0,[...rows[1]]);return rows;}]
])test('CSV refuses '+name,()=>assert.throws(()=>parseAemoDailyBundles(changed(mutation),{now:NOW})));
test('CSV refuses malformed quotes, UTF-8, trailer, record count, and actual expanded overflow',()=>{
 const filename=selected[0].filename.replace('.zip','.CSV');
 const cases=[strToU8(originalTexts[0].replace('C,"END OF REPORT",2884','C,"END OF REPORT",1')),strToU8(originalTexts[0].replace('I,DREGION','I,"DREGION')),new Uint8Array([0xff,0xfe]),strToU8('x\n'.repeat(3001)),new Uint8Array(AEMO_DAILY_LIMITS.expanded+1)];
 for(const bytes of cases)assert.throws(()=>parseAemoDailyBundles([{url:original[0].url,data:zipSync({[filename]:bytes},{level:6})},original[1]],{now:NOW}));
});
test('actual reader shares exactly three bounded requests and preserves wire/member provenance',async()=>{
 const {value,calls}=await read();assert.equal(value.status,'ok');assert.equal(calls.length,3);assert.deepEqual(calls.map(c=>c.url),[AEMO_DAILY_INDEX,...selected.map(s=>s.url)]);
 for(const c of calls){assert.equal(c.options.redirect,'manual');assert.ok(c.options.signal instanceof AbortSignal);assert.deepEqual(Object.keys(c.options.headers),['accept']);}
 assert.equal(value.provenance.length,3);assert.equal(value.provenance[1].sha256,'d4f41531f9d1deb496270c02bdf2542cba9ea65443d4cf0167d9b9a43aece03f');assert.equal(value.provenance[2].csv_sha256,'633d8fad4d671deb268cec3dc4648f09b2de67c6e9c82851417d171712b206b0');assert.equal(validateAemoDailyBundlesRepresentation(value,{now:NOW}),true);
});
for(const status of [302,403,406,429,500])test('HTTP '+status+' is refused without retry or monthly fallback',async()=>{const mock=mockFetcher({override:url=>url===selected[1].url?new Response('no',{status}):undefined});await assert.rejects(readAemoDailyBundles({fetcher:mock.fetcher,now:()=>NOW}));assert.equal(mock.calls.length,3);});
test('declared/streamed size limits, redirects and malformed index cannot trigger extra fetches',async()=>{
 for(const kind of ['declared','streamed','redirect','badindex']){
  const mock=mockFetcher({override:url=>{if(url!==AEMO_DAILY_INDEX)return;let response;if(kind==='declared')return new Response(INDEX,{headers:{'content-length':String(AEMO_DAILY_LIMITS.index+1)}});if(kind==='streamed')return new Response('x'.repeat(AEMO_DAILY_LIMITS.index+1));if(kind==='badindex')return new Response('<html>Request Rejected</html>');response=new Response(INDEX);Object.defineProperty(response,'url',{value:'https://other.example/index'});return response;}});
  await assert.rejects(readAemoDailyBundles({fetcher:mock.fetcher,now:()=>NOW}));assert.equal(mock.calls.length,1);
 }
});
test('clock rollover and backward clock refuse a mixed-date acquisition',async()=>{
 for(const finish of ['2026-10-20T14:00:00.000Z','2026-10-20T11:00:00.000Z']){
  const mock=mockFetcher();let count=0;const now=()=>++count>=8?finish:NOW;await assert.rejects(readAemoDailyBundles({fetcher:mock.fetcher,now}));assert.equal(mock.calls.length,3);
 }
});
test('final clock includes parsing, hashing and validation before return',async()=>{
 for(const crossingCall of [9,10]){const mock=mockFetcher();let count=0;await assert.rejects(readAemoDailyBundles({fetcher:mock.fetcher,now:()=>++count>=crossingCall?'2026-10-20T14:00:00.000Z':NOW}),/midnight/);assert.equal(mock.calls.length,3);}
});
test('successful public validator requires explicit clock and rejects undefined/null/empty',async()=>{
 const {value}=await read();assert.equal(validateAemoDailyBundlesRepresentation(value,{now:NOW}),true);
 for(const invalid of [undefined,null,{},[],{now:undefined},{now:null},{now:'2026-10-21T12:30:00.000Z'},{now:'2026-10-20'}])assert.equal(validateAemoDailyBundlesRepresentation(value,invalid),false);
 for(const invalid of [null,undefined,[],{},'x'])assert.equal(validateAemoDailyBundlesRepresentation(invalid,{now:NOW}),false);
});
const mutations={
 'wrong geography':v=>v.regions[0].geography='Australia',
 'wrong unit':v=>v.regions[0].unit='AUD/kWh',
 'wrong run':v=>v.regions[0].runno=2,
 'invented finality':v=>v.finality='FIRM',
 'invented TRADE field':v=>v.regions[0].period_type='TRADE',
 'missing interval':v=>v.regions[0].intervals.pop(),
 'duplicated interval':v=>v.regions[0].intervals[1]=v.regions[0].intervals[0],
 'wrong raw rounding':v=>v.regions[0].intervals[0].price+=0.01,
 'wrong source bundle':v=>v.regions[0].intervals[0].source_url=v.bundles[1].url,
 'wrong raw layout':v=>v.regions[0].intervals[0].layout2_price_raw='999',
 'summary mutation':v=>v.regions[0].summary.mean+=0.01,
 'count mutation':v=>v.regions[0].summary.zero_count++,
 'false success':v=>v.status='degraded',
 'definition mutation':v=>v.definitions[0].population='All Australia',
 'provenance omitted':v=>v.provenance=[],
 'bundle swapped':v=>v.bundles.reverse(),
 'hash malformed':v=>v.provenance[1].sha256='a',
 'CSV size changed':v=>v.provenance[1].csv_bytes++,
 'future acquisition':v=>v.provenance[1].retrieved_at='2026-10-20T13:00:00.000Z',
 'request before index':v=>v.provenance[1].requested_at='2026-10-20T12:29:00.000Z',
 'error converted to zero':v=>{v.regions[0].status='error';v.regions[0].error='Unavailable';v.regions[0].summary.mean=0;},
 'old source date':v=>v.calendar_day='2026-10-18',
 'inferred publication':v=>v.published_at='2026-10-20T04:05:03+10:00',
};
for(const [name,mutation]of Object.entries(mutations))test('public validator refuses '+name,async()=>{const {value}=await read();mutation(value);assert.equal(validateAemoDailyBundlesRepresentation(value,{now:NOW}),false);});
