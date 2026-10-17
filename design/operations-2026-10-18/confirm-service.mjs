// Read-only confirmation of changed observations; no state promotion or alerts.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
const run=promisify(execFile),checks=[];
for(const host of ['https://morningrows.com','https://www.morningrows.com'])for(const desk of ['new-zealand','canada','united-kingdom']){
 const url=`${host}/${desk}.json`;
 try {
  const {stdout}=await run('curl',['-fsS','--max-time','65',url],{maxBuffer:2*1024*1024});const d=JSON.parse(stdout);
  if(desk==='new-zealand'){
   const p=d.prices,codes=['OTA2201','HAY2201','ISL2201','BEN2201','INV2201'];
   const valid=d.sources.prices.status==='ok'&&p?.length===5&&new Set(p.map(r=>r.code)).size===5&&p.every(r=>codes.includes(r.code)&&Number.isFinite(r.price)&&r.unit==='NZD per megawatt hour'&&r.geography?.includes('point of connection, New Zealand')&&r.timezone==='Pacific/Auckland'&&['interim','final'].includes(r.price_status)&&r.date===p[0].date&&r.period===p[0].period&&r.price_status===p[0].price_status&&[46,48,50].includes(r.period)&&r.periods===r.period&&Date.parse(r.period_end)-Date.parse(r.period_start)===1800000&&Number.isInteger(r.publication_lag_days)&&r.publication_lag_days>=0&&r.source_url?.startsWith('https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/')&&r.licence==='CC BY 4.0');
   checks.push({url,checked_at:new Date().toISOString(),health:d.sources.prices,contract_pass:Boolean(valid),observations:p});
  } else if(desk==='canada'){
   const keys=['jobs','price_index','shop','product','homes','ontario'];
   checks.push({url,checked_at:new Date().toISOString(),health:Object.fromEntries(keys.map(k=>[k,d.sources[k]])),observations:Object.fromEntries(keys.map(k=>[k,d[k]])),qualification:'Successful native retrieval, not independent dimensional/statistical verification.'});
  } else checks.push({url,checked_at:new Date().toISOString(),health:d.sources.bills,qualification:'Targeted check of one newly observed, unconfirmed bills failure.'});
 } catch {checks.push({url,checked_at:new Date().toISOString(),check_error:'Transport or parse failed; no source state inferred'});}
}
await writeFile(new URL('final-confirmation.json',import.meta.url),JSON.stringify({finished_at:new Date().toISOString(),checks},null,2)+'\n');
console.log(JSON.stringify(checks.map(({observations,...x})=>x),null,2));
