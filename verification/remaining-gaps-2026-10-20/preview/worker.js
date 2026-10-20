// Isolated actual-reader proof; no fixtures, persistent resources or production routes.
import {readSfcActivity} from '../../../lib/sfc-activity.js';
import {readCqcCohort} from '../../../lib/cqc-cohort.js';
import {readOnsRent} from '../../../lib/ons-rent.js';
import {readCmhcRent} from '../../../lib/cmhc-rent.js';
import {readSections,SourceError} from '../../../lib/sources.js';
export default {async fetch(request){
  const url=new URL(request.url);
  if(url.pathname!=='/read-once')return new Response('Not found',{status:404});
  const started_at=new Date().toISOString(),timings={};
  const readers={college_activity:readSfcActivity,care_assessment_cohort:readCqcCohort,bedroom_rent:readOnsRent,rental_benchmark:readCmhcRent};
  const selected=url.searchParams.has('sources')?url.searchParams.get('sources').split(','):Object.keys(readers);
  if(!selected.length||new Set(selected).size!==selected.length||selected.some(key=>!Object.hasOwn(readers,key)))return new Response('Invalid source selection',{status:400});
  const tasks=Object.fromEntries(selected.map(source=>[source,async()=>{
    timings[source]={started_at:new Date().toISOString()};
    try{return await readers[source]();}
    finally{timings[source].finished_at=new Date().toISOString();}
  }]));
  // This explicit harness-only failure exercises the same isolation wrapper.
  // Its deliberate error is never submitted as a monitoring report.
  tasks.injected_isolation_failure=async()=>{throw new SourceError('Deliberate harness-only source failure');};
  const body=await readSections(tasks);
  return Response.json({
    kind:'Protected actual source-reader proof; selected sources, one invocation each',selected_sources:selected,
    fixture:false,clock:'Actual Worker UTC clock',started_at,finished_at:new Date().toISOString(),
    timings,body,cpu_ms:null,cpu_evidence:'Unmeasured; elapsed wall time is not billed CPU. Exact integrated-version trace remains a release gate.',
  });
}};
