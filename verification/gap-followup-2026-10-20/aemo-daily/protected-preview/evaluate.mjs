import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
const oracle=JSON.parse(readFileSync(new URL('../review/pure-parser-capture.json',import.meta.url)));
const independent=JSON.parse(readFileSync(new URL('../review/independent-rounding.json',import.meta.url)));
const zipRefs=independent.input_files.filter(x=>x.file.endsWith('.zip'));
const strip=value=>{const result=structuredClone(value);delete result.provenance;return result;};
export function evaluate(value,test,{started_at,completed_at}={}){
 const native=value.body?.grid_day,health=value.body?.sources?.grid_day,live=test.name==='live';
 const checks=[];const add=(name,pass)=>checks.push({name,pass:!!pass});
 add('fixture/live identity',value.fixture===!live);
 add('unrelated source survives',value.body?.sibling?.value===7&&value.body?.sources?.sibling?.status==='ok');
 add('bounded request count',value.calls?.length===test.expected_calls);
 add('exact URLs and request policy',value.calls?.every(x=>x.redirect==='manual'&&x.accept===(x.url.endsWith('/')?'text/html':'application/zip')&&[...oracle.bundles.map(b=>b.url),'https://nemweb.com.au/Reports/CURRENT/Public_Prices/'].includes(x.url)));
 add('source health',health?.status===test.expected);
 if(test.expected==='error'){add('no substituted native data',native===null);return {pass:checks.every(x=>x.pass),checks};}
 add('native complete or isolated partial',native?.status===test.expected&&native?.calendar_day==='2026-10-19'&&value.validated===true);
 add('three resource provenance records',native?.provenance?.length===3);
 const publicClock=live?value.completed_at:value.fixture_clock;
 add('bounded ordered resource provenance',native?.provenance?.length===3&&native.provenance.every((p,i)=>p.role===(i?'bundle':'index')&&p.url===(i?oracle.bundles[i-1].url:'https://nemweb.com.au/Reports/CURRENT/Public_Prices/')&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=(i?524288:131072)&&/^[a-f0-9]{64}$/.test(p.sha256)&&Date.parse(p.requested_at)<=Date.parse(p.retrieved_at)&&Date.parse(p.retrieved_at)<=Date.parse(publicClock)&&(!i||(p.csv_bytes>0&&p.csv_bytes<=2097152&&Date.parse(p.requested_at)>=Date.parse(native.provenance[0].retrieved_at)))));
 if(live||test.name==='fixture'){
  add('entire original native semantic representation',isDeepStrictEqual(strip(native),strip(oracle)));
  add('two original ZIP and expanded CSV bytes',zipRefs.every((ref,i)=>native.provenance[i+1].sha256===ref.sha256&&native.provenance[i+1].bytes===ref.bytes&&native.provenance[i+1].csv_sha256===ref.csv_sha256&&native.provenance[i+1].csv_bytes===ref.csv_bytes));
 }
 if(test.expected==='degraded'){
  add('SA1 refused without values',native?.regions?.[0]?.status==='error'&&!Object.hasOwn(native.regions[0],'intervals')&&!Object.hasOwn(native.regions[0],'summary'));
  add('all 288 VIC1 original cells and five summaries survive',isDeepStrictEqual(native?.regions?.[1],oracle.regions[1]));
 }
 if(test.summary){add('constructed rounding summary',isDeepStrictEqual(native?.regions?.[0]?.summary,test.summary));add('unchanged VIC1',isDeepStrictEqual(native?.regions?.[1],oracle.regions[1]));}
 if(live){add('actual acquisition ordered within request',Date.parse(value.started_at)>=Date.parse(started_at)&&Date.parse(value.completed_at)<=Date.parse(completed_at)&&native.provenance.every(p=>Date.parse(p.requested_at)>=Date.parse(value.started_at)&&Date.parse(p.retrieved_at)<=Date.parse(value.completed_at)));}
 return {pass:checks.every(x=>x.pass),checks};
}
export {oracle,independent};
