import { fetchOfficial, readBounded, SourceError } from './sources.js';
import { parseCsv } from './stats-nz.js';
const requireValue = (ok, message) => { if (!ok) throw new SourceError(message); };
const OGL = { licence: 'Open Government Licence v3.0', licence_url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/' };
export const WRA_URL = 'https://api.stats.gov.wales/v2/60a57730-166f-486d-9315-69f7fd4c78b1/data?format=csv';
export const INSOLVENCY_COLLECTION = 'https://www.gov.uk/api/content/government/collections/company-insolvency-statistics-releases';
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
const csvObjects = csv => {
 const [header,...rows]=parseCsv(csv);
 requireValue(header?.length && new Set(header).size===header.length && rows.length && rows.every(r=>r.length===header.length),'Incomplete or duplicate CSV columns');
 return rows.map(r=>Object.fromEntries(header.map((key,i)=>[key,r[i]])));
};
const numeric = v => typeof v==='string' && /^(0|[1-9]\d*)(?:\.\d+)?$/.test(v) && Number.isFinite(Number(v));
export function walesTax(csv, now=new Date()) {
 const records=csvObjects(csv), seen=new Set();
 for(const r of records){
  const m=r.Period?.match(/^(\d{4})-(\d{2})$/);
  requireValue(m&&Number(m[2])===(Number(m[1])+1)%100&&r['Data description']==='Tax due (£ million)','Unexpected WRA period or unit');
  requireValue(`${Number(m[1])+1}-03-31`<=now.toISOString().slice(0,10),'WRA annual period is incomplete');
  const key=[r.Period,r.Description,r['Transaction type']].join(':');requireValue(!seen.has(key),'Duplicate WRA observation');seen.add(key);
 }
 const period=records.map(r=>r.Period).sort().at(-1);
 const selections=[['Annual total','All transactions'],['Annual total excluding untypical and undisclosed transactions','All transactions'],['Annual total excluding untypical and undisclosed transactions','Residential'],['Annual total excluding untypical and undisclosed transactions','Non-residential']];
 const rows=selections.map(([coverage,type])=>{
  const r=records.find(r=>r.Period===period&&r.Description===coverage&&r['Transaction type']===type);
  requireValue(r&&numeric(r['Data values'])&&!/Confidential|Not Applicable|Not Available/i.test(r.Notes||''),'Latest WRA total is missing or suppressed');
  return {coverage,transaction_type:type,value:Number(r['Data values']),unit:'GBP million',geography:'Wales',period,notes:r.Notes};
 });
 requireValue(Math.abs(rows[2].value+rows[3].value-rows[1].value)<=0.21&&rows[0].value+0.51>=rows[1].value,'WRA totals exceed rounding tolerance');
 return {source:'Welsh Revenue Authority via StatsWales',source_url:WRA_URL,...OGL,geography:'Wales',period,period_start:`${period.slice(0,4)}-04-01`,period_end:`${Number(period.slice(0,4))+1}-03-31`,rows,
  note:'Tax due by effective financial year, not cash receipts, property values or transaction counts. The inclusive annual total includes transactions whose details are restricted; the other three measures exclude untypical and undisclosed transactions. They overlap and must not be added. No confidential components are inferred. Values are publisher-rounded and may be revised, including for higher-rate refunds. Latest available completed financial year in this dataset; unchanged annual totals are not daily-stale.'};
}
export function insolvencyRelease(body, now=new Date()) {
 requireValue(Array.isArray(body?.links?.documents),'Insolvency collection missing');
 const candidates=body.links.documents.flatMap(d=>{
  const m=d.base_path?.match(/^\/government\/statistics\/company-insolvencies-([a-z]+)-(\d{4})$/);
  if(!m||!months.includes(m[1])||d.withdrawn===true)return [];
  const period=`${m[2]}-${String(months.indexOf(m[1])+1).padStart(2,'0')}`;
  requireValue(period<now.toISOString().slice(0,7),'Insolvency reference month is incomplete');
  return [{period,url:`https://www.gov.uk/api/content${d.base_path}`,publication_url:`https://www.gov.uk${d.base_path}`}];
 });
 requireValue(candidates.length>0,'Monthly insolvency release missing');
 candidates.sort((a,b)=>b.period.localeCompare(a.period));requireValue(candidates.length===1||candidates[0].period!==candidates[1].period,'Duplicate latest insolvency release');return candidates[0];
}
function asset(url){const u=new URL(url);requireValue(u.origin==='https://assets.publishing.service.gov.uk'&&/^\/media\/[a-z0-9]+\/[^/]+\.csv$/.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password,'Unexpected insolvency CSV URL');return u.href;}
export function insolvencyFiles(body, release) {
 requireValue(body?.base_path===new URL(release.publication_url).pathname&&(!body.withdrawn_notice||Object.keys(body.withdrawn_notice).length===0)&&Array.isArray(body.details?.attachments),'Insolvency publication mismatch');
 const find=prefix=>{const matches=body.details.attachments.filter(a=>a.title?.startsWith(prefix));requireValue(matches.length===1,'Insolvency CSV attachment missing or ambiguous');return asset(matches[0].url);};
 return {...release,data_url:find('Long-Run Series in CSV Format - Company Insolvency Statistics'),metadata_url:find('Metadata for Long-Run Series in CSV Format - Company Insolvency Statistics')};
}
function ukDate(value){const m=value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);requireValue(m,'Invalid insolvency release date');const iso=`${m[3]}-${m[2]}-${m[1]}`;requireValue(Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso,'Invalid insolvency calendar date');return iso;}
export function companyInsolvencies(csv, metadata, release, geography, now=new Date()) {
 const code=geography==='Scotland'?'sc':geography==='Northern Ireland'?'ni':null;requireValue(code,'Only distinct national insolvency series are enabled');
 const meta=parseCsv(metadata), metadataValue=key=>{const r=meta.filter(r=>r[0]===key);requireValue(r.length===1,'Insolvency metadata key missing or ambiguous');return r[0][1];};
 requireValue(metadataValue('Licence')==='Open Government Licence 3.0'&&metadataValue('URL')===release.data_url&&metadataValue('More information')===release.publication_url,'Insolvency metadata licence or links mismatch');
 const published=ukDate(metadataValue('Release date')),until=ukDate(metadataValue('Expiry date'));
 requireValue(published<=now.toISOString().slice(0,10)&&until>published,'Insolvency release dates inconsistent');
 const columns=[['total','Total company insolvencies'],['compliq','Compulsory liquidations'],['cvl','Creditors voluntary liquidations'],['admin','Administrations'],['cva','Company voluntary arrangements'],['rec','Administrative receiverships']].map(([id,label])=>({id:`${id}_${code}_nsa`,label}));
 for(const col of columns){const definitions=meta.filter(r=>r[0]===col.id);requireValue(definitions.length===1&&definitions[0][1]===col.label&&definitions[0][2]===geography&&definitions[0][3]==='N','Insolvency definition, geography or adjustment changed');}
 const records=csvObjects(csv),periods=new Set();
 for(const r of records){requireValue(/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period||'')&&Number(r.year)===Number(r.period.slice(0,4))&&Number(r.month)===Number(r.period.slice(5))&&!periods.has(r.period),'Invalid or duplicate insolvency month');periods.add(r.period);}
 const latest=records.sort((a,b)=>b.period.localeCompare(a.period))[0];requireValue(latest.period===release.period,'Insolvency data does not match latest release month');
 const rows=columns.map(({id,label})=>{const value=latest[id];requireValue(/^(0|[1-9]\d*)$/.test(value||'')&&Number.isSafeInteger(Number(value)),'Latest insolvency count is missing or unavailable');return{measure:label,value:Number(value),unit:'company insolvencies',geography,period:release.period,seasonally_adjusted:false};});
 requireValue(rows.slice(1).reduce((n,r)=>n+r.value,0)===rows[0].value,'Insolvency components do not reconcile');
 return {source:'The Insolvency Service',source_url:release.data_url,metadata_url:release.metadata_url,publication_url:release.publication_url,...OGL,geography,period:release.period,published,metadata_valid_until:until,rows,
 note:'Calendar-month registered company insolvencies, not seasonally adjusted. Five procedure counts sum to the total; do not add the total again. Moratoriums, restructuring plans and administration-to-CVL conversions are separate series and are not added. Counts are administrative events, not individual people, insolvency rates or forecasts. Monthly statistics may be revised. England-and-Wales combined figures are not relabelled as either nation.'};
}
async function text(url){return readBounded(await fetchOfficial(url,{headers:{accept:url.includes('/api/content/')?'application/json':'text/csv'}}),1048576);}
export async function readWalesTax(){return walesTax(await text(WRA_URL));}
export async function readCompanyInsolvencies(geography){
 const release=insolvencyRelease(JSON.parse(await text(INSOLVENCY_COLLECTION)));
 const files=insolvencyFiles(JSON.parse(await text(release.url)),release);
 const [csv,metadata]=await Promise.all([text(files.data_url),text(files.metadata_url)]);
 return companyInsolvencies(csv,metadata,files,geography);
}
