import {fetchOfficial, SourceError} from './sources.js';
import {openWorkbook, workbookBytes} from './workbook.js';

const measures = Object.freeze([
  Object.freeze({id:'part_time_fe',label:'Part-time further education',column:'C',header:'Part-time FE',mode:'part-time',level:'further education'}),
  Object.freeze({id:'full_time_fe',label:'Full-time further education',column:'D',header:'Full-time FE',mode:'full-time',level:'further education'}),
  Object.freeze({id:'part_time_he',label:'Part-time higher education',column:'E',header:'Part-time HE',mode:'part-time',level:'higher education'}),
  Object.freeze({id:'full_time_he',label:'Full-time higher education',column:'F',header:'Full-time HE',mode:'full-time',level:'higher education'}),
  Object.freeze({id:'total',label:'Total college activity',column:'G',header:'Total',mode:'all',level:'all'}),
]);
export const SFC_ACTIVITY_CONTRACT = Object.freeze({
  source:'Scottish Funding Council',publisher:'Scottish Funding Council',
  source_url:'https://www.sfc.ac.uk/wp-content/uploads/2026/01/College-Statistics-2024-25-Background-Tables.xlsx',
  publication_url:'https://www.sfc.ac.uk/publications/college-statistics-2024-25/',
  methodology_url:'https://www.sfc.ac.uk/wp-content/uploads/2026/01/College-Statistics-2024-25-Annex.pdf',
  licence:'SFC permission for accurate attributed reproduction',
  licence_url:'https://www.sfc.ac.uk/wp-content/uploads/2024/03/SFC-Publication-Scheme.pdf',
  attribution:'Source: Scottish Funding Council, College Statistics 2024-25. Reproduced accurately with attribution; no endorsement implied.',
  geography:'Scotland',period:'2024-25',period_start:'2024-08-01',period_end:'2025-07-31',
  period_convention:'Academic year, 1 August through 31 July; not a calendar-year or current enrolment count.',
  publication_date:'2026-02-04',edition:'College Statistics 2024-25',
  unit:'full-time equivalents',adjustment:'Annual learning activity; no seasonal adjustment or annualisation performed',
  population:'Learning activity delivered by Scottish colleges, all funding sources; not Scottish-domiciled residents, university activity or individual student headcounts.',
  definition:'One full-time equivalent is 15 credits or 600 learning hours. Further and higher education activity is grouped by full-time and part-time mode.',
  rounding:'Published FTE values are rounded to the nearest five. Totals are calculated from unrounded data and can differ from rounded component sums.',
  missingness:'Numeric zero is valid. Blank, absent, suppression or error cells are not converted to zero by this contract; a newly blank selected cell requires review of the edition-specific disclosure rule.',
  revision_policy:'The named edition may be corrected. Retain the input digest and publication date; no immutable vintage or automatic adoption of a newer edition is claimed.',
  limitations:'The total overlaps the four components. FTE is learning volume, not people or available places. This fixed 2024-25 edition is not a claim that a newer release cannot exist. No demographic or geographic inference beyond college activity in Scotland.',
  statistical_status:'Official Statistics',max_bytes:131072,measures,
});
const C=SFC_ACTIVITY_CONTRACT;
const fail=message=>{throw new SourceError('SFC college activity: '+message);};
const requireValue=(ok,message)=>{if(!ok)fail(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const same=(a,b)=>a===b||(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i])))||(object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>Object.hasOwn(a,k)&&same(a[k],v)));
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z');
const clock=value=>typeof value==='function'?value():value;
function validTime(value){requireValue(instant(value)&&value.slice(0,10)>=C.publication_date,'Acquisition clock precedes publication or is invalid');}
function validateValues(values){
  requireValue(Array.isArray(values)&&values.length===5&&values.every(v=>Number.isSafeInteger(v)&&v>=0&&v%5===0),'Five explicit nonnegative rounded FTE values required; missingness is not zero');
  requireValue(Math.abs(values.slice(0,4).reduce((a,b)=>a+b,0)-values[4])<=12.5,'Total exceeds nearest-five rounding tolerance');
}
function validProvenance(rows,acquisition){
  requireValue(Array.isArray(rows)&&(rows.length===0||rows.length===1),'Invalid provenance count');
  for(const p of rows){
    requireValue(object(p)&&same(Object.keys(p).sort(),['bytes','retrieved_at','role','sha256','url']),'Unexpected provenance fields');
    requireValue(p.role==='workbook'&&p.url===C.source_url&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=C.max_bytes&&typeof p.sha256==='string'&&/^[a-f0-9]{64}$/.test(p.sha256),'Invalid workbook provenance');
    validTime(p.retrieved_at);
    if(acquisition!==undefined)requireValue(Date.parse(p.retrieved_at)<=Date.parse(acquisition),'Provenance after acquisition');
  }
}
function build(values,provenance=[]){
  validateValues(values);validProvenance(provenance);
  const {measures:ignored,max_bytes:ignoredBytes,...metadata}=C;
  return {status:'ok',...metadata,rows:measures.map((m,i)=>({measure:m.id,label:m.label,value:values[i],value_state:'observed',unit:C.unit,geography:C.geography,period:C.period,period_start:C.period_start,period_end:C.period_end,mode:m.mode,level:m.level,rounding:'nearest five'})),provenance};
}

export function sfcActivityDefinitions(){
  return measures.map(m=>({
    id:m.id,name:m.label+' college learning activity',geography:C.geography,population:C.population,
    unit:C.unit,kind:'observation',cadence:'annual',
    dimensions:{institution_type:'college',funding:'all funding sources',mode:m.mode,level:m.level,edition:C.edition},
    publisher:C.publisher,licence:C.licence,licence_url:C.licence_url,source_url:C.source_url,
    period_convention:C.period_convention,adjustment:C.adjustment,definition:C.definition,
    rounding:C.rounding,revision_policy:C.revision_policy,limitations:C.limitations,
    publication_date:C.publication_date,methodology_url:C.methodology_url,attribution:C.attribution,
  }));
}

export function sfcActivityRows(value){
  requireValue(validateSfcActivity(value),'Invalid native representation');
  return value.rows.map(({measure,...row})=>({measure_id:measure,...row}));
}

export function parseSfcActivity(book,{now=()=>new Date().toISOString(),provenance=[]}={}){
  const acquired=clock(now);validTime(acquired);validProvenance(provenance,acquired);
  const table=book.sheet('Table 1'),totals=book.sheet('Table 3'),national=book.sheet('Table 14');
  requireValue(table.get('B2')==='How has the number of FTEs by  mode and level of study changed in the last 10 years? '&&table.get('B3')==='number of FTEs (all funding sources) delivered by colleges at FE and HE level, by mode of study, since 2015-16'&&table.get('G5')==='Full-time equivalents (FTEs)'&&table.get('B6')==='Academic Year','Unexpected Table 1 identity, population or FTE unit');
  requireValue(measures.every(m=>table.get(m.column+'6')===m.header),'FTE categories changed');
  for(let i=0;i<10;i++)requireValue(table.get('B'+(i+7))===`${2015+i}-${String(16+i).padStart(2,'0')}`,'Academic-year axis changed or incomplete');
  requireValue(table.get('B17')===undefined||table.get('B17')===null,'Unexpected extension to pinned academic-year axis');
  requireValue(national.get('B2')==='Credit Performance Against Activity Targets in Scotland’s Colleges from 2020-21 to 2024-25','Scottish college geography or edition changed');
  requireValue(totals.get('B2')==='How has the number of students, enrolments, and FTEs changed from AY 2015-16 to AY 2024-25?'&&totals.get('B3')==='count of enrolments, students (headcount) and FTEs (all funding sources) since 2015-16'&&totals.get('B5')==='Academic Year'&&totals.get('C5')==='Enrolments'&&totals.get('D5')==='Students'&&totals.get('E5')==='FTEs'&&totals.get('B15')===C.period,'Cross-table total identity changed');
  const values=measures.map(m=>table.get(m.column+'16'));validateValues(values);
  requireValue(totals.get('E15')===values[4],'Independent workbook total differs');
  return build(values,provenance);
}

export function validateSfcActivity(value,acquisition){
  try{
    requireValue(object(value)&&Array.isArray(value.rows)&&value.rows.length===5,'Invalid representation');
    const acquired=object(acquisition)?acquisition.retrieved_at:acquisition;
    if(acquired!==undefined)validTime(acquired);
    validProvenance(value.provenance,acquired);
    return same(value,build(value.rows.map(r=>r?.value),value.provenance));
  }catch{return false;}
}
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function readSfcActivity({fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}){
  const response=await fetcher(C.source_url,{headers:{accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok){await response.body?.cancel();throw new SourceError('SFC college activity returned HTTP '+response.status,response.status);}
  if(response.url&&response.url!==C.source_url){await response.body?.cancel();fail('Unexpected publisher redirect');}
  const length=response.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>C.max_bytes)){await response.body?.cancel();fail('Workbook exceeds download limit');}
  requireValue(response.body,'Empty workbook response');
  const bytes=await workbookBytes(response,C.max_bytes);requireValue(bytes.length>0,'Empty workbook');
  const retrieved_at=clock(now);validTime(retrieved_at);
  const provenance=[{role:'workbook',url:C.source_url,retrieved_at,bytes:bytes.length,sha256:await hash(bytes)}];
  try{return parseSfcActivity(openWorkbook(bytes),{now:retrieved_at,provenance});}
  catch(error){if(error instanceof SourceError)throw error;fail('Invalid workbook archive or XML');}
}
