import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ukCpi,readUkCpi,UK_CPI_URLS} from '../lib/uk-cpi.js';
import {readSections} from '../lib/sources.js';
const f=JSON.parse(await readFile(new URL('./fixtures/uk-cpi.json',import.meta.url)));
const now=new Date('2026-10-18T00:00:00Z');
const copy=()=>structuredClone(f);
test('ONS exact monthly join agrees with independently retained official bulletin',()=>{
 const r=ukCpi(f.index,f.rate,now);assert.equal(r.value,'143.6');assert.equal(r.year_change,'3.1');assert.equal(r.index,143.6);assert.equal(r.annual_rate,3.1);assert.equal(r.geography,'United Kingdom');assert.equal(r.reference_month,'2026-08');assert.match(f.reference.main_point,/\(CPI\) rose by 3\.1%/);assert.match(f.reference.table_1,/Aug 143\.4 3\.3 0\.5 143\.6 3\.1/);
});
for(const [name,mutate] of [
 ['mismatched latest months',s=>{s.rate.months.at(-1).date=s.rate.description.date='2026 JUL';}],
 ['wrong CPIH series',s=>s.index.description.cdid='L522'],
 ['wrong base',s=>s.index.description.title='CPI INDEX 00: ALL ITEMS 2025=100'],
 ['wrong rate unit',s=>s.rate.description.unit='index'],
 ['missing latest value',s=>s.index.months.at(-1).value=s.index.description.number=''],
 ['suppression must not become zero',s=>s.rate.months.at(-1).value=s.rate.description.number='[x]'],
 ['duplicate monthly coordinate',s=>s.index.months.push({...s.index.months.at(-1)})],
 ['metadata newer than returned rows',s=>s.index.description.date='2026 SEP'],
 ['wrong publication vintage',s=>s.rate.description.releaseDate='2026-09-14T23:00:00.000Z'],
 ['annual rate inconsistent with rounded levels',s=>s.rate.months.at(-1).value=s.rate.description.number='4.1'],
 ['missing base month',s=>s.index.months.shift()],
 ['annual rows are no substitute',s=>{s.index.years=s.index.months;s.index.months=[];}],
 ])test(`CPI rejects ${name}`,()=>{const s=copy();mutate(s);assert.throws(()=>ukCpi(s.index,s.rate,now));});
test('zero annual inflation is distinct from missing',()=>{const s=copy();s.index.months[0].value='143.6';s.rate.months.at(-1).value=s.rate.description.number='0.0';assert.equal(ukCpi(s.index,s.rate,now).annual_rate,0);});
test('HTTP 200 outage HTML fails only the selected source',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response('<html>outage</html>');
 try{const d=await readSections({price_index:readUkCpi,other:async()=>({value:9})});assert.equal(d.sources.price_index.status,'error');assert.equal(d.price_index,null);assert.equal(d.other.value,9);assert.equal(d.sources.other.status,'ok');}finally{globalThis.fetch=old;}
});
test('real reader consumes exact original endpoint shapes and rejects oversized payload',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async url=>Response.json(url===UK_CPI_URLS.D7BT?f.index:f.rate);
 try{assert.equal((await readUkCpi()).reference_month,'2026-08');globalThis.fetch=async()=>new Response('x'.repeat(1048577));await assert.rejects(readUkCpi(),/bounded read/);}finally{globalThis.fetch=old;}
});
