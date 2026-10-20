// Constructed faults through the actual reader and selector in protected dev.
// No live publisher, production route, credential binding or persistent writes.
import originalData from './original/wds-selected.json';
import originalSeries from './original/series-metadata.json';
import originalCube from './original/cube-metadata.json';
import {readStatcanGdp,STATCAN_GDP_URLS} from '../../lib/statcan-gdp.js';
import {readSections} from '../../lib/sources.js';
import {validateSelection,selectedResponse} from '../../lib/information.js';

export const faults=['none','http','timeout','oversize','invalid-json','invalid-utf8','wrong-geography','scalar','suppression','status','reversed','stale-quarter','missing-metadata','zero-denominator','preliminary','revised','revision','acquisition-only'];
export default {async fetch(request){
 const url=new URL(request.url),fault=url.searchParams.get('fault')||'none';
 if(!faults.includes(fault))return Response.json({error:'invalid_case'},{status:400});
 const data=structuredClone(originalData),series=structuredClone(originalSeries),cube=structuredClone(originalCube),points=data[0].object.vectorDataPoint;
 if(fault==='wrong-geography')cube[0].object.dimension[0].member[0].memberNameEn='Ontario';
 if(fault==='scalar')points[1].scalarFactorCode=3;
 if(fault==='suppression')points[1].securityLevelCode=1;
 if(fault==='status')points[1].statusCode=1;
 if(fault==='reversed')points.reverse();
 if(fault==='stale-quarter'){
  for(const [i,period]of ['2025-10-01','2026-01-01'].entries()){points[i].refPer=period;points[i].refPerRaw=i?'2026-03-01':'2025-12-01';}
 }
 if(fault==='missing-metadata')delete series[0].object.memberUomCode;
 if(fault==='zero-denominator')points[0].value=0;
 if(fault==='preliminary')points[1].symbolCode=1;
 if(fault==='revised')points[1].symbolCode=3;
 if(fault==='revision'){points[1].value+=1000;points[1].symbolCode=3;}
 const calls=[];
 const fetcher=async(input,options)=>{
  const role=Object.keys(STATCAN_GDP_URLS).find(k=>STATCAN_GDP_URLS[k]===String(input));
  if(!role||options.method!=='POST')throw Error('Unexpected fixture acquisition');
  calls.push({role,method:options.method,body:JSON.parse(options.body)});
  if(fault==='http'&&role==='data')return new Response('Constructed publisher refusal',{status:429});
  if(fault==='timeout'&&role==='data')throw new DOMException('Constructed timeout','TimeoutError');
  if(fault==='oversize'&&role==='data')return new Response('x'.repeat(17000));
  if(fault==='invalid-json'&&role==='data')return new Response('<html>Constructed outage</html>');
  if(fault==='invalid-utf8'&&role==='data')return new Response(new Uint8Array([0xff,0xfe]));
  const value={data,series,cube}[role];
  return new Response(JSON.stringify(value,null,fault==='acquisition-only'?2:0),{headers:{'content-type':'application/json'}});
 };
 const body={country:'Canada',...await readSections({
  product:()=>readStatcanGdp({fetcher}),
  fixture_sibling:async()=>({value:7,unit:'constructed control',geography:'Canada'}),
 })};
 const selector=new URL('https://morningrows.com/canada.json?source=product');
 for(const key of ['measure','observation'])if(url.searchParams.has(key))selector.searchParams.set(key,url.searchParams.get(key));
 const selection=validateSelection(selector,'canada');
 const selected=selection.status?{status:selection.status,body:{error:selection.code,observations:[]}}:await selectedResponse(body,selection);
 return Response.json({fault,constructed:true,calls,selected_status:selected.status,selected:selected.body,sibling:body.fixture_sibling,sibling_health:body.sources.fixture_sibling,source_health:body.sources.product});
}};
