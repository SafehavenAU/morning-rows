// Constructed faults through the actual reader/selector in protected remote dev.
// No production entrypoint, runtime secret, live publisher or durable write.
import avondale from './original/avondale-ajax.html';
import kelburn from './original/kelburn-ajax.html';
import {readNzMarketRent} from '../../lib/nz-market-rent.js';
import {readSections,SourceError} from '../../lib/sources.js';
import {validateSelection,selectedResponse} from '../../lib/information.js';

export default {async fetch(request){
 const url=new URL(request.url),fault=url.searchParams.get('fault')||'none';
 if(!['none','http','timeout','oversize','invalid-json','wrong-geography','unknown-token','bedroom-five','currency','quartiles','truncated','mixed-period','future-period','one-http','revision','zero'].includes(fault))return Response.json({error:'invalid_case'},{status:400});
 const fetcher=async input=>{
  const a=String(input).includes('Avondale');
  if(fault==='http'||fault==='one-http'&&a)throw new SourceError('Constructed publisher refusal',429);
  if(fault==='timeout')throw new DOMException('Constructed transport timeout','TimeoutError');
  if(fault==='oversize')return new Response('x'.repeat(300000));
  if(fault==='invalid-json')return new Response('<html>Constructed outage</html>');
  let text=a?avondale:kelburn;
  if(fault==='wrong-geography')text=text.replace(a?'Auckland - Avondale':'Wellington - Kelburn','Christchurch - Avondale');
  if(fault==='unknown-token')text=text.replace(/<td>\d+<\/td>/,'<td>..</td>');
  if(fault==='bedroom-five')text=text.replace('5+ bedrooms','5 bedrooms');
  if(fault==='currency')text=text.replaceAll('$','£');
  if(fault==='quartiles')text=text.replace(/\$\d[\d,]*/,'$9,999,999');
  if(fault==='truncated')text=text.slice(0,text.lastIndexOf('</table>'));
  if(fault==='future-period')text=text.replace('01 Mar 2026 - 31 Aug 2026','01 Mar 2030 - 31 Aug 2030');
  if(fault==='mixed-period'&&a)text=text.replace('01 Mar 2026 - 31 Aug 2026','01 Feb 2026 - 31 Jul 2026');
  if(fault==='revision'&&a)text=text.replace('$550','$551');
  if(fault==='zero'&&a)text=text.replace('<td>91</td>','<td>0</td>');
  return new Response(JSON.stringify({Finder:'',Table:text}),{headers:{'content-type':'text/html'}});
 };
 const body={country:'New Zealand',...await readSections({
  market_rent:()=>readNzMarketRent({fetcher}),
  fixture_sibling:async()=>({value:7,unit:'constructed control',geography:'New Zealand'}),
 })};
 const selector=new URL('https://morningrows.com/new-zealand.json?source=market_rent');
 for(const key of ['measure','observation'])if(url.searchParams.has(key))selector.searchParams.set(key,url.searchParams.get(key));
 const selected=await selectedResponse(body,validateSelection(selector,'new-zealand'));
 return Response.json({fault,constructed:true,selected_status:selected.status,selected:selected.body,
  sibling:body.fixture_sibling,sibling_health:body.sources.fixture_sibling,source_health:body.sources.market_rent});
}};
