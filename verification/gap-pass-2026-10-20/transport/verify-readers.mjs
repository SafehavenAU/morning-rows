#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {openWorkbook} from '../../../lib/workbook.js';
import {nzFleet,scottishTraffic} from '../../../lib/transport-observations.js';
const file=n=>new URL(n,import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const reference=JSON.parse(readFileSync(file('independent-report.json')));assert.equal(reference.pass,true);assert.equal(reference.observations_compared,12);
const now=new Date(),nzBook=openWorkbook(readFileSync(file('original/nz-fleet.xlsx'))),scotBook=openWorkbook(readFileSync(file('original/scotland-traffic.xlsx')));
const nz=nzFleet(nzBook,now),scot=scottishTraffic(scotBook,now),comparisons=[];
for(const [name,output,expected,category] of [['new_zealand',nz,reference.new_zealand.rows,'category'],['scotland',scot,reference.scotland.rows,'road_type']]){
 assert.equal(output.rows.length,expected.length);assert.equal(output.period,'2024');
 for(const e of expected){const rows=output.rows.filter(r=>r[category]===(e.display_category||e.id));assert.equal(rows.length,1);const actual=rows[0];for(const key of ['value','unit','geography','period'])assert.equal(actual[key],e[key],`${name} ${e.id} ${key}`);comparisons.push({source:name,category:e.id,original_cell:e.cell,value:e.value,pass:true});}
}
assert.equal(scot.statistical_status,'Not Accredited Official Statistics');assert.ok(nz.note.includes('Vehicles exempt from licensing and restoration licences are excluded'));
const mutations=[];
function rejection(name,book,sheet,mutate,reader){const cells=new Map(book.sheet(sheet));mutate(cells);const fixture={sheet:n=>n===sheet?cells:book.sheet(n)};assert.throws(()=>reader(fixture,now),name);mutations.push({name,rejected:true});}
rejection('NZ wrong national workbook title',nzBook,'Contents',c=>c.set('A1','The Australian 2024 Vehicle Fleet : Data Spreadsheet'),nzFleet);
rejection('NZ wrong table/units label',nzBook,'1.1, 1.2',c=>c.set('B1','Fleet Composition (thousands of vehicles)'),nzFleet);
rejection('NZ missing latest count',nzBook,'1.1, 1.2',c=>c.set('B27',null),nzFleet);
rejection('NZ suppressed count',nzBook,'1.1, 1.2',c=>c.set('C27','..'),nzFleet);
rejection('NZ duplicate latest period',nzBook,'1.1, 1.2',c=>c.set('A28',2024),nzFleet);
rejection('NZ new unreviewed edition',nzBook,'1.1, 1.2',c=>c.set('A27',2025),nzFleet);
rejection('Scotland wrong units',scotBook,'T5.1',c=>c.set('A1','Table 5.1 Traffic by road class and type (million miles)'),scottishTraffic);
rejection('Scotland changed statistical status',scotBook,'T5.1',c=>c.set('A4','Source: Department for Transport - Accredited Official Statistics'),scottishTraffic);
rejection('Scotland missing latest count',scotBook,'T5.1',c=>c.set('AE6',null),scottishTraffic);
rejection('Scotland suppressed estimate',scotBook,'T5.1',c=>c.set('AE15','..'),scottishTraffic);
rejection('Scotland duplicate latest period',scotBook,'T5.1',c=>c.set('AF5','2024'),scottishTraffic);
rejection('Scotland new unreviewed edition',scotBook,'T5.1',c=>c.set('AE5','2025'),scottishTraffic);
const result={pass:true,passed:true,verified_at:now.toISOString(),method:'Actual existing JavaScript readers decode retained original workbook bytes offline and reconcile all12 cells with independently extracted Python XML reference.',observations_compared:comparisons.length,negative_cases:mutations.length,reference_sha256:hash(readFileSync(file('independent-report.json'))),runtime_source_hashes:{'lib/transport-observations.js':hash(readFileSync(file('../../../lib/transport-observations.js'))),'lib/workbook.js':hash(readFileSync(file('../../../lib/workbook.js')))},comparisons,mutations,native:{new_zealand:nz,scotland:scot},limits:'No live desk, production identity, deployment or scheduled monitoring acceptance is claimed. Python and JS decode the same original workbooks; independently edited Scotland chapter corroborates rounded values.'};
writeFileSync(file('reader-comparison.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,observations_compared:comparisons.length,negative_cases:mutations.length}));
