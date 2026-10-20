// Diagnostic only. Request-local caller owns lifecycle.
function canonical(value, seen) {
 if (!value || typeof value !== 'object') return JSON.stringify(value);
 if (seen.has(value)) return seen.get(value);
 let result;
 if (Array.isArray(value)) {
  const entries=[];for(let i=0;i<value.length;i++)entries.push(canonical(value[i],seen)??'null');
  result='['+entries.join(',')+']';
 } else {
  let keys=Object.keys(value).sort();
  // Object.fromEntries + JSON.stringify enumerates array-index keys numerically.
  if(keys.some(k=>String(Number(k))===k&&Number.isInteger(Number(k))&&Number(k)>=0&&Number(k)<4294967295))keys=Object.keys(Object.fromEntries(keys.map(k=>[k,null])));
  const entries=[];for(const key of keys){if(key==='fetched_at'||key==='retrieved_at')continue;const v=canonical(value[key],seen);if(v!==undefined)entries.push(JSON.stringify(key)+':'+v);}
  result='{'+entries.join(',')+'}';
 }
 seen.set(value,result);return result;
}
export const serialize=value=>canonical(value,new WeakMap());
export async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialize(value)));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}

export function createDigest(){const seen=new WeakMap();return async value=>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value,seen)));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');};}
