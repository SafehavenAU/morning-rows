import {isGapSource,gapDefinitions,validateGapRepresentation,gapCells,gapSelectionFailure,gapSelectedData,gapSemanticRow,gapSemanticContext} from './gap-information.js';
import {installGapSchema} from './gap-schema.js';
import { INVENTORY } from './inventory.js';
import { STATS_NZ_SERIES } from './stats-nz-series.js';
import { CLAIMANT_GEOGRAPHIES, claimantDefinition, validateClaimantRepresentation } from './claimant-count.js';
import { NZ_RENT_LOCATIONS, NZ_RENT_DEFINITION, nzRentDefinitions, validateNzRentRepresentation } from './nz-market-rent.js';
import { STATCAN_GDP_URLS, statcanGdpDefinitions, validateStatcanGdpRepresentation } from './statcan-gdp.js';

export const ORIGIN = 'https://morningrows.com';
export const SCHEMA_VERSION = '1.0';
export const DESKS = Object.fromEntries(['Australia','New Zealand','Canada','United Kingdom','England','Scotland','Wales','Northern Ireland'].map(name => [name.toLowerCase().replaceAll(' ','-'),name]));
const at = (body, path) => path.split('.').reduce((v,k) => v?.[k],body);
const canonical = (desk, source, measure, observation) => {
  const u = new URL(`/${desk}.json`,ORIGIN);
  for(const [k,v] of Object.entries({source,measure,observation})) if(v!==undefined) u.searchParams.set(k,v);
  return u.href;
};
const commonTitles = {exchange_history:'Dated daily currency reference rates',land_transaction_tax:'Land Transaction Tax due by effective financial year',people:'Population estimates',job:'Unemployment rate',jobs:'Unemployment by state or province',price_index:'Consumer price index',price:'Consumer price index',wage:'Earnings or wage index',product:'Gross domestic product',shop:'Retail sales',trade:'Trade balance',grid:'Electricity market snapshot',exchange:'Exchange rates',world:'World Bank indicators',space:'Space weather',food_establishments:'Food hygiene service establishment counts',hospital:'Emergency department patients seen on time',stats:'23 selected Stats NZ series',childhood_bmi:'National childhood BMI aggregates',projection:'2024-based all-persons/all-ages population projection',prices:'Five NZ electricity nodes, last interval of latest completed trading day'};
const triage = [['MYH-RM0035','Resuscitation'],['MYH-RM0036','Emergency'],['MYH-RM0037','Urgent'],['MYH-RM0038','Semi-urgent'],['MYH-RM0039','Non-urgent']];
const states = {NSW:'New South Wales',Vic:'Victoria',Qld:'Queensland',WA:'Western Australia',SA:'South Australia',Tas:'Tasmania',ACT:'Australian Capital Territory',NT:'Northern Territory'};
const currencies = {FXUSDCAD:'US dollar',FXAUDCAD:'Australian dollar',FXGBPCAD:'UK pound',FXNZDCAD:'New Zealand dollar'};
const insolvencies = ['Total company insolvencies','Compulsory liquidations','Creditors voluntary liquidations','Administrations','Company voluntary arrangements','Administrative receiverships'];
const pharmacies = ['total','excluding_distance_sellers','distance_sellers','excluding_distance_sellers_opened','excluding_distance_sellers_closed','excluding_distance_sellers_net_change','distance_sellers_opened','distance_sellers_closed','distance_sellers_net_change'];
const slug = s => s.toLowerCase().replaceAll(' ','-');
const ogl = 'Open Government Licence v3.0';
const claimantLimits = 'Thirteen retained monthly administrative claimant counts, all sexes, age 16+, rounded to five persons and not seasonally adjusted. These are not unemployment estimates, rates or available recruits. National geographies only; no local counts, arbitrary history or substitute months.';
const rentLimits = 'Only the city-qualified NZAD localities Auckland–Avondale and Wellington–Kelburn, five published dwelling categories and bedroom categories 1, 2, 3, 4 and 5+. Weekly NZD rent quartiles describe bonds lodged during one inclusive six-month window. Active bonds are a separate count, not the quartile denominator. These provisional aggregates do not describe current listings, availability or an individual property. Absent tuples are not reported; no zero or suppression is inferred. Locality identifiers are site-owned, not official NZAD codes.';
const gdpLimits = 'Canada expenditure-based GDP at market prices, millions of chained (2017) dollars, seasonally adjusted at annual rates. Two adjacent quarterly levels and one derived, nonannualized quarter-on-quarter percent change only. The annual-rate level is not annualized growth. The legacy period field is a quarter-start-month alias, not monthly GDP. No nominal, per-capita, household-income or arbitrary-history selection is implied; figures can be revised.';

// These definitions describe existing selections only. Null metadata is deliberately
// unknown: it does not license a comparison or assert seasonal adjustment/finality.
export function measuresFor(desk,key) {
  const definition = (id,name,extra={}) => ({id,name,geography:DESKS[desk],population:null,unit:null,adjustment:null,kind:'observation',period_convention:null,cadence:null,revision_policy:'Not established; compare content versions, do not assume finality.',...extra});
  const gap=gapDefinitions(desk,key); if(gap) return gap;
  if(key==='claimant_count'&&Object.hasOwn(CLAIMANT_GEOGRAPHIES,desk)) return [claimantDefinition(desk)];
  if(desk==='new-zealand'&&key==='market_rent') return nzRentDefinitions();
  if(desk==='canada'&&key==='product') return statcanGdpDefinitions();
  if(desk==='new-zealand'&&key==='stats') return STATS_NZ_SERIES.map(s=>definition(s.id,s.name,{geography:s.geography,population:s.population_group||null,unit:s.unit,kind:s.kind,dimensions:s.dimensions,period_convention:s.period_convention||`Publisher ${s.period_column||'fixed reference period'}; retain period_label, which can differ from the code.`,...Object.fromEntries(['limitations','publication_status','index_reference'].filter(key=>s[key]).map(key=>[key,s[key]])),selection:s.kind==='projection'?(s.projection_period||'current_calendar_year'):'latest_available_in_selected_series',publisher:'Stats NZ',licence:'CC BY 4.0',source_url:`https://api.data.stats.govt.nz/rest/data/STATSNZ,${s.id},1.0/${s.key}?dimensionAtObservation=AllDimensions&format=csv`}));
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
  return {id:canonical(desk,key),key,name:key==='claimant_count'?'Administrative claimant count, not seasonally adjusted':key==='market_rent'?'Six-month local rent quartiles and separate active-bond counts':commonTitles[key.replace(/^also\./,'')]||key.replace(/^also\./,'').replaceAll('_',' '),records:canonical(desk,key),data_pointer:'/'+path.replaceAll('.','/'),health_pointer:'/'+health.replaceAll('.','/'),representation:definitions.length?'described_measures':'native_fields',measure_count:definitions.length,
    ...(isGapSource(desk,key)?{limits:definitions[0]?.limitations||definitions[0]?.revision_policy,selection:key==='exchange_history'?'Two currencies over a 31-calendar-day request window; exact YYYY-MM-DD selection. Missing dates are not inferred holidays or carried forward.':'Only the fixed described measures and exact retained periods; no adjacent geography or period is substituted.'}:{}),
    ...(key==='claimant_count'?{limits:claimantLimits}:{}),
    ...(key==='market_rent'?{limits:rentLimits,locality_identifier_authority:'Morning Rows; not a publisher geography code',selection:'Only reported tuples produce observations. Known absent tuples return not_reported; unsupported IDs return unknown_measure. An observation selects the exact inclusive six-month start/end period.'}:{}),
    ...(desk==='canada'&&key==='product'?{limits:gdpLimits,selection:'Source selection preserves the native period, level and quarter_change fields. Level selects two quarters; quarter_change selects only the latest derived comparison. An observation selects an exact retained YYYY-Qn quarter.'}:{}),
    ...(definitions.length?{measures:definitions.map(d=>({id:d.id,name:d.name,geography:d.geography,unit:d.unit,kind:d.kind,records:canonical(desk,key,d.id),...(key==='claimant_count'?{definition:d,retained_calendar_slots:13,observation_selector:'YYYY-MM',selection:'Source and measure selections return all thirteen months; an observation selects one exact retained month.'}:key==='market_rent'?{dimensions:d.dimensions,observation_selector:'YYYY-MM-DD/YYYY-MM-DD'}:desk==='canada'&&key==='product'?{definition:d,retained_calendar_slots:d.id==='level'?2:1,observation_selector:'YYYY-Qn'}:{})}))}:{qualification:'Read native field metadata. Unestablished geography, population, units, adjustment, licence or timing must remain unknown; the desk name is not a geography assertion.'})};
}

export function catalogue(desk) {
  const base={name:'Morning Rows',site:ORIGIN,schema_version:SCHEMA_VERSION,schema:`${ORIGIN}/schema.json`,auth:'none',index:'/llms.txt'};
  if(desk) return {...base,id:`${ORIGIN}/catalog.json?desk=${desk}`,desk:DESKS[desk],records:canonical(desk),sources:INVENTORY[desk].map(s=>sourceCard(desk,s)),limits:'Only existing selections. No arbitrary history, local claimant counts, unlisted rent locations or cross-country comparability is implied. Native sections may have incomplete metadata.'+(Object.hasOwn(CLAIMANT_GEOGRAPHIES,desk)?` ${claimantLimits}`:'')+(desk==='new-zealand'?` ${rentLimits}`:'')+(desk==='canada'?` ${gdpLimits}`:'')};
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
    revisits:'Weak ETag excludes fetched_at/retrieved_at only, retaining value, period, caveats, publisher version and errors. Compare observation id and version: same id/version unchanged; same id/different version revision or metadata correction; different period newly available observation. Claimant, market-rent, Canada GDP, dated FX, StatCan headline and WRA observation versions exclude changing row offsets and source acquisition provenance; their content_version excludes acquisition hashes, retained separately in context. Claimant content_version also excludes publisher response-generation clocks. Each rent statistic version covers its own value and definition; a revised median does not revise its unchanged quartiles or bond count. A GDP level version covers its own quarter; derived growth versions retain both input quarters, including release and status qualifications. A provenance-only ETag change is not a statistical revision. Official release classification requires publisher evidence. No daily-change staleness rule.',
    comparison:'Require matching measure definitions, geography, population, units, adjustment and period convention. Unknown adjustment or coverage is a verification gap. Overlapping components and projections must not be added to totals or treated as estimates.',
    scope:'Described measures: Stats NZ 23 selections, AIHW 40 cells, Wales projection, NISRA 4 BMI aggregates, BoC 4 latest currencies plus a separate 31-calendar-day USD/CAD and GBP/CAD history, Canada eleven geography-qualified unemployment rates and one each of CPI index, retail sales and quarterly urban housing starts, four overlapping Wales WRA tax-due measures, Canada GDP two quarterly levels and one derived nonannualized quarterly growth comparison, Scotland/NI 6 insolvency measures each, England 9 pharmacy measures, thirteen monthly claimant counts in each of five UK/nation desks, and 200 supported market-rent definitions for two city-qualified NZAD suburbs. Only actually reported rent tuples produce observations; known absent tuples return not_reported. Claimants are administrative counts, not seasonally adjusted, not unemployment estimates or rates. All other existing sections remain discoverable with native fields and explicit metadata limitations.',
    market_rent:rentLimits+' Measure IDs are {site-locality-id}.{dwelling-key}.{bedroom-key}.{statistic}; 5-plus denotes five or more bedrooms. One exact inclusive six-month window is retained. A failed locality yields no substitute observation; healthy locality observations remain available with degraded source health. Both healthy localities must report the same window. Cross-field date arithmetic, numeric equality and coverage are checked by the reader and evidence verifier in addition to this structural schema.',
    canada_gdp:gdpLimits+' Measure IDs are level and quarter_change; observations use YYYY-Qn. The level measure retains two adjacent quarters anchored to the current publisher cube, and quarter_change retains their latest comparison. Unzoned publisher release timestamps remain raw with release_timezone null. Cross-field adjacency, quarter boundaries, current-release anchoring, legacy aliases and growth arithmetic are validated by the reader in addition to this structural schema.',
    daily_windows:'Dated FX uses a 31-calendar-day request window ending on the UTC retrieval date; its cache expires at UTC midnight. Absent FX dates are not inferred holidays or carried forward. Source failures and unretained periods remain distinct refusals.',
    statcan_headlines:'Jobs are mapped by verified geography code, never publisher array position. Housing is a quarterly count in centres of 10,000 or more; its legacy month is the quarter-start alias. Unzoned StatCan publication timestamps remain raw, with timezone unknown. A missing preliminary/revised symbol does not establish finality. Exact CMHC attribution and redistribution terms accompany housing observations.',
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

// Fixed supported rent selections are definitions, not invented observations.
// Only the publisher's reported rows appear in successful source responses.
const rentDefinitions=nzRentDefinitions();
const rentDefinitionKeys=Object.keys(rentDefinitions[0]);
const rentCommonKeys=rentDefinitionKeys.filter(k=>rentDefinitions.every(d=>JSON.stringify(d[k])===JSON.stringify(rentDefinitions[0][k])));
const rentVaryingKeys=rentDefinitionKeys.filter(k=>!rentCommonKeys.includes(k));
const rentConstProperties=(definition,keys)=>Object.fromEntries(keys.map(k=>[k,{const:definition[k]}]));
const rentPeriod={type:'string',pattern:'^\\d{4}-(0[1-9]|1[0-2])-\\d{2}/\\d{4}-(0[1-9]|1[0-2])-\\d{2}$'};
const rentNumber={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER};
const rentDwellingLabels={'apartment':'Apartment','boarding-house':'Boarding House','flat':'Flat','house':'House','room':'Room'};
const rentBedroomLabels={'1':'1 bedroom','2':'2 bedrooms','3':'3 bedrooms','4':'4 bedrooms','5-plus':'5+ bedrooms'};
const rentStatistics=['active_bonds','lower_quartile','median','upper_quartile'];
const rentLocationConditions=Object.values(NZ_RENT_LOCATIONS).map(location=>({
  if:{properties:{location_id:{const:location.id}}},
  then:{properties:{geography:{const:location.geography},city:{const:location.city},suburb:{const:location.suburb},source_url:{const:location.source_url}}},
}));
const rentTupleProperties={
  location_id:{enum:Object.keys(NZ_RENT_LOCATIONS)},geography:{type:'string'},city:{type:'string'},suburb:{type:'string'},
  dwelling_key:{enum:Object.keys(rentDwellingLabels)},dwelling_type:{enum:Object.values(rentDwellingLabels)},
  bedroom_key:{enum:Object.keys(rentBedroomLabels)},bedrooms:{enum:Object.values(rentBedroomLabels)},
  period:rentPeriod,period_start:{type:'string',format:'date'},period_end:{type:'string',format:'date'},source_url:{type:'string',format:'uri'},
};
const rentTupleConditions=[...rentLocationConditions,
  ...Object.entries(rentDwellingLabels).map(([key,label])=>({if:{properties:{dwelling_key:{const:key}}},then:{properties:{dwelling_type:{const:label}}}})),
  ...Object.entries(rentBedroomLabels).map(([key,label])=>({if:{properties:{bedroom_key:{const:key}}},then:{properties:{bedrooms:{const:label}}}})),
];
INFORMATION_SCHEMA.$defs.marketRentDefinition={
  type:'object',required:rentDefinitionKeys,additionalProperties:false,
  properties:{...Object.fromEntries(rentVaryingKeys.map(k=>[k,{}])),...rentConstProperties(rentDefinitions[0],rentCommonKeys)},
  oneOf:rentDefinitions.map(d=>({properties:rentConstProperties(d,rentVaryingKeys)})),
};
INFORMATION_SCHEMA.$defs.marketRentWideRow={
  type:'object',required:[...Object.keys(rentTupleProperties),...rentStatistics],additionalProperties:false,
  properties:{...rentTupleProperties,...Object.fromEntries(rentStatistics.map(k=>[k,rentNumber]))},
  allOf:rentTupleConditions,
};
INFORMATION_SCHEMA.$defs.marketRentCell={
  type:'object',required:[...Object.keys(rentTupleProperties),'statistic','value','unit','value_state'],additionalProperties:false,
  properties:{...rentTupleProperties,statistic:{enum:rentStatistics},value:rentNumber,unit:{enum:['bonds','NZD per week']},value_state:{const:'observed'},revision_status:{const:'provisional'}},
  allOf:[...rentTupleConditions,{if:{properties:{statistic:{const:'active_bonds'}}},then:{properties:{unit:{const:'bonds'}}},else:{properties:{unit:{const:'NZD per week'}}}}],
};
INFORMATION_SCHEMA.$defs.marketRentNative={
  type:'object',required:['status','rows','locations','publisher','licence','licence_url','definition','limitations','metadata','provenance','published_at','publisher_updated_at','next_expected_update'],
  properties:{
    status:{enum:['ok','degraded','error']},rows:{type:'array',maxItems:50,items:{$ref:'#/$defs/marketRentWideRow'}},
    publisher:{const:rentDefinitions[0].publisher},licence:{const:rentDefinitions[0].licence},licence_url:{const:rentDefinitions[0].licence_url},
    definition:{const:NZ_RENT_DEFINITION},limitations:{const:NZ_RENT_DEFINITION.limitations},
    published_at:{type:'null'},publisher_updated_at:{type:'null'},next_expected_update:{type:'null'},
    locations:{
      type:'array',minItems:2,maxItems:2,
      allOf:Object.keys(NZ_RENT_LOCATIONS).map(id=>({contains:{properties:{id:{const:id}}},minContains:1,maxContains:1})),
      items:{
        type:'object',required:['id','status','period_start','period_end','row_count'],
        properties:{id:{enum:Object.keys(NZ_RENT_LOCATIONS)},status:{enum:['ok','error']},row_count:{type:'integer',minimum:0,maximum:25},period_start:{type:['string','null'],format:'date'},period_end:{type:['string','null'],format:'date'}},
        if:{properties:{status:{const:'ok'}}},
        then:{required:['table_counts'],properties:{row_count:{minimum:1},period_start:{type:'string',format:'date'},period_end:{type:'string',format:'date'},table_counts:{type:'object',required:Object.keys(rentDwellingLabels),additionalProperties:false,properties:Object.fromEntries(Object.keys(rentDwellingLabels).map(key=>[key,{type:'integer',minimum:0,maximum:5}]))}},not:{required:['error']}},
        else:{required:['error'],properties:{error:{type:'string',minLength:1},row_count:{const:0},period_start:{type:'null'},period_end:{type:'null'}}},
      },
    },
    metadata:{
      type:'object',required:['count','location_count','successful_location_count','period_start','period_end','window_consistent','publication_time','revision_id'],additionalProperties:false,
      properties:{count:{type:'integer',minimum:0,maximum:50},location_count:{const:2},successful_location_count:{type:'integer',minimum:0,maximum:2},period_start:{type:['string','null'],format:'date'},period_end:{type:['string','null'],format:'date'},window_consistent:{type:'boolean'},publication_time:{type:'null'},revision_id:{type:'null'}},
    },
    provenance:{type:'array',maxItems:2,items:{type:'object',required:['location_id','url','retrieved_at','sha256','bytes'],properties:{location_id:{enum:Object.keys(NZ_RENT_LOCATIONS)},url:{type:'string',format:'uri'},retrieved_at:{type:'string',format:'date-time'},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},bytes:{type:'integer',minimum:1,maximum:131072}},allOf:Object.values(NZ_RENT_LOCATIONS).map(location=>({if:{properties:{location_id:{const:location.id}}},then:{properties:{url:{const:location.source_url}}}}))}},
  },
  allOf:[
    {if:{properties:{status:{const:'ok'}}},then:{properties:{rows:{minItems:2},locations:{items:{properties:{status:{const:'ok'}}}},metadata:{properties:{successful_location_count:{const:2},count:{minimum:2},window_consistent:{const:true},period_start:{type:'string'},period_end:{type:'string'}}}}}},
    {if:{properties:{status:{const:'degraded'}}},then:{properties:{rows:{minItems:1},metadata:{properties:{count:{minimum:1},successful_location_count:{minimum:1}}}}}},
    {if:{properties:{status:{const:'error'}}},then:{properties:{rows:{maxItems:0},locations:{items:{properties:{status:{const:'error'}}}},metadata:{properties:{count:{const:0},successful_location_count:{const:0},window_consistent:{const:false},period_start:{type:'null'},period_end:{type:'null'}}}}}},
  ],
};
INFORMATION_SCHEMA.$defs.marketRentObservation={
  allOf:[{$ref:'#/$defs/observation'},{
    required:['qualifications','source_url','licence','publisher_status'],
    properties:{value:rentNumber,value_state:{const:'observed'},period:rentPeriod,definition:{$ref:'#/$defs/marketRentDefinition'},qualifications:{$ref:'#/$defs/marketRentCell'},source_url:{type:'string',format:'uri'},licence:{type:'string'},publisher_status:{type:'object',required:['revision_status'],properties:{revision_status:{const:'provisional'}}}},
    oneOf:rentDefinitions.map(d=>({properties:{measure:{const:canonical('new-zealand','market_rent',d.id)},definition:{properties:{id:{const:d.id}}}}})),
    allOf:[
      ...Object.keys(NZ_RENT_LOCATIONS).map(id=>({if:{properties:{qualifications:{properties:{location_id:{const:id}}}}},then:{properties:{definition:{properties:{dimensions:{properties:{location:{const:id}}}}},source_url:{const:NZ_RENT_LOCATIONS[id].source_url}}}})),
      ...[['dwelling_key','dwelling',Object.keys(rentDwellingLabels)],['bedroom_key','bedrooms',Object.keys(rentBedroomLabels)],['statistic','statistic',rentStatistics]].flatMap(([rowKey,dimension,values])=>values.map(value=>({if:{properties:{qualifications:{properties:{[rowKey]:{const:value}}}}},then:{properties:{definition:{properties:{dimensions:{properties:{[dimension]:{const:value}}}}}}}}))),
    ],
  }],
};
INFORMATION_SCHEMA.$defs.selected.if={required:['source'],properties:{source:{const:canonical('new-zealand','market_rent')}},not:{required:['error']}};
INFORMATION_SCHEMA.$defs.selected.then={
  required:['context'],properties:{
    retrieval:{properties:{status:{enum:['ok','degraded']}}},
    context:{
      type:'object',required:INFORMATION_SCHEMA.$defs.marketRentNative.required.filter(key=>key!=='rows'),
      properties:{...Object.fromEntries(Object.entries(INFORMATION_SCHEMA.$defs.marketRentNative.properties).filter(([key])=>key!=='rows')),status:{enum:['ok','degraded']}},
      allOf:INFORMATION_SCHEMA.$defs.marketRentNative.allOf.slice(0,2),
    },
    observations:{items:{$ref:'#/$defs/marketRentObservation'}},
  },
  if:{properties:{id:{pattern:'&measure='}}},
  then:{properties:{data:{$ref:'#/$defs/marketRentCell'},observations:{minItems:1,maxItems:1}}},
  else:{properties:{data:{type:'array',minItems:1,maxItems:50,items:{$ref:'#/$defs/marketRentWideRow'}},observations:{minItems:4,maxItems:200}}},
};
INFORMATION_SCHEMA.$defs.desk.properties.market_rent={oneOf:[{type:'null'},{$ref:'#/$defs/marketRentNative'}]};
INFORMATION_SCHEMA.$defs.desk.if={required:['market_rent']};
INFORMATION_SCHEMA.$defs.desk.then={properties:{country:{const:'New Zealand'}}};

// Canada GDP's legacy aliases remain available, but its new quarterly contract
// must not be inferred for another country's native product section.
const gdpDefinitions=statcanGdpDefinitions();
const [gdpLevelDefinition,gdpGrowthDefinition]=gdpDefinitions;
const gdpQuarter={type:'string',pattern:'^(?:19|20|21)\\d{2}-Q[1-4]$'};
const gdpDate={type:'string',format:'date',pattern:'^(?:19|20|21)\\d{2}-\\d{2}-\\d{2}$'};
const gdpStart={...gdpDate,pattern:'^(?:19|20|21)\\d{2}-(01|04|07|10)-01$'};
const gdpLevel={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
const gdpRawTime={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}T(?:[01]\\d|2[0-3]):[0-5]\\d$'};
const gdpFlags={
  type:'object',required:['status_code','security_level_code','symbol_code','symbol'],
  properties:{status_code:{const:0},security_level_code:{const:0},symbol_code:{enum:[0,1,3]},symbol:{enum:['none','preliminary','revised']}},
  oneOf:Object.entries({0:'none',1:'preliminary',3:'revised'}).map(([code,label])=>({properties:{symbol_code:{const:Number(code)},symbol:{const:label}}})),
};
INFORMATION_SCHEMA.$defs.statcanGdpDefinition={type:'object',enum:gdpDefinitions};
INFORMATION_SCHEMA.$defs.statcanGdpLevelRow={
  type:'object',additionalProperties:false,
  required:['period','quarter','value','value_state','reference_date','period_start','period_end','ref_per_raw','ref_per2','ref_per_raw2','unit','geography','adjustment','price_basis','dimensions','scalar_code','unit_code','frequency_code','decimals','status_code','security_level_code','symbol_code','symbol','release_timestamp_raw','release_timezone'],
  properties:{
    period:gdpQuarter,quarter:gdpQuarter,value:gdpLevel,value_state:{const:'observed'},
    reference_date:gdpStart,period_start:gdpStart,period_end:{...gdpDate,pattern:'^(?:19|20|21)\\d{2}-(03-31|06-30|09-30|12-31)$'},
    ref_per_raw:{...gdpDate,pattern:'^(?:19|20|21)\\d{2}-(03|06|09|12)-01$'},ref_per2:{const:''},ref_per_raw2:{const:''},
    unit:{const:gdpLevelDefinition.unit},geography:{const:'Canada'},adjustment:{const:gdpLevelDefinition.adjustment},price_basis:{const:gdpLevelDefinition.price_basis},dimensions:{const:gdpLevelDefinition.dimensions},
    scalar_code:{const:6},unit_code:{const:81},frequency_code:{const:9},decimals:{const:0},
    ...gdpFlags.properties,release_timestamp_raw:gdpRawTime,release_timezone:{const:null},
  },allOf:[gdpFlags],
};
INFORMATION_SCHEMA.$defs.statcanGdpGrowth={
  type:'object',additionalProperties:false,
  required:['period','value','value_state','kind','unit','previous_period','previous_value','current_value','formula','rounding','annualized'],
  properties:{
    period:gdpQuarter,value:{type:'number',minimum:-100},value_state:{const:'observed'},kind:{const:'derived'},unit:{const:'percent'},
    previous_period:gdpQuarter,previous_value:gdpLevel,current_value:gdpLevel,
    formula:{const:gdpGrowthDefinition.formula},rounding:{const:gdpGrowthDefinition.rounding},annualized:{const:false},
  },
};
INFORMATION_SCHEMA.$defs.statcanGdpGrowthRow={
  ...INFORMATION_SCHEMA.$defs.statcanGdpGrowth,
  required:[...INFORMATION_SCHEMA.$defs.statcanGdpGrowth.required,'inputs'],
  properties:{...INFORMATION_SCHEMA.$defs.statcanGdpGrowth.properties,inputs:{type:'array',minItems:2,maxItems:2,items:{$ref:'#/$defs/statcanGdpLevelRow'}}},
};
INFORMATION_SCHEMA.$defs.statcanGdpMetadata={
  type:'object',additionalProperties:false,
  required:['count','first_quarter','latest_quarter','cube_end_date','release_timestamp_raw','release_timezone','series_title','product_id','coordinate','vector_id','frequency_code','scalar_code','unit_code','decimals','cube_archive_status','legacy_period_convention'],
  properties:{
    count:{const:2},first_quarter:gdpQuarter,latest_quarter:gdpQuarter,cube_end_date:gdpStart,release_timestamp_raw:gdpRawTime,release_timezone:{const:null},
    series_title:{const:'Canada;Chained (2017) dollars;Seasonally adjusted at annual rates;Gross domestic product at market prices'},
    product_id:{const:36100104},coordinate:{const:'1.1.1.30.0.0.0.0.0.0'},vector_id:{const:62305752},
    frequency_code:{const:9},scalar_code:{const:6},unit_code:{const:81},decimals:{const:0},cube_archive_status:{const:'2'},
    legacy_period_convention:{const:'quarter-start month, YYYY-MM; not monthly'},
  },
};
INFORMATION_SCHEMA.$defs.statcanGdpProvenance={
  type:'array',oneOf:[
    {maxItems:0},
    {minItems:3,maxItems:3,allOf:Object.keys(STATCAN_GDP_URLS).map(role=>({contains:{type:'object',required:['role'],properties:{role:{const:role}}},minContains:1,maxContains:1}))},
  ],
  items:{
    type:'object',required:['role','url','retrieved_at','bytes','sha256'],
    properties:{role:{enum:Object.keys(STATCAN_GDP_URLS)},url:{type:'string',format:'uri'},retrieved_at:{type:'string',format:'date-time',pattern:'Z$'},bytes:{type:'integer',minimum:1},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'}},
    oneOf:Object.entries(STATCAN_GDP_URLS).map(([role,url])=>({properties:{role:{const:role},url:{const:url},bytes:{maximum:role==='cube'?131072:16384}}})),
  },
};
INFORMATION_SCHEMA.$defs.statcanGdpNative={
  type:'object',additionalProperties:false,
  required:['period','level','quarter_change','quarter','geography','unit','adjustment','price_basis','definitions','rows','growth','metadata','publisher','licence','licence_url','source_url','limitations','published_at','publisher_updated_at','next_expected_update','provenance'],
  properties:{
    period:{type:'string',pattern:'^(?:19|20|21)\\d{2}-(01|04|07|10)$'},level:gdpLevel,quarter_change:{type:'number',minimum:-100},quarter:gdpQuarter,
    geography:{const:'Canada'},unit:{const:gdpLevelDefinition.unit},adjustment:{const:gdpLevelDefinition.adjustment},price_basis:{const:gdpLevelDefinition.price_basis},
    definitions:{const:gdpDefinitions},rows:{type:'array',minItems:2,maxItems:2,items:{$ref:'#/$defs/statcanGdpLevelRow'}},
    growth:{$ref:'#/$defs/statcanGdpGrowth'},metadata:{$ref:'#/$defs/statcanGdpMetadata'},
    publisher:{const:gdpLevelDefinition.publisher},licence:{const:gdpLevelDefinition.licence},licence_url:{const:gdpLevelDefinition.licence_url},source_url:{const:gdpLevelDefinition.source_url},
    limitations:{const:gdpLevelDefinition.limitations},published_at:{const:null},publisher_updated_at:{const:null},next_expected_update:{const:null},
    provenance:{$ref:'#/$defs/statcanGdpProvenance'},
  },
};
const gdpObservationFor=definition=>({
  allOf:[{$ref:'#/$defs/observation'},{
    type:'object',required:['source_url','licence','qualifications','publisher_status','published_at','publisher_updated_at','next_expected_update','native_pointer'],
    properties:{
      id:{type:'string',pattern:`^https://morningrows\\.com/canada\\.json\\?source=product&measure=${definition.id}&observation=(?:19|20|21)\\d{2}-Q[1-4]$`},
      measure:{const:canonical('canada','product',definition.id)},definition:{const:definition},period:gdpQuarter,
      value:definition.id==='level'?gdpLevel:{type:'number',minimum:-100},value_state:{const:'observed'},version:{type:'string',pattern:'^[a-f0-9]{64}$'},
      qualifications:{$ref:definition.id==='level'?'#/$defs/statcanGdpLevelRow':'#/$defs/statcanGdpGrowthRow'},
      source_url:{const:definition.source_url},licence:{const:definition.licence},published_at:{const:null},publisher_updated_at:{const:null},next_expected_update:{const:null},
      native_pointer:{type:'string',pattern:definition.id==='level'?'^/product/rows/[01]$':'^/product/growth$'},
      publisher_status:definition.id==='level'?gdpFlags:{
        type:'object',required:['derived','input_symbols'],properties:{derived:{const:true},input_symbols:{type:'array',minItems:2,maxItems:2,items:{
          type:'object',required:['period','symbol_code','symbol'],properties:{period:gdpQuarter,...Object.fromEntries(['symbol_code','symbol'].map(k=>[k,gdpFlags.properties[k]]))},oneOf:gdpFlags.oneOf,
        }}},
      },
    },
  }],
});
INFORMATION_SCHEMA.$defs.statcanGdpLevelObservation=gdpObservationFor(gdpLevelDefinition);
INFORMATION_SCHEMA.$defs.statcanGdpGrowthObservation=gdpObservationFor(gdpGrowthDefinition);
INFORMATION_SCHEMA.$defs.statcanGdpObservation={oneOf:[{$ref:'#/$defs/statcanGdpLevelObservation'},{$ref:'#/$defs/statcanGdpGrowthObservation'}]};
INFORMATION_SCHEMA.$defs.selected.allOf.push({
  // Either canonical identity activates this contract. Removing or changing the
  // source discriminator must not downgrade a GDP response to generic fields.
  if:{anyOf:[
    {required:['source'],properties:{source:{const:canonical('canada','product')}}},
    {required:['id'],properties:{id:{pattern:'^https://morningrows\\.com/canada\\.json\\?source=product(?:&|$)'}}},
  ],not:{required:['error']}},
  then:{
    required:['source','context','unavailable_measures','content_version'],
    properties:{
      source:{const:canonical('canada','product')},
      id:{type:'string',pattern:'^https://morningrows\\.com/canada\\.json\\?source=product(?:&measure=(?:level|quarter_change)(?:&observation=(?:19|20|21)\\d{2}-Q[1-4])?)?$'},
      retrieval:{properties:{status:{const:'ok'}}},unavailable_measures:{type:'array',maxItems:0},content_version:{type:'string',pattern:'^[a-f0-9]{64}$'},
      context:{type:'object',additionalProperties:false,required:INFORMATION_SCHEMA.$defs.statcanGdpNative.required.filter(k=>k!=='rows'),properties:Object.fromEntries(Object.entries(INFORMATION_SCHEMA.$defs.statcanGdpNative.properties).filter(([k])=>k!=='rows'))},
      observations:{items:{$ref:'#/$defs/statcanGdpObservation'}},
    },
    if:{properties:{id:{pattern:'[?&]measure=level(?:&|$)'}}},
    then:{
      properties:{observations:{items:{$ref:'#/$defs/statcanGdpLevelObservation'}}},
      if:{properties:{id:{pattern:'&observation='}}},
      then:{properties:{data:{$ref:'#/$defs/statcanGdpLevelRow'},observations:{minItems:1,maxItems:1}}},
      else:{properties:{data:{type:'array',minItems:2,maxItems:2,items:{$ref:'#/$defs/statcanGdpLevelRow'}},observations:{minItems:2,maxItems:2}}},
    },
    else:{
      if:{properties:{id:{pattern:'[?&]measure=quarter_change(?:&|$)'}}},
      then:{properties:{data:{$ref:'#/$defs/statcanGdpGrowthRow'},observations:{minItems:1,maxItems:1,items:{$ref:'#/$defs/statcanGdpGrowthObservation'}}}},
      else:{properties:{id:{const:canonical('canada','product')},data:{$ref:'#/$defs/statcanGdpNative'},observations:{minItems:3,maxItems:3,prefixItems:[{$ref:'#/$defs/statcanGdpLevelObservation'},{$ref:'#/$defs/statcanGdpLevelObservation'},{$ref:'#/$defs/statcanGdpGrowthObservation'}]}}},
    },
  },
});
INFORMATION_SCHEMA.$defs.desk.else={
  if:{properties:{country:{const:'Canada'}}},
  then:{properties:{product:{oneOf:[{type:'null'},{$ref:'#/$defs/statcanGdpNative'}]}}},
};

installGapSchema(INFORMATION_SCHEMA);

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
function rentCell(row,statistic,definition) {
  const {active_bonds,lower_quartile,median,upper_quartile,...dimensions}=row;
  return {...dimensions,statistic,value:row[statistic],unit:definition.unit,value_state:'observed'};
}

function cells(desk,key,data,definitions) {
  if(!data) return [];
  const make=(id,row,value,period,pointer,extra={})=>({definition:definitions.find(d=>d.id===id),row,value,period:String(period??''),pointer,...extra});
  if(desk==='canada'&&key==='product') return [
    ...data.rows.map((row,i)=>make('level',row,row.value,row.period,`/rows/${i}`,{value_state:'observed'})),
    make('quarter_change',{...data.growth,inputs:data.rows},data.growth.value,data.growth.period,'/growth',{value_state:'observed'}),
  ];
  if(key==='market_rent'&&desk==='new-zealand') {
    const byId=new Map(definitions.map(d=>[d.id,d]));
    return data.rows.flatMap((r,i)=>['active_bonds','lower_quartile','median','upper_quartile'].map(statistic=>{
      const id=`${r.location_id}.${r.dwelling_key}.${r.bedroom_key}.${statistic}`;
      const definition=byId.get(id);
      return make(id,rentCell(r,statistic,definition),r[statistic],r.period,`/rows/${i}/${statistic}`,{value_state:'observed'});
    }));
  }
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

export async function selectedResponse(body,selection,{now=new Date().toISOString()}={}) {
  const {desk,source:key,entry,measure,observation}=selection;
  const native=at(body,entry[1])??null, health=at(body,entry[2]);
  const retrieval={status:health?.status||'error',retrieved_at:health?.fetched_at||null,...(health?.error?{error:health.error}:{}),...(health?.http_status?{http_status:health.http_status}:{})};
  const id=canonical(desk,key,measure||undefined,observation||undefined), source=canonical(desk,key);
  const base={schema_version:SCHEMA_VERSION,id,source,desk:canonical(desk),schema:`${ORIGIN}/schema.json`,retrieval,context:sourceContext(native),data:native,observations:[]};
  if(!health||native===null&&retrieval.status==='ok') return {status:503,body:{...base,data:null,error:'source_contract_unavailable',message:'Expected source health or native data is missing; no successful observation inferred.'}};
  if(retrieval.status==='error') return {status:503,body:{...base,data:null,error:'retrieval_failed',message:'No successful selected-source response. Other desk sources remain available.'}};
  const claimant=key==='claimant_count';
  const rent=desk==='new-zealand'&&key==='market_rent';
  const gdp=desk==='canada'&&key==='product';
  const gap=isGapSource(desk,key);
  const gapClock={retrieved_at:key==='exchange_history'?now:retrieval.retrieved_at};
  if(gap) {
    const failure=gapSelectionFailure(desk,key,native,{measure,observation,...gapClock});
    const healthMatches=retrieval.status==='ok';
    if(failure||!healthMatches||!validateGapRepresentation(desk,key,native,gapClock)) {
      const detail=failure||{status:503,error:'representation_validation_failed',message:'Source health and its complete bounded representation must agree.'};
      return {status:detail.status,body:{...base,data:null,observations:[],...(detail.status===503?{retrieval:{...retrieval,status:'error'}}:{}),error:detail.error,message:detail.message}};
    }
  }
  // This source is a complete rolling history for one measure, not one cell per
  // measure. Validate it before accessing rows or making observation identities.
  if(claimant&&(retrieval.status!=='ok'||!validateClaimantRepresentation(native,desk))) return {status:503,body:{...base,data:null,retrieval:{...retrieval,status:'error',error:'Claimant-count representation validation failed'},error:'representation_validation_failed',message:'A complete thirteen-month national claimant-count history with fixed dimensions is required; no partial or substitute observations returned.'}};
  if(rent&&(!validateNzRentRepresentation(native)||!['ok','degraded'].includes(native.status)||native.status!==retrieval.status)) return {status:503,body:{...base,retrieval:{...retrieval,status:'error',error:'Market-rent representation validation failed'},error:'representation_validation_failed',message:'Exact localities, complete reported rows and matching six-month windows are required. Native data is retained for inspection; no selected observations were inferred.'}};
  if(gdp&&(retrieval.status!=='ok'||!validateStatcanGdpRepresentation(native,{retrieved_at:retrieval.retrieved_at}))) return {status:503,body:{...base,data:null,retrieval:{...retrieval,status:'error',error:'Canada GDP representation validation failed'},error:'representation_validation_failed',message:'Two adjacent current-cube quarters of the exact national chained-2017 annual-rate GDP series are required; no substitute period, unit or growth interpretation returned.'}};
  const definitions=measuresFor(desk,key);
  let candidates=gap?gapCells(desk,key,native,gapClock):cells(desk,key,native,definitions);
  if(definitions.length&&!claimant&&!rent&&!gdp&&!gap) {
    // A partial or drifted representation must not masquerade as a complete set.
    if(candidates.length!==definitions.length||new Set(candidates.map(c=>c.definition?.id)).size!==definitions.length||candidates.some(c=>!validCell(desk,key,native,c))) return {status:503,body:{...base,observations:[],error:'representation_validation_failed',message:'Native data retained; described observations withheld because required dimensions, units or coverage changed.'}};
  }
  if(rent&&measure&&!candidates.some(c=>c.definition.id===measure)) {
    const definition=definitions.find(d=>d.id===measure);
    const location=native.locations.find(l=>l.id===definition?.dimensions.location);
    if(location?.status==='error') return {status:503,body:{...base,data:null,retrieval:{...retrieval,status:'error',error:location.error||'Requested locality could not be retrieved'},error:'retrieval_failed',message:'The requested locality failed; no older window, other locality or zero was substituted.'}};
    return {status:404,body:{...base,data:null,error:'not_reported',message:'The publisher did not report this dwelling and bedroom tuple in the retained healthy locality. Absence does not establish zero, suppression or no properties.'}};
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
      publisher_status:gap?(c.row.observation_status||c.row.attributes||(c.row.status_code!==undefined?{status_code:c.row.status_code,quality:c.row.quality,security_level_code:c.row.security_level_code,symbol_code:c.row.symbol_code,symbol:c.row.symbol}:c.row.notes?{notes:c.row.notes}:null)):claimant?{obs_status:c.row.obs_status,obs_conf:c.row.obs_conf}:rent?{revision_status:'provisional'}:gdp?(c.definition.id==='level'?{status_code:c.row.status_code,security_level_code:c.row.security_level_code,symbol_code:c.row.symbol_code,symbol:c.row.symbol}:{derived:true,input_symbols:c.row.inputs.map(r=>({period:r.period,symbol_code:r.symbol_code,symbol:r.symbol}))}):c.row.observation_status||c.row.attributes||null,native_pointer:'/'+entry[1].replaceAll('.','/')+c.pointer,
      // Acquisition hashes and publisher response-generation clocks belong to
      // source context. They must not revise every claimant observation when
      // one month's value changes or identical data is acquired again.
      qualifications:gap?gapSemanticRow(desk,key,c.row):claimant?{...c.row,limitations:native.limitations,rounding:c.definition.rounding}:rent?{...c.row,revision_status:'provisional'}:gdp?{...c.row}:{...sourceContext(native),...c.row}};
    // Arrays elsewhere in the source are not needed to qualify a selected cell.
    delete record.qualifications.rows; delete record.qualifications.states; delete record.qualifications.catalogue;
    // Rolling history changes row offsets without changing the observation.
    const {native_pointer,...claimantVersionRecord}=record;
    return {...record,version:await digest(claimant||rent||gdp||gap?claimantVersionRecord:record)};
  }));
  if(gap) base.data=gapSelectedData(desk,key,native,{measure,observation,...gapClock});
  else if(claimant) base.data=observation?candidates[0].row:candidates.map(c=>c.row);
  else if(rent) base.data=measure?candidates[0].row:native.rows;
  else if(gdp&&measure) base.data=measure==='level'&&!observation?candidates.map(c=>c.row):candidates[0].row;
  else if(measure) base.data=candidates[0]?.row??null;
  let versionContext=base.context,versionObservations=base.observations,versionData=base.data;
  if(claimant) {
    const {provenance,metadata,...context}=base.context;
    const {publisher_prepared_raw,...statisticalMetadata}=metadata;
    versionContext={...context,metadata:statisticalMetadata};
    versionObservations=base.observations.map(({native_pointer,...record})=>record);
  }
  if(rent) {
    const {provenance,...context}=base.context;
    versionContext=context;
    versionObservations=base.observations.map(({native_pointer,...record})=>record);
  }
  if(gdp) {
    const {provenance,...context}=base.context;
    versionContext=context;
    versionObservations=base.observations.map(({native_pointer,...record})=>record);
    if(!measure){const {provenance,...data}=base.data;versionData=data;}
  }
  if(gap) {
    versionContext=gapSemanticContext(desk,key,base.context);
    versionData=gapSemanticContext(desk,key,base.data);
    versionObservations=base.observations.map(({native_pointer,...record})=>record);
  }
  base.content_version=await digest({data:versionData,context:versionContext,observations:versionObservations,retrieval});
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
