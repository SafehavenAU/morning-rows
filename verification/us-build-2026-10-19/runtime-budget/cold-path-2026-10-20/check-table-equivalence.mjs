import assert from 'node:assert/strict';
import fs from 'node:fs';
import {handleUsRequest} from './baseline/us-desk.js';
import {CPI_DEFINITION,CPI_URLS,readUnitedStates} from './baseline/us-cpi.js';
import {readSections} from './baseline/sources.js';
import {parseCpiTable as original} from './baseline/us-cpi-table.js';
import {parseCpiTable as candidate,readUsCpiTable as candidateRead} from './table-candidate.mjs';
import {fixtures} from './prepare.mjs';
const {index,table}=fixtures();
const fixture=JSON.parse(fs.readFileSync(new URL('../../../../test/fixtures/us-cpi-table.json',import.meta.url),'utf8'));
const fetcher=async url=>new Response(url.endsWith('home.htm')?index:table);
const candidateReader=async()=>({site:'https://morningrows.com',country:'United States',...await readSections({cpi:()=>candidateRead({fetcher})},{cpi:{name:CPI_DEFINITION.publisher,source_url:CPI_URLS.data,licence:CPI_DEFINITION.licence}})});
const invoke=async read=>{const r=await handleUsRequest(new Request('https://morningrows.com/united-states.json?source=cpi&measure=CUUR0000SA0'),{read:async()=>{const body=await read();body.sources.cpi.fetched_at='2026-10-20T00:00:00Z';return body;},cache:null,now:()=>1792454400000});assert.equal(r.status,200);return{body:await r.text(),headers:[...r.headers]}};
assert.deepEqual(await invoke(()=>readUnitedStates({fetcher})),await invoke(candidateReader));
let checked=0;const outcome=fn=>{try{return{value:fn()}}catch{return{rejected:true}}};
const bodies=[table,fixture.table];
for(const html of bodies){
 const cases=[html,html+html,html.replaceAll('catalog0','CATALOG0'),html.replaceAll('table0','TABLE0'),html.replace('id="table0"','id="table1"'),html.replace('id="catalog0"','id="catalog1"'),html.replace('id="table0"','id="wrong" id="table0"'),html.replace('id="catalog0"','id="wrong" id="catalog0"'),html.replace('id="table0"','id="table0" id="catalog0"'),html.replace('id="catalog0"','id="catalog0" id="table0"'),'<table id="catalog0"></table>'+html,'<table id="table0"></table>'+html,html+'<table id="catalog0"></table>',html+'<table id="table0"></table>',html.replace(/<table\b/i,'<table id="table0"><table'),html.replace(/<\/table>/i,''),html.replace(/<\/table>/gi,'</table >'),'<!-- <table id="catalog0"></table> -->'+html,'<script>"<table id="table0"></table>"</script>'+html];
 for(const [caseIndex,value] of cases.entries()){const got=outcome(()=>candidate(value,'2026-09')),wanted=outcome(()=>original(value,'2026-09'));assert.deepEqual(got,wanted,'case '+caseIndex);checked++;}
}
console.log(JSON.stringify({route_body_headers_and_etag_equal:true,extra_structural_cases:checked}));
