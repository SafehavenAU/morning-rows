// Offline reconciliation of captured native/selected bodies with independent
// Python extraction. No requests, reader imports, or substituted fixtures.
// node scripts/verify-claimant-captures.mjs CAPTURE_DIR REFERENCE_JSON OUTPUT
//      [--require-selectors]
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const DESKS = {
  'united-kingdom': ['K02000001', 'United Kingdom'],
  england: ['E92000001', 'England'],
  scotland: ['S92000003', 'Scotland'],
  wales: ['W92000004', 'Wales'],
  'northern-ireland': ['N92000002', 'Northern Ireland'],
};
const ORIGIN = 'https://morningrows.com';
const failUnless = (condition, message) => {if (!condition) throw Error(message);};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = (desk, period) => `${ORIGIN}/${desk}.json?source=claimant_count&measure=claimants${period ? '&observation=' + period : ''}`;
const monthsFrom = latest => {
  const [year, month] = latest.split('-').map(Number), end = year * 12 + month - 1;
  return Array.from({length: 13}, (_, index) => {
    const n = end - 12 + index;
    return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`;
  });
};

export async function verifyClaimantCaptures({directory, referenceFile, requireSelectors = false, expectedRevision, expectedVersion}) {
  const inputs = [], checks = [], comparisons = [], selectors = [], negativeResponses = [], transportChecks = [];
  const captureDirectory = resolve(directory), referencePath = resolve(referenceFile);
  const read = async file => {
    const bytes = await readFile(file);
    inputs.push({file: resolve(file), bytes: bytes.length, sha256: sha(bytes)});
    return JSON.parse(bytes);
  };
  const reference = await read(referencePath);
  failUnless(reference.pass === true && reference.observations_compared === 65, 'independent reference failed');
  failUnless(/^\d{4}-(0[1-9]|1[0-2])$/.test(reference.period_end), 'invalid reference latest month');
  const periods = monthsFrom(reference.period_end);
  failUnless(reference.period_start === periods[0] && reference.history?.length === 5, 'invalid reference coverage');
  const histories = new Map(reference.history.map(history => [history.geography_code, history]));
  const metadata = new Map(reference.period_metadata.map(item => [item.period, item]));
  failUnless(histories.size === 5 && metadata.size === 13 && periods.every(period => metadata.has(period)), 'duplicate or missing reference metadata');
  for (const [code, name] of Object.values(DESKS)) {
    const history = histories.get(code);
    failUnless(history?.geography === name && history.observations?.length === 13
      && history.observations.every((row, index) => row.period === periods[index]
        && Number.isSafeInteger(row.count) && row.count >= 0 && row.count % 5 === 0
        && row.obs_status === 'A' && row.obs_conf === 'F'), 'invalid independent observation series');
  }
  const names = await readdir(captureDirectory);
  const production = names.some(name => /^(apex|www)-/.test(name));
  const hosts = production ? ['apex', 'www'] : ['stage'];
  const filename = (host, path) => host === 'stage'
    ? path.replaceAll('/', '_') + '.response'
    : host + '-' + encodeURIComponent(path) + '.body';
  const check = (name, fn) => {
    try {fn(); checks.push({name, pass: true});}
    catch (error) {checks.push({name, pass: false, error: error.message});}
  };
  const reportName = ['claimant-interface-report.json', 'staged-preview-report.json', 'report.json'].find(name => names.includes(name));
  const captureReport = reportName ? await read(join(captureDirectory, reportName)) : null;
  const requests = captureReport ? [...(captureReport.imported || []), ...(captureReport.requests || [])] : [];
  if (captureReport) check('original capture report passed', () => failUnless(
    captureReport.pass === true && requests.length > 0, 'capture report failed or has no requests'));
  const requestHost = record => {
    failUnless(['https://morningrows.com', 'https://www.morningrows.com'].includes(record.origin || ORIGIN), 'unknown captured origin');
    return production ? (record.origin === 'https://www.morningrows.com' ? 'www' : 'apex') : 'stage';
  };
  const bodyRequests = (host, path) => requests.filter(record => requestHost(record) === host && record.path === path
    && (record.method || 'GET') === 'GET' && !record.conditional);
  const classification = path => {
    const query = new URL(path, ORIGIN).searchParams;
    if ([...query.keys()].some(key => !['source', 'measure', 'observation'].includes(key)
      || query.getAll(key).length !== 1 || !query.get(key)))
      return {status: 400, error: 'unsupported_query', kind: 'invalid_query'};
    if (query.has('observation') && !query.has('measure'))
      return {status: 400, error: 'incomplete_selection', kind: 'incomplete_selection'};
    if (query.has('measure') && query.get('measure') !== 'claimants')
      return {status: 404, error: 'unknown_measure', kind: 'unknown_measure'};
    if (query.has('observation') && !periods.includes(query.get('observation')))
      return {status: 404, error: 'observation_not_retained', kind: 'unretained_period'};
    return {status: 200, kind: query.has('observation') ? 'exact_month' : 'history'};
  };
  const load = async (host, path) => {
    try {
      const file = join(captureDirectory, filename(host, path)), document = await read(file);
      if (captureReport) check(`${host} captured body binding ${path}`, () => {
        const matches = bodyRequests(host, path);
        failUnless(matches.length === 1, 'missing or ambiguous original GET metadata');
        const record = matches[0], input = inputs.find(item => item.file === resolve(file));
        if (record.sha256) failUnless(record.sha256 === input.sha256, 'captured body hash mismatch');
        if (record.bytes !== undefined) failUnless(record.bytes === input.bytes, 'captured body length mismatch');
        if (record.file) failUnless(record.file === filename(host, path), 'captured body file mismatch');
      });
      return document;
    }
    catch (error) {checks.push({name: `${host} capture ${path}`, pass: false, error: error.code === 'ENOENT' ? 'missing_capture' : 'invalid_capture'}); return null;}
  };
  const expected = (desk, period) => histories.get(DESKS[desk][0]).observations.find(row => row.period === period);
  const validateSourceUrl = value => {
    const url = new URL(value);
    failUnless(url.origin === 'https://www.nomisweb.co.uk'
      && url.pathname === '/api/v01/dataset/NM_162_1.data.csv', 'wrong original publisher/dataset URL');
    for (const [key, val] of Object.entries({gender: '0', age: '0', measure: '1', measures: '20100', date: 'latestMINUS12-latest'}))
      failUnless(url.searchParams.get(key) === val && url.searchParams.getAll(key).length === 1, `source URL wrong ${key}`);
    const codes = url.searchParams.get('geography')?.split(',');
    failUnless(codes?.length === 5 && new Set(codes).size === 5
      && Object.values(DESKS).every(([code]) => codes.includes(code)), 'source URL wrong national scope');
  };
  const validateRow = (row, desk) => {
    const [code, name] = DESKS[desk], match = expected(desk, row?.period), meta = metadata.get(row?.period);
    failUnless(match && meta, 'period does not belong to independently verified release');
    failUnless(row.value === match.count && row.value_state === 'observed', 'count or observed state differs from independent specimen');
    failUnless(row.geography === name && row.geography_code === code
      && row.unit === 'persons' && row.adjustment === 'not seasonally adjusted', 'wrong row geography/unit/adjustment');
    for (const [key, value] of Object.entries({dataset: 'NM_162_1', gender: '0', age: '0', measure: '1', measures: '20100', geography: code}))
      failUnless(row.dimensions?.[key] === value, `wrong row dimension ${key}`);
    failUnless(row.obs_status === 'A' && row.obs_conf === 'F', 'invalid status/publication flag');
    failUnless(row.reference_date === meta['taken on']
      && row.release_timestamp_raw === meta.CurrentRevisionReleased
      && row.release_timezone === null && row.revision_version === meta.CurrentRevisionVersion,
    'reference date/release/revision mismatch');
  };
  const validateMetadata = native => {
    const latest = metadata.get(reference.period_end), m = native?.metadata;
    failUnless(m?.count === 13 && m.first_period === periods[0]
      && m.latest_period === reference.period_end && m.acquisition_record_count === 65, 'older, newer or incomplete data window');
    failUnless(m.reference_date === latest['taken on']
      && m.release_timestamp_raw === latest.CurrentRevisionReleased
      && m.release_timezone === null && m.revision_version === latest.CurrentRevisionVersion
      && m.release_status === 'Live', 'source release metadata differs from evidence');
    failUnless(m.next_revision_scheduled_raw === (latest.NextRevisionScheduled ?? null)
      && m.next_revision_timezone === null, 'next revision metadata differs from evidence');
    failUnless(m.time_codelist_url === 'https://www.nomisweb.co.uk/api/v01/dataset/NM_162_1/time.def.sdmx.json', 'missing authoritative latest-period anchor');
  };
  const validateDefinition = (definition, desk) => {
    const [code, name] = DESKS[desk];
    failUnless(definition?.id === 'claimants' && definition.geography === name && definition.geography_code === code
      && definition.unit === 'persons' && definition.adjustment === 'not seasonally adjusted'
      && definition.kind === 'observation' && definition.cadence === 'monthly', 'definition statistical dimensions mismatch');
    failUnless(/all sexes/i.test(definition.population || '') && /age 16/i.test(definition.population || '')
      && /Jobseeker.*Allowance/.test(definition.population || '') && /Universal Credit/.test(definition.population || '')
      && /reference-date stock/i.test(definition.period_convention || '') && /nearest five/i.test(definition.rounding || '')
      && /not ILO unemployment/i.test(definition.limitations || ''), 'missing population/stock/rounding or unemployment qualification');
    for (const [key, value] of Object.entries({dataset: 'NM_162_1', gender: '0', age: '0', measure: '1', measures: '20100', geography: code}))
      failUnless(definition.dimensions?.[key] === value, `wrong definition dimension ${key}`);
  };
  const validateProvenance = native => {
    failUnless(native.provenance?.length === 2, 'missing bounded acquisition provenance');
    for (const kind of ['publisher_time_codelist', 'publisher_national_counts']) {
      const matches = native.provenance.filter(item => item.kind === kind);
      failUnless(matches.length === 1 && /^[a-f0-9]{64}$/.test(matches[0].sha256 || '')
        && Number.isSafeInteger(matches[0].bytes) && matches[0].bytes > 0
        && Number.isFinite(Date.parse(matches[0].retrieved_at)), 'invalid acquisition provenance');
      if (kind === 'publisher_national_counts') validateSourceUrl(matches[0].url);
      else failUnless(matches[0].url === 'https://www.nomisweb.co.uk/api/v01/dataset/NM_162_1/time.def.sdmx.json', 'wrong provenance metadata URL');
    }
  };
  const validateNative = (native, desk) => {
    const [code, name] = DESKS[desk];
    failUnless(native?.dataset === 'NM_162_1' && native.measure === 'claimants'
      && native.geography === name && native.geography_code === code
      && native.unit === 'persons' && native.adjustment === 'not seasonally adjusted', 'native statistical contract mismatch');
    failUnless(native.published_at === null && native.publisher_updated_at === null
      && native.next_expected_update === null, 'unzoned publisher timestamps presented as known absolute timestamps');
    failUnless(/Open Government Licence/i.test(native.licence || '') && /ONS|Office for National Statistics|Nomis/i.test(native.publisher || ''), 'missing publisher/licence attribution');
    validateDefinition(native.definition, desk);
    validateSourceUrl(native.source_url);
    validateMetadata(native);
    validateProvenance(native);
    failUnless(native.rows?.length === 13 && native.rows.every((row, index) => row.period === periods[index]), 'native history missing, duplicate or unordered');
  };
  const identities = {};
  for (const host of hosts) {
    const health = await load(host, '/health.json');
    check(`${host} clean captured identity`, () => {
      failUnless(health?.source_dirty === false && /^[a-f0-9]{40}$/.test(health.source_revision || '')
        && /^[a-f0-9-]{36}$/.test(health.worker_version || '') && /^[a-f0-9]{16}$/.test(health.build_fingerprint || ''), 'missing or dirty source identity');
      if (expectedRevision) failUnless(health.source_revision === expectedRevision, 'wrong expected revision');
      if (expectedVersion) failUnless(health.worker_version === expectedVersion, 'wrong expected Worker version');
    });
    identities[host] = health;
    for (const record of requests.filter(item => requestHost(item) === host)) {
      const url = new URL(record.path, ORIGIN), desk = url.pathname.slice(1, -5);
      const selectedPath = Object.hasOwn(DESKS, desk) && url.searchParams.get('source') === 'claimant_count';
      if (!selectedPath && record.path !== '/health.json' && !(Object.hasOwn(DESKS, desk) && !url.search)) continue;
      const rule = selectedPath ? classification(record.path) : {status: 200, kind: 'native'};
      const method = record.method || 'GET', expectedStatus = record.conditional ? 304 : rule.status;
      const item = {host, path: record.path, method, conditional: Boolean(record.conditional),
        status: record.status, expected_status: expectedStatus,
        kind: record.conditional ? 'conditional' : method === 'HEAD' ? 'head' : rule.kind};
      try {
        failUnless(['GET', 'HEAD'].includes(method) && (!record.conditional || method === 'GET' && rule.status === 200), 'unexpected request method or conditional error request');
        failUnless(record.status === expectedStatus
          && (record.expected_status === undefined || record.expected_status === expectedStatus), 'unexpected recorded HTTP outcome');
        failUnless(record.headers?.['x-source-revision'] === health?.source_revision
          && record.headers?.['x-worker-version'] === health?.worker_version
          && (record.headers?.['x-source-dirty'] === undefined || record.headers['x-source-dirty'] === 'false'), 'captured response identity mismatch');
        if (record.conditional || method === 'HEAD') {
          failUnless(rule.status === 200 && record.bytes === 0
            && (!record.sha256 || record.sha256 === sha('')), 'bodyless response has content or invalid selector');
          const get = bodyRequests(host, record.path);
          failUnless(get.length === 1 && get[0].status === 200 && get[0].headers?.etag
            && get[0].headers.etag === record.headers.etag, 'conditional/HEAD ETag differs from successful GET');
        }
        item.pass = true;
      } catch (error) {item.pass = false; item.error = error.message;}
      transportChecks.push(item);
    }
    for (const desk of Object.keys(DESKS)) {
      const full = await load(host, `/${desk}.json`), native = full?.claimant_count;
      check(`${host}/${desk} source and metadata`, () => {
        failUnless(full?.country === DESKS[desk][1] && full?.sources?.claimant_count?.status === 'ok', 'claimant source unhealthy or wrong desk');
        validateNative(native, desk);
      });
      for (const period of periods) {
        const rows = native?.rows?.filter(row => row.period === period) || [];
        const item = {host, desk, period, expected: expected(desk, period).count, actual: rows[0]?.value ?? null};
        try {failUnless(rows.length === 1, 'missing or duplicate native observation'); validateRow(rows[0], desk); item.pass = true;}
        catch (error) {item.pass = false; item.error = error.message;}
        comparisons.push(item);
      }
      const base = `/${desk}.json?source=claimant_count`, measure = base + '&measure=claimants';
      const paths = names.flatMap(name => {
        let path;
        if (host === 'stage' && name.startsWith(`_${desk}.json?`) && name.endsWith('.response')) path = '/' + name.slice(1, -9);
        if (host !== 'stage' && name.startsWith(host + '-') && name.endsWith('.body')) path = decodeURIComponent(name.slice(host.length + 1, -5));
        if (!path) return [];
        const url = new URL(path, ORIGIN);
        return url.pathname === `/${desk}.json` && url.searchParams.get('source') === 'claimant_count' ? [path] : [];
      });
      if (requireSelectors) for (const path of [base, measure, measure + '&observation=' + periods[0], measure + '&observation=' + reference.period_end])
        check(`${host} required selector ${path}`, () => failUnless(paths.includes(path), 'missing required selected capture'));
      for (const path of paths) {
        const selected = await load(host, path), requested = new URL(path, ORIGIN).searchParams.get('observation');
        const rule = classification(path);
        if (rule.status !== 200) {
          check(`${host} expected ${rule.status} semantics ${path}`, () => {
            const records = bodyRequests(host, path);
            failUnless(captureReport && records.length === 1 && records[0].status === rule.status,
              'negative response lacks matching original HTTP evidence');
            failUnless(selected?.error === rule.error
              && (selected.data === undefined || selected.data === null)
              && (selected.observations === undefined || selected.observations.length === 0), 'negative response returned incorrect error or substituted data');
            if (rule.kind === 'unretained_period') failUnless(selected.data === null
              && selected.observations?.length === 0 && selected.retrieval?.status === 'ok', 'unretained month lacks successful source context');
          });
          negativeResponses.push({host, path, kind: rule.kind, expected_status: rule.status, observations: 0});
          continue;
        }
        check(`${host} selected semantics ${path}`, () => {
          failUnless(selected?.retrieval?.status === 'ok' && !selected.error, 'selected source failed');
          const wanted = requested ? [requested] : periods;
          failUnless(selected.observations?.length === wanted.length
            && selected.observations.every((row, index) => row.period === wanted[index]), 'selected history incomplete or substituted');
          validateMetadata(selected.context);
          validateDefinition(selected.context.definition, desk);
          validateProvenance(selected.context);
          for (const observation of selected.observations) {
            const definition = observation.definition;
            failUnless(observation.id === canonical(desk, observation.period)
              && observation.measure === canonical(desk) && observation.value === expected(desk, observation.period).count
              && observation.value_state === 'observed' && /^[a-f0-9]{64}$/.test(observation.version || ''), 'selected value/identity/version mismatch');
            validateDefinition(definition, desk);
            failUnless(observation.publisher_status?.obs_status === 'A'
              && observation.publisher_status?.obs_conf === 'F'
              && observation.published_at === null && observation.publisher_updated_at === null
              && observation.next_expected_update === null
              && /Open Government Licence/i.test(observation.licence || ''), 'selected publication flags/licence/timestamps mismatch');
            validateSourceUrl(observation.source_url);
            validateRow(observation.qualifications, desk);
          }
          if (requested) validateRow(selected.data, desk);
          else {
            failUnless(Array.isArray(selected.data) && selected.data.length === 13
              && selected.data.every((row, index) => row.period === periods[index]), 'selected native history collapsed or substituted');
            selected.data.forEach(row => validateRow(row, desk));
          }
        });
        selectors.push({host, path, kind: requested ? 'exact_month' : 'history', observations: selected?.observations?.length ?? null});
      }
    }
  }
  if (production) check('both domains share captured clean identity', () => failUnless(
    identities.apex?.source_revision === identities.www?.source_revision
    && identities.apex?.worker_version === identities.www?.worker_version
    && identities.apex?.build_fingerprint === identities.www?.build_fingerprint, 'domain release mismatch'));
  return {
    checked_at: new Date().toISOString(), capture_directory: captureDirectory,
    reference_file: referencePath, mode: production ? 'production' : 'stage',
    pass: checks.every(item => item.pass) && comparisons.every(item => item.pass) && transportChecks.every(item => item.pass)
      && comparisons.length === hosts.length * 65,
    native_cells_compared: comparisons.length,
    latest_period: reference.period_end, first_period: periods[0], identities,
    checks, comparisons, selectors, negative_responses: negativeResponses, transport_checks: transportChecks, inputs,
    limitations: [
      'Offline reconciliation only. When an original capture report is supplied, recorded status/identity/body hashes and conditional/HEAD metadata are checked; no new HTTP execution, runtime CPU or live acquisition is proved.',
      'The retained independent reference fixes one release. A later release fails until separately acquired and reconciled evidence is explicitly supplied.',
      'Nomis CSV/JSON share statistical lineage; the separate NISRA presentation covers one comparable NI observation, not all65 independent population measurements.',
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [directory, referenceFile, output, ...flags] = process.argv.slice(2);
  if (!directory || !referenceFile || !output || flags.some(flag => flag !== '--require-selectors'))
    throw Error('Usage: CAPTURE_DIR REFERENCE_JSON OUTPUT [--require-selectors]');
  const report = await verifyClaimantCaptures({directory, referenceFile, requireSelectors: flags.includes('--require-selectors'),
    expectedRevision: process.env.EXPECTED_REVISION, expectedVersion: process.env.EXPECTED_WORKER_VERSION});
  await writeFile(resolve(output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({pass: report.pass, native_cells_compared: report.native_cells_compared,
    selectors: report.selectors.length, negative_responses: report.negative_responses.length,
    transport_checks: report.transport_checks.length,
    failures: [...report.checks, ...report.comparisons, ...report.transport_checks].filter(item => !item.pass), output: resolve(output)}, null, 2));
  if (!report.pass) process.exitCode = 1;
}
