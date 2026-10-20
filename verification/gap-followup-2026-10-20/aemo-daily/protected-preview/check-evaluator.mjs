// Constructed mutations of a local actual-reader capture; no HTTP.
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import preview from './preview.js';
import {cases} from './cases.mjs';
import {evaluate} from './evaluate.mjs';
const output=process.argv[2];if(!output||process.argv.length!==3)throw Error('Fresh output required');
const test=cases[0],response=await preview.fetch(new Request('https://local.invalid/fixture',{method:'POST',body:JSON.stringify(test.payload)})),value=await response.json();assert.equal(evaluate(value,test).pass,true);
const mutations={
 'same cents wrong raw':v=>v.body.grid_day.regions[0].intervals[0].price_raw='30.031',
 'wrong interval':v=>v.body.grid_day.regions[0].intervals[0].period_end='2026-10-19T00:10:00+10:00',
 'missing cell':v=>v.body.grid_day.regions[0].intervals.pop(),
 'wrong geography':v=>v.body.grid_day.regions[0].geography='Australia',
 'wrong summary':v=>v.body.grid_day.regions[0].summary.mean++,
 'changed original bytes':v=>v.body.grid_day.provenance[1].sha256='0'.repeat(64),
 'oversize index provenance':v=>v.body.grid_day.provenance[0].bytes=131073,
 'future acquisition':v=>v.body.grid_day.provenance[0].retrieved_at='2026-10-21T00:00:00.000Z',
 'sibling lost':v=>v.body.sibling=null,
 'unexpected request':v=>v.calls.push({url:'https://other.invalid/',redirect:'manual',accept:'text/html'}),
};
const results=[];for(const [name,mutate]of Object.entries(mutations)){const bad=structuredClone(value);mutate(bad);const result=evaluate(bad,test);assert.equal(result.pass,false,name);results.push({name,refused:true});}
writeFileSync(output,JSON.stringify({pass:true,positive:1,negative:results.length,kind:'Constructed evaluation controls; no HTTP',results},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,positive:1,negative:results.length}));
