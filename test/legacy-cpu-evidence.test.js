import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGACY_COUNTRIES,LEGACY_CPU_PATHS,evaluateLegacyCpuEvidence} from '../scripts/lib/legacy-cpu-evidence.mjs';
import {PRODUCTION_ORIGINS} from '../scripts/lib/us-cpu-evidence.mjs';
// Minimal original public response fields from the 20 October staged c6a9628
// capture. AU/NZ carry world/space DATA in `also`, with health in top-level sources.
// Other fixture routes and traces below are explicitly constructed.
const actual = {
 "/australia.json": {
  "path": "/australia.json",
  "started_at": "2026-10-20T04:12:03.291Z",
  "at": "2026-10-20T04:12:14.421Z",
  "body": {
   "country": "Australia",
   "_meta": {
    "schema_version": "1.0"
   },
   "sources": {
    "grid": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "quakes": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "jobs": {
     "status": "error",
     "fetched_at": "2026-10-20T04:12:14.385Z",
     "error": "data.api.abs.gov.au returned HTTP 403",
     "http_status": 403
    },
    "price": {
     "status": "error",
     "fetched_at": "2026-10-20T04:12:14.385Z",
     "error": "data.api.abs.gov.au returned HTTP 403",
     "http_status": 403
    },
    "approvals": {
     "status": "error",
     "fetched_at": "2026-10-20T04:12:14.385Z",
     "error": "data.api.abs.gov.au returned HTTP 403",
     "http_status": 403
    },
    "wage": {
     "status": "error",
     "fetched_at": "2026-10-20T04:12:14.385Z",
     "error": "data.api.abs.gov.au returned HTTP 403",
     "http_status": 403
    },
    "shop": {
     "status": "error",
     "fetched_at": "2026-10-20T04:12:14.385Z",
     "error": "data.api.abs.gov.au returned HTTP 403",
     "http_status": 403
    },
    "people": {
     "status": "error",
     "fetched_at": "2026-10-20T04:12:14.385Z",
     "error": "data.api.abs.gov.au returned HTTP 403",
     "http_status": 403
    },
    "spend": {
     "status": "error",
     "fetched_at": "2026-10-20T04:12:14.385Z",
     "error": "data.api.abs.gov.au returned HTTP 403",
     "http_status": 403
    },
    "works": {
     "status": "error",
     "fetched_at": "2026-10-20T04:12:14.385Z",
     "error": "data.api.abs.gov.au returned HTTP 403",
     "http_status": 403
    },
    "service": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "cash": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "exchange": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "world": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "space": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "bonds": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "commodities": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "laws": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "money": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "credit": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "rba": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "hospital": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    },
    "rfs_incidents": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:14.385Z"
    }
   },
   "also": {
    "world": {
     "source": "World Bank",
     "status": "ok",
     "rows": [
      {
       "name": "population",
       "year": "2025",
       "value": 27614411,
       "geography": "Australia",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      },
      {
       "name": "gdp_usd",
       "year": "2025",
       "value": 1798518933689.21,
       "geography": "Australia",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      },
      {
       "name": "inflation",
       "year": "2025",
       "value": 2.87403791660173,
       "geography": "Australia",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      },
      {
       "name": "unemployment",
       "year": "2025",
       "value": 4.09,
       "geography": "Australia",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      },
      {
       "name": "life_years",
       "year": "2024",
       "value": 83.0512195121951,
       "geography": "Australia",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      }
     ]
    },
    "space": {
     "source": "NOAA space weather",
     "date": "2026-10-20",
     "radio": "0",
     "solar": "0",
     "geomagnetic": "0"
    }
   }
  }
 },
 "/new-zealand.json": {
  "path": "/new-zealand.json",
  "started_at": "2026-10-20T04:12:14.421Z",
  "at": "2026-10-20T04:12:21.918Z",
  "body": {
   "country": "New Zealand",
   "_meta": {
    "schema_version": "1.0"
   },
   "sources": {
    "prices": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    },
    "quakes": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    },
    "volcanoes": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    },
    "notices": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    },
    "stats": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    },
    "world": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    },
    "space": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    },
    "quake_stats": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    },
    "vehicle_fleet": {
     "status": "ok",
     "fetched_at": "2026-10-20T04:12:21.812Z"
    }
   },
   "also": {
    "world": {
     "source": "World Bank",
     "status": "ok",
     "rows": [
      {
       "name": "population",
       "year": "2025",
       "value": 5324700,
       "geography": "New Zealand",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      },
      {
       "name": "gdp_usd",
       "year": "2025",
       "value": 264057413739.965,
       "geography": "New Zealand",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      },
      {
       "name": "inflation",
       "year": "2025",
       "value": 2.8397963180572,
       "geography": "New Zealand",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      },
      {
       "name": "unemployment",
       "year": "2025",
       "value": 5.076,
       "geography": "New Zealand",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      },
      {
       "name": "life_years",
       "year": "2024",
       "value": 82.009756097561,
       "geography": "New Zealand",
       "source": "World Bank",
       "licence": "CC BY 4.0"
      }
     ]
    },
    "space": {
     "source": "NOAA space weather",
     "date": "2026-10-20",
     "radio": "0",
     "solar": "0",
     "geomagnetic": "0"
    }
   }
  }
 }
};
const approved={worker_version:'11111111-1111-1111-1111-111111111111',source_revision:'a'.repeat(40),build_fingerprint:'1'.repeat(16),source_dirty:false};
const candidate={worker_version:'22222222-2222-2222-2222-222222222222',source_revision:'b'.repeat(40),build_fingerprint:'2'.repeat(16),source_dirty:false};
const headers=value=>({'x-worker-version':value.worker_version,'x-source-revision':value.source_revision});
function fixture(){
 const checks=LEGACY_CPU_PATHS.map(path=>({
  path,started_at:'2026-10-20T04:12:00.000Z',at:'2026-10-20T04:12:01.000Z',
  body:path==='/health.json'?candidate:{country:LEGACY_COUNTRIES[path],_meta:{schema_version:'1.0'},sources:{sample:{status:'ok',fetched_at:'2026-10-20T04:12:00.500Z'}}},
  ...structuredClone(actual[path]||{}),override:true,status:200,json_valid:true,headers:headers(candidate),
 }));
 const events=checks.map(check=>({request_path:check.path,script_version:{id:candidate.worker_version},event_timestamp:Date.parse(check.started_at)+1,cpu_ms:500,outcome:'ok',exception_names:[]}));
 checks.push(...['before','after'].flatMap(phase=>PRODUCTION_ORIGINS.map(origin=>({path:'/health.json',origin,phase,override:false,status:200,body:approved,headers:headers(approved)}))));
 const deployment={id:'constructed',versions:[{version_id:approved.worker_version,percentage:100},{version_id:candidate.worker_version,percentage:0}]};
 return {checks,events,deployment_before:structuredClone(deployment),deployment_after:structuredClone(deployment)};
}
const evaluate=report=>evaluateLegacyCpuEvidence(report,approved,candidate.worker_version,candidate.source_revision);
const desk=(report,path)=>report.checks.find(check=>check.override&&check.path===path);

test('recorded AU/NZ also data without a second health registry is a valid fresh response',()=>{
 const report=fixture(),before=structuredClone(report),result=evaluate(report);
 assert.equal(result.budget_pass,true);assert.deepEqual(report,before,'Offline evaluation must not mutate evidence');
 for(const path of Object.keys(actual)){
  assert.equal(actual[path].body.also.sources,undefined);
  assert.deepEqual(Object.keys(actual[path].body.also),['world','space']);
  const freshness=result.desk_freshness.find(item=>item.path===path);
  assert.equal(freshness.pass,true);assert.equal(freshness.source_count,Object.keys(actual[path].body.sources).length);
  assert.equal(freshness.sources.every(source=>source.source.startsWith('sources.')),true);
 }
});
test('stale, missing and future top-level source attempts still reject actual AU/NZ shapes',()=>{
 for(const path of Object.keys(actual))for(const timestamp of [undefined,'2026-10-19T00:00:00Z','2026-10-21T00:00:00Z','invalid']){
  const report=fixture(),check=desk(report,path);Object.values(check.body.sources)[0].fetched_at=timestamp;
  assert.equal(evaluate(report).cold_retrieval_confirmed,false,`${path} ${timestamp}`);
  assert.equal(evaluate(report).budget_pass,false);
 }
});
test('an actual also.sources registry remains mandatory to validate when present',()=>{
 for(const path of Object.keys(actual)){
  const report=fixture(),check=desk(report,path),source={status:'ok',fetched_at:Object.values(check.body.sources)[0].fetched_at};
  check.body.also.sources={world:source};assert.equal(evaluate(report).budget_pass,true);
  for(const timestamp of [undefined,'2026-10-19T00:00:00Z','2026-10-21T00:00:00Z','invalid']){
   const changed=structuredClone(report);desk(changed,path).body.also.sources.world.fetched_at=timestamp;
   assert.equal(evaluate(changed).budget_pass,false,`${path} ${timestamp}`);
  }
  for(const malformed of [null,{},[],true]){
   const changed=structuredClone(report);desk(changed,path).body.also.sources=malformed;
   assert.equal(evaluate(changed).budget_pass,false,`${path} malformed registry`);
  }
 }
});
test('the 500ms gate and original trace, production, staging and identity checks remain enforced',()=>{
 for(const change of [
  report=>{report.cpu_limit_ms=1000;report.events[1].cpu_ms=501;},
  report=>report.events[1].cpu_ms=-1,report=>report.events[1].cpu_ms=NaN,
  report=>report.events[1].exception_names=['Error'],report=>report.events[1].outcome='exception',
  report=>report.events.pop(),report=>report.events.push(report.events[0]),
  report=>report.events[1].event_timestamp=0,report=>report.events[1].script_version.id='wrong',
  report=>desk(report,'/australia.json').headers['x-source-revision']='wrong',
  report=>desk(report,'/health.json').body={...candidate,source_dirty:true},
  report=>report.checks.at(-1).body={...approved,worker_version:'wrong'},
  report=>report.deployment_before.versions[1].percentage=1,
  report=>report.deployment_after.id='changed',report=>report.tail_parse_error=true,
 ]){
  const report=fixture();change(report);assert.equal(evaluate(report).budget_pass,false,String(change));
 }
});
