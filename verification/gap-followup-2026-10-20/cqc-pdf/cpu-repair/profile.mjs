import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [modulePath,inputPath,outputPath,repeat='12']=process.argv.slice(2);
if(!modulePath||!inputPath||!outputPath)throw Error('Usage: node profile.mjs MODULE ORIGINAL_PDF OUTPUT [REPEATS]');
const source=readFileSync(modulePath),bytes=new Uint8Array(readFileSync(inputPath));
const hash=x=>createHash('sha256').update(x).digest('hex');
if(bytes.length!==7175967||hash(bytes)!=='61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef')throw Error('Exact original input required');
const {parseCqcPdf,openPdf,readCqcPdf}=await import(pathToFileURL(resolve(modulePath)));
const samples=[],iterations=Number(repeat),retrieved_at='2026-10-20T17:56:31.747Z';
if(!Number.isSafeInteger(iterations)||iterations<2||iterations>100)throw Error('Invalid repeat count');
let native;
for(let i=0;i<iterations;i++){
  const cpu=process.cpuUsage(),at=performance.now();
  native=parseCqcPdf(bytes,{retrieved_at});
  const elapsed=performance.now()-at,used=process.cpuUsage(cpu);
  if(JSON.stringify(native.rows.map(r=>r.value))!==JSON.stringify([125,809,2063,65,3062]))throw Error('Derived values changed');
  samples.push({sample:i+1,wall_ms:elapsed,user_cpu_ms:used.user/1000,system_cpu_ms:used.system/1000});
}
const cpu=process.cpuUsage(),at=performance.now();let reads=0;
const acquired=await readCqcPdf({now:()=>retrieved_at,fetcher:async()=>{reads++;return new Response(bytes,{headers:{'content-type':'application/pdf'}});}});
const acquisition={wall_ms:performance.now()-at,cpu:process.cpuUsage(cpu),local_response_reads:reads,values:acquired.rows.map(r=>r.value),provenance:acquired.provenance};
const pdf=openPdf(bytes);pdf.pages([187,188]);
writeFileSync(outputPath,JSON.stringify({kind:'Local Node exact-input profiling; not Cloudflare CPU or a publisher fetch',node:process.version,recorded_at:new Date().toISOString(),module_sha256:hash(source),input_sha256:hash(bytes),input_bytes:bytes.length,native_sha256:hash(JSON.stringify(native)),values:native.rows.map(r=>r.value),samples,local_acquisition:acquisition,page_tree_stats:pdf.stats},null,2)+'\n',{flag:'wx'});
