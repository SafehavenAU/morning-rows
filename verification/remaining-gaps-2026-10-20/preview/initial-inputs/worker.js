// Isolated actual-reader proof; no fixtures, persistent resources or production routes.
import {readSfcActivity} from '../../../lib/sfc-activity.js';
import {readCqcCohort} from '../../../lib/cqc-cohort.js';
import {readOnsRent} from '../../../lib/ons-rent.js';
import {readCmhcRent} from '../../../lib/cmhc-rent.js';
import {readSections,SourceError} from '../../../lib/sources.js';
export default {async fetch(request){
  if(new URL(request.url).pathname!=='/read-once')return new Response('Not found',{status:404});
  const started_at=new Date().toISOString(),timings={};
  const readers={college_activity:readSfcActivity,care_assessment_cohort:readCqcCohort,bedroom_rent:readOnsRent,rental_benchmark:readCmhcRent};
  const tasks=Object.fromEntries(Object.entries(readers).map(([source,read])=>[source,async()=>{
    timings[source]={started_at:new Date().toISOString()};
    try{return await read();}
    finally{timings[source].finished_at=new Date().toISOString();}
  }]));
  // This explicit harness-only failure exercises the same isolation wrapper.
  // Its deliberate error is never submitted as a monitoring report.
  tasks.injected_isolation_failure=async()=>{throw new SourceError('Deliberate harness-only source failure');};
  const body=await readSections(tasks);
  return Response.json({
    kind:'Protected actual source-reader proof; four sources, one invocation each',
    fixture:false,clock:'Actual Worker UTC clock',started_at,finished_at:new Date().toISOString(),
    timings,body,cpu_ms:null,cpu_evidence:'Unmeasured; elapsed wall time is not billed CPU. Exact integrated-version trace remains a release gate.',
  });
}};
