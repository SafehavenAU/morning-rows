import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {NI_ENERGY_URL,NI_ENERGY_LIMIT,parseNiEnergyReport,readNiEnergy,niEnergyDefinitions,niEnergyObservationRows,validateNiEnergyRepresentation} from '../lib/ni-energy.js';
import {readSections} from '../lib/sources.js';
const root=new URL('../verification/remaining-gaps-2026-10-20/ni-energy/',import.meta.url);
const html=readFileSync(new URL('original/report.excerpt.html',root),'utf8');
const clock='2026-10-20T12:00:00.000Z';
const parse=(text=html,at=clock)=>parseNiEnergyReport(text,{retrieved_at:at});
const clone=structuredClone;
function archive(text,figure,edit){
 return text.replace(/(<a href="data:application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet;base64,)([A-Za-z0-9+/=]+)(" download="ecrg-figure-(\d)-[^"]+\.xlsx")/g,(all,prefix,encoded,suffix,id)=>{
  if(Number(id)!==figure)return all;
  const files=unzipSync(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));
  edit(files);const bytes=zipSync(files);return prefix+Buffer.from(bytes).toString('base64')+suffix;
 });
}
const editXml=(text,figure,file,edit)=>archive(text,figure,files=>{files[file]=strToU8(edit(strFromU8(files[file])));});
const sheet=(text,figure,edit)=>editXml(text,figure,'xl/worksheets/sheet1.xml',edit);
const shared=(text,figure,edit)=>editXml(text,figure,'xl/sharedStrings.xml',edit);
const numeric=(text,figure,ref,value)=>sheet(text,figure,s=>s.replace(new RegExp(`(<c r="${ref}"[^>]*><v>)[^<]+(</v></c>)`),'$1'+value+'$2'));
const read=(text=html,options={})=>readNiEnergy({now:()=>clock,fetcher:async(url,options)=>{assert.equal(url,NI_ENERGY_URL);assert.equal(options.headers.accept,'text/html');assert.ok(options.signal);return new Response(text);},...options});
test('five original publisher cells preserve the explicit rolling-year denominator and rounded residual',()=>{
 const v=parse();assert.deepEqual(v.rows.map(r=>[r.measure_id,r.value]),[['renewable_share_gfec',50],['gross_final_consumption',8865],['renewable_generation',4431],['non_renewable_generation',3855],['net_imports',578]]);
 assert.equal(v.period,'2025-07-01/2026-06-30');assert.equal(v.publication_date,'2026-09-03');assert.equal(v.metadata.history_month_count,91);
 assert.equal(v.published_at,null);assert.equal(v.publisher_updated_at,null);assert.equal(v.next_expected_update,null);
 assert.equal(niEnergyObservationRows(v).length,5);assert.deepEqual(v.definitions,niEnergyDefinitions());assert.ok(v.rows.every(r=>r.geography==='Northern Ireland'&&r.value_state==='observed'));
 assert.ok(v.definitions.every(d=>d.revision_policy.includes('Statistics in Development')&&d.methodology.includes('own-use')&&d.limitations.includes('not the renewable share of total generation')));
 assert.equal(validateNiEnergyRepresentation(v,{retrieved_at:clock}),true);
 assert.equal(validateNiEnergyRepresentation(v,{retrieved_at:'2027-01-01T00:00:00Z'}),true,'unchanged annual observations do not expire by age');
});
const metadataFaults={
 'wrong report country':s=>s.replace('Generation in Northern Ireland</h1>','Generation in Ireland</h1>'),
 'wrong coverage':s=>s.replace('Coverage: </strong>Northern Ireland','Coverage: </strong>United Kingdom'),
 'old methodology':s=>s.replace('changes to previous publications up to December 2025','old methodology only'),
 'missing own-use definition':s=>s.replace('Renewable generation includes all metered and own use','Renewable generation excludes own use'),
 'wrong denominator':s=>s.replace('plus imports of electricity minus exports of electricity','without imports or exports'),
 'unreviewed status':s=>s.replace('Official Statistics Status: </strong>Statistics in Development','Official Statistics Status: </strong>Final statistics'),
 'missing revision qualification':s=>s.replace('may be subject to revision','will never change'),
 'missing rounding basis':s=>s.replace('nearest whole percent','four decimals'),
 'wrong frequency':s=>s.replace('Frequency: </strong>Quarterly','Frequency: </strong>Monthly'),
 'mixed reported window':s=>s.replace('July 2025 to June 2026','June 2025 to June 2026'),
 'future release':s=>s.replace('03 September 2026','03 September 2027'),
 'impossible release':s=>s.replace('03 September 2026','31 September 2026'),
 'duplicate publication date':s=>s.replace('</body>','<strong>Publication date: </strong>03 September 2026</body>'),
 'missing Figure1':s=>s.replace('ecrg-figure-1-september-2026.xlsx','ecrg-figure-2-september-2026.xlsx'),
 'old export vintage':s=>s.replace('ecrg-figure-3-september-2026.xlsx','ecrg-figure-3-june-2026.xlsx'),
 'wrong displayed figure':s=>s.replace('>Figure 1.XLSX','>Figure 2.XLSX'),
 'duplicate selected export':s=>s.replace('</body>',s.match(/<a href="data:[^"]+" download="ecrg-figure-1[^"]+"[^>]*>[^<]+<\/a>/)[0]+'</body>'),
};
for(const [name,edit]of Object.entries(metadataFaults))test('refuses '+name,()=>assert.throws(()=>parse(edit(html)),{name:'SourceError'}));
const workbookFaults={
 'monthly column selected':s=>shared(s,1,x=>x.replace('(rolling 12 month basis)','(monthly basis)')),
 'wrong percentage denominator':s=>shared(s,1,x=>x.replaceAll('gross final electricity consumption','total generation')),
 'generation columns swapped':s=>shared(s,3,x=>x.replace('Renewable Generation (GWh)','Non Renewable Generation (GWh)')),
 'wrong volume unit':s=>shared(s,3,x=>x.replaceAll('(GWh)','(MWh)')),
 'wrong title ending month':s=>shared(s,3,x=>x.replace('June 2026','May 2026')),
 'invalid worksheet identity':s=>editXml(s,1,'xl/workbook.xml',x=>x.replace('name="Figure 1"','name="Figure 2"')),
 'alternate date epoch':s=>editXml(s,1,'xl/workbook.xml',x=>x.replace('date1904="false"','date1904="true"')),
 'hidden sheet':s=>editXml(s,3,'xl/workbook.xml',x=>x.replace('state="visible"','state="hidden"')),
 'external worksheet relationship':s=>editXml(s,1,'xl/_rels/workbook.xml.rels',x=>x.replace('Id="rId1"','Id="rId1" TargetMode="External"')),
 'missing latest value':s=>sheet(s,3,x=>x.replace(/<c r="E94"[^>]*>[\s\S]*?<\/c>/,'')),
 'suppression marker':s=>sheet(s,3,x=>x.replace(/(<c r="C94"[^>]*><v>)[^<]+/,'$1..')),
 'missing numeric value':s=>sheet(s,3,x=>x.replace(/(<c r="C94"[^>]*><v>)[^<]+/,'$1')),
 'numeric string type':s=>sheet(s,3,x=>x.replace(/(<c r="C94"[^>]*t=)"n"/,'$1"str"')),
 'formula with cached value':s=>sheet(s,3,x=>x.replace(/(<c r="C94"[^>]*>)/,'$1<f>SUM(C1:C93)</f>')),
 'duplicate cell':s=>sheet(s,3,x=>x.replace(/(<c r="C94"[^>]*>[\s\S]*?<\/c>)/,'$1$1')),
 'duplicate date':s=>numeric(s,3,'A94','46143'),
 'non-month-start date':s=>numeric(s,3,'A94','46175'),
 'mixed figure periods':s=>sheet(s,1,x=>x.replace(/<row r="94">[\s\S]*?<\/row>/,'')),
 'reordered dates':s=>numeric(numeric(s,3,'A93','46174'),3,'A94','46143'),
 'reordered rows':s=>sheet(s,1,x=>x.replace(/(<row r="93">[\s\S]*?<\/row>)(<row r="94">[\s\S]*?<\/row>)/,'$2$1')),
 'negative generation':s=>numeric(s,3,'C94','-1'),
 'zero consumption':s=>numeric(s,3,'B94','0'),
 'inconsistent component total':s=>numeric(s,3,'B94','9000'),
 'monthly47percent substitution':s=>numeric(s,1,'B94','47'),
 'generation53percent substitution':s=>numeric(s,1,'B94','53'),
 'unknown decimal precision':s=>numeric(s,3,'E94','578.1'),
 'unsafe integer':s=>numeric(s,3,'E94','9007199254740992'),
 'DOCTYPE':s=>editXml(s,1,'xl/sharedStrings.xml',x=>'<!DOCTYPE sst SYSTEM "https://example.invalid/data">'+x),
 'malformed XML':s=>editXml(s,1,'xl/sharedStrings.xml',x=>x.replace('</sst>','')),
 'oversized expansion':s=>archive(s,1,files=>{files['xl/worksheets/sheet2.xml']=strToU8('x'.repeat(262145));}),
 'macro member':s=>archive(s,1,files=>{files['xl/vbaProject.bin']=strToU8('unsupported');}),
 'too many ZIP entries':s=>archive(s,1,files=>{for(let i=0;i<33;i++)files[`extra${i}.txt`]=strToU8('extra');}),
};
for(const [name,edit]of Object.entries(workbookFaults))test('refuses workbook '+name,()=>assert.throws(()=>parse(edit(html))));
test('corrupt base64 and archive fail without alternate workbook or CSV fallback',()=>{
 assert.throws(()=>parse(html.replace(/(sheet;base64,)[A-Za-z0-9+/=]+/,'$1UEs=')));
 assert.throws(()=>parse(html.replace(/(sheet;base64,)[A-Za-z0-9+/=]+/,'$1%%%')));
});
test('negative net imports and renewable share over100 preserve legitimate signs and meaning',()=>{
 let s=numeric(html,1,'B94','120');
 for(const [ref,value]of [['B94','5000'],['C94','6000'],['D94','500'],['E94','-1500']])s=numeric(s,3,ref,value);
 const v=parse(s);assert.equal(v.rows[0].value,120);assert.equal(v.rows[4].value,-1500);
 assert.equal(validateNiEnergyRepresentation(v,{retrieved_at:clock}),true);
});
test('real zero is observed and does not arise from an empty cell',()=>{
 let s=numeric(html,1,'B94','0');
 for(const [ref,value]of [['B94','100'],['C94','0'],['D94','100'],['E94','0']])s=numeric(s,3,ref,value);
 const v=parse(s);assert.equal(v.rows[0].value,0);assert.equal(v.rows[2].value,0);assert.ok(v.rows.every(r=>r.value_state==='observed'));
});
test('public representation refuses statistical drift, truncation and missing clocks',()=>{
 const original=parse();
 const changes=[v=>v.geography='Ireland',v=>v.period_start='2025-06-01',v=>v.publication_date='2025-09-03',v=>v.rows.pop(),v=>v.rows.reverse(),v=>v.rows[0].value=53,v=>v.rows[0].unit='GWh',v=>v.rows[0].period='2026-06',v=>v.rows[1].value=null,v=>v.rows[1].value_state='missing',v=>v.rows[2].methodology='grid only',v=>v.definitions[0].unit='GWh',v=>v.metadata.history_month_count--,v=>v.metadata.report_anchor.latest_reference_month='2026-05',v=>v.published_at='2026-09-03T00:00:00Z',v=>v.provenance=[{role:'report'}]];
 for(const edit of changes){const v=clone(original);edit(v);assert.equal(validateNiEnergyRepresentation(v,{retrieved_at:clock}),false);}
 for(const bad of [undefined,null,'','bad','2026-02-30T00:00:00Z','2026-10-20','2026-09-02T12:00:00Z'])assert.equal(validateNiEnergyRepresentation(original,{retrieved_at:bad}),false);
});
test('actual injected reader retains complete report and workbook acquisition hashes',async()=>{
 const v=await read();assert.equal(validateNiEnergyRepresentation(v,{retrieved_at:clock}),true);
 assert.deepEqual(v.provenance.map(p=>p.role),['report','figure_1','figure_3']);
 assert.ok(v.provenance.every(p=>/^[a-f0-9]{64}$/.test(p.sha256)&&p.retrieved_at===clock&&p.bytes>0));
 const changed=await read(html+'\n');assert.notEqual(v.provenance[0].sha256,changed.provenance[0].sha256);assert.deepEqual(v.rows,changed.rows);
 assert.deepEqual(niEnergyObservationRows(v),v.rows);
});
for(const [name,response]of Object.entries({
 HTTP:()=>new Response('unavailable',{status:403}),
 timeout:()=>{throw new DOMException('timeout','TimeoutError');},
 UTF8:()=>new Response(new Uint8Array([255,254])),
 declared_size:()=>new Response(html,{headers:{'content-length':String(NI_ENERGY_LIMIT+1)}}),
 stream_size:()=>new Response('x'.repeat(NI_ENERGY_LIMIT+1)),
 redirect:()=>{const r=new Response(html);Object.defineProperty(r,'url',{value:'https://example.org/substitute'});return r;},
 HTML_outage:()=>new Response('<html>Service unavailable</html>'),
}))test('actual reader refuses '+name,async()=>assert.rejects(()=>read(html,{fetcher:async()=>response()})));
test('failed NI source cannot discard a successful sibling',async()=>{
 const body=await readSections({electricity_balance:()=>read(html,{fetcher:async()=>new Response('outage',{status:503})}),sibling:async()=>({value:7})});
 assert.equal(body.electricity_balance,null);assert.equal(body.sources.electricity_balance.status,'error');assert.equal(body.sibling.value,7);assert.equal(body.sources.sibling.status,'ok');
});
