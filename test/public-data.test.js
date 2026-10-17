import test from 'node:test';
import assert from 'node:assert/strict';
import { hospitalFromApi, readHospital, walesProjection, niChildhoodBmi, ukActs } from '../lib/public-data.js';
import { readSections } from '../lib/sources.js';

function hospitals() {
 const data = ['NSW','Vic','Qld','WA','SA','Tas','ACT','NT'].flatMap(code => ['MYH-RM0035','MYH-RM0036','MYH-RM0037','MYH-RM0038','MYH-RM0039'].map(measure => ({ reporting_unit_code: code, reporting_unit_name: code, reporting_unit_type_code:'S', reported_measure_code:measure, measure_code:'MYH0010', units_name:'percent', reporting_start_date:'2024-07-01', reporting_end_date:'2025-06-30', value:76 })));
 return {result:{data,pagination:{total_results_available:40,starting_result_index:1}},version_information:{date_uploaded:'2026-08-19T00:00:00'}};
}
test('hospital reader retains periods, zero percentages, suppression and caveats',()=>{
 const body=hospitals();body.result.data[0].value=0;body.result.data[1].value=null;body.result.data[1].caveat_footnotes='Value withheld';
 const r=hospitalFromApi(body);assert.equal(r.year,'2024-25');assert.equal(r.states.length,8);assert.equal(r.states[0].Resuscitation,0);
 assert.equal(r.states[0].Emergency,null);assert.equal(r.states[0].status,'degraded');assert.equal(r.states[0].notes[0].caveat,'Value withheld');
});
test('hospital reader rejects incomplete pagination, duplicate cells and wrong units',()=>{
 for(const change of [b=>b.result.pagination.total_results_available++,b=>b.result.data[1]=b.result.data[0],b=>b.result.data[0].units_name='patients']){
  const body=hospitals();change(body);assert.throws(()=>hospitalFromApi(body));
 }
});
test('hospital fetch requests JSON explicitly rather than relying on runtime defaults',async t=>{
 t.mock.method(globalThis,'fetch',async (url,options)=>{
  assert.equal(options.headers.accept,'application/json');assert.match(url,/reporting_unit_type_code=S/);
  return Response.json(hospitals());
 });
 assert.equal((await readHospital()).states.length,8);
});
test('hospital reader selects latest financial year and never fills missing cells from older years',()=>{
 const body=hospitals();body.result.data.push({...body.result.data[0],reporting_start_date:'2025-07-01',reporting_end_date:'2026-06-30'});body.result.pagination.total_results_available++;
 assert.throws(()=>hospitalFromApi(body),/missing or duplicate/);
});
const csv='Data values,Data description,Year,Area,Age,Sex,Notes\n3186581,Population projections,Mid-year 2024,Wales,All Ages,Persons,\n3195431,Population projections,Mid-year 2026,Wales,All Ages,Persons,\n4000000,Population projections,Mid-year 2049,Wales,All Ages,Persons,\n123,Population projections,Mid-year 2026,Wales,Age 1,Persons,\n';
test('Wales selects current-year all-ages projection, not the first row or end of horizon',()=>{
 const r=walesProjection(csv,2026);assert.equal(r.value,3195431);assert.equal(r.period,'Mid-year 2026');assert.equal(r.kind,'projection');
 assert.throws(()=>walesProjection(csv,2027),/Expected one/);
 assert.throws(()=>walesProjection(csv.replace('3195431','..'),2026),/suppressed/);
 assert.throws(()=>walesProjection(csv+'3195431,Population projections,Mid-year 2026,Wales,All Ages,Persons,\n',2026),/Expected one/);
});
function nisra(){
 const ids=['STATISTIC','TLIST(A1)','SEX','LGD2014'];
 const codes=[['P1BMIOb','P1BMIOwOb','Y8BMIOb','Y8BMIOwOb'],['2023/24','2024/25'],['1','All'],['local','N92000002']];
 const dimension=Object.fromEntries(ids.map((id,i)=>[id,{category:{index:codes[i],label:Object.fromEntries(codes[i].map(x=>[x,x]))}}]));
 dimension.STATISTIC.category.unit=Object.fromEntries(codes[0].map(x=>[x,{label:'%'}]));
 return {class:'dataset',extension:{matrix:'CHILDBMILGD',official:true,contact:{name:'Not published'}},id:ids,size:[4,2,2,2],dimension,value:Array.from({length:32},(_,i)=>i),updated:'2026-05-14T09:30:00Z'};
}
test('NISRA selects all-persons NI national cells at the latest academic year',()=>{
 const body=nisra();const r=niChildhoodBmi(body);assert.deepEqual(r.rows.map(x=>x.value),[7,15,23,31]);assert.equal(r.period,'2024/25');
 assert.ok(!JSON.stringify(r).includes('Not published'));
 body.dimension.SEX.category.index={'1':0,All:1};assert.deepEqual(niChildhoodBmi(body).rows.map(x=>x.value),[7,15,23,31]);
});
test('NISRA missing observations stay missing and malformed cubes fail',()=>{
 const body=nisra();body.value[7]=null;assert.equal(niChildhoodBmi(body).rows[0].status,'error');
 body.value.pop();assert.throws(()=>niChildhoodBmi(body),/Incomplete/);
 const wrong=nisra();wrong.dimension.LGD2014.category.index[1]='Other';assert.throws(()=>niChildhoodBmi(wrong),/aggregate/);
});
const atom='<feed xmlns="http://www.w3.org/2005/Atom"><updated>2026-10-17T00:00:00Z</updated><entry><id>http://www.legislation.gov.uk/id/ukpga/2026/1</id><title>Example &amp; Another Act</title><updated>2026-10-01T12:00:00Z</updated><author><name>Not published</name></author></entry></feed>';
test('Acts feed validates type, retains source dates and omits authors',()=>{
 const r=ukActs(atom);assert.equal(r.rows[0],'Example & Another Act');assert.equal(r.entries[0].updated,'2026-10-01T12:00:00Z');
 assert.ok(!JSON.stringify(r).includes('Not published'));
 assert.throws(()=>ukActs(atom.replace('/ukpga/','/asp/')),/Unexpected/);assert.throws(()=>ukActs(atom.slice(0,-5)),/Invalid/);
});
test('wrapped source errors retain the upstream HTTP status',async()=>{
 const r=await readSections({laws:async()=>({error:'Publisher unavailable',http_status:503})});assert.equal(r.sources.laws.http_status,503);
});
