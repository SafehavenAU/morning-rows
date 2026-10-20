// Offline runtime-to-independent-reference comparison; no HTTP/release proof.
// node verification/gap-pass-2026-10-20/aemo/check-reader-reference.mjs OUTPUT
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseAemoDay} from '../../../lib/aemo-day.js';
const output=process.argv[2];if(!output)throw Error('New output path required');
const root=new URL('./',import.meta.url),inputs=[];
async function load(name){const bytes=await readFile(new URL(name,root));inputs.push({file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});return bytes;}
const reference=JSON.parse(await load('independent-report.json'));
if(!reference.pass||reference.comparison_rows!==576||reference.target_day!=='2026-10-19')throw Error('Wrong independent reference');
const comparisons=[];
for(const region of ['SA1','VIC1']){
 const native=parseAemoDay((await load('original/monthly-'+region+'-2026-10-19.csv')).toString('utf8'),region,reference.target_day);
 const cells=reference.observations.filter(row=>row.region===region),summary=reference.summaries.find(row=>row.region===region);
 if(cells.length!==288||native.intervals.length!==288)throw Error('Incomplete comparison');
 for(let i=0;i<288;i++)comparisons.push({region,period_end:cells[i].interval_end,value: native.intervals[i].price,pass:native.intervals[i].period_end===cells[i].interval_end&&native.intervals[i].price===Number(cells[i].rrp_decimal)});
 for(const [statistic,key]of Object.entries({mean:'mean_rounded_2dp',minimum:'minimum_decimal',maximum:'maximum_decimal',negative_count:'negative_interval_count',zero_count:'zero_interval_count'}))comparisons.push({region,statistic,value:native.summary[statistic],pass:native.summary[statistic]===Number(summary[key])});
}
await load('../../../lib/aemo-day.js');
const result={kind:'Offline reader comparison to independent CSV/Decimal extraction; no live or protected Worker proof',pass:comparisons.every(x=>x.pass),interval_cells:576,summary_cells:10,inputs,comparisons};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:result.pass,interval_cells:576,summary_cells:10,output}));if(!result.pass)process.exitCode=1;
