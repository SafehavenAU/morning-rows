import {readUnitedStates, CPI_DEFINITION} from './us-cpi.js';
import {ORIGIN} from './information.js';
import {catalogueV2, INFORMATION_SCHEMA_V2, validateUsSelection, selectedUsResponse, withUsMetadata, finishV2Response, validateCpiRepresentation, US_DESK_URL, US_CATALOG_URL, V2_SCHEMA_URL} from './information-v2.js';

export const isUsRoute = pathname => ['/catalog.v2.json','/schema.v2.json','/united-states.json','/united-states'].includes(pathname);
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

function render(body) {
  const cpi = body.cpi;
  const rows = cpi?.rows.map(r => `<tr><td>${escape(r.period)}</td><td>${r.value === null ? escape(r.value_state) : escape(r.value_text)}</td><td>${escape(r.footnotes.map(f => f.text).join('; '))}</td></tr>`).join('') || '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>United States — Morning Rows</title><link rel="canonical" href="${ORIGIN}/united-states"><link rel="alternate" type="application/json" href="${US_DESK_URL}"></head><body><main><h1>United States</h1><p>${escape(CPI_DEFINITION.name)}. ${escape(CPI_DEFINITION.adjustment)}; index ${escape(CPI_DEFINITION.base_period)}.</p><p>${escape(CPI_DEFINITION.population)}</p><p>${escape(CPI_DEFINITION.boundary)}</p>${cpi ? `<p>${escape(cpi.limitations)}</p><table><caption>Latest 13 calendar months; unavailable values are not zero</caption><thead><tr><th>Month</th><th>Index / state</th><th>Publisher qualification</th></tr></thead><tbody>${rows}</tbody></table><p>${escape(cpi.timing_note)}</p>` : `<p>Source retrieval failed: ${escape(body.sources.cpi.error)}. No previous release or substitute month is presented.</p>`}<p>Retrieved: ${escape(body.sources.cpi.fetched_at)}. This is an attempt time, not a publication date.</p><p><a href="${CPI_DEFINITION.source_url}">Original BLS data</a> · <a href="${CPI_DEFINITION.schedule_url}">Official release schedule</a> · <a href="${CPI_DEFINITION.licence_url}">${escape(CPI_DEFINITION.licence)}</a></p><nav><a href="${US_DESK_URL}">JSON</a> · <a href="${US_CATALOG_URL}">Source and measure</a> · <a href="${V2_SCHEMA_URL}">Data contract</a> · <a href="/catalog.v2.json">All desks</a></nav></main></body></html>`;
}

// Request-local reader/cache dependencies also allow the real route code to be
// exercised with isolated fixtures. No fixture URL or switch enters production.
export async function handleUsRequest(request, {read = readUnitedStates, cache = globalThis.caches?.default, cacheKey = 'us-v2', now = Date.now, successTtl = 3600, errorTtl = 30} = {}) {
  const url = new URL(request.url), selection = validateUsSelection(url);
  const error = (status, code, message) => finishV2Response(request, Response.json({error: code, ...(message ? {message} : {}), schema: V2_SCHEMA_URL, catalog: US_CATALOG_URL}, {status, headers: {'Cache-Control':'no-store', ...(status === 405 ? {Allow:'GET, HEAD'} : {})}}), `${ORIGIN}${url.pathname}`);
  if (!['GET','HEAD'].includes(request.method)) return error(405, 'method_not_allowed');
  if (selection.status) return error(selection.status, selection.code, selection.message);
  if (url.pathname === '/schema.v2.json') return finishV2Response(request, Response.json(INFORMATION_SCHEMA_V2), V2_SCHEMA_URL);
  if (url.pathname === '/catalog.v2.json') {
    const body = catalogueV2(url.searchParams.get('desk'));
    return finishV2Response(request, Response.json(body), body.id);
  }
  if (!['/united-states','/united-states.json'].includes(url.pathname)) return error(404, 'unknown_route');
  // Both domains, all selections and the HTML view use one build-specific full read.
  const key = new Request(`${US_DESK_URL}?release=${encodeURIComponent(cacheKey)}`);
  let body, expires = 0;
  try {
    const hit = await cache?.match(key);
    if (hit && Number(hit.headers.get('x-mr-cache-expires-at')) > now()) {
      const candidate = await hit.json();
      if (candidate.site === ORIGIN && candidate.country === 'United States' && candidate.sources?.cpi && ['ok','error'].includes(candidate.sources.cpi.status) && (candidate.sources.cpi.status === 'ok' ? validateCpiRepresentation(candidate.cpi) : candidate.cpi === null)) {
        body = candidate; expires = Number(hit.headers.get('x-mr-cache-expires-at'));
      }
    }
  } catch { /* Cache unavailability is a miss, never an invented source success. */ }
  if (!body) {
    body = await read();
    if (body.sources.cpi.status === 'ok' && !validateCpiRepresentation(body.cpi)) body = {...body, cpi: null, sources: {...body.sources, cpi: {...body.sources.cpi, status: 'error', error: 'CPI representation validation failed; no standardized values published'}}};
    expires = now() + (body.sources.cpi.status === 'ok' ? successTtl : errorTtl) * 1000;
    try { await cache?.put(key, Response.json(body, {headers: {'Cache-Control': `public, max-age=${body.sources.cpi.status === 'ok' ? successTtl : errorTtl}`, 'x-mr-cache-expires-at': String(expires)}})); } catch { /* Return the actual read with its health; do not depend on cache writes. */ }
  }
  const success = body.sources.cpi.status === 'ok', retrieved = body.sources.cpi.fetched_at;
  const headers = {'Cache-Control': success ? `public, max-age=${Math.max(0, Math.floor((expires - now()) / 1000))}` : 'no-store', 'x-data-status': success ? 'ok' : 'error'};
  let response, canonical;
  if (selection.source) {
    const selected = await selectedUsResponse(body, selection);
    canonical = selected.body.id;
    response = Response.json(selected.body, {status: selected.status, headers: {...headers, ...(selected.status === 200 ? {} : {'Cache-Control':'no-store'})}});
  } else if (url.pathname.endsWith('.json')) {
    canonical = US_DESK_URL; response = Response.json(withUsMetadata(body), {headers});
  } else {
    canonical = `${ORIGIN}/united-states`; response = new Response(render(body), {headers: {...headers, 'Content-Type':'text/html; charset=utf-8'}});
  }
  // Full desks deliberately retain HTTP 200 during a source outage. Do not let
  // that transport convention turn the same failed read into a success 304.
  const conditionalHeaders = new Headers(request.headers);
  if (!success) conditionalHeaders.delete('If-None-Match');
  return finishV2Response(new Request(request, {headers: conditionalHeaders}), response, canonical, retrieved);
}
