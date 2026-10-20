import {Inflate} from 'fflate';
import {fetchOfficial, SourceError, describeError} from './sources.js';
import {aemoDayClock, aemoDayCacheSeconds} from './aemo-day.js';

export const AEMO_DAILY_INDEX='https://nemweb.com.au/Reports/CURRENT/Public_Prices/';
export const AEMO_DAILY_LIMITS=Object.freeze({index:131072,compressed:524288,expanded:2097152,records:3000});
export const AEMO_DAILY_REGIONS=Object.freeze({SA1:'South Australia',VIC1:'Victoria'});
export const aemoDailyBundleClock=aemoDayClock;
export const aemoDailyBundleCacheSeconds=aemoDayCacheSeconds;
const DAY=86400000,INTERVAL=300000,OFFSET=36000000;
const timezone='fixed AEST / UTC+10; not local daylight-saving time';
const publisher='Australian Energy Market Operator';
const licence='AEMO copyright permissions; accurate attribution required';
const licence_url='https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions';
const requested_day_policy='latest fully elapsed fixed-AEST calendar day; no earlier-day fallback';
const rounding='Each raw RRP rounded to AUD/MWh cents, half away from zero, before summary and sign counts';
const limitations='Two NEM regions only; no Australian average, retail bill, forecast or moving 24-hour window. Daily DREGION run 1, intervention 0, APCFLAG 0 and MARKETSUSPENDEDFLAG 0 only. Layouts 2 and 3 must agree; they are not observation vintages. No FIRM field or finality claim. Raw RRP is retained; zero after cent rounding does not establish an exactly zero raw price. Equal-interval mean is not demand-weighted. Latest elapsed day remains unavailable until both required trading-day bundles are complete. Publication and correction schedules are not established.';
const statistics=Object.freeze({mean:{unit:'AUD/MWh',name:'Equal-interval mean wholesale price'},minimum:{unit:'AUD/MWh',name:'Minimum five-minute wholesale price'},maximum:{unit:'AUD/MWh',name:'Maximum five-minute wholesale price'},negative_count:{unit:'five-minute intervals',name:'Count of negative cent-rounded five-minute prices'},zero_count:{unit:'five-minute intervals',name:'Count of zero cent-rounded five-minute prices'}});
const fail=message=>{throw new SourceError('AEMO daily bundles: '+message);};
const requireValue=(ok,message)=>{if(!ok)fail(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const dateMs=value=>{requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'Invalid calendar day');const ms=Date.parse(value+'T00:00:00Z');requireValue(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value,'Invalid calendar date');return ms;};
const dayString=ms=>new Date(ms).toISOString().slice(0,10);
function instant(value){aemoDayClock(value);return value instanceof Date?value.getTime():Date.parse(value);}
function localStamp(value){
 requireValue(typeof value==='string'&&/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(value),'Invalid NEM timestamp');
 const normalized=value.replaceAll('/','-').replace(' ','T'),ms=Date.parse(normalized+'Z');
 requireValue(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,19)===normalized,'Invalid NEM calendar timestamp');return ms;
}
const localIso=ms=>new Date(ms).toISOString().slice(0,19)+'+10:00';
function descriptor(url){
 requireValue(typeof url==='string'&&url.startsWith(AEMO_DAILY_INDEX),'Unexpected daily source URL');
 const filename=url.slice(AEMO_DAILY_INDEX.length),m=/^PUBLIC_PRICES_(\d{8})0000_(\d{14})\.zip$/.exec(filename);
 requireValue(m,'Unsupported daily bundle filename');
 const trading_day=m[1].replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),start=dateMs(trading_day);
 const generated=m[2].replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1/$2/$3 $4:$5:$6'),generatedMs=localStamp(generated);
 requireValue(generatedMs>=start+DAY+4*3600000,'Bundle generation precedes trading-day completion');
 return {trading_day,url,filename,report_generated_at:localIso(generatedMs)};
}
export function discoverAemoDailyBundles(text,{now}={}){
 const acquired=instant(now),day=aemoDayClock(now).calendar_day;
 requireValue(typeof text==='string'&&new TextEncoder().encode(text).byteLength<=AEMO_DAILY_LIMITS.index,'Invalid or oversized directory index');
 requireValue(/<title>\s*nemweb\.com\.au - \/Reports\/CURRENT\/Public_Prices\/\s*<\/title>/i.test(text),'Unexpected directory title');
 const lists=[...text.matchAll(/<pre>([\s\S]*?)<\/pre>/gi)];requireValue(lists.length===1,'Ambiguous directory listing');
 const required=[dayString(dateMs(day)-DAY),day],found=new Map(required.map(d=>[d,new Map()]));
 const anchors=[...lists[0][1].matchAll(/<a\s+href="([^"]+)"\s*>([^<]+)<\/a>/gi)];requireValue(anchors.length>0&&anchors.length<=200,'Invalid index link count');
 for(const [,href,label]of anchors){
  if(!label.startsWith('PUBLIC_PRICES_'))continue;
  requireValue(href==='/Reports/CURRENT/Public_Prices/'+label,'Mismatched or external directory link');
  const item=descriptor('https://nemweb.com.au'+href);
  if(found.has(item.trading_day)){
   requireValue(Date.parse(item.report_generated_at)<=acquired,'Advertised bundle is future-dated');
   requireValue(!found.get(item.trading_day).has(item.url),'Duplicate directory entry');found.get(item.trading_day).set(item.url,item);
  }
 }
 return required.map(d=>{const choices=[...found.get(d).values()];requireValue(choices.length===1,choices.length?'Ambiguous revisions for required trading day':'Latest elapsed day is unpublished; required trading bundle missing');return choices[0];});
}
export function aemoDailyBundleDefinitions(){return Object.entries(AEMO_DAILY_REGIONS).flatMap(([region,geography])=>Object.entries(statistics).map(([statistic,details])=>({id:region+'.'+statistic,name:details.name,geography,unit:details.unit,kind:'derived',population:'Regional reference prices for all 288 five-minute intervals in one completed fixed-AEST calendar day; actual DREGION run 1, intervention 0',adjustment:'Nominal wholesale prices; no seasonal or inflation adjustment',period_convention:'YYYY-MM-DD calendar day in fixed AEST UTC+10; interval endings 00:05 through next 00:00',cadence:'completed calendar day; daily-bundle publication and correction timing not established',dimensions:{region,statistic,dataset:'DREGION',runno:1,intervention:0,apcflag:0,market_suspended_flag:0,csv_layouts:[2,3],interval_minutes:5},rounding:statistic==='mean'?rounding+'; exact integer-cent sum / 288 rounded to cents half away from zero':statistic.endsWith('_count')?rounding+'; integer interval count':rounding,revision_policy:'Mutable public publisher files; finality and correction schedule not established',publisher,licence,licence_url,source_url:AEMO_DAILY_INDEX,limitations})));}

// Strict single-member ZIP framing prevents metadata tricks before bounded inflation.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function decodeZip(bytes,name){
 requireValue(bytes instanceof Uint8Array&&bytes.length>=100&&bytes.length<=AEMO_DAILY_LIMITS.compressed,'Invalid or oversized ZIP');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22;
 requireValue(d.getUint32(end,true)===0x06054b50&&d.getUint16(end+4,true)===0&&d.getUint16(end+6,true)===0&&d.getUint16(end+8,true)===1&&d.getUint16(end+10,true)===1&&d.getUint16(end+20,true)===0,'ZIP must have one member, one volume and no comment');
 const central=d.getUint32(end+16,true),centralSize=d.getUint32(end+12,true);
 requireValue(central>=30&&central+centralSize===end&&centralSize>=46&&d.getUint32(central,true)===0x02014b50,'Invalid central directory bounds');
 const flags=d.getUint16(central+8,true),method=d.getUint16(central+10,true),crc=d.getUint32(central+16,true),compressed=d.getUint32(central+20,true),expanded=d.getUint32(central+24,true),nameLength=d.getUint16(central+28,true);
 requireValue(flags===0&&(method===0||method===8)&&d.getUint16(central+6,true)<=20&&d.getUint16(central+30,true)===0&&d.getUint16(central+32,true)===0&&d.getUint16(central+34,true)===0&&d.getUint32(central+42,true)===0&&centralSize===46+nameLength,'Unsupported ZIP flags, extra entries or attributes');
 const attrs=d.getUint32(central+38,true);requireValue((attrs&16)===0&&((attrs>>>16)&0xf000)!==0xa000,'ZIP member is not a regular file');
 requireValue(expanded>0&&expanded<=AEMO_DAILY_LIMITS.expanded&&compressed>0&&compressed<=AEMO_DAILY_LIMITS.compressed,'ZIP expansion exceeds bounds');
 requireValue(d.getUint32(0,true)===0x04034b50&&d.getUint16(4,true)<=20&&d.getUint16(6,true)===flags&&d.getUint16(8,true)===method&&d.getUint32(14,true)===crc&&d.getUint32(18,true)===compressed&&d.getUint32(22,true)===expanded&&d.getUint16(26,true)===nameLength&&d.getUint16(28,true)===0,'Local ZIP header disagrees with central metadata');
 const decode=new TextDecoder('utf-8',{fatal:true}),localName=decode.decode(bytes.subarray(30,30+nameLength)),centralName=decode.decode(bytes.subarray(central+46,central+46+nameLength));
 requireValue(localName===name&&centralName===name&&/^PUBLIC_PRICES_\d{12}_\d{14}\.CSV$/.test(name)&&30+nameLength+compressed===central,'Unexpected CSV member or payload bounds');
 const payload=bytes.subarray(30+nameLength,central),output=new Uint8Array(expanded);let written=0,finished=false;
 if(method===0){requireValue(payload.length===expanded,'Stored ZIP size mismatch');output.set(payload);written=payload.length;finished=true;}
 else{
  const inflater=new Inflate((chunk,final)=>{written+=chunk.length;requireValue(written<=expanded&&written<=AEMO_DAILY_LIMITS.expanded,'Actual ZIP expansion exceeds declared bound');output.set(chunk,written-chunk.length);finished=final;});
  for(let at=0;at<payload.length;at+=512)inflater.push(payload.subarray(at,Math.min(at+512,payload.length)),at+512>=payload.length);
 }
 requireValue(finished&&written===expanded&&crc32(output)===crc,'Corrupt or truncated CSV ZIP member');
 return output;
}
function csvLine(line){
 const cells=[];let cell='',quoted=false,closed=false,started=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];if(quoted){if(c==='"'){if(line[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
  else if(c===','){cells.push(cell);cell='';closed=false;started=false;}
  else if(c==='"'){requireValue(!started&&!closed,'Malformed CSV quote');quoted=true;started=true;}
  else{requireValue(!closed,'Characters after CSV quote');cell+=c;started=true;}
 }
 requireValue(!quoted,'Truncated CSV field');cells.push(cell);return cells;
}
// Exact 1/100000 AUD/MWh arithmetic includes the publisher's scientific notation.
function units(value){
 requireValue(typeof value==='string'&&value.length<=24,'Missing raw RRP');
 const m=/^(-?)(0|[1-9]\d{0,7})(?:\.(\d{1,5}))?(?:[Ee]([+-]?\d{1,2}))?$/.exec(value);requireValue(m,'Missing, nonfinite or unsupported RRP');
 const shift=5+(Number(m[4]||0))-(m[3]?.length||0);requireValue(shift>=0&&shift<=12,'Unsupported RRP precision');
 const scaled=BigInt(m[2]+(m[3]||''))*10n**BigInt(shift);requireValue(scaled<=9999999999999n,'RRP outside bounded numeric precision');
 return m[1]?-scaled:scaled;
}
const cents=raw=>{const value=units(raw),abs=value<0n?-value:value,rounded=(abs+500n)/1000n;return Number(value<0n?-rounded:rounded);};
function summary(values){
 const sum=values.reduce((total,value)=>total+value,0);requireValue(Number.isSafeInteger(sum),'Unsafe summary arithmetic');const abs=Math.abs(sum),rounded=Math.trunc(abs/288)+(abs%288>=144?1:0),mean=Math.sign(sum)*rounded/100;
 return {mean:mean===0?0:mean,minimum:Math.min(...values)/100,maximum:Math.max(...values)/100,negative_count:values.filter(v=>v<0).length,zero_count:values.filter(v=>v===0).length};
}
const CSV_HEADERS={"2":["I","DREGION","","2","SETTLEMENTDATE","RUNNO","REGIONID","INTERVENTION","RRP","EEP","ROP","APCFLAG","MARKETSUSPENDEDFLAG","TOTALDEMAND","DEMANDFORECAST","DISPATCHABLEGENERATION","DISPATCHABLELOAD","NETINTERCHANGE","EXCESSGENERATION","LOWER5MINDISPATCH","LOWER5MINIMPORT","LOWER5MINLOCALDISPATCH","LOWER5MINLOCALPRICE","LOWER5MINLOCALREQ","LOWER5MINPRICE","LOWER5MINREQ","LOWER5MINSUPPLYPRICE","LOWER60SECDISPATCH","LOWER60SECIMPORT","LOWER60SECLOCALDISPATCH","LOWER60SECLOCALPRICE","LOWER60SECLOCALREQ","LOWER60SECPRICE","LOWER60SECREQ","LOWER60SECSUPPLYPRICE","LOWER6SECDISPATCH","LOWER6SECIMPORT","LOWER6SECLOCALDISPATCH","LOWER6SECLOCALPRICE","LOWER6SECLOCALREQ","LOWER6SECPRICE","LOWER6SECREQ","LOWER6SECSUPPLYPRICE","RAISE5MINDISPATCH","RAISE5MINIMPORT","RAISE5MINLOCALDISPATCH","RAISE5MINLOCALPRICE","RAISE5MINLOCALREQ","RAISE5MINPRICE","RAISE5MINREQ","RAISE5MINSUPPLYPRICE","RAISE60SECDISPATCH","RAISE60SECIMPORT","RAISE60SECLOCALDISPATCH","RAISE60SECLOCALPRICE","RAISE60SECLOCALREQ","RAISE60SECPRICE","RAISE60SECREQ","RAISE60SECSUPPLYPRICE","RAISE6SECDISPATCH","RAISE6SECIMPORT","RAISE6SECLOCALDISPATCH","RAISE6SECLOCALPRICE","RAISE6SECLOCALREQ","RAISE6SECPRICE","RAISE6SECREQ","RAISE6SECSUPPLYPRICE","AGGREGATEDISPATCHERROR","AVAILABLEGENERATION","AVAILABLELOAD","INITIALSUPPLY","CLEAREDSUPPLY","LOWERREGIMPORT","LOWERREGLOCALDISPATCH","LOWERREGLOCALREQ","LOWERREGREQ","RAISEREGIMPORT","RAISEREGLOCALDISPATCH","RAISEREGLOCALREQ","RAISEREGREQ","RAISE5MINLOCALVIOLATION","RAISEREGLOCALVIOLATION","RAISE60SECLOCALVIOLATION","RAISE6SECLOCALVIOLATION","LOWER5MINLOCALVIOLATION","LOWERREGLOCALVIOLATION","LOWER60SECLOCALVIOLATION","LOWER6SECLOCALVIOLATION","RAISE5MINVIOLATION","RAISEREGVIOLATION","RAISE60SECVIOLATION","RAISE6SECVIOLATION","LOWER5MINVIOLATION","LOWERREGVIOLATION","LOWER60SECVIOLATION","LOWER6SECVIOLATION","RAISE6SECRRP","RAISE6SECROP","RAISE6SECAPCFLAG","RAISE60SECRRP","RAISE60SECROP","RAISE60SECAPCFLAG","RAISE5MINRRP","RAISE5MINROP","RAISE5MINAPCFLAG","RAISEREGRRP","RAISEREGROP","RAISEREGAPCFLAG","LOWER6SECRRP","LOWER6SECROP","LOWER6SECAPCFLAG","LOWER60SECRRP","LOWER60SECROP","LOWER60SECAPCFLAG","LOWER5MINRRP","LOWER5MINROP","LOWER5MINAPCFLAG","LOWERREGRRP","LOWERREGROP","LOWERREGAPCFLAG","LOWER1SECRRP","LOWER1SECROP","LOWER1SECAPCFLAG","RAISE1SECRRP","RAISE1SECROP","RAISE1SECAPCFLAG","RAISE1SECLOCALDISPATCH","LOWER1SECLOCALDISPATCH"],"3":["I","DREGION","","3","SETTLEMENTDATE","RUNNO","REGIONID","INTERVENTION","RRP","EEP","ROP","APCFLAG","MARKETSUSPENDEDFLAG","TOTALDEMAND","DEMANDFORECAST","DISPATCHABLEGENERATION","DISPATCHABLELOAD","NETINTERCHANGE","EXCESSGENERATION","LOWER5MINDISPATCH","LOWER5MINIMPORT","LOWER5MINLOCALDISPATCH","LOWER5MINLOCALPRICE","LOWER5MINLOCALREQ","LOWER5MINPRICE","LOWER5MINREQ","LOWER5MINSUPPLYPRICE","LOWER60SECDISPATCH","LOWER60SECIMPORT","LOWER60SECLOCALDISPATCH","LOWER60SECLOCALPRICE","LOWER60SECLOCALREQ","LOWER60SECPRICE","LOWER60SECREQ","LOWER60SECSUPPLYPRICE","LOWER6SECDISPATCH","LOWER6SECIMPORT","LOWER6SECLOCALDISPATCH","LOWER6SECLOCALPRICE","LOWER6SECLOCALREQ","LOWER6SECPRICE","LOWER6SECREQ","LOWER6SECSUPPLYPRICE","RAISE5MINDISPATCH","RAISE5MINIMPORT","RAISE5MINLOCALDISPATCH","RAISE5MINLOCALPRICE","RAISE5MINLOCALREQ","RAISE5MINPRICE","RAISE5MINREQ","RAISE5MINSUPPLYPRICE","RAISE60SECDISPATCH","RAISE60SECIMPORT","RAISE60SECLOCALDISPATCH","RAISE60SECLOCALPRICE","RAISE60SECLOCALREQ","RAISE60SECPRICE","RAISE60SECREQ","RAISE60SECSUPPLYPRICE","RAISE6SECDISPATCH","RAISE6SECIMPORT","RAISE6SECLOCALDISPATCH","RAISE6SECLOCALPRICE","RAISE6SECLOCALREQ","RAISE6SECPRICE","RAISE6SECREQ","RAISE6SECSUPPLYPRICE","AGGREGATEDISPATCHERROR","AVAILABLEGENERATION","AVAILABLELOAD","INITIALSUPPLY","CLEAREDSUPPLY","LOWERREGIMPORT","LOWERREGLOCALDISPATCH","LOWERREGLOCALREQ","LOWERREGREQ","RAISEREGIMPORT","RAISEREGLOCALDISPATCH","RAISEREGLOCALREQ","RAISEREGREQ","RAISE5MINLOCALVIOLATION","RAISEREGLOCALVIOLATION","RAISE60SECLOCALVIOLATION","RAISE6SECLOCALVIOLATION","LOWER5MINLOCALVIOLATION","LOWERREGLOCALVIOLATION","LOWER60SECLOCALVIOLATION","LOWER6SECLOCALVIOLATION","RAISE5MINVIOLATION","RAISEREGVIOLATION","RAISE60SECVIOLATION","RAISE6SECVIOLATION","LOWER5MINVIOLATION","LOWERREGVIOLATION","LOWER60SECVIOLATION","LOWER6SECVIOLATION","RAISE6SECRRP","RAISE6SECROP","RAISE6SECAPCFLAG","RAISE60SECRRP","RAISE60SECROP","RAISE60SECAPCFLAG","RAISE5MINRRP","RAISE5MINROP","RAISE5MINAPCFLAG","RAISEREGRRP","RAISEREGROP","RAISEREGAPCFLAG","LOWER6SECRRP","LOWER6SECROP","LOWER6SECAPCFLAG","LOWER60SECRRP","LOWER60SECROP","LOWER60SECAPCFLAG","LOWER5MINRRP","LOWER5MINROP","LOWER5MINAPCFLAG","LOWERREGRRP","LOWERREGROP","LOWERREGAPCFLAG","RAISE6SECACTUALAVAILABILITY","RAISE60SECACTUALAVAILABILITY","RAISE5MINACTUALAVAILABILITY","RAISEREGACTUALAVAILABILITY","LOWER6SECACTUALAVAILABILITY","LOWER60SECACTUALAVAILABILITY","LOWER5MINACTUALAVAILABILITY","LOWERREGACTUALAVAILABILITY","LORSURPLUS","LRCSURPLUS","LOWER1SECRRP","LOWER1SECROP","LOWER1SECAPCFLAG","RAISE1SECRRP","RAISE1SECROP","RAISE1SECAPCFLAG","RAISE1SECLOCALDISPATCH","LOWER1SECLOCALDISPATCH"]};
function decodeBundle(item,data){
 const csv_name=item.filename.replace(/\.zip$/,'.CSV'),bytes=decodeZip(data,csv_name),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 requireValue(!text.startsWith('\uFEFF')&&!/\r(?!\n)/.test(text),'Unsupported CSV encoding or line endings');
 const lines=text.replaceAll('\r\n','\n').split('\n');if(lines.at(-1)==='')lines.pop();
 requireValue(lines.length>=4&&lines.length<=AEMO_DAILY_LIMITS.records,'Invalid CSV record count');
 const first=csvLine(lines[0]),last=csvLine(lines.at(-1));
 requireValue(first.length===10&&same(first.slice(0,5),['C','NEMP.WORLD','PRICES','AEMO','PUBLIC'])&&/^\d{16}$/.test(first[7])&&first[8]===''&&/^\d{16}$/.test(first[9]),'Unexpected CSV report identity');
 requireValue(localIso(localStamp(first[5]+' '+first[6]))===item.report_generated_at,'CSV generation time differs from advertised filename');
 requireValue(same(last,['C','END OF REPORT',String(lines.length)]),'Incomplete CSV report trailer');
 const headers=new Set(),rows={SA1:{2:new Map(),3:new Map()},VIC1:{2:new Map(),3:new Map()}},errors={};
 const start=dateMs(item.trading_day)+4*3600000,end=start+DAY;
 for(const line of lines.slice(1,-1)){
  requireValue(line.length<=4096,'Oversized CSV record');const row=csvLine(line),layout=row[3];
  requireValue(row[1]==='DREGION'&&row[2]===''&&Object.hasOwn(CSV_HEADERS,layout),'Unsupported dataset or CSV layout');
  if(row[0]==='I'){requireValue(!headers.has(layout)&&same(row,CSV_HEADERS[layout]),'Changed or duplicate CSV columns');headers.add(layout);continue;}
  requireValue(row[0]==='D'&&headers.has(layout)&&row.length===CSV_HEADERS[layout].length,'Malformed data record or missing layout header');
  const region=row[6];requireValue(['NSW1','QLD1','SA1','TAS1','VIC1'].includes(region),'Unknown NEM region');
  if(!Object.hasOwn(rows,region)||errors[region])continue;
  try{
   const at=localStamp(row[4]);requireValue(at>start&&at<=end&&(at-start)%INTERVAL===0,'Price outside declared trading-day intervals');
   requireValue(row[5]==='1'&&row[7]==='0','Unsupported run or intervention');requireValue(row[11]==='0'&&row[12]==='0','Unsupported administered-price or suspension flag');
   units(row[8]);requireValue(!rows[region][layout].has(at),'Duplicate regional interval');rows[region][layout].set(at,row[8]);
  }catch(error){errors[region]=describeError(error);}
 }
 requireValue(headers.size===2,'Missing required CSV layout');
 return {metadata:{...item,csv_name,csv_bytes:bytes.length},rows,errors,csv:bytes};
}
function regionResult(region,day,bundles){
 const start=dateMs(day),end=start+DAY,selected=new Map();
 for(const bundle of bundles){
  if(bundle.errors[region])throw new SourceError(bundle.errors[region].error,bundle.errors[region].http_status);
  const layouts=bundle.rows[region];
  requireValue(layouts[2].size===288&&layouts[3].size===288,'Incomplete regional trading bundle');
  for(const [at,raw]of layouts[3]){
   const other=layouts[2].get(at);requireValue(other!==undefined&&units(raw)===units(other),'CSV layouts disagree on regional price');
   if(at<=start||at>end)continue;
   requireValue(!selected.has(at),'Duplicated calendar-day interval across bundles');
   selected.set(at,{period_end:localIso(at),price:cents(raw)/100,price_raw:raw,layout2_price_raw:other,source_url:bundle.metadata.url});
  }
 }
 requireValue(selected.size===288,'Latest elapsed day is unpublished or incomplete; no older day substituted');
 const intervals=Array.from({length:288},(_,i)=>{const row=selected.get(start+(i+1)*INTERVAL);requireValue(row,'Missing selected interval');return row;});
 return {region,geography:AEMO_DAILY_REGIONS[region],status:'ok',calendar_day:day,period_start:day+'T00:00:00+10:00',period_end:localIso(end),timezone,interval_minutes:5,interval_count:288,unit:'AUD/MWh',dataset:'DREGION',runno:1,intervention:0,apcflag:0,market_suspended_flag:0,csv_layouts:[2,3],rounding,intervals,summary:summary(intervals.map(r=>cents(r.price_raw))),source_url:AEMO_DAILY_INDEX,source_urls:bundles.map(b=>b.metadata.url)};
}
function representation(bundles,now){
 const clock=aemoDayClock(now),day=clock.calendar_day;
 const regions=Object.keys(AEMO_DAILY_REGIONS).map(region=>{try{return regionResult(region,day,bundles);}catch(error){return {region,geography:AEMO_DAILY_REGIONS[region],status:'error',calendar_day:day,source_url:AEMO_DAILY_INDEX,source_urls:bundles.map(b=>b.metadata.url),...describeError(error)};}});
 const successful=regions.filter(r=>r.status==='ok').length;
 return {status:successful===2?'ok':successful===1?'degraded':'error',calendar_day:day,timezone,requested_day_policy,next_rollover_at:clock.next_rollover_at,regions,bundles:bundles.map(b=>b.metadata),provenance:[],definitions:aemoDailyBundleDefinitions(),publisher,licence,licence_url,limitations,published_at:null,publisher_updated_at:null,next_expected_update:null};
}
function parseInputs(inputs,now){
 const day=aemoDayClock(now).calendar_day,required=[dayString(dateMs(day)-DAY),day];
 requireValue(Array.isArray(inputs)&&inputs.length===2,'Exactly two daily bundles required');
 return inputs.map((input,i)=>{const item=descriptor(input.url);requireValue(item.trading_day===required[i]&&Date.parse(item.report_generated_at)<=instant(now),'Wrong, unordered or future bundle');return decodeBundle(item,input.data);});
}
export function parseAemoDailyBundles(inputs,{now}={}){return representation(parseInputs(inputs,now),now);}
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
async function acquire(url,limit,accept,fetcher,now){
 const requested_at=new Date(instant(now())).toISOString();
 const response=await fetcher(url,{headers:{accept},redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw new SourceError('AEMO daily resource returned HTTP '+response.status,response.status);}
 if(response.url&&response.url!==url){await response.body?.cancel();fail('Unexpected daily-resource redirect');}requireValue(response.body,'Missing daily-resource body');
 const lengthHeader=response.headers.get('content-length');if(lengthHeader!==null&&(!/^\d+$/.test(lengthHeader)||Number(lengthHeader)>limit)){await response.body.cancel();fail('Declared resource exceeds bounded read');}
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;requireValue(length<=limit,'Resource exceeded bounded read');chunks.push(value);}}finally{await reader.cancel();}
 requireValue(length>0,'Empty daily resource');const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 const retrieved_at=new Date(instant(now())).toISOString();requireValue(instant(retrieved_at)>=instant(requested_at),'Acquisition clock moved backwards');
 return {data:bytes,provenance:{url,requested_at,retrieved_at,bytes:length,sha256:await hash(bytes)}};
}
export async function readAemoDailyBundles({fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}){
 const started=now(),day=aemoDayClock(started).calendar_day;
 const index=await acquire(AEMO_DAILY_INDEX,AEMO_DAILY_LIMITS.index,'text/html',fetcher,now);
 const selected=discoverAemoDailyBundles(new TextDecoder('utf-8',{fatal:true}).decode(index.data),{now:index.provenance.retrieved_at});
 requireValue(aemoDayClock(index.provenance.retrieved_at).calendar_day===day,'Acquisition crossed fixed-AEST midnight');
 const inputs=await Promise.all(selected.map(async item=>({url:item.url,...await acquire(item.url,AEMO_DAILY_LIMITS.compressed,'application/zip',fetcher,now)})));
 const acquired=now();requireValue(instant(acquired)>=instant(started)&&aemoDayClock(acquired).calendar_day===day,'Acquisition crossed fixed-AEST midnight or clock moved backwards');
 const bundles=parseInputs(inputs,acquired),result=representation(bundles,acquired);
 result.provenance=[{role:'index',...index.provenance},...await Promise.all(inputs.map(async (input,i)=>({role:'bundle',...input.provenance,trading_day:bundles[i].metadata.trading_day,csv_name:bundles[i].metadata.csv_name,csv_bytes:bundles[i].metadata.csv_bytes,csv_sha256:await hash(bundles[i].csv)})))];
 const completed=now();requireValue(instant(completed)>=instant(acquired)&&aemoDayClock(completed).calendar_day===day,'Acquisition crossed fixed-AEST midnight during parsing or hashing');
 requireValue(validateAemoDailyBundlesRepresentation(result,{now:completed}),'Internal acquisition representation failed validation');
 const returned=now();requireValue(instant(returned)>=instant(completed)&&aemoDayClock(returned).calendar_day===day,'Acquisition crossed fixed-AEST midnight during validation');return result;
}
export function validateAemoDailyBundlesRepresentation(value,acquisition){
 try{
  requireValue(value&&typeof value==='object'&&!Array.isArray(value),'Missing daily representation');const start=dateMs(value.calendar_day);
  requireValue(same(Object.keys(value).sort(),['bundles','calendar_day','definitions','licence','licence_url','limitations','next_expected_update','next_rollover_at','provenance','published_at','publisher','publisher_updated_at','regions','requested_day_policy','status','timezone']),'Unexpected representation fields');
  const publicValidation=arguments.length>1;let acquired;
  if(publicValidation){requireValue(acquisition&&typeof acquisition==='object'&&!Array.isArray(acquisition)&&Object.hasOwn(acquisition,'now')&&acquisition.now!==undefined,'Missing explicit acquisition clock');acquired=instant(acquisition.now);requireValue(aemoDayClock(acquisition.now).calendar_day===value.calendar_day,'Old completed day');}
  requireValue(value.timezone===timezone&&value.requested_day_policy===requested_day_policy&&value.next_rollover_at===new Date(start+2*DAY-OFFSET).toISOString()&&value.published_at===null&&value.publisher_updated_at===null&&value.next_expected_update===null,'Changed temporal semantics');
  requireValue(same(value.definitions,aemoDailyBundleDefinitions())&&value.publisher===publisher&&value.licence===licence&&value.licence_url===licence_url&&value.limitations===limitations,'Changed statistical definition');
  requireValue(Array.isArray(value.bundles)&&value.bundles.length===2,'Missing bundle identity');
  const required=[dayString(start-DAY),value.calendar_day];
  for(const [i,b]of value.bundles.entries()){
   const item=descriptor(b.url);requireValue(item.trading_day===required[i]&&same(b,{...item,csv_name:item.filename.replace(/\.zip$/,'.CSV'),csv_bytes:b.csv_bytes})&&Number.isSafeInteger(b.csv_bytes)&&b.csv_bytes>0&&b.csv_bytes<=AEMO_DAILY_LIMITS.expanded,'Invalid bundle metadata');
   if(acquired!==undefined)requireValue(Date.parse(b.report_generated_at)<=acquired,'Future bundle');
  }
  requireValue(Array.isArray(value.provenance)&&(value.provenance.length===3||(!publicValidation&&value.provenance.length===0)),'Missing public acquisition provenance');
  if(value.provenance.length){
   for(const [i,p]of value.provenance.entries()){
    const expected=i===0?{role:'index',url:AEMO_DAILY_INDEX}:{role:'bundle',url:value.bundles[i-1].url};
    requireValue(p.role===expected.role&&p.url===expected.url&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=(i===0?AEMO_DAILY_LIMITS.index:AEMO_DAILY_LIMITS.compressed)&&/^[a-f0-9]{64}$/.test(p.sha256),'Invalid resource provenance');
    requireValue(typeof p.requested_at==='string'&&typeof p.retrieved_at==='string','Provenance clocks must be UTC strings');
    const expectedKeys=i===0?['bytes','requested_at','retrieved_at','role','sha256','url']:['bytes','csv_bytes','csv_name','csv_sha256','requested_at','retrieved_at','role','sha256','trading_day','url'];requireValue(same(Object.keys(p).sort(),expectedKeys),'Unexpected provenance fields');
    const requested=instant(p.requested_at),retrieved=instant(p.retrieved_at);
    requireValue(retrieved>=requested&&aemoDayClock(p.requested_at).calendar_day===value.calendar_day&&aemoDayClock(p.retrieved_at).calendar_day===value.calendar_day&&(acquired===undefined||retrieved<=acquired),'Invalid acquisition clock ordering');
    if(i){const b=value.bundles[i-1];requireValue(p.trading_day===b.trading_day&&p.csv_name===b.csv_name&&p.csv_bytes===b.csv_bytes&&/^[a-f0-9]{64}$/.test(p.csv_sha256)&&Date.parse(b.report_generated_at)<=requested,'Invalid CSV provenance');requireValue(requested>=instant(value.provenance[0].retrieved_at),'Bundle requested before index retrieval');}
   }
  }
  requireValue(Array.isArray(value.regions)&&value.regions.length===2,'Invalid region coverage');let successes=0;
  for(const [i,r]of value.regions.entries()){
   const region=Object.keys(AEMO_DAILY_REGIONS)[i],urls=value.bundles.map(b=>b.url);
   requireValue(r&&r.region===region&&r.geography===AEMO_DAILY_REGIONS[region]&&r.calendar_day===value.calendar_day&&r.source_url===AEMO_DAILY_INDEX&&same(r.source_urls,urls),'Wrong region identity');
   if(r.status==='error'){const keys=['calendar_day','error','geography','region','source_url','source_urls','status'];if(Object.hasOwn(r,'http_status')){requireValue(Number.isInteger(r.http_status)&&r.http_status>=400&&r.http_status<=599,'Invalid failure HTTP status');keys.push('http_status');keys.sort();}requireValue(typeof r.error==='string'&&r.error.length>0&&same(Object.keys(r).sort(),keys),'Failed region has values or changed fields');continue;}
   requireValue(r.status==='ok'&&Array.isArray(r.intervals)&&r.intervals.length===288,'Partial successful region');
   // Reconstruct selected coverage directly; unserved trading-day rows are not invented.
   const prices=[];
   for(const [j,row]of r.intervals.entries()){
    const ending=start+(j+1)*INTERVAL,bundleIndex=ending<=start+4*3600000?0:1;
    requireValue(same(Object.keys(row).sort(),['layout2_price_raw','period_end','price','price_raw','source_url'])&&row.period_end===localIso(ending)&&row.source_url===urls[bundleIndex]&&units(row.price_raw)===units(row.layout2_price_raw)&&row.price===cents(row.price_raw)/100,'Changed interval value, coverage or source');prices.push(cents(row.price_raw));
   }
   const expected={region,geography:AEMO_DAILY_REGIONS[region],status:'ok',calendar_day:value.calendar_day,period_start:value.calendar_day+'T00:00:00+10:00',period_end:localIso(start+DAY),timezone,interval_minutes:5,interval_count:288,unit:'AUD/MWh',dataset:'DREGION',runno:1,intervention:0,apcflag:0,market_suspended_flag:0,csv_layouts:[2,3],rounding,intervals:r.intervals,summary:summary(prices),source_url:AEMO_DAILY_INDEX,source_urls:urls};
   requireValue(same(r,expected),'Changed summary or region semantics');successes++;
  }
  return value.status===(successes===2?'ok':successes===1?'degraded':'error');
 }catch{return false;}
}
export function aemoDailyBundleObservationRows(value){
 requireValue(validateAemoDailyBundlesRepresentation(value),'Invalid daily representation');
 return value.regions.flatMap(r=>r.status!=='ok'?[]:Object.entries(statistics).map(([statistic,details])=>({measure:r.region+'.'+statistic,measure_id:r.region+'.'+statistic,period:value.calendar_day,value:r.summary[statistic],value_state:'observed',geography:r.geography,region:r.region,statistic,unit:details.unit,kind:'derived',interval_count:288,interval_minutes:5,period_start:r.period_start,period_end:r.period_end,timezone,dataset:'DREGION',runno:1,intervention:0,apcflag:0,market_suspended_flag:0,csv_layouts:[2,3],rounding,source_url:AEMO_DAILY_INDEX,source_urls:r.source_urls,revision_status:'mutable public publisher files; finality not established'})));
}
