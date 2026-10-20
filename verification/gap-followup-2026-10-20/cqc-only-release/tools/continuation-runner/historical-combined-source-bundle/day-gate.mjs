// Actual clock for execution; exported pure predicate is for offline controls only.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export function eligible(value){return Number.isFinite(value)&&value>=Date.parse('2026-10-19T14:00:00Z')&&value<Date.parse('2026-10-20T14:00:00Z');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const now=Date.now(),pass=eligible(now);console.log(JSON.stringify({kind:'Actual-clock frozen AEMO eligibility',at:new Date(now).toISOString(),calendar_day:'2026-10-19',expires_at:'2026-10-20T14:00:00Z',pass}));
 if(!pass){console.error('Stop: obtain and independently review the new eligible day; no clock pinning or older-day fallback.');process.exitCode=1;}
}
