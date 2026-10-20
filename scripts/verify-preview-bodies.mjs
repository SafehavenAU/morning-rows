// Offline semantic acceptance for public bodies captured by remote-check.mjs.
// No requests, preview tokens, fixture substitution, or checkpoint writes.
// Usage: EXPECTED_REVISION=... EXPECTED_US_LATEST=YYYY-MM node
//        scripts/verify-preview-bodies.mjs CAPTURE_DIRECTORY [REPORT_FILE]
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {DESKS} from '../lib/information.js';
import {REGISTRY, US_CONTRACT, inspectSource, validateDiscovery, validateUsDiscovery} from '../lib/monitor-contracts.js';
import {validateCpiRepresentation} from '../lib/information-v2.js';

if (!process.argv[2]) throw Error('A directory of captured .response bodies is required');
const directory=resolve(process.argv[2]), output=resolve(process.argv[3]||join(directory,'semantic-report.json'));
const checks=[], inputs=[], bodies={};
const report={checked_at:new Date().toISOString(),capture_directory:directory,
  expected_revision:process.env.EXPECTED_REVISION||null,
  expected_us_latest:process.env.EXPECTED_US_LATEST||null,
  evidence_kind:'Offline semantic validation of supplied response bodies',
  limitations:['Does not prove HTTP status, response headers, actual CPU, or live-source acquisition. Pair with the original remote-check capture and versioned CPU evidence.','Does not independently certify publisher values or complete monitoring acceptance.'],
  checks, inputs, source_status:{}};
function check(name,ok,detail) {
  checks.push({name,pass:Boolean(ok),...(detail?{detail}: {})});
}
async function load(path) {
  const file=path.replaceAll('/','_')+'.response';
  try {
    const bytes=await readFile(join(directory,file)), body=JSON.parse(bytes);
    inputs.push({path,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    bodies[path]=body;check(`capture ${path}`,true);return body;
  } catch (error) {
    check(`capture ${path}`,false,error.code==='ENOENT'?'missing_capture':'invalid_or_unreadable_json');
    return null;
  }
}
function requireValue(ok,message) {if(!ok)throw Error(message);}
function semantic(name,fn) {try{fn();check(name,true);}catch(error){check(name,false,error.message);}}
const health=await load('/health.json');
check('clean source identity',/^[a-f0-9]{40}$/.test(health?.source_revision||'')&&health?.source_dirty===false&&/^[a-f0-9]{16}$/.test(health?.build_fingerprint||''));
if(report.expected_revision)check('expected source revision',health?.source_revision===report.expected_revision);
report.identity=health;
check('eight-desk v1 catalogue',validateDiscovery(await load('/catalog.json')));
const schema=await load('/schema.json');
check('v1 schema available',Boolean(schema?.$schema)&&schema?.oneOf?.length===3);
check('nine-desk versioned catalogue',validateUsDiscovery(await load('/catalog.v2.json')));
const schema2=await load('/schema.v2.json');
check('v2 schema available',schema2?.$id==='https://morningrows.com/schema.v2.json');

for(const [desk,country] of Object.entries({...DESKS,'united-states':'United States'})) {
  const body=await load(`/${desk}.json`);
  check(`${desk} desk envelope`,body?.country===country&&!body?.error&&body?._meta?.schema_version===(desk==='united-states'?'2.0':'1.0')&&Object.values(body?.sources||{}).some(s=>s.status==='ok'));
  if(!body)continue;
  report.source_status[desk]={...body.sources,...Object.fromEntries(Object.entries(body.also?.sources||{}).map(([key,value])=>['also.'+key,value]))};
}

const coreCounts={'new-zealand/stats':23,'new-zealand/prices':5,'australia/hospital':40,'wales/projection':1,'northern-ireland/childhood_bmi':4,'united-states/cpi':13};
for(const [key,count] of Object.entries(coreCounts)) {
  const contract=[...REGISTRY,US_CONTRACT].find(c=>c.key===key), body=bodies[`/${contract.desk}.json`];
  const result=body?await inspectSource(body,contract):null;
  check(`${key} semantic coverage`,result?.kind==='success'&&result?.observations?.length===count,
    {expected_observations:count,observed_observations:result?.observations?.length??null,kind:result?.kind??null,reason:result?.reason??null});
}

// Preserve the established smoke.mjs core and all prior-addition gates.
semantic('Stats NZ 23 described values',()=>{
  const d=bodies['/new-zealand.json'],r=d?.stats?.rows||[];
  requireValue(d?.stats?.present&&r.length===23&&r.every(x=>x.status==='ok'&&x.period&&Number.isFinite(x.value)&&x.geography&&x.unit),'Stats NZ observation dimensions or value');
});
semantic('AIHW 40 jurisdiction and triage percentages',()=>{
  const h=bodies['/australia.json']?.hospital,states=['NSW','Vic','Qld','WA','SA','Tas','ACT','NT'],triage=['Resuscitation','Emergency','Urgent','Semi-urgent','Non-urgent'];
  requireValue(h?.source_url?.startsWith('https://myhospitalsapi.aihw.gov.au/')&&/^\d{4}-\d{2}$/.test(h.year||'')&&h.unit&&h.states?.length===8&&new Set(h.states.map(r=>r.code)).size===8&&h.states.every(r=>states.includes(r.code)&&triage.every(k=>Number.isFinite(r[k])&&r[k]>=0&&r[k]<=100)),'AIHW coverage, source, period or percentage');
});
semantic('Wales current-year all-persons projection',()=>{
  const p=bodies['/wales.json']?.projection;
  requireValue(Number.isFinite(p?.value)&&p.kind==='projection'&&p.geography==='Wales'&&p.period===`Mid-year ${new Date().getUTCFullYear()}`&&p.meaning?.includes('all ages, persons')&&p.unit,'Wales projection dimensions or year');
});
semantic('NISRA four national academic-year aggregates',()=>{
  const n=bodies['/northern-ireland.json']?.childhood_bmi;
  requireValue(n?.rows?.length===4&&n.rows.every(r=>r.status==='ok'&&Number.isFinite(r.value)&&r.geography==='Northern Ireland'&&r.sex==='All Persons'&&/^\d{4}\/\d{2}$/.test(r.period||'')&&r.period===n.period&&r.unit==='percent'),'NISRA national dimensions or value');
});
semantic('USA exact CPI contract and latest release',()=>{
  const d=bodies['/united-states.json'];
  requireValue(d?.sources?.cpi?.status==='ok'&&validateCpiRepresentation(d?.cpi),'USA exact CPI representation');
  if(report.expected_us_latest)requireValue(d.cpi.latest_period===report.expected_us_latest,'USA latest period differs from independent evidence');
});
semantic('WRA four tax observations',()=>{
  const t=bodies['/wales.json']?.land_transaction_tax;
  requireValue(t?.rows?.length===4&&t.geography==='Wales'&&/^\d{4}-\d{2}$/.test(t.period||'')&&t.rows.every(r=>Number.isFinite(r.value)&&r.value>=0&&r.unit==='GBP million'&&r.geography==='Wales'&&r.period===t.period)&&t.rows[0].coverage?.includes('Annual total')&&Math.abs(t.rows[2].value+t.rows[3].value-t.rows[1].value)<=0.21,'WRA dimensions or component total');
});
for(const [desk,geography]of [['scotland','Scotland'],['northern-ireland','Northern Ireland']])semantic(`${geography} six insolvency observations`,()=>{
  const i=bodies[`/${desk}.json`]?.company_insolvencies;
  requireValue(i?.rows?.length===6&&i.geography===geography&&/^\d{4}-(0[1-9]|1[0-2])$/.test(i.period||'')&&i.rows.every(r=>Number.isSafeInteger(r.value)&&r.value>=0&&r.geography===geography&&r.period===i.period&&r.unit==='company insolvencies'&&r.seasonally_adjusted===false)&&i.rows.slice(1).reduce((n,r)=>n+r.value,0)===i.rows[0].value,'Insolvency coverage, dimensions or component total');
});
semantic('NZ eight fleet observations',()=>{
  const f=bodies['/new-zealand.json']?.vehicle_fleet;
  requireValue(f?.rows?.length===8&&f.geography==='New Zealand'&&f.period==='2024'&&f.rows.every(r=>Number.isSafeInteger(r.value)&&r.value>=0&&r.unit==='vehicles'&&r.geography==='New Zealand'&&r.period===f.period),'NZ fleet dimensions or value');
});
semantic('Scotland four road-traffic observations',()=>{
  const t=bodies['/scotland.json']?.road_traffic;
  requireValue(t?.rows?.length===4&&t.geography==='Scotland'&&t.period==='2024'&&t.rows.every(r=>Number.isFinite(r.value)&&r.value>=0&&r.unit==='million vehicle kilometres'&&r.geography==='Scotland'&&r.period===t.period),'Scotland traffic dimensions or value');
});
semantic('England nine pharmacy observations',()=>{
  const p=bodies['/england.json']?.pharmacies;
  requireValue(p?.rows?.length===9&&p.geography==='England'&&/^\d{4}-\d{2}$/.test(p.period||'')&&p.rows.every(r=>Number.isSafeInteger(r.value)&&r.geography==='England'&&r.period===p.period&&r.unit==='pharmacies'),'Pharmacy dimensions or value');
});
semantic('NI Assembly monthly aggregate',()=>{
  const d=bodies['/northern-ireland.json']?.assembly_divisions;
  requireValue(Number.isSafeInteger(d?.value)&&d.value>=0&&/^\d{4}-\d{2}$/.test(d.period||''),'Assembly month or count');
});
semantic('RFS aggregate coverage',()=>{
  const r=bodies['/australia.json']?.rfs_incidents;
  requireValue(r&&Number.isSafeInteger(r.value)&&r.value>=0&&r.period&&r.geography?.includes('ACT')&&Array.isArray(r.by_alert_level)&&r.by_alert_level.reduce((n,row)=>n+row.value,0)===r.value,'RFS aggregate or coverage');
});
semantic('England five education observations',()=>{
  const r=bodies['/england.json']?.pupil_absence;
  requireValue(r?.rows?.length===5&&r.rows.every(x=>x.status==='ok'&&Number.isFinite(x.value)&&x.geography==='England'&&x.period_code==='AY'&&x.period&&x.unit),'Education dimensions or value');
});
semantic('SEPA Galashiels observation',()=>{
  const r=bodies['/scotland.json']?.river_level;
  requireValue(Number.isFinite(r?.value)&&r.station_number==='9683'&&r.geography==='Galashiels, Scotland'&&r.unit==='metres'&&r.period,'SEPA observation dimensions or value');
});
report.pass=checks.every(c=>c.pass);
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failures:checks.filter(c=>!c.pass),output},null,2));
if(!report.pass)process.exitCode=1;
