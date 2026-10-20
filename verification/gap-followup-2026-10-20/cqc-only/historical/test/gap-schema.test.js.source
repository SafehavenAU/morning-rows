import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {INFORMATION_SCHEMA, selectedResponse} from '../lib/information.js';
import {installGapSchema} from '../lib/gap-schema.js';
import {parseBocHistory,bocHistoryWindow} from '../lib/boc-history.js';
import {parseStatcanHeadline} from '../lib/statcan-headlines.js';
import {walesTax} from '../lib/fiscal-observations.js';
import {gapDefinitions} from '../lib/gap-information.js';

const root=new URL('../verification/gap-pass-2026-10-20/',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const json=path=>JSON.parse(read(path));
const now='2026-10-20T09:20:00.000Z';
const clone=structuredClone;
function desk(country,source,value) {
  const slug=country.toLowerCase().replaceAll(' ','-');
  return {
    site:'https://morningrows.com',country,sources:{},
    _meta:{schema_version:'1.0',id:`https://morningrows.com/${slug}.json`,catalog:`https://morningrows.com/catalog.json?desk=${slug}`},
    [source]:value,
  };
}
function validate(schema,cases) {
  // Explicit formats do not depend on optional jsonschema URI/date-time extras.
  const process=spawnSync('python3',['-c',`
import datetime,json,re,sys
from jsonschema import Draft202012Validator,FormatChecker
payload=json.load(sys.stdin)
formats=FormatChecker()
@formats.checks("date",raises=(ValueError,TypeError))
def date(value):
    return not isinstance(value,str) or datetime.date.fromisoformat(value).isoformat()==value
@formats.checks("date-time",raises=(ValueError,TypeError))
def timestamp(value):
    if not isinstance(value,str): return True
    return bool(re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})",value)) and datetime.datetime.fromisoformat(value.replace("Z","+00:00")).utcoffset() is not None
Draft202012Validator.check_schema(payload["schema"])
validator=Draft202012Validator(payload["schema"],format_checker=formats)
failures=[]
for case in payload["cases"]:
    if validator.is_valid(case["value"]) != case["valid"]:
        failures.append(case["name"])
print(json.dumps({"cases":len(payload["cases"]),"failures":failures}))
sys.exit(bool(failures))
  `],{input:JSON.stringify({schema,cases}),encoding:'utf8',maxBuffer:2*1024*1024});
  assert.equal(process.status,0,process.stdout+process.stderr);
  return JSON.parse(process.stdout);
}

async function specimens() {
  const native={
    exchange_history:parseBocHistory(json('boc/original/window.json'),json('boc/original/latest.json'),bocHistoryWindow(now)),
    land_transaction_tax:walesTax(readFileSync(new URL('./fixtures/wra-tax.csv',import.meta.url),'utf8'),new Date(now)),
  };
  for(const source of ['jobs','price_index','shop','homes'])native[source]=parseStatcanHeadline(source,...['wds-selected.json','series-metadata.json','cube-metadata.json'].map(file=>json(`statcan/${source}/original/${file}`)));
  return native;
}

test('existing gap native schemas reject plausible wrong answers independently of the AEMO installer',async t=>{
  const schema=clone(INFORMATION_SCHEMA);
  installGapSchema(schema);
  const native=await specimens();
  const country=source=>source==='land_transaction_tax'?'Wales':'Canada';
  const cases=Object.entries(native).map(([source,value])=>({name:source+' healthy',valid:true,value:desk(country(source),source,value)}));
  for(const source of Object.keys(native))cases.push({name:source+' explicit source failure',valid:true,value:desk(country(source),source,null)});
  function bad(source,name,change) {
    const value=desk(country(source),source,clone(native[source]));
    change(value[source],value);
    cases.push({name:source+' '+name,valid:false,value});
  }
  assert.equal(schema.$defs.gapAemoNative,undefined);
  for(const [name,change]of Object.entries({
    odd_coverage:v=>v.rows.pop(),
    empty_anchor:v=>v.latest_anchor=[],
    inverse_quote:v=>v.rows[0].unit='USD per CAD',
    zero_rate:v=>v.rows[0].value=0,
    suppression:v=>v.rows[0].value=null,
    invented_holiday:v=>v.rows[0].value_state='bank_holiday',
    wrong_window:v=>v.window.calendar_days=30,
    duplicate_series:v=>v.rows[1]=clone(v.rows[0]),
    partial_provenance:v=>v.provenance=[{role:'window',url:'https://example.org/',retrieved_at:now,bytes:1,sha256:'a'.repeat(64)}],
    malformed_date:v=>v.rows[0].period='2026-02-30',
    wrong_population:v=>v.definitions[0].population='Actual exchange transactions',
    changed_country:(v,body)=>body.country='England',
  }))bad('exchange_history',name,change);
  for(const source of ['jobs','price_index','shop','homes']) {
    const row=value=>source==='jobs'?value[0]:value.rows[0];
    for(const [name,change]of Object.entries({
      wrong_unit:v=>row(v).unit='dollars',
      wrong_population:v=>row(v).definition.population='Different population',
      bad_dimensions:v=>row(v).dimensions.coordinate='2.1.0.0.0.0.0.0.0.0',
      confidentiality:v=>row(v).security_level_code=1,
      unknown_symbol:v=>row(v).symbol_code=2,
      symbol_label:v=>{row(v).symbol_code=3;row(v).symbol='none';},
      unknown_quality:v=>row(v).status_code=10,
      fabricated_utc:v=>row(v).release_timestamp_raw+='Z',
      timezone_invention:v=>row(v).release_timezone='UTC',
      null_value:v=>row(v).value=null,
      invalid_period:v=>row(v).period='2026-13',
      partial:v=>source==='jobs'?v.pop():v.rows.pop(),
    }))bad(source,name,change);
  }
  bad('jobs','percent overflow',v=>v[0].value=100.1);
  bad('jobs','province permutation',v=>v.reverse());
  bad('price_index','zero index',v=>v.rows[0].value=0);
  bad('shop','quality label substitution',v=>{v.rows[0].status_code=7;v.rows[0].quality='normal';});
  bad('homes','monthly quarter alias',v=>v.period='2026-09');
  bad('homes','missing CMHC conditions',v=>delete v.licence_notice);
  bad('homes','CMHC endorsement',v=>v.rows[0].licence_notice.adaptation_notice='CMHC endorsed');
  bad('homes','unrestricted licence',v=>v.licence='Public domain');
  for(const [name,change]of Object.entries({
    partial:v=>v.rows.pop(),
    duplicated_coverage:v=>v.rows[1]=clone(v.rows[0]),
    cash_receipts:v=>v.rows[0].unit='GBP cash received',
    wrong_country:v=>v.geography='United Kingdom',
    confidential_zero:v=>{v.rows[0].notes='Confidential';v.rows[0].value=0;},
    negative_tax:v=>v.rows[0].value=-1,
    wrong_year_start:v=>v.period_start='2025-01-01',
  }))bad('land_transaction_tax',name,change);
  validate(schema,cases);
  t.diagnostic(`${cases.filter(c=>c.valid).length} valid native cases; ${cases.filter(c=>!c.valid).length} rejected mutations`);
  assert.ok(Buffer.byteLength(JSON.stringify(schema))<1_000_000,'Published schema remains bounded');
  const count=schema.$defs.selected.allOf.length;
  installGapSchema(schema);
  assert.equal(schema.$defs.selected.allOf.length,count,'Installer is idempotent');
});

test('actual selected responses enforce source identity, typed observations and exact qualification definitions',async t=>{
  const schema=clone(INFORMATION_SCHEMA);
  installGapSchema(schema);
  const native=await specimens(),cases=[],selected={};
  async function select(source,value,measure,observation) {
    const slug=source==='land_transaction_tax'?'wales':'canada';
    const body={[source]:value,sources:{[source]:{status:value.status||'ok',fetched_at:now}}};
    const result=await selectedResponse(body,{desk:slug,source,entry:[source,source,'sources.'+source],measure,observation},{now});
    assert.equal(result.status,200,JSON.stringify(result.body));
    return result.body;
  }
  for(const [source,value]of Object.entries(native)) {
    const slug=source==='land_transaction_tax'?'wales':'canada';
    const response=await select(source,value);
    cases.push({name:source+' source selection',valid:true,value:response});
    for(const definition of gapDefinitions(slug,source)) {
      const measure=await select(source,value,definition.id);
      cases.push({name:source+' '+definition.id+' measure',valid:true,value:measure});
      const exact=await select(source,value,definition.id,measure.observations[0].period);
      cases.push({name:source+' '+definition.id+' exact',valid:true,value:exact});
      selected[source]??=exact;
    }
  }
  function negative(source,name,change) {
    const value=clone(selected[source]);change(value);
    cases.push({name:source+' '+name,valid:false,value});
  }
  for(const source of Object.keys(native)) {
    for(const [name,change]of Object.entries({
      missing_source:v=>delete v.source,
      disguised_source:v=>{v.source='https://morningrows.com/canada.json?source=exchange';v.data.unit='USD';},
      foreign_identity:v=>v.id=v.id.replace('morningrows.com','example.org'),
      changed_desk:v=>v.desk='https://morningrows.com/england.json',
      invalid_observation_identity:v=>v.observations[0].id+='&unknown=true',
      altered_definition:v=>v.observations[0].definition.unit='Unqualified dollars',
      missing_observation:v=>v.observations=[],
      duplicate_observation:v=>v.observations.push(clone(v.observations[0])),
      invalid_value:v=>v.observations[0].value=null,
      invented_publication:v=>v.observations[0].published_at=now,
      altered_qualifications:v=>v.observations[0].qualifications.unit='USD',
      invalid_version:v=>v.observations[0].version='wrong',
      extra_selector:v=>v.id+='&geography=Canada',
      bad_content_hash:v=>v.content_version='wrong',
      malformed_retrieval_clock:v=>v.retrieval.retrieved_at='not-a-clock',
      source_error_as_success:v=>v.retrieval.status='error',
    }))negative(source,name,change);
  }
  negative('exchange_history','lost anchor context',v=>delete v.context.latest_anchor);
  negative('exchange_history','wrong row quote',v=>v.data.quote_currency='USD');
  negative('jobs','acquisition leaked into semantic qualification',v=>v.observations[0].qualifications.provenance=[]);
  negative('jobs','substituted province flag',v=>v.observations[0].publisher_status.symbol='revised');
  negative('homes','CMHC notice removed',v=>delete v.observations[0].qualifications.licence_notice);
  validate(schema,cases);
  t.diagnostic(`${cases.filter(c=>c.valid).length} valid actual selected responses; ${cases.filter(c=>!c.valid).length} rejected mutations`);
});
