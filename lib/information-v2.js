import {ORIGIN, DESKS, catalogue, semantic, finishResponse} from './information.js';
import {usDigest as digest} from './us-fingerprint.js';
import {CPI_SERIES, CPI_DEFINITION, CPI_URLS, cpiWindow} from './us-cpi.js';

export const US_SCHEMA_VERSION = '2.0';
export const CURRENT_DESKS = Object.freeze({...DESKS, 'united-states': 'United States'});
export const US_INVENTORY = Object.freeze([['cpi', 'cpi', 'sources.cpi']]);
export const US_DESK_URL = `${ORIGIN}/united-states.json`;
export const US_SOURCE_URL = `${US_DESK_URL}?source=cpi`;
export const US_MEASURE_URL = `${US_SOURCE_URL}&measure=${CPI_SERIES}`;
export const US_CATALOG_URL = `${ORIGIN}/catalog.v2.json?desk=united-states`;
export const V2_SCHEMA_URL = `${ORIGIN}/schema.v2.json`;
export const observationUrl = p => `${US_MEASURE_URL}&observation=${encodeURIComponent(p)}`;
const limits = 'One national urban CPI-U series and 13 calendar slots, including unavailable months. Exact retained periods only; no state/DC-only data, other CPI definitions, annual averages, arbitrary history, inferred contract terms or substitute months.';
const canonicalCpiDefinition = JSON.stringify(semantic(CPI_DEFINITION));

export function catalogueV2(desk) {
  const base = {name: 'Morning Rows', site: ORIGIN, schema_version: US_SCHEMA_VERSION, schema: V2_SCHEMA_URL, auth: 'none', index: '/llms.txt'};
  if (desk === 'united-states') return {...base, id: US_CATALOG_URL, desk: 'United States', records: US_DESK_URL, limits, sources: [{
    id: US_SOURCE_URL, key: 'cpi', name: CPI_DEFINITION.name, records: US_SOURCE_URL, data_pointer: '/cpi', health_pointer: '/sources/cpi',
    representation: 'described_measures', measure_count: 1, measures: [{id: CPI_SERIES, name: CPI_DEFINITION.name, records: US_MEASURE_URL, definition: CPI_DEFINITION, retained_calendar_slots: 13, observation_selector: 'YYYY-MM'}],
  }]};
  // Linked old resources stay v1. An enclosing catalogue never changes their contract.
  return {...base, id: `${ORIGIN}/catalog.v2.json`, countries: [
    ...catalogue().countries.map(c => ({...c, resource_schema_version: '1.0', resource_schema: `${ORIGIN}/schema.json`})),
    {name: 'United States', id: US_DESK_URL, page: '/united-states', records: '/united-states.json', catalog: '/catalog.v2.json?desk=united-states', source_count: 1, resource_schema_version: US_SCHEMA_VERSION, resource_schema: V2_SCHEMA_URL},
  ], compatibility: 'The legacy /catalog.json and /schema.json retain eight v1 desks. Follow each entry\'s catalog and resource_schema; only the US desk uses v2. No v1 redirect or sunset.', usage: {source: US_SOURCE_URL, measure: US_MEASURE_URL, observation: `${US_MEASURE_URL}&observation=YYYY-MM`, revisions: 'Compare observation IDs and versions. A new retrieval timestamp alone is not a revision. Read retrieval status even when using cached responses.'}};
}

export function validateUsSelection(url) {
  const isDesk = url.pathname === '/united-states.json', directory = url.pathname === '/catalog.v2.json';
  const allowed = directory ? ['desk'] : isDesk ? ['source','measure','observation'] : [];
  for (const k of url.searchParams.keys()) if (!allowed.includes(k) || url.searchParams.getAll(k).length !== 1 || !url.searchParams.get(k)) return {status: 400, code: 'unsupported_query'};
  if (directory && url.searchParams.has('desk') && url.searchParams.get('desk') !== 'united-states') return {status: 404, code: 'unknown_v2_directory', message: 'Follow the resource catalog link in /catalog.v2.json for existing v1 desks.'};
  const source = url.searchParams.get('source'), measure = url.searchParams.get('measure'), observation = url.searchParams.get('observation');
  if ((measure && !source) || (observation && !measure)) return {status: 400, code: 'incomplete_selection'};
  if (source && source !== 'cpi') return {status: 404, code: 'unknown_source'};
  if (measure && measure !== CPI_SERIES) return {status: 404, code: 'unknown_measure'};
  return {source, measure, observation};
}

export function validateCpiRepresentation(cpi) {
  if (!cpi?.present || cpi.series_id !== CPI_SERIES || cpi.source_url !== CPI_URLS.data || cpi.licence !== CPI_DEFINITION.licence || JSON.stringify(semantic(cpi.definition)) !== canonicalCpiDefinition) return false;
  let expected;
  try { expected = cpiWindow(cpi.latest_period); } catch { return false; }
  if (cpi.window?.first !== expected[0] || cpi.window?.last !== expected.at(-1) || cpi.window?.slots !== 13 || cpi.rows?.length !== 13) return false;
  return cpi.rows.every((r,i) => {
    if (r.period !== expected[i] || !Array.isArray(r.footnotes) || r.footnotes.some(f => !['X','R'].includes(f.code) || !f.text)) return false;
    if (r.footnotes.some(f => f.code === 'R' && f.text !== 'Revised')) return false;
    const unavailable = r.footnotes.some(f => f.code === 'X');
    if (unavailable && !r.footnotes.some(f => f.code === 'X' && /lapse in appropriations/i.test(f.text))) return false;
    if (r.value_state === 'observed') return !unavailable && typeof r.value === 'number' && Number.isFinite(r.value) && r.value > 0 && /^\d+(?:\.\d+)?$/.test(r.value_text) && Number(r.value_text) === r.value;
    return r.value === null && r.value_text === '-' && r.value_state === (unavailable ? 'unavailable' : 'missing');
  });
}

export function withUsMetadata(body) {
  return {...body, _meta: {schema_version: US_SCHEMA_VERSION, id: US_DESK_URL, catalog: US_CATALOG_URL, schema: V2_SCHEMA_URL, retrieved_at: body.sources.cpi?.fetched_at || null, note: limits}};
}

export async function selectedUsResponse(body, selection) {
  const {measure, observation} = selection, native = body.cpi, health = body.sources?.cpi;
  const id = observation ? observationUrl(observation) : measure ? US_MEASURE_URL : US_SOURCE_URL;
  const retrieval = {status: health?.status === 'ok' ? 'ok' : 'error', retrieved_at: health?.fetched_at || null, ...(health?.error ? {error: health.error} : {}), ...(health?.http_status ? {http_status: health.http_status} : {})};
  const context = {provenance: native?.provenance || [], definition: CPI_DEFINITION, source_url: CPI_URLS.data, licence: CPI_DEFINITION.licence, licence_url: CPI_DEFINITION.licence_url, limitations: limits, timing_note: native?.timing_note || 'Publication and next-update times unknown; retrieval time is not publication time.'};
  const result = {schema_version: US_SCHEMA_VERSION, schema: V2_SCHEMA_URL, id, desk: US_DESK_URL, source: US_SOURCE_URL, retrieval, context, data: null, observations: []};
  if (retrieval.status !== 'ok') return {status: 503, body: {...result, error: 'retrieval_failed'}};
  if (!validateCpiRepresentation(native)) return {status: 503, body: {...result, retrieval: {...retrieval, status: 'error', error: 'Representation validation failed'}, error: 'representation_validation_failed'}};
  const rows = observation ? native.rows.filter(r => r.period === observation) : native.rows;
  if (!rows.length) return {status: 404, body: {...result, error: 'observation_not_retained', message: 'Exact requested month is not retained; no newer or older observation substituted.'}};
  result.observations = await Promise.all(rows.map(async row => {
    const record = {...row, id: observationUrl(row.period), measure: US_MEASURE_URL, definition: CPI_DEFINITION, source_url: CPI_URLS.data, licence: CPI_DEFINITION.licence, published_at: null, publisher_updated_at: null, next_expected_update: null};
    return {...record, version: await digest(record)};
  }));
  result.data = observation ? rows[0] : measure ? rows : native;
  // Observation versions already bind each complete qualified record. Hash their
  // ordered references here instead of serializing each definition twice more.
  result.content_version_basis = 'sha256-canonical-observation-references-v1';
  result.content_version = await digest({data: result.data, context, retrieval, observations: result.observations.map(({id,version}) => ({id,version}))});
  const {data: _data, context: _context, retrieval: _retrieval, observations: _observations, ...etagMaterial} = result;
  return {status: 200, body: result, etagMaterial};
}

export async function finishV2Response(request, response, canonicalUrl, retrievedAt = null, jsonBody, etagMaterial = jsonBody) {
  // The router already owns the JSON value. Hash that same value without a
  // Response.json -> text -> JSON.parse round trip. HTML retains the v1 path.
  let result;
  if (jsonBody === undefined) result = await finishResponse(request, response, canonicalUrl, retrievedAt);
  else {
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('Content-Location',canonicalUrl);
    if (retrievedAt) headers.set('X-Retrieved-At',retrievedAt);
    const etag = `W/"${await digest(etagMaterial)}"`;
    headers.set('ETag',etag);
    if (!headers.has('Cache-Control')) headers.set('Cache-Control',response.status===200?'public, max-age=300':'no-store');
    const same = request.headers.get('If-None-Match')?.split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag.replace(/^W\//,''));
    const empty = response.status===200&&same || request.method==='HEAD';
    if (empty) await response.body?.cancel();
    result = new Response(empty?null:response.body,{status:response.status===200&&same?304:response.status,headers});
  }
  result.headers.set('Link', `<${canonicalUrl}>; rel="canonical", <${ORIGIN}/catalog.v2.json>; rel="index", <${V2_SCHEMA_URL}>; rel="describedby"`);
  return result;
}

const uri = {type: 'string', format: 'uri'}, nullableTime = {type: ['string','null'], format: 'date-time'};
const rowProperties = {period: {type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$'}, value: {type: ['number','null']}, value_text: {type: 'string'}, value_state: {enum: ['observed','missing','unavailable','suppressed']}, footnotes: {type: 'array', items: {type: 'object', required: ['code','text'], properties: {code: {type: 'string'}, text: {type: 'string'}}}}};
export const INFORMATION_SCHEMA_V2 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: V2_SCHEMA_URL, title: 'Morning Rows v2 discovery and United States CPI contract',
  oneOf: [{$ref: '#/$defs/catalogue'}, {$ref: '#/$defs/desk'}, {$ref: '#/$defs/selected'}, {$ref: '#/$defs/error'}],
  $defs: {
    row: {type: 'object', required: Object.keys(rowProperties), properties: rowProperties, allOf: [{if: {properties: {value_state: {const: 'observed'}}}, then: {properties: {value: {type: 'number', exclusiveMinimum: 0}}}, else: {properties: {value: {type: 'null'}}}}]},
    observation: {allOf: [{$ref: '#/$defs/row'}, {type: 'object', required: ['id','measure','definition','version','source_url','licence','published_at','publisher_updated_at','next_expected_update'], properties: {id: uri, measure: {const: US_MEASURE_URL}, definition: {const: CPI_DEFINITION}, version: {type: 'string', pattern: '^[a-f0-9]{64}$'}, source_url: {const: CPI_URLS.data}, licence: {const: CPI_DEFINITION.licence}, published_at: nullableTime, publisher_updated_at: nullableTime, next_expected_update: nullableTime}}]},
    catalogue: {type: 'object', required: ['name','schema_version','schema'], properties: {name: {const: 'Morning Rows'}, schema_version: {const: US_SCHEMA_VERSION}, schema: {const: V2_SCHEMA_URL}, countries: {type: 'array', minItems: 1, items: {type: 'object', required: ['name','id','records','catalog','resource_schema_version','resource_schema'], properties: {id: uri, resource_schema_version: {enum: ['1.0','2.0']}, resource_schema: uri}}}, sources: {type: 'array', minItems: 1}}, oneOf: [{required: ['countries']}, {required: ['sources']}]},
    desk: {type: 'object', required: ['site','country','cpi','sources','_meta'], properties: {site: {const: ORIGIN}, country: {const: 'United States'}, cpi: {oneOf: [{type: 'null'}, {type: 'object', required: ['present','series_id','definition','rows','window','source_url','licence','published_at','next_expected_update'], properties: {present: {const: true}, series_id: {const: CPI_SERIES}, definition: {const: CPI_DEFINITION}, rows: {type: 'array', minItems: 13, maxItems: 13, items: {$ref: '#/$defs/row'}}}}]}, sources: {type: 'object', required: ['cpi'], properties: {cpi: {type: 'object', required: ['status','fetched_at'], properties: {status: {enum: ['ok','error']}, fetched_at: nullableTime}}}}, _meta: {type: 'object', required: ['schema_version','id','catalog','schema'], properties: {schema_version: {const: US_SCHEMA_VERSION}, id: {const: US_DESK_URL}, catalog: {const: US_CATALOG_URL}, schema: {const: V2_SCHEMA_URL}}}}, allOf: [{if: {properties: {sources: {properties: {cpi: {properties: {status: {const: 'error'}}}}}}}, then: {properties: {cpi: {type: 'null'}}}, else: {properties: {cpi: {type: 'object'}}}}]},
    selected: {type: 'object', required: ['schema_version','schema','id','source','desk','retrieval','data','context','observations'], properties: {schema_version: {const: US_SCHEMA_VERSION}, schema: {const: V2_SCHEMA_URL}, id: uri, source: {const: US_SOURCE_URL}, desk: {const: US_DESK_URL}, retrieval: {type: 'object', required: ['status','retrieved_at'], properties: {status: {enum: ['ok','error']}, retrieved_at: nullableTime}}, context: {type: 'object', required: ['definition','limitations'], properties: {definition: {const: CPI_DEFINITION}}}, observations: {type: 'array', maxItems: 13, items: {$ref: '#/$defs/observation'}}}, allOf: [{if: {properties: {retrieval: {properties: {status: {const: 'error'}}}}}, then: {properties: {data: {type: 'null'}, observations: {maxItems: 0}}, required: ['error']}}]},
    error: {type: 'object', required: ['error','schema','catalog'], not: {required: ['observations']}, properties: {error: {type: 'string'}, schema: {const: V2_SCHEMA_URL}, catalog: {const: US_CATALOG_URL}}},
  },
  'x-usage': {
    compatibility: 'v2 catalogue links eight v1 resources and the US v2 resource. Existing v1 endpoints and schema remain unchanged. Additional fields are allowed; breaking changes require a new major version.',
    selectors: 'GET/HEAD; source, measure, observation depend on one another in that order. Unknown/empty/duplicate filters:400; unknown IDs or non-retained periods:404; failed selected retrieval/representation:503. A successful source can contain unavailable observations.',
    missingness: 'Zero is not missing; a nonpositive CPI index fails validation as anomalous. Dash+X is unavailable, plain dash missing. Suppressed requires explicit publisher evidence and review; currently unsupported by this reader. Failed retrieval has no fabricated observations.',
    times: 'Monthly observation period is separate from publication and retrieval times. Unknown release times remain null. No daily-change staleness rule.',
    revisits: 'Selected content_version_basis identifies SHA-256 composition over data, context, retrieval and ordered observation ID/version references. Selected ETags bind the remaining envelope including that content version. Observation versions include value, dimensions, period, state, footnotes and attribution, not retrieval times or unrelated source-file changes. Same ID/new version means changed observation or qualifications, requiring publisher evidence to classify. File-level provenance can change the response ETag without changing any observation. Failures never return 304.',
    citations: 'Cite exact observation URL/version, publisher URL, reference month, NSA and base. Retain the response for historical audit; rolling URLs are not permanent vintage archives.',
    comparisons: limits,
  },
};
