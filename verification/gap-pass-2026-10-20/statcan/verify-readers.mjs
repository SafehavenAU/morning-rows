// Compare the actual parser to independently extracted original references.
// This is local reader validation, not another independent publisher comparison.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseStatcanHeadline,statcanHeadlineRows,validateStatcanHeadlineRepresentation,STATCAN_HEADLINE_SOURCES} from '../../../lib/statcan-headlines.js';
const root=new URL('./',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const sourceReports=[];let count=0;
for(const source of STATCAN_HEADLINE_SOURCES){
 const read=async f=>JSON.parse(await readFile(new URL(`${source}/${f}`,root),'utf8'));
 const referenceBytes=await readFile(new URL(`${source}/independent-report.json`,root)),reference=JSON.parse(referenceBytes),native=parseStatcanHeadline(source,await read('original/wds-selected.json'),await read('original/series-metadata.json'),await read('original/cube-metadata.json'));
 if(!(reference.pass===true||reference.passed===true))throw Error('Independent reference did not pass: '+source);
 if(!validateStatcanHeadlineRepresentation(source,native,{retrieved_at:'2026-10-20T10:00:00Z'}))throw Error('Native validation failed: '+source);
 const rows=statcanHeadlineRows(source,native),ref=source==='jobs'?reference.rows:reference.observations;
 if(rows.length!==ref.length)throw Error('Coverage differs: '+source);
 for(const row of rows){const r=ref.find(r=>r.coordinate===row.dimensions.coordinate);if(!r||r.value!==row.value||r.period!==row.period||r.unit!==row.unit||r.geography!==row.geography)throw Error('Reference mismatch: '+source+'/'+row.measure_id);count++;}
 sourceReports.push({source,pass:true,cells:rows.length,reference_sha256:hash(referenceBytes),values:rows.map(r=>({measure_id:r.measure_id,geography:r.geography,period:r.period,value:r.value,unit:r.unit,release_timestamp_raw:r.release_timestamp_raw,release_timezone:null})),limitations:source==='homes'?'Official CSV and separate table presentation agree; no separate dated CMHC release compared. Seasonal adjustment unspecified; CMHC licence notices and downstream terms apply.':source==='shop'?'Dated Daily labels July preliminary while WDS symbol is none; displayed millions match within documented rounding tolerance.':'Original independent reference has exact comparisons; shared publisher statistical lineage.'});
}
const modules={};for(const f of ['lib/statcan-headlines.js','lib/statcan-headlines-contracts.js'])modules[f]=hash(await readFile(new URL('../../../'+f,root)));
const output={schema_version:1,pass:true,scope:'Local actual parser compared with independently extracted original references; no deployment, public-output or operational acceptance.',compared_cells:count,source_reports:sourceReports,modules};
await writeFile(new URL('reader-reference-comparison.json',root),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({pass:true,compared_cells:count,sources:sourceReports.length}));
