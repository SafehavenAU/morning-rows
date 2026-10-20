import {unzipSync} from 'fflate';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {fetchOfficial,SourceError} from './sources.js';

export const NI_ENERGY_URL='https://datavis.nisra.gov.uk/Economy/electricity-consumption-and-renewable-generation-report.html';
export const NI_ENERGY_LIMIT=6291456;
const ARCHIVE_LIMIT=65536,XML_LIMIT=262144,EXPANSION_LIMIT=524288,MAX_MONTHS=240;
const publisher='Department for the Economy, Northern Ireland';
const licence='Open Government Licence v3.0';
const licence_url='https://www.economy-ni.gov.uk/articles/crown-copyright-economy';
const title='Electricity Consumption and Renewable Generation in Northern Ireland';
const methodology='Gross final electricity consumption includes metered and own-use renewable and non-renewable generation plus imports minus exports, gross of system losses; renewable numerator is indigenous renewable generation. Revised GFEC basis, not the superseded pre-2026 consumption measure.';
const revision_status='Statistics in Development; rounded estimates and earlier periods may be revised, including own-use estimates and supplier corrections; not final.';
const limitations='One latest published rolling twelve-month window for Northern Ireland, not a calendar-year total, monthly average, UK or all-island figure. No historical series or fuel breakdown. Generation and net imports overlap with consumption; do not add consumption to its components. The renewable/GFEC ratio is not the renewable share of total generation.';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const specifications=[
 ['renewable_share_gfec','Renewable generation as a proportion of gross final electricity consumption','%','ratio of rolling totals'],
 ['gross_final_consumption','Gross final electricity consumption','GWh','rolling total'],
 ['renewable_generation','Indigenous renewable electricity generation','GWh','rolling total'],
 ['non_renewable_generation','Non-renewable electricity generation','GWh','rolling total'],
 ['net_imports','Net electricity imports (imports minus exports)','GWh','rolling total'],
];
const need=(condition,message)=>{if(!condition)throw new SourceError('NI electricity: '+message);};
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>a===b||(Array.isArray(a)||Array.isArray(b)?Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i])):object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>Object.hasOwn(a,k)&&same(a[k],v)));
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z');
const decodeText=value=>value.replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[x])).replace(/\s+/g,' ').trim();
const plain=value=>decodeText(value.replace(/<[^>]*>/g,' '));
const referenceMonth=value=>{need(typeof value==='string'&&/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(value),'Invalid reference month');return value;};
function windowFor(month){
 referenceMonth(month);const y=Number(month.slice(0,4)),m=Number(month.slice(5));
 const period_start=new Date(Date.UTC(y,m-12,1)).toISOString().slice(0,10),period_end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
 return {period:period_start+'/'+period_end,period_start,period_end};
}
function field(html,name){
 const pattern=new RegExp('<strong>\\s*'+name+':\\s*</strong>\\s*([^<]+)','g'),values=[...html.matchAll(pattern)].map(m=>plain(m[1]));
 need(values.length===1,'Missing or duplicate report '+name);return values[0];
}
function metadata(html,retrieved_at){
 need(instant(retrieved_at),'A valid UTC acquisition clock is required');
 const headings=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(m=>plain(m[1]));
 need(headings.length===1&&headings[0]===title,'Report title/geography changed');
 need(field(html,'Coverage')==='Northern Ireland'&&field(html,'Frequency')==='Quarterly'&&field(html,'Official Statistics Status')==='Statistics in Development','Report scope, frequency or status changed');
 const pub=field(html,'Publication date').match(/^(\d{2}) ([A-Za-z]+) ((?:19|20|21)\d{2})$/);
 need(pub&&months.includes(pub[2]),'Invalid publication date');
 const publication_date=`${pub[3]}-${String(months.indexOf(pub[2])+1).padStart(2,'0')}-${pub[1]}`;
 need(validDate(publication_date)&&publication_date<=retrieved_at.slice(0,10),'Invalid or future publication date');
 const publication_period=field(html,'Publication period'),p=publication_period.match(/^([A-Za-z]+) ((?:19|20|21)\d{2}) to ([A-Za-z]+) ((?:19|20|21)\d{2})$/);
 need(p&&months.includes(p[1])&&months.includes(p[3]),'Invalid publication window');
 const latest_reference_month=p[4]+'-'+String(months.indexOf(p[3])+1).padStart(2,'0'),window=windowFor(latest_reference_month);
 need(window.period_start===p[2]+'-'+String(months.indexOf(p[1])+1).padStart(2,'0')+'-01'&&window.period_end<publication_date,'Report is not a completed rolling twelve-month window');
 const text=plain(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' '));
 for(const phrase of ['Renewable generation includes all metered and own use','Gross Final Electricity Consumption includes all metered and own use renewable and non-renewable generation plus imports of electricity minus exports of electricity','changes to previous publications up to December 2025','may be subject to revision','Percentage estimates in this report are published to the nearest whole percent'])need(text.includes(phrase),'Missing reviewed GFEC, own-use, revision or rounding methodology');
 return {...window,publication_date,publication_period,latest_reference_month,publication_month:pub[2].toLowerCase()+'-'+pub[3]};
}
export function niEnergyDefinitions(){
 return specifications.map(([id,name,unit,aggregation])=>({id,name,geography:'Northern Ireland',unit,kind:'observation',population:'Electricity generated and consumed in Northern Ireland, including metered and own-use generation; gross final consumption includes net imports and system losses.',adjustment:'Physical electricity quantities; not seasonally adjusted',period_convention:'Inclusive rolling twelve-month window YYYY-MM-DD/YYYY-MM-DD; month labels are not individual monthly observations',cadence:'Quarterly publication of rolling twelve-month figures',dimensions:{territory:'Northern Ireland',aggregation,methodology:'gross_final_consumption_including_own_use',measure:id},publisher,licence,licence_url,source_url:NI_ENERGY_URL,methodology,revision_policy:revision_status,rounding:unit==='%'?'Publisher-rounded whole percentage point':'Publisher-rounded whole GWh',limitations}));
}
function workbook(bytes,figure,anchor){
 need(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=ARCHIVE_LIMIT,'Invalid embedded workbook size');
 let count=0,size=0;const names=new Set();
 const files=unzipSync(bytes,{filter(file){
  need(++count<=32&&!names.has(file.name)&&!/\\|(?:^|\/)\.\.(?:\/|$)|vbaProject/i.test(file.name),'Duplicate, unsafe or excessive ZIP members');names.add(file.name);
  const wanted=/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(file.name);
  if(wanted){size+=file.originalSize;need(file.originalSize<=XML_LIMIT&&size<=EXPANSION_LIMIT,'Embedded workbook expansion bound exceeded');}return wanted;
 }});
 const xml=path=>{
  need(files[path]&&files[path].length<=XML_LIMIT,'Workbook part missing or oversized');const text=new TextDecoder('utf-8',{fatal:true}).decode(files[path]);
  need(!/<!DOCTYPE|<!ENTITY|<f\b/i.test(text)&&XMLValidator.validate(text)===true,'Invalid XML or unsupported formula');
  return new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',parseTagValue:false,parseAttributeValue:false,trimValues:false}).parse(text);
 };
 const book=xml('xl/workbook.xml').workbook,sheets=list(book?.sheets?.sheet);
 need(book?.workbookPr?.['@date1904']==='false'&&sheets.length===1&&sheets[0]['@name']===`Figure ${figure}`&&sheets[0]['@state']==='visible','Wrong worksheet or date epoch');
 const relations=list(xml('xl/_rels/workbook.xml.rels').Relationships?.Relationship),matching=relations.filter(r=>r['@Id']===sheets[0]['@r:id']);
 need(relations.every(r=>!r['@TargetMode'])&&matching.length===1&&matching[0]['@Type']==='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'&&/^worksheets\/sheet\d+\.xml$/.test(matching[0]['@Target']||''),'Unexpected workbook relationship');
 const shared=list(xml('xl/sharedStrings.xml').sst?.si).map(si=>{
  const value=typeof si.t==='string'?si.t:si.t?.['#text'];
  need(typeof value==='string'&&!si.r&&(!object(si.t)||Object.keys(si.t).every(k=>k==='#text'||k==='@xml:space')&&si.t['@xml:space']==='preserve'),'Unsupported shared string');return value;
 });
 need(shared.length<=32,'Too many shared strings');
 const sheet=xml('xl/'+matching[0]['@Target']).worksheet,data=list(sheet?.sheetData?.row),cells=new Map(),rowIds=[];
 need(data.length>=4&&data.length<=MAX_MONTHS+3,'Missing or excessive worksheet rows');
 for(const row of data){
  need(/^[1-9]\d{0,2}$/.test(row['@r']||'')&&!rowIds.includes(Number(row['@r'])),'Duplicate or invalid row');
  rowIds.push(Number(row['@r']));
  for(const c of list(row.c)){
   const ref=c['@r'];need(/^[A-E][1-9]\d{0,2}$/.test(ref||'')&&ref.slice(1)===row['@r']&&!cells.has(ref),'Unexpected or duplicate cell');
   let value;
   if(c['@t']==='s'){need(typeof c.v==='string'&&/^(?:0|[1-9]\d*)$/.test(c.v)&&Number(c.v)<shared.length,'Invalid shared-string index');value=shared[Number(c.v)];}
   else{need(c['@t']==='n'&&typeof c.v==='string'&&/^-?(?:0|[1-9]\d*)$/.test(c.v),'Missing, marked or unsupported numeric cell');value=Number(c.v);need(Number.isSafeInteger(value),'Unsafe integer cell');}
   cells.set(ref,value);
  }
 }
 need(rowIds.every((r,i)=>r===i+1),'Reordered or missing worksheet rows');
 const ending=months[Number(anchor.latest_reference_month.slice(5))-1]+' '+anchor.latest_reference_month.slice(0,4);
 const expectedTitle=figure===1?`Figure 1: Renewable generation as a proportion of gross final electricity consumption between December 2018 and ${ending}`:`Figure 3: Volume generated and consumed - Rolling 12 month (GWh) between December 2018 and ${ending}`;
 const headers=figure===1?['Date','Renewable generation as a proportion of gross final electricity consumption (rolling 12 month basis)','Renewable generation as a proportion of gross final electricity consumption (monthly basis)']:['Date','Total consumption (GWh)','Renewable Generation (GWh)','Non Renewable Generation (GWh)','Net Imports (GWh)'];
 need(cells.get('A1')===expectedTitle&&cells.get('A2')==='Source: '+title&&headers.every((name,i)=>cells.get(String.fromCharCode(65+i)+'3')===name),'Workbook title, denominator, unit or column meaning changed');
 need(cells.size===2+headers.length*(data.length-2),'Unexpected or incomplete worksheet columns');
 const monthly=[];
 for(let r=4;r<=data.length;r++){
  const serial=cells.get('A'+r);need(Number.isSafeInteger(serial)&&serial>0,'Invalid Excel date serial');
  const date=new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10),month=date.slice(0,7);
  const expected=new Date(Date.UTC(2018,11+monthly.length,1)).toISOString().slice(0,10);
  need(date===expected,'Duplicate, reordered, missing or non-month-start period');
  const values=headers.slice(1).map((_,i)=>cells.get(String.fromCharCode(66+i)+r));
  need(values.every(Number.isSafeInteger)&&values.every((v,i)=>figure===3&&i===3||v>=0)&&!(figure===3&&values[0]<=0),'Missing or invalid selected measure');
  monthly.push({month,values,row:r});
 }
 need(monthly.at(-1).month===anchor.latest_reference_month,'Latest workbook month differs from current report');
 return {title:expectedTitle,monthly};
}
function exportsFrom(html,anchor){
 const results={};
 for(const match of html.matchAll(/<a\b([^>]*\bhref="data:application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet;base64,([A-Za-z0-9+/=]+)"[^>]*)>([^<]+)<\/a>/g)){
  const download=/\bdownload="([^"]+)"/.exec(match[1]),label=plain(match[3]);
  for(const figure of [1,3])if(download?.[1]===`ecrg-figure-${figure}-${anchor.publication_month}.xlsx`){
   need(!results[figure]&&new RegExp(`^Figure ${figure}\\.XLSX \\(\\d+kB\\)$`).test(label),'Ambiguous or mislabeled figure export');
   const encoded=match[2];need(encoded.length<=Math.ceil(ARCHIVE_LIMIT/3)*4&&encoded.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(encoded),'Invalid or oversized embedded base64');
   const raw=atob(encoded),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));need(btoa(raw)===encoded,'Noncanonical embedded base64');
   results[figure]={bytes,download:download[1]};
  }
 }
 need(results[1]&&results[3],'Required current Figure 1 and Figure 3 exports missing');return results;
}
function numerical(values){
 need(Array.isArray(values)&&values.length===5&&values.every(Number.isSafeInteger),'Five explicit integer observations required');
 const [share,gfec,renewable,nonrenewable,imports]=values;
 need(share>=0&&gfec>0&&renewable>=0&&nonrenewable>=0,'Invalid nonnegative measure or GFEC denominator');
 need(Math.abs(gfec-renewable-nonrenewable-imports)<=2,'Rounded electricity balance does not reconcile');
 need(Math.abs(100*renewable/gfec-share)<=0.5+1e-10,'Renewable share uses an incompatible denominator or rounding');
}
function build(anchor,values,history_month_count,provenance=[]){
 numerical(values);const definitions=niEnergyDefinitions(),{period,period_start,period_end,publication_date,publication_period,latest_reference_month}=anchor;
 const rows=definitions.map((definition,i)=>({measure_id:definition.id,value:values[i],value_state:'observed',period,period_start,period_end,geography:'Northern Ireland',unit:definition.unit,publication_date,revision_status,methodology,source_url:NI_ENERGY_URL}));
 return {status:'ok',geography:'Northern Ireland',period,period_start,period_end,publication_date,rows,definitions,
  metadata:{count:5,publication_period,latest_reference_month,history_first_month:'2018-12',history_month_count,report_anchor:{publication_date,period_start,period_end,latest_reference_month},methodology,revision_status},
  publisher,licence,licence_url,source_url:NI_ENERGY_URL,limitations,published_at:null,publisher_updated_at:null,next_expected_update:null,provenance};
}
export function parseNiEnergyReport(html,{retrieved_at}={}){
 need(typeof html==='string'&&html.length<=NI_ENERGY_LIMIT&&new TextEncoder().encode(html).length<=NI_ENERGY_LIMIT,'Report exceeds bounded input');
 const anchor=metadata(html,retrieved_at),exports=exportsFrom(html,anchor),share=workbook(exports[1].bytes,1,anchor),balance=workbook(exports[3].bytes,3,anchor);
 need(share.monthly.length===balance.monthly.length,'Figure date coverage differs');
 return build(anchor,[share.monthly.at(-1).values[0],...balance.monthly.at(-1).values],share.monthly.length);
}
function validate(value,options){
 need(object(value)&&Array.isArray(value.rows)&&value.rows.length===5&&object(value.metadata),'Incomplete native representation');
 const a=value.metadata.report_anchor;need(object(a)&&validDate(a.publication_date),'Missing publication anchor');
 const w=windowFor(a.latest_reference_month);need(a.period_start===w.period_start&&a.period_end===w.period_end&&w.period_end<a.publication_date,'Invalid publication window anchor');
 const p=value.metadata.publication_period,expectedPeriod=months[Number(w.period_start.slice(5,7))-1]+' '+w.period_start.slice(0,4)+' to '+months[Number(w.period_end.slice(5,7))-1]+' '+w.period_end.slice(0,4);
 need(p===expectedPeriod,'Native publication label differs');
 const historyCount=(Number(a.latest_reference_month.slice(0,4))-2018)*12+Number(a.latest_reference_month.slice(5))-12+1;
 need(historyCount>0&&historyCount<=MAX_MONTHS&&value.metadata.history_month_count===historyCount,'Native history/date coverage changed');
 if(options!==undefined)need(instant(options?.retrieved_at)&&a.publication_date<=options.retrieved_at.slice(0,10),'Missing, invalid or earlier public acquisition clock');
 need(Array.isArray(value.provenance)&&[0,3].includes(value.provenance.length),'Invalid native provenance coverage');
 const roles=new Set();
 for(const p of value.provenance){
  need(object(p)&&['report','figure_1','figure_3'].includes(p.role)&&!roles.has(p.role)&&p.url===NI_ENERGY_URL&&instant(p.retrieved_at)&&p.retrieved_at.slice(0,10)>=a.publication_date&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=(p.role==='report'?NI_ENERGY_LIMIT:ARCHIVE_LIMIT)&&typeof p.sha256==='string'&&/^[a-f0-9]{64}$/.test(p.sha256),'Invalid acquisition provenance');
  roles.add(p.role);need(Object.keys(p).sort().join(',')==='bytes,retrieved_at,role,sha256,url','Unexpected acquisition fields');
 }
 const expected=build({...w,...a,publication_period:p},value.rows.map(r=>r.value),historyCount,value.provenance);
 return same(value,expected);
}
export function validateNiEnergyRepresentation(value,options){try{return validate(value,options);}catch{return false;}}
export function niEnergyObservationRows(value){need(validateNiEnergyRepresentation(value),'Native representation validation failed');return value.rows;}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
export async function readNiEnergy({fetcher=fetchOfficial,now=()=>new Date().toISOString()}={}){
 const retrieved_at=now();need(instant(retrieved_at),'Invalid acquisition clock');
 const response=await fetcher(NI_ENERGY_URL,{headers:{accept:'text/html'},signal:AbortSignal.timeout(20000)});
 need(response.ok,'Report returned HTTP '+response.status);need(!response.url||response.url===NI_ENERGY_URL,'Unexpected report redirect');
 const length=response.headers.get('content-length');need(!length||/^\d+$/.test(length)&&Number(length)<=NI_ENERGY_LIMIT,'Declared report exceeds bound');
 need(response.body,'Missing report body');const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;need(size<=NI_ENERGY_LIMIT,'Report stream exceeds bound');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes),native=parseNiEnergyReport(html,{retrieved_at}),anchor=metadata(html,retrieved_at),exports=exportsFrom(html,anchor);
 native.provenance=await Promise.all([['report',bytes],['figure_1',exports[1].bytes],['figure_3',exports[3].bytes]].map(async([role,input])=>({role,url:NI_ENERGY_URL,retrieved_at,bytes:input.length,sha256:await digest(input)})));
 need(validateNiEnergyRepresentation(native,{retrieved_at}),'Acquired representation failed semantic validation');return native;
}
