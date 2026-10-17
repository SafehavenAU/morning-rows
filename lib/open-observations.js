import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchOfficial, readBounded, SourceError } from './sources.js';

const OGL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
const RFS_URL = 'https://www.rfs.nsw.gov.au/feeds/majorIncidents.xml';
const EDUCATION = 'https://api.education.gov.uk/statistics/v1';
const ABSENCE_PUBLICATION = 'cbbd299f-8297-44bc-92ac-558bcf51f8ad';
const ABSENCE_TITLE = 'Absence for persistent and severe absentees';
const SEPA_URL = 'https://timeseries.sepa.org.uk/KiWIS/KiWIS?service=kisters&type=queryServices&datasource=0&request=getTimeseriesValues&ts_id=61573010&returnfields=Timestamp,Value,Quality%20Code&format=json&metadata=true';

async function boundedJson(url, options = {}) {
  return JSON.parse(await readBounded(await fetchOfficial(url, options), 1048576));
}
function requireValue(condition, message) {
  if (!condition) throw new SourceError(message);
}
function exactlyOne(items, predicate, label) {
  const found = (items || []).filter(predicate);
  requireValue(found.length === 1, `Missing or ambiguous ${label}`);
  return found[0];
}
function completePage(body) {
  requireValue(Array.isArray(body.results) && body.paging?.page === 1 && body.paging?.totalPages === 1 && body.paging.totalResults === body.results.length, 'Incomplete education response; no partial aggregate published');
  return body.results;
}

// Aggregate only: incident names, addresses, descriptions and contact details
// never leave this reader. The publisher feed can include neighbouring ACT.
export function rfsIncidentSummary(xml, now = new Date()) {
  requireValue(!/<!DOCTYPE/i.test(xml) && XMLValidator.validate(xml) === true, 'Invalid RFS RSS document');
  const channel = new XMLParser({ parseTagValue: false, isArray: name => name === 'item' }).parse(xml)?.rss?.channel;
  requireValue(channel?.title === 'NSW Rural Fire Service Current Incidents' && typeof channel.pubDate === 'string' && /GMT$/.test(channel.pubDate), 'Unexpected RFS feed or missing publication timestamp');
  const published = Date.parse(channel.pubDate);
  requireValue(Number.isFinite(published) && published <= now.getTime() + 300000, 'Invalid RFS publication timestamp');
  const categories = new Map(), types = new Map(), seen = new Set();
  for (const item of channel.item || []) {
    const id = typeof item.guid === 'object' ? item.guid['#text'] : item.guid;
    requireValue(typeof id === 'string' && /^https:\/\/incidents\.rfs\.nsw\.gov\.au\/api\/v1\/incidents\/\d+$/.test(id) && !seen.has(id), 'Missing or duplicate RFS incident identifier');
    seen.add(id);
    const fields = Object.fromEntries(String(item.description || '').split(/<br\s*\/?\s*>/i).map(part => {
      const colon = part.indexOf(':');
      return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
    }));
    requireValue(fields['ALERT LEVEL'] && fields.TYPE && !/[<>]/.test(fields['ALERT LEVEL'] + fields.TYPE), 'Incomplete RFS incident classification');
    categories.set(fields['ALERT LEVEL'], (categories.get(fields['ALERT LEVEL']) || 0) + 1);
    types.set(fields.TYPE, (types.get(fields.TYPE) || 0) + 1);
  }
  const delayed = now.getTime() - published > 6 * 3600000;
  const counts = map => [...map].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value, unit: 'incidents listed in the feed' }));
  return {
    source: 'NSW Rural Fire Service', source_url: RFS_URL,
    licence: 'CC BY 4.0', licence_url: 'https://www.rfs.nsw.gov.au/news-and-media/stay-up-to-date/feeds',
    attribution: '© State of New South Wales (NSW Rural Fire Service). For current information go to www.rfs.nsw.gov.au.',
    copyright: channel.copyright || null,
    geography: 'NSW RFS feed coverage; includes incidents in neighbouring ACT',
    period: new Date(published).toISOString(), published_at: channel.pubDate, fetched_at: now.toISOString(),
    status: delayed ? 'degraded' : 'ok', freshness: delayed ? 'Feed publication is more than six hours old' : 'Feed publication is within six hours',
    value: seen.size, unit: 'incidents listed in the feed', by_alert_level: counts(categories), by_type: counts(types),
    note: 'Publisher snapshot, not an Australia-wide count or a count of uncontrolled fires. Includes planned burns and other incidents. Consult NSW RFS for current warnings.',
  };
}
export async function readRfsIncidents() {
  return rfsIncidentSummary(await readBounded(await fetchOfficial(RFS_URL), 2097152));
}

export function absenceSelection(meta) {
  const school = exactlyOne(meta.filters, f => f.column === 'phase_type_grouping', 'school-type dimension');
  const absence = exactlyOne(meta.filters, f => f.column === 'absence_type', 'absence dimension');
  requireValue(meta.filters.length === 2, 'Unexpected education dimension; selection requires review');
  const total = exactlyOne(school.options, o => o.label === 'Total', 'total school types');
  const categories = ['Total pupils', 'Persistent absence', 'Severe absence'].map(label => exactlyOne(absence.options, o => o.label === label, label));
  const national = exactlyOne(meta.locations, l => l.level?.code === 'NAT', 'national locations');
  const england = exactlyOne(national.options, o => o.code === 'E92000001' && o.label === 'England', 'England geography');
  const count = exactlyOne(meta.indicators, i => i.column === 'enrolment_count', 'enrolment count');
  const percent = exactlyOne(meta.indicators, i => i.column === 'enrolment_percent', 'enrolment percentage');
  requireValue(Array.isArray(meta.timePeriods) && meta.timePeriods.length > 0 && meta.timePeriods.every(p => p.code === 'AY' && /^\d{4}\/\d{4}$/.test(p.period) && Number(p.period.slice(5)) === Number(p.period.slice(0, 4)) + 1), 'Unexpected education time periods');
  const period = [...meta.timePeriods].sort((a, b) => a.period.localeCompare(b.period)).at(-1);
  requireValue(period.label === `${period.period.slice(0, 4)}/${period.period.slice(-2)}`, 'Unexpected academic-year label');
  return { school, absence, total, categories, england, count, percent, period,
    query: { criteria: { and: [
      { geographicLevels: { eq: 'NAT' }, locations: { eq: { level: 'NAT', code: 'E92000001' } }, timePeriods: { eq: { code: period.code, period: period.period } } },
      { filters: { eq: total.id } }, { filters: { in: categories.map(c => c.id) } },
    ] }, indicators: [count.id, percent.id] },
  };
}

function educationValue(raw, unit) {
  // Keep publisher nonnumeric symbols explicit. Never coerce blank/suppressed
  // values to zero, or claim every nonnumeric marker means suppression.
  if (typeof raw === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) {
    const value = Number(raw);
    requireValue(Number.isFinite(value) && (unit === 'percent' ? value <= 100 : Number.isSafeInteger(value)), 'Invalid education observation');
    return { value, status: 'ok' };
  }
  requireValue(typeof raw === 'string' && /^(?:c|x|z|:|\.\.|low)$/.test(raw), 'Missing or unrecognised education value');
  return { value: null, status: 'unavailable', publisher_symbol: raw };
}
export function pupilAbsence(body, selection, dataset) {
  const data = completePage(body);
  requireValue(data.length === 3 && Array.isArray(body.warnings) && body.warnings.length === 0, 'Unexpected education result count or query warnings');
  const s = selection;
  const rows = s.categories.flatMap(category => {
    const result = exactlyOne(data, r => r.filters?.[s.absence.id] === category.id, category.label);
    requireValue(result.geographicLevel === 'NAT' && result.locations?.NAT === s.england.id && Object.keys(result.locations).length === 1 && result.timePeriod?.code === s.period.code && result.timePeriod.period === s.period.period && result.filters?.[s.school.id] === s.total.id && Object.keys(result.filters).length === 2, 'Education result does not match selected geography, period or dimensions');
    const indicators = category.label === 'Total pupils' ? [[s.count, 'pupil enrolments']] : [[s.count, 'pupil enrolments'], [s.percent, 'percent']];
    return indicators.map(([indicator, unit]) => ({ category: category.label, indicator: indicator.column, name: indicator.label,
      ...educationValue(result.values?.[indicator.id], unit), unit, geography: 'England', period: s.period.label, period_code: 'AY', school_type: 'Total: state-funded primary, secondary and special schools' }));
  });
  return { source: 'Department for Education', source_url: `${EDUCATION}/data-sets/${dataset.id}/query?dataSetVersion=${dataset.latestVersion.version}`,
    licence: 'Open Government Licence v3.0', licence_url: OGL, geography: 'England', period: s.period.label,
    dataset_id: dataset.id, dataset_version: dataset.latestVersion.version, published_at: dataset.latestVersion.published,
    status: rows.some(r => r.status !== 'ok') ? 'degraded' : 'ok', rows,
    note: 'Latest published full academic year; pupil enrolments aged 5–15 in state-funded primary, secondary and special schools. Persistent absence means missing 10% or more of possible sessions; severe absence means 50% or more. Severe absence is a subset of persistent absence; do not add the categories. Publisher nonnumeric symbols remain null, never zero.',
  };
}
export async function readPupilAbsence() {
  const datasets = completePage(await boundedJson(`${EDUCATION}/publications/${ABSENCE_PUBLICATION}/data-sets?pageSize=20`));
  const dataset = exactlyOne(datasets, d => d.title === ABSENCE_TITLE && d.status === 'Published', 'published absence dataset');
  requireValue(/^[0-9a-f-]{36}$/.test(dataset.id) && /^\d+\.\d+(?:\.\d+)?$/.test(dataset.latestVersion?.version) && Number.isFinite(Date.parse(dataset.latestVersion?.published)), 'Invalid education dataset metadata');
  // Pin metadata and values to the same published version within this request.
  const version = `dataSetVersion=${dataset.latestVersion.version}`;
  const selection = absenceSelection(await boundedJson(`${EDUCATION}/data-sets/${dataset.id}/meta?${version}`));
  const result = await boundedJson(`${EDUCATION}/data-sets/${dataset.id}/query?${version}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(selection.query) });
  return pupilAbsence(result, selection, dataset);
}

export function sepaRiverLevel(body) {
  requireValue(Array.isArray(body) && body.length === 1, 'Missing or ambiguous SEPA station');
  const station = body[0];
  requireValue(station.ts_id === '61573010' && station.station_no === '9683' && station.station_name === 'Galashiels' && station.ts_unitsymbol === 'm' && station.ts_unitname === 'meter' && station.columns === 'Timestamp,Value,Quality Code' && Number(station.rows) === 1 && Array.isArray(station.data) && station.data.length === 1, 'Unexpected SEPA series, units or coverage');
  const [period, value, quality] = station.data[0];
  requireValue(typeof period === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(period) && Number.isFinite(Date.parse(period)) && typeof value === 'number' && Number.isFinite(value) && value > -999 && Number.isInteger(quality), 'Invalid SEPA observation');
  return { source: 'Scottish Environment Protection Agency', source_url: SEPA_URL, licence: 'Open Government Licence v3.0', licence_url: OGL,
    attribution: 'Contains SEPA data licensed under the Open Government Licence v3.0.', geography: 'Galashiels, Scotland',
    station: station.station_name, station_number: station.station_no, series_id: station.ts_id, period, value, unit: 'metres', quality_code: quality,
    note: 'Latest available observation from one selected river-level gauge; not a Scotland-wide average, flood threshold or height above sea level. Publisher quality code is retained; telemetry may be provisional.',
  };
}
export async function readSepaRiverLevel() {
  return sepaRiverLevel(await boundedJson(SEPA_URL));
}
