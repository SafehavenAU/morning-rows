import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceError} from '../lib/sources.js';
import {readSectionsWithCompletion} from '../lib/source-completion.js';

test('source completion clocks follow parsing on success and failure while siblings survive',async t=>{
  t.mock.method(console,'warn',()=>{});
  let release;
  const waiting=new Promise(resolve=>{release=resolve;});
  const completed=[];
  const expected=['2030-01-01T00:00:01.000Z','2030-01-01T00:00:02.000Z'];
  const resultPromise=readSectionsWithCompletion({
    held:async()=>{await waiting;throw new SourceError('Publisher refused the bounded read',403);},
    accepted:async()=>({value:5}),
    sibling:async()=>({value:9}),
  },['held','accepted','absent'],{now:()=>{const at=expected[completed.length];completed.push(at);return at;}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(completed,[expected[0]],'Only the completed selected source has a completion clock');
  release();
  const result=await resultPromise;
  assert.deepEqual(result.accepted,{value:5});
  assert.deepEqual(result.sibling,{value:9});
  assert.equal(result.held,null);
  assert.equal(result.sources.accepted.status,'ok');
  assert.equal(result.sources.accepted.fetched_at,expected[0]);
  assert.deepEqual(result.sources.held,{status:'error',fetched_at:expected[1],error:'Publisher refused the bounded read',http_status:403});
  assert.equal(result.sources.sibling.status,'ok');
  assert.ok(Number.isFinite(Date.parse(result.sources.sibling.fetched_at)));
  assert.equal(expected.includes(result.sources.sibling.fetched_at),false,'Existing sibling timestamps keep their original semantics');
  assert.deepEqual(completed,expected);
});

test('completion timestamp applies to parser failure and degraded source without repairing either status',async t=>{
  t.mock.method(console,'warn',()=>{});
  const at='2030-01-02T00:00:00.000Z';
  const result=await readSectionsWithCompletion({
    invalid:async()=>{throw new SyntaxError('Malformed publisher response');},
    partial:async()=>({status:'degraded',rows:[{value:7}]}),
  },['invalid','partial'],{now:()=>at});
  assert.equal(result.invalid,null);
  assert.equal(result.sources.invalid.status,'error');
  assert.equal(result.sources.invalid.error,'Source response could not be read or parsed');
  assert.equal(result.sources.partial.status,'degraded');
  assert.deepEqual(result.partial.rows,[{value:7}]);
  assert.equal(result.sources.invalid.fetched_at,at);
  assert.equal(result.sources.partial.fetched_at,at);
});
