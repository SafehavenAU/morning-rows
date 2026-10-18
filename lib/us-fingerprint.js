// Same semantic SHA-256 format as v1; reduce temporary allocations in the
// repeated v2 observation, content-version and ETag hashes. No shared data cache.
const encoder = new TextEncoder();
const hex = Array.from({length:256},(_,i)=>i.toString(16).padStart(2,'0'));
function canonical(value, seen) {
  if (value && typeof value === 'object') {
    if (seen.has(value)) return seen.get(value);
    const result = Array.isArray(value) ? [] : Object.create(null);
    seen.set(value,result);
    if (Array.isArray(value)) {
      for (let i=0;i<value.length;i++) result.push(canonical(value[i],seen));
      return result;
    }
    for (const key of Object.keys(value).sort()) {
      if (key !== 'fetched_at' && key !== 'retrieved_at') result[key] = canonical(value[key],seen);
    }
    return result;
  }
  return value;
}
export async function usDigest(value) {
  // Only this synchronous canonicalization shares repeated definition objects;
  // there is no cross-request or cross-hash memoization of mutable observations.
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(canonical(value,new WeakMap())))));
  let result = '';
  for (const byte of bytes) result += hex[byte];
  return result;
}
