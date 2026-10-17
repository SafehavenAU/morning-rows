import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
import {openWorkbook,workbookBytes} from '../lib/workbook.js';
import {nzFleet,scottishTraffic} from '../lib/transport-observations.js';
const now=new Date('2026-10-17T00:00:00Z');
const fixture=n=>JSON.parse(readFileSync(new URL(`./fixtures/${n}-transport.json`,import.meta.url)));
const book=data=>({sheet:name=>new Map(Object.entries(data[name]))});
test('NZ fleet is national, dated, complete and reconciles overlapping totals',()=>{const p=nzFleet(book(fixture('nz')),now);assert.equal(p.period,'2024');assert.equal(p.rows.length,8);assert.equal(p.rows.find(r=>r.category==='Total').value,4745099);assert.ok(p.rows.every(r=>r.geography==='New Zealand'&&r.unit==='vehicles'));});
test('NZ rejects incorrect categories, missing counts, wrong vintage and non-reconciling totals',()=>{for(const change of [d=>d['1.1, 1.2'].B2='Passengers',d=>d['1.1, 1.2'].B27=null,d=>d['1.1, 1.2'].H27++,d=>d['1.1, 1.2'].A27=2026,d=>d['1.1, 1.2'].A27=2023]){const d=fixture('nz');change(d);assert.throws(()=>nzFleet(book(d),now));}});
test('Scottish annual traffic preserves published unit, rounding and statistical status',()=>{const p=scottishTraffic(book(fixture('scot')),now);assert.equal(p.rows.at(-1).value,49313);assert.equal(p.period,'2024');assert.ok(p.rows.every(r=>r.unit==='million vehicle kilometres'&&r.geography==='Scotland'));assert.equal(p.statistical_status,'Not Accredited Official Statistics');});
test('Scottish traffic rejects missing latest values, changed units, duplicates and wrong totals',()=>{for(const change of [d=>d['T5.1'].AE23=null,d=>d['T5.1'].A1='miles',d=>d['T5.1'].AF5='2024',d=>d['T5.1'].AE23=0,d=>d['T5.1'].AE5='2026']){const d=fixture('scot');change(d);assert.throws(()=>scottishTraffic(book(d),now));}});
const files=()=>({'xl/workbook.xml':strToU8('<workbook><sheets><sheet name="Test" r:id="rId1"/></sheets></workbook>'),'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="rId1" Type="http://example/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),'xl/sharedStrings.xml':strToU8('<sst><si><r><t>Official </t></r><r><t>table</t></r></si></sst>'),'xl/worksheets/sheet1.xml':strToU8('<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>0</v></c><c r="C1"><f>1+1</f><v>2</v></c><c r="D1" t="e"><v>#N/A</v></c><c r="E1" t="inlineStr"><is><t>*</t></is></c></row></sheetData></worksheet>')});
test('XLSX reads shared strings and cached cells without converting errors or suppression to zero',()=>{const p=openWorkbook(zipSync(files())).sheet('Test');assert.equal(p.get('A1'),'Official table');assert.equal(p.get('B1'),0);assert.equal(p.get('C1'),2);assert.equal(p.get('D1'),null);assert.equal(p.get('E1'),'*');});
test('XLSX rejects corrupt archives, external worksheets, entities and excessive expansion',()=>{
 assert.throws(()=>openWorkbook(new Uint8Array([1,2,3])));
 for(const change of [f=>f['xl/_rels/workbook.xml.rels']=strToU8('<Relationships><Relationship Id="rId1" Type="http://example/worksheet" TargetMode="External" Target="https://example.com/worksheet"/></Relationships>'),f=>f['xl/worksheets/sheet1.xml']=strToU8('<!DOCTYPE test><worksheet/>'),f=>f['xl/worksheets/sheet1.xml']=new Uint8Array(4194305)]){const f=files();change(f);assert.throws(()=>openWorkbook(zipSync(f)).sheet('Test'));}
});
test('bounded workbook download rejects a body larger than its limit',async()=>{await assert.rejects(()=>workbookBytes(new Response(new Uint8Array(50)),49));assert.equal((await workbookBytes(new Response(new Uint8Array(49)),49)).length,49);});
