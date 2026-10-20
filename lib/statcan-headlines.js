import {fetchOfficial, SourceError} from './sources.js';
import {STATCAN_HEADLINE_CONTRACTS as contracts} from './statcan-headlines-contracts.js';

const api='https://www150.statcan.gc.ca/t1/wds/rest/';
export const STATCAN_HEADLINE_URLS=Object.freeze({data:api+'getDataFromCubePidCoordAndLatestNPeriods',series:api+'getSeriesInfoFromCubePidCoord',cube:api+'getCubeMetadata'});
export const STATCAN_HEADLINE_SOURCES=Object.freeze(['jobs','price_index','shop','homes']);
const publisher='Statistics Canada',licence='Statistics Canada Open Licence',licence_url='https://www.statcan.gc.ca/en/terms-conditions/open-licence';
const symbols=Object.freeze({0:'none',1:'preliminary',3:'revised'});
const qualities=Object.freeze({0:'normal',3:'A — data quality: excellent',4:'B — data quality: very good',5:'C — data quality: good',6:'D — data quality: acceptable',7:'E — use with caution'});
const bounds=Object.freeze({data:16384,series:16384,cube:262144});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const same=(a,b)=>a===b||(Array.isArray(a)||Array.isArray(b)?Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i])):object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>Object.hasOwn(a,k)&&same(a[k],v)));
const fail=m=>{throw new SourceError('Statistics Canada headline: '+m);};
const need=(c,m)=>{if(!c)fail(m);};
const contract=source=>{need(Object.hasOwn(contracts,source),'Unsupported fixed source');return contracts[source];};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const rawTime=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)&&date(v.slice(0,10));
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z');
const sourceUrl=c=>'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid='+c.product_id+'01';
function period(reference,frequency){
 need(date(reference)&&/^(?:19|20|21)\d{2}-\d{2}-01$/.test(reference),'Invalid reference date');
 const y=Number(reference.slice(0,4)),m=Number(reference.slice(5,7));
 need(frequency===6||frequency===9&&[1,4,7,10].includes(m),'Invalid frequency or quarter');
 const last=frequency===9?m+2:m;
 return {period:frequency===9?`${y}-Q${(m+2)/3}`:reference.slice(0,7),period_start:reference,period_end:new Date(Date.UTC(y,last,0)).toISOString().slice(0,10),raw:`${y}-${String(last).padStart(2,'0')}-01`};
}
const dimensions=s=>({product:String(s.product_id),coordinate:s.coordinate,vector:String(s.vector_id),...Object.fromEntries(s.members.map(m=>[m.name,String(m.member.memberId)]))});
const cmhcConditions='Using these CMHC data constitutes agreement to the linked CMHC Licence Agreement. Any redistribution must require recipients to agree to those terms; preserve attribution, accuracy and the no-endorsement notice. No recipient acceptance is recorded by this response.';
const cmhcNotice=(c,reference)=>({source_notice:`Source: Canada Mortgage and Housing Corporation (CMHC), ${c.cube_title}, ${reference}. This information is reproduced and distributed on an \"as is\" basis with the permission of CMHC.`,adaptation_notice:`Adapted from Canada Mortgage and Housing Corporation, ${c.cube_title}, ${reference}. This does not constitute an endorsement by Canada Mortgage and Housing Corporation of this product.`,terms_url:'https://www.statcan.gc.ca/en/reference/agreement_CMHC',conditions:cmhcConditions});
const licenceFor=source=>source==='homes'?{licence:'CMHC Licence Agreement for the Use of Data',licence_url:'https://www.statcan.gc.ca/en/reference/agreement_CMHC'}:{licence,licence_url};
export function statcanHeadlineDefinitions(source){
 const c=contract(source);
 return c.series.map(s=>({id:s.id,name:c.measure_name,unit:c.unit,geography:s.geography,population:c.population,adjustment:c.adjustment,kind:'observation',definition:c.definition,cadence:c.frequency_code===9?'quarterly':'monthly',period_convention:c.frequency_code===9?'Calendar quarter YYYY-Qn; the legacy period alias is its first month YYYY-MM.':'Calendar reference month YYYY-MM; not the publication month.',dimensions:dimensions(s),publisher,...licenceFor(source),...(source==='homes'?{original_publisher:'Canada Mortgage and Housing Corporation',licence_conditions:cmhcConditions}:{}),source_url:sourceUrl(c),revision_policy:c.revision_policy,limitations:c.limitations}));
}
function envelopes(value,n,label){
 need(Array.isArray(value)&&value.length===n,'Incorrect '+label+' response coverage');
 return value.map(r=>{need(r?.status==='SUCCESS'&&object(r.object)&&r.object.responseStatusCode===0,'Invalid '+label+' response envelope');return r.object;});
}
function identify(rows,c,label){
 const out=new Map();
 for(const row of rows){const s=c.series.find(s=>s.coordinate===row.coordinate);need(s&&row.productId===s.product_id&&row.vectorId===s.vector_id&&!out.has(row.coordinate),'Unknown or duplicate '+label+' identity');out.set(row.coordinate,row);}
 need(out.size===c.series.length,'Missing '+label+' identities');return out;
}
function anchor(c,cube,series){
 need(cube.productId===String(c.product_id)&&cube.cubeTitleEn===c.cube_title&&cube.frequencyCode===c.frequency_code&&cube.archiveStatusCode==='2'&&rawTime(cube.releaseTime),'Cube identity, status or release changed');
 const latest=period(cube.cubeEndDate,c.frequency_code),first=period(cube.cubeStartDate,c.frequency_code);need(first.period_start<=latest.period_start,'Invalid cube coverage');
 need(Array.isArray(cube.dimension)&&cube.dimension.length===c.dimension_count,'Cube dimension count changed');
 for(const s of c.series){
  const item=series.get(s.coordinate);
  need(item.SeriesTitleEn===s.title&&item.frequencyCode===s.frequency_code&&item.scalarFactorCode===s.scalar_code&&item.decimals===s.decimals&&item.memberUomCode===s.unit_code&&item.terminated===0,'Series meaning, unit, precision or active status changed');
  for(const m of s.members){
   const ds=cube.dimension.filter(d=>d?.dimensionPositionId===m.position);need(ds.length===1,'Missing or duplicate cube dimension');const d=ds[0];
   need(d.dimensionNameEn===m.name&&d.hasUom===m.has_uom&&Array.isArray(d.member)&&d.member.length>0&&d.member.length<=10000,'Cube dimension changed');
   const ms=d.member.filter(x=>x?.memberId===m.member.memberId);need(ms.length===1&&Object.entries(m.member).every(([k,v])=>ms[0][k]===v),'Selected member meaning, geography or unit changed');
  }
 }
 return {cube_end_date:cube.cubeEndDate,release_timestamp_raw:cube.releaseTime,release_timezone:null};
}
function point(source,c,s,p,a){
 need(object(p),'Missing observation');const q=period(p.refPer,s.frequency_code);
 need(p.refPerRaw===q.raw&&p.refPer2===''&&p.refPerRaw2==='','Contradictory raw reference period');
 need(p.refPer===a.cube_end_date&&rawTime(p.releaseTime)&&p.releaseTime===a.release_timestamp_raw&&p.releaseTime.slice(0,10)>=q.period_end,'Observation does not match current cube period and release');
 need(p.frequencyCode===s.frequency_code&&p.scalarFactorCode===s.scalar_code&&p.decimals===s.decimals,'Point frequency, scale or precision changed');
 need(typeof p.value==='number'&&Number.isFinite(p.value)&&p.value>=0&&Math.abs(p.value*10**s.decimals-Math.round(p.value*10**s.decimals))<1e-8&&Number.isSafeInteger(Math.round(p.value*10**s.decimals)),'Missing, unsafe or overprecision observation');
 need(source!=='jobs'||p.value<=100,'Rate outside percent range');need(source!=='price_index'||p.value>0,'Nonpositive CPI index');
 need(p.securityLevelCode===0&&Number.isInteger(p.statusCode)&&c.statuses.includes(p.statusCode)&&Number.isInteger(p.symbolCode)&&Object.hasOwn(symbols,p.symbolCode),'Unsupported availability, quality, confidentiality or symbol');
 return {measure_id:s.id,period:q.period,value:p.value,value_state:'observed',reference_date:p.refPer,period_start:q.period_start,period_end:q.period_end,ref_per_raw:p.refPerRaw,ref_per2:'',ref_per_raw2:'',unit:c.unit,geography:s.geography,adjustment:c.adjustment,dimensions:dimensions(s),frequency_code:s.frequency_code,scalar_code:s.scalar_code,unit_code:s.unit_code,decimals:s.decimals,status_code:p.statusCode,quality:qualities[p.statusCode],security_level_code:0,symbol_code:p.symbolCode,symbol:symbols[p.symbolCode],release_timestamp_raw:p.releaseTime,release_timezone:null,definition:statcanHeadlineDefinitions(source).find(d=>d.id===s.id),...(source==='homes'?{licence_notice:cmhcNotice(c,q.period)}:{})};
}
function build(source,rows,a,provenance=[]){
 const c=contract(source),metadata={count:rows.length,latest_period:rows[0].period,...a,product_id:c.product_id,cube_title:c.cube_title,legacy_period_convention:c.frequency_code===9?'quarter-start month YYYY-MM; not monthly':'reference month YYYY-MM'};
 if(source==='jobs')return rows.map(row=>({...row,name:row.geography,rate:row.value,source:publisher,...licenceFor(source),metadata,provenance}));
 const row=rows[0];return {period:row.reference_date.slice(0,7),[c.legacy_field]:row.value,...(c.frequency_code===9?{quarter:row.period}:{}),rows,metadata,definitions:statcanHeadlineDefinitions(source),publisher,...licenceFor(source),...(source==='homes'?{original_publisher:'Canada Mortgage and Housing Corporation',licence_notice:cmhcNotice(c,row.period)}:{}),source_url:sourceUrl(c),limitations:c.limitations,published_at:null,publisher_updated_at:null,next_expected_update:null,provenance};
}
export function parseStatcanHeadline(source,dataResponse,seriesResponse,cubeResponse){
 const c=contract(source),data=identify(envelopes(dataResponse,c.series.length,'data'),c,'data'),series=identify(envelopes(seriesResponse,c.series.length,'series'),c,'series'),cube=envelopes(cubeResponse,1,'cube')[0],a=anchor(c,cube,series);
 const rows=c.series.map(s=>{const r=data.get(s.coordinate);need(Array.isArray(r.vectorDataPoint)&&r.vectorDataPoint.length===1,'Exactly one current point per series required');return point(source,c,s,r.vectorDataPoint[0],a);});
 return build(source,rows,a);
}
export function statcanHeadlineRows(source,value){contract(source);return source==='jobs'?value:value?.rows;}
// Publisher release timestamps have no timezone: allow at most the next UTC
// calendar day, the largest possible civil-date lead; do not invent an instant.
function acquisitionAllows(rows,retrieved){
 if(!instant(retrieved))return false;
 const day=retrieved.slice(0,10),next=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 return rows.every(r=>r.period_end<=day&&r.release_timestamp_raw.slice(0,10)<=next);
}
function provenanceValid(provenance,rows){
 if(!Array.isArray(provenance)||![0,3].includes(provenance.length))return false;const roles=new Set();
 for(const p of provenance){if(!object(p)||!Object.hasOwn(STATCAN_HEADLINE_URLS,p.role)||roles.has(p.role)||p.url!==STATCAN_HEADLINE_URLS[p.role]||!instant(p.retrieved_at)||!Number.isSafeInteger(p.bytes)||p.bytes<=0||p.bytes>bounds[p.role]||typeof p.sha256!=='string'||!/^[0-9a-f]{64}$/.test(p.sha256)||!acquisitionAllows(rows,p.retrieved_at))return false;roles.add(p.role);}
 return true;
}
export function validateStatcanHeadlineRepresentation(source,value,acquisition){
 try{
  const c=contract(source),raw=statcanHeadlineRows(source,value);if(!Array.isArray(raw)||raw.length!==c.series.length)return false;
  const a=source==='jobs'?raw[0]?.metadata:value?.metadata;if(!object(a)||!rawTime(a.release_timestamp_raw))return false;
  const rows=raw.map((r,i)=>point(source,c,c.series[i],{refPer:r.reference_date,refPerRaw:r.ref_per_raw,refPer2:r.ref_per2,refPerRaw2:r.ref_per_raw2,value:r.value,frequencyCode:r.frequency_code,scalarFactorCode:r.scalar_code,decimals:r.decimals,statusCode:r.status_code,securityLevelCode:r.security_level_code,symbolCode:r.symbol_code,releaseTime:r.release_timestamp_raw},a));
  if(acquisition!==undefined&&(!object(acquisition)||!acquisitionAllows(rows,acquisition.retrieved_at)))return false;
  const provenance=source==='jobs'?raw[0]?.provenance:value?.provenance;if(!provenanceValid(provenance,rows))return false;
  return same(value,build(source,rows,{cube_end_date:a.cube_end_date,release_timestamp_raw:a.release_timestamp_raw,release_timezone:null},provenance));
 }catch{return false;}
}
async function bounded(response,maximum){
 if(!response.ok){await response.body?.cancel();throw new SourceError('Statistics Canada headline returned HTTP '+response.status,response.status);}
 const len=response.headers.get('content-length');if(len!==null&&!(/^\d+$/.test(len)&&Number(len)<=maximum)){await response.body?.cancel();fail('Response exceeds byte bound');}
 need(response.body,'Empty response body');const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;need(size<=maximum,'Response exceeds byte bound');chunks.push(r.value);}}finally{await reader.cancel();}
 need(size>0,'Empty response body');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('Invalid UTF-8 response');}let json;try{json=JSON.parse(text);}catch{fail('Malformed JSON response');}return {bytes,json};
}
const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function readStatcanHeadline(source,{fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}){
 const c=contract(source),signal=AbortSignal.timeout(20000),queries={data:c.series.map(s=>({productId:c.product_id,coordinate:s.coordinate,latestN:1})),series:c.series.map(s=>({productId:c.product_id,coordinate:s.coordinate})),cube:[{productId:c.product_id}]};
 const files=await Promise.all(Object.entries(STATCAN_HEADLINE_URLS).map(async([role,url])=>{const response=await fetcher(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(queries[role]),signal});if(response.url)need(response.url===url,'Unexpected publisher redirect');const file=await bounded(response,bounds[role]),retrieved_at=now();need(instant(retrieved_at),'Invalid acquisition clock');return {role,url,...file,retrieved_at};}));
 const byRole=Object.fromEntries(files.map(f=>[f.role,f])),native=parseStatcanHeadline(source,byRole.data.json,byRole.series.json,byRole.cube.json),provenance=await Promise.all(files.map(async f=>({role:f.role,url:f.url,retrieved_at:f.retrieved_at,bytes:f.bytes.byteLength,sha256:await hash(f.bytes)})));
 if(source==='jobs')for(const row of native)row.provenance=provenance;else native.provenance=provenance;
 need(validateStatcanHeadlineRepresentation(source,native),'Representation or acquisition period failed');return native;
}
