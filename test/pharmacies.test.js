import test from 'node:test';
import assert from 'node:assert/strict';
import { pharmacyResource, pharmacyObservations } from '../lib/pharmacies.js';
const now = new Date('2026-10-17T00:00:00Z');
const id = '2acd7cb9-7e15-40e0-bf36-593495a6e643';
const metadata = () => ({ success: true, result: { license_id: 'OGL-UK-3.0', resources: [{ id, name: 'PHARMACY_OPENCLOSE_202609' }] } });
const resource = () => pharmacyResource(metadata(), now);
const body = () => ({ success: true, result: { resource_id: id, total: 1, records: [{ DATE: 20260930, TOTAL_PHARMACIES: 10402, TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS: 9930, TOTAL_DISTANCE_SELLING_PHARMACIES: 472, TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_OPENED: 40, TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_CLOSED: 30, PHARMACIES_EXCLUDING_DISTANCE_SELLERS_NET_CHANGE: 10, DISTANCE_SELLERS_OPENED: 6, DISTANCE_SELLERS_CLOSED: 1, DISTANCE_SELLERS_NET_CHANGE: 5 }] } });
const read = b => pharmacyObservations(b, resource(), now);
test('pharmacy selection follows publication month and preserves stock/flow timing', () => {
 const m = metadata(); m.result.resources.push({id, name:'PHARMACY_OPENCLOSE_202608'});
 assert.equal(pharmacyResource(m, now).period, '2026-09');
 const p = read(body()); assert.equal(p.rows.length, 9); assert.equal(p.rows[0].value, 10402); assert.equal(p.rows[0].timing, 'month-end stock'); assert.equal(p.rows[3].timing, 'calendar-month flow'); assert.ok(p.rows.every(r => r.geography === 'England' && r.period === '2026-09'));
});
test('pharmacy metadata rejects duplicate releases, missing licence and future months', () => {
 for(const change of [m=>m.result.resources.push({...m.result.resources[0]}),m=>m.result.license_id='unknown',m=>m.result.resources[0].name='PHARMACY_OPENCLOSE_202610',m=>m.result.resources[0].name='PHARMACY_OPENCLOSE_202613']) {const m=metadata();change(m);assert.throws(()=>pharmacyResource(m,now));}
});
test('pharmacies reject partial responses, duplicate months, wrong release and API errors', () => {
 for(const change of [b=>b.success=false,b=>b.result.total=2,b=>b.result.resource_id='other',b=>{b.result.records.push({...b.result.records[0]});b.result.total=2},b=>b.result.records[0].DATE=20260831,b=>b.result.records[0].DATE=20260931,b=>b.result.records[0].DATE=20261031]) {const b=body();change(b);assert.throws(()=>read(b));}
});
test('suppressed pharmacy counts cannot become zero; true zero and negative net changes are valid', () => {
 for(const value of [null,'', '*', '0', -1, NaN, 1.5]) {const b=body();b.result.records[0].DISTANCE_SELLERS_OPENED=value;assert.throws(()=>read(b));}
 const b=body();b.result.records[0].DISTANCE_SELLERS_OPENED=0;b.result.records[0].DISTANCE_SELLERS_NET_CHANGE=-1;assert.equal(read(b).rows.at(-1).value,-1);
});
test('pharmacy totals and flows must reconcile', () => {
 for(const field of ['TOTAL_PHARMACIES','DISTANCE_SELLERS_NET_CHANGE','PHARMACIES_EXCLUDING_DISTANCE_SELLERS_NET_CHANGE']){const b=body();b.result.records[0][field]++;assert.throws(()=>read(b));}
});
