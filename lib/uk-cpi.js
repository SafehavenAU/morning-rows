import {fetchOfficial,readBounded,SourceError} from './sources.js';
export const UK_CPI_URLS=Object.fromEntries(['D7BT','D7G7'].map(id=>[id,`https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/${id.toLowerCase()}/mm23/data`]));
const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const requireValue=(ok,message)=>{if(!ok)throw new SourceError(message);};
function monthCode(label){const m=/^(\d{4}) ([A-Z]{3})$/.exec(label||'');requireValue(m&&months.includes(m[2]),'ONS CPI monthly period invalid');return `${m[1]}-${String(months.indexOf(m[2])+1).padStart(2,'0')}`;}
function numeric(value,positive=false){requireValue(typeof value==='string'&&/^-?\d+(?:\.\d+)?$/.test(value)&&Number.isFinite(Number(value))&&(!positive||Number(value)>0),'ONS CPI selected value missing, suppressed or invalid; no zero or prior-month substitution');return Number(value);}
function series(body,id,now){
 const d=body?.description;requireValue(d?.cdid===id&&d.datasetId==='MM23'&&d.title===`CPI ${id==='D7BT'?'INDEX':'ANNUAL RATE'} 00: ALL ITEMS 2015=100`,'ONS CPI series, basket or base changed');
 requireValue(id==='D7BT'?d.unit==='Index, base year = 100'&&d.keyNote==='Index, 2015 = 100':d.unit==='%','ONS CPI unit changed');
 requireValue(Array.isArray(body.months)&&body.months.length>0,'ONS CPI monthly rows missing');
 const seen=new Set(),rows=body.months.map(r=>{const period=monthCode(r.date);requireValue(r.sourceDataset==='MM23'&&!seen.has(period),'ONS CPI duplicate month or dataset mismatch');seen.add(period);return {...r,period};}).sort((a,b)=>a.period.localeCompare(b.period));
 const latest=rows.at(-1);requireValue(latest.date===d.date&&latest.value===d.number&&latest.period<now.toISOString().slice(0,7),'ONS CPI latest row/metadata mismatch or incomplete month');
 requireValue(typeof d.releaseDate==='string'&&Number.isFinite(Date.parse(d.releaseDate))&&Date.parse(d.releaseDate)<=now.getTime()&&latest.updateDate===d.releaseDate,'ONS CPI publication metadata missing or inconsistent');
 return {definition:d,latest,value:numeric(latest.value,id==='D7BT'),rows};
}
export function ukCpi(indexBody,rateBody,now=new Date()){
 const index=series(indexBody,'D7BT',now),rate=series(rateBody,'D7G7',now);
 requireValue(index.latest.period===rate.latest.period&&index.definition.releaseDate===rate.definition.releaseDate&&index.definition.nextRelease===rate.definition.nextRelease,'ONS CPI index and annual rate periods or releases disagree');
 const priorPeriod=`${Number(index.latest.period.slice(0,4))-1}${index.latest.period.slice(4)}`,prior=index.rows.find(r=>r.period===priorPeriod);
 requireValue(prior,'ONS CPI year-earlier index missing for reconciliation');const base=numeric(prior.value,true);
 // Published index levels and rates have one decimal. Bound both levels before
 // comparing the separately published rate, rather than demanding exact ratios.
 const lower=((index.value-.05)/(base+.05)-1)*100-.05,upper=((index.value+.05)/(base-.05)-1)*100+.05;
 requireValue(base>.05&&rate.value>=lower-1e-9&&rate.value<=upper+1e-9,'ONS CPI annual rate inconsistent with index rounding interval');
 return {period:index.latest.date,value:index.latest.value,unit:'index',year_change:rate.latest.value,index:index.value,annual_rate:rate.value,reference_month:index.latest.period,index_base:'2015=100',annual_rate_unit:'percent',geography:'United Kingdom',source:'Office for National Statistics',source_url:UK_CPI_URLS.D7BT,annual_rate_source_url:UK_CPI_URLS.D7G7,series_codes:{index:'D7BT',annual_rate:'D7G7'},dataset:'MM23',published:index.definition.releaseDate,next_release_label:index.definition.nextRelease||null,licence:'Open Government Licence v3.0',licence_url:'https://www.ons.gov.uk/help/termsandconditions',population:'ONS UK all-items consumer-price basket; not household-specific inflation',adjustment:'As published by ONS; no adjustment applied by Morning Rows. Seasonal-adjustment policy not independently established in this response.',revision_policy:'Compare publisher releases and content versions; no finality assumed.',note:'UK CPI, not CPIH or England-only inflation. Index and published annual percentage change use the same monthly period and release. Index ratios can differ from the published rate because levels are rounded; no contractual interpretation is supplied.'};
}
export async function readUkCpi(){
 const bodies=await Promise.all(Object.values(UK_CPI_URLS).map(async url=>JSON.parse(await readBounded(await fetchOfficial(url,{headers:{accept:'application/json'}}),1048576))));
 return ukCpi(...bodies);
}
