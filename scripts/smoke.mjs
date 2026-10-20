import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { validateCpiRepresentation } from '../lib/information-v2.js';
const run = promisify(execFile);
const base = process.env.SITE_URL || 'https://morningrows.com';
const expected = process.env.EXPECTED_REVISION;
async function read(path, origin = base) {
 const { stdout } = await run('curl', ['--silent','--show-error','--max-time','90','--write-out','\n%{http_code}',new URL(path,origin).href], { maxBuffer: 2 * 1024 * 1024 });
 const at=stdout.lastIndexOf('\n');return {status:Number(stdout.slice(at+1)),text:stdout.slice(0,at)};
}
if (expected) {
 let matched=false;
 for (let attempt=0;attempt<30;attempt++) {
  try { const r=await read('/health.json'); matched=r.status===200 && JSON.parse(r.text).source_revision===expected && JSON.parse(r.text).source_dirty===false; } catch {}
  if(matched)break;
  if(attempt<29)await new Promise(resolve=>setTimeout(resolve,20000));
 }
 if(!matched)throw Error('Expected source revision has not reached production; check Workers Builds');
}
const desks=['australia','new-zealand','canada','united-kingdom','england','scotland','wales','northern-ireland'];
const report={checked_at:new Date().toISOString(),base,checks:[],degraded:[]};
let failed=false;
function problems(value,path='') {
 if(!value||typeof value!=='object')return [];
 if(value.error)return [{path,error:value.error,http_status:value.http_status}];
 return Object.entries(value).flatMap(([k,v])=>problems(v,path?`${path}.${k}`:k));
}
for(const path of ['/health.json','/llms.txt','/catalog.json','/keys.json',...desks.map(d=>`/${d}.json`),...(process.env.CHECK_US==='1'?['/catalog.v2.json','/schema.v2.json','/united-states.json']:[]),'/morning.json','/missing-route-check']) {
 try {
  const r=await read(path);const wanted=path==='/missing-route-check'?404:200;
  if(r.status!==wanted)throw Error(`HTTP ${r.status}; expected ${wanted}`);
  if(path.endsWith('.json')) {
   const d=JSON.parse(r.text);
   if(path==='/health.json') {
    if(!/^[0-9a-f]{40}$/.test(d.source_revision || '') || typeof d.source_dirty!=='boolean' || !d.worker_version)throw Error('Release identity missing');
    report.identity={source_revision:d.source_revision,source_dirty:d.source_dirty,worker_version:d.worker_version,build_fingerprint:d.build_fingerprint};
   }
   if(path==='/catalog.json'&&d.countries?.length!==8)throw Error('Eight desks missing from catalogue');
   if(path==='/catalog.v2.json'&&(d.schema_version!=='2.0'||d.countries?.length!==9||new Set(d.countries.map(c=>c.id)).size!==9||!d.countries.some(c=>c.id==='https://morningrows.com/united-states.json'&&c.resource_schema_version==='2.0')||d.countries.filter(c=>c.resource_schema_version==='1.0').length!==8))throw Error('Versioned catalogue must preserve eight v1 resources and one US v2 resource');
   if(path==='/schema.v2.json'&&d.$id!=='https://morningrows.com/schema.v2.json')throw Error('US schema link mismatch');
   if(path==='/united-states.json') {
    if(d.country!=='United States'||d._meta?.schema_version!=='2.0'||d.sources?.cpi?.status!=='ok'||!validateCpiRepresentation(d.cpi))throw Error('US CPI requires the exact national NSA definition and 13 complete calendar slots, with missingness distinct from zero');
    if(process.env.EXPECTED_US_LATEST&&d.cpi.latest_period!==process.env.EXPECTED_US_LATEST)throw Error('US latest period differs from independently verified release');
   }
   if(desks.some(name=>path===`/${name}.json`)||path==='/morning.json') {
    if(d.error||!d.country||!d.sources)throw Error('Desk contract or whole-desk failure');
    const good=Object.values(d.sources).filter(s=>s.status==='ok').length;
    if(!good)throw Error('No successful sources on desk');
    report.degraded.push(...problems(d).map(issue=>({desk:path,...issue})));
   }
   if(path==='/new-zealand.json') {
    const rows=d.stats?.rows||[];
    if(!d.stats?.present||rows.length!==23||rows.some(row=>row.status!=='ok'||!row.period||!Number.isFinite(row.value)||!row.geography||!row.unit))throw Error('Stats NZ requires 23 valid, described observations');
    if(process.env.CHECK_NZ_PRICES==='1') {
     const p=d.prices,codes=['OTA2201','HAY2201','ISL2201','BEN2201','INV2201'];
     if(d.sources.prices?.status!=='ok'||p?.length!==5||new Set(p.map(r=>r.code)).size!==5||p.some(r=>!codes.includes(r.code)||!Number.isFinite(r.price)||r.unit!=='NZD per megawatt hour'||!r.geography?.includes('point of connection, New Zealand')||r.timezone!=='Pacific/Auckland'||!['interim','final'].includes(r.price_status)||r.date!==p[0].date||r.period!==p[0].period||r.price_status!==p[0].price_status||![46,48,50].includes(r.period)||r.periods!==r.period||Date.parse(r.period_end)-Date.parse(r.period_start)!==1800000||!Number.isInteger(r.publication_lag_days)||r.publication_lag_days<0||!r.source_url?.startsWith('https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/')||r.licence!=='CC BY 4.0'))throw Error('NZ electricity prices require five described, same-period observations with explicit release status');
    }
   }
   if(path==='/australia.json') {
    const h=d.hospital,triage=['Resuscitation','Emergency','Urgent','Semi-urgent','Non-urgent'];
    const states=['NSW','Vic','Qld','WA','SA','Tas','ACT','NT'];
    if(!h?.source_url?.startsWith('https://myhospitalsapi.aihw.gov.au/')||!/^\d{4}-\d{2}$/.test(h.year||'')||!h.unit||h.states?.length!==8||new Set(h.states.map(r=>r.code)).size!==8||h.states.some(r=>!states.includes(r.code)||triage.some(k=>!Number.isFinite(r[k])||r[k]<0||r[k]>100)))throw Error('AIHW requires eight jurisdictions and 40 numeric triage percentages; suppression is not zero');
   }
   if(path==='/wales.json') {
    const p=d.projection;
    if(!Number.isFinite(p?.value)||p.kind!=='projection'||p.geography!=='Wales'||p.period!==`Mid-year ${new Date().getUTCFullYear()}`||!p.meaning?.includes('all ages, persons')||!p.unit)throw Error('Wales requires a current-year all-persons/all-ages projection with explicit geography');
   }
   if(path==='/northern-ireland.json') {
    const n=d.childhood_bmi;
    if(n?.rows?.length!==4||n.rows.some(r=>r.status!=='ok'||!Number.isFinite(r.value)||r.geography!=='Northern Ireland'||r.sex!=='All Persons'||!/^\d{4}\/\d{2}$/.test(r.period||'')||r.period!==n.period||r.unit!=='percent'))throw Error('NISRA requires four national all-persons academic-year aggregates');
   }
   if(process.env.CHECK_FISCAL_ADDITIONS==='1') {
    if(path==='/wales.json') {
     const t=d.land_transaction_tax;
     if(t?.rows?.length!==4||t.geography!=='Wales'||!/^\d{4}-\d{2}$/.test(t.period||'')||t.rows.some(r=>!Number.isFinite(r.value)||r.value<0||r.unit!=='GBP million'||r.geography!=='Wales'||r.period!==t.period)||!t.rows[0].coverage.includes('Annual total')||Math.abs(t.rows[2].value+t.rows[3].value-t.rows[1].value)>0.21)throw Error('Four validated WRA tax observations missing');
    }
    if(['/scotland.json','/northern-ireland.json'].includes(path)) {
     const i=d.company_insolvencies,g=path==='/scotland.json'?'Scotland':'Northern Ireland';
     if(i?.rows?.length!==6||i.geography!==g||!/^\d{4}-(0[1-9]|1[0-2])$/.test(i.period||'')||i.rows.some(r=>!Number.isSafeInteger(r.value)||r.value<0||r.geography!==g||r.period!==i.period||r.unit!=='company insolvencies'||r.seasonally_adjusted!==false)||i.rows.slice(1).reduce((n,r)=>n+r.value,0)!==i.rows[0].value)throw Error('Six validated national company-insolvency observations missing');
    }
   }
   if(process.env.CHECK_TRANSPORT_ADDITIONS==='1') {
    if(path==='/new-zealand.json') {
     const f=d.vehicle_fleet;
     if(f?.rows?.length!==8||f.geography!=='New Zealand'||f.period!=='2024'||f.rows.some(r=>!Number.isSafeInteger(r.value)||r.value<0||r.unit!=='vehicles'||r.geography!=='New Zealand'||r.period!==f.period))throw Error('Eight validated NZ fleet observations missing');
    }
    if(path==='/scotland.json') {
     const t=d.road_traffic;
     if(t?.rows?.length!==4||t.geography!=='Scotland'||t.period!=='2024'||t.rows.some(r=>!Number.isFinite(r.value)||r.value<0||r.unit!=='million vehicle kilometres'||r.geography!=='Scotland'||r.period!==t.period))throw Error('Four validated Scottish traffic observations missing');
    }
   }
   if(process.env.CHECK_PHARMACY_ADDITION==='1' && path==='/england.json') {
    const p=d.pharmacies;
    if(p?.rows?.length!==9||p.geography!=='England'||!/^\d{4}-\d{2}$/.test(p.period||'')||p.rows.some(r=>!Number.isSafeInteger(r.value)||r.geography!=='England'||r.period!==p.period||r.unit!=='pharmacies'))throw Error('Nine NHSBSA national pharmacy observations missing');
   }
   if(process.env.CHECK_ASSEMBLY_ADDITION==='1') {
    if(path==='/northern-ireland.json'&&(!Number.isSafeInteger(d.assembly_divisions?.value)||d.assembly_divisions.value<0||!/^\d{4}-\d{2}$/.test(d.assembly_divisions.period||'')))throw Error('NI Assembly monthly aggregate missing');
   }
   // Enable for release validation of the prepared no-key additions. Existing
   // production health checks remain usable until this version is deployed.
   if(process.env.CHECK_OPEN_ADDITIONS==='1') {
    if(path==='/australia.json') {
     const r=d.rfs_incidents;
     if(!r||!Number.isSafeInteger(r.value)||r.value<0||!r.period||!r.geography?.includes('ACT')||!Array.isArray(r.by_alert_level)||r.by_alert_level.reduce((n,row)=>n+row.value,0)!==r.value)throw Error('RFS aggregate or coverage missing');
    }
    if(path==='/england.json') {
     const r=d.pupil_absence;
     if(!r||r.rows?.length!==5||r.rows.some(row=>row.status!=='ok'||!Number.isFinite(row.value)||row.geography!=='England'||row.period_code!=='AY'||!row.period||!row.unit))throw Error('Five validated national education measures missing');
    }
    if(path==='/scotland.json') {
     const r=d.river_level;
     if(!r||!Number.isFinite(r.value)||r.station_number!=='9683'||r.geography!=='Galashiels, Scotland'||r.unit!=='metres'||!r.period)throw Error('Validated Galashiels observation missing');
    }
   }
  }
  report.checks.push({path,status:'pass'});
 } catch(e){failed=true;report.checks.push({path,status:'fail',error:e.message});}
}
if(base==='https://morningrows.com') {
 let ok=false;try {
  const r=await read('/health.json','https://www.morningrows.com'); const d=JSON.parse(r.text);
  ok=r.status===200&&d.worker_version===report.identity?.worker_version&&d.source_revision===report.identity?.source_revision&&(!expected||d.source_revision===expected && d.source_dirty===false);
 }catch{}
 report.checks.push({path:'www health',status:ok?'pass':'fail'});if(!ok)failed=true;
}
await writeFile(process.env.REPORT_PATH||'smoke-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.env.STRICT_SOURCES==='1'&&report.degraded.length)failed=true;
process.exitCode=failed?1:0;
