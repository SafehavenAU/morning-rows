import {open,readFile,rename,mkdir,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fingerprint} from './monitor-contracts.js';
export function envelope(state,previousDigest=null){return {format:'morning-rows-checkpoint-v1',previous_digest:previousDigest,state,digest:fingerprint(state)};}
export function decodeCheckpoint(text){
 let e;try{e=JSON.parse(text);}catch{throw Error('Checkpoint is not JSON; refusing reset');}
 if(e.format!=='morning-rows-checkpoint-v1'||e.state?.schema_version!==1||e.digest!==fingerprint(e.state)||!Array.isArray(e.state.outbox)||!e.state.sources||Array.isArray(e.state.sources)||!e.state.incidents||Array.isArray(e.state.incidents)||!Array.isArray(e.state.runs)||!e.state.repairs||!Number.isSafeInteger(e.state.sequence)||!Number.isFinite(Date.parse(e.state.created_at))||new Set(e.state.outbox.map(x=>x.id)).size!==e.state.outbox.length)throw Error('Invalid/corrupt checkpoint; refusing reset');return e;
}
export async function loadCheckpoint(path){return decodeCheckpoint(await readFile(path,'utf8'));}
export async function saveCheckpoint(path,state,expectedDigest){
 // The caller holds the process lock; compare predecessor before atomic rename.
 let previous;try{previous=await loadCheckpoint(path);}catch(e){if(e.code!=='ENOENT')throw e;}
 if((previous?.digest||null)!==(expectedDigest||null))throw Error('Checkpoint predecessor changed; concurrent or stale writer');
 await mkdir(dirname(path),{recursive:true});const next=envelope(state,expectedDigest),temp=`${path}.${process.pid}.tmp`;
 const file=await open(temp,'wx',0o600);
 try{await file.writeFile(JSON.stringify(next)+'\n');await file.sync();}finally{await file.close();}
 await rename(temp,path);
 const dir=await open(dirname(path),'r');try{await dir.sync();}finally{await dir.close();}
 return next;
}
export async function withLock(path,run){
 await mkdir(dirname(path),{recursive:true});let lock;
 try{lock=await open(path+'.lock','wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Monitor lock exists; inspect owner before recovery, never silently steal');throw e;}
 try{await lock.writeFile(JSON.stringify({pid:process.pid,started_at:new Date().toISOString()}));await lock.sync();return await run();}finally{await lock.close();await unlink(path+'.lock');}
}
