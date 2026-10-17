import { fetchOfficial, readBounded, SourceError } from './sources.js';
import { parseCsv } from './stats-nz.js';

export const PRICE_DIRECTORY = 'https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices';
export const PRICE_NODES = [['OTA2201', 'Otahuhu, Auckland'], ['HAY2201', 'Haywards, Wellington'], ['ISL2201', 'Islington, Christchurch'], ['BEN2201', 'Benmore'], ['INV2201', 'Invercargill']];
const zone = 'Pacific/Auckland', halfHour = 1800000;
const requireValue = (ok, message) => { if (!ok) throw new SourceError(message); };
function dayNumber(date) {
  const ms = Date.parse(`${date}T00:00:00Z`);
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === date, 'Invalid EMI trading date');
  return ms;
}
const isoDay = ms => new Date(ms).toISOString().slice(0,10);
function localDay(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-NZ', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function midnight(date) {
  const nominal = dayNumber(date);
  let utc = nominal;
  for (let i=0;i<3;i++) {
    const offset = new Intl.DateTimeFormat('en', {timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(new Date(utc)).find(p=>p.type==='timeZoneName').value.match(/^GMT\+(12|13)$/);
    requireValue(offset, 'Unexpected New Zealand timezone offset');
    utc = nominal - Number(offset[1])*3600000;
  }
  return utc;
}
export function tradingDay(date) {
  const start = midnight(date), end = midnight(isoDay(dayNumber(date)+86400000));
  const periods = (end-start)/halfHour;
  requireValue([46,48,50].includes(periods), 'Unexpected EMI trading-day length');
  return {periods, period_start:new Date(end-halfHour).toISOString(), period_end:new Date(end).toISOString()};
}
export function priceRelease(html, now=new Date()) {
  // EMI appends scripts after </html>; the document terminator still detects
  // a truncated listing without requiring it to be the final response bytes.
  requireValue(/<h1\b[^>]*>\s*Final and interim energy prices\s*<\/h1>/i.test(html) && /<\/html>/i.test(html), 'Incomplete or unexpected EMI directory');
  const today=localDay(now), latestCompleted=isoDay(dayNumber(today)-86400000), files=new Map();
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    let url; try { url=new URL(match[1], PRICE_DIRECTORY+'/'); } catch { continue; }
    if(url.origin!=='https://www.emi.ea.govt.nz'||url.search||url.hash||url.username||url.password)continue;
    const file=url.pathname.match(/^\/Wholesale\/Datasets\/DispatchAndPricing\/FinalEnergyPrices\/(\d{4})(\d{2})(\d{2})_FinalEnergyPrices(_I)?\.csv$/);
    if(!file)continue;
    const date=`${file[1]}-${file[2]}-${file[3]}`;
    dayNumber(date); requireValue(date<=today, 'Future EMI release date');
    if(date===today||date<'2022-11-01')continue;
    files.set(url.href,{date,price_status:file[4]?'interim':'final',source_url:url.href});
  }
  const sorted=[...files.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.price_status.localeCompare(b.price_status));
  requireValue(sorted.length,'No completed daily EMI price release listed');
  return {...sorted[0],latest_completed_date:latestCompleted,publication_lag_days:(dayNumber(latestCompleted)-dayNumber(sorted[0].date))/86400000};
}
export function nzPrices(csv, release) {
  const file=new URL(release.source_url);
  requireValue(['interim','final'].includes(release.price_status) && file.href===`${PRICE_DIRECTORY}/${release.date.replaceAll('-','')}_FinalEnergyPrices${release.price_status==='interim'?'_I':''}.csv`, 'EMI release identity mismatch');
  const day=tradingDay(release.date), [header,...records]=parseCsv(csv);
  const columns=['TradingDate','TradingPeriod','PointOfConnection','DollarsPerMegawattHour'];
  requireValue(header?.length===4 && new Set(header).size===4 && columns.every(c=>header.includes(c)) && records.length, 'EMI price columns or units changed');
  const positions=columns.map(c=>header.indexOf(c)), selected=new Map(PRICE_NODES.map(([code])=>[code,new Map()]));
  for(const row of records) {
    requireValue(row.length===4,'Incomplete EMI price record');
    const [date,period,code,price]=positions.map(i=>row[i]);
    requireValue(date===release.date && /^(?:[1-9]|[1-4]\d|50)$/.test(period) && Number(period)<=day.periods, 'EMI record date or trading period mismatch');
    if(!selected.has(code))continue;
    const values=selected.get(code);
    requireValue(!values.has(Number(period)),'Duplicate EMI node-period');
    requireValue(/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(price) && Number.isFinite(Number(price)), 'EMI price missing, suppressed or invalid; not zero');
    values.set(Number(period),Number(price));
  }
  return PRICE_NODES.map(([code,name])=>{
    const values=selected.get(code);
    requireValue(values.size===day.periods && Array.from({length:day.periods},(_,i)=>i+1).every(p=>values.has(p)), 'Incomplete EMI day for a required node; no earlier period substituted');
    return {code,name,price:values.get(day.periods),period:day.periods,...release,...day,timezone:zone,
      unit:'NZD per megawatt hour',geography:`${name} point of connection, New Zealand`,source:'Electricity Authority (New Zealand), EMI',
      licence:'CC BY 4.0',licence_url:'https://www.emi.ea.govt.nz/LegalInformation',attribution:'www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)',
      selection:'Last half-hour of the latest listed completed NZ trading day; all periods validated for five selected nodes. Not a national price, daily average or household tariff.',
      revision_note:'Interim prices can change before finalisation; status comes from the published file, not elapsed time. Same-day final files take precedence. No older release is substituted on failure.'};
  });
}
export async function readNzPrices(now=new Date()) {
  const directory=await readBounded(await fetchOfficial(PRICE_DIRECTORY),1048576);
  const release=priceRelease(directory,now);
  const csv=await readBounded(await fetchOfficial(release.source_url,{headers:{accept:'text/csv'}}),1048576);
  return nzPrices(csv,release);
}
