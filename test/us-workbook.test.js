import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {parseCpiWorkbook,selectCpiWorkbook,readUsCpiWorkbook,CPI_INDEX} from '../lib/us-cpi-workbook.js';
import {parseCpi} from '../lib/us-cpi.js';
const bytes=new Uint8Array(readFileSync(new URL('../verification/us-build-2026-10-19/workbook/historical-cpi-u-202609.xlsx',import.meta.url)));
const sheet='xl/worksheets/sheet1.xml',strings='xl/sharedStrings.xml';
const index='<li><a href="/cpi/tables/supplemental-files/historical-cpi-u-202609.xlsx">Historical CPI-U, September 2026 (XLSX)</a>(<a href="https://data.bls.gov/timeseries/CUUR0000SA0?years_option=all_years">database</a>)</li>';
const mutated=(file,from,to)=>{const files=unzipSync(bytes);const s=strFromU8(files[file]);assert.ok(s.includes(from));files[file]=strToU8(s.replace(from,to));return zipSync(files);};
test('workbook values and qualifications exactly reconcile with separate bulk specimens',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/us-cpi.json',import.meta.url))).files;
 assert.deepEqual(parseCpiWorkbook(bytes,'2026-09'),parseCpi(fixture));
});
test('latest official linked edition, exact paired series and origin are required',()=>{
 assert.equal(selectCpiWorkbook(index+index.replaceAll('202609','202608').replace('September','August')).period,'2026-09');
 for(const bad of [index+index,index.replace('CUUR0000SA0','CUSR0000SA0'),index.replace('href="/cpi','href="https://evil.example/cpi'),'<html>blocked</html>'])assert.throws(()=>selectCpiWorkbook(bad));
});
test('wrong dimensions, sheet, labels and unknown notes fail closed',()=>{
 for(const [part,from,to]of [[strings,'U.S. city average','California'],[strings,'All Urban Consumers','Urban Wage Earners'],[strings,'1982-84=100','2000=100'],[strings,'Jan.','Feb.'],[strings,'lapse in appropriations','suppression'],['xl/workbook.xml','name="Index values"','name="Other values"']])assert.throws(()=>parseCpiWorkbook(mutated(part,from,to),'2026-09'));
});
test('periods, coverage, formulas, duplicates, suppression and zero cannot pass',()=>{
 for(const edition of ['2026-08','2026-10','2027-01'])assert.throws(()=>parseCpiWorkbook(bytes,edition));
 for(const [from,to]of [['<c r="K119" s="7"><v>336.94</v></c>',''],['<v>336.94</v>','<v>0</v>'],['<v>336.94</v>','<f>1+1</f><v>336.94</v>'],['<v>336.94</v>','<v>suppressed</v>'],['<c r="K119"','<c r="J119"'],['<row r="119"','<row r="118"'],['<c r="L119" s="4" t="s"><v>130</v></c>','<c r="L119" s="7"><v>337</v></c>']])assert.throws(()=>parseCpiWorkbook(mutated(sheet,from,to),'2026-09'));
});
test('corrections survive rounding; missing is explicit and no reason is invented',()=>{
 const r=parseCpiWorkbook(mutated(sheet,'<v>336.94</v>','<v>336.941</v>'),'2026-09');assert.equal(r.rows.at(-1).value_text,'336.941');
 assert.throws(()=>parseCpiWorkbook(mutated(sheet,'<v>336.94</v>','<v>336.9405</v>'),'2026-09'),/invalid_index/);
 const missing=parseCpiWorkbook(mutated(sheet,'<c r="J119" s="7"><v>334.98</v></c>','<c r="J119" s="4" t="s"><v>130</v></c>'),'2026-09');assert.equal(missing.rows.at(-2).value_state,'missing');assert.deepEqual(missing.rows.at(-2).footnotes,[]);
 assert.throws(()=>parseCpiWorkbook(mutated(sheet,'<c r="L118" s="4" t="s"><v>130</v></c>','<c r="L118" s="7"><v>325</v></c>'),'2026-09'),/numeric_unavailable/);
});
test('actual workbook transport hashes original bytes and never falls back on failed newest edition',async()=>{
 const calls=[];const r=await readUsCpiWorkbook({fetcher:async url=>{calls.push(url);return new Response(url===CPI_INDEX?index:bytes);}});assert.equal(calls.length,2);assert.equal(r.provenance[1].sha256,'473d3f67308952760245ff65946457a92ebde2bad3d8ba9db1ede89c89222d35');
 const failed=[];await assert.rejects(()=>readUsCpiWorkbook({fetcher:async url=>{failed.push(url);return url===CPI_INDEX?new Response(index+index.replaceAll('202609','202610').replace('September','October')):new Response('gone',{status:404});}}),/HTTP 404/);assert.equal(failed.length,2);assert.match(failed[1],/202610/);
});
test('native ZIP reader checks corruption, truncation, external relationships and size bounds',async()=>{
 const {openCpiZip}=await import('../lib/cpi-zip.js');
 for(const b of [bytes.subarray(0,20),bytes.subarray(0,bytes.length-1),new Uint8Array(131073)])assert.throws(()=>openCpiZip(b));
 const corrupt=bytes.slice();const view=new DataView(corrupt.buffer);let at=0;while(at<corrupt.length-46){if(view.getUint32(at,true)===0x02014b50){const n=view.getUint16(at+28,true),name=new TextDecoder().decode(corrupt.subarray(at+46,at+46+n));if(name==='xl/sharedStrings.xml'){const local=view.getUint32(at+42,true);view.setUint32(at+16,0,true);view.setUint32(local+14,0,true);break;}}at++;}
 await assert.rejects(()=>openCpiZip(corrupt).read('xl/sharedStrings.xml'),/crc/);
 const external=mutated('xl/_rels/workbook.xml.rels','Target="worksheets/sheet1.xml"','Target="worksheets/sheet1.xml" TargetMode="External"');
 await assert.rejects(()=>readUsCpiWorkbook({fetcher:async url=>new Response(url===CPI_INDEX?index:external)}),/external_relationship/);
});
