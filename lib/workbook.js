import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { SourceError } from './sources.js';
const requireValue = (ok, message) => { if (!ok) throw new SourceError(message); };
const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = value => typeof value === 'string' ? value : value?.['#text'] ?? '';
const richText = value => value?.t !== undefined ? text(value.t) : list(value?.r).map(r => text(r.t)).join('');
export async function workbookBytes(response, max = 1048576) {
 const reader = response.body.getReader(), chunks = []; let size = 0;
 try { while(true) { const {done,value}=await reader.read(); if(done)break; size+=value.byteLength; requireValue(size<=max,'Workbook exceeds download limit'); chunks.push(value); } }
 finally { await reader.cancel(); }
 const bytes = new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;} return bytes;
}
// Read only cached cell values from published XLSX files. Never evaluate formulas,
// follow external relationships or load macros. Limits apply before inflation.
export function openWorkbook(bytes) {
 requireValue(bytes instanceof Uint8Array && bytes.length <= 1048576, 'Invalid workbook input size');
 let size=0, entries=0; const names=new Set();
 const files=unzipSync(bytes,{filter(file){
  requireValue(++entries<=256 && !names.has(file.name), 'Duplicate or excessive workbook ZIP entries'); names.add(file.name);
  const wanted=/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(file.name);
  if(wanted){size+=file.originalSize;requireValue(file.originalSize<=4194304 && size<=8388608,'Workbook expanded data exceeds limit');}
  return wanted;
 }});
 const parse = path => {
  requireValue(files[path], 'Workbook part missing'); const xml=strFromU8(files[path]);
  requireValue(!/<!DOCTYPE|<!ENTITY/i.test(xml) && XMLValidator.validate(xml)===true,'Invalid workbook XML');
  return new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',parseTagValue:false,trimValues:false}).parse(xml);
 };
 const sheets=list(parse('xl/workbook.xml').workbook?.sheets?.sheet);
 const relations=list(parse('xl/_rels/workbook.xml.rels').Relationships?.Relationship);
 const strings=files['xl/sharedStrings.xml'] ? list(parse('xl/sharedStrings.xml').sst?.si).map(richText) : [];
 return { sheet(name) {
  const matches=sheets.filter(s=>s['@name']===name); requireValue(matches.length===1,'Workbook worksheet missing or ambiguous');
  const rel=relations.filter(r=>r['@Id']===matches[0]['@r:id']);
  requireValue(rel.length===1 && !rel[0]['@TargetMode'] && /\/worksheet$/.test(rel[0]['@Type']||''), 'Invalid worksheet relationship');
  const target=rel[0]['@Target']; requireValue(/^(?:\/xl\/)?worksheets\/sheet\d+\.xml$/.test(target||''),'Unexpected worksheet path');
  const data=parse(target.startsWith('/')?target.slice(1):'xl/'+target).worksheet?.sheetData;
  requireValue(data,'Worksheet cells missing'); const cells=new Map();
  for(const row of list(data.row)) for(const c of list(row.c)) {
   const ref=c['@r'];requireValue(/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(ref||'')&&!cells.has(ref),'Invalid or duplicate worksheet cell');
   let value=null;
   if(c['@t']==='s') {requireValue(/^\d+$/.test(c.v||'')&&Number(c.v)<strings.length,'Invalid shared string index');value=strings[Number(c.v)];}
   else if(c['@t']==='inlineStr') value=richText(c.is);
   else if(c['@t']==='str') value=text(c.v);
   else if(!c['@t']||c['@t']==='n') { if(typeof c.v==='string'&&/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(c.v)){value=Number(c.v);requireValue(Number.isFinite(value),'Non-finite workbook number');} }
   cells.set(ref,value);
  }
  return cells;
 }};
}
