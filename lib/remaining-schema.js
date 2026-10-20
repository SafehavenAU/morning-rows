// Structural contracts complement the readers' independent semantic/date checks.
import {sfcActivityDefinitions,SFC_ACTIVITY_CONTRACT} from './sfc-activity.js';
import {cmhcRentDefinitions} from './cmhc-rent.js';

const c=value=>({const:value});
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,required,properties});
const array=(items,min,max=min)=>({type:'array',minItems:min,maxItems:max,items});
const fixed=items=>({type:'array',minItems:items.length,maxItems:items.length,prefixItems:items,items:false});
const pattern=value=>({type:'string',pattern:value});
const integer=(minimum=0,maximum=Number.MAX_SAFE_INTEGER)=>({type:'integer',minimum,maximum});
const constants=value=>Object.fromEntries(Object.entries(value).map(([key,value])=>[key,c(value)]));
const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));
const without=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));
const esc=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const yearPattern='(?:19|20|21)\\d{2}';
const monthPattern=yearPattern+'-(?:0[1-9]|1[0-2])';
const datePattern=monthPattern+'-(?:0[1-9]|[12]\\d|3[01])';
const date={...pattern('^'+datePattern+'$'),format:'date'};
const utc={...pattern('^'+datePattern+'T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{3})?Z$'),format:'date-time'};
const rawTime=pattern('^'+datePattern+'T(?:[01]\\d|2[0-3]):[0-5]\\d$');
const hash=pattern('^[a-f0-9]{64}$');
const unknownTimes={published_at:c(null),publisher_updated_at:c(null),next_expected_update:c(null)};
const canonical=(desk,source,measure)=>`https://morningrows.com/${desk}.json?source=${source}`+(measure?'&measure='+encodeURIComponent(measure):'');
const country={england:'England',scotland:'Scotland','northern-ireland':'Northern Ireland',canada:'Canada'};

function provenance(url,maximum,extra={}) {
  return object({...extra,url:c(url),retrieved_at:utc,bytes:integer(1,maximum),sha256:hash});
}
function roleProvenance(roles,{optional=true,roleKey='role'}={}) {
  const entries=Object.entries(roles);
  const complete={
    ...array({oneOf:entries.map(([role,{url,max}])=>provenance(url,max,{[roleKey]:c(role)}))},entries.length),
    allOf:entries.map(([role])=>({contains:{required:[roleKey],properties:{[roleKey]:c(role)}},minContains:1,maxContains:1})),
  };
  return optional?{oneOf:[array(false,0),complete]}:complete;
}
function sfcSchemas() {
  const definitions=sfcActivityDefinitions(),C=SFC_ACTIVITY_CONTRACT;
  const value={...integer(),multipleOf:5};
  const nativeRows=C.measures.map(m=>object({
    measure:c(m.id),label:c(m.label),value,value_state:c('observed'),unit:c(C.unit),geography:c(C.geography),
    period:c(C.period),period_start:c(C.period_start),period_end:c(C.period_end),mode:c(m.mode),level:c(m.level),rounding:c('nearest five'),
  }));
  const rows=nativeRows.map((row,i)=>object({measure_id:c(definitions[i].id),...without(row.properties,['measure'])}));
  const native=object({
    status:c('ok'),...constants(without(C,['measures','max_bytes'])),rows:fixed(nativeRows),
    provenance:array(provenance(C.source_url,C.max_bytes,{role:c('workbook')}),1),
  });
  return {definitions,native,rows,periodPattern:esc(C.period)};
}
// CMHC's dynamic annual values remain constrained to two exact census places,
// one two-bedroom row-and-apartment population and conditional HMIP attribution.
function cmhcSchemas() {
  const definitions=cmhcRentDefinitions(),d=definitions[0];
  const title='Canada Mortgage and Housing Corporation, average rents for areas with a population of 10,000 and over';
  const symbols={0:'none',1:'preliminary',3:'revised'};
  const symbolPairs=Object.entries(symbols).map(([code,symbol])=>({properties:{symbol_code:c(Number(code)),symbol:c(symbol)}}));
  const notices=object({
    source_notice:pattern('^'+esc(`Source: Canada Mortgage and Housing Corporation (CMHC), ${title}, `)+yearPattern+esc('. This information is reproduced and distributed on an "as is" basis with the permission of CMHC.')+'$'),
    adaptation_notice:pattern('^'+esc(`Adapted from Canada Mortgage and Housing Corporation, ${title}, `)+yearPattern+esc('. This does not constitute an endorsement by Canada Mortgage and Housing Corporation of this product.')+'$'),
    terms_url:c(d.licence_url),conditions:c(d.licence_conditions),
  });
  const rows=definitions.map(definition=>{
    const result=object({
      measure_id:c(definition.id),period:pattern('^'+yearPattern+'$'),value:integer(1),unit:c('CAD per month'),value_state:c('observed'),
      geography:c(definition.geography),geography_type:c(definition.geography_type),dguid:c(definition.dguid),
      reference_date:pattern('^'+yearPattern+'-01-01$'),ref_per_raw:pattern('^'+yearPattern+'-10-01$'),survey_month:pattern('^'+yearPattern+'-10$'),
      period_start:pattern('^'+yearPattern+'-10-01$'),period_end:pattern('^'+yearPattern+'-10-31$'),ref_per2:c(''),ref_per_raw2:c(''),
      dimensions:c(definition.dimensions),frequency_code:c(12),scalar_code:c(0),unit_code:c(81),decimals:c(0),
      status_code:c(0),quality:c('normal'),security_level_code:c(0),symbol_code:{enum:[0,1,3]},symbol:{enum:Object.values(symbols)},
      release_timestamp_raw:rawTime,release_timezone:c(null),definition:c(definition),licence_notice:notices,
    });
    result.allOf=[{oneOf:symbolPairs}];return result;
  });
  const native=object({
    status:c('ok'),rows:fixed(rows),
    metadata:object({
      count:c(2),latest_period:pattern('^'+yearPattern+'$'),cube_end_date:pattern('^'+yearPattern+'-01-01$'),
      release_timestamp_raw:rawTime,release_timezone:c(null),product_id:c(34100133),cube_title:c(title),
    }),
    definitions:c(definitions),...constants(pick(d,['publisher','original_publisher','licence','licence_url','source_url','limitations'])),
    licence_notice:notices,provenance:roleProvenance({
      data:{url:'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods',max:16384},
      series:{url:'https://www150.statcan.gc.ca/t1/wds/rest/getSeriesInfoFromCubePidCoord',max:16384},
      cube:{url:'https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata',max:131072},
    },{optional:false}),
  });
  return {definitions,native,rows,periodPattern:yearPattern,cmhc:true};
}

export function installRemainingSchema(schema) {
  const defs=schema.$defs;
  if(defs.remainingSfcNative)return schema;
  const entries=[
    ['scotland','college_activity','remainingSfc',sfcSchemas()],
    ['canada','rental_benchmark','remainingCmhc',cmhcSchemas()],
  ];
  defs.desk.allOf??=[];defs.selected.allOf??=[];
  for(const [desk,source,name,contract] of entries) {
    const references=new Map();
    contract.rows.forEach((row,i)=>references.set(row,{$ref:'#/$defs/'+name+'Row'+i}));
    contract.definitions.forEach((definition,i)=>{defs[name+'Definition'+i]=c(definition);});
    if(contract.native.properties.definitions)references.set(contract.native.properties.definitions,fixed(contract.definitions.map((_,i)=>({$ref:'#/$defs/'+name+'Definition'+i}))));
    const compact=value=>{
      if(references.has(value))return references.get(value);
      if(Array.isArray(value))return value.map(compact);
      return value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,value])=>[key,compact(value)])):value;
    };
    contract.rows.forEach((row,i)=>{
      const copy={...row,properties:{...row.properties}};
      if(copy.properties.definition)copy.properties.definition={$ref:'#/$defs/'+name+'Definition'+i};
      defs[name+'Row'+i]=compact(copy);
    });
    defs[name+'Native']=compact(contract.native);
    defs[name+'Context']=compact(object(without(contract.native.properties,['rows'])));
    defs.desk.allOf.push(
      {if:{required:[source]},then:{properties:{country:c(country[desk]),[source]:{oneOf:[c(null),{$ref:'#/$defs/'+name+'Native'}]}}}},
    );
    installSelected(defs,desk,source,name,contract);
  }
  return schema;
}
function installSelected(defs,desk,source,name,contract) {
  const sourceUrl=canonical(desk,source),base=esc(sourceUrl),ids=contract.definitions.map(d=>esc(encodeURIComponent(d.id))).join('|');
  const periodUrl=contract.periodUrlPattern||contract.periodPattern;
  const row=i=>({$ref:'#/$defs/'+name+'Row'+i}),observation=i=>({$ref:'#/$defs/'+name+'Observation'+i});
  contract.definitions.forEach((definition,i)=>{
    const publisherStatus=contract.cmhc?object(pick(contract.rows[i].properties,['status_code','quality','security_level_code','symbol_code','symbol'])):c(null);
    if(contract.cmhc)publisherStatus.allOf=contract.rows[i].allOf;
    defs[name+'Observation'+i]={allOf:[{$ref:'#/$defs/observation'},{
      required:['source_url','licence','qualifications','publisher_status','published_at','publisher_updated_at','next_expected_update','native_pointer'],
      properties:{
        id:pattern('^'+esc(canonical(desk,source,definition.id))+'&observation='+periodUrl+'$'),
        measure:c(canonical(desk,source,definition.id)),definition:{$ref:'#/$defs/'+name+'Definition'+i},
        period:pattern('^'+contract.periodPattern+'$'),value:contract.rows[i].properties.value,value_state:c('observed'),version:hash,
        qualifications:row(i),source_url:c(definition.source_url),licence:c(definition.licence),...unknownTimes,
        native_pointer:c('/'+source+'/rows/'+i),publisher_status:publisherStatus,
      },
    }]};
  });
  const selected={
    required:['source','desk','context','unavailable_measures','content_version'],
    properties:{
      source:c(sourceUrl),desk:c(`https://morningrows.com/${desk}.json`),
      id:pattern('^'+base+'(?:&measure=(?:'+ids+')(?:&observation='+periodUrl+')?)?$'),
      retrieval:{properties:{status:c('ok'),retrieved_at:utc}},
      unavailable_measures:array(false,0),content_version:hash,
      context:{$ref:'#/$defs/'+name+'Context'},
      observations:array({oneOf:contract.definitions.map((_,i)=>observation(i))},1,contract.definitions.length),
    },
    allOf:contract.definitions.map((definition,i)=>({
      if:{properties:{id:{pattern:'&measure='+esc(encodeURIComponent(definition.id))+'(?:&|$)'}}},
      then:{properties:{data:row(i),observations:array(observation(i),1)}},
    })),
  };
  selected.allOf.push({
    if:{properties:{id:c(sourceUrl)}},
    then:{properties:{data:{$ref:'#/$defs/'+name+'Native'},observations:{
      ...array({oneOf:contract.definitions.map((_,i)=>observation(i))},contract.definitions.length),
      allOf:contract.definitions.map(definition=>({contains:{required:['measure'],properties:{measure:c(canonical(desk,source,definition.id))}},minContains:1,maxContains:1})),
    }}},
  });
  defs.selected.allOf.push({
    if:{anyOf:[
      {required:['source'],properties:{source:c(sourceUrl)}},
      {required:['id'],properties:{id:{pattern:'^'+base+'(?:&|$)'}}},
    ],not:{required:['error']}},
    then:selected,
  });
}
