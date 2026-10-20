import {fetchOfficial, SourceError} from './sources.js';

export const STATCAN_GDP_PRODUCT = 36100104;
export const STATCAN_GDP_COORDINATE = '1.1.1.30.0.0.0.0.0.0';
export const STATCAN_GDP_VECTOR = 62305752;
const api='https://www150.statcan.gc.ca/t1/wds/rest/';
export const STATCAN_GDP_URLS=Object.freeze({data:api+'getDataFromCubePidCoordAndLatestNPeriods',series:api+'getSeriesInfoFromCubePidCoord',cube:api+'getCubeMetadata'});
const source_url='https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610010401';
const publisher='Statistics Canada',licence='Statistics Canada Open Licence',licence_url='https://www.statcan.gc.ca/en/terms-conditions/open-licence';
const geography='Canada',unit='millions of chained (2017) dollars',price_basis='Chained (2017) dollars',adjustment='Seasonally adjusted at annual rates';
const series_title='Canada;Chained (2017) dollars;Seasonally adjusted at annual rates;Gross domestic product at market prices';
const population='Expenditure-based gross domestic product at market prices for the Canadian economy; not per-capita GDP, household income, gross domestic income or an expenditure component.';
const period_convention='Calendar quarter identified by YYYY-Qn, with inclusive quarter boundaries. The legacy period field is the quarter-start month YYYY-MM, not a monthly observation.';
const limitations='Chained-dollar components are not additive. Level is expressed at an annual rate; quarter_change is ordinary, nonannualized quarter-to-quarter percentage change derived from publisher-rounded levels. No currency conversion or vintage archive. Symbol none does not establish finality or absence of revisions.';
const revision_policy='Current and earlier quarters can be revised with new or revised inputs and seasonal information; preserve raw release times and preliminary/revised symbols. A rebase or changed series definition requires review.';
const formula='100 * (current_value / previous_value - 1)';
const rounding='Two decimal percentage points, using Math.round(unrounded * 100) / 100 on the ratio of publisher-rounded levels.';
const symbols=Object.freeze({0:'none',1:'preliminary',3:'revised'});
const dimensions=()=>({product:'36100104',coordinate:STATCAN_GDP_COORDINATE,vector:'62305752',geography:'1',prices:'1',seasonal_adjustment:'1',estimates:'30'});
const fail=message=>{throw new SourceError('Statistics Canada GDP: '+message);};
const requireValue=(condition,message)=>{if(!condition)fail(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>{
  if(a===b)return true;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));
  return object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([key,value])=>Object.hasOwn(a,key)&&same(a[key],value));
};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const rawTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)&&date(value.slice(0,10));
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z');

export function statcanGdpDefinitions() {
  const shared={geography,population,price_basis,period_convention,cadence:'quarterly',dimensions:dimensions(),publisher,licence,licence_url,source_url,revision_policy,limitations};
  return [
    {...shared,id:'level',name:'Real gross domestic product at market prices',unit,adjustment,kind:'observation',definition:'Reported expenditure-based GDP level in millions of chained (2017) dollars, seasonally adjusted at annual rates.'},
    {...shared,id:'quarter_change',name:'Real GDP quarter-to-quarter change',unit:'percent',adjustment:'Ordinary quarter-to-quarter change in seasonally adjusted annual-rate levels; not annualized',kind:'derived',definition:'Percentage change between the latest two adjacent reported quarterly GDP levels; derived by Morning Rows.',formula,rounding},
  ];
}

function quarter(reference) {
  requireValue(typeof reference==='string'&&/^(?:19|20|21)\d{2}-(01|04|07|10)-01$/.test(reference),'Invalid quarter reference date');
  const year=Number(reference.slice(0,4)),month=Number(reference.slice(5,7)),index=year*4+(month-1)/3;
  return {period:`${year}-Q${(month+2)/3}`,index,period_start:reference,period_end:new Date(Date.UTC(year,month+2,0)).toISOString().slice(0,10),raw:`${year}-${String(month+2).padStart(2,'0')}-01`};
}
function envelope(value,label) {
  requireValue(Array.isArray(value)&&value.length===1&&value[0]?.status==='SUCCESS'&&object(value[0].object)&&value[0].object.responseStatusCode===0,'Invalid '+label+' response envelope');
  return value[0].object;
}
function selectedIdentity(value) {
  requireValue(value.productId===STATCAN_GDP_PRODUCT&&value.coordinate===STATCAN_GDP_COORDINATE&&value.vectorId===STATCAN_GDP_VECTOR,'Unexpected series identity');
}
function metadata(series,cube) {
  selectedIdentity(series);
  requireValue(series.SeriesTitleEn===series_title&&series.frequencyCode===9&&series.scalarFactorCode===6&&series.decimals===0&&series.memberUomCode===81&&series.terminated===0,'Series meaning, units or status changed');
  requireValue(cube.productId==='36100104'&&cube.cubeTitleEn==='Gross domestic product, expenditure-based, Canada, quarterly'&&cube.frequencyCode===9&&cube.archiveStatusCode==='2'&&rawTime(cube.releaseTime),'Invalid cube identity, frequency, currency or release');
  const end=quarter(cube.cubeEndDate),start=quarter(cube.cubeStartDate);
  requireValue(start.index<=end.index,'Invalid cube period range');
  requireValue(Array.isArray(cube.dimension)&&cube.dimension.length===4,'Unexpected cube dimensions');
  const expected=[['Geography',1,geography,false],['Prices',1,price_basis,true],['Seasonal adjustment',1,adjustment,false],['Estimates',30,'Gross domestic product at market prices',false]];
  for(let i=0;i<expected.length;i++) {
    const [name,id,label,hasUom]=expected[i],matches=cube.dimension.filter(d=>d?.dimensionPositionId===i+1);
    requireValue(matches.length===1,'Duplicate or missing cube dimension');
    const d=matches[0];
    requireValue(d.dimensionNameEn===name&&d.hasUom===hasUom&&Array.isArray(d.member)&&d.member.length>0&&d.member.length<=10000,'Unknown cube dimension');
    const members=d.member.filter(m=>m?.memberId===id);
    requireValue(members.length===1&&members[0].memberNameEn===label&&members[0].terminated===0,'Selected cube member changed or terminated');
    const m=members[0];
    requireValue(m.memberUomCode===(i===1?81:null),'Selected cube member unit changed');
    if(i===0)requireValue(m.classificationCode==='11124'&&m.classificationTypeCode==='1'&&m.geoLevel===0&&m.vintage===2016,'Geographic classification changed');
  }
  return {cube_end_date:cube.cubeEndDate,release_timestamp_raw:cube.releaseTime};
}
function point(value) {
  requireValue(object(value),'Missing observation');
  const q=quarter(value.refPer);
  requireValue(value.refPerRaw===q.raw&&value.refPer2===''&&value.refPerRaw2==='','Contradictory raw quarter fields');
  requireValue(value.frequencyCode===9&&value.scalarFactorCode===6&&value.decimals===0,'Observation frequency, scale or precision changed');
  requireValue(Number.isSafeInteger(value.value)&&value.value>0,'Missing, invalid or nonpositive GDP level');
  requireValue(value.statusCode===0&&value.securityLevelCode===0&&Number.isInteger(value.symbolCode)&&Object.hasOwn(symbols,value.symbolCode),'Unsupported observation availability, confidentiality or symbol');
  requireValue(rawTime(value.releaseTime)&&value.releaseTime.slice(0,10)>=q.period_end,'Invalid observation release time');
  return {period:q.period,quarter:q.period,value:value.value,value_state:'observed',reference_date:value.refPer,period_start:q.period_start,period_end:q.period_end,ref_per_raw:value.refPerRaw,ref_per2:'',ref_per_raw2:'',unit,geography,adjustment,price_basis,dimensions:dimensions(),scalar_code:6,unit_code:81,frequency_code:9,decimals:0,status_code:0,security_level_code:0,symbol_code:value.symbolCode,symbol:symbols[value.symbolCode],release_timestamp_raw:value.releaseTime,release_timezone:null};
}
function build(rows,anchor) {
  requireValue(Array.isArray(rows)&&rows.length===2,'Exactly two quarterly observations required');
  const [previous,latest]=rows,first=quarter(previous.reference_date),last=quarter(latest.reference_date);
  requireValue(last.index===first.index+1,'Duplicate, reversed or nonadjacent quarters');
  requireValue(anchor.cube_end_date===latest.reference_date,'Latest observation is not the current cube quarter');
  requireValue(rawTime(anchor.release_timestamp_raw)&&latest.release_timestamp_raw===anchor.release_timestamp_raw&&previous.release_timestamp_raw<=latest.release_timestamp_raw,'Observation release does not match current cube release');
  const change=Math.round((latest.value/previous.value-1)*10000)/100;
  requireValue(Number.isFinite(change),'Invalid derived growth');
  return {
    period:latest.reference_date.slice(0,7),level:latest.value,quarter_change:change,quarter:latest.period,
    geography,unit,adjustment,price_basis,definitions:statcanGdpDefinitions(),rows,
    growth:{period:latest.period,value:change,value_state:'observed',kind:'derived',unit:'percent',previous_period:previous.period,previous_value:previous.value,current_value:latest.value,formula,rounding,annualized:false},
    metadata:{count:2,first_quarter:previous.period,latest_quarter:latest.period,cube_end_date:anchor.cube_end_date,release_timestamp_raw:anchor.release_timestamp_raw,release_timezone:null,series_title,product_id:STATCAN_GDP_PRODUCT,coordinate:STATCAN_GDP_COORDINATE,vector_id:STATCAN_GDP_VECTOR,frequency_code:9,scalar_code:6,unit_code:81,decimals:0,cube_archive_status:'2',legacy_period_convention:'quarter-start month, YYYY-MM; not monthly'},
    publisher,licence,licence_url,source_url,limitations,published_at:null,publisher_updated_at:null,next_expected_update:null,provenance:[],
  };
}

export function parseStatcanGdp(dataResponse,seriesResponse,cubeResponse) {
  const data=envelope(dataResponse,'data'),series=envelope(seriesResponse,'series metadata'),cube=envelope(cubeResponse,'cube metadata');
  selectedIdentity(data);
  const anchor=metadata(series,cube);
  requireValue(Array.isArray(data.vectorDataPoint)&&data.vectorDataPoint.length===2,'Exactly two quarterly observations required');
  const rows=data.vectorDataPoint.map(point).sort((a,b)=>a.reference_date.localeCompare(b.reference_date));
  return build(rows,anchor);
}

export function validateStatcanGdpRepresentation(value,acquisition) {
  try {
    if(!object(value)||!Array.isArray(value.rows)||value.rows.length!==2||!object(value.metadata)||!Array.isArray(value.provenance))return false;
    const rows=value.rows.map(r=>point({refPer:r.reference_date,refPerRaw:r.ref_per_raw,refPer2:r.ref_per2,refPerRaw2:r.ref_per_raw2,value:r.value,frequencyCode:r.frequency_code,scalarFactorCode:r.scalar_code,decimals:r.decimals,statusCode:r.status_code,securityLevelCode:r.security_level_code,symbolCode:r.symbol_code,releaseTime:r.release_timestamp_raw}));
    if(!same(value.rows,rows))return false;
    if(acquisition!==undefined&&(!object(acquisition)||!instant(acquisition.retrieved_at)||rows[1].period_end>acquisition.retrieved_at.slice(0,10)))return false;
    const expected=build(rows,value.metadata);
    const {provenance,...semantic}=value,{provenance:ignored,...expectedSemantic}=expected;
    if(!same(semantic,expectedSemantic))return false;
    if(provenance.length!==0&&provenance.length!==3)return false;
    const seen=new Set();
    for(const p of provenance) {
      if(!object(p)||!Object.hasOwn(STATCAN_GDP_URLS,p.role)||seen.has(p.role)||p.url!==STATCAN_GDP_URLS[p.role]||!instant(p.retrieved_at)||!Number.isSafeInteger(p.bytes)||p.bytes<=0||p.bytes>(p.role==='cube'?131072:16384)||typeof p.sha256!=='string'||!/^\w{64}$/.test(p.sha256)||!/^[0-9a-f]+$/.test(p.sha256))return false;
      if(rows[1].period_end>p.retrieved_at.slice(0,10))return false;
      seen.add(p.role);
    }
    return true;
  } catch {return false;}
}

async function bounded(response,maximum) {
  if(!response.ok){await response.body?.cancel();throw new SourceError('Statistics Canada GDP returned HTTP '+response.status,response.status);}
  const length=response.headers.get('content-length');
  if(length!==null&&!(/^\d+$/.test(length)&&Number(length)<=maximum)){await response.body?.cancel();fail('Response exceeds byte bound');}
  requireValue(response.body,'Empty response body');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;requireValue(size<=maximum,'Response exceeds byte bound');chunks.push(value);}
  } finally {await reader.cancel();}
  requireValue(size>0,'Empty response body');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('Invalid UTF-8 response');}
  let json;try{json=JSON.parse(text);}catch{fail('Malformed JSON response');}
  return {json,bytes};
}
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');

export async function readStatcanGdp({fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}) {
  const signal=AbortSignal.timeout(20000);
  const base={productId:STATCAN_GDP_PRODUCT,coordinate:STATCAN_GDP_COORDINATE};
  const queries={data:[{...base,latestN:2}],series:[base],cube:[{productId:STATCAN_GDP_PRODUCT}]};
  const files=await Promise.all(Object.entries(STATCAN_GDP_URLS).map(async([role,url])=>{
    const response=await fetcher(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(queries[role]),signal});
    if(response.url)requireValue(response.url===url,'Unexpected publisher redirect');
    const file=await bounded(response,role==='cube'?131072:16384),retrieved_at=now();
    requireValue(instant(retrieved_at),'Invalid acquisition clock');
    return {role,url,...file,retrieved_at};
  }));
  const byRole=Object.fromEntries(files.map(file=>[file.role,file]));
  const result=parseStatcanGdp(byRole.data.json,byRole.series.json,byRole.cube.json);
  result.provenance=await Promise.all(files.map(async file=>({role:file.role,url:file.url,retrieved_at:file.retrieved_at,bytes:file.bytes.byteLength,sha256:await hash(file.bytes)})));
  requireValue(validateStatcanGdpRepresentation(result),'Representation contract or acquisition period failed');
  return result;
}
