import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {isRemainingSource,remainingDefinitions,remainingCells,validateRemainingRepresentation} from '../lib/remaining-information.js';
import {selectedResponse,INFORMATION_SCHEMA,finishResponse} from '../lib/information.js';
const proof=JSON.parse(readFileSync(new URL('../verification/gap-followup-2026-10-20/cqc-pdf/worker-reader.json',import.meta.url)));
assert.equal(proof.pass,true);assert.equal(proof.code_unchanged,true);
const source='care_assessment_cohort',desk='england',url=`https://morningrows.com/${desk}.json?source=${source}`,now=proof.live.finished_at;
const native=proof.live.native;
const body=()=>({site:'https://morningrows.com',country:'England',[source]:structuredClone(native),sources:{[source]:{status:'ok',fetched_at:now}},_meta:{schema_version:'1.0',id:'https://morningrows.com/england.json',catalog:'https://morningrows.com/catalog.json?desk=england'}});
// Root separately applies inventory/Worker wiring; these direct adapter tests do
// not claim that the isolated candidate is activated in shared discovery yet.
const selection=(measure,observation)=>({desk,source,entry:[source,source,'sources.'+source],measure,observation});
const select=(b,measure,observation)=>selectedResponse(b,selection(measure,observation),{now});
function schemas(cases){
 const r=spawnSync('python3',['-c',`
import json,sys,datetime,urllib.parse
from jsonschema import Draft202012Validator,FormatChecker
p=json.load(sys.stdin);fc=FormatChecker()
@fc.checks('date-time')
def dt(v):
 if not isinstance(v,str):return True
 try:return v.endswith('Z') and datetime.datetime.fromisoformat(v[:-1]+'+00:00').tzinfo is not None
 except ValueError:return False
@fc.checks('uri')
def uri(v):
 if not isinstance(v,str):return True
 p=urllib.parse.urlparse(v);return p.scheme in ('https','http') and bool(p.netloc)
Draft202012Validator.check_schema(p['schema']);validator=Draft202012Validator(p['schema'],format_checker=fc);failed=[]
for c in p['cases']:
 errors=list(validator.iter_errors(c['value']))
 if (not errors)!=c['valid']:failed.append({'case':c['name'],'errors':[e.message[:150]for e in errors[:2]]})
print(json.dumps({'cases':len(p['cases']),'failures':failed}));sys.exit(bool(failed))
`],{input:JSON.stringify({schema:INFORMATION_SCHEMA,cases}),encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(r.status,0,r.stdout+r.stderr);return JSON.parse(r.stdout);
}
test('five exact CQC definitions and cells retain source-bound cohort semantics',()=>{assert.equal(isRemainingSource(desk,source),true);const ds=remainingDefinitions(desk,source);assert.deepEqual(ds.map(d=>d.id),['inadequate','requires_improvement','good','outstanding','total']);assert.ok(ds.every(d=>d.geography==='England'&&d.unit==='ratings'&&d.publication_evidence.live_retrieved===false));const cells=remainingCells(desk,source,native,{retrieved_at:now});assert.deepEqual(cells.map(c=>c.value),[125,809,2063,65,3062]);assert.deepEqual(cells.map(c=>c.pointer),['/rows/0','/rows/1','/rows/2','/rows/3','/rows/4']);});
test('actual native and all ten measure/exact selectors produce five fixed snapshot cells',async()=>{const b=body(),whole=await select(b);assert.equal(whole.status,200);assert.deepEqual(whole.body.data,native);assert.equal(whole.body.observations.length,5);for(const [i,d]of native.definitions.entries())for(const period of [undefined,'2025-08-01']){const s=await select(b,d.id,period);assert.equal(s.status,200);assert.equal(s.body.data.value,native.rows[i].value);assert.equal(s.body.observations[0].id,`${url}&measure=${d.id}&observation=2025-08-01`);assert.equal(s.body.observations[0].native_pointer,`/${source}/rows/${i}`);assert.equal(s.body.observations[0].definition.publication_evidence.live_retrieved,false);assert.equal(s.body.context.publication_evidence.live_retrieved,false);assert.equal(s.body.observations[0].published_at,null);}});
test('unavailable periods and whole-source drift cannot silently substitute five retained values',async()=>{for(const date of ['2024-08-01','2025-08','2025','2025-08-02']){const s=await select(body(),'total',date);assert.equal(s.status,404);assert.equal(s.body.error,'observation_not_retained');assert.deepEqual(s.body.observations,[]);assert.equal(s.body.data,null);}const unknown=await select(body(),'providers');assert.equal(unknown.status,404);for(const mutate of [v=>v.rows.pop(),v=>v.rows[0].value=null,v=>v.rows[0].value++,v=>v.rows[0].unit='providers',v=>v.rows[0].value_state='suppressed',v=>v.geography='United Kingdom',v=>v.period='2025-09-01',v=>v.assessment_unit='Locations',v=>v.publication_evidence.live_retrieved=true,v=>v.provenance=[],v=>v.provenance[0].sha256='0'.repeat(64),v=>v.provenance[0].retrieved_at='2026-10-21T00:00:00Z']){const b=body();mutate(b[source]);const s=await select(b,'good');assert.equal(s.status,503,mutate.toString());assert.equal(s.body.data,null);assert.deepEqual(s.body.observations,[]);}});
test('a missing public acquisition clock cannot bypass the full PDF provenance guard',()=>{for(const acquisition of [{},undefined,{retrieved_at:'2026-02-30T00:00:00Z'},{retrieved_at:'2025-10-23T00:00:00Z'}])assert.equal(validateRemainingRepresentation(desk,source,native,acquisition),false);});
test('native and selected schema constrain exact PDF identity, all five semantic rows and source/id discriminators',async t=>{const b=body(),whole=(await select(b)).body,cases=[{name:'native',valid:true,value:b},{name:'source',valid:true,value:whole}];for(const d of native.definitions){cases.push({name:d.id,valid:true,value:(await select(b,d.id)).body},{name:d.id+' exact',valid:true,value:(await select(b,d.id,'2025-08-01')).body});}for(const mutate of [v=>v.country='Scotland',v=>v[source].geography='United Kingdom',v=>v[source].rows.reverse(),v=>v[source].rows.pop(),v=>v[source].rows[0].value=-1,v=>v[source].rows[0].value='125',v=>v[source].rows[0].value_state='suppressed',v=>v[source].rows[0].unit='locations',v=>v[source].metadata.fixed_edition=false,v=>v[source].publication_evidence.live_retrieved=true,v=>v[source].provenance=[],v=>v[source].provenance[0].sha256='0'.repeat(64),v=>v[source].provenance[0].bytes++,v=>v[source].provenance[0].retrieved_at='2026-02-30T00:00:00Z']){const v=structuredClone(b);mutate(v);cases.push({name:mutate.toString(),valid:false,value:v});}const one=(await select(b,'good')).body;for(const mutate of [v=>v.source='https://morningrows.com/scotland.json?source=college_activity',v=>delete v.source,v=>v.id='https://morningrows.com/england.json?source=care_assessment_cohort&measure=providers',v=>v.observations[0].definition.geography='United Kingdom',v=>v.observations[0].qualifications.period='2025-08-02',v=>v.observations[0].qualifications.unit='locations',v=>v.context.provenance[0].sha256='0'.repeat(64),v=>v.data.value_state='suppressed',v=>v.observations=[],v=>v.context.publication_evidence.live_retrieved=true]){const v=structuredClone(one);mutate(v);cases.push({name:mutate.toString(),valid:false,value:v});}const r=schemas(cases);t.diagnostic(JSON.stringify(r));});
test('acquisition-only changes preserve statistical versions and conditionals/HEAD remain exact',async()=>{const first=(await select(body(),'good')).body,b=body();b.sources[source].fetched_at='2026-10-20T15:00:00.000Z';b[source].provenance[0].retrieved_at=b.sources[source].fetched_at;const second=(await select(b,'good')).body;assert.equal(second.content_version,first.content_version);assert.equal(second.observations[0].version,first.observations[0].version);const initial=await finishResponse(new Request(first.id),Response.json(first),first.id),etag=initial.headers.get('etag');const conditional=await finishResponse(new Request(first.id,{headers:{'if-none-match':etag}}),Response.json(first),first.id);assert.equal(conditional.status,304);const head=await finishResponse(new Request(first.id,{method:'HEAD'}),Response.json(first),first.id);assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);});
