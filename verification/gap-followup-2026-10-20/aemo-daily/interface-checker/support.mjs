// Independent frozen-original public oracle. No runtime reader imports or HTTP.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const source='grid_day',desk='australia',base='/australia.json?source=grid_day',period='2026-10-19';
const origin='https://morningrows.com',index='https://nemweb.com.au/Reports/CURRENT/Public_Prices/';
const geography={SA1:'South Australia',VIC1:'Victoria'},stats=['mean','minimum','maximum','negative_count','zero_count'];
export const measures=Object.keys(geography).flatMap(r=>stats.map(s=>r+'.'+s));
export function routes(){
 const rows=['/health.json','/schema.json','/australia.json','/catalog.json?desk=australia',base].map(path=>({path}));
 for(const measure of measures)rows.push({path:base+'&measure='+measure},{path:base+'&measure='+measure+'&observation='+period});
 const first=base+'&measure='+measures[0];rows.push({path:first,status:304,conditional:true},{path:first,method:'HEAD'});
 for(const [path,status,error]of [[first+'&observation=2026-10-18',404,'observation_not_retained'],[base+'&measure=NSW1.mean',404,'unknown_measure'],[first+'&observation=2026-10',400,'invalid_observation'],[first+'&date='+period,400,'unsupported_query'],[first+'&geography=Australia',400,'unsupported_query'],[first+'&measure=SA1.maximum',400,'unsupported_query'],[base+'&observation='+period,400,'incomplete_selection']])rows.push({path,status,error});
 return rows.map(r=>({method:'GET',status:200,conditional:false,...r}));
}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>!['retrieved_at','fetched_at'].includes(k)).map(k=>[k,canonical(v[k])]));return v;}
function statistical(v){if(Array.isArray(v))return v.map(statistical);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['provenance','retrieved_at','fetched_at','requested_at','acquired_at'].includes(k)).map(([k,x])=>[k,statistical(x)]));return v;}
const semanticHash=v=>sha(Buffer.from(JSON.stringify(canonical(v)))),same=(a,b)=>semanticHash(a)===semanticHash(b);
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z');
export async function references(root){
 const file='verification/gap-followup-2026-10-20/aemo-daily/review/independent-rounding.json',bytes=await readFile(join(root,file));
 if(sha(bytes)!=='3909cffb8ed82401adebe9785aaeb092e51085a760f097bf4c0c7ba36a889de0')throw Error('Independent full-original comparison changed');
 const refs=JSON.parse(bytes);if(!refs.pass||refs.calendar_day!==period||refs.observations.length!==576||refs.exact_cent_comparisons!==576||refs.tolerance_after_rounding!=='0')throw Error('Invalid frozen independent comparison');
 const manifest=[{file,bytes:bytes.length,sha256:sha(bytes)}];
 for(const input of refs.input_files){const raw=await readFile(join(root,input.file));if(raw.length!==input.bytes||sha(raw)!==input.sha256)throw Error('Original evidence changed');manifest.push({file:input.file,bytes:raw.length,sha256:input.sha256});}
 return {refs,manifest};
}
const unit=statistic=>statistic.endsWith('_count')?'five-minute intervals':'AUD/MWh';
function expectedRow(native,measure){const [region,statistic]=measure.split('.'),r=native.regions.find(r=>r.region===region);return {measure,measure_id:measure,period,value:r.summary[statistic],value_state:'observed',geography:geography[region],region,statistic,unit:unit(statistic),kind:'derived',interval_count:288,interval_minutes:5,period_start:r.period_start,period_end:r.period_end,timezone:native.timezone,dataset:'DREGION',runno:1,intervention:0,apcflag:0,market_suspended_flag:0,csv_layouts:[2,3],rounding:r.rounding,source_url:index,source_urls:r.source_urls,revision_status:'mutable public publisher files; finality not established'};}
export function nativeChecks(refs,native,check,label,record,healthClock){
 check(label+' exact complete calendar day',native?.status==='ok'&&native.calendar_day===period&&native.next_rollover_at==='2026-10-20T14:00:00.000Z'&&native.timezone==='fixed AEST / UTC+10; not local daylight-saving time'&&/no earlier-day fallback/.test(native.requested_day_policy||''));
 check(label+' exact two regions and ten definitions',native.regions?.length===2&&same(native.regions.map(r=>r.region),['SA1','VIC1'])&&native.definitions?.length===10&&same(native.definitions.map(d=>d.id).sort(),[...measures].sort()));
 check(label+' publisher and permission',native.publisher==='Australian Energy Market Operator'&&native.licence==='AEMO copyright permissions; accurate attribution required'&&native.licence_url==='https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions');
 check(label+' unknown publication and finality remain unknown',native.published_at===null&&native.publisher_updated_at===null&&native.next_expected_update===null&&/finality/.test(native.limitations||'')&&/not demand-weighted/.test(native.limitations||''));
 const zipRefs=refs.input_files.filter(f=>f.file.endsWith('.zip'));
 check(label+' exactly advertised original bundles',native.bundles?.length===2&&native.bundles.every((b,i)=>b.url===index+zipRefs[i].file.split('/').at(-1)&&b.filename===zipRefs[i].file.split('/').at(-1)&&b.csv_bytes===zipRefs[i].csv_bytes&&b.csv_name===b.filename.replace('.zip','.CSV')&&b.trading_day===(i?'2026-10-19':'2026-10-18')&&b.report_generated_at===(i?'2026-10-20T04:05:03+10:00':'2026-10-19T04:05:02+10:00')));
 for(const r of native.regions){
  check(label+' '+r.region+' exact regional semantics',r.status==='ok'&&r.geography===geography[r.region]&&r.calendar_day===period&&r.interval_count===288&&r.interval_minutes===5&&r.unit==='AUD/MWh'&&r.dataset==='DREGION'&&r.runno===1&&r.intervention===0&&r.apcflag===0&&r.market_suspended_flag===0&&same(r.csv_layouts,[2,3])&&r.period_start===period+'T00:00:00+10:00'&&r.period_end==='2026-10-20T00:00:00+10:00'&&r.timezone===native.timezone&&r.source_url===index&&same(r.source_urls,native.bundles.map(b=>b.url))&&r.rounding==='Each raw RRP rounded to AUD/MWh cents, half away from zero, before summary and sign counts');
  const expected=refs.observations.filter(x=>x.region===r.region),summary=refs.summaries.find(x=>x.region===r.region);
  check(label+' '+r.region+' all 288 raw/cents/interval/ownership values',r.intervals?.length===288&&r.intervals.every((row,i)=>row.period_end===expected[i].period_end&&row.price_raw===expected[i].raw&&row.layout2_price_raw===expected[i].layout2_raw&&row.price===Number(expected[i].rounded)&&row.source_url===index+expected[i].source_filename));
  for(const statistic of stats)check(label+' '+r.region+'.'+statistic+' independent exact summary',r.summary[statistic]===Number(summary[statistic]));
 }
 for(const d of native.definitions){const [region,statistic]=d.id.split('.');check(label+' definition '+d.id,d.geography===geography[region]&&d.unit===unit(statistic)&&d.kind==='derived'&&d.dimensions?.region===region&&d.dimensions?.statistic===statistic&&d.dimensions?.dataset==='DREGION'&&d.dimensions?.runno===1&&d.dimensions?.intervention===0&&d.dimensions?.apcflag===0&&d.dimensions?.market_suspended_flag===0&&same(d.dimensions?.csv_layouts,[2,3])&&d.dimensions?.interval_minutes===5&&/288 five-minute intervals/.test(d.population||'')&&/no seasonal or inflation/.test(d.adjustment||'')&&/fixed AEST UTC\+10/.test(d.period_convention||'')&&/half away from zero/.test(d.rounding||'')&&/finality/.test(d.revision_policy||'')&&d.publisher===native.publisher&&d.licence===native.licence&&d.source_url===index);}
 check(label+' bounded actual acquisition provenance',native.provenance?.length===3);
 const now=healthClock??record?.completed_at;
 check(label+' source clock inside specimen eligible day',instant(now)&&Date.parse(now)>=Date.parse('2026-10-19T14:00:00Z')&&Date.parse(now)<Date.parse('2026-10-20T14:00:00Z'));
 for(const [i,p]of native.provenance.entries()){
  check(label+' provenance '+i+' source bytes/clock',p.role===(i?'bundle':'index')&&p.url===(i?native.bundles[i-1].url:index)&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=(i?524288:131072)&&/^[a-f0-9]{64}$/.test(p.sha256||'')&&instant(p.requested_at)&&instant(p.retrieved_at)&&Date.parse(p.requested_at)<=Date.parse(p.retrieved_at)&&Date.parse(p.retrieved_at)<=Date.parse(now));
  if(i){const e=zipRefs[i-1];check(label+' provenance '+i+' exact original ZIP/CSV',p.sha256===e.sha256&&p.bytes===e.bytes&&p.csv_sha256===e.csv_sha256&&p.csv_bytes===e.csv_bytes&&p.csv_name===native.bundles[i-1].csv_name&&p.trading_day===native.bundles[i-1].trading_day&&Date.parse(p.requested_at)>=Date.parse(native.provenance[0].retrieved_at));}
 }
 if(record)check(label+' response before fixed-AEST rollover',Date.parse(record.completed_at)<Date.parse(native.next_rollover_at)&&Date.parse(now)<=Date.parse(record.completed_at));
}
export function bodyChecks(refs,path,body,check,versions=new Map(),record){
 const u=new URL(path,origin),key=u.searchParams.get('source'),label=path;
 if(!key){
  if(u.pathname==='/catalog.json'){const cards=body.sources?.filter(c=>c.key===source)||[];check(label+' one source with ten measures',cards.length===1&&same(cards[0].measures?.map(d=>d.id).sort(),[...measures].sort()));for(const d of cards[0].measures)check(label+' bounded advertised '+d.id,d.geography===geography[d.id.split('.')[0]]&&d.unit===unit(d.id.split('.')[1])&&d.kind==='derived'&&d.observation_selector==='YYYY-MM-DD'&&d.records===origin+base+'&measure='+d.id);}
  else if(u.pathname==='/australia.json'){check(label+' healthy daily source',body.sources?.grid_day?.status==='ok');nativeChecks(refs,body.grid_day,check,label,record,body.sources.grid_day.fetched_at);check(label+' separate five-region grid sibling preserved',body.sources?.grid?.status==='ok'&&body.grid?.length===5&&same(body.grid.map(r=>r.code).sort(),['NSW1','QLD1','SA1','TAS1','VIC1']));versions.set('native',body.grid_day);}
  return;
 }
 const native=versions.get('native');check(label+' previously checked full native exists',Boolean(native));
 const measure=u.searchParams.get('measure'),expected=measures.filter(m=>!measure||m===measure);
 check(label+' canonical selector identity',body.id===origin+path&&body.source===origin+base&&body.desk===origin+'/australia.json');
 check(label+' healthy exact selected coverage',body.retrieval?.status==='ok'&&instant(body.retrieval.retrieved_at)&&body.observations?.length===expected.length&&new Set(body.observations.map(r=>r.id)).size===expected.length&&body.unavailable_measures?.length===0);
 check(label+' full context matches independently checked native',same(statistical(body.context),statistical(native)));nativeChecks(refs,body.context,check,label+' context',record,body.retrieval.retrieved_at);
 for(const id of expected){const row=expectedRow(native,id),observationId=origin+base+'&measure='+id+'&observation='+period,r=body.observations.find(o=>o.id===observationId),definition=native.definitions.find(d=>d.id===id);
  check(label+' exact selected '+id,r?.value===row.value&&r.period===period&&r.value_state==='observed'&&r.measure===origin+base+'&measure='+id&&same(r.qualifications,row)&&same(r.definition,definition));
  check(label+' honest unknown timing/status '+id,r.published_at===null&&r.publisher_updated_at===null&&r.next_expected_update===null&&r.publisher_status===null&&r.source_url===index&&r.licence===native.licence);
  const {version,native_pointer,...content}=r;
  const [region,statistic]=id.split('.'),pointer='/grid_day/regions/'+(['SA1','VIC1'].indexOf(region))+'/summary/'+statistic;
  check(label+' exact native pointer '+id,native_pointer===pointer&&pointer.split('/').slice(2).reduce((v,k)=>v?.[k],native)===r.value);
  check(label+' replayed observation version '+id,/^[a-f0-9]{64}$/.test(version||'')&&version===semanticHash(content));
  if(versions.has(observationId))check(label+' stable observation across selectors/domains '+id,versions.get(observationId)===version);else versions.set(observationId,version);
 }
 check(label+' complete selected data',same(statistical(body.data),statistical(measure?expectedRow(native,measure):native)));
 check(label+' replayed statistical content version',body.content_version===semanticHash({data:statistical(body.data),context:statistical(body.context),observations:body.observations.map(({native_pointer,...r})=>r),retrieval:body.retrieval}));
}
export function cacheChecks(record,check){
 if(![200,304].includes(record.status)||record.path.startsWith('/health')||record.path.startsWith('/schema'))return;
 const ttl=record.headers['cache-control']?.match(/(?:^|[,\s])max-age=(\d+)/)?.[1];
 check(record.path+' bounded cache lifetime',ttl!==undefined&&Number(ttl)<=300);
 if(record.path.startsWith('/australia.json'))check(record.path+' cache cannot cross fixed-AEST midnight',Number(ttl)<=Math.floor((Date.parse('2026-10-20T14:00:00Z')-Date.parse(record.started_at))/1000)&&Date.parse(record.completed_at)<Date.parse('2026-10-20T14:00:00Z'));
}
export async function verifyCapture(root, directory, {revision, version, staged}) {
  const {refs, manifest} = await references(root), report = JSON.parse(await readFile(join(directory, 'aemo-daily-interface-report.json')));
  const checks = [], check = (label, pass) => { checks.push({label, pass: Boolean(pass)}); if (!pass) throw Error(label); };
  try {
    check('capture identity and successful status', report.pass === true && report.revision === revision && report.version === version && report.staged === staged);
    check('exact frozen independent references', same(report.references, manifest));
    const origins = staged ? ['https://morningrows.com'] : ['https://morningrows.com', 'https://www.morningrows.com'];
    const plan = origins.flatMap(origin => routes().map(want => ({...want, origin})));
    check('exact complete bounded request count', report.requests?.length === plan.length);
    const files = new Set(), versions = new Map(), etags = new Map();
    for (let i = 0; i < plan.length; i++) {
      const want = plan[i], record = report.requests[i], key = record.origin + record.path;
      check('request ' + i + ' exact route/method/status', record.origin === want.origin && record.path === want.path && record.method === want.method && record.conditional === want.conditional && record.status === want.status && record.expected_status === want.status);
      check('request ' + i + ' exact candidate identity', record.headers?.['x-source-revision'] === revision && record.headers?.['x-worker-version'] === version);
      check('request ' + i + ' valid capture interval', Number.isFinite(Date.parse(record.started_at)) && Date.parse(record.completed_at) >= Date.parse(record.started_at));
      if (record.method === 'HEAD' || record.conditional) {
        check('request ' + i + ' empty conditional/HEAD body', record.bytes === 0 && record.sha256 === sha(Buffer.alloc(0)) && !record.file);
        check('request ' + i + ' original GET ETag retained', Boolean(etags.get(key)) && record.headers.etag === etags.get(key) && (!record.conditional || record.request_etag === etags.get(key)));
        cacheChecks(record, check);
        continue;
      }
      check('request ' + i + ' safe unique capture filename', typeof record.file === 'string' && /^\d{3}\.body$/.test(record.file) && !files.has(record.file));
      files.add(record.file);
      const bytes = await readFile(join(directory, record.file));
      check('request ' + i + ' exact retained bytes', bytes.length === record.bytes && sha(bytes) === record.sha256);
      check('request ' + i + ' JSON media type', /^application\/json(?:;|$)/i.test(record.headers['content-type'] || ''));
      const body = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
      if (want.error) {
        check('request ' + i + ' exact explicit refusal', body.error === want.error || body.reason === want.error);
        check('request ' + i + ' no substituted observations', !body.observations?.length && (body.data === null || body.data === undefined));
        continue;
      }
      if (record.path === '/health.json') check('clean health identity', body.source_dirty === false && body.source_revision === revision && body.worker_version === version);
      cacheChecks(record, check); bodyChecks(refs, record.path, body, check, versions, record);
      if (record.headers.etag) etags.set(key, record.headers.etag);
    }
    return {pass: true, checks, references: manifest, requests: plan.length, independent_cells_per_domain: {aemo_intervals: 576, aemo_summaries: 10}, calendar_day: period, source_presentations_share_statistical_lineage: true};
  } catch (error) { return {pass: false, error: error.message, checks, references: manifest}; }
}
