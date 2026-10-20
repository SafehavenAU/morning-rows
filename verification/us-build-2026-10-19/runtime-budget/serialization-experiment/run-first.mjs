import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {makeCandidate} from './prepare.mjs';
const generated=makeCandidate();
try{
 const out=[];
 for(let i=0;i<8;i++)for(const label of i%2?['candidate','original']:['original','candidate']){
  const args=[fileURLToPath(new URL('first.mjs',import.meta.url)),label,generated.url,...(process.argv.includes('--warm-transport')?['--warm-transport']:[])];
  out.push(JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8'})));
 }
 console.log(JSON.stringify(out,null,2));
}finally{generated.remove();}
