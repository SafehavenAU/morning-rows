import test from 'node:test';
import assert from 'node:assert/strict';
import { readSections, readBounded, mapLimit, fetchOfficial } from '../lib/sources.js';
import worker, { readOnsNation, hasFailures } from '../worker.js';
test('retains successful and legitimately empty event feeds after a source failure', async () => {
 const result=await readSections({good:async()=>({value:0}),empty:async()=>[],bad:async()=>{throw Error('sensitive internal message');}});
 assert.equal(result.good.value,0);assert.deepEqual(result.empty,[]);assert.equal(result.bad,null);
 assert.equal(result.sources.bad.status,'error');assert.ok(!JSON.stringify(result).includes('sensitive'));
});
test('rejects oversized bodies instead of publishing partial data', async () => {
 await assert.rejects(readBounded(new Response('123456'),5),/bounded/);
 assert.equal(await readBounded(new Response('12345'),5),'12345');
});
test('a nested station failure degrades the section while retaining successful rows', async () => {
 const result = await readSections({ rivers: async () => [{ level: 0 }, { status: 'error', error: 'Station unavailable' }] });
 assert.equal(result.sources.rivers.status, 'degraded');
 assert.equal(result.rivers[0].level, 0);
});
test('bounds concurrent reads and preserves result order',async()=>{
 let active=0,peak=0;
 const result=await mapLimit([1,2,3,4,5],2,async x=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return x;});
 assert.equal(peak,2);assert.deepEqual(result,[1,2,3,4,5]);
});
test('upstream HTTP failures expose status without exposing request headers',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('no',{status:403}));
 await assert.rejects(fetchOfficial('https://example.org/data',{headers:{authorization:'private'}}),e=>e.status===403 && !e.message.includes('private'));
});
test('blocked ONS data leaves the nation holiday visible',async t=>{
 t.mock.method(globalThis,'fetch',async url=>url.includes('bank-holidays')?Response.json({scotland:{events:[{title:'Future holiday',date:'2099-01-01'}]}}):new Response('blocked',{status:403}));
 const result=await readOnsNation('Scotland','scotland','/population','/jobs','scotland');
 assert.equal(result.people,null);assert.equal(result.sources.people.http_status,403);
 assert.ok(result.next_holiday);assert.ok(!result.error);assert.ok(hasFailures(result));
});
test('health identity and unknown routes behave without upstream access',async()=>{
 const response=await worker.fetch(new Request('https://example.com/health.json'),{WORKER_VERSION:{id:'test-version'}});
 assert.equal((await response.json()).worker_version,'test-version');
 assert.match(response.headers.get('x-source-revision'),/^[0-9a-f]{40}$/);
 assert.equal((await worker.fetch(new Request('https://example.com/missing'))).status,404);
});
test('degraded desk uses short cache and ignores user cache-busting query',async t=>{
 const puts=[];globalThis.caches={default:{match:async()=>undefined,put:async(key,response)=>puts.push([key.url,response.headers.get('cache-control')])}};
 t.after(()=>{delete globalThis.caches;});
 t.mock.method(globalThis,'fetch',async url=>url.includes('bank-holidays')?Response.json({scotland:{events:[{title:'Future holiday',date:'2099-01-01'}]}}):new Response('blocked',{status:403}));
 const response=await worker.fetch(new Request('https://example.com/scotland.json?random=1'));
 assert.equal(response.headers.get('x-data-status'),'degraded');assert.equal(response.headers.get('cache-control'),'public, max-age=30');
 assert.match(puts[0][0],/\?release=[0-9a-f]{40}-[0-9a-f]{16}$/);assert.ok(!puts[0][0].includes('random'));
});
