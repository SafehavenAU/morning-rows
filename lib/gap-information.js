// Typed adapters for the bounded gap pass. These do not fetch or replace sources.
import {bocHistoryDefinitions,validateBocHistoryRepresentation} from './boc-history.js';
import {STATCAN_HEADLINE_SOURCES,statcanHeadlineDefinitions,statcanHeadlineRows,validateStatcanHeadlineRepresentation} from './statcan-headlines.js';
import {wraDefinitions,wraObservationRows,validateWraRepresentation} from './wra-depth.js';
import {aemoDailyBundleDefinitions,aemoDailyBundleObservationRows,validateAemoDailyBundlesRepresentation} from './aemo-daily-bundles.js';
import {isRemainingSource,remainingDefinitions,validateRemainingRepresentation,remainingCells} from './remaining-information.js';

const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z');
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const isAemo=(desk,key)=>desk==='australia'&&key==='grid_day';
const isBoc=(desk,key)=>desk==='canada'&&key==='exchange_history';
const isStatcan=(desk,key)=>desk==='canada'&&STATCAN_HEADLINE_SOURCES.includes(key);
const isWra=(desk,key)=>desk==='wales'&&key==='land_transaction_tax';
export function isGapSource(desk,key){return isAemo(desk,key)||isBoc(desk,key)||isStatcan(desk,key)||isWra(desk,key)||isRemainingSource(desk,key);}
export function gapDefinitions(desk,key){
 if(isAemo(desk,key))return aemoDailyBundleDefinitions();
 if(isRemainingSource(desk,key))return remainingDefinitions(desk,key);
 if(isBoc(desk,key))return bocHistoryDefinitions();
 if(isStatcan(desk,key))return statcanHeadlineDefinitions(key);
 if(isWra(desk,key))return wraDefinitions();
 return null;
}
export function validateGapRepresentation(desk,key,value,acquisition){
 // A supplied public clock is mandatory for all handled sources. The caller
 // should use the current request clock for the daily FX window.
 if(!isGapSource(desk,key)||!acquisition||!instant(acquisition.retrieved_at))return false;
 if(isAemo(desk,key))return validateAemoDailyBundlesRepresentation(value,{now:acquisition.retrieved_at});
 if(isRemainingSource(desk,key))return validateRemainingRepresentation(desk,key,value,acquisition);
 if(isBoc(desk,key))return validateBocHistoryRepresentation(value,acquisition);
 if(isStatcan(desk,key))return validateStatcanHeadlineRepresentation(key,value,acquisition);
 return validateWraRepresentation(value,acquisition);
}
export function gapCells(desk,key,value,acquisition){
 if(!isGapSource(desk,key))return null;
 if(isRemainingSource(desk,key))return remainingCells(desk,key,value,acquisition);
 if(!validateGapRepresentation(desk,key,value,acquisition))throw Error('Gap source representation validation failed');
 const definitions=gapDefinitions(desk,key),byId=new Map(definitions.map(definition=>[definition.id,definition]));
 const make=(id,row,pointer)=>({definition:byId.get(id),row,value:row.value,period:row.period,pointer,value_state:'observed'});
 if(isAemo(desk,key))return aemoDailyBundleObservationRows(value).map(row=>make(row.measure_id,row,`/regions/${value.regions.findIndex(r=>r.region===row.region)}/summary/${row.statistic}`));
 if(isBoc(desk,key))return value.rows.map((row,i)=>make(row.series,row,`/rows/${i}`));
 if(isStatcan(desk,key))return statcanHeadlineRows(key,value).map((row,i)=>make(row.measure_id,row,key==='jobs'?`/${i}`:`/rows/${i}`));
 return wraObservationRows(value).map(row=>make(row.measure_id,row,`/rows/${value.rows.findIndex(r=>r.coverage===row.coverage&&r.transaction_type===row.transaction_type)}`));
}
export function gapSelectionFailure(desk,key,value,{measure,observation,retrieved_at}={}){
 if(!isGapSource(desk,key))return null;
 if(!validateGapRepresentation(desk,key,value,{retrieved_at}))return {status:503,error:'representation_validation_failed',message:'The complete bounded source contract or current request clock failed; no substitute observations returned.'};
 const definitions=gapDefinitions(desk,key);
 if(measure&&!definitions.some(d=>d.id===measure))return {status:404,error:'unknown_measure',message:'This measure is outside the fixed source contract.'};
 if(observation&&!measure)return {status:400,error:'incomplete_selection',message:'An exact observation requires a measure.'};
 if(observation&&(isBoc(desk,key)||isAemo(desk,key))&&!date(observation))return {status:400,error:'invalid_observation',message:'This source requires an exact valid YYYY-MM-DD publisher/calendar date.'};
 if(isAemo(desk,key)&&measure){const definition=definitions.find(d=>d.id===measure),region=value.regions.find(r=>r.region===definition.dimensions.region);if(region.status==='error')return {status:503,error:'retrieval_failed',message:'The requested region failed; no incomplete window, different region or older day was substituted.'};}
 if(observation){
  const cells=gapCells(desk,key,value,{retrieved_at});
  if(!cells.some(cell=>cell.definition.id===measure&&cell.period===observation)){
   if(isBoc(desk,key)&&observation>=value.window.start&&observation<=value.window.end)return {status:404,error:'not_published_on_date',message:'No observation for this date appears in the successful bounded publisher response. No holiday, zero or carry-forward is inferred.'};
   return {status:404,error:'observation_not_retained',message:'This exact period is outside the successfully retained selection. No nearby or latest period was substituted.'};
  }
 }
 return null;
}
export function gapSelectedData(desk,key,value,{measure,observation,retrieved_at}={}){
 const failure=gapSelectionFailure(desk,key,value,{measure,observation,retrieved_at});
 if(failure)throw Object.assign(Error(failure.message),failure);
 if(!isGapSource(desk,key))return undefined;
 if(!measure)return isBoc(desk,key)?value.rows:value;
 const rows=gapCells(desk,key,value,{retrieved_at}).filter(cell=>cell.definition.id===measure&&(!observation||cell.period===observation)).map(cell=>cell.row);
 // Only the FX measure retains a multi-date history. Other described measures
 // have one current aggregate per fixed identity.
 return isBoc(desk,key)&&!observation?rows:rows[0];
}
function withoutAcquisition(value){
 if(Array.isArray(value))return value.map(withoutAcquisition);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['provenance','retrieved_at','fetched_at','requested_at','acquired_at'].includes(key)).map(([key,item])=>[key,withoutAcquisition(item)]));
 return value;
}
export function gapSemanticRow(desk,key,row){return isGapSource(desk,key)?withoutAcquisition(row):row;}
export function gapSemanticContext(desk,key,context){return isGapSource(desk,key)?withoutAcquisition(context):context;}
