// Public-response verification, independent of scheduler and persistence.
import {createHash} from 'node:crypto';
import {INVENTORY} from './inventory.js';
import {DESKS,measuresFor,selectedResponse} from './information.js';
import {selectedUsResponse,validateCpiRepresentation} from './information-v2.js';
import {CLAIMANT_GEOGRAPHIES,validateClaimantRepresentation} from './claimant-count.js';
const at=(v,p)=>p.split('.').reduce((o,k)=>o?.[k],v);
export const ORIGINS=['https://morningrows.com','https://www.morningrows.com'];
// New reader inventory entries do not expand the original monitoring scope.
// The five claimant contracts below require their own reviewed release.
export const REGISTRY=Object.entries(INVENTORY).flatMap(([desk,entries])=>entries.filter(([source])=>source!=='claimant_count').map(([source,data,health])=>({key:`${desk}/${source}`,desk,country:DESKS[desk],source,data,health,canonical_url:`https://morningrows.com/${desk}.json?source=${source}`,described_measures:measuresFor(desk,source).length,assurance:measuresFor(desk,source).length?'described contract':'native availability; semantic assurance limited'})));
// Staged ninth desk. Existing collectors retain all 108 obligations until the
// reviewed release explicitly enables this addition; no checkpoint bootstrap.
export const US_CONTRACT={key:'united-states/cpi',desk:'united-states',country:'United States',source:'cpi',data:'cpi',health:'sources.cpi',canonical_url:'https://morningrows.com/united-states.json?source=cpi',described_measures:1,assurance:'13 exact calendar observations; independent reference approval separate'};
export const CLAIMANT_CONTRACTS=Object.keys(CLAIMANT_GEOGRAPHIES).map(desk=>({key:`${desk}/claimant_count`,desk,country:DESKS[desk],source:'claimant_count',data:'claimant_count',health:'sources.claimant_count',canonical_url:`https://morningrows.com/${desk}.json?source=claimant_count`,described_measures:1,observation_count:13,assurance:'13 exact national claimant-count months; independent reference approval separate'}));
export function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
export const fingerprint=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
const month=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v||'');
export function validateNativeTask(key,d){
 if(key===US_CONTRACT.key)requireValue(validateCpiRepresentation(d),'US CPI definition, calendar coverage or missingness');
 if(CLAIMANT_CONTRACTS.some(c=>c.key===key))requireValue(validateClaimantRepresentation(d,key.split('/')[0]),'Claimant-count definition, national geography, calendar coverage or missingness');
 if(key==='new-zealand/prices'){
  const codes=['OTA2201','HAY2201','ISL2201','BEN2201','INV2201'];requireValue(Array.isArray(d)&&d.length===5&&new Set(d.map(r=>r.code)).size===5,'NZ price node coverage');
  requireValue(d.every(r=>codes.includes(r.code)&&Number.isFinite(r.price)&&r.unit==='NZD per megawatt hour'&&r.geography?.includes('point of connection, New Zealand')&&r.timezone==='Pacific/Auckland'&&['interim','final'].includes(r.price_status)&&r.date===d[0].date&&r.period===d[0].period&&r.price_status===d[0].price_status&&[46,48,50].includes(r.period)&&r.periods===r.period&&Date.parse(r.period_end)-Date.parse(r.period_start)===1800000&&Number.isInteger(r.publication_lag_days)&&r.publication_lag_days>=0&&r.source_url?.startsWith('https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/')&&r.licence==='CC BY 4.0'),'NZ price dimensions, timing or provenance');
 }
 if(key.endsWith('/company_insolvencies')){
  const geography=DESKS[key.split('/')[0]],r=d?.rows;requireValue(r?.length===6&&new Set(r.map(x=>x.measure)).size===6&&r.every(x=>x.geography===geography&&x.period===d.period&&month(x.period)&&x.unit==='company insolvencies'&&x.seasonally_adjusted===false&&Number.isSafeInteger(x.value)&&x.value>=0)&&r.slice(1).reduce((n,x)=>n+x.value,0)===r[0].value,'Insolvency national coverage, period or component total');
 }
 if(key==='england/pharmacies'){
  const r=Object.fromEntries((d?.rows||[]).map(x=>[x.measure,x.value]));requireValue(d?.rows?.length===9&&d.geography==='England'&&month(d.period)&&d.rows.every(x=>Number.isSafeInteger(x.value)&&x.geography==='England'&&x.unit==='pharmacies'&&x.period===d.period&&(x.measure.endsWith('_net_change')||x.value>=0)),'Pharmacy national coverage or dimensions');
  requireValue(r.total===r.excluding_distance_sellers+r.distance_sellers&&['excluding_distance_sellers','distance_sellers'].every(p=>r[p+'_opened']-r[p+'_closed']===r[p+'_net_change']),'Pharmacy stock/flow reconciliation');
 }
 if(['united-kingdom/price_index','england/price_index'].includes(key)&&d?.series_codes){
  requireValue(d.series_codes.index==='D7BT'&&d.series_codes.annual_rate==='D7G7'&&d.geography==='United Kingdom'&&d.index_base==='2015=100'&&d.unit==='index'&&d.annual_rate_unit==='percent'&&month(d.reference_month)&&Number.isFinite(d.index)&&d.index>0&&Number.isFinite(d.annual_rate)&&String(d.index)===String(Number(d.value))&&String(d.annual_rate)===String(Number(d.year_change))&&d.source_url?.endsWith('/d7bt/mm23/data')&&d.annual_rate_source_url?.endsWith('/d7g7/mm23/data'),'CPI joined definition or value contract');
 }
}
function provenanceFields(value,found=new Set()){
 if(Array.isArray(value))value.forEach(x=>provenanceFields(x,found));
 else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){
  if(['source','source_url','licence','licence_url','geography','unit','population','adjustment'].includes(key)&&v!==null&&v!=='')found.add(key);
  if(typeof v==='object')provenanceFields(v,found);
 }
 return [...found].sort();
}
export async function inspectSource(body,contract){
 const health=at(body,contract.health),data=at(body,contract.data);
 if(!health||!['ok','degraded','error'].includes(health.status))return {kind:'semantic',reason:'source_health_missing',assurance:contract.assurance};
 const base={retrieved_at:health.fetched_at||null,http_status:health.http_status||null,assurance:contract.assurance};
 if(health.status==='error')return {...base,kind:'transport',reason:'source_retrieval_failed',detail:health.error||null};
 if(data===undefined||data===null)return {...base,kind:'semantic',reason:'successful_source_without_data'};
 try{
  validateNativeTask(contract.key,data);
  let observations=[];
  if(contract.key===US_CONTRACT.key){
   const selected=await selectedUsResponse(body,{source:'cpi',measure:'CUUR0000SA0'});
   requireValue(selected.status===200&&selected.body.observations.length===13,'US CPI calendar coverage');
   observations=selected.body.observations.map(o=>({id:o.id,period:o.period,value:o.value,value_text:o.value_text,value_state:o.value_state,definition:o.definition,footnotes:o.footnotes,source_url:o.source_url,licence:o.licence,published_at:o.published_at,publisher_updated_at:o.publisher_updated_at}));
  } else if(contract.described_measures){
   const selected=await selectedResponse(body,{desk:contract.desk,source:contract.source,entry:[contract.source,contract.data,contract.health]});
   const expected=contract.observation_count||contract.described_measures;
   requireValue(selected.status===200&&selected.body.observations.length===expected&&!selected.body.unavailable_measures?.length,'described_measure_coverage');
   if(contract.source==='claimant_count')requireValue(new Set(selected.body.observations.map(o=>o.id)).size===13&&new Set(selected.body.observations.map(o=>o.period)).size===13,'claimant_exact_period_coverage');
   observations=selected.body.observations.map(o=>({id:o.id,period:o.period,value:o.value,value_state:o.value_state,definition:o.definition,source_url:o.source_url,licence:o.licence,published_at:o.published_at,publisher_updated_at:o.publisher_updated_at,qualifications:o.qualifications}));
   requireValue(observations.every(o=>o.source_url&&o.licence),'observation_provenance_missing');
  } else if(contract.key==='new-zealand/prices')observations=data.map(r=>({id:r.code,period:r.date+':'+r.period,value:r.price,value_state:'observed',unit:r.unit,geography:r.geography,release_status:r.price_status,source_url:r.source_url,licence:r.licence}));
  else if(data.series_codes&&contract.source==='price_index')observations=['index','annual_rate'].map(k=>({id:data.series_codes[k],period:data.reference_month,value:data[k],value_state:'observed',unit:k==='index'?data.index_base:'percent',geography:data.geography,source_url:k==='index'?data.source_url:data.annual_rate_source_url,published_at:data.published,licence:data.licence}));
  // Strip retrieval-only timestamps recursively; preserve observation and source
  // publication timestamps and all semantic qualifications.
  const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['fetched_at','retrieved_at'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
  observations=clean(observations).sort((a,b)=>a.id.localeCompare(b.id));
  const metadata=Array.isArray(data)?{}:Object.fromEntries(['source','source_url','licence','geography','unit','population','adjustment'].filter(k=>data[k]!==undefined).map(k=>[k,data[k]]));
  return {...base,kind:health.status==='degraded'?'degraded':'success',reason:health.status==='degraded'?'publisher_partial_or_delayed':null,observations,version:observations.length?fingerprint(observations):null,metadata,provenance_fields:provenanceFields(data),periods:[...new Set(observations.map(o=>o.period))].sort(),nonnumeric:observations.filter(o=>o.value_state!=='observed').map(o=>({id:o.id,state:o.value_state})),assurance:observations.length?'semantic contract checked; independent reference approval separate':contract.assurance};
 }catch(error){return {...base,kind:'semantic',reason:error.message};}
}
export function validateDiscovery(catalogue){return catalogue?.schema_version==='1.0'&&catalogue.countries?.length===8&&new Set(catalogue.countries.map(c=>c.records)).size===8&&Object.keys(DESKS).every(d=>catalogue.countries.some(c=>c.records===`/${d}.json`));}
export function validateUsDiscovery(catalogue){const entries=catalogue?.countries;return catalogue?.schema_version==='2.0'&&entries?.length===9&&new Set(entries.map(c=>c.id)).size===9&&Object.keys(DESKS).every(d=>entries.some(c=>c.id===`https://morningrows.com/${d}.json`&&c.resource_schema_version==='1.0'))&&entries.some(c=>c.id==='https://morningrows.com/united-states.json'&&c.resource_schema_version==='2.0');}
