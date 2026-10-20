import {fetchOfficial, SourceError} from './sources.js';

export const CLAIMANT_DATASET = 'NM_162_1';
export const CLAIMANT_TIME_URL = 'https://www.nomisweb.co.uk/api/v01/dataset/NM_162_1/time.def.sdmx.json';
export const CLAIMANT_GEOGRAPHIES = Object.freeze(Object.fromEntries([
  ['united-kingdom','United Kingdom','K02000001','countries','499','2092957697'],
  ['england','England','E92000001','countries','499','2092957699'],
  ['scotland','Scotland','S92000003','regions','480','2013265931'],
  ['wales','Wales','W92000004','regions','480','2013265930'],
  ['northern-ireland','Northern Ireland','N92000002','regions','480','2013265932'],
].map(([desk,name,code,type,type_code,nomis_code])=>[desk,Object.freeze({name,code,type,type_code,nomis_code})])));
export const CLAIMANT_DATA_URL = 'https://www.nomisweb.co.uk/api/v01/dataset/NM_162_1.data.csv?geography='+Object.values(CLAIMANT_GEOGRAPHIES).map(g=>g.code).join(',')+'&date=latestMINUS12-latest&gender=0&age=0&measure=1&measures=20100';
const publisher='Office for National Statistics / Nomis';
const licence='Open Government Licence v3.0';
const licenceUrl='https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
const adjustment='not seasonally adjusted';
const limitations='Administrative claimant stock, not ILO unemployment, a claimant rate or available recruits. Universal Credit eligibility, work-search conditions, rollout, classification and policy changes affect coverage and comparisons; arrangements can differ in Northern Ireland. JSA and relevant UC claimants are combined under the publisher definition; overlapping benefit populations must not be added again. Exact retained national months only; no local areas, seasonal adjustment, missing-to-zero conversion or older-release substitution.';
const population='All sexes, age 16 and over: Jobseeker’s Allowance claimants and relevant Universal Credit claimants under the publisher’s claimant-count eligibility and administrative definitions.';
const fail=message=>{throw new SourceError('Nomis claimant count: '+message);};
const requireValue=(condition,message)=>{if(!condition)fail(message);};
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const periodPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
const dimensions=g=>({dataset:CLAIMANT_DATASET,gender:'0',age:'0',measure:'1',measures:'20100',geography:g.code});
const exact=(value,expected)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==Object.keys(expected).length)return false;
  return Object.entries(expected).every(([key,want])=>want&&typeof want==='object'?exact(value[key],want):value[key]===want);
};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const validRawTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)&&validDate(value.slice(0,10));
const periodName=period=>months[Number(period.slice(5))-1]+' '+period.slice(0,4);

export function claimantDefinition(desk) {
  const g=Object.hasOwn(CLAIMANT_GEOGRAPHIES,desk)&&CLAIMANT_GEOGRAPHIES[desk];
  requireValue(g,'Unsupported national geography');
  return {
    id:'claimants',name:'Claimant count, all sexes, age 16+',geography:g.name,geography_code:g.code,
    population,unit:'persons',adjustment,kind:'observation',
    period_convention:'Publisher monthly reference-date stock, identified by YYYY-MM; not a monthly sum or mean.',
    cadence:'monthly',rounding:'Nearest five persons',dimensions:dimensions(g),publisher,licence,licence_url:licenceUrl,source_url:CLAIMANT_DATA_URL,
    revision_policy:'Previous months and longer histories can be revised. Retain the publisher revision metadata; current values are not a vintage archive.',
    limitations,
  };
}

export function claimantWindow(latest) {
  requireValue(typeof latest==='string'&&periodPattern.test(latest),'Invalid latest period');
  const end=Number(latest.slice(0,4))*12+Number(latest.slice(5))-1;
  requireValue(end>=12,'Invalid latest period');
  return Array.from({length:13},(_,i)=>{const n=end-12+i;return `${String(Math.floor(n/12)).padStart(4,'0')}-${String(n%12+1).padStart(2,'0')}`;});
}

// The current live time codelist, not the request date or CSV's own last row,
// anchors the window. A pending scheduled release is not an observed release.
export function parseClaimantTime(json) {
  const structure=json?.structure,lists=structure?.codelists?.codelist;
  requireValue(structure?.header?.id===CLAIMANT_DATASET&&structure.header.test==='false','Unexpected time metadata dataset');
  requireValue(Array.isArray(lists)&&lists.length===1,'Ambiguous time codelist');
  const list=lists[0];
  requireValue(list.id==='CL_162_1_TIME'&&list.agencyid==='NOMIS'&&list.name?.value==='date'&&Array.isArray(list.code)&&list.code.length>=13&&list.code.length<=2400,'Unexpected time codelist');
  const records=new Map();
  for(const code of list.code) {
    requireValue(typeof code?.value==='string'&&periodPattern.test(code.value)&&!records.has(code.value)&&code.description?.value===periodName(code.value),'Invalid or duplicate publisher month');
    const annotations=Object.create(null);
    const entries=code.annotations?.annotation??[];
    requireValue(Array.isArray(entries),'Invalid time annotations');
    for(const entry of entries) {
      requireValue(typeof entry?.annotationtitle==='string'&&!Object.hasOwn(annotations,entry.annotationtitle),'Duplicate time annotation');
      annotations[entry.annotationtitle]=entry.annotationtext;
    }
    records.set(code.value,annotations);
  }
  const latest=[...records].filter(([,a])=>a.CurrentRevisionStatus==='Live').map(([period])=>period).sort().at(-1);
  requireValue(latest,'No live publisher month');
  const periods=claimantWindow(latest),by_period={};
  for(const period of periods) {
    const a=records.get(period);
    requireValue(a?.CurrentRevisionStatus==='Live'&&validDate(a['taken on'])&&a['taken on'].slice(0,7)===period&&validRawTime(a.CurrentRevisionReleased)&&Number.isSafeInteger(a.CurrentRevisionVersion)&&a.CurrentRevisionVersion>=0,'Incomplete live reference/revision metadata');
    requireValue(a.CurrentRevisionReleased.slice(0,10)>=a['taken on'],'Revision predates reference date');
    if(a.NextRevisionScheduled!==undefined)requireValue(validRawTime(a.NextRevisionScheduled),'Invalid scheduled revision timestamp');
    by_period[period]={
      reference_date:a['taken on'],release_timestamp_raw:a.CurrentRevisionReleased,release_timezone:null,
      revision_version:a.CurrentRevisionVersion,release_status:'Live',
      next_revision_scheduled_raw:a.NextRevisionScheduled??null,next_revision_timezone:null,
    };
  }
  // header.prepared is a generated extraction clock, not publication/update time.
  return {latest_period:latest,first_period:periods[0],periods,by_period,time_codelist_url:CLAIMANT_TIME_URL};
}

// Strict quoted/unquoted fields reject malformed quoting instead of repairing it.
// The byte-bound transport below limits memory before this parser is reached.
function csvRecords(text) {
  requireValue(typeof text==='string','CSV is not text');
  text=text.replace(/^\uFEFF/,'');
  const records=[];let record=[],field='',quoted=false,closed=false,started=false;
  const cell=()=>{record.push(field);field='';closed=false;started=false;};
  const row=()=>{cell();requireValue(record.some(v=>v!==''),'Empty CSV record');records.push(record);record=[];};
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) {
      if(ch==='"') {if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else field+=ch;
    } else if(ch==='"') {
      requireValue(!started&&!closed,'Malformed CSV quote');quoted=true;started=true;
    } else if(ch===',')cell();
    else if(ch==='\r'||ch==='\n') {
      if(ch==='\r'){requireValue(text[i+1]==='\n','Malformed CSV line ending');i++;}
      row();
    } else {
      requireValue(!closed,'Characters after quoted CSV field');field+=ch;started=true;
    }
  }
  requireValue(!quoted,'Truncated quoted CSV field');
  if(started||closed||record.length)row();
  return records;
}
const headers=['DATE','DATE_NAME','DATE_CODE','DATE_TYPE','DATE_TYPECODE','DATE_SORTORDER','GEOGRAPHY','GEOGRAPHY_NAME','GEOGRAPHY_CODE','GEOGRAPHY_TYPE','GEOGRAPHY_TYPECODE','GEOGRAPHY_SORTORDER','GENDER','GENDER_NAME','GENDER_CODE','GENDER_TYPE','GENDER_TYPECODE','GENDER_SORTORDER','AGE','AGE_NAME','AGE_CODE','AGE_TYPE','AGE_TYPECODE','AGE_SORTORDER','MEASURE','MEASURE_NAME','MEASURE_CODE','MEASURE_TYPE','MEASURE_TYPECODE','MEASURE_SORTORDER','MEASURES','MEASURES_NAME','OBS_VALUE','OBS_STATUS','OBS_STATUS_NAME','OBS_CONF','OBS_CONF_NAME','URN','RECORD_OFFSET','RECORD_COUNT'];
const fixed={DATE_TYPE:'date',DATE_TYPECODE:'0',GENDER:'0',GENDER_NAME:'Total',GENDER_CODE:'0',GENDER_TYPE:'Sex',GENDER_TYPECODE:'1000',GENDER_SORTORDER:'0',AGE:'0',AGE_NAME:'All categories: Age 16+',AGE_CODE:'0',AGE_TYPE:'Ageband',AGE_TYPECODE:'2000',AGE_SORTORDER:'0',MEASURE:'1',MEASURE_NAME:'Claimant count',MEASURE_CODE:'1',MEASURE_TYPE:'measures',MEASURE_TYPECODE:'1000',MEASURE_SORTORDER:'0',MEASURES:'20100',MEASURES_NAME:'Value',OBS_STATUS:'A',OBS_STATUS_NAME:'Normal Value',OBS_CONF:'F',OBS_CONF_NAME:'Free (free for publication)',RECORD_COUNT:'65'};

export function parseClaimantCounts(csv,time) {
  const periods=claimantWindow(time?.latest_period);
  requireValue(time.first_period===periods[0]&&time.time_codelist_url===CLAIMANT_TIME_URL&&Array.isArray(time.periods)&&time.periods.length===13&&time.periods.every((p,i)=>p===periods[i]),'Invalid authoritative month window');
  const [columns,...records]=csvRecords(csv);
  requireValue(columns?.length===headers.length&&columns.every((v,i)=>v===headers[i]),'Unexpected CSV columns');
  requireValue(records.length===65,'Incomplete national record count');
  const entries=Object.entries(CLAIMANT_GEOGRAPHIES),by_code=new Map(entries.map(([desk,g],i)=>[g.code,{desk,g,order:i,rows:new Map()}])),offsets=new Set(),urns=new Set();
  for(const cells of records) {
    requireValue(cells.length===columns.length,'Truncated CSV record');
    const r=Object.fromEntries(columns.map((key,i)=>[key,cells[i]]));
    requireValue(Object.entries(fixed).every(([key,value])=>r[key]===value),'Dimension, label, publication flag or record count changed');
    const selected=by_code.get(r.GEOGRAPHY),monthIndex=periods.indexOf(r.DATE);
    requireValue(selected&&r.GEOGRAPHY_CODE===selected.g.code&&r.GEOGRAPHY_NAME===selected.g.name&&r.GEOGRAPHY_TYPE===selected.g.type&&r.GEOGRAPHY_TYPECODE===selected.g.type_code&&r.GEOGRAPHY_SORTORDER===String(selected.order),'Wrong geography or national boundary');
    requireValue(monthIndex>=0&&r.DATE_CODE===r.DATE&&r.DATE_NAME===periodName(r.DATE)&&r.DATE_SORTORDER===String(monthIndex),'Stale, substituted or mislabeled month');
    requireValue(!selected.rows.has(r.DATE),'Duplicate geography/month');
    requireValue(/^(?:0|[1-9]\d*)$/.test(r.OBS_VALUE)&&Number.isSafeInteger(Number(r.OBS_VALUE))&&Number(r.OBS_VALUE)%5===0,'Missing, suppressed or invalid rounded count');
    requireValue(/^(?:0|[1-9]\d*)$/.test(r.RECORD_OFFSET)&&Number(r.RECORD_OFFSET)<65&&!offsets.has(r.RECORD_OFFSET),'Incomplete or duplicate record offsets');offsets.add(r.RECORD_OFFSET);
    const identity=new RegExp('^Nm-162d1d(\\d+)e(\\d+)d'+selected.g.nomis_code+'d0d0d0d1d20100$').exec(r.URN);
    requireValue(identity&&!urns.has(r.URN),'Dataset or observation identity changed');urns.add(r.URN);
    // All 65 retained CSV/JSON pairs encode this monthly URN component as
    // year*16+month. This is an observed NM_162_1 encoding inference, not a
    // universal documented Nomis rule. Drift requires review, not guessing.
    requireValue(identity[1]===String(Number(r.DATE.slice(0,4))*16+Number(r.DATE.slice(5))),'Publisher observation month identity mismatch');
    const revision=time.by_period?.[r.DATE];
    requireValue(revision?.release_status==='Live'&&validDate(revision.reference_date)&&revision.reference_date.slice(0,7)===r.DATE&&validRawTime(revision.release_timestamp_raw)&&revision.release_timezone===null&&Number.isSafeInteger(revision.revision_version)&&revision.revision_version>=0,'Incomplete observation revision metadata');
    requireValue(identity[2]===String(revision.revision_version),'Publisher observation revision mismatch');
    selected.rows.set(r.DATE,{
      period:r.DATE,value:Number(r.OBS_VALUE),value_state:'observed',geography:selected.g.name,geography_code:selected.g.code,
      unit:'persons',adjustment,dimensions:dimensions(selected.g),reference_date:revision.reference_date,
      release_timestamp_raw:revision.release_timestamp_raw,release_timezone:null,revision_version:revision.revision_version,
      obs_status:'A',obs_conf:'F',
    });
  }
  return Object.fromEntries(entries.map(([desk,g])=>{
    const selected=by_code.get(g.code);
    requireValue(selected.rows.size===13&&periods.every(p=>selected.rows.has(p)),'Incomplete thirteen-month coverage');
    const value={
      dataset:CLAIMANT_DATASET,measure:'claimants',definition:claimantDefinition(desk),geography:g.name,geography_code:g.code,unit:'persons',adjustment,
      rows:periods.map(period=>selected.rows.get(period)),
      metadata:{count:13,first_period:periods[0],latest_period:time.latest_period,...time.by_period[time.latest_period],acquisition_record_count:65,time_codelist_url:CLAIMANT_TIME_URL},
      source_url:CLAIMANT_DATA_URL,publisher,licence,licence_url:licenceUrl,
      published_at:null,publisher_updated_at:null,next_expected_update:null,limitations,provenance:[],
    };
    requireValue(validateClaimantRepresentation(value,desk),'Representation contract failed');
    return [desk,value];
  }));
}

export function validateClaimantRepresentation(value,desk) {
  try {
    const g=Object.hasOwn(CLAIMANT_GEOGRAPHIES,desk)&&CLAIMANT_GEOGRAPHIES[desk];
    if(!g||!value||value.dataset!==CLAIMANT_DATASET||value.measure!=='claimants'||!exact(value.definition,claimantDefinition(desk))||value.geography!==g.name||value.geography_code!==g.code||value.unit!=='persons'||value.adjustment!==adjustment||value.source_url!==CLAIMANT_DATA_URL||value.publisher!==publisher||value.licence!==licence||value.licence_url!==licenceUrl||value.limitations!==limitations)return false;
    const m=value.metadata,periods=claimantWindow(m?.latest_period);
    if(m.count!==13||m.first_period!==periods[0]||m.acquisition_record_count!==65||m.time_codelist_url!==CLAIMANT_TIME_URL||m.release_status!=='Live'||m.release_timezone!==null||m.next_revision_timezone!==null||!Array.isArray(value.rows)||value.rows.length!==13)return false;
    if(m.next_revision_scheduled_raw!==null&&!validRawTime(m.next_revision_scheduled_raw))return false;
    if(value.published_at!==null||value.publisher_updated_at!==null||value.next_expected_update!==null)return false;
    if(!value.rows.every((r,i)=>r?.period===periods[i]&&r.geography===g.name&&r.geography_code===g.code&&r.unit==='persons'&&r.adjustment===adjustment&&r.value_state==='observed'&&Number.isSafeInteger(r.value)&&r.value>=0&&r.value%5===0&&r.obs_status==='A'&&r.obs_conf==='F'&&exact(r.dimensions,dimensions(g))&&validDate(r.reference_date)&&r.reference_date.slice(0,7)===r.period&&validRawTime(r.release_timestamp_raw)&&r.release_timestamp_raw.slice(0,10)>=r.reference_date&&r.release_timezone===null&&Number.isSafeInteger(r.revision_version)&&r.revision_version>=0))return false;
    const last=value.rows.at(-1);
    return m.reference_date===last.reference_date&&m.release_timestamp_raw===last.release_timestamp_raw&&m.revision_version===last.revision_version;
  } catch {return false;}
}

async function boundedBody(response,maximum) {
  if(!response.ok){await response.body?.cancel();throw new SourceError('Nomis claimant count returned HTTP '+response.status,response.status);}
  const length=response.headers.get('content-length');
  if(length!==null&&!(/^\d+$/.test(length)&&Number(length)<=maximum)){await response.body?.cancel();fail('Response exceeds byte bound');}
  requireValue(response.body,'Empty response body');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;requireValue(size<=maximum,'Response exceeds byte bound');chunks.push(value);
    }
  } finally {await reader.cancel();}
  requireValue(size>0,'Empty response body');
  const bytes=new Uint8Array(size);let at=0;
  for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('Invalid UTF-8 response');}
  return {text,bytes};
}
async function hash(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}

export async function readClaimantCount(desk,{fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}) {
  requireValue(Object.hasOwn(CLAIMANT_GEOGRAPHIES,desk),'Unsupported national geography');
  const signal=AbortSignal.timeout(20000),retrieved_at=now();
  const acquire=async(url,maximum,accept)=>{
    const response=await fetcher(url,{headers:{accept},signal});
    if(response.url) {
      const actual=new URL(response.url),expected=new URL(url);
      requireValue(actual.origin===expected.origin&&actual.pathname===expected.pathname,'Unexpected publisher redirect');
    }
    return boundedBody(response,maximum);
  };
  const [timeFile,dataFile]=await Promise.all([
    acquire(CLAIMANT_TIME_URL,524288,'application/json'),
    acquire(CLAIMANT_DATA_URL,131072,'text/csv'),
  ]);
  let json;try{json=JSON.parse(timeFile.text);}catch{fail('Malformed time metadata JSON');}
  const time=parseClaimantTime(json),result=parseClaimantCounts(dataFile.text,time)[desk];
  result.provenance=await Promise.all([
    [CLAIMANT_TIME_URL,timeFile,'publisher_time_codelist'],
    [CLAIMANT_DATA_URL,dataFile,'publisher_national_counts'],
  ].map(async([url,file,kind])=>({kind,url,sha256:await hash(file.bytes),bytes:file.bytes.byteLength,retrieved_at})));
  return result;
}
