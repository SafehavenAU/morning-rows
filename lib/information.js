import { INVENTORY } from './inventory.js';
import { STATS_NZ_SERIES } from './stats-nz-series.js';
import { CLAIMANT_GEOGRAPHIES, claimantDefinition, validateClaimantRepresentation } from './claimant-count.js';

export const ORIGIN = 'https://morningrows.com';
export const SCHEMA_VERSION = '1.0';
export const DESKS = Object.fromEntries(['Australia','New Zealand','Canada','United Kingdom','England','Scotland','Wales','Northern Ireland'].map(name => [name.toLowerCase().replaceAll(' ','-'),name]));
const at = (body, path) => path.split('.').reduce((v,k) => v?.[k],body);
const canonical = (desk, source, measure, observation) => {
  const u = new URL(`/${desk}.json`,ORIGIN);
  for(const [k,v] of Object.entries({source,measure,observation})) if(v!==undefined) u.searchParams.set(k,v);
  return u.href;
};
const commonTitles = {people:'Population estimates',job:'Unemployment rate',jobs:'Unemployment by state or province',price_index:'Consumer price index',price:'Consumer price index',wage:'Earnings or wage index',product:'Gross domestic product',shop:'Retail sales',trade:'Trade balance',grid:'Electricity market snapshot',exchange:'Exchange rates',world:'World Bank indicators',space:'Space weather',food_establishments:'Food hygiene service establishment counts',hospital:'Emergency department patients seen on time',stats:'23 selected Stats NZ series',childhood_bmi:'National childhood BMI aggregates',projection:'2024-based all-persons/all-ages population projection',prices:'Five NZ electricity nodes, last interval of latest completed trading day'};
const triage = [['MYH-RM0035','Resuscitation'],['MYH-RM0036','Emergency'],['MYH-RM0037','Urgent'],['MYH-RM0038','Semi-urgent'],['MYH-RM0039','Non-urgent']];
const states = {NSW:'New South Wales',Vic:'Victoria',Qld:'Queensland',WA:'Western Australia',SA:'South Australia',Tas:'Tasmania',ACT:'Australian Capital Territory',NT:'Northern Territory'};
const currencies = {FXUSDCAD:'US dollar',FXAUDCAD:'Australian dollar',FXGBPCAD:'UK pound',FXNZDCAD:'New Zealand dollar'};
const insolvencies = ['Total company insolvencies','Compulsory liquidations','Creditors voluntary liquidations','Administrations','Company voluntary arrangements','Administrative receiverships'];
const pharmacies = ['total','excluding_distance_sellers','distance_sellers','excluding_distance_sellers_opened','excluding_distance_sellers_closed','excluding_distance_sellers_net_change','distance_sellers_opened','distance_sellers_closed','distance_sellers_net_change'];
const slug = s => s.toLowerCase().replaceAll(' ','-');
const ogl = 'Open Government Licence v3.0';
const claimantLimits = 'Thirteen retained monthly administrative claimant counts, all sexes, age 16+, rounded to five persons and not seasonally adjusted. These are not unemployment estimates, rates or available recruits. National geographies only; no local counts, arbitrary history or substitute months.';

// These definitions describe existing selections only. Null metadata is deliberately
// unknown: it does not license a comparison or assert seasonal adjustment/finality.
export function measuresFor(desk,key) {
  const definition = (id,name,extra={}) => ({id,name,geography:DESKS[desk],population:null,unit:null,adjustment:null,kind:'observation',period_convention:null,cadence:null,revision_policy:'Not established; compare content versions, do not assume finality.',...extra});
  if(key==='claimant_count'&&Object.hasOwn(CLAIMANT_GEOGRAPHIES,desk)) return [claimantDefinition(desk)];
  if(desk==='new-zealand'&&key==='stats') return STATS_NZ_SERIES.map(s=>definition(s.id,s.name,{geography:s.geography,population:s.population_group||null,unit:s.unit,kind:s.kind,dimensions:s.dimensions,period_convention:`Publisher ${s.period_column||'fixed reference period'}; retain period_label, which can differ from the code.`,selection:s.kind==='projection'?(s.projection_period||'current_calendar_year'):'latest_available_in_selected_series',publisher:'Stats NZ',licence:'CC BY 4.0',source_url:`https://api.data.stats.govt.nz/rest/data/STATSNZ,${s.id},1.0/${s.key}?dimensionAtObservation=AllDimensions&format=csv`}));
  if(desk==='australia'&&key==='hospital') return Object.entries(states).flatMap(([code,name])=>triage.map(([id,label])=>definition(`${code}.${id}`,`${name}: ${label}, seen on time`,{geography:`${name}, Australia`,population:'Emergency department presentations in the selected triage category and jurisdiction',unit:'percent',adjustment:'Published percentage; no seasonal adjustment applied',period_convention:'Australian financial year, 1 July through 30 June',cadence:'annual',dimensions:{jurisdiction:code,triage:id,measure:'MYH0010'},publisher:'Australian Institute of Health and Welfare',licence:'CC BY 4.0',source_url:'https://myhospitalsapi.aihw.gov.au/api/v1/flat-data-extract/MYH-ED-WAITS'})));
  if(desk==='wales'&&key==='projection') return [definition('population-2024-based','All-persons/all-ages projected population',{population:'All persons, all ages',unit:'people',kind:'projection',period_convention:'Mid-year of selected calendar year',dimensions:{base_year:2024,age:'All Ages',sex:'Persons',area:'Wales'},publisher:'StatsWales / Welsh Government; ONS',licence:ogl,source_url:'https://api.stats.gov.wales/v2/20b6276b-92f7-48fd-806e-69c35b54d9e0/data?format=csv'})];
  if(desk==='northern-ireland'&&key==='childhood_bmi') return ['P1BMIOb','P1BMIOwOb','Y8BMIOb','Y8BMIOwOb'].map(id=>definition(id,`${id.startsWith('P1')?'Primary 1':'Year 8'} children ${id.includes('Ow')?'overweight or obese':'obese'}`,{population:`${id.startsWith('P1')?'Primary 1':'Year 8'} pupils, all persons; see trust coverage caveat`,unit:'percent',period_convention:'Academic year YYYY/YY',cadence:'annual',dimensions:{STATISTIC:id,SEX:'All',LGD2014:'N92000002'},publisher:'Department of Health (Northern Ireland), published by NISRA',licence:ogl,source_url:'https://ws-data.nisra.gov.uk/public/api.restful/PxStat.Data.Cube_API.ReadDataset/CHILDBMILGD/JSON-stat/2.0/en'}));
  if(desk==='canada'&&key==='exchange') return Object.entries(currencies).map(([id,name])=>definition(id,`${name} to Canadian dollar daily average`,{geography:'Currency pair; not subnational geography',population:'Indicative daily average currency reference rate',unit:`CAD per 1 ${id.slice(2,5)}`,adjustment:'Nominal exchange rate; not seasonally adjusted',period_convention:'Published business date YYYY-MM-DD; no weekend/holiday carry-forward',cadence:'Business days, normally by 16:30 Eastern Time',dimensions:{series:id,base_currency:id.slice(2,5),quote_currency:'CAD'},publisher:'Bank of Canada',licence:'Bank of Canada terms; attribution, accurate presentation and transformation disclosure',source_url:`https://www.bankofcanada.ca/valet/observations/${id}/json?recent=1`,licence_url:'https://www.bankofcanada.ca/terms/'}));
  if(['scotland','northern-ireland'].includes(desk)&&key==='company_insolvencies') return insolvencies.map(name=>definition(slug(name),name,{population:'Registered company insolvency procedures; distinct national jurisdiction',unit:'company insolvencies',adjustment:'Not seasonally adjusted',period_convention:'Calendar month YYYY-MM',cadence:'monthly',publisher:'The Insolvency Service',licence:ogl}));
  if(desk==='england'&&key==='pharmacies') return pharmacies.map(id=>definition(id,id.replaceAll('_',' '),{population:'NHS community pharmacies in England, including/excluding distance sellers as selected',unit:'pharmacies',period_convention:id.includes('opened')||id.includes('closed')||id.includes('net_change')?'Calendar-month flow YYYY-MM':'Month-end stock YYYY-MM',cadence:'monthly',publisher:'NHS Business Services Authority',licence:ogl}));
  return [];
}

export function sourceCard(desk,[key,path,health]) {
  const definitions=measuresFor(desk,key);
  return {id:canonical(desk,key),key,name:key==='claimant_count'?'Administrative claimant count, not seasonally adjusted':commonTitles[key.replace(/^also\./,'')]||key.replace(/^also\./,'').replaceAll('_',' '),records:canonical(desk,key),data_pointer:'/'+path.replaceAll('.','/'),health_pointer:'/'+health.replaceAll('.','/'),representation:definitions.length?'described_measures':'native_fields',measure_count:definitions.length,
    ...(key==='claimant_count'?{limits:claimantLimits}:{}),
    ...(definitions.length?{measures:definitions.map(d=>({id:d.id,name:d.name,geography:d.geography,unit:d.unit,kind:d.kind,records:canonical(desk,key,d.id),...(key==='claimant_count'?{definition:d,retained_calendar_slots:13,observation_selector:'YYYY-MM',selection:'Source and measure selections return all thirteen months; an observation selects one exact retained month.'}:{})}))}:{qualification:'Read native field metadata. Unestablished geography, population, units, adjustment, licence or timing must remain unknown; the desk name is not a geography assertion.'})};
}

export function catalogue(desk) {
  const base={name:'Morning Rows',site:ORIGIN,schema_version:SCHEMA_VERSION,schema:`${ORIGIN}/schema.json`,auth:'none',index:'/llms.txt'};
  if(desk) return {...base,id:`${ORIGIN}/catalog.json?desk=${desk}`,desk:DESKS[desk],records:canonical(desk),sources:INVENTORY[desk].map(s=>sourceCard(desk,s)),limits:'Only existing selections. No arbitrary history, local claimant counts, rent benchmarks, daily price averages or cross-country comparability is implied. Native sections may have incomplete metadata.'+(Object.hasOwn(CLAIMANT_GEOGRAPHIES,desk)?` ${claimantLimits}`:'')};
  return {...base,summary:'Discover a desk, follow its source directory, then request one source or described measure. Use exact observation periods; unsupported filters return errors.',countries:Object.entries(DESKS).map(([slug,name])=>({name,id:canonical(slug),page:`/${slug}`,records:`/${slug}.json`,catalog:`/catalog.json?desk=${slug}`,source_count:INVENTORY[slug].length,...(slug==='australia'?{also:'/morning.json'}:{})})),usage:{source:'/{desk}.json?source={key}',measure:'/{desk}.json?source={key}&measure={id}',observation:'/{desk}.json?source={key}&measure={id}&observation={exact-period}',conditional:'Retain ETag; send If-None-Match on the identical selected URL. 304 means unchanged content and health within cache policy, not a new publisher release.'}};
}

export const INFORMATION_SCHEMA = {
  $schema:'https://json-schema.org/draft/2020-12/schema', $id:`${ORIGIN}/schema.json`,title:'Morning Rows selected response',type:'object',required:['schema_version','id','retrieval','data','observations'],
  properties:{schema_version:{const:SCHEMA_VERSION},id:{type:'string',format:'uri'},source:{type:'string',format:'uri'},data:{description:'Existing native section, or the selected native row. Null on failed retrieval. Caveats are also retained in context.'},context:{type:'object'},retrieval:{$ref:'#/$defs/retrieval'},observations:{type:'array',items:{$ref:'#/$defs/observation'}}},
  $defs:{retrieval:{type:'object',required:['status','retrieved_at'],properties:{status:{enum:['ok','degraded','error']},retrieved_at:{type:['string','null']},error:{type:'string'}}},observation:{type:'object',required:['id','measure','value','value_state','period','definition','version'],properties:{id:{type:'string',format:'uri'},measure:{type:'string',format:'uri'},value:{type:['number','null']},value_state:{enum:['observed','suppressed','missing','unavailable']},period:{type:'string'},definition:{type:'object'},version:{type:'string'},published_at:{type:['string','null']},publisher_updated_at:{type:['string','null']},next_expected_update:{type:['string','null']}}}},
  'x-usage':{
    selectors:'GET or HEAD. catalogue accepts desk. Desks accept source, measure and observation; observation requires measure; measure requires source. Values are case sensitive. Unknown/duplicate query keys return 400; unknown IDs 404; requested period not currently retained 404; retrieval/representation failure 503.',
    compatibility:'Full desks retain existing fields with additive _meta. Native fields are not standardized observations. This schema validates catalogues, full desks and successful opt-in selected responses; error responses are documented separately by their error codes. Additional fields are allowed. Breaking changes require a new major version.',
    identity:'Canonical apex JSON URL identifies desk; source selector identifies reader section; measure selector identifies fixed dimensions; observation selector identifies exact source period. IDs never depend on value or array position. These URLs are not permanent observation archives.',
    missingness:'Zero is observed. Null is never zero. Suppressed requires explicit evidence; otherwise retain missing/unavailable. Retrieval failure is separate, with no observation fabricated. A source may have successful rows and unavailable rows.',
    times:'Observation period is not publication time. published_at is null when unknown. publisher_updated_at retains dataset/upload meaning, not guaranteed first publication. retrieved_at is the retained attempt time, not response render time. next_expected_update is null unless a publication date is established; cache TTL is not cadence.',
    revisits:'Weak ETag excludes fetched_at/retrieved_at only, retaining value, period, caveats, publisher version and errors. Compare observation id and version: same id/version unchanged; same id/different version revision or metadata correction; different period newly available observation. Claimant observation versions exclude changing row offsets and source acquisition provenance; their content_version excludes acquisition hashes and publisher response-generation clocks, retained separately in context. A provenance-only ETag change is not a statistical revision. Official release classification requires publisher evidence. No daily-change staleness rule.',
    comparison:'Require matching measure definitions, geography, population, units, adjustment and period convention. Unknown adjustment or coverage is a verification gap. Overlapping components and projections must not be added to totals or treated as estimates.',
    scope:'Described measures: Stats NZ 23 selections, AIHW 40 cells, Wales projection, NISRA 4 BMI aggregates, BoC 4 currencies, Scotland/NI 6 insolvency measures each, England 9 pharmacy measures, and thirteen monthly claimant counts in each of five UK/nation desks. Claimants are administrative counts, not seasonally adjusted, not unemployment estimates or rates. All other existing sections remain discoverable with native fields and explicit metadata limitations.',
    citation:'Cite observation id + version + source_url and period/definition; retain the response for historical audit. Row pointer is a locator in that response, not a stable identity. Publication URLs, methodological caveats and licence are retained in context.'
  }
};
// One linked schema validates all three JSON data representations, while usage
// notes also explain native fields. Legacy fields remain open for compatibility.
INFORMATION_SCHEMA.$defs.selected={type:'object',required:INFORMATION_SCHEMA.required,properties:INFORMATION_SCHEMA.properties};
INFORMATION_SCHEMA.$defs.desk={type:'object',required:['site','country','sources','_meta'],properties:{site:{const:ORIGIN},country:{enum:Object.values(DESKS)},sources:{type:'object'},_meta:{type:'object',required:['schema_version','id','catalog'],properties:{schema_version:{const:SCHEMA_VERSION},id:{type:'string',format:'uri'},catalog:{type:'string',format:'uri'}}}}};
INFORMATION_SCHEMA.$defs.catalogue={type:'object',required:['name','schema_version'],properties:{name:{const:'Morning Rows'},schema_version:{const:SCHEMA_VERSION},countries:{type:'array',minItems:8,maxItems:8},sources:{type:'array'}},oneOf:[{required:['countries']},{required:['sources']}]};
INFORMATION_SCHEMA.oneOf=[{$ref:'#/$defs/selected'},{$ref:'#/$defs/desk'},{$ref:'#/$defs/catalogue'}];
INFORMATION_SCHEMA.title='Morning Rows catalogue, desk and selected-response contracts';
delete INFORMATION_SCHEMA.required;
delete INFORMATION_SCHEMA.properties;

// Keep historical native sections open. The new claimant representation has a
// fixed statistical meaning and therefore gets its own additive typed contract.
const claimantPeriod = {type:'string',pattern:'^\\d{4}-(0[1-9]|1[0-2])$'};
const claimantCount = {type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER,multipleOf:5};
const claimantDesks = Object.keys(CLAIMANT_GEOGRAPHIES);
const claimantRowFor = d => ({allOf:[{$ref:'#/$defs/claimantRow'},{properties:{geography:{const:CLAIMANT_GEOGRAPHIES[d].name},geography_code:{const:CLAIMANT_GEOGRAPHIES[d].code},dimensions:{properties:{geography:{const:CLAIMANT_GEOGRAPHIES[d].code}}}}}]});
INFORMATION_SCHEMA.$defs.claimantDefinition = {
  type:'object',required:['id','geography','geography_code','population','unit','adjustment','kind','period_convention','cadence','rounding','dimensions','publisher','licence','source_url','revision_policy','limitations'],
  properties:{id:{const:'claimants'},unit:{const:'persons'},adjustment:{const:'not seasonally adjusted'},kind:{const:'observation'},cadence:{const:'monthly'},dimensions:{type:'object',required:['dataset','gender','age','measure','measures','geography'],properties:{dataset:{const:'NM_162_1'},gender:{const:'0'},age:{const:'0'},measure:{const:'1'},measures:{const:'20100'},geography:{enum:claimantDesks.map(d=>CLAIMANT_GEOGRAPHIES[d].code)}}}},
  enum:claimantDesks.map(claimantDefinition),
};
INFORMATION_SCHEMA.$defs.claimantRow = {
  type:'object',required:['period','value','value_state','geography','geography_code','unit','adjustment','dimensions','obs_status','obs_conf'],
  properties:{period:claimantPeriod,value:claimantCount,value_state:{const:'observed'},unit:{const:'persons'},adjustment:{const:'not seasonally adjusted'},obs_status:{const:'A'},obs_conf:{const:'F'},dimensions:{type:'object',required:['dataset','gender','age','measure','measures','geography'],properties:{dataset:{const:'NM_162_1'},gender:{const:'0'},age:{const:'0'},measure:{const:'1'},measures:{const:'20100'}}}},
  oneOf:claimantDesks.map(d=>({properties:{geography:{const:CLAIMANT_GEOGRAPHIES[d].name},geography_code:{const:CLAIMANT_GEOGRAPHIES[d].code},dimensions:{properties:{geography:{const:CLAIMANT_GEOGRAPHIES[d].code}}}}})),
};
INFORMATION_SCHEMA.$defs.claimantNative = {
  type:'object',required:['dataset','measure','definition','rows','metadata','source_url','licence','provenance'],
  properties:{dataset:{const:'NM_162_1'},measure:{const:'claimants'},definition:{$ref:'#/$defs/claimantDefinition'},rows:{type:'array',minItems:13,maxItems:13,items:{$ref:'#/$defs/claimantRow'}},metadata:{type:'object',required:['count','first_period','latest_period'],properties:{count:{const:13},first_period:claimantPeriod,latest_period:claimantPeriod}},source_url:{type:'string',format:'uri'},licence:{type:'string'},provenance:{type:'array'}},
};
INFORMATION_SCHEMA.$defs.claimantObservation = {
  allOf:[{$ref:'#/$defs/observation'},{type:'object',required:['source_url','licence','qualifications','publisher_status'],properties:{period:claimantPeriod,value:claimantCount,value_state:{const:'observed'},definition:{$ref:'#/$defs/claimantDefinition'},version:{type:'string',pattern:'^[a-f0-9]{64}$'},source_url:{type:'string',format:'uri'},licence:{type:'string'},qualifications:{$ref:'#/$defs/claimantRow'},publisher_status:{type:'object',required:['obs_status','obs_conf'],properties:{obs_status:{const:'A'},obs_conf:{const:'F'}}}}}],
};
INFORMATION_SCHEMA.$defs.selected.allOf = claimantDesks.map(d=>({
  if:{required:['source'],properties:{source:{const:canonical(d,'claimant_count')}},not:{required:['error']}},
  then:{
    required:['context'],properties:{retrieval:{properties:{status:{const:'ok'}}},context:{required:['definition','metadata','provenance'],properties:{definition:{const:claimantDefinition(d)}}},observations:{items:{allOf:[{$ref:'#/$defs/claimantObservation'},{properties:{definition:{const:claimantDefinition(d)},measure:{const:canonical(d,'claimant_count','claimants')},qualifications:claimantRowFor(d)}}]}}},
    allOf:[{
      if:{properties:{id:{pattern:'&observation='}}},
      then:{properties:{data:claimantRowFor(d),observations:{minItems:1,maxItems:1}}},
      else:{properties:{data:{type:'array',minItems:13,maxItems:13,items:claimantRowFor(d)},observations:{minItems:13,maxItems:13}}},
    }],
  },
}));
INFORMATION_SCHEMA.$defs.desk.properties.claimant_count = {oneOf:[{type:'null'},{$ref:'#/$defs/claimantNative'}]};
INFORMATION_SCHEMA.$defs.desk.allOf = [{if:{required:['claimant_count']},then:{properties:{country:{enum:claimantDesks.map(d=>DESKS[d])}}}},...claimantDesks.map(d=>({
  if:{required:['claimant_count'],properties:{country:{const:DESKS[d]},claimant_count:{type:'object'}}},
  then:{properties:{claimant_count:{properties:{definition:{const:claimantDefinition(d)},rows:{items:claimantRowFor(d)}}}}},
}))];

export function validateSelection(url) {
  let desk=url.pathname.slice(1,-5); if(url.pathname==='/morning.json') desk='australia';
  const isDesk=Object.hasOwn(DESKS,desk)&&url.pathname.endsWith('.json');
  const allowed=url.pathname==='/catalog.json'?['desk']:isDesk?['source','measure','observation']:[];
  for(const key of url.searchParams.keys()) if(!allowed.includes(key)||url.searchParams.getAll(key).length!==1||!url.searchParams.get(key)) return {status:400,code:'unsupported_query',message:'Unknown, empty or duplicate selector. No date/geography/history filter is silently ignored.'};
  if(url.pathname==='/catalog.json'&&url.searchParams.has('desk')&&!Object.hasOwn(DESKS,url.searchParams.get('desk'))) return {status:404,code:'unknown_desk'};
  if(!isDesk) return {};
  const source=url.searchParams.get('source'),measure=url.searchParams.get('measure'),observation=url.searchParams.get('observation');
  if((measure&&!source)||(observation&&!measure)) return {status:400,code:'incomplete_selection'};
  const entry=source&&INVENTORY[desk].find(e=>e[0]===source);
  if(source&&!entry) return {status:404,code:'unknown_source'};
  if(measure&&!measuresFor(desk,source).some(m=>m.id===measure)) return {status:404,code:'unknown_measure',message:'This source may expose native fields only. Inspect its catalogue.'};
  return {desk,source,measure,observation,entry};
}

export function semantic(value) {
  if(Array.isArray(value)) return value.map(semantic);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().filter(k=>!['fetched_at','retrieved_at'].includes(k)).map(k=>[k,semantic(value[k])]));
  return value;
}
export async function digest(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(semantic(value))));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function sourceContext(data) {
  if(!data||Array.isArray(data)) return {};
  return Object.fromEntries(Object.entries(data).filter(([k])=>!['rows','states','catalogue','value','count'].includes(k)));
}

function cells(desk,key,data,definitions) {
  if(!data) return [];
  const make=(id,row,value,period,pointer,extra={})=>({definition:definitions.find(d=>d.id===id),row,value,period:String(period??''),pointer,...extra});
  if(key==='claimant_count') return data.rows.map((r,i)=>make('claimants',r,r.value,r.period,`/rows/${i}`,{value_state:r.value_state}));
  if(key==='stats'&&desk==='new-zealand') return (data.rows||[]).map((r,i)=>make(r.id,r,r.value,r.period,`/rows/${i}`,{value_state:r.status==='error'?'unavailable':undefined}));
  if(key==='hospital'&&desk==='australia') return (data.states||[]).flatMap((r,i)=>triage.map(([id,label])=>make(`${r.code}.${id}`,r,r[label],data.year,`/states/${i}/${label}`,{value_state:r.value_status?.[label]||(r[label]===null?'unavailable':undefined)})));
  if(key==='projection'&&desk==='wales') return [make('population-2024-based',data,data.value,data.period,'/value')];
  if(key==='childhood_bmi') return (data.rows||[]).map((r,i)=>make(r.id,r,r.value,r.period,`/rows/${i}`,{value_state:r.value===null?'unavailable':undefined}));
  if(key==='exchange'&&desk==='canada') return (data.rows||[]).map((r,i)=>make(Object.keys(currencies).find(k=>currencies[k]===r.name),r,r.value,data.date,`/rows/${i}`));
  if(key==='company_insolvencies') return (data.rows||[]).map((r,i)=>make(slug(r.measure),r,r.value,r.period,`/rows/${i}`));
  if(key==='pharmacies') return (data.rows||[]).map((r,i)=>make(r.measure,r,r.value,r.period,`/rows/${i}`));
  return [];
}

function validCell(desk,key,data,c) {
  if(!c.definition) return false;
  if(c.value_state&&((c.value_state==='observed')!==(c.value!==null))) return false;
  if(c.value!==null&&(typeof c.value!=='number'||!Number.isFinite(c.value))) return false;
  if(c.row.geography&&c.row.geography!==c.definition.geography || c.row.unit&&c.row.unit!==c.definition.unit) return false;
  if(!c.period) return c.value===null;
  if(key==='stats') return /^\d{4}(?:\d{2})?$/.test(c.period)&&JSON.stringify(semantic(c.row.dimensions))===JSON.stringify(semantic(c.definition.dimensions))&&c.row.kind===c.definition.kind;
  if(key==='projection') return /^Mid-year \d{4}$/.test(c.period)&&data.kind==='projection'&&data.base_year===2024&&data.meaning?.includes('all ages, persons');
  if(key==='hospital') return /^\d{4}-\d{2}$/.test(c.period)&&data.measure_code==='MYH0010'&&data.period?.start===`${c.period.slice(0,4)}-07-01`&&data.period?.end===`${Number(c.period.slice(0,4))+1}-06-30`&&(c.value===null||c.value>=0&&c.value<=100);
  if(key==='childhood_bmi') return /^\d{4}\/\d{2}$/.test(c.period)&&Number(c.period.slice(-2))===(Number(c.period.slice(0,4))+1)%100&&c.row.sex==='All Persons'&&(c.value===null||c.value>=0&&c.value<=100);
  if(key==='exchange'&&desk==='canada') return /^\d{4}-\d{2}-\d{2}$/.test(c.period)&&Number.isFinite(Date.parse(c.period))&&new Date(c.period).toISOString().slice(0,10)===c.period&&c.value>0;
  if(key==='company_insolvencies'||key==='pharmacies') return /^\d{4}-(0[1-9]|1[0-2])$/.test(c.period)&&Number.isSafeInteger(c.value)&&(key!=='company_insolvencies'||c.row.seasonally_adjusted===false&&c.value>=0);
  return true;
}

export async function selectedResponse(body,selection) {
  const {desk,source:key,entry,measure,observation}=selection;
  const native=at(body,entry[1])??null, health=at(body,entry[2]);
  const retrieval={status:health?.status||'error',retrieved_at:health?.fetched_at||null,...(health?.error?{error:health.error}:{}),...(health?.http_status?{http_status:health.http_status}:{})};
  const id=canonical(desk,key,measure||undefined,observation||undefined), source=canonical(desk,key);
  const base={schema_version:SCHEMA_VERSION,id,source,desk:canonical(desk),schema:`${ORIGIN}/schema.json`,retrieval,context:sourceContext(native),data:native,observations:[]};
  if(!health||native===null&&retrieval.status==='ok') return {status:503,body:{...base,data:null,error:'source_contract_unavailable',message:'Expected source health or native data is missing; no successful observation inferred.'}};
  if(retrieval.status==='error') return {status:503,body:{...base,data:null,error:'retrieval_failed',message:'No successful selected-source response. Other desk sources remain available.'}};
  const claimant=key==='claimant_count';
  // This source is a complete rolling history for one measure, not one cell per
  // measure. Validate it before accessing rows or making observation identities.
  if(claimant&&(retrieval.status!=='ok'||!validateClaimantRepresentation(native,desk))) return {status:503,body:{...base,data:null,retrieval:{...retrieval,status:'error',error:'Claimant-count representation validation failed'},error:'representation_validation_failed',message:'A complete thirteen-month national claimant-count history with fixed dimensions is required; no partial or substitute observations returned.'}};
  const definitions=measuresFor(desk,key);
  let candidates=cells(desk,key,native,definitions);
  if(definitions.length&&!claimant) {
    // A partial or drifted representation must not masquerade as a complete set.
    if(candidates.length!==definitions.length||new Set(candidates.map(c=>c.definition?.id)).size!==definitions.length||candidates.some(c=>!validCell(desk,key,native,c))) return {status:503,body:{...base,observations:[],error:'representation_validation_failed',message:'Native data retained; described observations withheld because required dimensions, units or coverage changed.'}};
  }
  if(measure) candidates=candidates.filter(c=>c.definition.id===measure);
  base.unavailable_measures=candidates.filter(c=>!c.period).map(c=>({measure:canonical(desk,key,c.definition.id),definition:c.definition,state:'unavailable',error:c.row.error||'No reference period returned; no observation identity fabricated'}));
  candidates=candidates.filter(c=>c.period);
  if(measure&&!candidates.length) return {status:503,body:{...base,data:null,error:'selected_measure_unavailable'}};
  if(observation) {
    candidates=candidates.filter(c=>c.period===observation);
    if(!candidates.length) return {status:404,body:{...base,data:null,error:'observation_not_retained',message:'Requested period is not in this successful latest selection. No newer or older value was substituted.'}};
  }
  base.observations=await Promise.all(candidates.map(async c=>{
    const value_state=c.value_state||(c.value===null?'missing':'observed');
    const record={id:canonical(desk,key,c.definition.id,c.period),measure:canonical(desk,key,c.definition.id),definition:c.definition,period:c.period,period_label:c.row.period_label||c.period,value:c.value,value_state,
      source_url:c.row.source_url||native?.source_url||c.definition.source_url||null,licence:c.row.licence||native?.licence||c.definition.licence||null,
      published_at:native?.published||null,publisher_updated_at:native?.updated||native?.uploaded||null,next_expected_update:null,
      publisher_status:claimant?{obs_status:c.row.obs_status,obs_conf:c.row.obs_conf}:c.row.observation_status||c.row.attributes||null,native_pointer:'/'+entry[1].replaceAll('.','/')+c.pointer,
      // Acquisition hashes and publisher response-generation clocks belong to
      // source context. They must not revise every claimant observation when
      // one month's value changes or identical data is acquired again.
      qualifications:claimant?{...c.row,limitations:native.limitations,rounding:c.definition.rounding}:{...sourceContext(native),...c.row}};
    // Arrays elsewhere in the source are not needed to qualify a selected cell.
    delete record.qualifications.rows; delete record.qualifications.states; delete record.qualifications.catalogue;
    // Rolling history changes row offsets without changing the observation.
    const {native_pointer,...claimantVersionRecord}=record;
    return {...record,version:await digest(claimant?claimantVersionRecord:record)};
  }));
  if(claimant) base.data=observation?candidates[0].row:candidates.map(c=>c.row);
  else if(measure) base.data=candidates[0]?.row??null;
  let versionContext=base.context,versionObservations=base.observations;
  if(claimant) {
    const {provenance,metadata,...context}=base.context;
    const {publisher_prepared_raw,...statisticalMetadata}=metadata;
    versionContext={...context,metadata:statisticalMetadata};
    versionObservations=base.observations.map(({native_pointer,...record})=>record);
  }
  base.content_version=await digest({data:base.data,context:versionContext,observations:versionObservations,retrieval});
  if(!definitions.length) base.limitation='Native fields only. No standardized observations or inferred metadata; inspect source qualifications before answering.';
  return {status:200,body:base};
}

export async function finishResponse(request,response,canonicalUrl,retrievedAt=null) {
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('Link',`<${canonicalUrl}>; rel="canonical", <${ORIGIN}/catalog.json>; rel="index", <${ORIGIN}/schema.json>; rel="describedby"`);
  headers.set('Content-Location',canonicalUrl);
  if(retrievedAt) headers.set('X-Retrieved-At',retrievedAt);
  const text=await response.text();
  let content=text;
  if(headers.get('content-type')?.includes('json')) { try{content=JSON.parse(text);}catch{} }
  const etag=`W/"${await digest(content)}"`;
  headers.set('ETag',etag);
  if(!headers.has('Cache-Control')) headers.set('Cache-Control',response.status===200?'public, max-age=300':'no-store');
  const match=request.headers.get('If-None-Match');
  const same=match?.split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag.replace(/^W\//,''));
  // Never turn a failure into a misleading 304.
  if(response.status===200&&same) return new Response(null,{status:304,headers});
  if(request.method==='HEAD') return new Response(null,{status:response.status,headers});
  return new Response(text,{status:response.status,headers});
}
