import {fetchOfficial, SourceError} from './sources.js';

export const ONS_RENT_DATA_URL = 'https://www.ons.gov.uk/visualisations/housingpriceslocal/data/json/E08000003.json';
export const ONS_RENT_PUBLICATION_URL = 'https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics';
export const ONS_RENT_PAGE_URL = 'https://www.ons.gov.uk/visualisations/housingpriceslocal/E08000003/';
export const ONS_RENT_LIMITS = Object.freeze({data_bytes:1048576,publication_bytes:262144});
const publisher='Office for National Statistics';
const licence='Open Government Licence v3.0';
const licence_url='https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
const methodology_url='https://www.ons.gov.uk/peoplepopulationandcommunity/housing/methodologies/priceindexofprivaterentsqmi';
const geography='Manchester',geography_code='E08000003',unit='GBP per month',adjustment='not seasonally adjusted';
const population='Achieved private new and existing rents under ONS Price Index of Private Rents methods, within Manchester metropolitan district; bedroom categories cover all property types.';
const aggregation='Three-month moving average of local estimates; imputed base-price levels uprated by the PIPR index.';
const limitations='Manchester only, latest published month and four bedroom categories across property types. Not a joint bedroom/property-type estimate, raw-month sample mean, asking-only rent, available property, household affordability or individual valuation. Official presentation resource may change format; no historical archive or fallback.';
const revision_policy='Local levels may change with methodology revisions and rebasing. The regular two-month imputation/revision policy applies to the UK aggregate, not this Manchester series. No finality claim.';
const spec=Object.freeze([
  Object.freeze({id:'bedroom_1',key:'one_bed',bedrooms:'1',label:'One bedroom'}),
  Object.freeze({id:'bedroom_2',key:'two_bed',bedrooms:'2',label:'Two bedrooms'}),
  Object.freeze({id:'bedroom_3',key:'three_bed',bedrooms:'3',label:'Three bedrooms'}),
  Object.freeze({id:'bedroom_4_plus',key:'four_or_more_bed',bedrooms:'4-plus',label:'Four or more bedrooms'}),
]);
export const ONS_RENT_DEFINITIONS=Object.freeze(spec.map(s=>Object.freeze({
  id:s.id,name:`Manchester average monthly rent: ${s.label.toLowerCase()}, across property types`,
  geography,geography_code,unit,adjustment,population,aggregation,kind:'observation',cadence:'monthly',
  dimensions:Object.freeze({geography:geography_code,bedrooms:s.bedrooms,property_type:'all'}),
  period_convention:'Latest published calendar month label; local level is a three-month moving average.',
  rounding:'Nearest GBP 1',publisher,licence,licence_url,source_url:ONS_RENT_DATA_URL,
  methodology_url,revision_policy,limitations,
})));
const fail=message=>{throw new SourceError('ONS Manchester rent: '+message);};
const check=(condition,message)=>{if(!condition)fail(message);};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const same=(a,b)=>plain(a)&&plain(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>plain(v)?same(a[k],v):a[k]===v);
const monthPattern=/^\d{4}-(?:0[1-9]|1[0-2])$/;
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?Z$/.test(v)&&isoDate(v.slice(0,10))&&Number.isFinite(Date.parse(v));
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthLabel=p=>`${months[Number(p.slice(5))-1]} ${p.slice(0,4)}`;
const amount=v=>Number.isSafeInteger(v)&&v>=0;
const workbookUrl=date=>{
  const [year,month,day]=date.split('-');
  return 'https://www.ons.gov.uk/file?uri=/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics/'+Number(day)+months[Number(month)-1].toLowerCase()+year+'/priceindexofprivaterentsukmonthlypricestatistics.xlsx';
};
function dateLabel(label) {
  const m=/^(\d{1,2}) ([A-Z][a-z]+) (\d{4})$/.exec(label.trim()),index=m&&months.indexOf(m[2]);
  check(m&&index>=0,'Invalid publication date label');
  const value=`${m[3]}-${String(index+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  check(isoDate(value),'Invalid publication date');
  return value;
}
function one(items,predicate,label) {
  const selected=items.filter(predicate);
  check(selected.length===1,`Missing or duplicate ${label}`);
  return selected[0];
}

export function parseOnsRentPublication(html) {
  check(typeof html==='string','Publication index is not text');
  const values=label=>[...html.matchAll(new RegExp(`<div class="meta__term">${label}:<\\/div>\\s*<div>\\s*([^<]+?)\\s*<\\/div>`,'g'))].map(m=>m[1].trim());
  const release=values('Release date'),next=values('Next release');
  check(release.length===1&&next.length===1,'Missing or ambiguous publication dates');
  const release_date=dateLabel(release[0]),next_release_date=dateLabel(next[0]);
  check(next_release_date>release_date,'Invalid next release date');
  const compact=release[0].toLowerCase().replaceAll(' ','');
  const filePath=`/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics/${compact}/priceindexofprivaterentsukmonthlypricestatistics.xlsx`;
  check(html.includes(`href="https://www.ons.gov.uk/file?uri=${filePath}"`)||html.includes(`href="/file?uri=${filePath}"`),'Current dated workbook link absent');
  const metadata=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>{try{return JSON.parse(m[1]);}catch{fail('Invalid publication structured metadata');}});
  const dataset=one(metadata,v=>v?.['@type']==='Dataset','dataset publication metadata');
  check(dataset.name==='Price Index of Private Rents, UK: monthly price statistics'&&dataset.url===ONS_RENT_PUBLICATION_URL&&dataset.datePublished===release_date+'T00:00:00Z','Publication identity or date disagrees');
  return {release_date,next_release_date,workbook_url:'https://www.ons.gov.uk/file?uri='+filePath};
}

function narrativeValues(section,period) {
  check(typeof section.content==='string'&&section.content.length<=12000,'Invalid bedroom narrative');
  const prefix=`<p>By how many bedrooms there are in a property, average rents as of ${monthLabel(period)} in Manchester were:</p>`;
  check(section.content.startsWith(prefix),'Wrong narrative geography, period or bedroom meaning');
  const list=/^\s*<ul>([\s\S]*?)<\/ul>/.exec(section.content.slice(prefix.length));
  check(list,'Bedroom list absent');
  const entries=[...list[1].matchAll(/<li>([^<]+)<\/li>/g)];
  check(entries.length===4&&list[1].replace(/<li>[^<]+<\/li>/g,'').trim()==='','Incomplete or malformed bedroom list');
  const result=new Map();
  for(const entry of entries) {
    const m=/^([^:]+): £((?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*))$/.exec(entry[1]);
    check(m&&!result.has(m[1])&&spec.some(s=>s.label===m[1]),'Wrong, duplicate or missing bedroom category/value');
    const value=Number(m[2].replaceAll(',',''));
    check(amount(value),'Invalid rent amount');
    result.set(m[1],value);
  }
  return result;
}

export function parseOnsRent(json,publication) {
  check(plain(json)&&plain(json.place)&&plain(json.region)&&plain(json.ctry)&&Array.isArray(json.sections)&&json.sections.length<=80,'Unexpected presentation structure');
  const place=json.place,region=json.region,country=json.ctry;
  check(place.areacd===geography_code&&place.areanm===geography&&place.geography==='Metropolitan District'&&place.parentcd==='E12000002'&&place.parentnm==='North West','Wrong local geography');
  check(region.areacd==='E12000002'&&region.areanm==='North West'&&region.geography==='Region'&&region.parentcd==='E92000001'&&region.parentnm==='England'&&country.areacd==='E92000001'&&country.areanm==='England'&&country.geography==='Country','Wrong geography hierarchy');
  check(plain(publication)&&isoDate(publication.release_date)&&isoDate(publication.next_release_date)&&publication.next_release_date>publication.release_date&&publication.workbook_url===workbookUrl(publication.release_date),'Invalid publication anchor');
  const meta=one(json.sections,s=>s.type==='Meta','presentation Meta');
  check(meta.title==='Housing prices in Manchester'&&meta.outputSeries==='housingpricesinyourarea'&&meta.contentType==='robo-journalism'&&meta.lastUpdated===publication.release_date,'Stale or mismatched presentation release');
  const header=one(json.sections,s=>s.type==='Header','presentation header');
  check(header.title==='Housing prices in Manchester'&&header.label==='You have selected Manchester but you can choose a different local authority in the UK below.','Wrong presentation area');
  const revision=one(json.sections,s=>s.id==='revisions','adjustment statement');
  check(typeof revision.content==='string'&&revision.content.includes('Figures in this article are not seasonally adjusted.'),'Missing or changed seasonal-adjustment statement');
  const keys=Object.keys(place);
  check(keys.length<=20000,'Unbounded place field inventory');
  const observed=keys.map(k=>/^rental_price_(?:(?:one_bed|two_bed|three_bed|four_or_more_bed)_)?(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(k)?.[1]).filter(Boolean).sort();
  const period=observed.at(-1);
  check(period&&period<publication.release_date.slice(0,7),'Missing or unpublished rent period');
  check(amount(place['rental_price_'+period]),'Latest all-property anchor is missing');
  const rent=one(json.sections,s=>s.id==='rent_price','monthly rent definition');
  const intro=typeof rent.content==='string'&&/^<p>The average monthly private rent in Manchester was £((?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)) in ([A-Z][a-z]+ \d{4})[.]/.exec(rent.content);
  check(intro&&intro[2]===monthLabel(period)&&Number(intro[1].replaceAll(',',''))===place['rental_price_'+period],'Monthly unit, population, period or all-property anchor disagrees');
  const list=narrativeValues(one(json.sections,s=>s.id==='rent_price_third','bedroom narrative'),period);
  const rows=spec.map((s,i)=>{
    const value=place[`rental_price_${s.key}_${period}`];
    check(amount(value)&&value===list.get(s.label),'Missing, substituted or inconsistent latest bedroom value');
    return {measure_id:s.id,period,value,value_state:'observed',geography,geography_code,bedrooms:s.bedrooms,
      bedroom_category:s.label,unit,adjustment,population,aggregation,release_date:publication.release_date,definition:ONS_RENT_DEFINITIONS[i]};
  });
  return {
    geography,geography_code,period,release_date:publication.release_date,rows,
    definitions:ONS_RENT_DEFINITIONS,metadata:{count:4,latest_period:period,release_date:publication.release_date,next_release_date:publication.next_release_date,workbook_url:publication.workbook_url},
    publisher,licence,licence_url,source_url:ONS_RENT_DATA_URL,presentation_url:ONS_RENT_PAGE_URL,methodology_url,
    adjustment,population,aggregation,revision_policy,limitations,published_at:null,publisher_updated_at:null,
  };
}

function validProvenance(provenance) {
  return Array.isArray(provenance)&&provenance.length===2&&provenance.every((p,i)=>{
    const url=i===0?ONS_RENT_DATA_URL:ONS_RENT_PUBLICATION_URL,max=i===0?ONS_RENT_LIMITS.data_bytes:ONS_RENT_LIMITS.publication_bytes;
    return plain(p)&&Object.keys(p).length===5&&p.kind===(i===0?'publisher_local_presentation':'publisher_publication_index')&&p.url===url&&/^[0-9a-f]{64}$/.test(p.sha256)&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=max&&instant(p.retrieved_at);
  });
}

export function validateOnsRent(value,acquisition) {
  if(arguments.length>1&&(!plain(acquisition)||!instant(acquisition.retrieved_at)))return false;
  if(!plain(value)||value.error||value.geography!==geography||value.geography_code!==geography_code||!monthPattern.test(value.period)||!isoDate(value.release_date)||value.period>=value.release_date.slice(0,7)||!Array.isArray(value.rows)||value.rows.length!==4||!Array.isArray(value.definitions)||value.definitions.length!==4)return false;
  for(const [key,want] of Object.entries({publisher,licence,licence_url,source_url:ONS_RENT_DATA_URL,presentation_url:ONS_RENT_PAGE_URL,methodology_url,adjustment,population,aggregation,revision_policy,limitations,published_at:null,publisher_updated_at:null}))if(value[key]!==want)return false;
  if(!plain(value.metadata)||value.metadata.count!==4||value.metadata.latest_period!==value.period||value.metadata.release_date!==value.release_date||!isoDate(value.metadata.next_release_date)||value.metadata.next_release_date<=value.release_date)return false;
  if(value.metadata.workbook_url!==workbookUrl(value.release_date)||!validProvenance(value.provenance))return false;
  const clocks=[...value.provenance.map(p=>p.retrieved_at),...(arguments.length>1?[acquisition.retrieved_at]:[])];
  if(clocks.some(t=>value.release_date>new Date(t).toISOString().slice(0,10)))return false;
  return spec.every((s,i)=>{
    const r=value.rows[i],d=ONS_RENT_DEFINITIONS[i];
    return same(value.definitions[i],d)&&plain(r)&&Object.keys(r).length===14&&r.measure_id===s.id&&r.period===value.period&&amount(r.value)&&r.value_state==='observed'&&r.geography===geography&&r.geography_code===geography_code&&r.bedrooms===s.bedrooms&&r.bedroom_category===s.label&&r.unit===unit&&r.adjustment===adjustment&&r.population===population&&r.aggregation===aggregation&&r.release_date===value.release_date&&same(r.definition,d);
  });
}

async function acquire(url,max,kind) {
  const retrieved_at=new Date().toISOString(),response=await fetchOfficial(url,{headers:{Accept:url===ONS_RENT_DATA_URL?'application/json':'text/html'}});
  if(response.url&&response.url!==url){await response.body?.cancel();fail('Unexpected redirected publisher URL');}
  const type=response.headers.get('content-type')??'';
  if(!(url===ONS_RENT_DATA_URL?/^application\/json(?:;|$)/i.test(type):/^text\/html(?:;|$)/i.test(type))){await response.body?.cancel();fail('Unexpected publisher content type');}
  const length=response.headers.get('content-length');
  if(length!==null&&/^\d+$/.test(length)&&Number(length)>max){await response.body?.cancel();fail('Source response exceeds byte budget');}
  check(response.body,'Empty publisher response');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;check(size<=max,'Source response exceeds byte budget');
      chunks.push(value);
    }
  }finally{await reader.cancel();}
  check(size>0,'Empty publisher response');
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('Invalid publisher UTF-8');}
  const digest=await crypto.subtle.digest('SHA-256',bytes),sha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  return {text,provenance:{kind,url,sha256,bytes:bytes.byteLength,retrieved_at}};
}

export async function readOnsRent() {
  const [data,index]=await Promise.all([
    acquire(ONS_RENT_DATA_URL,ONS_RENT_LIMITS.data_bytes,'publisher_local_presentation'),
    acquire(ONS_RENT_PUBLICATION_URL,ONS_RENT_LIMITS.publication_bytes,'publisher_publication_index'),
  ]);
  let json;
  try{json=JSON.parse(data.text);}catch{fail('Invalid publisher JSON');}
  const native=parseOnsRent(json,parseOnsRentPublication(index.text));
  native.provenance=[data.provenance,index.provenance];
  check(validateOnsRent(native),'Normalized source failed validation');
  return native;
}
