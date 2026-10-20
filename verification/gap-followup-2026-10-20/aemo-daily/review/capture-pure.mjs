// Local fixture execution only; no HTTP and no Worker/resource acceptance.
// node capture-pure.mjs FRESH_CAPTURE.json
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseAemoDailyBundles} from '../../../../lib/aemo-daily-bundles.js';
const output=process.argv[2];if(!output||process.argv.length!==3)throw Error('FRESH_CAPTURE.json required');
const names=['PUBLIC_PRICES_202610180000_20261019040502.zip','PUBLIC_PRICES_202610190000_20261020040503.zip'];
const inputs=await Promise.all(names.map(async name=>({url:'https://nemweb.com.au/Reports/CURRENT/Public_Prices/'+name,data:new Uint8Array(await readFile(new URL('../original/'+name,import.meta.url)))})));
const body=JSON.stringify(parseAemoDailyBundles(inputs,{now:'2026-10-20T10:00:00.000Z'}));
await writeFile(output,body,{flag:'wx'});
console.log(JSON.stringify({kind:'Local pure parser fixture; no remote execution',output,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')}));
