import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {INFORMATION_SCHEMA,selectedResponse} from '../lib/information.js';
import {installRemainingSchema} from '../lib/remaining-schema.js';
import {remainingDefinitions} from '../lib/remaining-information.js';
import {readSfcActivity} from '../lib/sfc-activity.js';
import {readCmhcRent,CMHC_RENT_URLS} from '../lib/cmhc-rent.js';

const root=new URL('../verification/remaining-gaps-2026-10-20/',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const now='2026-10-20T15:00:00.000Z';
const clone=structuredClone;
const sources={
  college_activity:{desk:'scotland',country:'Scotland'},
  rental_benchmark:{desk:'canada',country:'Canada'},
};
function desk(source,value) {
  const identity=sources[source];
  return {site:'https://morningrows.com',country:identity.country,sources:{[source]:{status:value===null?'error':'ok',fetched_at:now}},
    _meta:{schema_version:'1.0',id:`https://morningrows.com/${identity.desk}.json`,catalog:`https://morningrows.com/catalog.json?desk=${identity.desk}`},[source]:value};
}
function validate(schema,cases) {
  // Python's independent Draft 2020-12 engine checks the published JSON schema;
  // reader validators are deliberately not called to decide schema validity.
  const result=spawnSync('python3',['-c',`
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
    errors=list(validator.iter_errors(case["value"]))
    if (not errors) != case["valid"]:
        failures.append({"name":case["name"],"expected_valid":case["valid"],"errors":[e.message[:250] for e in errors[:1]]})
print(json.dumps({"cases":len(payload["cases"]),"failures":failures}))
sys.exit(bool(failures))
  `],{input:JSON.stringify({schema,cases}),encoding:'utf8',maxBuffer:4*1024*1024});
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(result.stdout);
}
async function specimens() {
  return {
    college_activity:await readSfcActivity({fetcher:async()=>new Response(readFileSync(new URL('prior-audit/sfc/original/tables.xlsx',root))),now:()=>now}),
    rental_benchmark:await readCmhcRent({fetcher:async url=>new Response(read('cmhc-rent/original/'+({data:'points.json',series:'series.json',cube:'cube-response-excerpt.json'})[Object.entries(CMHC_RENT_URLS).find(([,target])=>target===url)[0]])),now:()=>now}),
  };
}

test('remaining native schemas independently reject wrong cohort, unit, coverage and missingness',async t=>{
  const schema=clone(INFORMATION_SCHEMA);installRemainingSchema(schema);
  const native=await specimens(),cases=[];
  for(const [source,value] of Object.entries(native)) {
    cases.push({name:source+' original reader specimen',valid:true,value:desk(source,value)});
    cases.push({name:source+' isolated failure',valid:true,value:desk(source,null)});
  }
  const bad=(source,name,change)=>{
    const value=desk(source,clone(native[source]));change(value[source],value);
    cases.push({name:source+' '+name,valid:false,value});
  };
  for(const source of Object.keys(native)) {
    for(const [name,change] of Object.entries({
      missing_row:v=>v.rows.pop(),duplicate_row:v=>v.rows[1]=clone(v.rows[0]),
      reordered_rows:v=>v.rows.reverse(),null_count:v=>v.rows[0].value=null,
      numeric_string:v=>v.rows[0].value='0',fractional_count:v=>v.rows[0].value=0.5,
      suppression_as_zero:v=>{v.rows[0].value=0;v.rows[0].value_state='suppressed';},
      wrong_unit:v=>v.rows[0].unit='people',wrong_period_shape:v=>v.rows[0].period='latest',
      extra_unqualified_percentage:v=>v.rows[0].whole_population_percent=80,
      country_substitution:(v,body)=>body.country='United Kingdom',
      missing_limitation:v=>delete v.limitations,
      explicit_false_finality:v=>v.final=true,
      missing_acquisition_provenance:v=>v.provenance=[],
    }))bad(source,name,change);
  }
  for(const [name,change] of Object.entries({
    headcount:v=>v.population='Individual students',
    wrong_edition:v=>v.period='2025-26',
    calendar_year_start:v=>v.period_start='2024-01-01',
    not_rounded_to_five:v=>v.rows[0].value=1,
    wrong_funding:v=>v.population='Scottish-domiciled students with public funding only',
  }))bad('college_activity',name,change);
  for(const [name,change] of Object.entries({
    zero_rent:v=>v.rows[0].value=0,
    wrong_census_area:v=>v.rows[0].dguid='2011S0503933',
    municipality_substitution:v=>v.rows[0].geography_type='Census subdivision',
    apartment_only:v=>v.definitions[0].population='Apartments only',
    wrong_reference_month:v=>v.rows[0].reference_date='2025-10-01',
    wrong_survey_month:v=>v.rows[0].survey_month='2025-01',
    monthly_period:v=>v.rows[0].period='2025-10',
    suppressed_zero:v=>{v.rows[0].status_code=9;v.rows[0].value=0;},
    confidential:v=>v.rows[0].security_level_code=1,
    invented_timezone:v=>v.rows[0].release_timezone='UTC',
    mismatched_symbol:v=>{v.rows[0].symbol_code=3;v.rows[0].symbol='none';},
    unknown_symbol:v=>v.rows[0].symbol_code=2,
    missing_conditional_licence:v=>delete v.licence_notice,
    invented_licence_acceptance:v=>v.licence_notice.accepted=true,
    no_conditions:v=>v.rows[0].licence_notice.conditions='Unrestricted',
    misleading_attribution:v=>v.licence_notice.source_notice='Source: CQC',
  }))bad('rental_benchmark',name,change);
  for(const source of ['college_activity']) {
    const value=clone(native[source]);value.rows[0].value=0;
    cases.push({name:source+' explicit numeric zero is structurally distinct from suppression',valid:true,value:desk(source,value)});
  }
  const result=validate(schema,cases);
  for(const name of ['remainingNiNative','remainingCqcNative','remainingOnsNative']) assert.equal(Object.hasOwn(schema.$defs,name),false,'Blocked candidate is not advertised by public schema: '+name);
  const length=schema.$defs.selected.allOf.length;installRemainingSchema(schema);
  assert.equal(schema.$defs.selected.allOf.length,length,'Installer idempotence');
  assert.ok(Buffer.byteLength(JSON.stringify(schema))<1_000_000,'Published schema remains bounded');
  t.diagnostic(`${result.cases} native cases; exact dates/values/arithmetic additionally checked by source readers`);
});

test('remaining schemas validate actual source, measure and exact-observation responses',async t=>{
  const schema=clone(INFORMATION_SCHEMA);installRemainingSchema(schema);
  const native=await specimens(),cases=[],selected={};
  async function select(source,measure,observation) {
    const identity=sources[source],result=await selectedResponse(desk(source,native[source]),{
      desk:identity.desk,source,entry:[source,source,'sources.'+source],measure,observation,
    },{now});
    assert.equal(result.status,200,JSON.stringify({source,error:result.body.error,message:result.body.message}));
    return JSON.parse(JSON.stringify(result.body));
  }
  for(const source of Object.keys(native)) {
    const full=await select(source);
    cases.push({name:source+' complete source selection',valid:true,value:full});
    for(const definition of remainingDefinitions(sources[source].desk,source)) {
      const measure=await select(source,definition.id),period=measure.observations[0].period;
      const exact=await select(source,definition.id,period);
      cases.push({name:source+' '+definition.id+' measure',valid:true,value:measure});
      cases.push({name:source+' '+definition.id+' exact',valid:true,value:exact});
      selected[source]??=exact;
    }
  }
  const bad=(source,name,change)=>{
    const value=clone(selected[source]);change(value);
    cases.push({name:source+' '+name,valid:false,value});
  };
  for(const source of Object.keys(native)) {
    for(const [name,change] of Object.entries({
      missing_source:v=>delete v.source,
      disguised_source:v=>v.source='https://morningrows.com/canada.json?source=exchange',
      foreign_host:v=>v.id=v.id.replace('morningrows.com','example.org'),
      wrong_desk:v=>v.desk='https://morningrows.com/united-kingdom.json',
      extra_selector:v=>v.id+='&geography=all',
      missing_observation:v=>v.observations=[],
      duplicate_observation:v=>v.observations.push(clone(v.observations[0])),
      unknown_observation_field:v=>v.observations[0].id+='&unknown=true',
      wrong_observation_measure:v=>v.observations[0].measure+='other',
      wrong_unit:v=>v.observations[0].definition.unit='people',
      wrong_population:v=>v.observations[0].definition.population='All residents',
      null_value:v=>v.observations[0].value=null,
      suppressed_zero:v=>{v.observations[0].value=0;v.observations[0].value_state='suppressed';},
      qualifications_missing:v=>delete v.observations[0].qualifications,
      qualifications_wrong_unit:v=>v.observations[0].qualifications.unit='percent',
      invented_publication:v=>v.observations[0].published_at=now,
      unknown_period:v=>v.observations[0].period='latest',
      invalid_version:v=>v.observations[0].version='wrong',
      invalid_pointer:v=>v.observations[0].native_pointer+='/other',
      invalid_context:v=>delete v.context.limitations,
      invalid_retrieval_clock:v=>v.retrieval.retrieved_at='2026-02-30T00:00:00Z',
      unexpected_native_field:v=>v.data.unsupported_quality_rate=80,
    }))bad(source,name,change);
  }
  bad('college_activity','wrong frozen academic year',v=>v.id=v.id.replace('2024-25','2025-26'));
  bad('rental_benchmark','omitted HMIP recipient conditions',v=>delete v.observations[0].qualifications.licence_notice.conditions);
  bad('rental_benchmark','publisher flag mismatch',v=>v.observations[0].publisher_status.symbol='revised');
  const result=validate(schema,cases);
  t.diagnostic(`${result.cases} actual selected-response and adversarial schema cases`);
});
