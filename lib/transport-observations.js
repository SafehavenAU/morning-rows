import { fetchOfficial, SourceError } from './sources.js';
import { openWorkbook, workbookBytes } from './workbook.js';
const requireValue = (ok, message) => { if (!ok) throw new SourceError(message); };
export const NZ_FLEET_URL='https://www.transport.govt.nz/assets/Uploads/NZVehicleFleet_2024-1.xlsx';
export const SCOT_TRAFFIC_URL='https://www.transport.gov.scot/media/rjzlatp0/chapter-5-road-traffic-excel.xlsx';
export function nzFleet(book, now=new Date()) {
 const contents=book.sheet('Contents'),cells=book.sheet('1.1, 1.2');
 requireValue(contents.get('A1')==='The New Zealand 2024 Vehicle Fleet : Data Spreadsheet'&&cells.get('B1')==='Fleet Composition'&&cells.get('A2')==='Period','Unexpected NZ fleet table');
 const labels=['Light passenger','Light commercial','MCycle','Trucks','Bus','Other','Total','Total light'];
 const columns=['B','C','D','E','F','G','H','I'];
 requireValue(columns.every((c,i)=>cells.get(c+'2')===labels[i]),'NZ fleet categories changed');
 const years=[...cells].filter(([ref,v])=>/^A\d+$/.test(ref)&&Number.isInteger(v)&&v>=2000).map(([ref,year])=>({row:ref.slice(1),year}));
 requireValue(years.length>0&&new Set(years.map(r=>r.year)).size===years.length&&years.every(r=>r.year<now.getUTCFullYear()),'Invalid or duplicate NZ fleet year');
 const latest=years.sort((a,b)=>b.year-a.year)[0]; requireValue(latest.year===2024,'NZ fleet release year mismatch');
 const values=columns.map(c=>cells.get(c+latest.row));
 requireValue(values.every(v=>Number.isSafeInteger(v)&&v>=0),'Missing NZ fleet count; suppression is not zero');
 requireValue(values.slice(0,6).reduce((s,n)=>s+n,0)===values[6]&&values[0]+values[1]===values[7],'NZ fleet totals do not reconcile');
 return {source:'New Zealand Ministry of Transport',source_url:NZ_FLEET_URL,publication_url:'https://www.transport.govt.nz/statistics-and-insights/fleet-statistics/sheet/annual-fleet-statistics',licence:'CC BY 4.0',licence_url:'https://creativecommons.org/licenses/by/4.0/',attribution:'Source: the Ministry of Transport and licensed by the Ministry of Transport for re-use under CC BY 4.0.',geography:'New Zealand',period:String(latest.year),release:'Annual Motor Vehicle Fleet Statistics 2024, published October/November 2025',
 rows:values.map((value,i)=>({category:labels[i]==='MCycle'?'Motorcycles':labels[i],value,unit:'vehicles',geography:'New Zealand',period:String(latest.year)})),
 note:'Published annual fleet composition, table 1.1; not a live vehicle-register count. Ministry categories differ from NZTA classifications. This table includes Other; Total light overlaps the passenger and commercial categories. Do not add subtotals to component categories. Vehicles exempt from licensing and restoration licences are excluded. This is the explicitly dated 2024 release, not a claim that newer releases cannot exist.'};
}
export function scottishTraffic(book, now=new Date()) {
 const cells=book.sheet('T5.1');
 requireValue(cells.get('A1')==='Table 5.1  Traffic by road class and type  (million vehicle kilometres) [note 3]'&&cells.get('A4')==='Source:  Department for Transport - Not Accredited Official Statistics'&&cells.get('A5')==='Road type','Unexpected Scotland traffic table or units');
 const years=[...cells].filter(([ref,value])=>/^[A-Z]+5$/.test(ref)&&ref!=='A5'&&value!==null).map(([ref,value])=>{const m=String(value).match(/^(\d{4})(?: \[note \d+\])*$/);requireValue(m,'Unrecognised traffic year');return{column:ref.slice(0,-1),year:Number(m[1])};});
 requireValue(years.length>0&&new Set(years.map(r=>r.year)).size===years.length&&years.every(r=>r.year>=1990&&r.year<now.getUTCFullYear()),'Invalid or duplicate traffic year');
 const latest=years.sort((a,b)=>b.year-a.year)[0];
 requireValue(latest.year===2024,'Scottish traffic release year mismatch');
 const measures=[['Motorways',6],['All A roads Total',15],['All minor roads',19],['All roads',23]];
 const values=measures.map(([label,row])=>{requireValue(cells.get('A'+row)===label,'Traffic categories changed');const value=cells.get(latest.column+row);requireValue(typeof value==='number'&&Number.isFinite(value)&&value>=0,'Missing traffic estimate; suppression is not zero');return value;});
 requireValue(Math.abs(values[0]+values[1]+values[2]-values[3])<=2,'Traffic estimates exceed rounding tolerance');
 return {source:'Transport Scotland; Department for Transport estimates',source_url:SCOT_TRAFFIC_URL,publication_url:'https://www.transport.gov.scot/publication/scottish-transport-statistics-2025/',licence:'Open Government Licence v3.0',licence_url:'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',geography:'Scotland',period:String(latest.year),release:'Scottish Transport Statistics 2025, published 25 March 2026',statistical_status:'Not Accredited Official Statistics',
 rows:values.map((value,i)=>({road_type:measures[i][0],value,unit:'million vehicle kilometres',geography:'Scotland',period:String(latest.year)})),
 note:'Calendar-year distance travelled on Scottish roads, not the number of vehicles or road length. Table 5.1. Minor-road estimates since 2000 have been revised following benchmarking; totals may differ from sums because of rounding. Motorways include A(M) roads. The total overlaps all three component categories. This reader uses the explicitly named 2025 publication.'};
}
export async function readNzFleet(){return nzFleet(openWorkbook(await workbookBytes(await fetchOfficial(NZ_FLEET_URL))));}
export async function readScottishTraffic(){return scottishTraffic(openWorkbook(await workbookBytes(await fetchOfficial(SCOT_TRAFFIC_URL))));}
