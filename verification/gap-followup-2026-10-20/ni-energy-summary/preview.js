// Isolated protected remote-dev evidence. Only /live fetches one publisher article.
import article from '../access-review/ni-article/statistical-article.excerpt.html';
import {readNiEnergySummary,NI_ENERGY_SUMMARY_CONTRACT as C} from '../../../lib/ni-energy-summary.js';
import {readSections,SourceError} from '../../../lib/sources.js';
const fixture_clock='2026-10-20T12:10:43.050Z';
const alterations={
 'wrong-edition':s=>s.replace('Latest results published 3 September 2026','Latest results published 3 December 2026'),
 'wrong-window':s=>s.replace('Key points for the 12-month period July 2025 to June 2026','Key points for the 12-month period July 2024 to June 2025'),
 'wrong-method':s=>s.replace('approach in March 2026','approach in March 2025'),
 'wrong-geography':s=>s.replace('Generation in Northern Ireland are published','Generation in Ireland are published'),
 'missing':s=>s.replace('(4,431 GWh)','( GWh)'),
 'suppression':s=>s.replace('(4,431 GWh)','(.. GWh)'),
 'prior-imports':s=>s.replace('with net imports of 578 GWh','with net imports of 172 GWh'),
 'duplicate':s=>s+s,
 'conflicting-total':s=>s.replace('to 8,865 GWh in the year to June 2026','to 8,864 GWh in the year to June 2026'),
 'denominator':s=>s.replace('50% of gross final electricity consumption','50% of total electricity generation'),
 'zero-imports':s=>s.replaceAll('8,865','8,286').replace('equivalent to 50%','equivalent to 53%').replace('In the year to June 2026, Northern Ireland imported more than it exported with net imports of 578','In the year to June 2026, Northern Ireland imported as much as it exported with net imports of 0'),
 'negative-imports':s=>s.replaceAll('8,865','8,000').replace('equivalent to 50%','equivalent to 55%').replace('In the year to June 2026, Northern Ireland imported more than it exported with net imports of 578','In the year to June 2026, Northern Ireland exported more than it imported with net imports of -286'),
};
export default {async fetch(request){
 const url=new URL(request.url),live=url.pathname==='/live',fault=url.searchParams.get('fault')||'none';
 if(!live&&url.pathname!=='/case')return new Response('Not found',{status:404});
 if(!live&&!['none','redirect','http','timeout','oversize','bad-clock',...Object.keys(alterations)].includes(fault))return new Response('Unknown case',{status:400});
 const started_at=new Date().toISOString(),calls=[];
 const fetcher=async(target,options)=>{
  calls.push({url:target,accept:options.headers.accept,redirect:options.redirect});
  if(fault==='http')throw new SourceError('Constructed publisher HTTP403',403);
  if(fault==='timeout')throw new DOMException('Constructed timeout','TimeoutError');
  if(fault==='redirect')return new Response(null,{status:302,headers:{location:C.report_url,'content-type':'text/html'}});
  const body=fault==='oversize'?' '.repeat(C.max_bytes+1):(alterations[fault]?.(article)||article);
  return new Response(body,{headers:{'content-type':'text/html; charset=utf-8'}});
 };
 const body=await readSections({electricity_balance:()=>live?readNiEnergySummary():readNiEnergySummary({fetcher,now:()=>fault==='bad-clock'?'2026-09-02T00:00:00Z':fixture_clock}),sibling:async()=>({value:7})});
 return Response.json({kind:live?'Actual live NI summary reader':'Constructed fixture through actual NI summary reader',fixture:!live,fixture_clock:live?null:fixture_clock,fault:live?null:fault,started_at,finished_at:new Date().toISOString(),calls,body});
}};
