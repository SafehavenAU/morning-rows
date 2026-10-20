import {fetchOfficial, SourceError, describeError} from './sources.js';

export const AEMO_DAY_REGIONS=Object.freeze({SA1:'South Australia',VIC1:'Victoria'});
export const AEMO_DAY_LIMIT=1048576;
const DAY=86400000,OFFSET=36000000,INTERVAL=300000;
const publisher='Australian Energy Market Operator';
const licence='AEMO copyright permissions; accurate attribution required';
const licence_url='https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions';
const timezone='fixed AEST / UTC+10; not local daylight-saving time';
const limitations='Two NEM regions only; no Australian average, retail bill, forecast or moving 24-hour window. Prices are the published rounded TRADE values, not a claim of finality. Monthly files may be revised. Zero after cent rounding does not establish an exactly zero higher-precision dispatch price. Equal-interval mean is not demand-weighted.';
const statistics=Object.freeze({mean:{unit:'AUD/MWh',name:'Equal-interval mean wholesale price'},minimum:{unit:'AUD/MWh',name:'Minimum five-minute wholesale price'},maximum:{unit:'AUD/MWh',name:'Maximum five-minute wholesale price'},negative_count:{unit:'five-minute intervals',name:'Count of negative published five-minute prices'},zero_count:{unit:'five-minute intervals',name:'Count of zero published five-minute prices'}});
const fail=message=>{throw new SourceError('AEMO completed day: '+message);};
const requireValue=(ok,message)=>{if(!ok)fail(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const dateMs=value=>{requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'Invalid calendar day');const ms=Date.parse(value+'T00:00:00Z');requireValue(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value,'Invalid calendar date');return ms;};
function instant(value){
 const isDate=value instanceof Date;
 const ms=isDate?value.getTime():typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)?Date.parse(value):NaN;
 requireValue(Number.isFinite(ms)&&(isDate||new Date(ms).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z')),'A valid UTC acquisition clock is required');return ms;
}
export function aemoDayClock(now=new Date()){
 const ms=instant(now),today=new Date(ms+OFFSET).toISOString().slice(0,10),midnight=dateMs(today),next=midnight+DAY-OFFSET;
 return {calendar_day:new Date(midnight-DAY).toISOString().slice(0,10),market_today:today,next_rollover_at:new Date(next).toISOString(),seconds_until_rollover:Math.max(0,Math.floor((next-ms)/1000))};
}
export function aemoDayCacheSeconds(now=new Date(),maximum=300){requireValue(Number.isSafeInteger(maximum)&&maximum>=0,'Invalid cache maximum');return Math.min(maximum,aemoDayClock(now).seconds_until_rollover);}
export function aemoDayUrl(day,region){dateMs(day);requireValue(Object.hasOwn(AEMO_DAY_REGIONS,region),'Unsupported region');return `https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_${day.slice(0,7).replace('-','')}_${region}.csv`;}
export function aemoDayDefinitions(){return Object.entries(AEMO_DAY_REGIONS).flatMap(([region,geography])=>Object.entries(statistics).map(([statistic,details])=>({id:region+'.'+statistic,name:details.name,geography,unit:details.unit,kind:'derived',population:'Published regional reference prices for all 288 five-minute TRADE intervals in one completed fixed-AEST calendar day',adjustment:'Nominal wholesale prices; no seasonal or inflation adjustment',period_convention:'YYYY-MM-DD calendar day in fixed AEST UTC+10; interval endings 00:05 through next 00:00',cadence:'completed calendar day; monthly-file update timing is not established',dimensions:{region,statistic,period_type:'TRADE',interval_minutes:5},rounding:statistic==='mean'?'Exact integer-cent sum / 288, rounded to two AUD/MWh decimals, half away from zero':statistic.endsWith('_count')?'Integer count of published cent prices':'Published cent precision',revision_policy:'Mutable monthly publisher files; finality and correction schedule not established',publisher,licence,licence_url,source_url:'https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/aggregated-data',limitations})));}
function csvLine(line){
 const cells=[];let cell='',quoted=false,closed=false,started=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(quoted){if(c==='"'){if(line[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
  else if(c===','){cells.push(cell);cell='';closed=false;started=false;}
  else if(c==='"'){requireValue(!started&&!closed,'Malformed CSV quote');quoted=true;started=true;}
  else{requireValue(!closed,'Characters after quoted field');cell+=c;started=true;}
 }
 requireValue(!quoted,'Truncated CSV field');cells.push(cell);return cells;
}
function settlement(value){
 requireValue(typeof value==='string'&&/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(value),'Invalid settlement timestamp');
 const normalized=value.replaceAll('/','-').replace(' ','T'),ms=Date.parse(normalized+'Z');
 requireValue(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,19)===normalized,'Invalid settlement calendar');return ms;
}
function cents(value){
 requireValue(typeof value==='string'&&/^-?(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value),'Missing, nonfinite or unsupported-precision price');
 const negative=value.startsWith('-'),parts=(negative?value.slice(1):value).split('.');return (negative?-1:1)*(Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0')));
}
function summary(values){
 const sum=values.reduce((total,value)=>total+value,0),absolute=Math.abs(sum);
 const roundedCents=Math.trunc(absolute/288)+(absolute%288>=144?1:0),mean=Math.sign(sum)*roundedCents/100;
 return {mean:mean===0?0:mean,minimum:Math.min(...values)/100,maximum:Math.max(...values)/100,negative_count:values.filter(v=>v<0).length,zero_count:values.filter(v=>v===0).length};
}
function regionResult(region,day,intervals){
 const values=intervals.map(r=>cents(r.price_raw));
 return {region,geography:AEMO_DAY_REGIONS[region],status:'ok',calendar_day:day,period_start:day+'T00:00:00+10:00',period_end:new Date(dateMs(day)+DAY).toISOString().slice(0,10)+'T00:00:00+10:00',timezone,interval_minutes:5,interval_count:288,unit:'AUD/MWh',period_type:'TRADE',intervals,summary:summary(values),source_url:aemoDayUrl(day,region)};
}
export function parseAemoDay(text,region,day){
 requireValue(Object.hasOwn(AEMO_DAY_REGIONS,region),'Unsupported region');const start=dateMs(day),end=start+DAY;
 requireValue(typeof text==='string','CSV is not text');text=text.replace(/^\uFEFF/,'');requireValue(!/\r(?!\n)/.test(text),'Malformed line ending');
 const lines=text.replaceAll('\r\n','\n').split('\n');if(lines.at(-1)==='')lines.pop();
 requireValue(lines.length>1&&lines.length<=10001,'Empty or oversized monthly record count');
 requireValue(same(csvLine(lines.shift()),['REGION','SETTLEMENTDATE','TOTALDEMAND','RRP','PERIODTYPE']),'Unexpected CSV columns');
 const selected=new Map();
 for(const line of lines){
  const row=csvLine(line);requireValue(row.length===5&&row[0]===region,'Wrong region or incomplete CSV record');
  const at=settlement(row[1]);
  if(at<=start||at>end)continue;
  requireValue(row[4]==='TRADE','Forecast or unsupported period in requested day');
  requireValue((at-start)%INTERVAL===0,'Non-five-minute interval');requireValue(!selected.has(at),'Duplicate selected interval');
  const priceCents=cents(row[3]);selected.set(at,{period_end:new Date(at).toISOString().slice(0,19)+'+10:00',price:priceCents/100,price_raw:row[3]});
 }
 requireValue(selected.size===288,'Latest elapsed day is unpublished or incomplete; no older day substituted');
 const intervals=Array.from({length:288},(_,i)=>{const row=selected.get(start+(i+1)*INTERVAL);requireValue(row,'Missing selected interval');return row;});
 return regionResult(region,day,intervals);
}
async function acquire(url,fetcher){
 const response=await fetcher(url,{headers:{accept:'text/csv'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new SourceError('AEMO monthly file returned HTTP '+response.status,response.status);
 requireValue(!response.url||response.url===url,'Unexpected monthly-file redirect');requireValue(response.body,'Missing CSV body');
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;requireValue(length<=AEMO_DAY_LIMIT,'CSV exceeded bounded read');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),hash=await crypto.subtle.digest('SHA-256',bytes);
 return {text,bytes:length,sha256:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')};
}
export async function readAemoDay({fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}){
 const acquired_at=now(),clock=aemoDayClock(acquired_at),day=clock.calendar_day;
 const regions=await Promise.all(Object.keys(AEMO_DAY_REGIONS).map(async region=>{
  const url=aemoDayUrl(day,region);
  try{const raw=await acquire(url,fetcher),value=parseAemoDay(raw.text,region,day);return {...value,provenance:{url,retrieved_at:acquired_at,bytes:raw.bytes,sha256:raw.sha256}};}
  catch(error){return {region,geography:AEMO_DAY_REGIONS[region],status:'error',calendar_day:day,source_url:url,...describeError(error)};}
 }));
 requireValue(aemoDayClock(now()).calendar_day===day,'Acquisition crossed fixed-AEST midnight; retry for the new completed day');
 const successful=regions.filter(r=>r.status==='ok').length;
 return {status:successful===2?'ok':successful===1?'degraded':'error',calendar_day:day,timezone,requested_day_policy:'latest fully elapsed fixed-AEST calendar day; no earlier-day fallback',next_rollover_at:clock.next_rollover_at,regions,definitions:aemoDayDefinitions(),publisher,licence,licence_url,limitations,published_at:null,publisher_updated_at:null,next_expected_update:null};
}
export function validateAemoDayRepresentation(value,acquisition){
 try{
  requireValue(value&&typeof value==='object'&&Array.isArray(value.regions)&&value.regions.length===2,'Missing region coverage');dateMs(value.calendar_day);
  if(acquisition!==undefined){
   requireValue(acquisition&&typeof acquisition==='object'&&!Array.isArray(acquisition)&&Object.hasOwn(acquisition,'now')&&acquisition.now!==undefined,'Missing supplied public acquisition clock');
   requireValue(aemoDayClock(acquisition.now).calendar_day===value.calendar_day,'Old completed day');
  }
  requireValue(value.next_rollover_at===new Date(dateMs(value.calendar_day)+2*DAY-OFFSET).toISOString()&&value.requested_day_policy==='latest fully elapsed fixed-AEST calendar day; no earlier-day fallback'&&value.published_at===null&&value.publisher_updated_at===null&&value.next_expected_update===null,'Changed timing/publication semantics');
  requireValue(value.timezone===timezone&&same(value.definitions,aemoDayDefinitions())&&value.publisher===publisher&&value.licence===licence&&value.licence_url===licence_url&&value.limitations===limitations,'Changed definition');
  let successes=0;
  for(const [index,r]of value.regions.entries()){
   const region=Object.keys(AEMO_DAY_REGIONS)[index];requireValue(r.region===region&&r.geography===AEMO_DAY_REGIONS[region]&&r.calendar_day===value.calendar_day&&r.source_url===aemoDayUrl(value.calendar_day,region),'Wrong region/day identity');
   if(r.status==='error'){requireValue(typeof r.error==='string'&&!r.intervals&&!r.summary,'Failure has observations');continue;}
   requireValue(r.status==='ok'&&Array.isArray(r.intervals)&&r.intervals.length===288,'Partial successful region');
   for(const [i,row]of r.intervals.entries()){
    const ending=new Date(dateMs(value.calendar_day)+(i+1)*INTERVAL).toISOString().slice(0,19)+'+10:00';
    requireValue(row.period_end===ending&&row.price===cents(row.price_raw)/100&&Object.keys(row).length===3,'Changed interval coverage/value');
   }
   const expected=regionResult(region,value.calendar_day,r.intervals),{provenance,...plain}=r;
   requireValue(same(plain,expected),'Changed summary or interval semantics');
   requireValue(provenance&&provenance.url===r.source_url&&Number.isSafeInteger(provenance.bytes)&&provenance.bytes>0&&provenance.bytes<=AEMO_DAY_LIMIT&&/^[a-f0-9]{64}$/.test(provenance.sha256),'Invalid acquisition provenance');
   requireValue(aemoDayClock(provenance.retrieved_at).calendar_day===value.calendar_day,'Acquired wrong completed day');successes++;
  }
  return value.status===(successes===2?'ok':successes===1?'degraded':'error');
 }catch{return false;}
}
export function aemoDayObservationRows(value){
 requireValue(validateAemoDayRepresentation(value),'Invalid daily representation');
 return value.regions.flatMap(region=>region.status!=='ok'?[]:Object.entries(statistics).map(([statistic,details])=>({measure:region.region+'.'+statistic,period:value.calendar_day,value:region.summary[statistic],value_state:'observed',geography:region.geography,region:region.region,statistic,unit:details.unit,kind:'derived',interval_count:288,interval_minutes:5,period_start:region.period_start,period_end:region.period_end,timezone,period_type:'TRADE',source_url:region.source_url,revision_status:'mutable publisher file; finality not established'})));
}
