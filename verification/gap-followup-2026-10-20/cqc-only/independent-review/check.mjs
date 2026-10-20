import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {INVENTORY as oldInventory} from '/workspace/morning-rows-gap-followup/lib/inventory.js';
import {INVENTORY as candidateInventory} from '/workspace/morning-rows-cqc-cpu-repair/lib/inventory.js';
import {catalogue as oldCatalogue,measuresFor as oldMeasures} from '/workspace/morning-rows-gap-followup/lib/information.js';
import {catalogue,measuresFor,validateSelection,INFORMATION_SCHEMA} from '/workspace/morning-rows-cqc-cpu-repair/lib/information.js';
import {isGapSource,gapDefinitions} from '/workspace/morning-rows-cqc-cpu-repair/lib/gap-information.js';
import worker from '/workspace/morning-rows-cqc-cpu-repair/worker.js';
const root='/workspace/morning-rows-cqc-cpu-repair',base='791807e066c54884864db88c0c3f2f85c6d713c5',hash=x=>createHash('sha256').update(x).digest('hex');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:'/workspace/morning-rows-gap-followup',encoding:'utf8'}).trim(),base);
const preserved=[],controls=[];
for(const [desk,entries] of Object.entries(oldInventory)){
 const expected=desk==='england'?[['care_assessment_cohort','care_assessment_cohort','sources.care_assessment_cohort'],...entries]:entries;
 assert.deepEqual(candidateInventory[desk],expected,`${desk} inventory`);
 const oldCards=oldCatalogue(desk).sources,newCards=catalogue(desk).sources;
 for(const card of oldCards){assert.deepEqual(newCards.find(x=>x.key===card.key),card,`${desk}/${card.key} card`);assert.deepEqual(measuresFor(desk,card.key),oldMeasures(desk,card.key),`${desk}/${card.key} definitions`);preserved.push(`${desk}/${card.key}`);}
}
assert.equal(isGapSource('australia','grid_day'),false);
assert.equal(gapDefinitions('australia','grid_day'),null);
assert.equal(INFORMATION_SCHEMA.$defs.aemoDailyNative,undefined);
assert.equal(measuresFor('england','care_assessment_cohort').length,5);
assert.equal(hash(readFileSync(root+'/lib/cqc-pdf.js')),'7ee99d03615ee0cbfed4d7e8dff709f45dcde0839c410c2a56f0997563f61dbc');
let fetches=0;globalThis.fetch=async()=>{fetches++;throw Error('Unexpected network request in metadata/refusal control');};
globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};
for(const path of ['/australia.json','/morning.json','/australia'])for(const query of ['source=grid_day','source=grid_day&measure=SA1.mean','source=grid_day&measure=SA1.mean&observation=2026-10-20']){
 const status=path==='/australia'?400:404,error=path==='/australia'?'unsupported_query':'unknown_source';
 const selection=validateSelection(new URL('https://morningrows.com'+path+'?'+query));assert.equal(selection.status,status);assert.equal(selection.code,error);
 const response=await worker.fetch(new Request('https://morningrows.com'+path+'?'+query));assert.equal(response.status,status,path+'?'+query);const value=await response.json();assert.equal(value.error,error);controls.push({path:path+'?'+query,status,error});
}
const llms=await(await worker.fetch(new Request('https://morningrows.com/llms.txt'))).text();
assert.ok(!llms.includes('source=grid_day'));assert.match(llms,/care_assessment_cohort|five service-rating counts/);
const cat=await(await worker.fetch(new Request('https://morningrows.com/catalog.json?desk=australia'))).json();assert.ok(!cat.sources.some(s=>s.key==='grid_day'));assert.ok(cat.sources.some(s=>s.key==='grid'));
const cqc=await(await worker.fetch(new Request('https://morningrows.com/catalog.json?desk=england'))).json();assert.equal(cqc.sources.find(s=>s.key==='care_assessment_cohort').measure_count,5);
const keys=await(await worker.fetch(new Request('https://morningrows.com/keys.json'))).json();const aemo=keys.blocked.find(row=>row.source==='AEMO completed-day SA1/VIC1 monthly price CSV');assert.equal(aemo.status,406);assert.match(aemo.note,/No daily summaries are served|remain.*held|remains.*disconnected|not.*served/i);
assert.equal(fetches,0);
const report={pass:true,checked_at:new Date().toISOString(),accepted_base:base,existing_source_cards_and_definitions_preserved:preserved.length,preserved_sources:preserved,refusal_controls:controls,no_aemo_public_schema:true,cqc_measures:5,cqc_module_sha256:hash(readFileSync(root+'/lib/cqc-pdf.js')),network_requests:fetches,scope:'Independent offline candidate activation review only, no production acceptance'};
writeFileSync('/tmp/mr-cqc-only-independent-review/controls.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,existing_sources:preserved.length,refusals:controls.length,fetches}));
