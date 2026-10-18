import {readUsCpiTable} from './us-cpi-table.js';
import { SourceError, readSections } from './sources.js';

export const CPI_SERIES = 'CUUR0000SA0';
export const CPI_URLS = Object.freeze({
  data: 'https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems',
  series: 'https://download.bls.gov/pub/time.series/cu/cu.series',
  footnotes: 'https://download.bls.gov/pub/time.series/cu/cu.footnote',
});
export const CPI_DEFINITION = Object.freeze({
  id: CPI_SERIES, name: 'CPI-U, all items, U.S. city average',
  geography: 'U.S. city average', area_code: '0000',
  population: 'All urban consumers; excludes rural nonmetropolitan residents, farm households, military installations, religious communities and institutions as defined by BLS.',
  unit: 'index', base_period: '1982-84=100', adjustment: 'not seasonally adjusted',
  period_convention: 'Calendar month YYYY-MM', cadence: 'Monthly; normally released the following month at 08:30 America/New_York. Consult the official schedule for changes.',
  dimensions: { series_id: CPI_SERIES, area_code: '0000', item_code: 'SA0', seasonal: 'U', periodicity_code: 'R', base_code: 'S' },
  boundary: 'National urban target in the 50 states and DC, excluding territories. No state, county, metro or DC-only output.',
  sample_design: '2018 geographic redesign, 2010 Census population / 2013 OMB CBSAs; not an expenditure-weight vintage.',
  uncertainty: null, uncertainty_note: 'Survey-derived index; confidence intervals are not supplied in this extract. Unknown is not zero uncertainty.',
  revision_policy: 'NSA CPI-U has no routine seasonal revision; corrections remain possible. Latest publisher values only, not a vintage archive.',
  publisher: 'US Bureau of Labor Statistics', licence: 'US public domain; cite US Bureau of Labor Statistics',
  licence_url: 'https://www.bls.gov/bls/linksite.htm',
  source_url: CPI_URLS.data,
  definition_url: 'https://www.bls.gov/cpi/questions-and-answers.htm',
  schedule_url: 'https://www.bls.gov/schedule/news_release/cpi.htm',
});
const fail = code => { throw new SourceError(`BLS CPI: ${code}`); };
const columns = {
  data: ['series_id','year','period','value','footnote_codes'],
  series: ['series_id','area_code','item_code','seasonal','periodicity_code','base_code','base_period','series_title','footnote_codes','begin_year','begin_period','end_year','end_period'],
  footnotes: ['footnote_code','footnote_text'],
};

function records(text, kind) {
  if (typeof text !== 'string' || !text.trim()) fail('empty_source');
  const end = text.indexOf('\n'), headers = text.slice(0, end < 0 ? text.length : end).split('\t').map(s => s.trim());
  if (headers.length !== new Set(headers).size || headers.length !== columns[kind].length || columns[kind].some(h => !headers.includes(h))) fail('unexpected_columns');
  const idIndex = headers.indexOf('series_id'), selected = [];
  // Scan only the exact series at field one in the published layout. This
  // avoids allocating every unrelated row/cell in the multi-megabyte bulk file.
  // Reordered headers retain the generic parser and its original semantics.
  const content = end < 0 ? '' : text.slice(end + 1);
  const lines = kind !== 'footnotes' && idIndex === 0
    ? Array.from(content.matchAll(new RegExp('^[^\\S\\r\\n\\t]*'+CPI_SERIES+'[^\\S\\r\\n\\t]*(?:\\t[^\\r\\n]*)?\\r?$','gm')), m => m[0])
    : content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split('\t').map(s => s.trim());
    // Only this fixed series is represented; never infer identity from row position.
    if (kind !== 'footnotes' && cells[idIndex] !== CPI_SERIES) continue;
    if (cells.length !== headers.length) fail('truncated_record');
    selected.push(Object.fromEntries(headers.map((h, i) => [h, cells[i]])));
  }
  return selected;
}
const monthly = p => /^M(?:0[1-9]|1[0-2])$/.test(p);
const period = r => `${r.year}-${r.period.slice(1)}`;
export function cpiWindow(latest) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(latest)) fail('invalid_period');
  const [year, month] = latest.split('-').map(Number), end = year * 12 + month - 1;
  return Array.from({length: 13}, (_, i) => {const n = end - 12 + i; return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`;});
}

export function parseCpi(files) {
  const metadata = records(files.series, 'series');
  if (metadata.length !== 1) fail('metadata_coverage');
  const definition = metadata[0];
  const expected = {...CPI_DEFINITION.dimensions, base_period: CPI_DEFINITION.base_period};
  if (Object.entries(expected).some(([k,v]) => definition[k] !== v) || definition.series_title !== 'All items in U.S. city average, all urban consumers, not seasonally adjusted') fail('definition_changed');
  if (!/^\d{4}$/.test(definition.end_year) || !(monthly(definition.end_period) || definition.end_period === 'M13')) fail('invalid_metadata_period');
  const footnotes = new Map();
  for (const row of records(files.footnotes, 'footnotes')) {
    if (!row.footnote_code || !row.footnote_text || footnotes.has(row.footnote_code)) fail('ambiguous_footnote');
    footnotes.set(row.footnote_code, row.footnote_text);
  }
  if (definition.footnote_codes) fail('new_series_qualification_requires_review');
  const selected = records(files.data, 'data');
  if (selected.some(r => !/^\d{4}$/.test(r.year) || !(monthly(r.period) || r.period === 'M13'))) fail('invalid_period');
  const months = selected.filter(r => monthly(r.period));
  if (!months.length) fail('no_monthly_data');
  const latest = months.map(period).sort().at(-1);
  // M13 is excluded from observations. Metadata ending M13 must match an actual December.
  if (`${definition.end_year}-${definition.end_period === 'M13' ? '12' : definition.end_period.slice(1)}` !== latest) fail('metadata_release_mismatch');
  const window = cpiWindow(latest), rows = new Map();
  for (const r of months) {
    const key = period(r);
    if (!window.includes(key)) continue;
    if (rows.has(key)) fail('duplicate_period');
    const codes = r.footnote_codes ? r.footnote_codes.split(',').map(s => s.trim()) : [];
    if (codes.length !== new Set(codes).size || codes.some(c => !footnotes.has(c))) fail('unknown_footnote');
    const notes = codes.map(code => ({code, text: footnotes.get(code)}));
    const unavailable = codes.includes('X');
    // Only the verified X convention is classified; a changed meaning needs review.
    if (unavailable && !/lapse in appropriations/i.test(footnotes.get('X'))) fail('unavailable_definition_changed');
    if (unavailable && r.value !== '-') fail('numeric_with_unavailable_flag');
    if (codes.includes('R') && footnotes.get('R') !== 'Revised') fail('revision_definition_changed');
    if (codes.some(c => !['X', 'R'].includes(c))) fail('new_observation_qualification_requires_review');
    if (r.value !== '-' && !/^\d+(?:\.\d+)?$/.test(r.value)) fail('invalid_value');
    const value = r.value === '-' ? null : Number(r.value);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) fail(`nonpositive_index_anomaly_${key}`);
    rows.set(key, {period: key, value, value_text: r.value, value_state: value === null ? (unavailable ? 'unavailable' : 'missing') : 'observed', footnotes: notes});
  }
  if (rows.size !== 13) fail('incomplete_window');
  return cpiResult(window.map(p => rows.get(p)),latest);
}
export function cpiResult(rows,latest) {
  const window=cpiWindow(latest);
  return {
    present: true, series_id: CPI_SERIES, definition: structuredClone(CPI_DEFINITION),
    latest_period: latest, window: {first: window[0], last: latest, slots: 13},
    rows, source_url: CPI_URLS.data,
    publisher: CPI_DEFINITION.publisher, licence: CPI_DEFINITION.licence, licence_url: CPI_DEFINITION.licence_url,
    published_at: null, publisher_updated_at: null, next_expected_update: null,
    timing_note: 'Publication and next-release timestamps are unverified in this reader; consult the linked official schedule. Retrieval time is not publication time. Unchanged monthly observations remain valid.',
    limitations: 'Only exact retained calendar months. No annual-average, daily, local, CPI-W, chained/core/SA CPI, arbitrary history or contractual substitutions. Index levels are not USD, percentages or additive totals. Refuse calculations involving a nonnumeric month.',
  };
}

export async function readCpiText(response, maximum = 8 * 1024 * 1024) {
  if (!response.ok) { await response.body?.cancel(); throw new SourceError(`BLS CPI returned HTTP ${response.status}`, response.status); }
  if (Number(response.headers.get('content-length')) > maximum) {await response.body?.cancel(); fail('body_limit');}
  if (!response.body) fail('empty_source');
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', {fatal: true});
  let text = '', bytes = 0;
  try {
    while (true) {const {done, value} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > maximum) fail('body_limit'); text += decoder.decode(value, {stream: true});}
    text += decoder.decode();
  } finally {await reader.cancel(); reader.releaseLock();}
  if (!bytes) fail('empty_source');
  return {text, bytes};
}

export async function readUsCpi({fetcher = fetch, deadline = 20000, maximum = 8 * 1024 * 1024} = {}) {
  const controller = new AbortController(), started = Date.now();
  const timer = setTimeout(() => controller.abort(), deadline);
  try {
    const results = await Promise.allSettled(Object.entries(CPI_URLS).map(async ([name, url]) => {
      // BLS may reject a narrow Accept header with 406 from the Worker runtime.
      // Accept the representation, then validate UTF-8 and exact TSV structure.
      const response = await fetcher(url, {signal: controller.signal, headers: {'User-Agent': 'MorningRows/1.0 (+https://morningrows.com)', accept: '*/*'}});
      const read = await readCpiText(response, maximum);
      return {name, url, ...read};
    }));
    if (controller.signal.aborted) fail('source_deadline');
    const rejected = results.find(r => r.status === 'rejected');
    if (rejected) throw rejected.reason;
    const files = results.map(r => r.value), parsed = parseCpi(Object.fromEntries(files.map(r => [r.name, r.text])));
    parsed.provenance = await Promise.all(files.map(async r => ({
      kind: r.name, url: r.url, bytes: r.bytes,
      sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(r.text)))].map(n => n.toString(16).padStart(2,'0')).join(''),
      hash_basis: 'Decoded UTF-8 source text; all rows, not just this series',
    })));
    if (controller.signal.aborted || Date.now() - started > deadline) fail('source_deadline');
    return parsed;
  } finally {clearTimeout(timer);}
}

export async function readUnitedStates(options = {}) {
  const result = await readSections({cpi: () => readUsCpiTable(options)}, {cpi: {name: CPI_DEFINITION.publisher, source_url: CPI_URLS.data, licence: CPI_DEFINITION.licence}});
  return {site: 'https://morningrows.com', country: 'United States', ...result};
}
