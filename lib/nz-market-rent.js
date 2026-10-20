import {fetchOfficial, SourceError, describeError} from './sources.js';

const page='https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/';
const publisher='Ministry of Business, Innovation and Employment / Tenancy Services';
const licence='Creative Commons Attribution 3.0 New Zealand';
const licence_url='https://creativecommons.org/licenses/by/3.0/nz/';
const population='Non-government properties with rental bonds lodged in the displayed six-month window; not advertised rents or every existing tenancy.';
const activeBondPopulation='Non-government properties with current bonds within the displayed six-month window; the full-page tooltip additionally requires complete rent, dwelling, bedroom and address information. This is not all lodged bonds or an established rent-quantile denominator.';
const limitations='Only two explicitly supported publisher NZAD suburbs, qualified by city; site locality IDs are not official geography codes and do not establish TA, SA2 or postal boundaries. Figures are provisional, incomplete or revisable during bond-system migration. Late lodgements and administrative changes can alter results; no rent-trend inference is established. Absent dwelling/bedroom tuples are not_reported, not zero or inferred suppression.';
const period_convention='Inclusive six-month window, from the first day of a month through the last day of the sixth consecutive month; not a monthly observation.';
const adjustment='unadjusted descriptive statistics';
const freezeEntries=entries=>Object.freeze(Object.fromEntries(entries.map(([key,value])=>[key,Object.freeze(value)])));
export const NZ_RENT_LOCATIONS=freezeEntries([
  ['nz-auckland-avondale',{id:'nz-auckland-avondale',city:'Auckland',suburb:'Avondale',geography:'Auckland - Avondale',source_url:'https://www.tenancy.govt.nz/market-rent-api/updateMarketValueLocation?ajax_city=Auckland&ajax_suburb=Avondale'}],
  ['nz-wellington-kelburn',{id:'nz-wellington-kelburn',city:'Wellington',suburb:'Kelburn',geography:'Wellington - Kelburn',source_url:'https://www.tenancy.govt.nz/market-rent-api/updateMarketValueLocation?ajax_city=Wellington&ajax_suburb=Kelburn'}],
]);
export const NZ_RENT_DWELLINGS=Object.freeze({apartment:'Apartment','boarding-house':'Boarding House',flat:'Flat',house:'House',room:'Room'});
export const NZ_RENT_BEDROOMS=Object.freeze({'1':'1 bedroom','2':'2 bedrooms','3':'3 bedrooms','4':'4 bedrooms','5-plus':'5+ bedrooms'});
export const NZ_RENT_STATISTICS=freezeEntries([
  ['lower_quartile',{name:'Lower quartile weekly rent',unit:'NZD per week',definition:'Publisher-rounded 25th percentile of weekly rents from bonds lodged in the displayed six-month window.'}],
  ['median',{name:'Median weekly rent',unit:'NZD per week',definition:'Publisher-rounded median of weekly rents from bonds lodged in the displayed six-month window.'}],
  ['upper_quartile',{name:'Upper quartile weekly rent',unit:'NZD per week',definition:'Publisher-rounded 75th percentile of weekly rents from bonds lodged in the displayed six-month window.'}],
  ['active_bonds',{name:'Active bonds',unit:'bonds',definition:'Current bonds within the displayed six-month window. The full-page tooltip also requires complete rent, dwelling, bedroom and address information. This is not all lodged bonds, all current tenancies, listings or an established denominator for the rent quantiles.'}],
]);
export const NZ_RENT_DEFINITION=Object.freeze({
  population,adjustment,period_convention,limitations,
  geography_authority:'Publisher NZAD suburb qualified by city; site-owned locality identifiers.',
  active_bonds:NZ_RENT_STATISTICS.active_bonds.definition,
  rent_unit:'NZD per week',count_unit:'bonds',
  methodology_url:page+'market-rent-explained/',
  provisional_caveat_url:'https://www.tenancy.govt.nz/about-tenancy-services/data-and-statistics/rental-bond-data/',
  revision_policy:'Updated monthly, omitting the most recent month; late lodgements and administrative changes can revise results. No official publication timestamp or revision identifier is supplied.',
});
const fail=message=>{throw new SourceError('NZ market rent: '+message);};
const requireValue=(condition,message)=>{if(!condition)fail(message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>plain(a)&&plain(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>plain(v)?same(a[k],v):a[k]===v);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const has=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
const locationFor=id=>{requireValue(has(NZ_RENT_LOCATIONS,id),'Unsupported locality');return NZ_RENT_LOCATIONS[id];};
const rowKeys='location_id geography city suburb dwelling_type dwelling_key bedrooms bedroom_key period period_start period_end active_bonds lower_quartile median upper_quartile source_url'.split(' ');

export function nzRentDefinitions() {
  return Object.values(NZ_RENT_LOCATIONS).flatMap(location=>Object.entries(NZ_RENT_DWELLINGS).flatMap(([dwelling,label])=>Object.entries(NZ_RENT_BEDROOMS).flatMap(([bedrooms,bedroomLabel])=>Object.entries(NZ_RENT_STATISTICS).map(([statistic,stat])=>({
    id:`${location.id}.${dwelling}.${bedrooms}.${statistic}`,
    name:`${location.geography}, ${label}, ${bedroomLabel}: ${stat.name}`,
    geography:location.geography,population:statistic==='active_bonds'?activeBondPopulation:population,unit:stat.unit,definition:stat.definition,adjustment,kind:'observation',
    period_convention,cadence:'monthly',dimensions:{location:location.id,dwelling,bedrooms,statistic},
    publisher,licence,licence_url,source_url:location.source_url,
    revision_policy:NZ_RENT_DEFINITION.revision_policy,limitations,
  })))));
}

const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dateFromLabel(text) {
  const match=/^(\d{2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(text),month=match&&months.indexOf(match[2]);
  requireValue(match&&month>=0&&Number(match[3])>=1900,'Invalid period date');
  const iso=`${match[3]}-${String(month+1).padStart(2,'0')}-${match[1]}`;
  const epoch=Date.parse(iso+'T00:00:00Z');
  requireValue(Number.isFinite(epoch)&&new Date(epoch).toISOString().slice(0,10)===iso,'Invalid period date');
  return iso;
}
function validWindow(start,end) {
  if(typeof start!=='string'||typeof end!=='string'||!/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])-01$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return false;
  const [year,month]=start.split('-').map(Number);
  return new Date(Date.UTC(year,month+5,0)).toISOString().slice(0,10)===end;
}
function decode(text) {
  const decoded=text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi,entity=>{
    const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
    if(Object.hasOwn(named,entity.toLowerCase()))return named[entity.toLowerCase()];
    const code=entity[2].toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));
    requireValue(code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff),'Invalid HTML entity');
    return String.fromCodePoint(code);
  });
  requireValue(!/&[a-z#][^;\s]*;/i.test(decoded),'Unknown HTML entity');
  return decoded.replace(/\s+/g,' ').trim();
}

// This is a deliberately closed parser for the small publisher result fragment,
// not a general browser HTML recovery parser. Malformed/unknown markup fails.
function fragment(html) {
  requireValue(typeof html==='string'&&html.length>0&&html.length<=65536,'Invalid or oversized table fragment');
  const root={tag:'root',children:[]},stack=[root],allowed=new Set(['div','hr','h5','span','table','thead','tbody','tr','td','th']);
  const tokens=html.match(/<[^>]*>|[^<]+/g)||[];
  requireValue(tokens.join('')===html,'Malformed table markup');
  for(const token of tokens) {
    if(!token.startsWith('<')){stack.at(-1).children.push(token);continue;}
    const match=/^<(\/?)([a-z][a-z0-9]*)([^<>]*?)(\/?)>$/i.exec(token);
    requireValue(match&&allowed.has(match[2].toLowerCase()),'Unknown or malformed table tag');
    const [,closing,rawTag,attrs,selfClosing]=match,tag=rawTag.toLowerCase();
    if(closing) {
      requireValue(!attrs.trim()&&!selfClosing&&stack.length>1&&stack.at(-1).tag===tag,'Mismatched table tag');
      stack.pop();continue;
    }
    requireValue(/^(?:\s+(?:class|title|colspan|data-[a-z-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*\s*$/i.test(attrs),'Unexpected table attributes');
    const node={tag,children:[]};stack.at(-1).children.push(node);
    if(tag!=='hr'){requireValue(!selfClosing,'Unexpected self-closing table tag');stack.push(node);}
  }
  requireValue(stack.length===1,'Truncated table markup');
  return root;
}
const nodes=node=>node.children.filter(c=>typeof c!=='string');
const text=node=>decode(node.children.map(c=>typeof c==='string'?c:text(c)).join(' '));
const noLooseText=node=>node.children.every(c=>typeof c!=='string'||!c.trim());
function exactChildren(node,tags) {
  const children=nodes(node);
  requireValue(noLooseText(node)&&children.length===tags.length&&children.every((child,i)=>child.tag===tags[i]),'Unexpected table structure');
  return children;
}
function cellText(node) {
  requireValue(nodes(node).every(child=>child.tag==='span'&&nodes(child).length===0),'Unexpected nested table cell');
  return text(node);
}
function numberCell(value,currency) {
  const prefix=currency?'\\$':'',pattern=new RegExp('^'+prefix+'(?:0|[1-9]\\d*|[1-9]\\d{0,2}(?:,\\d{3})+)$');
  requireValue(pattern.test(value),'Missing, suppressed or invalid numeric cell');
  const n=Number(value.replace(/[$,]/g,''));
  requireValue(count(n),'Invalid numeric count or rent');
  return n;
}

export function parseNzRentPayload(payload,locationId) {
  const location=locationFor(locationId);
  if(typeof payload==='string'){try{payload=JSON.parse(payload);}catch{fail('Malformed JSON response');}}
  requireValue(plain(payload)&&Object.keys(payload).length===2&&typeof payload.Finder==='string'&&typeof payload.Table==='string','Unexpected JSON response shape');
  const root=fragment(payload.Table),[wrapper]=exactChildren(root,['div']);
  const children=nodes(wrapper);
  requireValue(noLooseText(wrapper)&&children.length===7&&children[0].tag==='hr'&&children[1].tag==='h5'&&children.slice(2).every(n=>n.tag==='table'),'Missing or extra locality heading/table');
  const heading=children[1],spans=nodes(heading);
  requireValue(spans.length===1&&spans[0].tag==='span'&&nodes(spans[0]).length===0,'Missing or ambiguous six-month window');
  requireValue(decode(heading.children.filter(c=>typeof c==='string').join(' '))===location.geography,'Publisher locality does not match request');
  const periodLabel=text(spans[0]),match=/^(\d{2} [A-Z][a-z]{2} \d{4}) - (\d{2} [A-Z][a-z]{2} \d{4})$/.exec(periodLabel);
  requireValue(match,'Invalid period label');
  const period_start=dateFromLabel(match[1]),period_end=dateFromLabel(match[2]);
  requireValue(validWindow(period_start,period_end),'Publisher period is not an inclusive six-month window');
  const period=period_start+'/'+period_end,rows=[],seenTables=new Set(),table_counts={};
  for(const table of children.slice(2)) {
    const [thead,tbody]=exactChildren(table,['thead','tbody']),[titleRow,headerRow]=exactChildren(thead,['tr','tr']);
    const [titleCell]=exactChildren(titleRow,['td']),[title]=exactChildren(titleCell,['h5']);
    requireValue(nodes(title).length===0,'Unexpected dwelling title markup');
    const dwelling_type=text(title),dwelling_key=Object.keys(NZ_RENT_DWELLINGS).find(k=>NZ_RENT_DWELLINGS[k]===dwelling_type);
    requireValue(dwelling_key&&!seenTables.has(dwelling_key),'Unknown or duplicate dwelling table');seenTables.add(dwelling_key);
    const headers=exactChildren(headerRow,['th','th','th','th','th']).map(cellText);
    requireValue(headers.join('|')==='Size|Active bonds|Lower Quartile|Median Rent|Upper Quartile','Changed table headers or units');
    requireValue(noLooseText(tbody)&&nodes(tbody).every(n=>n.tag==='tr')&&nodes(tbody).length<=5,'Invalid dwelling rows');
    const seenBedrooms=new Set();table_counts[dwelling_key]=nodes(tbody).length;
    for(const row of nodes(tbody)) {
      const cells=exactChildren(row,['td','td','td','td','td']).map(cellText),bedrooms=cells[0],bedroom_key=Object.keys(NZ_RENT_BEDROOMS).find(k=>NZ_RENT_BEDROOMS[k]===bedrooms);
      requireValue(bedroom_key&&!seenBedrooms.has(bedroom_key),'Unknown or duplicate bedroom category');seenBedrooms.add(bedroom_key);
      const [active_bonds,lower_quartile,median,upper_quartile]=cells.slice(1).map((value,i)=>numberCell(value,i>0));
      requireValue(lower_quartile<=median&&median<=upper_quartile,'Inconsistent rent quartile order');
      rows.push({location_id:location.id,geography:location.geography,city:location.city,suburb:location.suburb,dwelling_type,dwelling_key,bedrooms,bedroom_key,period,period_start,period_end,active_bonds,lower_quartile,median,upper_quartile,source_url:location.source_url});
    }
  }
  requireValue(seenTables.size===5&&rows.length>0,'Incomplete dwelling table coverage');
  return {rows,location:{id:location.id,status:'ok',period_start,period_end,row_count:rows.length,table_counts}};
}

export function validateNzRentRepresentation(value) {
  try {
    if(!plain(value)||value.publisher!==publisher||value.licence!==licence||value.licence_url!==licence_url||!same(value.definition,NZ_RENT_DEFINITION)||value.limitations!==limitations||value.published_at!==null||value.publisher_updated_at!==null||value.next_expected_update!==null||!Array.isArray(value.rows)||!Array.isArray(value.locations)||value.locations.length!==2||!Array.isArray(value.provenance))return false;
    const ids=new Set(),seenRows=new Set(),healthy=[];
    for(const location of value.locations) {
      if(!has(NZ_RENT_LOCATIONS,location?.id)||ids.has(location.id))return false;ids.add(location.id);
      const group=value.rows.filter(r=>r?.location_id===location.id);
      if(location.status==='error') {
        if(typeof location.error!=='string'||!location.error||location.period_start!==null||location.period_end!==null||location.row_count!==0||group.length)return false;
        continue;
      }
      if(location.status!=='ok'||location.error!==undefined||!validWindow(location.period_start,location.period_end)||location.row_count!==group.length||group.length<1||group.length>25||!plain(location.table_counts)||Object.keys(location.table_counts).length!==5)return false;
      for(const key of Object.keys(NZ_RENT_DWELLINGS))if(location.table_counts[key]!==group.filter(r=>r.dwelling_key===key).length)return false;
      healthy.push(location);
      for(const row of group) {
        const place=NZ_RENT_LOCATIONS[location.id],identity=row.location_id+'.'+row.dwelling_key+'.'+row.bedroom_key;
        if(!plain(row)||Object.keys(row).length!==rowKeys.length||!rowKeys.every(k=>Object.hasOwn(row,k))||seenRows.has(identity)||row.geography!==place.geography||row.city!==place.city||row.suburb!==place.suburb||row.source_url!==place.source_url||!has(NZ_RENT_DWELLINGS,row.dwelling_key)||row.dwelling_type!==NZ_RENT_DWELLINGS[row.dwelling_key]||!has(NZ_RENT_BEDROOMS,row.bedroom_key)||row.bedrooms!==NZ_RENT_BEDROOMS[row.bedroom_key]||row.period_start!==location.period_start||row.period_end!==location.period_end||row.period!==row.period_start+'/'+row.period_end||!Object.keys(NZ_RENT_STATISTICS).every(k=>count(row[k]))||row.lower_quartile>row.median||row.median>row.upper_quartile)return false;
        seenRows.add(identity);
      }
    }
    if(!healthy.length||seenRows.size!==value.rows.length||healthy.some(g=>g.period_start!==healthy[0].period_start||g.period_end!==healthy[0].period_end))return false;
    if(value.status!==(healthy.length===2?'ok':'degraded'))return false;
    return same(value.metadata,{count:value.rows.length,location_count:2,successful_location_count:healthy.length,period_start:healthy[0].period_start,period_end:healthy[0].period_end,window_consistent:true,publication_time:null,revision_id:null});
  } catch{return false;}
}

async function boundedBody(response) {
  if(!response.ok){await response.body?.cancel();throw new SourceError('NZ market rent returned HTTP '+response.status,response.status);}
  const length=response.headers.get('content-length'),maximum=131072;
  if(length!==null&&!(/^\d+$/.test(length)&&Number(length)<=maximum)){await response.body?.cancel();fail('Response exceeds byte bound');}
  requireValue(response.body,'Empty response body');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;requireValue(size<=maximum,'Response exceeds byte bound');chunks.push(value);}
  } finally{await reader.cancel();}
  requireValue(size>0,'Empty response body');
  const bytes=new Uint8Array(size);let at=0;
  for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('Invalid UTF-8 response');}
  const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  return {text,sha256,bytes:size};
}

function retrievalTime(now) {
  const raw=now();
  requireValue(typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw),'Invalid retrieval clock');
  const epoch=Date.parse(raw);
  requireValue(Number.isFinite(epoch),'Invalid retrieval clock');
  const iso=new Date(epoch).toISOString();
  requireValue(iso===raw.replace(/(?<=:\d{2})Z$/,'.000Z'),'Invalid retrieval clock');
  return iso;
}

export async function readNzMarketRent({fetcher=fetchOfficial,now=()=>new Date().toISOString(),timeoutMs=20000}={}) {
  requireValue(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=20000,'Invalid request timeout');
  const results=await Promise.all(Object.values(NZ_RENT_LOCATIONS).map(async location=>{
    try {
      const response=await fetcher(location.source_url,{headers:{accept:'application/json','X-Requested-With':'XMLHttpRequest',Referer:page},signal:AbortSignal.timeout(timeoutMs)});
      if(response.url)requireValue(response.url===location.source_url,'Unexpected publisher redirect or query substitution');
      const file=await boundedBody(response),parsed=parseNzRentPayload(file.text,location.id),retrieved_at=retrievalTime(now);
      // A future observation is impossible; this does not infer publication
      // from retrieval time, impose a lag SLA or mark unchanged data stale.
      requireValue(parsed.location.period_end<=retrieved_at.slice(0,10),'Publisher window ends after retrieval date');
      return {...parsed,provenance:{location_id:location.id,url:location.source_url,retrieved_at,sha256:file.sha256,bytes:file.bytes}};
    } catch(error) {
      return {rows:[],location:{id:location.id,status:'error',period_start:null,period_end:null,row_count:0,...describeError(error)},provenance:null};
    }
  }));
  const locations=results.map(r=>r.location),rows=results.flatMap(r=>r.rows),healthy=locations.filter(l=>l.status==='ok');
  const window_consistent=healthy.length>0&&healthy.every(l=>l.period_start===healthy[0].period_start&&l.period_end===healthy[0].period_end);
  return {
    status:healthy.length===0?'error':healthy.length===2&&window_consistent?'ok':'degraded',
    rows,locations,publisher,licence,licence_url,definition:{...NZ_RENT_DEFINITION},limitations,
    metadata:{count:rows.length,location_count:2,successful_location_count:healthy.length,period_start:window_consistent?healthy[0].period_start:null,period_end:window_consistent?healthy[0].period_end:null,window_consistent,publication_time:null,revision_id:null},
    published_at:null,publisher_updated_at:null,next_expected_update:null,
    provenance:results.flatMap(r=>r.provenance?[r.provenance]:[]),
  };
}
