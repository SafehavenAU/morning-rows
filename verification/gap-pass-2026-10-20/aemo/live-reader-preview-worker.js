// One complete, unchanged live-reader invocation; no fixtures or fallback.
import {readAemoDay} from '../../../lib/aemo-day.js';
import {readSections} from '../../../lib/sources.js';
export default {async fetch(request){
 if(new URL(request.url).pathname!=='/read-once')return new Response('Not found',{status:404});
 const started_at=new Date().toISOString();
 const body=await readSections({grid_day:()=>readAemoDay()});
 if(body.grid_day)body.sources.grid_day.status=body.grid_day.status;
 if(body.grid_day?.status==='error')body.sources.grid_day.error='Neither requested AEMO region has a complete published day';
 return Response.json({kind:'One complete unchanged readAemoDay live invocation from protected Cloudflare remote dev',started_at,finished_at:new Date().toISOString(),fixture:false,body});
}};
