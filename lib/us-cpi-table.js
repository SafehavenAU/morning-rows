import {SourceError} from './sources.js';
import {CPI_INDEX,selectCpiWorkbook} from './us-cpi-workbook.js';
import {cpiResult,cpiWindow,readCpiText} from './us-cpi.js';
export const CPI_TABLE='https://data.bls.gov/timeseries/CUUR0000SA0?years_option=all_years';
const fail=r=>{throw new SourceError('BLS CPI table: '+r);};
const requireValue=(ok,r)=>{if(!ok)fail(r);};
const single=(text,pattern,r)=>{const matches=[...text.matchAll(pattern)];requireValue(matches.length===1,r);return matches[0];};
export function parseCpiTable(html,edition){
 const catalog=single(html,/<table\b[^>]*\bid="catalog0"[^>]*>([\s\S]*?)<\/table>/gi,'catalog_identity')[1];
 const expected={'Series Id:':'CUUR0000SA0','Series Title:':'All items in U.S. city average, all urban consumers, not seasonally adjusted','Area:':'U.S. city average','Item:':'All items','Base Period:':'1982-84=100'};
 const fields=[...catalog.matchAll(/<th\b[^>]*>([^<>]*)<\/th>\s*<td\b[^>]*>([^<>]*)<\/td>/gi)];requireValue(fields.length===5&&new Set(fields.map(m=>m[1].trim())).size===5&&fields.every(m=>expected[m[1].trim()]===m[2].trim())&&/<td\b[^>]*>Not Seasonally Adjusted<\/td>/i.test(catalog),'definition_changed');
 const table=single(html,/<table\b([^>]*\bid="table0"[^>]*)>([\s\S]*?)<\/table>/gi,'table_identity');requireValue(/\baria-describedby="catalog0"/.test(table[1]),'catalog_relationship');
 const header=single(table[2],/<thead>([\s\S]*?)<\/thead>/gi,'header')[1],headings=[...header.matchAll(/<th\b[^>]*>([^<>]*)<\/th>/gi)].map(m=>m[1].trim());
 requireValue(JSON.stringify(headings)===JSON.stringify(['Year','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','HALF1','HALF2']),'month_headers');
 const foot=single(table[2],/<tfoot>([\s\S]*?)<\/tfoot>/gi,'footnotes')[1],noteText=foot.replace(/<br\s*\/?>/gi,'\n').replace(/<\/?(?:tr|td|br)\b[^>]*>/gi,'').trim();
 requireValue(!/[<>]/.test(noteText),'footnote_markup');const notes=new Map();for(const line of noteText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){const m=/^([XR])\s*:\s*(.+)$/.exec(line);requireValue(m&&!notes.has(m[1]),'unknown_footnote');requireValue(m[2]===(m[1]==='X'?'Data unavailable due to the 2025 lapse in appropriations':'Revised'),'footnote_changed');notes.set(m[1],m[2]);}
 const body=single(table[2],/<tbody>([\s\S]*?)<\/tbody>/gi,'rows')[1],years=new Map();let pos=0;
 for(const m of body.matchAll(/<tr\b[^>]*>\s*<th\b[^>]*>(\d{4})<\/th>([\s\S]*?)<\/tr>/gi)){requireValue(!body.slice(pos,m.index).trim()&&!years.has(m[1]),'year_coverage');pos=m.index+m[0].length;years.set(m[1],m[2]);}
 requireValue(!body.slice(pos).trim()&&[...years.keys()].sort().at(-1)===edition.slice(0,4),'edition_mismatch');
 const window=cpiWindow(edition),values=new Map();for(const year of new Set(window.map(p=>p.slice(0,4)))){requireValue(years.has(year),'missing_year');const raw=years.get(year),cells=[...raw.matchAll(/<td>([^<>]*)<\/td>/gi)];requireValue(cells.length===14&&!raw.replace(/<td>[^<>]*<\/td>/gi,'').trim(),'cell_coverage');values.set(year,cells.map(m=>m[1].trim()));}
 const latest=values.get(edition.slice(0,4));requireValue(latest.slice(Number(edition.slice(5)),12).every(v=>v===''||v==='&nbsp;'),'future_month');
 const rows=window.map(period=>{const cell=values.get(period.slice(0,4))[Number(period.slice(5))-1];if(cell===''||cell==='&nbsp;')return {period,value:null,value_text:'-',value_state:'missing',footnotes:[]};
  const m=/^(\d+\.\d{3}|-)(?:\(([XR])\))?$/.exec(cell);requireValue(m&&(!m[2]||notes.has(m[2])),'invalid_value_or_flag');const unavailable=m[2]==='X';requireValue(!unavailable||m[1]==='-'&&period==='2025-10','unavailable_value');requireValue(m[1]==='-'||Number(m[1])>0,'nonpositive_index');return {period,value:m[1]==='-'?null:Number(m[1]),value_text:m[1],value_state:m[1]==='-'?(unavailable?'unavailable':'missing'):'observed',footnotes:m[2]?[{code:m[2],text:notes.get(m[2])}]:[]};
 });requireValue(rows.at(-1).value!==null,'latest_missing');return cpiResult(rows,edition);
}
export async function readUsCpiTable({fetcher=fetch,deadline=20000,now=()=>new Date()}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),deadline),headers={'User-Agent':'MorningRows/1.0 (+https://morningrows.com)',accept:'*/*'};
 try{
  const get=async url=>({url,...await readCpiText(await fetcher(url,{signal:controller.signal,headers}),262144)});
  const index=await get(CPI_INDEX),edition=selectCpiWorkbook(index.text);
  const tableUrl=new URL(CPI_TABLE);tableUrl.searchParams.set('years_option','specific_years');
  tableUrl.searchParams.set('from_year',cpiWindow(edition.period)[0].slice(0,4));
  // Include subsequent years so an index lag cannot conceal newer table data.
  const acquisitionYear=now().getUTCFullYear();requireValue(Number.isInteger(acquisitionYear),'acquisition_clock');
  tableUrl.searchParams.set('to_year',String(Math.max(acquisitionYear,Number(edition.period.slice(0,4)))+1));
  const table=await get(tableUrl.href);requireValue(!controller.signal.aborted,'source_deadline');const result=parseCpiTable(table.text,edition.period);
  result.provenance=await Promise.all([index,table].map(async(r,i)=>({kind:i?'publisher_database_table':'publisher_index',url:r.url,bytes:r.bytes,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.text)))].map(n=>n.toString(16).padStart(2,'0')).join(''),hash_basis:'Decoded UTF-8 original publisher response',edition:edition.period,...(i?{mapping:'catalog0 dimensions; table0 year rows and Jan–Dec columns; HALF1/HALF2 excluded'}:{})})));
  return result;
 }finally{clearTimeout(timer);}
}
