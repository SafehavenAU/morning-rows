// Offline replay of retained bytes, transport records and independent numbers.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyCapture} from './support.mjs';
const [directory,output,revision,version,mode,...extra]=process.argv.slice(2);
if(!directory||!output||!/^[a-f0-9]{40}$/.test(revision||'')||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(version||'')||extra.length||(mode!==undefined&&mode!=='staged'))throw Error('CAPTURE OUTPUT REVISION VERSION [staged] required');
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const report=await verifyCapture(root,resolve(directory),{revision,version,staged:mode==='staged'});
await writeFile(resolve(output),JSON.stringify({kind:'Offline retained AEMO completed-day capture verification',verified_at:new Date().toISOString(),...report},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:report.pass,error:report.error,checks:report.checks?.length,output}));if(!report.pass)process.exitCode=1;
