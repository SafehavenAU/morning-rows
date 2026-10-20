import {openWorkbook, workbookBytes} from './workbook.js';
import {fetchOfficial, SourceError} from './sources.js';

const freeze=value=>{
  if(value&&typeof value==='object')for(const child of Object.values(value))freeze(child);
  return Object.freeze(value);
};
export const CQC_COHORT_MAX_BYTES=131072;
export const CQC_COHORT_CONTRACT=freeze({
  id:'cqc-adult-social-care-single-assessment-2025-08-01',
  geography:'England',
  period:'2025-08-01',
  publication_date:'2025-10-24',
  edition:'State of Care 2024/25',
  framework:'CQC single assessment framework',
  population:'Adult social care overall ratings published under the single assessment framework as at 1 August 2025.',
  assessment_unit:'Ratings of individual adult social care services at a location; not unique locations, providers or patients.',
  unit:'ratings',
  kind:'observation',
  adjustment:'Published integer counts; not seasonally adjusted.',
  period_convention:'Historical snapshot as at 1 August 2025; not a current whole-England service census.',
  revision_policy:'Fixed historical edition and snapshot. Coherent publisher corrections may change counts; changed values require new independent verification. No finality or automatic future-edition substitution is claimed.',
  limitations:'Assessment was prioritised by risk and this cohort is unlikely to represent all adult social care services. Single-framework service-level ratings must not be combined with or compared with previous-framework location ratings or previous years. No whole-England quality rate, trend, care capacity, patient outcome or individual-provider recommendation is supported. The total overlaps the four categories and must not be added to them.',
  publisher:'Care Quality Commission',
  licence:'Open Government Licence v3.0',
  licence_url:'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  source_url:'https://www.cqc.org.uk/system/files/2025-10/20251024_stateofcare2425_ratingsdata.xlsx',
  publication_url:'https://www.cqc.org.uk/publications/major-report/state-care/2024-2025/charts',
  measures:[
    {measure:'inadequate',label:'Inadequate'},
    {measure:'requires_improvement',label:'Requires improvement'},
    {measure:'good',label:'Good'},
    {measure:'outstanding',label:'Outstanding'},
    {measure:'total',label:'Total'},
  ],
});

const fail=message=>{throw new SourceError('CQC assessment cohort: '+message);};
const required=(condition,message)=>{if(!condition)fail(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,wanted)=>object(value)&&Object.keys(value).length===wanted.length&&wanted.every(key=>Object.hasOwn(value,key));
const same=(a,b)=>{
  if(a===b)return true;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>same(value,b[i]));
  return object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([key,value])=>Object.hasOwn(a,key)&&same(a[key],value));
};
const normalized=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():value;
const publicationStart=Date.parse(CQC_COHORT_CONTRACT.publication_date+'T00:00:00Z');
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z');
const clock=value=>{
  const now=typeof value==='string'?value:value?.retrieved_at;
  required(instant(now)&&Date.parse(now)>=publicationStart,'Invalid or prepublication acquisition clock');
  return now;
};
const number=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;

function provenanceValid(provenance,now) {
  if(!Array.isArray(provenance)||![0,1].includes(provenance.length))return false;
  return provenance.every(p=>keys(p,['url','retrieved_at','bytes','sha256'])&&p.url===CQC_COHORT_CONTRACT.source_url&&instant(p.retrieved_at)&&Date.parse(p.retrieved_at)>=publicationStart&&(now===undefined||Date.parse(p.retrieved_at)<=Date.parse(now))&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=CQC_COHORT_MAX_BYTES&&typeof p.sha256==='string'&&/^[a-f0-9]{64}$/.test(p.sha256));
}
function rowsFromValues(values) {
  required(Array.isArray(values)&&values.length===5&&values.every(number),'Five finite nonnegative integer counts required');
  const total=values.slice(0,4).reduce((sum,value)=>sum+value,0);
  required(Number.isSafeInteger(total)&&total===values[4],'Four rating categories must equal the published total');
  return CQC_COHORT_CONTRACT.measures.map((measure,i)=>({...measure,value:values[i],unit:CQC_COHORT_CONTRACT.unit,period:CQC_COHORT_CONTRACT.period,value_state:'observed'}));
}
function native(values,provenance) {
  const {id,measures,...metadata}=CQC_COHORT_CONTRACT;
  return {status:'ok',contract_id:id,...metadata,rows:rowsFromValues(values),provenance:structuredClone(provenance)};
}
function cellEquals(sheet,cell,expected) {
  required(normalized(sheet.get(cell))===expected,'Unexpected workbook '+cell+' identity or header');
}
function guidanceValid(sheet) {
  cellEquals(sheet,'A1','Ratings data for August 2025');
  cellEquals(sheet,'A9','State of Care 2024/25 can be found on the CQC website and a link is provided below:');
  const text=normalized(sheet.get('A5'));
  required(typeof text==='string'&&text.startsWith('This workbook provides data for current published ratings under the single assessment framework, as at 1 August 2025.'),'Snapshot or assessment framework changed');
  for(const expected of [
    'We began implementing the single assessment framework in January 2024',
    'not directly comparable to previous years',
    'assessment activity during this time has been based on risk',
    'unlikely to be representative of all services in a sector',
    'differences in the levels at which we rate providers',
  ])required(text.includes(expected),'Missing risk or comparability guidance');
}

export function parseCqcCohort(book,{now,provenance=[]}={}) {
  const checkedAt=now===undefined?undefined:clock(now);
  required(book&&typeof book.sheet==='function','Workbook model required');
  required(provenanceValid(provenance,checkedAt),'Invalid acquisition provenance');
  const guidance=book.sheet('Guidance'),contents=book.sheet('Table_of_contents'),sheet=book.sheet('1');
  required([guidance,contents,sheet].every(value=>value instanceof Map),'Worksheet cell maps required');
  guidanceValid(guidance);
  cellEquals(contents,'A1','Data sheets for State of Care 2024/2025 ratings appendix, table of contents');
  cellEquals(contents,'A3',1);
  cellEquals(contents,'B3','Worksheet 1: Adult Social Care, overall ratings, August 2025');
  cellEquals(sheet,'A1','Worksheet 1: Adult Social Care, overall ratings, August 2025');
  cellEquals(sheet,'A2','This worksheet contains one table.');
  cellEquals(sheet,'A3','Source: CQC ratings');
  cellEquals(sheet,'A4','Date report published: 24 October 2025');
  cellEquals(sheet,'A6','Rating');
  cellEquals(sheet,'B6','Value');
  cellEquals(sheet,'C6','Percentage');
  const values=CQC_COHORT_CONTRACT.measures.map((definition,i)=>{
    cellEquals(sheet,'A'+(i+7),definition.label);
    return sheet.get('B'+(i+7));
  });
  // The selected worksheet is explicitly one table; additional populated
  // category/value rows would make this fixed five-row cohort ambiguous.
  for(const [ref,value] of sheet)if(/^[AB]\d+$/.test(ref)&&Number(ref.slice(1))>11&&value!==null&&value!==undefined&&value!=='')fail('Unexpected extra rating row');
  return native(values,provenance);
}

export function validateCqcCohort(data,acquisition) {
  try {
    const now=acquisition===undefined?undefined:clock(acquisition);
    if(!object(data)||!Array.isArray(data.rows)||data.rows.length!==5||!provenanceValid(data.provenance,now))return false;
    return same(data,native(data.rows.map(row=>row?.value),data.provenance));
  } catch {return false;}
}

export function cqcCohortDefinitions() {
  const c=CQC_COHORT_CONTRACT;
  return c.measures.map(({measure,label})=>({
    id:measure,name:`${label}: adult social care service ratings in the single assessment framework cohort`,
    geography:c.geography,population:c.population,unit:c.unit,kind:c.kind,
    cadence:'Fixed historical snapshot; no automatic edition advancement',
    dimensions:{sector:'Adult social care',framework:c.framework,snapshot_date:c.period,rating:label,assessment_unit:'Individual service at a location'},
    publisher:c.publisher,licence:c.licence,licence_url:c.licence_url,source_url:c.source_url,
    period_convention:c.period_convention,adjustment:c.adjustment,limitations:c.limitations,
    revision_policy:c.revision_policy,publication_date:c.publication_date,edition:c.edition,
  }));
}
export function cqcCohortRows(value) {
  required(validateCqcCohort(value),'Cannot expose invalid assessment cohort rows');
  const definitions=cqcCohortDefinitions();
  return value.rows.map((row,i)=>({
    ...row,measure_id:row.measure,geography:definitions[i].geography,
    population:definitions[i].population,kind:definitions[i].kind,
    dimensions:definitions[i].dimensions,publication_date:value.publication_date,
    source_url:value.source_url,licence:value.licence,
  }));
}

const sha256=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
export async function readCqcCohort({fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}) {
  const requestedAt=clock(now()),url=CQC_COHORT_CONTRACT.source_url;
  const response=await fetcher(url,{headers:{accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok){await response.body?.cancel();throw new SourceError('CQC assessment cohort returned HTTP '+response.status,response.status);}
  if(response.url&&response.url!==url){await response.body?.cancel();fail('Unexpected publisher redirect');}
  const length=response.headers.get('content-length');
  if(length!==null&&!(/^\d+$/.test(length)&&Number(length)>0&&Number(length)<=CQC_COHORT_MAX_BYTES)){await response.body?.cancel();fail('Invalid or excessive declared workbook size');}
  required(response.body,'Missing workbook body');
  const bytes=await workbookBytes(response,CQC_COHORT_MAX_BYTES);
  required(bytes.length>0,'Empty workbook');
  const retrievedAt=clock(now());required(Date.parse(retrievedAt)>=Date.parse(requestedAt),'Acquisition clock moved backwards');
  const provenance=[{url,retrieved_at:retrievedAt,bytes:bytes.length,sha256:await sha256(bytes)}];
  const data=parseCqcCohort(openWorkbook(bytes),{now:retrievedAt,provenance});
  required(validateCqcCohort(data,{retrieved_at:retrievedAt}),'Public representation failed its fixed cohort contract');
  return data;
}
