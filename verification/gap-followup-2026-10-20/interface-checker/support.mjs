// Independent exact-edition capture oracle. No runtime imports, publisher HTTP,
// fallback values or automatic reference refresh.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const source='electricity_balance', desk='northern-ireland';
export const base='/northern-ireland.json?source=electricity_balance';
export const period='2025-07-01/2026-06-30', publication='2026-09-03', edition='fixed_2026-09-03';
export const measures=['renewable_share_gfec','gross_final_consumption','renewable_generation','non_renewable_generation','net_imports'];
export const articleUrl='https://www.economy-ni.gov.uk/articles/electricity-consumption-and-renewable-generation-statistics';
export const metadataAnchor={kind:'retained_same_edition_metadata',path:'verification/remaining-gaps-2026-10-20/ni-energy/original/report.excerpt.html',sha256:'52978d72db205be7d9a146daeaedea467a7c9853304f2d0b43d770ef14c549f3',original_url:'https://datavis.nisra.gov.uk/Economy/electricity-consumption-and-renewable-generation-report.html',publication_date:publication,period,live_retrieved:false};
const pinned=[
 ['article','verification/gap-followup-2026-10-20/access-review/ni-article/comparison.json','a9950e133e4f03dad5ffbf1a47f1e52b50ec9e7f42bcc39b2ddf84e9545f9a0f'],
 ['original','verification/remaining-gaps-2026-10-20/ni-energy/independent-report.json','86b456beeef7b08eb6eb79b0de9e42519f98acf157972f72519ea76573efb9ee'],
 ['metadata',metadataAnchor.path,metadataAnchor.sha256],
];
export function routes(){
 const rows=['/health.json','/schema.json','/northern-ireland.json','/catalog.json?desk=northern-ireland',base].map(path=>({path}));
 for(const measure of measures) rows.push({path:base+'&measure='+measure},{path:base+'&measure='+measure+'&observation='+encodeURIComponent(period)});
 const first=base+'&measure='+measures[0];
 rows.push({path:first,status:304,conditional:true},{path:first,method:'HEAD'});
 for(const [path,status,error] of [
  [first+'&observation='+encodeURIComponent('2024-07-01/2025-06-30'),404,'observation_not_retained'],
  [base+'&measure=monthly_average',404,'unknown_measure'],
  [first+'&date=2026-06-30',400,'unsupported_query'],
  [first+'&geography=Ireland',400,'unsupported_query'],
  [first+'&measure=net_imports',400,'unsupported_query'],
  [base+'&observation='+encodeURIComponent(period),400,'incomplete_selection'],
 ])rows.push({path,status,error});
 return rows.map(r=>({method:'GET',status:200,conditional:false,...r}));
}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>!['retrieved_at','fetched_at'].includes(k)).map(k=>[k,canonical(v[k])]));return v;}
function statistical(v){if(Array.isArray(v))return v.map(statistical);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['provenance','retrieved_at','fetched_at','requested_at','acquired_at'].includes(k)).map(([k,x])=>[k,statistical(x)]));return v;}
const semanticHash=v=>sha(Buffer.from(JSON.stringify(canonical(v))));
const same=(a,b)=>semanticHash(a)===semanticHash(b);
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z');
export async function references(root){
 const refs={},manifest=[];
 for(const [key,file,hash] of pinned){
  const bytes=await readFile(join(root,file));if(sha(bytes)!==hash)throw Error('Pinned independent reference hash mismatch: '+key);
  if(key!=='metadata'){refs[key]=JSON.parse(bytes);if(refs[key].pass!==true)throw Error('Reference is not a passing independent extraction');}
  manifest.push({file,sha256:hash,bytes:bytes.length});
 }
 if(refs.article.observations_compared!==5||refs.original.observations.length!==5||refs.article.publication_date!==publication)throw Error('Reference edition changed');
 for(const expected of refs.original.observations){
  const matches=refs.article.comparisons.filter(c=>c.measure===expected.measure);
  if(matches.length!==1||matches[0].article!==expected.value||matches[0].original_workbook!==expected.value||!matches[0].pass||expected.period!==period)throw Error('Independent presentations do not agree');
 }
 return {refs,manifest};
}
export function nativeChecks(refs,native,check,label,record,healthClock){
 const expected=refs.original.observations;
 check(label+' exact fixed native edition',native?.status==='ok'&&native.geography==='Northern Ireland'&&native.period===period&&native.period_start==='2025-07-01'&&native.period_end==='2026-06-30'&&native.publication_date===publication&&native.edition===edition);
 check(label+' complete five unique rows and definitions',Array.isArray(native.rows)&&native.rows.length===5&&new Set(native.rows.map(r=>r.measure_id)).size===5&&Array.isArray(native.definitions)&&native.definitions.length===5);
 check(label+' publisher licence and honest fixed-edition scope',native.publisher==='Department for the Economy, Northern Ireland'&&native.licence==='Open Government Licence v3.0'&&native.licence_url==='https://www.economy-ni.gov.uk/articles/crown-copyright-economy'&&native.source_url===articleUrl&&/does not claim the newest/.test(native.limitations||'')&&/not a calendar year/.test(native.limitations||'')&&/No historical series/.test(native.limitations||''));
 check(label+' metadata is retained same edition, not live report retrieval',same(native.metadata?.metadata_evidence,metadataAnchor)&&native.metadata?.fixed_edition===true&&native.metadata?.count===5&&native.metadata?.publication_period==='July 2025 to June 2026'&&native.metadata?.latest_reference_month==='2026-06'&&same(native.metadata?.report_anchor,{publication_date:publication,period_start:'2025-07-01',period_end:'2026-06-30',latest_reference_month:'2026-06'}));
 check(label+' no invented publication clock or scheduled future vintage',native.published_at===null&&native.publisher_updated_at===null&&native.next_expected_update===null);
 for(const e of expected){
  const found=native.rows.filter(r=>r.measure_id===e.measure);check(label+' unique '+e.measure,found.length===1);const row=found[0];
  const defs=native.definitions.filter(d=>d.id===e.measure);check(label+' definition '+e.measure,defs.length===1);const d=defs[0];
  check(label+' '+e.measure+' exact value/unit/period/geography',row.value===e.value&&row.value_state==='observed'&&row.unit===e.unit&&row.geography===e.geography&&row.period===e.period&&row.period_start===e.period_start&&row.period_end===e.period_end&&row.publication_date===e.publisher_date&&row.edition===edition);
  check(label+' '+e.measure+' retained own-use GFEC/revision qualifications',/metered and own-use/.test(row.methodology||'')&&/gross of system losses/.test(row.methodology||'')&&/not the superseded pre-2026/.test(row.methodology||'')&&/Statistics in Development/.test(row.revision_status||'')&&/may be revised/.test(row.revision_status||'')&&/not final/.test(row.revision_status||'')&&same(row.metadata_evidence,metadataAnchor)&&row.source_url===articleUrl);
  check(label+' '+e.measure+' typed physical measure definition',d.unit===e.unit&&d.geography==='Northern Ireland'&&d.kind==='observation'&&d.dimensions?.measure===e.measure&&d.dimensions?.territory==='Northern Ireland'&&d.dimensions?.edition===edition&&d.dimensions?.methodology==='gross_final_consumption_including_own_use'&&d.dimensions?.aggregation===(e.unit==='%'?'ratio of rolling totals':'rolling total')&&same(d.metadata_evidence,metadataAnchor)&&d.edition===edition&&/not seasonally adjusted/.test(d.adjustment||''));
  check(label+' '+e.measure+' publisher rounding retained',d.rounding===(e.unit==='%'?'Publisher-rounded whole percentage point':'Publisher-rounded whole GWh'));
 }
 check(label+' one bounded actual article provenance',native.provenance?.length===1);
 const p=native.provenance[0];
 check(label+' acquisition identity',p.role==='article'&&p.url===articleUrl&&/^[a-f0-9]{64}$/.test(p.sha256||'')&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=262144&&instant(p.retrieved_at)&&p.retrieved_at.slice(0,10)>=publication);
 if(healthClock!==undefined)check(label+' source completion follows provenance',instant(healthClock)&&Date.parse(healthClock)>=Date.parse(p.retrieved_at));
 if(record)check(label+' provenance and source completion do not follow response',Date.parse(p.retrieved_at)<=Date.parse(record.completed_at)&&(healthClock===undefined||Date.parse(healthClock)<=Date.parse(record.completed_at)));
}
export function bodyChecks(refs,path,body,check,versions=new Map(),record){
 const u=new URL(path,'https://morningrows.com'),key=u.searchParams.get('source'),label=path;
 if(!key){
  if(u.pathname==='/catalog.json'){
   const matches=body.sources?.filter(c=>c.key===source)||[];check(label+' one NI electricity source',matches.length===1);
   check(label+' exact five advertised measures',same(matches[0].measures?.map(m=>m.id).sort(),[...measures].sort()));
   for(const d of matches[0].measures||[])check(label+' exact measure catalogue card '+d.id,d.unit===refs.original.observations.find(e=>e.measure===d.id)?.unit&&d.geography==='Northern Ireland'&&d.kind==='observation'&&d.records==='https://morningrows.com'+base+'&measure='+d.id);
  }else if(u.pathname==='/northern-ireland.json'){
   check(label+' healthy NI source',body.sources?.[source]?.status==='ok');
   nativeChecks(refs,body[source],check,label,record,body.sources[source].fetched_at);
   versions.set('native',body[source]);
  }
  return;
 }
 check(label+' expected selected source',key===source&&u.pathname==='/northern-ireland.json');
 const native=versions.get('native');check(label+' earlier independently checked native exists',Boolean(native));
 const measure=u.searchParams.get('measure'),requestedPeriod=u.searchParams.get('observation');
 const expected=refs.original.observations.filter(e=>(!measure||e.measure===measure)&&(!requestedPeriod||e.period===requestedPeriod));
 const context=Object.fromEntries(Object.entries(native).filter(([k])=>!['rows','states','catalogue','value','count'].includes(k)));
 check(label+' exact canonical selector',body.id==='https://morningrows.com'+path&&body.source==='https://morningrows.com'+base&&body.desk==='https://morningrows.com/northern-ireland.json');
 check(label+' exact selected healthy coverage',expected.length>0&&body.retrieval?.status==='ok'&&instant(body.retrieval.retrieved_at)&&body.observations?.length===expected.length&&new Set(body.observations.map(r=>r.id)).size===expected.length);
 check(label+' complete selected context agrees with native',same(statistical(body.context),statistical(context)));
 nativeChecks(refs,{...body.context,rows:native.rows},check,label+' context',record,body.retrieval.retrieved_at);
 for(const e of expected){
  const id='https://morningrows.com'+base+'&measure='+e.measure+'&observation='+encodeURIComponent(period),r=body.observations.find(x=>x.id===id);
  check(label+' exact '+e.measure+' identity/value',r?.value===e.value&&r.period===e.period&&r.value_state==='observed'&&r.measure==='https://morningrows.com'+base+'&measure='+e.measure&&r.definition?.id===e.measure&&r.definition.unit===e.unit&&r.definition.geography===e.geography);
  const original=native.rows.find(x=>x.measure_id===e.measure),definition=native.definitions.find(x=>x.id===e.measure);
  check(label+' complete '+e.measure+' qualifications and definition',same(r.qualifications,original)&&same(r.definition,definition));
  check(label+' no invented per-observation publication instant',r.published_at===null&&r.publisher_updated_at===null&&r.next_expected_update===null&&r.publisher_status===null);
  const {version,native_pointer,...content}=r;
  check(label+' independently replayed '+e.measure+' version',/^[a-f0-9]{64}$/.test(version||'')&&version===semanticHash(content));
  if(versions.has(id))check(label+' stable '+e.measure+' across selectors/domains',versions.get(id)===version);else versions.set(id,version);
 }
 check(label+' independent statistical content version',body.content_version===semanticHash({data:statistical(body.data),context:statistical(body.context),observations:body.observations.map(({native_pointer,...r})=>r),retrieval:body.retrieval}));
 if(!measure){nativeChecks(refs,body.data,check,label+' selected source',record,body.retrieval.retrieved_at);check(label+' complete source data matches native',same(statistical(body.data),statistical(native)));}
 else check(label+' selected exact typed row matches native',same(body.data,native.rows.find(r=>r.measure_id===measure)));
}
export function cacheChecks(record,check){
 if(![200,304].includes(record.status)||record.path.startsWith('/health')||record.path.startsWith('/schema'))return;
 const ttl=record.headers['cache-control']?.match(/(?:^|[,\s])max-age=(\d+)/)?.[1];
 check(record.path+' bounded cache lifetime',ttl!==undefined&&Number(ttl)<=3600);
}
export async function verifyCapture(root, directory, {revision, version, staged}) {
  const {refs, manifest} = await references(root), report = JSON.parse(await readFile(join(directory, 'ni-energy-interface-report.json')));
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
    return {pass: true, checks, references: manifest, requests: plan.length, independent_cells_per_domain: {ni_electricity: 5}, fixed_edition: 'fixed_2026-09-03', source_presentations_share_statistical_lineage: true};
  } catch (error) { return {pass: false, error: error.message, checks, references: manifest}; }
}
