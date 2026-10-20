// Repeated genuine original-source reads with no cache or retained specimen.
import {readUsCpi} from '../../../lib/us-cpi.js';
export default {async fetch(request) {
 const started=Date.now();let calls=0;
 try {
  const result=await readUsCpi({fetcher:(...args)=>{calls++;return fetch(...args);}});
  return Response.json({checked_at:new Date().toISOString(),colo:request.cf?.colo||null,elapsed_ms:Date.now()-started,publisher_calls:calls,latest_period:result.latest_period,rows:result.rows,provenance:result.provenance});
 } catch {return Response.json({error:'live_reader_failed',publisher_calls:calls,elapsed_ms:Date.now()-started},{status:503});}
}};
