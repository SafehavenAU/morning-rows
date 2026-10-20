import {bocHistoryDefinitions, BOC_HISTORY_MAX_BYTES} from './boc-history.js';
import {statcanHeadlineDefinitions, STATCAN_HEADLINE_URLS} from './statcan-headlines.js';
import {STATCAN_HEADLINE_CONTRACTS} from './statcan-headlines-contracts.js';
import {wraDefinitions} from './wra-depth.js';

const c=value=>({const:value});
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,required,properties});
const array=(items,min,max=min)=>({type:'array',minItems:min,maxItems:max,items});
const fixed=items=>({type:'array',minItems:items.length,maxItems:items.length,prefixItems:items,items:false});
const pattern=value=>({type:'string',pattern:value});
const integer=(minimum,maximum=Number.MAX_SAFE_INTEGER)=>({type:'integer',minimum,maximum});
const number=(minimum=0,maximum=Number.MAX_SAFE_INTEGER)=>({type:'number',minimum,maximum});
const constants=value=>Object.fromEntries(Object.entries(value).map(([key,value])=>[key,c(value)]));
const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));
const without=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));
const esc=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const datePattern='(?:19|20|21)\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])';
const monthPattern='(?:19|20|21)\\d{2}-(?:0[1-9]|1[0-2])';
const quarterPattern='(?:19|20|21)\\d{2}-Q[1-4]';
const yearPattern='(?:19|20|21)\\d{2}-\\d{2}';
const timePattern='(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d';
const date={...pattern('^'+datePattern+'$'),format:'date'};
const utc={...pattern('^'+datePattern+'T'+timePattern+'(?:\\.\\d{3})?Z$'),format:'date-time'};
const rawTime=pattern('^'+datePattern+'T(?:[01]\\d|2[0-3]):[0-5]\\d$');
const hash=pattern('^[a-f0-9]{64}$');
const unknownTimes={published_at:c(null),publisher_updated_at:c(null),next_expected_update:c(null)};
const url=(desk,source,measure)=>`https://morningrows.com/${desk}.json?source=${source}`+(measure?'&measure='+encodeURIComponent(measure):'');
const symbolPairs={0:'none',1:'preliminary',3:'revised'};
const qualityPairs={0:'normal',3:'A — data quality: excellent',4:'B — data quality: very good',5:'C — data quality: good',6:'D — data quality: acceptable',7:'E — use with caution'};
const pairs=(code,label,values)=>({oneOf:Object.entries(values).map(([key,value])=>({properties:{[code]:c(Number(key)),[label]:c(value)}}))});

function provenance(urlSchema,maximum,extra={}) {
  return object({...extra,url:urlSchema,retrieved_at:utc,bytes:integer(1,maximum),sha256:hash});
}
function roleProvenance(specs) {
  const entries=Object.entries(specs);
  return {
    oneOf:[array(false,0),{
      ...array({oneOf:entries.map(([role,{url,maximum}])=>provenance(c(url),maximum,{role:c(role)}))},entries.length),
      allOf:entries.map(([role])=>({contains:{required:['role'],properties:{role:c(role)}},minContains:1,maxContains:1})),
    }],
  };
}
function bocSchemas() {
  const definitions=bocHistoryDefinitions(),d=definitions[0];
  const rows=definitions.map(d=>object({
    series:c(d.id),period:date,value:{type:'number',exclusiveMinimum:0},
    value_text:{...pattern('^(?:0|[1-9]\\d*)(?:\\.\\d+)?$'),maxLength:24},
    unit:c(d.unit),base_currency:c(d.dimensions.base_currency),quote_currency:c('CAD'),value_state:c('observed'),
  }));
  const rowArray={...array(false,2,62),prefixItems:Array.from({length:62},(_,i)=>rows[i%2]),anyOf:Array.from({length:31},(_,i)=>({minItems:2*(i+1),maxItems:2*(i+1)}))};
  delete rowArray.items;
  rowArray.items=false;
  const endpoint='https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXGBPCAD/json';
  const historyUrl=pattern('^'+esc(endpoint)+'\\?start_date='+datePattern+'&end_date='+datePattern+'$');
  const native=object({
    status:c('ok'),window:object({start:date,end:date,calendar_days:c(31)}),rows:rowArray,latest_anchor:fixed(rows),
    metadata:object({date_count:integer(1,31),observation_count:{enum:Array.from({length:31},(_,i)=>2*(i+1))},first_period:date,latest_period:date}),
    definitions:c(definitions),...constants(pick(d,['geography','publisher','licence','licence_url','source_url','adjustment','period_convention','revision_policy','limitations','reuse_notice'])),
    ...unknownTimes,
    provenance:{oneOf:[array(false,0),{
      ...array({oneOf:[provenance(historyUrl,BOC_HISTORY_MAX_BYTES,{role:c('window')}),provenance(c(endpoint+'?recent=1'),BOC_HISTORY_MAX_BYTES,{role:c('latest')})]},2),
      allOf:['window','latest'].map(role=>({contains:{properties:{role:c(role)},required:['role']},minContains:1,maxContains:1})),
    }]},
  });
  return {native,definitions,rows,periodPattern:datePattern,context:object(without(native.properties,['rows']))};
}
function statcanSchemas(source) {
  const contract=STATCAN_HEADLINE_CONTRACTS[source],definitions=statcanHeadlineDefinitions(source),d=definitions[0];
  const periodPattern=source==='homes'?quarterPattern:monthPattern,period=pattern('^'+periodPattern+'$');
  const value=source==='price_index'?{type:'number',exclusiveMinimum:0,maximum:Number.MAX_SAFE_INTEGER}:source==='jobs'?number(0,100):integer(0);
  const metadata=object({
    count:c(contract.series.length),latest_period:period,cube_end_date:date,release_timestamp_raw:rawTime,release_timezone:c(null),
    product_id:c(contract.product_id),cube_title:c(contract.cube_title),
    legacy_period_convention:c(source==='homes'?'quarter-start month YYYY-MM; not monthly':'reference month YYYY-MM'),
  });
  const prov=roleProvenance(Object.fromEntries(Object.entries(STATCAN_HEADLINE_URLS).map(([role,url])=>[role,{url,maximum:role==='cube'?262144:16384}])));
  const notice=object({
    source_notice:pattern('^'+esc(`Source: Canada Mortgage and Housing Corporation (CMHC), ${contract.cube_title}, `)+quarterPattern+esc('. This information is reproduced and distributed on an "as is" basis with the permission of CMHC.')+'$'),
    adaptation_notice:pattern('^'+esc(`Adapted from Canada Mortgage and Housing Corporation, ${contract.cube_title}, `)+quarterPattern+esc('. This does not constitute an endorsement by Canada Mortgage and Housing Corporation of this product.')+'$'),
    terms_url:c(d.licence_url),conditions:c(d.licence_conditions),
  });
  const rows=definitions.map((definition,i)=>{
    const s=contract.series[i];
    const row=object({
      measure_id:c(definition.id),period,value,value_state:c('observed'),reference_date:date,period_start:date,period_end:date,
      ref_per_raw:date,ref_per2:c(''),ref_per_raw2:c(''),...constants(pick(definition,['unit','geography','adjustment','dimensions'])),
      frequency_code:c(s.frequency_code),scalar_code:c(s.scalar_code),unit_code:c(s.unit_code),decimals:c(s.decimals),
      status_code:{enum:contract.statuses},quality:{enum:contract.statuses.map(code=>qualityPairs[code])},
      security_level_code:c(0),symbol_code:{enum:[0,1,3]},symbol:{enum:Object.values(symbolPairs)},
      release_timestamp_raw:rawTime,release_timezone:c(null),definition:c(definition),
      ...(source==='homes'?{licence_notice:notice}:{}),
      ...(source==='jobs'?{name:c(definition.geography),rate:value,source:c(d.publisher),licence:c(d.licence),licence_url:c(d.licence_url),metadata,provenance:prov}:{}),
    });
    row.allOf=[pairs('status_code','quality',Object.fromEntries(contract.statuses.map(code=>[code,qualityPairs[code]]))),pairs('symbol_code','symbol',symbolPairs)];
    return row;
  });
  const native=source==='jobs'?fixed(rows):object({
    period:pattern('^'+(source==='homes'?'(?:19|20|21)\\d{2}-(?:01|04|07|10)':monthPattern)+'$'),
    [contract.legacy_field]:value,...(source==='homes'?{quarter:period}:{}),rows:fixed(rows),metadata,definitions:c(definitions),
    ...constants(pick(d,['publisher','licence','licence_url','source_url','limitations'])),
    ...(source==='homes'?{original_publisher:c(d.original_publisher),licence_notice:notice}:{}),...unknownTimes,provenance:prov,
  });
  return {native,definitions,rows,periodPattern,context:source==='jobs'?object({}):object(without(native.properties,['rows']))};
}
function wraSchemas() {
  const definitions=wraDefinitions(),d=definitions[0],period=pattern('^'+yearPattern+'$');
  const rows=definitions.map(d=>object({
    coverage:c(d.dimensions.coverage),transaction_type:c(d.dimensions.transaction_type),value:number(),
    unit:c(d.unit),geography:c(d.geography),period,notes:{type:'string',not:{pattern:'[Cc]onfidential|[Nn]ot [Aa]pplicable|[Nn]ot [Aa]vailable'}},
  }));
  const native=object({
    source:c(d.publisher),source_url:c(d.source_url),licence:c(d.licence),licence_url:c(d.licence_url),geography:c('Wales'),
    period,period_start:{...date,pattern:'^(?:19|20|21)\\d{2}-04-01$'},period_end:{...date,pattern:'^(?:19|20|21)\\d{2}-03-31$'},
    rows:{...array({oneOf:rows},4),allOf:rows.map(row=>({contains:row,minContains:1,maxContains:1}))},
    note:{type:'string',minLength:1},
  });
  const selectedRows=rows.map((row,i)=>object({...row.properties,measure_id:c(definitions[i].id),period_start:native.properties.period_start,period_end:native.properties.period_end,value_state:c('observed'),source_url:c(d.source_url),licence:c(d.licence)}));
  return {native,definitions,rows:selectedRows,periodPattern:yearPattern,context:object(without(native.properties,['rows']))};
}

// Structural checks complement reader validation: date arithmetic, current
// publisher anchoring, matching aliases and derived arithmetic remain semantic.
export function installGapSchema(schema) {
  const defs=schema.$defs;
  if(defs.gapBocNative) return schema;
  const entries=[
    ['canada','exchange_history','gapBoc',bocSchemas()],
    ...Object.keys(STATCAN_HEADLINE_CONTRACTS).map(source=>['canada',source,'gapStatcan'+source.replace(/(^|_)([a-z])/g,(_,a,b)=>b.toUpperCase()),statcanSchemas(source)]),
    ['wales','land_transaction_tax','gapWra',wraSchemas()],
  ];
  defs.desk.allOf??=[];
  defs.selected.allOf??=[];
  for(const [desk,source,name,contract]of entries) {
    // Reuse schemas rather than embedding 62 FX row definitions or duplicating
    // every full StatCan job row in each selector/observation branch.
    const rowReferences=new Map(contract.rows.map((row,i)=>[row,{$ref:'#/$defs/'+name+'Row'+i}]));
    const sharedReferences=new Map();
    for(const key of ['metadata','provenance']) {
      const value=contract.native.properties?.[key]||contract.rows[0].properties[key];
      if(value) {
        defs[name+key]=value;
        sharedReferences.set(value,{$ref:'#/$defs/'+name+key});
      }
    }
    contract.definitions.forEach((definition,i)=>{
      defs[name+'Definition'+i]=c(definition);
      if(contract.rows[i].properties.definition)sharedReferences.set(contract.rows[i].properties.definition,{$ref:'#/$defs/'+name+'Definition'+i});
    });
    if(contract.native.properties?.definitions)sharedReferences.set(contract.native.properties.definitions,fixed(contract.definitions.map((_,i)=>({$ref:'#/$defs/'+name+'Definition'+i}))));
    const compact=value=>{
      if(rowReferences.has(value))return rowReferences.get(value);
      if(sharedReferences.has(value))return sharedReferences.get(value);
      if(Array.isArray(value))return value.map(compact);
      return value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,compact(v)])):value;
    };
    contract.rows.forEach((row,i)=>{
      defs[name+'Row'+i]=compact({...row});
      defs[name+'SemanticRow'+i]=source==='jobs'?compact({...row,required:row.required.filter(key=>key!=='provenance'),properties:without(row.properties,['provenance'])}):{$ref:'#/$defs/'+name+'Row'+i};
    });
    defs[name+'Native']=compact(contract.native);
    defs[name+'Context']=contract.context===contract.native?{$ref:'#/$defs/'+name+'Native'}:compact(contract.context);
    defs[name+'Row']={oneOf:[...rowReferences.values()]};
    defs.desk.allOf.push({
      if:{required:['country'],properties:{country:c({australia:'Australia',canada:'Canada',wales:'Wales'}[desk])}},
      then:{properties:{[source]:{oneOf:[c(null),{$ref:'#/$defs/'+name+'Native'}]}}},
    });
    if(['exchange_history','land_transaction_tax'].includes(source))defs.desk.allOf.push({
      if:{required:[source]},then:{properties:{country:c({australia:'Australia',canada:'Canada',wales:'Wales'}[desk])}},
    });
    installSelected(defs,desk,source,name,contract);
  }
  return schema;
}

function installSelected(defs,desk,source,name,contract) {
  const sourceUrl=url(desk,source),base=esc(sourceUrl),ids=contract.definitions.map(d=>esc(encodeURIComponent(d.id))).join('|');
  const rowRef=i=>({$ref:'#/$defs/'+name+'Row'+i});
  const observationRef=i=>({$ref:'#/$defs/'+name+'Observation'+i});
  const observationFor=(definition,i)=>({
    allOf:[{$ref:'#/$defs/observation'},{
      required:['source_url','licence','qualifications','publisher_status','published_at','publisher_updated_at','next_expected_update','native_pointer'],
      properties:{
        id:pattern('^'+esc(url(desk,source,definition.id))+'&observation='+contract.periodPattern+'$'),
        measure:c(url(desk,source,definition.id)),definition:{$ref:'#/$defs/'+name+'Definition'+i},period:pattern('^'+contract.periodPattern+'$'),
        value:contract.rows[i].properties.value,value_state:c('observed'),version:hash,
        qualifications:{$ref:'#/$defs/'+name+'SemanticRow'+i},licence:c(definition.licence),...unknownTimes,
        source_url:c(definition.source_url),
        native_pointer:pattern('^/'+source+(source==='exchange_history'?'/rows/(?:[0-9]|[1-5][0-9]|6[01])':source==='jobs'?'/'+i:source==='land_transaction_tax'?'/rows/[0-3]':'/rows/0')+'$'),
        publisher_status:source==='exchange_history'?c(null):source==='land_transaction_tax'?{oneOf:[c(null),object({notes:contract.rows[i].properties.notes})]}:{
          ...object(pick(contract.rows[i].properties,['status_code','quality','security_level_code','symbol_code','symbol'])),
          allOf:contract.rows[i].allOf,
        },
      },
    }],
  });
  contract.definitions.forEach((definition,i)=>{defs[name+'Observation'+i]=observationFor(definition,i);});
  defs[name+'Observation']={oneOf:contract.definitions.map((_,i)=>observationRef(i))};
  const selected={
    required:['source','desk','context','unavailable_measures','content_version'],
    properties:{
      source:c(sourceUrl),desk:c(`https://morningrows.com/${desk}.json`),
      id:pattern('^'+base+'(?:&measure=(?:'+ids+')(?:&observation='+contract.periodPattern+')?)?$'),
      retrieval:{properties:{status:c('ok'),retrieved_at:utc}},
      unavailable_measures:array(false,0),content_version:hash,
      observations:array({$ref:'#/$defs/'+name+'Observation'},1,source==='exchange_history'?62:contract.definitions.length),
    },
    allOf:contract.definitions.map((definition,i)=>({
      if:{properties:{id:{pattern:'&measure='+esc(encodeURIComponent(definition.id))+'(?:&|$)'}}},
      then:{
        properties:{observations:{items:observationRef(i)}},
        if:{properties:{id:{pattern:'&observation='}}},
        then:{properties:{data:rowRef(i),observations:{minItems:1,maxItems:1}}},
        else:{properties:{
          data:source==='exchange_history'?array(rowRef(i),1,31):rowRef(i),
          observations:{minItems:1,maxItems:source==='exchange_history'?31:1},
        }},
      },
    })),
  };
  selected.properties.context={$ref:'#/$defs/'+name+'Context'};
  selected.allOf.push({
    if:{properties:{id:c(sourceUrl)}},
    then:{properties:{data:source==='exchange_history'?{$ref:'#/$defs/'+name+'Native/properties/rows'}:{$ref:'#/$defs/'+name+'Native'},observations:{
      minItems:source==='exchange_history'?2:contract.definitions.length,
      maxItems:source==='exchange_history'?62:contract.definitions.length,
    }}},
  });
  const sourceSelected={properties:{id:c(sourceUrl)}};
  if(source==='exchange_history') {
    selected.allOf.push(...Array.from({length:31},(_,i)=>{
      const count=i+1;
      return {
        if:{properties:{context:{properties:{metadata:{properties:{date_count:c(count)}}}}}},
        then:{
          properties:{context:{properties:{metadata:{properties:{observation_count:c(count*2)}}}}},
          if:sourceSelected,
          then:{properties:{data:{minItems:count*2,maxItems:count*2},observations:{
            minItems:count*2,maxItems:count*2,
            allOf:contract.definitions.map(definition=>({contains:{required:['measure'],properties:{measure:c(url(desk,source,definition.id))}},minContains:count,maxContains:count})),
          }}},
          else:{
            if:{properties:{id:{not:{pattern:'&observation='}}}},
            then:{properties:{data:{minItems:count,maxItems:count},observations:{minItems:count,maxItems:count}}},
          },
        },
      };
    }));
  } else selected.allOf.push({
    if:sourceSelected,
    then:{properties:{observations:{allOf:contract.definitions.map(definition=>({
      contains:{required:['measure'],properties:{measure:c(url(desk,source,definition.id))}},minContains:1,maxContains:1,
    }))}}},
  });
  defs.selected.allOf.push({
    if:{anyOf:[
      {required:['source'],properties:{source:c(sourceUrl)}},
      {required:['id'],properties:{id:{pattern:'^'+base+'(?:&|$)'}}},
    ],not:{required:['error']}},
    then:selected,
  });
}
