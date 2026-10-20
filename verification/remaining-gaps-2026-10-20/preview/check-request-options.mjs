import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {Miniflare,convertV4MiniflareOptions}=createRequire('/workspace/.morning-rows-tools/package.json')('miniflare');
const script=`export default{fetch(){const results=[];for(const redirect of ['error','manual'])try{new Request('https://example.invalid',{redirect});results.push({redirect,valid:true});}catch(e){results.push({redirect,valid:false,name:e.name,message:e.message});}return Response.json(results)}}`;
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-16',script}));
try{
  const rows=await(await mf.dispatchFetch('http://localhost/')).json();
  assert.equal(rows[0].redirect,'error');assert.equal(rows[0].valid,false);assert.equal(rows[0].name,'TypeError');
  assert.equal(rows[1].redirect,'manual');assert.equal(rows[1].valid,true);
  const report={pass:true,checked_at:new Date().toISOString(),environment:'Local installed workerd via Miniflare; no publisher HTTP',compatibility_date:'2026-10-16',script,rows,explanation:'The original SFC/CQC redirect:error option fails Request construction before network. Manual mode is supported; readers reject non-2xx status and changed URLs.'};
  await writeFile(new URL('request-options-workerd.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({pass:true,publisher_requests:0,rows}));
}finally{await mf.dispose();}
