// Isolated contract prototype, not a production route or committed migration.
import {catalogue,ORIGIN,digest,finishResponse} from '../../../lib/information.js';
import {SERIES,URLS} from './reader.js';
export const measure=`${ORIGIN}/united-states.json?source=cpi&measure=${SERIES}`;
export const definition={series_id:SERIES,geography:'U.S. city average',population:'All urban consumers; see BLS population exclusions',unit:'index',base_period:'1982-84=100',adjustment:'not seasonally adjusted',period_convention:'calendar month',boundary_note:'2018 CPI design: 2010 Census / 2013 OMB frame; national urban target in 50 states and DC, excludes territories; no subnational output.',uncertainty:null,uncertainty_note:'Not supplied in this selected extract; not zero uncertainty.',revision_policy:'NSA has no routine seasonal revision; corrections possible; no vintage archive.'};
export const usEntry={name:'United States',id:`${ORIGIN}/united-states.json`,page:'/united-states',records:'/united-states.json',catalog:'/catalog.v2.json?desk=united-states',source_count:1,resource_schema_version:'2.0',resource_schema:'/schema.v2.json'};
export function catalogueV2(desk){
 const base={name:'Morning Rows',schema_version:'2.0',schema:`${ORIGIN}/schema.v2.json`,prototype_only:true};
 if(desk==='united-states')return{...base,sources:[{key:'cpi',records:usEntry.id+'?source=cpi',measures:[{id:SERIES,records:measure,definition,retention:'13 consecutive calendar slots; exact dates only'}]}]};
 return{...base,countries:[...catalogue().countries.map(c=>({...c,resource_schema_version:'1.0',resource_schema:'/schema.json'})),usEntry]};
}
export const schemaV2={
 $schema:'https://json-schema.org/draft/2020-12/schema',$id:`${ORIGIN}/schema.v2.json`,title:'Isolated proposed v2 catalogue and US selected response',
 oneOf:[{$ref:'#/$defs/catalogue'},{$ref:'#/$defs/selection'}],
 $defs:{
  catalogue:{type:'object',required:['name','schema_version'],properties:{name:{const:'Morning Rows'},schema_version:{const:'2.0'},countries:{type:'array',minItems:1,items:{type:'object',required:['id','records','catalog','resource_schema_version','resource_schema'],properties:{resource_schema_version:{enum:['1.0','2.0']}}}},sources:{type:'array'}},oneOf:[{required:['countries']},{required:['sources']}]},
  selection:{type:'object',required:['schema_version','id','data','retrieval','observations','context'],properties:{schema_version:{const:'2.0'},id:{type:'string',format:'uri'},retrieval:{type:'object',required:['status','retrieved_at'],properties:{status:{enum:['ok','error']},retrieved_at:{type:'string'}}},context:{type:'object'},observations:{type:'array',items:{$ref:'#/$defs/observation'}}}},
  observation:{type:'object',required:['id','measure','value','value_state','period','definition','version','source_url','licence'],properties:{id:{type:'string',format:'uri'},measure:{const:measure},value:{type:['number','null']},value_state:{enum:['observed','missing','unavailable','suppressed']},period:{type:'string',pattern:'^[0-9]{4}-(0[1-9]|1[0-2])$'},definition:{type:'object'},version:{type:'string',pattern:'^[a-f0-9]{64}$'}},allOf:[{if:{properties:{value_state:{const:'observed'}}},then:{properties:{value:{type:'number'}}},else:{properties:{value:{type:'null'}}}}]}
 }
};
export async function represent(data,retrievedAt,error=null){
 const context={definition,source_url:URLS.data,licence:'Public domain; cite US Bureau of Labor Statistics',coverage:'13 calendar slots, not 13 numeric values',published_at:null,next_expected_update:null,timing_qualification:'Not established by this runtime rehearsal; dated release reconciliation is separate.'};
 const observations=error?[]:await Promise.all(data.observations.map(async row=>{
  const cell={...row,id:measure+'&observation='+row.period,measure,definition,source_url:data.source_url,licence:data.licence,published_at:null,next_expected_update:null};
  return{...cell,version:await digest(cell)};
 }));
 return{schema_version:'2.0',id:measure,data:error?null:data.observations,context,retrieval:{status:error?'error':'ok',retrieved_at:retrievedAt,...(error?{error}:{})},observations,...(error?{error:'retrieval_failed'}:{})};
}
export async function respond(request,body,headers={}){
 const response=await finishResponse(request,Response.json(body,{status:body.retrieval?.status==='error'?503:200,headers}),body.id,body.retrieval?.retrieved_at);
 response.headers.set('Link',`<${body.id}>; rel="canonical", <${ORIGIN}/catalog.v2.json>; rel="index", <${ORIGIN}/schema.v2.json>; rel="describedby"`);
 return response;
}
export async function routeV2(request,data,retrievedAt){
 const u=new URL(request.url),params=u.searchParams;
 if(u.pathname==='/schema.v2.json')return Response.json(schemaV2);
 if(u.pathname==='/catalog.v2.json'){
  if([...params.keys()].some(k=>k!=='desk')||params.getAll('desk').length>1)return Response.json({error:'unsupported_selector'},{status:400});
  if(params.has('desk')&&params.get('desk')!=='united-states')return Response.json({error:'follow_resource_catalogue'},{status:404});
  return Response.json(catalogueV2(params.get('desk')));
 }
 if(u.pathname!=='/united-states.json')return null;
 if([...params.keys()].some(k=>!['source','measure','observation'].includes(k)||params.getAll(k).length!==1)||params.has('measure')&&!params.has('source')||params.has('observation')&&!params.has('measure'))return Response.json({error:'unsupported_selector'},{status:400});
 if(params.has('source')&&params.get('source')!=='cpi'||params.has('measure')&&params.get('measure')!==SERIES)return Response.json({error:'unknown_selection'},{status:404});
 const body=await represent(data,retrievedAt);
 body.id=ORIGIN+u.pathname+(u.search?u.search:'');
 if(params.has('observation')){
  body.observations=body.observations.filter(r=>r.period===params.get('observation'));
  if(!body.observations.length)return Response.json({error:'observation_not_retained',data:null,observations:[]},{status:404});
  body.data=body.observations[0];
 }
 return respond(request,body);
}
