import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {readNiEnergySummary,NI_ENERGY_SUMMARY_CONTRACT as C} from '../lib/ni-energy-summary.js';
import {catalogue,INFORMATION_SCHEMA,selectedResponse,validateSelection} from '../lib/information.js';
import worker from '../worker.js';

const excerpt=readFileSync(new URL('../verification/gap-followup-2026-10-20/access-review/ni-article/statistical-article.excerpt.html',import.meta.url),'utf8');
const now='2026-10-20T12:20:00.000Z';
const url='https://morningrows.com/northern-ireland.json?source=electricity_balance';
const values=[50,8865,4431,3855,578];
async function fixture(){
  const native=await readNiEnergySummary({fetcher:async()=>new Response(excerpt,{headers:{'content-type':'text/html'}}),now:()=>now});
  return {site:'https://morningrows.com',country:'Northern Ireland',electricity_balance:native,
    sources:{electricity_balance:{status:'ok',fetched_at:now}},
    _meta:{schema_version:'1.0',id:'https://morningrows.com/northern-ireland.json',catalog:'https://morningrows.com/catalog.json?desk=northern-ireland'}};
}
function selection(measure,observation){
  const target=new URL(url);
  if(measure!==undefined)target.searchParams.set('measure',measure);
  if(observation!==undefined)target.searchParams.set('observation',observation);
  return validateSelection(target);
}
async function selected(body,measure,observation){
  return selectedResponse(body,selection(measure,observation),{now});
}
function schemaCases(cases){
  const result=spawnSync('python3',['-c',`
import json,sys
from jsonschema import Draft202012Validator,FormatChecker
p=json.load(sys.stdin);Draft202012Validator.check_schema(p['schema'])
v=Draft202012Validator(p['schema'],format_checker=FormatChecker());fail=[]
for c in p['cases']:
 errors=list(v.iter_errors(c['value']))
 if (not errors)!=c['valid']:fail.append({'case':c['name'],'errors':[e.message[:180] for e in errors[:2]]})
print(json.dumps({'cases':len(p['cases']),'failures':fail}));sys.exit(bool(fail))
`],{input:JSON.stringify({schema:INFORMATION_SCHEMA,cases}),encoding:'utf8',maxBuffer:4*1024*1024});
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(result.stdout);
}

test('NI fixed-edition discovery and selectors keep exact measure, period and evidence boundaries',async()=>{
  const body=await fixture(),card=catalogue('northern-ireland').sources.find(s=>s.key==='electricity_balance');
  assert.equal(card.measure_count,5);assert.equal(card.representation,'described_measures');
  const whole=await selected(body);assert.equal(whole.status,200);
  assert.deepEqual(whole.body.observations.map(o=>o.value),values);
  assert.equal(whole.body.context.metadata.fixed_edition,true);
  for(const [i,d] of body.electricity_balance.definitions.entries()){
    for(const period of [undefined,C.period]){
      const result=await selected(body,d.id,period);assert.equal(result.status,200);
      const o=result.body.observations[0];
      assert.equal(o.value,values[i]);assert.equal(o.period,C.period);
      assert.equal(o.id,`${url}&measure=${d.id}&observation=2025-07-01%2F2026-06-30`);
      assert.equal(o.native_pointer,`/electricity_balance/rows/${i}`);
      assert.equal(o.published_at,null);
      assert.equal(o.qualifications.publication_date,'2026-09-03');
      assert.equal(o.qualifications.metadata_evidence.live_retrieved,false);
      assert.match(o.definition.limitations,/not.*calendar year/);
    }
    for(const wrong of ['2026','2026-06','2024-07-01/2025-06-30','2025-07-01/2026-07-01']){
      const result=await selected(body,d.id,wrong);
      assert.equal(result.status,404);assert.equal(result.body.error,'observation_not_retained');
      assert.equal(result.body.data,null);assert.deepEqual(result.body.observations,[]);
    }
  }
  assert.equal(selection(undefined,C.period).status,400);
  assert.equal(selection('generation_share').status,404);
  for(const suffix of ['&geography=UK','&date=2026-06','&source=people']){
    assert.equal(validateSelection(new URL(url+suffix)).status,400);
  }
});

test('NI selected records reject semantic drift and keep sibling source isolation',async()=>{
  for(const mutate of [
    v=>v.rows.pop(),v=>v.rows[0].value=null,v=>v.rows[0].unit='GWh',
    v=>v.rows[1].period='2026',v=>v.rows[1].geography='United Kingdom',
    v=>v.rows[2].value_state='suppressed',v=>v.rows.reverse(),
    v=>v.metadata.fixed_edition=false,v=>v.metadata.report_anchor.publication_date='2026-12-03',
    v=>v.metadata.methodology='Share of generation',v=>v.rows[0].metadata_evidence.live_retrieved=true,
    v=>v.provenance=[],v=>v.provenance[0].retrieved_at='2026-10-21T00:00:00.000Z',
  ]){
    const body=await fixture();mutate(body.electricity_balance);
    const result=await selected(body,'renewable_share_gfec');
    assert.equal(result.status,503,mutate.toString());assert.deepEqual(result.body.observations,[]);
  }
  const body=await fixture();
  body.electricity_balance=null;body.sources.electricity_balance.status='error';
  body.next_holiday={title:'Christmas Day',date:'2026-12-25'};
  body.sources.next_holiday={status:'ok',fetched_at:now};
  const sibling=await selectedResponse(body,validateSelection(new URL('https://morningrows.com/northern-ireland.json?source=next_holiday')));
  assert.equal(sibling.status,200);assert.deepEqual(sibling.body.data,body.next_holiday);
  assert.equal((await selected(body)).status,503);
});

test('NI native and selected schemas independently reject incorrect meanings, coverage and provenance',async t=>{
  const body=await fixture(),cases=[{name:'native',valid:true,value:body}];
  const whole=(await selected(body)).body;cases.push({name:'source',valid:true,value:whole});
  for(const d of body.electricity_balance.definitions){
    cases.push({name:d.id+' measure',valid:true,value:(await selected(body,d.id)).body});
    cases.push({name:d.id+' exact period',valid:true,value:(await selected(body,d.id,C.period)).body});
  }
  const bad=(name,mutate,base=body)=>{const value=structuredClone(base);mutate(value);cases.push({name,valid:false,value});};
  for(const [name,change] of Object.entries({
    wrong_country:b=>b.country='United Kingdom',
    no_provenance:b=>b.electricity_balance.provenance=[],
    future_edition:b=>b.electricity_balance.edition='fixed_2026-12-03',
    different_method:b=>b.electricity_balance.metadata.methodology='Generation share',
    unqualified_revision:b=>b.electricity_balance.metadata.revision_status='Final',
    missing_cell:b=>b.electricity_balance.rows.pop(),
    duplicate_cell:b=>b.electricity_balance.rows[1]=structuredClone(b.electricity_balance.rows[0]),
    null_to_zero:b=>{b.electricity_balance.rows[0].value=0;b.electricity_balance.rows[0].value_state='missing';},
    numeric_string:b=>b.electricity_balance.rows[0].value='50',
    false_live_metadata:b=>b.electricity_balance.rows[0].metadata_evidence.live_retrieved=true,
  }))bad(name,change);
  bad('selected wrong period',v=>v.observations[0].period='2026',whole);
  bad('selected wrong definition',v=>v.observations[0].definition.population='United Kingdom households',whole);
  bad('invented publication instant',v=>v.observations[0].published_at='2026-09-03T00:00:00Z',whole);
  bad('selected wrong pointer',v=>v.observations[0].native_pointer='/electricity_balance/rows/4',whole);
  t.diagnostic(JSON.stringify(schemaCases(cases)));
});

test('NI discovery preserves the original report failure and describes the newly supported fixed edition',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw Error('No upstream requests');});
  const keys=await(await worker.fetch(new Request('https://morningrows.com/keys.json'),{})).json();
  const old=keys.blocked.find(x=>x.source.startsWith('DfE/NISRA'));
  assert.equal(old.status,'invalid_response');assert.match(old.note,/datavis route remains unused/);
  assert.match(old.note,/separate official DfE article/);
  const text=await(await worker.fetch(new Request('https://morningrows.com/llms.txt'),{})).text();
  assert.match(text,/fixed July 2025–June 2026 edition/);
  assert.match(text,/future editions require separate review/);
});
