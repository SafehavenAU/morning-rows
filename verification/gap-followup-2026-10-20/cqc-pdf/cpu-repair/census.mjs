// Offline instrumentation only. No counters or patched imports enter the Worker.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const [priorPath,currentPath,inputPath,outputPath]=process.argv.slice(2);
if(!outputPath)throw Error('Usage: node census.mjs PRIOR CURRENT ORIGINAL_PDF OUTPUT');
const hash=x=>createHash('sha256').update(x).digest('hex'),bytes=new Uint8Array(readFileSync(inputPath));
if(bytes.length!==7175967||hash(bytes)!=='61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef')throw Error('Exact original input required');
const results=[];
for(const [kind,path,needle,replacement]of [
 ['prior',priorPath,"need(Object.keys(obj).length<=1024,'Dictionary limit exceeded');","const count=Object.keys(obj).length;census.key_insertions++;census.bound_check_key_visits+=count;census.largest_dictionary=Math.max(census.largest_dictionary,count);need(count<=1024,'Dictionary limit exceeded');"],
 ['current',currentPath,"need(++keys<=1024,'Dictionary limit exceeded');","keys++;census.key_insertions++;census.bound_check_key_visits++;census.largest_dictionary=Math.max(census.largest_dictionary,keys);need(keys<=1024,'Dictionary limit exceeded');"]
]){
 const original=readFileSync(path,'utf8');
 if(original.split(needle).length!==2)throw Error('Instrumentation target is not unique');
 let code="export const census={key_insertions:0,bound_check_key_visits:0,largest_dictionary:0};\n"+original.replace(needle,replacement);
 code=code.replace("from 'fflate'",`from ${JSON.stringify(import.meta.resolve('fflate'))}`);
 for(const local of ['sources.js','cqc-cohort.js'])code=code.replace(`from './${local}'`,`from ${JSON.stringify(pathToFileURL(resolve(dirname(currentPath),local)).href)}`);
 const module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const native=module.parseCqcPdf(bytes,{retrieved_at:'2026-10-20T17:56:31.747Z'});
 results.push({kind,module_sha256:hash(original),instrumentation_sha256:hash(code),census:module.census,native_sha256:hash(JSON.stringify(native)),values:native.rows.map(r=>r.value)});
}
if(results[0].native_sha256!==results[1].native_sha256||results[0].census.key_insertions!==results[1].census.key_insertions)throw Error('Semantic or work-count mismatch');
writeFileSync(outputPath,JSON.stringify({kind:'Instrumented local original-PDF dictionary-work census, not runtime or Cloudflare evidence',recorded_at:new Date().toISOString(),input_bytes:bytes.length,input_sha256:hash(bytes),results},null,2)+'\n',{flag:'wx'});
