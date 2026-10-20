// Independent fixed-edition oracle: retained Python workbook/SVG and PyMuPDF
// comparisons, not the JavaScript reader. No network or reference refresh.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const desk='england',source='care_assessment_cohort';
export const base='/england.json?source='+source,period='2025-08-01',publication='2025-10-24',edition='State of Care 2024/25';
export const measures=['inadequate','requires_improvement','good','outstanding','total'];
export const pdfUrl='https://assets.publishing.service.gov.uk/media/68fa3b4fe200d653d8b63735/care-quality-commission-state-of-health-care-and-adult-social-care-England-2024-2025.pdf';
export const pdfHash='61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef',pdfBytes=7175967;
const metadataAnchor={kind:'retained_same_edition_publication_metadata',path:'verification/remaining-gaps-2026-10-20/prior-audit/cqc/original/state-of-care-index.html',sha256:'987986bb8ad36eda0d21eb30575b6551bdcdbe364c2af5c3a3dba165e4fdeb0d',original_url:'https://www.cqc.org.uk/publications/major-report/state-care',publication_date:publication,edition,live_retrieved:false};
const pinned=[
 ['original','verification/remaining-gaps-2026-10-20/cqc/independent-reference.json','e6cdd71bfb1fd84dd22e2b6e3c93473d1b00e345ab4968271186db492e89f6c1'],
 ['pdf','verification/gap-followup-2026-10-20/access-review/cqc-gov-pdf/comparison.json','4a79f03db9e28ff5d6b397db38a7ce2da8f7509a5bc60c09c1cc33890bab423f'],
 ['readerComparison','verification/gap-followup-2026-10-20/cqc-pdf/independent-reader-comparison.json','6ddeabfcf8cf67b2ca9030d36c2743deb9d2f83686485e9471e0ec66ee96ca82'],
 ['readerProof','verification/gap-followup-2026-10-20/cqc-pdf/worker-reader.json','1058e4182bc2919a164c79a7a56803fe5de36692f3adfaf5c7e911295a46306a'],
 ['metadata',metadataAnchor.path,metadataAnchor.sha256],
];
export function routes(){
 const rows=['/health.json','/schema.json','/england.json','/catalog.json?desk=england',base].map(path=>({path}));
 for(const measure of measures)rows.push({path:base+'&measure='+measure},{path:base+'&measure='+measure+'&observation='+period});
 const first=base+'&measure='+measures[0];
 rows.push({path:first,status:304,conditional:true},{path:first,method:'HEAD'});
 for(const [path,status,error]of[
  [first+'&observation=2025-08-02',404,'observation_not_retained'],
  [base+'&measure=quality_rate',404,'unknown_measure'],
  [first+'&date='+period,400,'unsupported_query'],
  [first+'&geography=United%20Kingdom',400,'unsupported_query'],
  [first+'&measure=total',400,'unsupported_query'],
  [base+'&observation='+period,400,'incomplete_selection'],
 ])rows.push({path,status,error});
 return rows.map(row=>({method:'GET',status:200,conditional:false,...row}));
}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>!['retrieved_at','fetched_at'].includes(k)).map(k=>[k,canonical(v[k])]));return v;}
function statistical(v){if(Array.isArray(v))return v.map(statistical);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['provenance','retrieved_at','fetched_at','requested_at','acquired_at'].includes(k)).map(([k,x])=>[k,statistical(x)]));return v;}
const semanticHash=v=>sha(Buffer.from(JSON.stringify(canonical(v))));
const same=(a,b)=>semanticHash(a)===semanticHash(b);
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z');
export async function references(root){
 const refs={},manifest=[];
 for(const[key,file,hash]of pinned){const bytes=await readFile(join(root,file));if(sha(bytes)!==hash)throw Error('Pinned independent reference hash mismatch: '+key);if(key!=='metadata')refs[key]=JSON.parse(bytes);manifest.push({file,sha256:hash,bytes:bytes.length});}
 if(refs.original.passed!==true||refs.pdf.pass!==true||refs.original.references.length!==5||refs.pdf.observations_compared!==5||refs.pdf.reference_sha256!==pinned[0][2]||refs.pdf.publication_date!==publication||refs.pdf.snapshot_date!==period||refs.pdf.source_acquisition.wire_sha256!==pdfHash||refs.pdf.source_acquisition.bytes!==pdfBytes)throw Error('Independent edition/reference mismatch');
 for(const expected of refs.original.references){const found=refs.pdf.comparisons.filter(c=>c.measure===expected.measure);if(found.length!==1||found[0].pdf_value!==expected.value||found[0].workbook_value!==expected.value||!found[0].pass||expected.period!==period||expected.unit!=='ratings'||!measures.includes(expected.measure))throw Error('Independent original presentations disagree');}
 if(new Set(refs.original.references.map(r=>r.measure)).size!==5)throw Error('Reference coverage mismatch');
 if(refs.readerComparison.pass!==true||refs.readerComparison.original_sha256!==pdfHash||refs.readerComparison.original_bytes!==pdfBytes||refs.readerComparison.reference_sha256!==pinned[0][2]||refs.readerComparison.preview_sha256!==pinned[3][2]||refs.readerComparison.comparisons?.length!==5||refs.readerProof.pass!==true||refs.readerProof.code_unchanged!==true||refs.readerProof.wrapper_status!==200||refs.readerProof.live?.network_reads!==1)throw Error('Independent full-original/actual-reader evidence mismatch');
 for(const expected of refs.original.references){const comparison=refs.readerComparison.comparisons.find(r=>r.measure===expected.measure);if(!comparison?.pass||comparison.pdf_value!==expected.value||comparison.workbook_svg_value!==expected.value||comparison.actual_worker_value!==expected.value)throw Error('Full-original reader reconciliation mismatch');}
 // Bind the retained original evidence, not just the report carrying its numbers.
 const evidence=refs.original.files.map(f=>({file:'verification/remaining-gaps-2026-10-20/'+f.path,sha256:f.sha256,bytes:f.bytes}));
 for(const file of refs.pdf.source_acquisition.retained)evidence.push({file:'verification/gap-followup-2026-10-20/access-review/cqc-gov-pdf/'+file.file,sha256:file.sha256,bytes:file.bytes});
 for(const expected of evidence){const bytes=await readFile(join(root,expected.file));if(bytes.length!==expected.bytes||sha(bytes)!==expected.sha256)throw Error('Original evidence mismatch: '+expected.file);manifest.push(expected);}
 return {refs,manifest};
}
export function nativeChecks(refs,native,check,label,record,healthClock){
 check(label+' exact fixed native edition',native?.status==='ok'&&native.contract_id==='cqc-adult-social-care-pdf-2025-08-01'&&native.geography==='England'&&native.period===period&&native.publication_date===publication&&native.edition===edition&&native.framework==='CQC single assessment framework');
 check(label+' exactly five unique observed rows and definitions',Array.isArray(native.rows)&&native.rows.length===5&&new Set(native.rows.map(r=>r.measure_id)).size===5&&Array.isArray(native.definitions)&&native.definitions.length===5);
 check(label+' honest rating population and assessment unit',native.population==='Adult social care overall ratings published under the single assessment framework as at 1 August 2025.'&&native.assessment_unit==='Ratings of individual adult social care services at a location; not unique locations, providers or patients.'&&native.unit==='ratings'&&native.kind==='observation');
 check(label+' publisher source and licence',native.publisher==='Care Quality Commission'&&native.licence==='Open Government Licence v3.0'&&native.licence_url==='https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'&&native.source_url===pdfUrl);
 check(label+' exact snapshot adjustment and limitations',native.period_convention==='Historical snapshot as at 1 August 2025; not a current whole-England service census.'&&native.adjustment==='Published integer counts; not seasonally adjusted.'&&native.limitations==='Assessment was prioritised by risk and this cohort is unlikely to represent all adult social care services. Single-framework service-level ratings must not be combined with or compared with previous-framework location ratings or previous years. No whole-England quality rate, trend, care capacity, patient outcome or individual-provider recommendation is supported. The total overlaps the four categories and must not be added to them.');
 check(label+' changed original requires review',native.edition_bytes===pdfBytes&&native.edition_sha256===pdfHash&&native.revision_policy==='Fixed original PDF bytes as well as historical edition and snapshot. Every count is structurally extracted from the fetched original; any changed PDF bytes require new independent evidence and reviewed acceptance. No automatic revision or future-edition substitution.');
 check(label+' publication metadata honestly retained',same(native.publication_evidence,metadataAnchor)&&same(native.metadata?.publication_evidence,metadataAnchor)&&native.metadata?.count===5&&native.metadata?.fixed_edition===true&&native.metadata?.pdf_page_count===205&&same(native.metadata?.pdf_page_indices,[187,188])&&same(native.metadata?.printed_pages,[186,187])&&native.metadata?.figure==='A1'&&native.metadata?.publication_date_basis==='Retained official publication metadata; PDF printing date is not publication date');
 check(label+' no invented publication instant or future schedule',native.published_at===null&&native.publisher_updated_at===null&&native.next_expected_update===null);
 for(const expected of refs.original.references){
  const found=native.rows.filter(r=>r.measure_id===expected.measure),defs=native.definitions.filter(d=>d.id===expected.measure);check(label+' unique row and definition '+expected.measure,found.length===1&&defs.length===1);const row=found[0],d=defs[0];
  check(label+' independently extracted exact '+expected.measure,same(row,{measure:expected.measure,label:expected.label,measure_id:expected.measure,value:expected.value,unit:'ratings',period,value_state:'observed',geography:'England'}));
  check(label+' typed definition '+expected.measure,d.geography==='England'&&d.unit==='ratings'&&d.kind==='observation'&&d.population===native.population&&d.publisher===native.publisher&&d.licence===native.licence&&d.licence_url===native.licence_url&&d.source_url===pdfUrl&&d.period_convention===native.period_convention&&d.adjustment===native.adjustment&&d.limitations===native.limitations&&d.revision_policy===native.revision_policy&&d.publication_date===publication&&d.edition===edition&&same(d.publication_evidence,metadataAnchor)&&d.cadence==='Fixed historical snapshot; no automatic edition advancement'&&same(d.dimensions,{sector:'Adult social care',framework:native.framework,snapshot_date:period,rating:expected.label,assessment_unit:'Individual service at a location'}));
 }
 check(label+' categories reconcile to overlapping total',native.rows.slice(0,4).reduce((sum,r)=>sum+r.value,0)===native.rows[4].value&&native.rows.map(r=>r.measure_id).join('|')===measures.join('|'));
 check(label+' one exact original PDF provenance',native.provenance?.length===1);const p=native.provenance[0];
 check(label+' exact PDF acquisition identity',Object.keys(p).sort().join(',')==='bytes,retrieved_at,role,sha256,url'&&p.role==='original_pdf'&&p.url===pdfUrl&&p.sha256===pdfHash&&p.bytes===pdfBytes&&instant(p.retrieved_at)&&p.retrieved_at.slice(0,10)>=publication);
 if(healthClock!==undefined)check(label+' source completion follows provenance',instant(healthClock)&&Date.parse(healthClock)>=Date.parse(p.retrieved_at));
 if(record)check(label+' acquisition does not follow response',Date.parse(p.retrieved_at)<=Date.parse(record.completed_at)&&(healthClock===undefined||Date.parse(healthClock)<=Date.parse(record.completed_at)));
}
export function bodyChecks(refs,path,body,check,versions=new Map(),record){
 const u=new URL(path,'https://morningrows.com'),key=u.searchParams.get('source'),label=path;
 if(!key){
  if(u.pathname==='/catalog.json'){
   const matches=body.sources?.filter(c=>c.key===source)||[];check(label+' one CQC rating cohort source',matches.length===1);
   check(label+' exact five advertised measures',same(matches[0].measures?.map(m=>m.id).sort(),[...measures].sort()));
   for(const d of matches[0].measures||[])check(label+' exact measure catalogue card '+d.id,d.unit===refs.original.references.find(e=>e.measure===d.id)?.unit&&d.geography==='England'&&d.kind==='observation'&&d.records==='https://morningrows.com'+base+'&measure='+d.id);
  }else if(u.pathname==='/england.json'){
   check(label+' healthy CQC source',body.sources?.[source]?.status==='ok');
   nativeChecks(refs,body[source],check,label,record,body.sources[source].fetched_at);
   versions.set('native',body[source]);
  }
  return;
 }
 check(label+' expected selected source',key===source&&u.pathname==='/england.json');
 const native=versions.get('native');check(label+' earlier independently checked native exists',Boolean(native));
 const measure=u.searchParams.get('measure'),requestedPeriod=u.searchParams.get('observation');
 const expected=refs.original.references.filter(e=>(!measure||e.measure===measure)&&(!requestedPeriod||e.period===requestedPeriod));
 const context=Object.fromEntries(Object.entries(native).filter(([k])=>!['rows','states','catalogue','value','count'].includes(k)));
 check(label+' exact canonical selector',body.id==='https://morningrows.com'+path&&body.source==='https://morningrows.com'+base&&body.desk==='https://morningrows.com/england.json');
 check(label+' exact selected healthy coverage',expected.length>0&&body.retrieval?.status==='ok'&&instant(body.retrieval.retrieved_at)&&body.observations?.length===expected.length&&new Set(body.observations.map(r=>r.id)).size===expected.length);
 check(label+' complete selected context agrees with native',same(statistical(body.context),statistical(context)));
 nativeChecks(refs,{...body.context,rows:native.rows},check,label+' context',record,body.retrieval.retrieved_at);
 for(const e of expected){
  const id='https://morningrows.com'+base+'&measure='+e.measure+'&observation='+encodeURIComponent(period),r=body.observations.find(x=>x.id===id);
  check(label+' exact '+e.measure+' identity/value',r?.value===e.value&&r.period===e.period&&r.value_state==='observed'&&r.measure==='https://morningrows.com'+base+'&measure='+e.measure&&r.definition?.id===e.measure&&r.definition.unit===e.unit&&r.definition.geography==='England');
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
 const maximum=record.path.startsWith('/england.json')?600:3600;
 check(record.path+' bounded cache lifetime',ttl!==undefined&&Number(ttl)<=maximum);
}
export async function verifyCapture(root, directory, {revision, version, staged}) {
  const {refs, manifest} = await references(root), report = JSON.parse(await readFile(join(directory, 'cqc-pdf-interface-report.json')));
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
    return {pass: true, checks, references: manifest, requests: plan.length, independent_cells_per_domain: {cqc_ratings: 5}, fixed_edition: 'State of Care 2024/25', snapshot_date: period, source_presentations_share_statistical_lineage: true};
  } catch (error) { return {pass: false, error: error.message, checks, references: manifest}; }
}
