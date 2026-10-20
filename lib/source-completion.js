import {readSections} from './sources.js';

// New contracts bind response-byte provenance to a completed acquisition. Older
// source timestamps retain their established semantics.
export async function readSectionsWithCompletion(tasks,completionKeys,{now=()=>new Date().toISOString()}={}){
  const completed=new Map(),selected=new Set(completionKeys);
  const wrapped=Object.fromEntries(Object.entries(tasks).map(([key,read])=>[key,selected.has(key)?async()=>{
    try{return await read();}
    finally{completed.set(key,now());}
  }:read]));
  const result=await readSections(wrapped);
  for(const [key,at]of completed)result.sources[key].fetched_at=at;
  return result;
}
