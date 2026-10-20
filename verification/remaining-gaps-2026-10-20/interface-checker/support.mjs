// Independent validation of actual retained public bytes. No runtime imports,
// publisher requests, automatic reference refresh or replacement observations.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const pinned = {
  college_activity: ['sfc/independent-report.json', '2d8e11cd5e85a7071f2e1e41763678d6d700555eb7ef964108fd6404746eb71b'],
  rental_benchmark: ['cmhc-rent/independent-report.json', 'cf13f540076ea58c7afbe2f33cf00a5917dd5a792c30f4cd3e62001c14667d96'],
};
export const sources = [
  ['scotland', 'college_activity', 'total', '2024-25'],
  ['canada', 'rental_benchmark', 'victoria.two_bedroom_average_rent', '2025'],
];
export const desks = ['scotland', 'canada'];
export function routes() {
  const result = ['/health.json', '/schema.json', ...desks.flatMap(d => ['/' + d + '.json', '/catalog.json?desk=' + d])].map(path => ({path}));
  for (const [desk, source, measure, period] of sources) {
    const path = `/${desk}.json?source=${source}`;
    result.push({path}, {path: path + '&measure=' + measure}, {path: path + '&measure=' + measure + '&observation=' + period});
  }
  for (const [desk, source, measure] of sources) {
    const path = `/${desk}.json?source=${source}&measure=${measure}`;
    result.push({path, status: 304, conditional: true}, {path, method: 'HEAD'});
  }
  for (const [path, status, error] of [
    ['/scotland.json?source=college_activity&measure=total&observation=2025-26', 404, 'observation_not_retained'],
    ['/canada.json?source=rental_benchmark&measure=victoria.two_bedroom_average_rent&observation=2024', 404, 'observation_not_retained'],
    ['/canada.json?source=rental_benchmark&measure=apartment_only', 404, 'unknown_measure'],
    ['/canada.json?source=rental_benchmark&measure=victoria.two_bedroom_average_rent&geography=Toronto', 400, 'unsupported_query'],
    ['/scotland.json?source=college_activity&measure=total&measure=part_time_fe', 400, 'unsupported_query'],
    ['/canada.json?source=rental_benchmark&observation=2025', 400, 'incomplete_selection'],
  ]) result.push({path, status, error});
  return result.map(r => ({method: 'GET', status: 200, conditional: false, ...r}));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => !['fetched_at', 'retrieved_at'].includes(key)).map(key => [key, canonical(value[key])]));
  return value;
}
function statistical(value) {
  if (Array.isArray(value)) return value.map(statistical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['provenance', 'retrieved_at', 'fetched_at', 'requested_at', 'acquired_at'].includes(key)).map(([key, item]) => [key, statistical(item)]));
  return value;
}
const semanticHash = value => sha(Buffer.from(JSON.stringify(canonical(value))));
export async function references(root) {
  const refs = {}, manifest = [];
  for (const [key, [relative, digest]] of Object.entries(pinned)) {
    const file = 'verification/remaining-gaps-2026-10-20/' + relative;
    const bytes = await readFile(join(root, file)), value = JSON.parse(bytes);
    if (sha(bytes) !== digest || !(value.pass === true || value.passed === true)) throw Error('Pinned independent reference mismatch: ' + key);
    refs[key] = value; manifest.push({file, sha256: digest, bytes: bytes.length});
  }
  return {refs, manifest};
}
export function expected(refs, source) {
  const r = refs[source];
  if (source === 'college_activity') return r.observations.map(v => ({id: v.measure, value: v.value, period: r.period, geography: r.geography, unit: r.unit}));
  return r.rows.map(v => ({...v, id: v.measure_id}));
}
function provenanceChecks(source, native, check, label, record) {
  const counts = {college_activity: 1, rental_benchmark: 3};
  check(label + ' complete acquisition provenance', Array.isArray(native.provenance) && native.provenance.length === counts[source]);
  for (const p of native.provenance) {
    check(label + ' public provenance shape', /^https:\/\//.test(p.url || '') && /^[a-f0-9]{64}$/.test(p.sha256 || '') && Number.isSafeInteger(p.bytes) && p.bytes > 0 && Number.isFinite(Date.parse(p.retrieved_at)));
    if (record) check(label + ' acquisition not after captured response', Date.parse(p.retrieved_at) <= Date.parse(record.completed_at));
  }
  if (source === 'rental_benchmark') check(label + ' three different acquisition roles', same(native.provenance.map(p => p.role).sort(), ['cube', 'data', 'series']));
}
function noticeChecks(notice, period, check, label) {
  check(label + ' conditional CMHC source/adaptation notices', notice?.terms_url === 'https://www.cmhc-schl.gc.ca/about-us/terms-conditions/hmip-terms-conditions'
    && notice.source_notice?.includes(`, ${period}.`) && notice.source_notice?.includes('Canada Mortgage and Housing Corporation')
    && /does not constitute an endorsement/.test(notice.adaptation_notice || '')
    && /Using these CMHC data constitutes agreement/.test(notice.conditions || '')
    && /recipients to agree/.test(notice.conditions || '') && /No recipient acceptance is recorded/.test(notice.conditions || ''));
}
export function nativeChecks(refs, source, native, check, label, record) {
  const exp = expected(refs, source);
  check(label + ' complete exact native coverage', Array.isArray(native?.rows) && native.rows.length === exp.length);
  for (const e of exp) {
    const found = native.rows.filter(r => (r.measure_id || r.measure) === e.id);
    check(label + ' unique ' + e.id, found.length === 1);
    const row = found[0];
    check(label + ' ' + e.id + ' exact value/period/unit', row.value === e.value && row.period === e.period && row.unit === e.unit && row.value_state === 'observed');
    if (source === 'college_activity') check(label + ' ' + e.id + ' academic FTE meaning', row.geography === 'Scotland' && row.period_start === '2024-08-01' && row.period_end === '2025-07-31' && row.rounding === 'nearest five');
    if (source === 'rental_benchmark') {
      check(label + ' ' + e.id + ' exact census area and annual October period', row.geography === e.geography && row.dguid === e.geography_code && row.geography_type === (e.geography_type === 'CMA' ? 'Census metropolitan area' : 'Census agglomeration')
        && row.survey_month === e.survey_month && row.reference_date === e.period + '-01-01' && row.ref_per_raw === e.period + '-10-01');
      check(label + ' ' + e.id + ' exact WDS identities/release/flags', row.dimensions?.coordinate === e.coordinate && row.dimensions.vector === String(e.vector_id)
        && row.release_timestamp_raw === e.release_timestamp_raw && row.release_timezone === null && row.unit_code === 81 && row.scalar_code === 0 && row.frequency_code === 12
        && row.status_code === 0 && row.security_level_code === 0 && row.symbol_code === 0);
      noticeChecks(row.licence_notice, e.period, check, label + ' ' + e.id);
    }
  }
  provenanceChecks(source, native, check, label, record);
  if (source === 'college_activity') check(label + ' fixed edition and honest overlapping FTE population', native.period === refs[source].period && native.publication_date === refs[source].publication_date
    && /all funding sources/.test(native.population || '') && /not.*headcounts/.test(native.population || '') && /total overlaps/.test(native.limitations || '') && /15 credits or 600 learning hours/.test(native.definition || ''));
  if (source === 'rental_benchmark') {
    check(label + ' current annual cube and CMHC licence', native.metadata?.latest_period === refs[source].period && native.metadata.cube_end_date === refs[source].period + '-01-01'
      && native.metadata.release_timestamp_raw === refs[source].release_timestamp_raw && native.metadata.release_timezone === null
      && native.licence === 'CMHC Licence Agreement for the Use of Data' && /not a current asking-rent/.test(native.limitations || ''));
    noticeChecks(native.licence_notice, refs[source].period, check, label);
  }
}
export function bodyChecks(refs, path, body, check, versions = new Map(), record) {
  const u = new URL(path, 'https://morningrows.com'), source = u.searchParams.get('source'), desk = u.pathname.slice(1, -5), label = path;
  if (!source) {
    if (u.pathname === '/catalog.json') {
      for (const [, key] of sources.filter(v => v[0] === u.searchParams.get('desk'))) {
        const card = body.sources?.find(c => c.key === key), ids = expected(refs, key).map(e => e.id).sort();
        check(label + ' ' + key + ' discoverable exact measures', same(card?.measures?.map(m => m.id).sort(), ids));
      }
    } else for (const [, key] of sources.filter(v => v[0] === desk)) {
      check(label + ' ' + key + ' healthy native source', body.sources?.[key]?.status === 'ok');
      nativeChecks(refs, key, body[key], check, label + ' ' + key, record);
      versions.set('native:' + key, body[key]);
    }
    return;
  }
  if (!sources.some(v => v[0] === desk && v[1] === source)) throw Error('Unexpected successful source');
  const measure = u.searchParams.get('measure'), period = u.searchParams.get('observation');
  const exp = expected(refs, source).filter(e => (!measure || e.id === measure) && (!period || e.period === period));
  const native = versions.get('native:' + source);
  check(label + ' earlier independently checked native source exists', Boolean(native));
  const context = Object.fromEntries(Object.entries(native).filter(([key]) => !['rows', 'states', 'catalogue', 'value', 'count'].includes(key)));
  check(label + ' complete selected context agrees with native source', semanticHash(statistical(body.context)) === semanticHash(statistical(context)));
  const typedRows = native.rows.map(row => source === 'college_activity' ? (({measure, ...rest}) => ({measure_id: measure, ...rest}))(row) : row);
  const canonical = `https://morningrows.com/${desk}.json?source=${source}`;
  check(label + ' exact canonical selector', body.id === 'https://morningrows.com' + path && body.source === canonical && body.desk === `https://morningrows.com/${desk}.json`);
  check(label + ' complete selected coverage', exp.length > 0 && body.retrieval?.status === 'ok' && body.observations?.length === exp.length && new Set(body.observations.map(v => v.id)).size === exp.length);
  for (const e of exp) {
    const id = canonical + '&measure=' + e.id + '&observation=' + e.period, row = body.observations.find(v => v.id === id);
    check(label + ' ' + e.id + ' exact observation identity/value', row?.value === e.value && row.period === e.period && row.measure === canonical + '&measure=' + e.id && row.value_state === 'observed'
      && row.definition?.id === e.id && row.definition.unit === e.unit && row.definition.geography === e.geography && /^[a-f0-9]{64}$/.test(row.version || ''));
    check(label + ' ' + e.id + ' retained cell qualifications', row.qualifications?.value === e.value && row.qualifications.period === e.period && row.qualifications.unit === e.unit && row.qualifications.measure_id === e.id);
    const originalRow = typedRows.find(v => v.measure_id === e.id);
    check(label + ' ' + e.id + ' complete qualifications agree with native row', semanticHash(statistical(row.qualifications)) === semanticHash(statistical(originalRow)));
    const {version, native_pointer, ...versioned} = row;
    check(label + ' ' + e.id + ' independently replayed observation version', version === semanticHash(versioned));
    if (source === 'rental_benchmark') noticeChecks(row.qualifications.licence_notice, e.period, check, label + ' selected ' + e.id);
    if (source === 'college_activity') check(label + ' selected FTE limitations', /not.*headcounts/.test(row.definition.population || '') && /15 credits or 600/.test(row.definition.definition || ''));
    if (versions.has(id)) check(label + ' stable observation version across selectors/domains', versions.get(id) === row.version); else versions.set(id, row.version);
  }
  check(label + ' statistical content version', /^[a-f0-9]{64}$/.test(body.content_version || ''));
  check(label + ' independently replayed statistical content version', body.content_version === semanticHash({
    data: statistical(body.data), context: statistical(body.context),
    observations: body.observations.map(({native_pointer, ...row}) => row), retrieval: body.retrieval,
  }));
  if (!measure) {
    nativeChecks(refs, source, body.data, check, label + ' selected source', record);
    check(label + ' complete source data agrees with native source', semanticHash(statistical(body.data)) === semanticHash(statistical(native)));
  } else check(label + ' complete single selected row agrees with native row', !Array.isArray(body.data) && semanticHash(statistical(body.data)) === semanticHash(statistical(typedRows.find(v => v.measure_id === exp[0].id))));
}
export function cacheChecks(record, check) {
  if (record.status !== 200 || record.path.startsWith('/health') || record.path.startsWith('/schema')) return;
  const ttl = record.headers['cache-control']?.match(/(?:^|[,\s])max-age=(\d+)/)?.[1];
  check(record.path + ' bounded cache lifetime', ttl !== undefined && Number(ttl) <= 3600);
  if (!record.path.startsWith('/canada.json')) return;
  const start = Date.parse(record.started_at), rollover = (Math.floor(start / 86400000) + 1) * 86400000;
  check(record.path + ' Canada cache expires by UTC midnight', Number(ttl) <= Math.floor((rollover - start) / 1000) && Date.parse(record.completed_at) < rollover);
}
export async function verifyCapture(root, directory, {revision, version, staged}) {
  const {refs, manifest} = await references(root), report = JSON.parse(await readFile(join(directory, 'remaining-interface-report.json')));
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
    return {pass: true, checks, references: manifest, requests: plan.length, independent_cells_per_domain: {sfc: 5, cmhc: 2}, held_sources_included: false};
  } catch (error) { return {pass: false, error: error.message, checks, references: manifest}; }
}
