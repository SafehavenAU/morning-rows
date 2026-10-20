// Public structure only. The frozen reader also verifies clock relationships,
// exact interval coverage, layout equality, decimal arithmetic and summaries.
import {AEMO_DAILY_INDEX,AEMO_DAILY_LIMITS,AEMO_DAILY_REGIONS,aemoDailyBundleDefinitions} from './aemo-daily-bundles.js';

const c=value=>({const:value});
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,required,properties});
const array=(items,min,max=min)=>({type:'array',minItems:min,maxItems:max,items});
const fixed=items=>({type:'array',minItems:items.length,maxItems:items.length,prefixItems:items,items:false});
const pattern=value=>({type:'string',pattern:value});
const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const esc=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const ref=name=>({$ref:'#/$defs/aemoDaily'+name});
const constants=value=>Object.fromEntries(Object.entries(value).map(([key,value])=>[key,c(value)]));
const datePattern='\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])';
const date={...pattern('^'+datePattern+'$'),format:'date'};
const timePattern='(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d';
const utc={...pattern('^'+datePattern+'T'+timePattern+'(?:\\.\\d{3})?Z$'),format:'date-time'};
const local={...pattern('^'+datePattern+'T'+timePattern+'\\+10:00$'),format:'date-time'};
const midnight={...pattern('^'+datePattern+'T00:00:00\\+10:00$'),format:'date-time'};
const hash=pattern('^[a-f0-9]{64}$');
const nonempty={type:'string',minLength:1};
const filename='PUBLIC_PRICES_\\d{8}0000_\\d{14}';
const bundleUrl=pattern('^'+esc(AEMO_DAILY_INDEX)+filename+'\\.zip$');
const price={type:'number',minimum:-100000000,maximum:100000000,multipleOf:0.01};
const count=integer(0,288);
const unknownTimes={published_at:c(null),publisher_updated_at:c(null),next_expected_update:c(null)};
const sourceUrl='https://morningrows.com/australia.json?source=grid_day';
const deskUrl='https://morningrows.com/australia.json';
const measureUrl=id=>sourceUrl+'&measure='+encodeURIComponent(id);

// Match the reader's lexical precision, including scientific notation whose
// expanded precision is at most five places. Magnitude equality remains semantic.
function rawPricePattern() {
  const signedExponent=value=>{
    const digits=String(Math.abs(value)),padded=digits.length===1?'0?'+digits:digits;
    return value<0?'-'+padded:value>0?'\\+?'+padded:'[+-]?0{1,2}';
  };
  return '^(?:'+Array.from({length:6},(_,places)=>{
    const exponents=Array.from({length:13},(_,n)=>signedExponent(n+places-5)).join('|');
    return '-?(?:0|[1-9]\\d{0,7})'+(places?'\\.\\d{'+places+'}':'')+'(?:[Ee](?:'+exponents+'))?';
  }).join('|')+')$';
}

function installNative(defs,definitions) {
  const d=definitions[0],regions=Object.keys(AEMO_DAILY_REGIONS);
  const timezone='fixed AEST / UTC+10; not local daylight-saving time';
  const rounding=definitions.find(d=>d.id==='SA1.minimum').rounding;
  const protocol={dataset:'DREGION',runno:1,intervention:0,apcflag:0,market_suspended_flag:0,csv_layouts:[2,3]};
  const sourceUrls=array(bundleUrl,2);
  defs.aemoDailyInterval=object({
    period_end:local,price,price_raw:{...pattern(rawPricePattern()),maxLength:24},
    layout2_price_raw:{...pattern(rawPricePattern()),maxLength:24},source_url:bundleUrl,
  });
  defs.aemoDailyBundle=object({
    trading_day:date,url:bundleUrl,filename:pattern('^'+filename+'\\.zip$'),
    report_generated_at:local,csv_name:pattern('^'+filename+'\\.CSV$'),csv_bytes:integer(1,AEMO_DAILY_LIMITS.expanded),
  });
  const provenance=(role,limit,extra={})=>object({
    role:c(role),url:role==='index'?c(AEMO_DAILY_INDEX):bundleUrl,
    requested_at:utc,retrieved_at:utc,bytes:integer(1,limit),sha256:hash,...extra,
  });
  defs.aemoDailyIndexProvenance=provenance('index',AEMO_DAILY_LIMITS.index);
  defs.aemoDailyBundleProvenance=provenance('bundle',AEMO_DAILY_LIMITS.compressed,{
    trading_day:date,csv_name:pattern('^'+filename+'\\.CSV$'),csv_bytes:integer(1,AEMO_DAILY_LIMITS.expanded),csv_sha256:hash,
  });
  regions.forEach(region=>{
    const common={region:c(region),geography:c(AEMO_DAILY_REGIONS[region]),calendar_day:date,source_url:c(AEMO_DAILY_INDEX),source_urls:sourceUrls};
    defs['aemoDaily'+region+'Healthy']=object({
      ...common,status:c('ok'),period_start:midnight,period_end:midnight,timezone:c(timezone),
      interval_minutes:c(5),interval_count:c(288),unit:c('AUD/MWh'),...constants(protocol),rounding:c(rounding),
      intervals:array(ref('Interval'),288),
      summary:object({mean:price,minimum:price,maximum:price,negative_count:count,zero_count:count}),
    });
    defs['aemoDaily'+region+'Error']=object({
      ...common,status:c('error'),error:nonempty,http_status:integer(400,599),
    },[...Object.keys(common),'status','error']);
  });
  defs.aemoDailyNative=object({
    status:{enum:['ok','degraded','error']},calendar_day:date,timezone:c(timezone),
    requested_day_policy:c('latest fully elapsed fixed-AEST calendar day; no earlier-day fallback'),
    next_rollover_at:utc,
    regions:fixed(regions.map(region=>({oneOf:[ref(region+'Healthy'),ref(region+'Error')]}))),
    bundles:array(ref('Bundle'),2),
    provenance:fixed([ref('IndexProvenance'),ref('BundleProvenance'),ref('BundleProvenance')]),
    definitions:fixed(definitions.map((_,i)=>ref('Definition'+i))),
    ...constants({publisher:d.publisher,licence:d.licence,licence_url:d.licence_url,limitations:d.limitations}),...unknownTimes,
  });
  const states=[
    ['Healthy','ok',['Healthy','Healthy']],
    ['DegradedSA1','degraded',['Healthy','Error']],
    ['DegradedVIC1','degraded',['Error','Healthy']],
    ['Error','error',['Error','Error']],
  ];
  for(const [name,status,regionalStates] of states) {
    defs['aemoDaily'+name]={allOf:[ref('Native'),{
      properties:{status:c(status),regions:fixed(regions.map((region,i)=>ref(region+regionalStates[i])))},
    }]};
  }
  defs.aemoDailyNative.allOf=states.map(([,status,regionalStates])=>({
    if:{properties:{regions:fixed(regions.map((region,i)=>ref(region+regionalStates[i])))}},
    then:{properties:{status:c(status)}},
  }));
  // sourceContext omits rows/states/catalogue/value/count; this source has none.
  defs.aemoDailyContext=ref('Native');
  definitions.forEach((definition,i)=>{
    const {region,statistic}=definition.dimensions;
    defs['aemoDailyRow'+i]=object({
      measure:c(definition.id),measure_id:c(definition.id),period:date,
      value:statistic.endsWith('_count')?count:price,value_state:c('observed'),
      geography:c(definition.geography),region:c(region),statistic:c(statistic),unit:c(definition.unit),kind:c('derived'),
      interval_count:c(288),interval_minutes:c(5),period_start:midnight,period_end:midnight,timezone:c(timezone),
      ...constants(protocol),rounding:c(rounding),source_url:c(AEMO_DAILY_INDEX),source_urls:sourceUrls,
      revision_status:c('mutable public publisher files; finality not established'),
    });
  });
}

function installSelected(defs,definitions) {
  const observation=i=>ref('Observation'+i);
  const unavailable=i=>object({
    measure:c(measureUrl(definitions[i].id)),definition:ref('Definition'+i),state:c('unavailable'),error:nonempty,
  });
  const exactSet=(items,field,ids)=>({
    ...array({oneOf:items},items.length),
    allOf:ids.map(id=>({contains:{required:[field],properties:{[field]:c(id)}},minContains:1,maxContains:1})),
  });
  const observedSet=indices=>exactSet(indices.map(observation),'measure',indices.map(i=>measureUrl(definitions[i].id)));
  const unavailableSet=indices=>indices.length?exactSet(indices.map(unavailable),'measure',indices.map(i=>measureUrl(definitions[i].id))):array(false,0);
  definitions.forEach((definition,i)=>{
    const regionIndex=i<5?0:1,statistic=definition.dimensions.statistic;
    defs['aemoDailyObservation'+i]={allOf:[{$ref:'#/$defs/observation'},object({
      id:pattern('^'+esc(measureUrl(definition.id))+'&observation='+datePattern+'$'),
      measure:c(measureUrl(definition.id)),definition:ref('Definition'+i),period:date,period_label:date,
      value:statistic.endsWith('_count')?count:price,value_state:c('observed'),version:hash,
      qualifications:ref('Row'+i),source_url:c(AEMO_DAILY_INDEX),licence:c(definition.licence),
      ...unknownTimes,publisher_status:c(null),native_pointer:c('/grid_day/regions/'+regionIndex+'/summary/'+statistic),
    })]};
  });
  const ids=definitions.map(d=>esc(encodeURIComponent(d.id))).join('|');
  const selected={
    required:['source','desk','context','unavailable_measures','content_version'],
    properties:{
      source:c(sourceUrl),desk:c(deskUrl),
      id:pattern('^'+esc(sourceUrl)+'(?:&measure=(?:'+ids+')(?:&observation='+datePattern+')?)?$'),
      retrieval:{properties:{status:{enum:['ok','degraded']},retrieved_at:utc}},
      content_version:hash,context:ref('Context'),observations:array({oneOf:definitions.map((_,i)=>observation(i))},1,10),
    },
    allOf:[
      {if:{properties:{context:{properties:{status:c('ok')}}}},then:{properties:{retrieval:{properties:{status:c('ok')}}}}},
      {if:{properties:{context:{properties:{status:c('degraded')}}}},then:{properties:{retrieval:{properties:{status:c('degraded')}}}}},
      {properties:{context:{properties:{status:{enum:['ok','degraded']}}}}},
      ...definitions.map((definition,i)=>({
        if:{properties:{id:{pattern:'&measure='+esc(encodeURIComponent(definition.id))+'(?:&|$)'}}},
        then:{properties:{
          data:ref('Row'+i),observations:array(observation(i),1),unavailable_measures:array(false,0),
          context:{properties:{regions:fixed([0,1].map(regionIndex=>regionIndex===(i<5?0:1)
            ?ref((i<5?'SA1':'VIC1')+'Healthy'):{oneOf:[ref((regionIndex===0?'SA1':'VIC1')+'Healthy'),ref((regionIndex===0?'SA1':'VIC1')+'Error')]}))}},
        }},
      })),
      {
        if:{properties:{id:c(sourceUrl)}},
        then:{oneOf:[
          ['Healthy',Array.from({length:10},(_,i)=>i),[]],
          ['DegradedSA1',[0,1,2,3,4],[5,6,7,8,9]],
          ['DegradedVIC1',[5,6,7,8,9],[0,1,2,3,4]],
        ].map(([state,healthy,failed])=>({properties:{
          data:ref(state),context:ref(state),observations:observedSet(healthy),unavailable_measures:unavailableSet(failed),
        }}))},
      },
    ],
  };
  defs.selected.allOf??=[];
  const identity={anyOf:[
    {required:['source'],properties:{source:c(sourceUrl)}},
    {required:['id'],properties:{id:{pattern:'^'+esc(sourceUrl)+'(?:&|$)'}}},
  ]};
  defs.selected.allOf.push(
    {if:{...identity,not:{required:['error']}},then:selected},
    // Error responses carry no invented observations. Their HTTP status is
    // enforced by route tests; status codes are not fields in this JSON body.
    {if:{...identity,required:['error']},then:{properties:{observations:array(false,0),data:c(null)}}},
  );
}

export function installAemoDailySchema(schema) {
  const defs=schema.$defs;
  if(defs.aemoDailyNative)return schema;
  const definitions=aemoDailyBundleDefinitions();
  definitions.forEach((definition,i)=>{defs['aemoDailyDefinition'+i]=c(definition);});
  installNative(defs,definitions);
  installSelected(defs,definitions);
  defs.desk.allOf??=[];
  defs.desk.allOf.push({
    if:{required:['grid_day']},
    then:{properties:{
      country:c('Australia'),grid_day:{oneOf:[c(null),ref('Native')]},
      _meta:{properties:{id:c(deskUrl)}},
    },allOf:[
      ...['ok','degraded','error'].map(status=>({
        if:{properties:{grid_day:{type:'object',properties:{status:c(status)}}}},
        then:{properties:{sources:{required:['grid_day'],properties:{grid_day:{
          required:['status','fetched_at'],properties:{status:c(status),fetched_at:utc},
        }}}}},
      })),
      {if:{properties:{grid_day:c(null)}},then:{properties:{sources:{required:['grid_day'],properties:{grid_day:{required:['status'],properties:{status:c('error')}}}}}}},
    ]},
  });
  return schema;
}
