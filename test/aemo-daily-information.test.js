import test from 'node:test';
import assert from 'node:assert/strict';
import {aemoDailyBundleDefinitions} from '../lib/aemo-daily-bundles.js';
import {catalogue,measuresFor,validateSelection,INFORMATION_SCHEMA} from '../lib/information.js';
import {INVENTORY} from '../lib/inventory.js';
import {isGapSource,gapDefinitions,gapCells,validateGapRepresentation} from '../lib/gap-information.js';

// The original combined-candidate interface tests remain byte-identical under
// cqc-only/historical/. Current tests verify the public held boundary instead.
test('AEMO daily candidate definitions remain available offline without public activation',()=>{
 const definitions=aemoDailyBundleDefinitions();
 assert.equal(definitions.length,10);
 assert.deepEqual([...new Set(definitions.map(d=>d.dimensions.region))],['SA1','VIC1']);
 assert.equal(INVENTORY.australia.some(x=>x[0]==='grid_day'),false);
 assert.equal(INVENTORY.australia.some(x=>x[0]==='grid'),true);
 assert.equal(isGapSource('australia','grid_day'),false);
 assert.equal(gapDefinitions('australia','grid_day'),null);
 assert.equal(gapCells('australia','grid_day',{},{}),null);
 assert.equal(validateGapRepresentation('australia','grid_day',{},{}),false);
 assert.deepEqual(measuresFor('australia','grid_day'),[]);
});

test('active catalogue, schema and selectors refuse the held AEMO daily candidate',()=>{
 assert.equal(catalogue('australia').sources.some(s=>s.key==='grid_day'),false);
 assert.equal(INFORMATION_SCHEMA.$defs.aemoDailyNative,undefined);
 assert.equal(Object.keys(INFORMATION_SCHEMA.$defs).some(k=>k.startsWith('aemoDaily')),false);
 for(const path of ['/australia.json','/morning.json']){
  for(const query of ['source=grid_day','source=grid_day&measure=SA1.mean','source=grid_day&measure=VIC1.mean&observation=2026-10-20']){
   const refusal=validateSelection(new URL('https://morningrows.com'+path+'?'+query));
   assert.equal(refusal.status,404);assert.equal(refusal.code,'unknown_source');
  }
 }
 assert.ok(INFORMATION_SCHEMA.$defs.remainingCqcNative,'CQC remains explicitly described');
 assert.ok(INFORMATION_SCHEMA.$defs.remainingNiNative,'Accepted NI remains explicitly described');
});
