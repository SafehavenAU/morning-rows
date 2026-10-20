import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {INFORMATION_SCHEMA} from '../lib/information.js';
import {installAemoDailySchema} from '../lib/aemo-daily-schema.js';
import {AEMO_DAILY_INDEX,AEMO_DAILY_LIMITS,discoverAemoDailyBundles,readAemoDailyBundles,
  validateAemoDailyBundlesRepresentation,aemoDailyBundleDefinitions} from '../lib/aemo-daily-bundles.js';

const directory=new URL('../verification/gap-followup-2026-10-20/aemo-daily/original/',import.meta.url);
const NOW='2026-10-20T12:30:00.000Z';
const clone=structuredClone;
const definitions=aemoDailyBundleDefinitions();
const index=readFileSync(new URL('directory-listing-excerpt.html',directory),'utf8');
const bundles=discoverAemoDailyBundles(index,{now:NOW});
const originals=bundles.map(b=>readFileSync(new URL(b.filename,directory)));
const schema=clone(INFORMATION_SCHEMA);
installAemoDailySchema(schema);
const reports=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const boundPaths=['lib/aemo-daily-schema.js','test/aemo-daily-schema.test.js','lib/aemo-daily-bundles.js','lib/information.js','lib/gap-information.js'];
const bindings=Object.fromEntries(boundPaths.map(path=>[path,sha(readFileSync(new URL('../'+path,import.meta.url)))]));
const nativePromise=readAemoDailyBundles({now:()=>NOW,fetcher:async url=>{
  if(url===AEMO_DAILY_INDEX)return new Response(index);
  const i=bundles.findIndex(b=>b.url===url);
  assert.notEqual(i,-1,'Schema fixture cannot make unlisted or external requests');
  return new Response(originals[i]);
}});
function failRegion(native,i) {
  const result=clone(native),region=result.regions[i];
  result.regions[i]={
    region:region.region,geography:region.geography,status:'error',calendar_day:region.calendar_day,
    source_url:region.source_url,source_urls:region.source_urls,error:'Constructed missing regional interval',
  };
  result.status=result.regions.every(r=>r.status==='error')?'error':'degraded';
  assert.equal(validateAemoDailyBundlesRepresentation(result,{now:NOW}),true);
  return result;
}
function desk(native) {
  return {
    site:'https://morningrows.com',country:'Australia',
    sources:{grid_day:{status:native?.status||'error',fetched_at:NOW}},
    _meta:{schema_version:'1.0',id:'https://morningrows.com/australia.json',catalog:'https://morningrows.com/catalog.json?desk=australia'},
    grid_day:native,
  };
}
function validate(group,cases) {
  // Draft 2020-12 has mathematical decimal multiples. Exact Decimal input
  // prevents binary floating-point artefacts such as 6.73 / 0.01.
  const result=spawnSync('python3',['-c',`
import datetime,json,re,sys
from decimal import Decimal
from jsonschema import Draft202012Validator,FormatChecker
payload=json.load(sys.stdin,parse_float=Decimal)
formats=FormatChecker()
@formats.checks("date",raises=(ValueError,TypeError))
def date(value):
    return not isinstance(value,str) or datetime.date.fromisoformat(value).isoformat()==value
@formats.checks("date-time",raises=(ValueError,TypeError))
def timestamp(value):
    return not isinstance(value,str) or bool(re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})",value)) and datetime.datetime.fromisoformat(value.replace("Z","+00:00")).utcoffset() is not None
Draft202012Validator.check_schema(payload["schema"])
validator=Draft202012Validator(payload["schema"],format_checker=formats)
checks=[]
for case in payload["cases"]:
    error=next(validator.iter_errors(case["value"]),None)
    checks.append({"name":case["name"],"expected_valid":case["valid"],"valid":error is None,"pass":(error is None)==case["valid"],
                  **({"error":error.message[:160]} if error else {})})
print(json.dumps({"checks":checks,"pass":all(c["pass"] for c in checks)}))
sys.exit(not all(c["pass"] for c in checks))
`],{input:JSON.stringify({schema,cases}),encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const report={group,...JSON.parse(result.stdout)};
  reports.push(report);
  return report.checks.length;
}

test('Unactivated AEMO candidate native schema has complete regional coverage and explicit isolated failures',async t=>{
  const native=await nativePromise;
  assert.equal(validateAemoDailyBundlesRepresentation(native,{now:NOW}),true);
  assert.deepEqual(native.regions.map(r=>r.summary),[
    {mean:6.73,minimum:-169.96,maximum:95.76,negative_count:189,zero_count:2},
    {mean:-7.8,minimum:-44.47,maximum:75.18,negative_count:206,zero_count:9},
  ],'Retained dated original arithmetic anchor, independently reconciled elsewhere');
  const cases=[
    {name:'Actual bounded reader of both retained daily ZIPs',valid:true,value:desk(native)},
    {name:'SA1 healthy with VIC1 unavailable',valid:true,value:desk(failRegion(native,1))},
    {name:'VIC1 healthy with SA1 unavailable',valid:true,value:desk(failRegion(native,0))},
    {name:'Both regional failures',valid:true,value:desk(failRegion(failRegion(native,0),1))},
    {name:'Isolated whole-source failure',valid:true,value:desk(null)},
  ];
  const bad=(name,change)=>{const body=desk(clone(native));change(body.grid_day,body);cases.push({name,valid:false,value:body});};
  for(const [name,change] of Object.entries({
    'Wrong desk nation':(v,b)=>b.country='New Zealand',
    'Wrong canonical native desk':(v,b)=>b._meta.id='https://morningrows.com/morning.json',
    'Missing source health':(v,b)=>delete b.sources.grid_day,
    'Healthy native with degraded health':(v,b)=>b.sources.grid_day.status='degraded',
    'Missing health clock':(v,b)=>delete b.sources.grid_day.fetched_at,
    'Invalid health date':(v,b)=>b.sources.grid_day.fetched_at='2026-02-30T12:00:00Z',
    'Missing native limitation':v=>delete v.limitations,
    'Unqualified whole-Australia scope':v=>v.definitions[0].geography='Australia',
    'Retail-price definition':v=>v.definitions[0].unit='AUD/kWh',
    'Invented finality':v=>v.final=true,
    'Invented publication date':v=>v.published_at=NOW,
    'Invented next publication date':v=>v.next_expected_update=NOW,
    'Missing native definition':v=>v.definitions.pop(),
    'Duplicate definition':v=>v.definitions[1]=clone(v.definitions[0]),
    'Missing region':v=>v.regions.pop(),
    'Duplicate region':v=>v.regions[1]=clone(v.regions[0]),
    'Reordered regional identity':v=>v.regions.reverse(),
    'Foreign region code':v=>v.regions[0].region='NSW1',
    'Wrong regional geography':v=>v.regions[0].geography='Victoria',
    'Missing interval':v=>v.regions[0].intervals.pop(),
    'Extra interval':v=>v.regions[0].intervals.push(clone(v.regions[0].intervals[0])),
    'Partial interval count advertised as success':v=>v.regions[0].interval_count=287,
    'Half-hour cadence':v=>v.regions[0].interval_minutes=30,
    'TRADE dataset invented':v=>v.regions[0].dataset='TRADE',
    'FIRM status invented':v=>v.regions[0].price_status='FIRM',
    'Run two':v=>v.regions[0].runno=2,
    'Intervention price':v=>v.regions[0].intervention=1,
    'Administered-price flag':v=>v.regions[0].apcflag=1,
    'Suspended market':v=>v.regions[0].market_suspended_flag=1,
    'Missing second layout':v=>v.regions[0].csv_layouts=[3],
    'Layouts reordered':v=>v.regions[0].csv_layouts=[3,2],
    'Missing native rounding rule':v=>delete v.regions[0].rounding,
    'Non-cent price':v=>v.regions[0].intervals[0].price=0.005,
    'Null raw value':v=>v.regions[0].intervals[0].price_raw=null,
    'Numeric raw value':v=>v.regions[0].intervals[0].price_raw=1,
    'Suppressed raw value':v=>v.regions[0].intervals[0].price_raw='..',
    'Nonfinite raw value':v=>v.regions[0].intervals[0].price_raw='NaN',
    'Six-decimal token':v=>v.regions[0].intervals[0].price_raw='1.234567',
    'Scientific precision below retained five places':v=>v.regions[0].intervals[0].price_raw='3E-06',
    'Missing layout-two raw value':v=>delete v.regions[0].intervals[0].layout2_price_raw,
    'Fractional interval count':v=>v.regions[0].summary.negative_count=1.5,
    'Impossible negative interval count':v=>v.regions[0].summary.negative_count=-1,
    'More than 288 zero intervals':v=>v.regions[0].summary.zero_count=289,
    'Non-cent mean':v=>v.regions[0].summary.mean=6.735,
    'Missing mean':v=>delete v.regions[0].summary.mean,
    'Invalid interval calendar date':v=>v.regions[0].intervals[0].period_end='2026-02-30T00:05:00+10:00',
    'Daylight-saving timezone substitution':v=>v.regions[0].intervals[0].period_end='2026-10-19T00:05:00+11:00',
    'Invalid selected calendar day':v=>v.calendar_day='2026-13-19',
    'Non-midnight start':v=>v.regions[0].period_start='2026-10-19T00:05:00+10:00',
    'One trading bundle':v=>v.bundles.pop(),
    'Unbounded expanded CSV':v=>v.bundles[0].csv_bytes=AEMO_DAILY_LIMITS.expanded+1,
    'Monthly source substitution':v=>v.bundles[0].url='https://aemo.com.au/monthly.csv',
    'CSV member extension drift':v=>v.bundles[0].csv_name=v.bundles[0].csv_name.toLowerCase(),
    'Missing public provenance':v=>v.provenance=[],
    'Reordered provenance':v=>v.provenance.reverse(),
    'Missing wire digest':v=>delete v.provenance[1].sha256,
    'Malformed wire digest':v=>v.provenance[1].sha256='not-a-digest',
    'Missing expanded CSV digest':v=>delete v.provenance[1].csv_sha256,
    'Invalid provenance calendar date':v=>v.provenance[0].retrieved_at='2026-02-30T12:00:00Z',
    'Non-UTC provenance clock':v=>v.provenance[0].retrieved_at='2026-10-20T22:30:00+10:00',
    'Oversized wire ZIP':v=>v.provenance[1].bytes=AEMO_DAILY_LIMITS.compressed+1,
    'Wrong role':v=>v.provenance[1].role='monthly',
    'Healthy regions mislabeled degraded':v=>v.status='degraded',
  }))bad(name,change);
  for(const token of ['-0.00499','3E-05','-3e-5','1.23456','0','-0','1E+07']) {
    const body=desk(clone(native));body.grid_day.regions[0].intervals[0].price_raw=token;
    cases.push({name:'Lexically valid raw token '+token,valid:true,value:body});
  }
  for(const [name,change] of Object.entries({
    'Failed region with invented zero summary':v=>v.regions[0].summary={mean:0},
    'Failed region with partial intervals':v=>v.regions[0].intervals=[],
    'Failed region without error':v=>delete v.regions[0].error,
    'Invalid failure status code':v=>v.regions[0].http_status=200,
    'Degraded native mislabeled healthy':v=>v.status='ok',
  })) {
    const body=desk(failRegion(native,0));change(body.grid_day);
    cases.push({name,valid:false,value:body});
  }
  const count=validate('native',cases);
  const length=schema.$defs.selected.allOf.length;
  installAemoDailySchema(schema);
  assert.equal(schema.$defs.selected.allOf.length,length,'Installer remains idempotent');
  assert.ok(Buffer.byteLength(JSON.stringify(schema))<1_000_000,'Schema remains bounded');
  t.diagnostic(`${count} independent native-schema cases`);
});

test('Schema validation is separate from exact whole-day semantic validation',async()=>{
  const value=clone(await nativePromise);
  value.regions[0].summary.mean=99;
  assert.equal(validateAemoDailyBundlesRepresentation(value,{now:NOW}),false,'Structurally valid wrong arithmetic must fail semantic validation');
  validate('semantic-boundary',[{name:'Schema does not claim exact whole-day arithmetic',valid:true,value:desk(value)}]);
});

test.after(()=>{
  if(!process.env.AEMO_SCHEMA_REPORT)return;
  const unchanged=boundPaths.every(path=>sha(readFileSync(new URL('../'+path,import.meta.url)))===bindings[path]);
  assert.equal(unchanged,true,'Source bindings must remain fixed during retained schema evidence run');
  writeFileSync(process.env.AEMO_SCHEMA_REPORT,JSON.stringify({
    method:'Offline unactivated candidate reader and manually installed native schema using retained original bytes; independent Python Draft 2020-12 with exact decimal numeric parsing. Historical active-selector tests are retained separately and not counted here.',
    executed_at:new Date().toISOString(),clock:NOW,clock_is_test_fixture:true,network_requests:0,release_acceptance:false,
    bindings,originals:{
      'directory-listing-excerpt.html':{bytes:Buffer.byteLength(index),sha256:sha(index)},
      ...Object.fromEntries(bundles.map((b,i)=>[b.filename,{bytes:originals[i].length,sha256:sha(originals[i])}])),
    },
    schema_bytes:Buffer.byteLength(JSON.stringify(schema)),case_count:reports.reduce((sum,r)=>sum+r.checks.length,0),
    pass:reports.length===2&&reports.every(r=>r.pass),groups:reports,
    limits:'Structural schema cannot prove current day, cross-field equality, canonical period equality, raw layout equality, arithmetic or publication timing. Frozen reader, clock checks and independent release evidence remain required.',
  },null,2)+'\n');
});
