// Protected remote-dev test harness. Never part of the production entrypoint.
import csv from './original/nomis-national.csv';
import time from './original/nomis-time.json';
import {readClaimantCount} from '../../lib/claimant-count.js';
import {readSections, SourceError} from '../../lib/sources.js';
import {validateSelection, selectedResponse} from '../../lib/information.js';

export default {async fetch(request) {
  const u=new URL(request.url),fault=u.searchParams.get('fault')||'none';
  if(!['none','http','timeout','oversize','invalid-json','partial','wrong-geography','suppression','revision'].includes(fault))return Response.json({error:'invalid_case'},{status:400});
  const desk='northern-ireland';
  const fetcher=async input=>{
    if(fault==='http')throw new SourceError('Constructed publisher HTTP refusal',429);
    if(fault==='timeout')throw new DOMException('Constructed transport timeout','TimeoutError');
    if(fault==='oversize')return new Response('x'.repeat(400000));
    if(input.includes('/time.def.'))return new Response(fault==='invalid-json'?'invalid':JSON.stringify(time));
    let text=csv;
    if(fault==='partial')text=text.trim().split('\n').slice(0,-1).join('\n')+'\n';
    if(fault==='wrong-geography')text=text.replaceAll('N92000002','E92000001');
    if(fault==='suppression')text=text.replace('"F","Free (free for publication)"','"S","Suppressed"');
    if(fault==='revision')text=text.replace('34155','34160');
    return new Response(text);
  };
  const body={country:'Northern Ireland',...await readSections({
    claimant_count:()=>readClaimantCount(desk,{fetcher}),
    fixture_sibling:async()=>({value:7,unit:'constructed control',geography:'Northern Ireland'}),
  })};
  const selector=new URL('https://morningrows.com/northern-ireland.json?source=claimant_count&measure=claimants');
  if(u.searchParams.has('observation'))selector.searchParams.set('observation',u.searchParams.get('observation'));
  const selection=validateSelection(selector,desk);
  const selected=await selectedResponse(body,selection);
  return Response.json({fault,constructed:true,selected_status:selected.status,selected:selected.body,
    sibling:body.fixture_sibling,sibling_health:body.sources.fixture_sibling,source_health:body.sources.claimant_count});
}};
