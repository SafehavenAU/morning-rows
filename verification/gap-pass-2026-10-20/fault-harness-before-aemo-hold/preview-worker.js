// Constructed specimens only. This protected dev harness never calls a publisher,
// uses a secret binding, changes production, or substitutes for live evidence.
import saCsv from './aemo/original/monthly-SA1-2026-10-19.csv';
import vicCsv from './aemo/original/monthly-VIC1-2026-10-19.csv';
import bocWindow from './boc/original/window.json';
import bocLatest from './boc/original/latest.json';
import jobsData from './statcan/jobs/original/wds-selected.json';
import jobsSeries from './statcan/jobs/original/series-metadata.json';
import jobsCube from './statcan/jobs/original/cube-metadata.json';
import cpiData from './statcan/price_index/original/wds-selected.json';
import cpiSeries from './statcan/price_index/original/series-metadata.json';
import cpiCube from './statcan/price_index/original/cube-metadata.json';
import shopData from './statcan/shop/original/wds-selected.json';
import shopSeries from './statcan/shop/original/series-metadata.json';
import shopCube from './statcan/shop/original/cube-metadata.json';
import homesData from './statcan/homes/original/wds-selected.json';
import homesSeries from './statcan/homes/original/series-metadata.json';
import homesCube from './statcan/homes/original/cube-metadata.json';
import wraCsv from './wra/original/wra-data.csv';
import {readAemoDay} from '../../lib/aemo-day.js';
import {readBocHistory,bocHistoryWindow,bocHistoryUrls} from '../../lib/boc-history.js';
import {readStatcanHeadline,STATCAN_HEADLINE_URLS} from '../../lib/statcan-headlines.js';
import {walesTax,WRA_URL} from '../../lib/fiscal-observations.js';
import {readSections,readBounded} from '../../lib/sources.js';
import {validateSelection,selectedResponse} from '../../lib/information.js';

const clock='2026-10-20T10:00:00.000Z';
const permitted={
 grid_day:['none','wrong-region','forecast','missing-day','http','timeout','reversed','acquisition-only','balanced-revision'],
 exchange_history:['none','wrong-direction','missing-pair','stale-tail','acquisition-only','revision'],
 jobs:['none','wrong-province','reversed','acquisition-only'],
 price_index:['none','unit'],
 shop:['none','suppression'],
 homes:['none','quarter-unit'],
 land_transaction_tax:['none','missing','suppression','unit','null-native-row'],
};
const statcan={jobs:{data:jobsData,series:jobsSeries,cube:jobsCube},price_index:{data:cpiData,series:cpiSeries,cube:cpiCube},shop:{data:shopData,series:shopSeries,cube:shopCube},homes:{data:homesData,series:homesSeries,cube:homesCube}};
function rows(text){const [header,...records]=text.trimEnd().split(/\r?\n/);return {header,records};}
function aemoText(text,fault){
 if(fault==='wrong-region')return text.replace('SA1,','VIC1,');
 if(fault==='forecast')return text.replace('TRADE','FORECAST');
 if(fault==='acquisition-only')return '\uFEFF'+text;
 const {header,records}=rows(text);
 if(fault==='missing-day')records.pop();
 if(fault==='reversed')records.reverse();
 if(fault==='balanced-revision')for(const [index,delta] of [[0,.01],[1,-.01]]){const row=records[index].split(',');row[3]=(Number(row[3])+delta).toFixed(2);records[index]=row.join(',');}
 return [header,...records].join('\n')+'\n';
}

export default {async fetch(request){
 const url=new URL(request.url),key=url.searchParams.get('source')||'grid_day',fault=url.searchParams.get('fault')||'none';
 if(!Object.hasOwn(permitted,key)||!permitted[key].includes(fault))return Response.json({error:'invalid_case'},{status:400});
 const desk=key==='grid_day'?'australia':key==='land_transaction_tax'?'wales':'canada',calls=[];
 let read;
 if(key==='grid_day'){
  read=()=>readAemoDay({now:()=>clock,fetcher:async input=>{
   const region=String(input).includes('_SA1.csv')?'SA1':String(input).includes('_VIC1.csv')?'VIC1':null;
   if(!region)throw Error('Unexpected fixture URL');
   calls.push({role:region,url:String(input)});
   if(fault==='http')return new Response('Constructed refusal',{status:429});
   if(fault==='timeout'&&region==='SA1')throw new DOMException('Constructed timeout','TimeoutError');
   const applied=region==='SA1'||['reversed','acquisition-only'].includes(fault)?fault:'none';
   return new Response(aemoText(region==='SA1'?saCsv:vicCsv,applied));
  }});
 }else if(key==='exchange_history'){
  const specimens={window:structuredClone(bocWindow),latest:structuredClone(bocLatest)},urls=bocHistoryUrls(bocHistoryWindow(clock));
  if(fault==='wrong-direction')specimens.window.seriesDetail.FXUSDCAD.label='CAD/USD';
  if(fault==='missing-pair')delete specimens.window.observations[0].FXGBPCAD;
  if(fault==='stale-tail')specimens.window.observations.pop();
  if(fault==='revision')specimens.window.observations[0].FXUSDCAD.v='1.4022';
  read=()=>readBocHistory({now:()=>clock,fetcher:async input=>{
   const role=Object.keys(urls).find(k=>urls[k]===String(input));if(!role)throw Error('Unexpected fixture URL');
   calls.push({role,url:String(input)});return new Response(JSON.stringify(specimens[role],null,fault==='acquisition-only'?2:0));
  }});
 }else if(Object.hasOwn(statcan,key)){
  const specimens=structuredClone(statcan[key]),point=specimens.data[0].object.vectorDataPoint[0];
  if(fault==='wrong-province'){
   const coordinate=Number(specimens.series[0].object.coordinate.split('.')[0]);
   specimens.cube[0].object.dimension.find(d=>d.dimensionPositionId===1).member.find(m=>m.memberId===coordinate).memberNameEn='Wrong province';
  }
  if(['unit','quarter-unit'].includes(fault))point.scalarFactorCode++;
  if(fault==='suppression')point.securityLevelCode=1;
  if(fault==='reversed'){specimens.data.reverse();specimens.series.reverse();}
  read=()=>readStatcanHeadline(key,{now:()=>clock,fetcher:async(input,options)=>{
   const role=Object.keys(STATCAN_HEADLINE_URLS).find(k=>STATCAN_HEADLINE_URLS[k]===String(input));
   if(!role||options.method!=='POST')throw Error('Unexpected fixture acquisition');
   calls.push({role,method:options.method,body:JSON.parse(options.body)});
   return new Response(JSON.stringify(specimens[role],null,fault==='acquisition-only'?2:0));
  }});
 }else{
  let csv=wraCsv;
  if(fault==='missing'){const value=rows(csv);value.records.shift();csv=[value.header,...value.records].join('\n');}
  if(fault==='suppression')csv=csv.replace('Revised','Confidential');
  if(fault==='unit')csv=csv.replace('Tax due (£ million)','Tax receipts (£ million)');
  // The live readWalesTax wrapper has no injection point. Exercise its actual
  // bounded-read and parser path without replacing global fetch.
  read=async()=>{calls.push({role:'csv',url:WRA_URL});return walesTax(await readBounded(new Response(csv),1048576),new Date(clock));};
 }
 const body={...await readSections({[key]:read,fixture_sibling:async()=>({value:7,unit:'constructed control',geography:desk})})};
 if(key==='land_transaction_tax'&&fault==='null-native-row')body[key].rows[0]=null;
 // Explicit fixture clocks qualify the retained specimen; wall-clock execution
 // is recorded separately in the harness report and is never freshness proof.
 for(const health of Object.values(body.sources))health.fetched_at=clock;
 if(key==='grid_day'&&body[key])body.sources[key].status=body[key].status;
 const selector=new URL(`https://morningrows.com/${desk}.json?source=${key}`);
 for(const name of ['measure','observation'])if(url.searchParams.has(name))selector.searchParams.set(name,url.searchParams.get(name));
 const selection=validateSelection(selector,desk);
 const selected=selection.status?{status:selection.status,body:{error:selection.code,observations:[]}}:await selectedResponse(body,selection,{now:clock});
 return Response.json({source:key,fault,constructed:true,fixture_clock:clock,reader_path:key==='land_transaction_tax'?'actual WRA bounded-read/parser plus selector; live fetch wrapper not exercised':'actual injected reader plus selector',calls,selected_status:selected.status,selected:selected.body,sibling:body.fixture_sibling,sibling_health:body.sources.fixture_sibling,source_health:body.sources[key]});
}};
