import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walesTax, insolvencyRelease, insolvencyFiles, companyInsolvencies } from '../lib/fiscal-observations.js';
import { readOnsNation } from '../worker.js';
const now = new Date('2026-10-17T00:00:00Z');
const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const tax = fixture('wra-tax.csv'), counts = fixture('insolvency.csv'), metadata = fixture('insolvency-metadata.csv');
const base = '/government/statistics/company-insolvencies-august-2026';
const collection = () => ({ links: { documents: [{ base_path: base }, { base_path: base.replace('august', 'july') }] } });
const publication = () => ({base_path:base, withdrawn_notice:{}, details:{attachments:[
 {title:'Long-Run Series in CSV Format - Company Insolvency Statistics August 2026',url:'https://assets.publishing.service.gov.uk/media/6aa95b092f29b388848184fd/Long-Run_Series_in_CSV_Format_-_Company_Insolvency_Statistics_August_2026.csv'},
 {title:'Metadata for Long-Run Series in CSV Format - Company Insolvency Statistics August 2026',url:'https://assets.publishing.service.gov.uk/media/6aaa9cbb086ce7c57b818596/Metadata_for_Long-Run_Series_in_CSV_Format_-_Company_Insolvency_Statistics_August_2026.csv'}
]}});
const release = () => insolvencyFiles(publication(), insolvencyRelease(collection(), now));
test('WRA keeps inclusive and restricted-detail-excluding totals distinct with financial year and units', () => {
 const r=walesTax(tax,now);
 assert.deepEqual(r.rows.map(r=>r.value),[371,370.8,294,76.8]);
 assert.equal(r.period_end,'2026-03-31');assert.equal(r.period_start,'2025-04-01');
 assert.ok(r.rows.every(r=>r.unit==='GBP million'&&r.geography==='Wales'&&r.period==='2025-26'));
 assert.match(r.note,/must not be added/);
});
test('WRA rejects suppressed, absent, duplicate, mismatched-unit and incomplete-year observations', () => {
 for(const bad of [tax.replace('371,','[x],'),tax.replace('371,',','),tax+tax.split('\n')[1]+'\n',tax.replaceAll('£ million','£ billion'),tax.replaceAll('2025-26','2026-27'),tax.replace('294,','194,')])assert.throws(()=>walesTax(bad,now));
});
test('insolvency discovery uses latest monthly release and only official CSV attachments', () => {
 const r=release();assert.equal(r.period,'2026-08');
 const c=collection();c.links.documents.reverse();assert.equal(insolvencyRelease(c,now).period,'2026-08');
 c.links.documents.find(d=>d.base_path===base).withdrawn=true;assert.equal(insolvencyRelease(c,now).period,'2026-07');
 for(const change of [p=>p.withdrawn_notice={explanation:'withdrawn'},p=>p.base_path='/different',p=>p.details.attachments.push(p.details.attachments[0]),p=>p.details.attachments[0].url='https://example.com/data.csv']){const p=publication();change(p);assert.throws(()=>insolvencyFiles(p,insolvencyRelease(collection(),now)));}
 const duplicate=collection();duplicate.links.documents.push({base_path:base});assert.throws(()=>insolvencyRelease(duplicate,now));
});
test('insolvency aggregates retain national scope, monthly period, genuine zero and unadjusted counts', () => {
 for(const [geography,expected] of [['Scotland',[73,35,30,8,0,0]],['Northern Ireland',[7,2,5,0,0,0]]]){
  const r=companyInsolvencies(counts,metadata,release(),geography,now);
  assert.deepEqual(r.rows.map(r=>r.value),expected);assert.equal(r.period,'2026-08');assert.equal(r.published,'2026-09-18');
  assert.ok(r.rows.every(row=>row.geography===geography&&row.period===r.period&&row.seasonally_adjusted===false));
 }
 assert.throws(()=>companyInsolvencies(counts,metadata,release(),'England',now));
});
test('insolvency rejects unavailable latest counts, non-reconciling totals, partial months and bad metadata', () => {
 for(const bad of [counts.replace('73,35','[x],35'),counts.replace('73,35','74,35'),counts.replace('73,35','73.5,35'),counts.replaceAll('2026-08','2026-07'),counts.trim().split('\n').slice(0,-1).join('\n')])assert.throws(()=>companyInsolvencies(bad,metadata,release(),'Scotland',now));
 for(const bad of [metadata.replace('Open Government Licence 3.0','unknown'),metadata.replace('Total company insolvencies,Scotland,N','Total company insolvencies,England,N'),metadata.replace('Total company insolvencies,Scotland,N','Total company insolvencies,Scotland,Y'),metadata.replace('18/09/2026','31/09/2026')])assert.throws(()=>companyInsolvencies(counts,bad,release(),'Scotland',now));
});
test('new insolvency failure preserves successful national sources',async t=>{
 t.mock.method(globalThis,'fetch',async url=>url.includes('bank-holidays')?Response.json({scotland:{events:[{title:'Holiday',date:'2099-01-01'}]}}):new Response('blocked',{status:503}));
 const desk=await readOnsNation('Scotland','scotland','/people','/jobs','scotland');
 assert.equal(desk.company_insolvencies,null);assert.equal(desk.sources.company_insolvencies.http_status,503);assert.ok(desk.next_holiday);
});
