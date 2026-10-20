import {fetchOfficial, SourceError} from './sources.js';

const api = 'https://www150.statcan.gc.ca/t1/wds/rest/';
export const CMHC_RENT_URLS = Object.freeze({
  data: api + 'getDataFromCubePidCoordAndLatestNPeriods',
  series: api + 'getSeriesInfoFromCubePidCoord',
  cube: api + 'getCubeMetadata',
});
const product = 34100133;
const title = 'Canada Mortgage and Housing Corporation, average rents for areas with a population of 10,000 and over';
const structure = 'Row and apartment structures of three units and over';
const unitType = 'Two bedroom units';
const licence = 'CMHC Licence Agreement for the Use of Data';
const terms = 'https://www.cmhc-schl.gc.ca/about-us/terms-conditions/hmip-terms-conditions';
const methodology = 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research/surveys/methods/methodology-rental-market-survey';
const sourceUrl = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301';
const conditions = 'Using these CMHC data constitutes agreement to the linked CMHC Licence Agreement. Any redistribution must require recipients to agree to those terms; preserve attribution, accuracy and the no-endorsement notice. No recipient acceptance is recorded by this response.';
const limitations = 'Annual October survey benchmark, not a current asking-rent quote, median, apartment-only estimate, municipality-wide total or housing-availability measure. Includes vacant and occupied units and new and existing structures. Geographical areas may change with census definitions, so historical values are not strictly comparable. A symbol of none does not establish finality.';
const symbols = Object.freeze({0: 'none', 1: 'preliminary', 3: 'revised'});
const bounds = Object.freeze({data: 16384, series: 16384, cube: 131072});
export const CMHC_RENT_SERIES = Object.freeze([
  Object.freeze({id: 'victoria.two_bedroom_average_rent', geography: 'Victoria, British Columbia', geography_type: 'Census metropolitan area', dguid: '2011S0503935', member: 186, classification: '935', geo_level: 503, coordinate: '186.3.3.0.0.0.0.0.0.0', vector: 3823106}),
  Object.freeze({id: 'victoriaville.two_bedroom_average_rent', geography: 'Victoriaville, Quebec', geography_type: 'Census agglomeration', dguid: '2011S0504440', member: 66, classification: '440', geo_level: 504, coordinate: '66.3.3.0.0.0.0.0.0.0', vector: 3823208}),
]);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => a === b || (Array.isArray(a) || Array.isArray(b)
  ? Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]))
  : object(a) && object(b) && Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([k, v]) => Object.hasOwn(a, k) && same(a[k], v)));
const need = (condition, message) => { if (!condition) throw new SourceError('CMHC rental benchmark: ' + message); };
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const rawTime = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(v) && date(v.slice(0, 10));
const instant = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().replace('.000Z', 'Z') === v.replace('.000Z', 'Z');
function annual(reference) {
  need(typeof reference === 'string' && /^(?:19|20|21)\d{2}-01-01$/.test(reference), 'Invalid annual reference period');
  const year = reference.slice(0, 4);
  return {period: year, reference_date: reference, ref_per_raw: year + '-10-01', survey_month: year + '-10', period_start: year + '-10-01', period_end: year + '-10-31'};
}
const dimensions = s => ({product: String(product), coordinate: s.coordinate, vector: String(s.vector), geography: String(s.member), structure: '3', unit_type: '3'});
const notice = reference => ({
  source_notice: `Source: Canada Mortgage and Housing Corporation (CMHC), ${title}, ${reference}. This information is reproduced and distributed on an "as is" basis with the permission of CMHC.`,
  adaptation_notice: `Adapted from Canada Mortgage and Housing Corporation, ${title}, ${reference}. This does not constitute an endorsement by Canada Mortgage and Housing Corporation of this product.`,
  terms_url: terms,
  conditions,
});
export function cmhcRentDefinitions() {
  return CMHC_RENT_SERIES.map(s => ({
    id: s.id, name: 'Two-bedroom weighted average monthly rent', geography: s.geography,
    geography_type: s.geography_type, dguid: s.dguid, unit: 'CAD per month',
    population: 'Two-bedroom units in eligible privately initiated row and apartment structures of three units and over, including vacant and occupied units and new and existing structures.',
    definition: 'CMHC Rental Market Survey weighted average monthly rent for the selected two-bedroom combined row-and-apartment category.',
    adjustment: 'Not specified by the selected publisher metadata', kind: 'observation', cadence: 'annual',
    period_convention: 'YYYY identifies the October survey year. The annual publisher reference is January 1 and the raw reference is October 1; this is not an average over twelve calendar months.',
    dimensions: dimensions(s), publisher: 'Statistics Canada', original_publisher: 'Canada Mortgage and Housing Corporation',
    licence, licence_url: terms, licence_conditions: conditions, source_url: sourceUrl,
    methodology_url: methodology, revision_policy: 'Use the latest annual point only when it matches the current cube vintage and release. Preserve preliminary/revised symbols and release metadata; no substitution with an older year.',
    limitations,
  }));
}
function envelopes(value, count, label) {
  need(Array.isArray(value) && value.length === count, 'Incorrect ' + label + ' response coverage');
  return value.map(r => {
    need(r?.status === 'SUCCESS' && object(r.object) && r.object.responseStatusCode === 0, 'Invalid ' + label + ' response envelope');
    return r.object;
  });
}
function identify(rows, label) {
  const found = new Map();
  for (const row of rows) {
    const s = CMHC_RENT_SERIES.find(s => s.coordinate === row.coordinate);
    need(s && row.productId === product && row.vectorId === s.vector && !found.has(s.coordinate), 'Unknown or duplicate ' + label + ' identity');
    found.set(s.coordinate, row);
  }
  need(found.size === 2, 'Missing ' + label + ' series');
  return found;
}
function selectedMember(cube, position, name, hasUom, expected) {
  const ds = cube.dimension.filter(d => d?.dimensionPositionId === position);
  need(ds.length === 1, 'Missing or duplicate cube dimension');
  const d = ds[0];
  need(d.dimensionNameEn === name && d.hasUom === hasUom && Array.isArray(d.member) && d.member.length > 0 && d.member.length <= 10000, 'Cube dimension changed');
  const ms = d.member.filter(m => m?.memberId === expected.memberId);
  need(ms.length === 1 && Object.entries(expected).every(([k, v]) => ms[0][k] === v), 'Selected geography, category or unit changed');
}
function metadata(cube, series) {
  need(cube.productId === String(product) && cube.cubeTitleEn === title && cube.frequencyCode === 12 && cube.archiveStatusCode === '2' && rawTime(cube.releaseTime), 'Cube identity, status or release changed');
  const latest = annual(cube.cubeEndDate), first = annual(cube.cubeStartDate);
  need(first.period <= latest.period && cube.releaseTime.slice(0, 10) >= latest.period_end, 'Invalid cube period or release');
  need(Array.isArray(cube.dimension) && cube.dimension.length === 3, 'Cube dimension count changed');
  for (const s of CMHC_RENT_SERIES) {
    const row = series.get(s.coordinate);
    need(row.SeriesTitleEn === `${s.geography};${structure};${unitType}` && row.frequencyCode === 12 && row.scalarFactorCode === 0 && row.decimals === 0 && row.memberUomCode === 81 && row.terminated === 0, 'Series meaning, unit, precision or active status changed');
    selectedMember(cube, 1, 'Geography', false, {memberId: s.member, parentMemberId: null, memberNameEn: s.geography, classificationCode: s.classification, classificationTypeCode: '1', geoLevel: s.geo_level, vintage: 2011, terminated: 0, memberUomCode: null});
  }
  const common = {parentMemberId: null, classificationCode: null, classificationTypeCode: null, geoLevel: null, vintage: null, terminated: 0};
  selectedMember(cube, 2, 'Type of structure', false, {...common, memberId: 3, memberNameEn: structure, memberUomCode: null});
  selectedMember(cube, 3, 'Type of unit', true, {...common, memberId: 3, memberNameEn: unitType, memberUomCode: 81});
  need(Array.isArray(cube.footnote), 'Missing applicable licence');
  const legal = cube.footnote.filter(f => f?.footnoteId === 2 && f.link?.dimensionPositionId === 0 && f.link?.memberId === 0);
  need(legal.length === 1 && legal[0].link.footnoteId === 2 && legal[0].footnotesEn === `These data are obtained from Canada Mortgage and Housing Corporation (CMHC) and are provided subject to <a href="${terms}" rel="external noopener noreferrer" target="_blank"> CMHC Licence Agreement for the Use of Data (opens new window)</a>.`, 'Applicable CMHC licence changed');
  return {cube_end_date: cube.cubeEndDate, release_timestamp_raw: cube.releaseTime, release_timezone: null};
}
function point(s, p, anchor) {
  need(object(p), 'Missing observation');
  const period = annual(p.refPer);
  need(p.refPer === anchor.cube_end_date && p.refPerRaw === period.ref_per_raw && p.refPer2 === '' && p.refPerRaw2 === '', 'Observation does not match the current annual October vintage');
  need(rawTime(p.releaseTime) && p.releaseTime === anchor.release_timestamp_raw && p.releaseTime.slice(0, 10) >= period.period_end, 'Observation release does not match current cube release');
  need(p.frequencyCode === 12 && p.scalarFactorCode === 0 && p.decimals === 0, 'Frequency, scale or precision changed');
  need(typeof p.value === 'number' && Number.isSafeInteger(p.value) && p.value > 0, 'Missing, nonpositive or noninteger rent');
  need(p.statusCode === 0 && p.securityLevelCode === 0 && Number.isInteger(p.symbolCode) && Object.hasOwn(symbols, p.symbolCode), 'Unsupported availability, confidentiality or symbol');
  return {
    measure_id: s.id, ...period, value: p.value, value_state: 'observed', unit: 'CAD per month',
    geography: s.geography, geography_type: s.geography_type, dguid: s.dguid, dimensions: dimensions(s),
    ref_per2: '', ref_per_raw2: '', frequency_code: 12, scalar_code: 0, unit_code: 81, decimals: 0,
    status_code: 0, quality: 'normal', security_level_code: 0, symbol_code: p.symbolCode, symbol: symbols[p.symbolCode],
    release_timestamp_raw: p.releaseTime, release_timezone: null,
    definition: cmhcRentDefinitions().find(d => d.id === s.id), licence_notice: notice(period.period),
  };
}
function build(rows, anchor, provenance = []) {
  return {
    status: 'ok', rows, metadata: {count: 2, latest_period: rows[0].period, ...anchor, product_id: product, cube_title: title},
    definitions: cmhcRentDefinitions(), publisher: 'Statistics Canada', original_publisher: 'Canada Mortgage and Housing Corporation',
    licence, licence_url: terms, licence_notice: notice(rows[0].period), source_url: sourceUrl, limitations, provenance,
  };
}
export function parseCmhcRent(dataResponse, seriesResponse, cubeResponse) {
  const data = identify(envelopes(dataResponse, 2, 'data'), 'data');
  const series = identify(envelopes(seriesResponse, 2, 'series'), 'series');
  const anchor = metadata(envelopes(cubeResponse, 1, 'cube')[0], series);
  return build(CMHC_RENT_SERIES.map(s => {
    const row = data.get(s.coordinate);
    need(Array.isArray(row.vectorDataPoint) && row.vectorDataPoint.length === 1, 'Exactly one current annual point per series required');
    return point(s, row.vectorDataPoint[0], anchor);
  }), anchor);
}
function acquisitionAllows(rows, retrieved) {
  if (!instant(retrieved)) return false;
  const day = retrieved.slice(0, 10);
  // A raw release timestamp has no timezone. Its date may lead UTC by one day;
  // do not append Z or pretend to know its exact release instant.
  const next = new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  return rows.every(r => r.period_end <= day && r.release_timestamp_raw.slice(0, 10) <= next);
}
function provenanceValid(provenance, rows) {
  if (!Array.isArray(provenance) || ![0, 3].includes(provenance.length)) return false;
  const roles = new Set();
  for (const p of provenance) {
    if (!object(p) || !Object.hasOwn(CMHC_RENT_URLS, p.role) || roles.has(p.role) || p.url !== CMHC_RENT_URLS[p.role] || !acquisitionAllows(rows, p.retrieved_at) || !Number.isSafeInteger(p.bytes) || p.bytes <= 0 || p.bytes > bounds[p.role] || typeof p.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(p.sha256)) return false;
    roles.add(p.role);
  }
  return true;
}
export function validateCmhcRentRepresentation(value, acquisition) {
  try {
    if (!object(value) || !Array.isArray(value.rows) || value.rows.length !== 2 || !object(value.metadata)) return false;
    const a = value.metadata;
    const rows = value.rows.map((r, i) => point(CMHC_RENT_SERIES[i], {
      refPer: r.reference_date, refPerRaw: r.ref_per_raw, refPer2: r.ref_per2, refPerRaw2: r.ref_per_raw2,
      value: r.value, frequencyCode: r.frequency_code, scalarFactorCode: r.scalar_code, decimals: r.decimals,
      statusCode: r.status_code, securityLevelCode: r.security_level_code, symbolCode: r.symbol_code, releaseTime: r.release_timestamp_raw,
    }, a));
    if (arguments.length > 1 && (!object(acquisition) || !acquisitionAllows(rows, acquisition.retrieved_at) || value.provenance?.length !== 3)) return false;
    if (!provenanceValid(value.provenance, rows)) return false;
    return same(value, build(rows, {cube_end_date: a.cube_end_date, release_timestamp_raw: a.release_timestamp_raw, release_timezone: null}, value.provenance));
  } catch { return false; }
}
export const cmhcRentObservationRows = value => value?.rows;
async function bounded(response, maximum) {
  if (!response.ok) { await response.body?.cancel(); throw new SourceError('CMHC rental benchmark returned HTTP ' + response.status, response.status); }
  const length = response.headers.get('content-length');
  if (length !== null && !(/^\d+$/.test(length) && Number(length) <= maximum)) { await response.body?.cancel(); need(false, 'Response exceeds byte bound'); }
  need(response.body, 'Empty response body');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength; need(size <= maximum, 'Response exceeds byte bound'); chunks.push(result.value);
    }
  } finally { await reader.cancel(); }
  need(size > 0, 'Empty response body');
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let json;
  try { json = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); } catch { need(false, 'Malformed UTF-8 JSON response'); }
  return {bytes, json};
}
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
export async function readCmhcRent({fetcher = fetchOfficial, now = () => new Date().toISOString()} = {}) {
  const signal = AbortSignal.timeout(20000);
  const queries = {
    data: CMHC_RENT_SERIES.map(s => ({productId: product, coordinate: s.coordinate, latestN: 1})),
    series: CMHC_RENT_SERIES.map(s => ({productId: product, coordinate: s.coordinate})),
    cube: [{productId: product}],
  };
  const files = await Promise.all(Object.entries(CMHC_RENT_URLS).map(async ([role, url]) => {
    const response = await fetcher(url, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify(queries[role]), signal});
    if (response.url) need(response.url === url, 'Unexpected publisher redirect');
    const file = await bounded(response, bounds[role]), retrieved_at = now();
    need(instant(retrieved_at), 'Invalid acquisition clock');
    return {role, url, ...file, retrieved_at};
  }));
  const byRole = Object.fromEntries(files.map(f => [f.role, f]));
  const native = parseCmhcRent(byRole.data.json, byRole.series.json, byRole.cube.json);
  native.provenance = await Promise.all(files.map(async f => ({role: f.role, url: f.url, retrieved_at: f.retrieved_at, bytes: f.bytes.byteLength, sha256: await hash(f.bytes)})));
  need(validateCmhcRentRepresentation(native), 'Representation or acquisition period failed');
  return native;
}
