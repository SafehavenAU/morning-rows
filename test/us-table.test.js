import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{parseCpiTable,readUsCpiTable}from'../lib/us-cpi-table.js';import{parseCpi}from'../lib/us-cpi.js';
const f=JSON.parse(readFileSync(new URL('./fixtures/us-cpi-table.json',import.meta.url))),bulk=JSON.parse(readFileSync(new URL('./fixtures/us-cpi.json',import.meta.url))).files;
test('official table matches all independently extracted values and definitions',()=>{assert.deepEqual(parseCpiTable(f.table,'2026-09'),parseCpi(bulk));});
test('wrong dimensions, headers, years, coverage and unavailable values are rejected',()=>{
 for(const [from,to]of [['U.S. city average','California'],['all urban consumers','all residents'],['1982-84=100','2000=100'],['Not Seasonally Adjusted','Seasonally Adjusted'],['CUUR0000SA0','CUSR0000SA0'],[' Jan ',' Feb '],['scope="row">2025','scope="row">2026'],['<TD>336.940</TD>',''],['336.940','0.000'],['336.940','<b>336.940</b>'],['-(X)','0.000(X)'],['-(X)','-(S)'],['lapse in appropriations','confidentiality'],['aria-describedby="catalog0"','aria-describedby="other"']])assert.throws(()=>parseCpiTable(f.table.replace(from,to),'2026-09'));
 for(const period of ['2026-08','2026-10','2027-09'])assert.throws(()=>parseCpiTable(f.table,period));
});
test('real corrections and missing values retain their exact state',()=>{
 assert.equal(parseCpiTable(f.table.replace('336.940','336.941'),'2026-09').rows.at(-1).value_text,'336.941');
 assert.equal(parseCpiTable(f.table.replace('334.980','&nbsp;'),'2026-09').rows.at(-2).value_state,'missing');
 const r=f.table.replace('336.940','336.941(R)').replace('<BR></TD>','<BR>R : Revised<BR></TD>');assert.equal(parseCpiTable(r,'2026-09').rows.at(-1).footnotes[0].text,'Revised');
});
test('actual table transport preserves original hashes and rejects stale table against newest edition',async()=>{
 const calls=[];const data=await readUsCpiTable({fetcher:async u=>{calls.push(u);return new Response(u.endsWith('home.htm')?f.index:f.table);}});assert.equal(calls.length,2);assert.equal(data.provenance.length,2);assert.equal(data.provenance[1].kind,'publisher_database_table');
 await assert.rejects(()=>readUsCpiTable({fetcher:async u=>new Response(u.endsWith('home.htm')?f.index.replaceAll('202609','202610'):f.table)}),/latest_missing/);
 await assert.rejects(()=>readUsCpiTable({fetcher:async()=>new Response('blocked',{status:429})}),/429/);
});
