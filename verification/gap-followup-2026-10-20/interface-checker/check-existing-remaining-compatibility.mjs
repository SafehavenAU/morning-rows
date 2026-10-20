// Constructed offline validation controls, never actual Worker acceptance.
// Runtime readers/adapters create test subjects; independent support.mjs imports
// no reader, has no network and compares only frozen Python references.
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {references, routes, sha, verifyCapture, sources} from '../../remaining-gaps-2026-10-20/interface-checker/support.mjs';
import {readSfcActivity} from '../../../lib/sfc-activity.js';
import {readCmhcRent, CMHC_RENT_URLS} from '../../../lib/cmhc-rent.js';
import {readSectionsWithCompletion} from '../../../lib/source-completion.js';
import {SourceError} from '../../../lib/sources.js';
import {catalogue, INFORMATION_SCHEMA, validateSelection, selectedResponse} from '../../../lib/information.js';

const root = fileURLToPath(new URL('../../../', import.meta.url)), base = join(root, 'verification/remaining-gaps-2026-10-20');
const bytes = path => readFile(join(base, path));
const clock = '2026-10-20T15:00:00.000Z', revision = 'a'.repeat(40), version = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const native = {
  college_activity: await readSfcActivity({now: () => clock, fetcher: async () => new Response(await bytes('prior-audit/sfc/original/tables.xlsx'))}),
  rental_benchmark: await readCmhcRent({now: () => clock, fetcher: async url => {
    const role = Object.keys(CMHC_RENT_URLS).find(k => CMHC_RENT_URLS[k] === url);
    assert.ok(role);
    return new Response(await bytes('cmhc-rent/original/' + ({data: 'points.json', series: 'series.json', cube: 'cube-response-excerpt.json'}[role])));
  }}),
};
const desks = {scotland: {}, canada: {}};
for (const [desk, key] of sources) desks[desk][key] = native[key];
for (const [desk, value] of Object.entries(desks)) {
  const health = Object.fromEntries(Object.keys(value).map(key => [key, {status: 'ok', fetched_at: clock}]));
  Object.assign(value, {site: 'https://morningrows.com', country: {scotland: 'Scotland', england: 'England', canada: 'Canada'}[desk], sources: health,
    _meta: {schema_version: '1.0', id: `https://morningrows.com/${desk}.json`, catalog: `https://morningrows.com/catalog.json?desk=${desk}`}});
}
const results = [];
for (const [desk, key, measure] of sources) {
  const tasks = Object.fromEntries(sources.map(([, source]) => [source, async () => {
    if (source === key) throw new SourceError('Constructed source-isolation control', 503);
    return structuredClone(native[source]);
  }]));
  const originalWarn = console.warn; console.warn = () => {};
  let isolated;
  try { isolated = await readSectionsWithCompletion(tasks, sources.map(([, source]) => source), {now: () => clock}); }
  finally { console.warn = originalWarn; }
  assert.equal(isolated[key], null); assert.equal(isolated.sources[key].status, 'error');
  for (const [, source] of sources.filter(([, source]) => source !== key)) {
    assert.deepEqual(isolated[source], native[source]); assert.equal(isolated.sources[source].status, 'ok');
  }
  const failedDesk = structuredClone(desks[desk]); failedDesk[key] = null; failedDesk.sources[key] = isolated.sources[key];
  const selection = validateSelection(new URL(`https://morningrows.com/${desk}.json?source=${key}&measure=${measure}`));
  const failed = await selectedResponse(failedDesk, selection, {now: clock});
  assert.equal(failed.status, 503); assert.equal(failed.body.error, 'retrieval_failed'); assert.equal(failed.body.data, null); assert.deepEqual(failed.body.observations, []);
  results.push({label: key + ' source failure preserves all successful siblings and refuses selected data', pass: true, constructed: true});
}

const {manifest} = await references(root), records = [], bodies = new Map();
for (const [i, want] of routes().entries()) {
  const u = new URL(want.path, 'https://morningrows.com'), desk = u.pathname.slice(1, -5);
  let body;
  if (want.method === 'HEAD' || want.conditional) body = undefined;
  else if (u.pathname === '/health.json') body = {source_dirty: false, source_revision: revision, worker_version: version};
  else if (u.pathname === '/schema.json') body = INFORMATION_SCHEMA;
  else if (u.pathname === '/catalog.json') body = catalogue(u.searchParams.get('desk'));
  else if (!u.searchParams.has('source')) body = desks[desk];
  else {
    const selection = validateSelection(u), response = selection.status ? {status: selection.status, body: {error: selection.code}} : await selectedResponse(desks[desk], selection, {now: clock});
    assert.equal(response.status, want.status, want.path); body = response.body;
  }
  const data = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body)), etag = '"' + sha(Buffer.from(want.path)) + '"';
  const record = {origin: 'https://morningrows.com', path: want.path, method: want.method, conditional: want.conditional, status: want.status, expected_status: want.status,
    ...(want.error ? {expected_error: want.error} : {}), ...(want.conditional ? {request_etag: etag} : {}),
    started_at: clock, completed_at: clock, headers: {'content-type': 'application/json', 'cache-control': 'public, max-age=60', 'x-source-revision': revision, 'x-worker-version': version, etag},
    bytes: data.length, sha256: sha(data)};
  if (body !== undefined) { record.file = String(i + 1).padStart(3, '0') + '.body'; bodies.set(record.file, data); }
  records.push(record);
}
const original = {pass: true, revision, version, staged: true, references: manifest, requests: records};
const dir = await mkdtemp(join(tmpdir(), 'mr-remaining-controls-'));
async function run(label, edit, expectedPass) {
  const report = structuredClone(original), copy = new Map(bodies);
  const mutate = (path, fn) => {
    const r = report.requests.find(r => r.path === path && r.file), body = JSON.parse(copy.get(r.file)); fn(body);
    const bytes = Buffer.from(JSON.stringify(body)); copy.set(r.file, bytes); r.bytes = bytes.length; r.sha256 = sha(bytes);
  };
  edit?.(report, mutate);
  for (const [file, data] of copy) await writeFile(join(dir, file), data);
  await writeFile(join(dir, 'remaining-interface-report.json'), JSON.stringify(report));
  const result = await verifyCapture(root, dir, {revision, version, staged: true});
  assert.equal(result.pass, expectedPass, label + ': ' + result.error);
  results.push({label, pass: true, expected_capture_pass: expectedPass, ...(result.error ? {rejected_for: result.error} : {}), checks: result.checks.length});
}
try {
  await run('Complete constructed adapter outputs match all7 independent reference cells', null, true);
  const schemaOutput = join(dir, 'schema-controls.json');
  const schemas = spawnSync('python3', [join(root, 'verification/gap-followup-2026-10-20/interface-checker/verify-existing-remaining-schemas.py'), dir, schemaOutput, revision, version, 'staged'], {encoding: 'utf8', maxBuffer: 1024 * 1024});
  assert.equal(schemas.status, 0, schemas.stdout + schemas.stderr);
  const schemaControls = JSON.parse(await readFile(schemaOutput, 'utf8'));
  results.push({label: 'Captured-schema positive and negative controls on constructed outputs', pass: true, schema_checks: schemaControls.schema_checks.length, negative_controls: schemaControls.negative_controls.length});
  const report={kind:'Constructed existing SFC/CMHC schema compatibility with active NI; not live release acceptance',pass:true,results};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({pass:true,checks:results.length,schema_checks:schemaControls.schema_checks.length,negative_controls:schemaControls.negative_controls.length}));
} finally { await rm(dir, {recursive: true, force: true}); }
