// Exercises only constructed transport locally. No publisher or Cloudflare access.
import {writeFileSync} from 'node:fs';
import preview from './preview.js';
import {cases} from './cases.mjs';
import {evaluate} from './evaluate.mjs';
const path=process.argv[2];if(!path||process.argv.length!==3)throw Error('Fresh report path required');
const checks=[];
for(const test of cases){const response=await preview.fetch(new Request('https://local.invalid/fixture',{method:'POST',body:JSON.stringify(test.payload)}));const value=await response.json(),result=evaluate(value,test);checks.push({case:test.name,status:response.status,...result});if(!result.pass)console.log(JSON.stringify(checks.at(-1)));}
const report={kind:'Local constructed harness control; no HTTP',pass:checks.every(x=>x.pass),cases:checks.length,checks};writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:report.pass,cases:checks.length}));if(!report.pass)process.exitCode=1;
