// One unchanged live invocation. No fixtures, storage, routes or fallback.
import {readNiEnergy} from '../../../lib/ni-energy.js';
import {readSections} from '../../../lib/sources.js';
export default {async fetch(request) {
  if(new URL(request.url).pathname!=='/read-once')return new Response('Not found',{status:404});
  const started_at=new Date().toISOString();
  const body=await readSections({electricity_balance:()=>readNiEnergy()});
  return Response.json({kind:'Actual readNiEnergy through protected Cloudflare remote dev',fixture:false,started_at,finished_at:new Date().toISOString(),body});
}};
