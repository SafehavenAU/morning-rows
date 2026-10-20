// Local fixture construction only; never bundled into the remote reader.
import {readFileSync} from 'node:fs';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
const base=new URL('../original/',import.meta.url),INDEX='https://nemweb.com.au/Reports/CURRENT/Public_Prices/';
const names=['PUBLIC_PRICES_202610180000_20261019040502.zip','PUBLIC_PRICES_202610190000_20261020040503.zip'];
const index=readFileSync(new URL('directory-listing-excerpt.html',base),'utf8');
const originals=names.map(name=>({url:INDEX+name,data:readFileSync(new URL(name,base))}));
const texts=originals.map((item,i)=>strFromU8(unzipSync(item.data)[names[i].replace('.zip','.CSV')]));
const rows=text=>text.trimEnd().split(/\r?\n/).map(line=>line.split(',').map(x=>x.startsWith('"')?x.slice(1,-1):x));
const csv=values=>values.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
const zipped=(name,text)=>zipSync({[name.replace('.zip','.CSV')]:strToU8(text)},{level:6,mtime:new Date('2026-10-20T00:00:00Z')});
const encoded=inputs=>inputs.map(x=>({url:x.url,data:Buffer.from(x.data).toString('base64')}));
function changed(mutator){return originals.map((o,i)=>{let values=rows(texts[i]);values=mutator(values,i)||values;values.at(-1)[2]=String(values.length);return {url:o.url,data:zipped(names[i],csv(values))};});}
function cell(field,value,{remove=false,duplicate=false,layout,both=false}={}){return changed((values,i)=>{if(i)return values;const indexes=[];for(let n=0;n<values.length;n++){const row=values[n];if(row[0]==='D'&&(row[6]==='SA1'||both&&row[6]==='VIC1')&&row[4]==='2026/10/19 00:05:00'&&(!layout||row[3]===layout)){indexes.push(n);if(!remove&&!duplicate)row[field]=value;}}for(const n of indexes.reverse()){if(remove)values.splice(n,1);if(duplicate)values.splice(n,0,[...values[n]]);}return values;});}
function allPrices(value){return changed(values=>{for(const row of values)if(row[0]==='D'&&row[6]==='SA1')row[8]=value;return values;});}
const cases=[];
function add(name,{inputs=originals,index:idx=index,transport,clock}={},expected='ok',extra={}){cases.push({name,payload:{index:idx,inputs:encoded(inputs),...(transport?{transport}:{}),...(clock?{clock}:{})},expected,expected_calls:extra.calls??3,...extra});}
add('fixture');
add('missing-latest',{index:index.replace(new RegExp('<A HREF="[^"]*'+names[1].replaceAll('.','\\.')+'">[^<]+</A>','i'),'')},'error',{calls:1});
add('ambiguous-revision',{index:index.replace('</pre>','<A HREF="/Reports/CURRENT/Public_Prices/PUBLIC_PRICES_202610190000_20261020040504.zip">PUBLIC_PRICES_202610190000_20261020040504.zip</A></pre>')},'error',{calls:1});
add('future-generation',{index:index.replaceAll(names[1],'PUBLIC_PRICES_202610190000_20261021040503.zip')},'error',{calls:1});
add('next-day-no-fallback',{clock:'next-day'},'error',{calls:1});
for(const transport of ['redirect','http406','timeout','index-oversize'])add(transport,{transport},'error',{calls:1});
add('zip-oversize',{transport:'zip-oversize'},'error');
for(const [name,field,value]of [['wrong-run',5,'2'],['intervention',7,'1'],['apc',11,'1'],['suspension',12,'1'],['missing-price',8,''],['suppressed-price',8,'..'],['excess-precision',8,'1.000001'],['wrong-interval',4,'2026/10/19 00:06:00']])add(name,{inputs:cell(field,value)},'degraded');
add('missing-interval',{inputs:cell(8,'',{remove:true})},'degraded');
add('duplicate-interval',{inputs:cell(8,'',{duplicate:true})},'degraded');
add('layout-disagreement',{inputs:cell(8,'999',{layout:'2'})},'degraded');
add('both-regions-fail',{inputs:cell(8,'..',{both:true})},'error');
add('wrong-dataset',{inputs:changed(values=>{values[1][1]='TREGION';return values;})},'error');
add('wrong-geography',{inputs:cell(6,'SA2')},'error');
add('changed-header',{inputs:changed(values=>{values[1][8]='ROP';return values;})},'error');
const badCrc=originals.map((o,i)=>({url:o.url,data:new Uint8Array(o.data)}));badCrc[0].data[100]^=1;add('corrupt-zip',{inputs:badCrc},'error');
const multiple=originals.map((o,i)=>i?o:{url:o.url,data:zipSync({[names[0].replace('.zip','.CSV')]:strToU8(texts[0]),extra:strToU8('x')},{mtime:new Date('2026-10-20T00:00:00Z')})});add('multiple-members',{inputs:multiple},'error');
const expanded=originals.map((o,i)=>i?o:{url:o.url,data:zipped(names[0],'x'.repeat(2097153))});add('expansion-limit',{inputs:expanded},'error');
const lying=originals.map((o,i)=>({url:o.url,data:new Uint8Array(o.data)}));const d=new DataView(lying[0].data.buffer);const central=d.getUint32(lying[0].data.length-6,true);d.setUint32(22,1000000,true);d.setUint32(central+24,1000000,true);add('actual-expansion-mismatch',{inputs:lying},'error');
for(const clock of ['bad','post-hash','post-validation'])add(clock,{clock},'error',{calls:clock==='bad'?0:3});
for(const [name,raw,price,negative,zero]of [['positive-half-cent','0.005',0.01,0,0],['negative-half-cent','-0.005',-0.01,288,0],['rounded-negative-zero','-0.00499',0,0,288],['scientific-tiny','3E-05',0,0,288]])add(name,{inputs:allPrices(raw)},'ok',{summary:{mean:price,minimum:price,maximum:price,negative_count:negative,zero_count:zero}});
export {cases};
