import {fetchOfficial, SourceError} from './sources.js';

const endpoint='https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXGBPCAD/json';
const source_url='https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/';
const publisher='Bank of Canada',licence='Bank of Canada terms of use',licence_url='https://www.bankofcanada.ca/terms/';
const geography='Canada (CAD quote-currency jurisdiction; not a regional transaction rate)';
const population='Indicative averages of aggregated financial-institution price quotes; not an executable transaction quote.';
const adjustment='Nominal; not seasonally adjusted';
const period_convention='Publisher observation calendar date, YYYY-MM-DD; no UTC offset or publication instant is implied. Request bounds use UTC dates.';
const revision_policy='Published observations may change; no immutable vintage or finality guarantee is established. Retrieval does not advance independent verification.';
const limitations='No inversion, interpolation, carry-forward or conversion calculation. A date absent from the validated response is not_published_on_date, not an inferred holiday. No business calendar, transaction rate or tax ruling is supplied.';
const reuse_notice='Original information is available free from Bank of Canada. Values are untransformed; selection and JSON representation are by Morning Rows.';
const specs=Object.freeze({
  FXUSDCAD:Object.freeze({base:'USD',label:'USD/CAD',description:'Daily average exchange rate of the US dollar in Canadian dollars.',publisher_unit:'Canadian dollars per US dollar'}),
  FXGBPCAD:Object.freeze({base:'GBP',label:'GBP/CAD',description:'Daily average exchange rate of the UK pound sterling in Canadian dollars.',publisher_unit:'Canadian dollars per UK pound sterling'}),
});
export const BOC_HISTORY_SERIES=Object.freeze(Object.keys(specs));
export const BOC_HISTORY_DAYS=31;
export const BOC_HISTORY_MAX_BYTES=32768;
const day=86400000;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw new SourceError('Bank of Canada dated FX: '+message);};
const requireValue=(condition,message)=>{if(!condition)fail(message);};
const keys=(value,wanted)=>object(value)&&Object.keys(value).length===wanted.length&&wanted.every(key=>Object.hasOwn(value,key));
const same=(a,b)=>{
  if(a===b)return true;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));
  return object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([key,value])=>Object.hasOwn(a,key)&&same(a[key],value));
};
const date=value=>typeof value==='string'&&/^(?:19|20|21)\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z');
function windowBounds(value) {
  requireValue(object(value)&&date(value.start)&&date(value.end)&&Date.parse(value.end)-Date.parse(value.start)===30*day,'Expected exactly 31 inclusive calendar dates');
  return {start:value.start,end:value.end,calendar_days:BOC_HISTORY_DAYS};
}
export function bocHistoryWindow(retrieved_at) {
  requireValue(instant(retrieved_at),'Invalid acquisition clock');
  const end=retrieved_at.slice(0,10),start=new Date(Date.parse(end)-30*day).toISOString().slice(0,10);
  return windowBounds({start,end});
}
export function bocHistoryUrls(window) {
  const bounds=windowBounds(window);
  return {window:`${endpoint}?start_date=${bounds.start}&end_date=${bounds.end}`,latest:`${endpoint}?recent=1`};
}
export function bocHistoryDefinitions() {
  return BOC_HISTORY_SERIES.map(series=>({
    id:series,name:specs[series].description,definition:specs[series].description,
    geography,population,unit:`CAD per ${specs[series].base}`,adjustment,kind:'observation',
    period_convention,cadence:'business daily; normally by 16:30 Eastern Time, publication may be delayed',
    revision_policy,dimensions:{series,base_currency:specs[series].base,quote_currency:'CAD'},
    publisher,licence,licence_url,source_url,limitations,reuse_notice,
  }));
}
function validateMetadata(value) {
  requireValue(keys(value,['terms','seriesDetail','observations'])&&same(value.terms,{url:licence_url}),'Unexpected response envelope or terms');
  requireValue(keys(value.seriesDetail,BOC_HISTORY_SERIES),'Wrong or missing series identity');
  for(const series of BOC_HISTORY_SERIES) {
    const spec=specs[series];
    requireValue(same(value.seriesDetail[series],{label:spec.label,description:spec.description,dimension:{key:'d',name:'Date'},dateFormat:'daily',metadata:{unit:spec.publisher_unit,frequency:'Business daily'}}),'Series quote direction, frequency or definition changed');
  }
}
function row(series,period,cell) {
  requireValue(keys(cell,['v'])&&typeof cell.v==='string'&&cell.v.length<=24&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(cell.v),'Missing, suppressed or unsupported numeric cell');
  const value=Number(cell.v);
  requireValue(Number.isFinite(value)&&value>0,'Nonpositive or invalid rate');
  return {series,period,value,value_text:cell.v,unit:`CAD per ${specs[series].base}`,base_currency:specs[series].base,quote_currency:'CAD',value_state:'observed'};
}
function parseResponse(value,window,latest=false) {
  validateMetadata(value);
  requireValue(Array.isArray(value.observations)&&value.observations.length>=1&&value.observations.length<=(latest?1:31),'Invalid observation count');
  const seen=new Set(),rows=[];
  for(const observation of value.observations) {
    requireValue(keys(observation,['d',...BOC_HISTORY_SERIES])&&date(observation.d)&&observation.d>=window.start&&observation.d<=window.end&&!seen.has(observation.d),'Duplicate, invalid, outside-window or incomplete observation date');
    seen.add(observation.d);
    for(const series of BOC_HISTORY_SERIES)rows.push(row(series,observation.d,observation[series]));
  }
  return rows.sort((a,b)=>a.period.localeCompare(b.period)||BOC_HISTORY_SERIES.indexOf(a.series)-BOC_HISTORY_SERIES.indexOf(b.series));
}
function build(rows,window,latest_anchor) {
  requireValue(same(rows.slice(-2),latest_anchor),'Latest anchor differs from representation tail');
  return {
    status:'ok',window,rows,latest_anchor,
    metadata:{date_count:rows.length/2,observation_count:rows.length,first_period:rows[0].period,latest_period:rows.at(-1).period},
    definitions:bocHistoryDefinitions(),geography,publisher,licence,licence_url,source_url,adjustment,
    period_convention,revision_policy,limitations,reuse_notice,
    published_at:null,publisher_updated_at:null,next_expected_update:null,provenance:[],
  };
}
export function parseBocHistory(windowResponse,latestResponse,requestedWindow) {
  const window=windowBounds(requestedWindow),rows=parseResponse(windowResponse,window),latest=parseResponse(latestResponse,window,true);
  requireValue(same(rows.slice(-2),latest),'Latest anchor differs from window tail; no stale or mixed-vintage substitution');
  return build(rows,window,latest);
}
export function validateBocHistoryRepresentation(value,acquisition) {
  try {
    if(!object(value)||!Array.isArray(value.rows)||value.rows.length<2||value.rows.length>62||value.rows.length%2||!Array.isArray(value.provenance))return false;
    const window=windowBounds(value.window),rows=[];let prior='';
    for(let i=0;i<value.rows.length;i+=2) {
      const period=value.rows[i]?.period;
      if(!date(period)||period<window.start||period>window.end||period<=prior)return false;
      for(let j=0;j<2;j++) {
        const original=value.rows[i+j];if(original?.period!==period)return false;
        const normalized=row(BOC_HISTORY_SERIES[j],period,{v:original?.value_text});
        if(!same(original,normalized))return false;rows.push(normalized);
      }
      prior=period;
    }
    if(acquisition!==undefined&&(!object(acquisition)||!same(window,bocHistoryWindow(acquisition.retrieved_at))))return false;
    const expected=build(rows,window,value.latest_anchor),{provenance,...semantic}=value,{provenance:ignored,...expectedSemantic}=expected;
    if(!same(semantic,expectedSemantic)||![0,2].includes(provenance.length))return false;
    const urls=bocHistoryUrls(window),seen=new Set();
    for(const p of provenance) {
      if(!keys(p,['role','url','retrieved_at','bytes','sha256'])||!Object.hasOwn(urls,p.role)||seen.has(p.role)||p.url!==urls[p.role]||!instant(p.retrieved_at)||p.retrieved_at.slice(0,10)<window.end||!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>BOC_HISTORY_MAX_BYTES||typeof p.sha256!=='string'||!/^[0-9a-f]{64}$/.test(p.sha256))return false;
      seen.add(p.role);
    }
    return true;
  } catch {return false;}
}
async function bounded(response) {
  if(!response.ok){await response.body?.cancel();throw new SourceError('Bank of Canada dated FX returned HTTP '+response.status,response.status);}
  const length=response.headers.get('content-length');
  if(length!==null&&!(/^\d+$/.test(length)&&Number(length)<=BOC_HISTORY_MAX_BYTES)){await response.body?.cancel();fail('Response exceeds byte bound');}
  requireValue(response.body,'Empty response body');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;requireValue(size<=BOC_HISTORY_MAX_BYTES,'Response exceeds byte bound');chunks.push(value);}
  } finally {await reader.cancel();}
  requireValue(size>0,'Empty response body');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let json;try{json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('Malformed JSON or UTF-8 response');}
  return {json,bytes};
}
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function readBocHistory({fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}) {
  const requested_at=now(),window=bocHistoryWindow(requested_at),urls=bocHistoryUrls(window),signal=AbortSignal.timeout(20000);
  const files=await Promise.all(Object.entries(urls).map(async([role,url])=>{
    const response=await fetcher(url,{headers:{accept:'application/json'},signal});
    if(response.url)requireValue(response.url===url,'Unexpected publisher redirect');
    const file=await bounded(response),retrieved_at=now();requireValue(instant(retrieved_at),'Invalid acquisition clock');
    return {role,url,...file,retrieved_at};
  }));
  const result=parseBocHistory(files.find(f=>f.role==='window').json,files.find(f=>f.role==='latest').json,window);
  result.provenance=await Promise.all(files.map(async f=>({role:f.role,url:f.url,retrieved_at:f.retrieved_at,bytes:f.bytes.byteLength,sha256:await hash(f.bytes)})));
  requireValue(bocHistoryWindow(now()).end===window.end,'Acquisition crossed UTC midnight; retry for the new requested window');
  requireValue(validateBocHistoryRepresentation(result,{retrieved_at:requested_at}),'Representation or acquisition contract failed');
  return result;
}
