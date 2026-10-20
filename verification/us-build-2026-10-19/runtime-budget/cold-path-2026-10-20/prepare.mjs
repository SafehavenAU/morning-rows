// Local diagnostics only. Generated fixture modules and bundles stay outside the checkout.
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,relative,sep,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export const here = new URL('./',import.meta.url);
export const root = new URL('../../../../',import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function fixtures() {
  return {
    index: readFileSync(new URL('../serialization-experiment/inputs/publisher-index.html',here),'utf8'),
    table: readFileSync(new URL('../serialization-experiment/inputs/database-table.html',here),'utf8'),
  };
}
export function verifyManifest() {
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',here),'utf8'));
  for (const [name,digest] of Object.entries(manifest.files)) {
    assert.equal(sha(readFileSync(new URL(name,here))),digest,'Changed retained file: '+name);
  }
  for (const input of manifest.inputs) {
    assert.equal(sha(readFileSync(new URL(input.file,here))),input.sha256,'Changed retained publisher input: '+input.file);
  }
  return manifest;
}
export function prepare(directory) {
  verifyManifest();
  const output=resolve(directory);
  mkdirSync(output,{recursive:true});
  const checkout=realpathSync(fileURLToPath(root)),realOutput=realpathSync(output);
  const part=relative(checkout,realOutput);
  assert(part==='..'||part.startsWith('..'+sep),'Use an output directory outside the checkout');
  const {index,table}=fixtures();
  writeFileSync(join(output,'fixtures.mjs'),`export const index=${JSON.stringify(index)};\nexport const table=${JSON.stringify(table)};\n`);
  const fixtureUrl=join(output,'fixtures.mjs');
  const base=new URL('baseline/',here);
  for (const variant of ['baseline','fragments','table','combined']) {
    const fragment=variant==='fragments'||variant==='combined';
    const optimizedTable=variant==='table'||variant==='combined';
    const desk=fileURLToPath(new URL(fragment?'fragment-desk.mjs':'baseline/us-desk.js',here));
    const imports=`import {handleUsRequest} from ${JSON.stringify(desk)};
import {readUnitedStates,CPI_DEFINITION,CPI_URLS} from ${JSON.stringify(fileURLToPath(new URL('us-cpi.js',base)))};
import {readSections} from ${JSON.stringify(fileURLToPath(new URL('sources.js',base)))};
import {readUsCpiTable} from ${JSON.stringify(fileURLToPath(new URL('table-candidate.mjs',here)))};
import {index,table} from ${JSON.stringify(fixtureUrl)};
const fetcher=async url=>new Response(url.endsWith('home.htm')?index:table);
const read=${optimizedTable
  ? `async()=>({site:'https://morningrows.com',country:'United States',...await readSections({cpi:()=>readUsCpiTable({fetcher})},{cpi:{name:CPI_DEFINITION.publisher,source_url:CPI_URLS.data,licence:CPI_DEFINITION.licence}})})`
  : `()=>readUnitedStates({fetcher})`};
export default {async fetch(req){
  const u=new URL(req.url);
  if(u.pathname==='/ready')return new Response('ready');
  return handleUsRequest(new Request('https://morningrows.com'+u.pathname+u.search),{cache:null,read});
}};
`;
    writeFileSync(join(output,variant+'-worker.mjs'),imports);
  }
  return {output,variants:['baseline','fragments','table','combined'],baseline_revision:'bb41f961014febb46f9544676caebe9319feadc3'};
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  assert(process.argv[2],'Usage: node prepare.mjs /tmp/your-diagnostic-output');
  console.log(JSON.stringify(prepare(process.argv[2]),null,2));
}
