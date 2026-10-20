// Independent local fixture controls; no HTTP. Output must be new.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {AEMO_DAILY_INDEX,discoverAemoDailyBundles,parseAemoDailyBundles,readAemoDailyBundles,validateAemoDailyBundlesRepresentation} from '../../../../lib/aemo-daily-bundles.js';
const output=process.argv[2];if(!output||process.argv.length!==3)throw Error('FRESH_OUTPUT.json required');
const now='2026-10-20T12:30:00.000Z',base=new URL('../original/',import.meta.url);
const index=await readFile(new URL('directory-listing-excerpt.html',base),'utf8');
const selections=discoverAemoDailyBundles(index,{now});
const inputs=await Promise.all(selections.map(async s=>({url:s.url,data:new Uint8Array(await readFile(new URL(s.filename,base)))})));
const parsed=parseAemoDailyBundles(inputs,{now});assert.equal(validateAemoDailyBundlesRepresentation(parsed),true);
const checks=[];
for(const invalid of [undefined,null,{}, {now:undefined}]){assert.equal(validateAemoDailyBundlesRepresentation(parsed,invalid),false);checks.push({case:'Explicit invalid acquisition '+String(invalid),pass:true});}
for(const crossing of [9,10]){let clockCalls=0;const requests=[];
 const fetcher=async url=>{requests.push(url);if(url===AEMO_DAILY_INDEX)return new Response(index);const input=inputs.find(x=>x.url===url);assert.ok(input);return new Response(input.data);};
 await assert.rejects(readAemoDailyBundles({fetcher,now:()=>++clockCalls>=crossing?'2026-10-20T14:00:00.000Z':now}),/midnight/);assert.equal(requests.length,3);
 checks.push({case:crossing===9?'Post-parse/hash midnight':'Post-validation midnight',pass:true,clock_calls:clockCalls,requests:requests.length});
}
const moduleBytes=await readFile(new URL('../../../../lib/aemo-daily-bundles.js',import.meta.url));
await writeFile(output,JSON.stringify({pass:true,kind:'Independent local clock review; mocked transport only',module_sha256:createHash('sha256').update(moduleBytes).digest('hex'),checks},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,checks:checks.length,output}));
