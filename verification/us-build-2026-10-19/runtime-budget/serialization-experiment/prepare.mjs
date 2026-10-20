// Generate diagnostic modules outside the checkout. Never import this into the Worker.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export const root = new URL('../../../../',import.meta.url);
export const here = new URL('./',import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function checkInputs() {
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',here)));
 for(const [file,digest] of Object.entries(manifest.baseline_files)) assert.equal(sha(readFileSync(new URL(file,root))),digest,'Baseline changed: '+file);
 for(const input of manifest.inputs) assert.equal(sha(readFileSync(new URL(input.file,here))),input.sha256,'Input changed: '+input.file);
 return manifest;
}
export function makeCandidate() {
 checkInputs();
 const directory=mkdtempSync(join(tmpdir(),'mr-serialization-'));
 const rewriteImports=source=>source.replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL('lib/'+path.slice(2),root).href}'`);
 let information=rewriteImports(readFileSync(new URL('lib/information-v2.js',root),'utf8'));
 const imported='catalogue, digest, semantic',signature='export async function selectedUsResponse(body, selection) {';
 assert(information.includes(imported)&&information.includes(signature),'Prototype patch no longer matches');
 information=information.replace(imported,'catalogue, semantic').replace(signature,signature+'\n const digest=createDigest();');
 information=`import {digest,createDigest} from '${new URL('prototype.mjs',here).href}';\n`+information;
 writeFileSync(join(directory,'information-v2.mjs'),information);
 let desk=rewriteImports(readFileSync(new URL('lib/us-desk.js',root),'utf8'));
 desk=desk.replace(new URL('lib/information-v2.js',root).href,pathToFileURL(join(directory,'information-v2.mjs')).href);
 writeFileSync(join(directory,'us-desk.mjs'),desk);
 return {url:pathToFileURL(join(directory,'us-desk.mjs')).href,remove:()=>rmSync(directory,{recursive:true,force:true})};
}
export const fixtures=()=>({index:readFileSync(new URL('inputs/publisher-index.html',here),'utf8'),table:readFileSync(new URL('inputs/database-table.html',here),'utf8')});
