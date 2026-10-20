// Exact bounded additions from the remaining-gap contracts. No fetching here.
import {sfcActivityDefinitions,sfcActivityRows,validateSfcActivity} from './sfc-activity.js';
import {cmhcRentDefinitions,validateCmhcRentRepresentation} from './cmhc-rent.js';

const contracts={
  'scotland/college_activity':{definitions:sfcActivityDefinitions,rows:sfcActivityRows,validate:validateSfcActivity},
  'canada/rental_benchmark':{definitions:cmhcRentDefinitions,rows:value=>value.rows,validate:validateCmhcRentRepresentation},
};
export function isRemainingSource(desk,key){return Object.hasOwn(contracts,desk+'/'+key);}
export function remainingDefinitions(desk,key){return contracts[desk+'/'+key]?.definitions()||null;}
export function validateRemainingRepresentation(desk,key,value,acquisition){
  const contract=contracts[desk+'/'+key],clock=acquisition?.retrieved_at;
  if(!contract||typeof clock!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(clock)||
    !Number.isFinite(Date.parse(clock))||new Date(clock).toISOString().replace('.000Z','Z')!==clock.replace('.000Z','Z'))return false;
  // Pure parsers can omit acquisition evidence, but a public source must retain
  // every original input needed by the accepted reader contract.
  if(!Array.isArray(value?.provenance)||value.provenance.length!==(key==='college_activity'?1:3))return false;
  return contract.validate(value,acquisition);
}
export function remainingCells(desk,key,value,acquisition){
  if(!isRemainingSource(desk,key))return null;
  if(!validateRemainingRepresentation(desk,key,value,acquisition))throw Error('Remaining source representation validation failed');
  const contract=contracts[desk+'/'+key],definitions=new Map(contract.definitions().map(d=>[d.id,d]));
  const rows=contract.rows(value);
  return rows.map((row,index)=>({
    definition:definitions.get(row.measure_id),row,value:row.value,period:row.period,
    pointer:`/rows/${index}`,value_state:row.value_state,
  }));
}
