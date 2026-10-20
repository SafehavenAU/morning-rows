import { WRA_URL } from './fiscal-observations.js';

const OGL_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
export const WRA_SELECTIONS = Object.freeze([
  {id:'all_inclusive',coverage:'Annual total',transaction_type:'All transactions',name:'Tax due, all transactions including restricted details'},
  {id:'all_disclosed',coverage:'Annual total excluding untypical and undisclosed transactions',transaction_type:'All transactions',name:'Tax due, all transactions excluding untypical and undisclosed details'},
  {id:'residential_disclosed',coverage:'Annual total excluding untypical and undisclosed transactions',transaction_type:'Residential',name:'Residential tax due excluding untypical and undisclosed details'},
  {id:'non_residential_disclosed',coverage:'Annual total excluding untypical and undisclosed transactions',transaction_type:'Non-residential',name:'Non-residential tax due excluding untypical and undisclosed details'},
]);
export function wraDefinitions() {
  return WRA_SELECTIONS.map(({id,name,coverage,transaction_type})=>({
    id,name,geography:'Wales',
    population:'Notifiable Land Transaction Tax returns for land and property interests purchased in Wales, by effective financial year and the selected disclosure coverage',
    unit:'GBP million',kind:'observation',
    adjustment:'Nominal tax due; not seasonally adjusted',
    period_convention:'Effective financial year YYYY-YY, 1 April through 31 March; latest available completed year',
    cadence:'Annual observations in a dataset subject to monthly revisions',
    revision_policy:'Earlier years may be revised for several years, including higher-rate refunds; preserve published rounding and revision notes, do not assume finality.',
    dimensions:{dataset:'60a57730-166f-486d-9315-69f7fd4c78b1',coverage,transaction_type,measure:'Tax due (£ million)'},
    publisher:'Welsh Revenue Authority via StatsWales',source_url:WRA_URL,
    licence:'Open Government Licence v3.0',licence_url:OGL_URL,
    limitations:'Tax due is not cash receipts, transaction counts or property values. Inclusive and restricted-detail totals overlap and must not be added. No confidential residual is inferred.',
  }));
}
export function validateWraRepresentation(value,options) {
  const retrieved_at=options?.retrieved_at;
  if(options!==undefined&&(!retrieved_at||!Number.isFinite(Date.parse(retrieved_at)))) return false;
  if(!value||value.geography!=='Wales'||value.source_url!==WRA_URL||
    value.source!=='Welsh Revenue Authority via StatsWales'||
    value.licence!=='Open Government Licence v3.0'||value.licence_url!==OGL_URL||
    !Array.isArray(value.rows)||value.rows.length!==4||
    value.rows.some(row=>!row||typeof row!=='object'||Array.isArray(row))) return false;
  const m=/^(\d{4})-(\d{2})$/.exec(value.period||'');
  if(!m||Number(m[2])!==(Number(m[1])+1)%100) return false;
  const start=`${m[1]}-04-01`,end=`${Number(m[1])+1}-03-31`;
  if(value.period_start!==start||value.period_end!==end) return false;
  if(retrieved_at!==undefined&&(!Number.isFinite(Date.parse(retrieved_at))||end>new Date(retrieved_at).toISOString().slice(0,10))) return false;
  const matched=WRA_SELECTIONS.map(s=>value.rows.filter(r=>r.coverage===s.coverage&&r.transaction_type===s.transaction_type));
  if(matched.some(rows=>rows.length!==1)) return false;
  const rows=matched.map(r=>r[0]);
  if(rows.some(r=>r.geography!=='Wales'||r.period!==value.period||r.unit!=='GBP million'||
    typeof r.value!=='number'||!Number.isFinite(r.value)||r.value<0||
    Math.abs(r.value*10-Math.round(r.value*10))>1e-7||
    typeof r.notes!=='string'||/Confidential|Not Applicable|Not Available/i.test(r.notes))) return false;
  return Math.abs(rows[2].value+rows[3].value-rows[1].value)<=0.21&&rows[0].value+0.51>=rows[1].value;
}
export function wraObservationRows(value) {
  if(!validateWraRepresentation(value)) throw Error('WRA representation validation failed');
  return WRA_SELECTIONS.map(s=>{
    const row=value.rows.find(r=>r.coverage===s.coverage&&r.transaction_type===s.transaction_type);
    return {...row,measure_id:s.id,period_start:value.period_start,period_end:value.period_end,
      value_state:'observed',source_url:value.source_url,licence:value.licence};
  });
}
