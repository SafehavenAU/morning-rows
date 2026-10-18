import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCpi} from '../lib/us-cpi.js';
import {handleUsRequest} from '../lib/us-desk.js';
const files=JSON.parse(readFileSync(new URL('./fixtures/us-cpi.json',import.meta.url))).files;
const path='https://morningrows.com/united-states.json?source=cpi&measure=CUUR0000SA0';
function harness(){
 let clock=Date.parse('2026-10-17T12:00:00Z'),calls=0,failed=false;
 const values=new Map(),cache={match:async r=>values.get(r.url)?.clone(),put:async(r,v)=>{values.set(r.url,v.clone());}};
 const read=async()=>{calls++;return {site:'https://morningrows.com',country:'United States',cpi:failed?null:parseCpi(files),sources:{cpi:{status:failed?'error':'ok',fetched_at:new Date(clock).toISOString(),...(failed?{error:'BLS returned HTTP 429',http_status:429}:{})}}};};
 const run=(url=path,options={})=>handleUsRequest(new Request(url,options),{read,cache,now:()=>clock,cacheKey:'test-build'});
 return{run,calls:()=>calls,advance:ms=>{clock+=ms;},fail:()=>{failed=true;},recover:()=>{failed=false;},values};
}
test('all selectors and both domains reuse one successful fill; GET/HEAD conditional semantics agree',async()=>{
 const h=harness(),r=await h.run(),etag=r.headers.get('etag');assert.equal(r.status,200);assert.equal(h.calls(),1);
 const repeat=await h.run(path,{headers:{'If-None-Match':etag}});assert.equal(repeat.status,304);assert.equal(await repeat.text(),'');
 const head=await h.run(path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);
 assert.equal((await h.run(path,{method:'HEAD',headers:{'If-None-Match':etag}})).status,304);
 await h.run(path.replace('morningrows.com','www.morningrows.com')+'&observation=2025-10');await h.run('https://morningrows.com/united-states');assert.equal(h.calls(),1);
});
test('absolute one-hour expiry beats rewritten cache headers; unchanged re-fetch is 304',async()=>{
 const h=harness(),r=await h.run(),etag=r.headers.get('etag');
 for(const [key,value] of h.values){const copy=value.clone();copy.headers.set('Cache-Control','public, max-age=14400');h.values.set(key,copy);}
 h.advance(3599000);assert.equal((await h.run()).headers.get('cache-control'),'public, max-age=1');assert.equal(h.calls(),1);
 h.advance(1001);const expired=await h.run(path,{headers:{'If-None-Match':etag}});assert.equal(h.calls(),2);assert.equal(expired.status,304);
});
test('failed refresh and cached error never hide behind previous or failed ETags; recovery retries after 30s',async()=>{
 const h=harness(),r=await h.run(),etag=r.headers.get('etag');h.fail();h.advance(3600001);
 const fail=await h.run(path,{headers:{'If-None-Match':etag}});assert.equal(fail.status,503);assert.equal(fail.headers.get('cache-control'),'no-store');const errorTag=fail.headers.get('etag');assert.equal(h.calls(),2);
 assert.equal((await h.run(path,{headers:{'If-None-Match':errorTag}})).status,503);assert.equal(h.calls(),2);
 const full=await h.run('https://morningrows.com/united-states.json');assert.equal(full.status,200);assert.equal((await h.run('https://morningrows.com/united-states.json',{headers:{'If-None-Match':full.headers.get('etag')}})).status,200);
 h.recover();h.advance(30001);assert.equal((await h.run()).status,200);assert.equal(h.calls(),3);
});
test('unsupported requests and POST never fetch; unavailable exact month can return unchanged 304',async()=>{
 const h=harness();assert.equal((await h.run(path+'&unit=USD')).status,400);assert.equal((await h.run(path,{method:'POST'})).status,405);assert.equal(h.calls(),0);
 const unavailable=path+'&observation=2025-10',r=await h.run(unavailable);assert.equal(r.status,200);assert.equal((await r.clone().json()).observations[0].value_state,'unavailable');assert.equal((await h.run(unavailable,{headers:{'If-None-Match':r.headers.get('etag')}})).status,304);
});
