import { fetchOfficial, readBounded, SourceError } from './sources.js';

const API = 'https://opendata.nhsbsa.net/api/3/action/';
export const PHARMACY_PACKAGE = `${API}package_show?id=pharmacy-openings-and-closures`;
const requireValue = (ok, message) => { if (!ok) throw new SourceError(message); };
export function pharmacyResource(body, now = new Date()) {
  const p = body?.result;
  requireValue(body?.success === true && p?.license_id === 'OGL-UK-3.0' && Array.isArray(p.resources), 'NHSBSA pharmacy metadata or licence missing');
  const resources = p.resources.filter(r => /^PHARMACY_OPENCLOSE_\d{6}(?:NEW)?$/.test(r.name || ''));
  requireValue(resources.length > 0, 'NHSBSA pharmacy resources missing');
  const period = resources.map(r => r.name.slice(19, 25)).sort().at(-1);
  const matches = resources.filter(r => r.name.slice(19, 25) === period);
  requireValue(matches.length === 1 && /^[0-9a-f-]{36}$/.test(matches[0].id), 'Ambiguous NHSBSA pharmacy release');
  requireValue(/^\d{4}(0[1-9]|1[0-2])$/.test(period), 'Invalid pharmacy release month');
  const end = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4)), 0)).toISOString().slice(0, 10);
  requireValue(end <= now.toISOString().slice(0, 10), 'Pharmacy release month is incomplete');
  return { id: matches[0].id, name: matches[0].name, period: `${period.slice(0, 4)}-${period.slice(4)}`, end };
}
export function pharmacyObservations(body, resource, now = new Date()) {
  const data = body?.result;
  requireValue(body?.success === true && data?.resource_id === resource.id && Array.isArray(data.records) && data.records.length > 0 && Number.isSafeInteger(data.total) && data.total === data.records.length, 'Incomplete NHSBSA pharmacy response');
  const seen = new Set();
  for (const row of data.records) {
    const date = String(row.DATE);
    requireValue(/^\d{8}$/.test(date), 'Invalid pharmacy observation date');
    const end = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)), 0)).toISOString().slice(0, 10);
    requireValue(end.replaceAll('-', '') === date && end <= now.toISOString().slice(0, 10) && !seen.has(date), 'Duplicate, invalid or future pharmacy month');
    seen.add(date);
  }
  const latest = [...data.records].sort((a, b) => Number(b.DATE) - Number(a.DATE))[0];
  requireValue(String(latest.DATE) === resource.end.replaceAll('-', ''), 'Latest pharmacy observation does not match the release');
  const fields = [
    ['TOTAL_PHARMACIES', 'total', false],
    ['TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS', 'excluding_distance_sellers', false],
    ['TOTAL_DISTANCE_SELLING_PHARMACIES', 'distance_sellers', false],
    ['TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_OPENED', 'excluding_distance_sellers_opened', false],
    ['TOTAL_PHARMACIES_EXCLUDING_DISTANCE_SELLERS_CLOSED', 'excluding_distance_sellers_closed', false],
    ['PHARMACIES_EXCLUDING_DISTANCE_SELLERS_NET_CHANGE', 'excluding_distance_sellers_net_change', true],
    ['DISTANCE_SELLERS_OPENED', 'distance_sellers_opened', false],
    ['DISTANCE_SELLERS_CLOSED', 'distance_sellers_closed', false],
    ['DISTANCE_SELLERS_NET_CHANGE', 'distance_sellers_net_change', true],
  ];
  const values = Object.fromEntries(fields.map(([field, name, signed]) => {
    const value = latest[field];
    requireValue(typeof value === 'number' && Number.isSafeInteger(value) && (signed || value >= 0), 'Missing or invalid pharmacy count; suppression is not zero');
    return [name, value];
  }));
  requireValue(values.total === values.excluding_distance_sellers + values.distance_sellers, 'Pharmacy stock totals do not reconcile');
  for (const prefix of ['excluding_distance_sellers', 'distance_sellers']) requireValue(values[`${prefix}_opened`] - values[`${prefix}_closed`] === values[`${prefix}_net_change`], 'Pharmacy monthly flows do not reconcile');
  return { source: 'NHS Business Services Authority', source_url: 'https://opendata.nhsbsa.net/dataset/pharmacy-openings-and-closures',
    licence: 'Open Government Licence v3.0', licence_url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    attribution: 'NHS Business Services Authority, Pharmacy Openings and Closures, NHSBSA Open Data',
    geography: 'England', period: resource.period, as_at: resource.end, resource: resource.name,
    rows: fields.map(([, measure]) => ({ measure, value: values[measure], unit: 'pharmacies', geography: 'England', period: resource.period, timing: ['total', 'excluding_distance_sellers', 'distance_sellers'].includes(measure) ? 'month-end stock' : 'calendar-month flow' })),
    note: 'Pharmacies on NHS England Pharmaceutical Lists providing NHS prescriptions and pharmaceutical services. Stocks are at month end; openings, closures and net changes cover that calendar month. Ownership changes count as a closure and an opening. Backdated amendments and group changes can affect comparisons between releases. Counts are premises, not patients or prescription volumes.' };
}
export async function readPharmacies() {
  const json = async url => JSON.parse(await readBounded(await fetchOfficial(url, { headers: { accept: 'application/json' } }), 1048576));
  const resource = pharmacyResource(await json(PHARMACY_PACKAGE));
  return pharmacyObservations(await json(`${API}datastore_search?${new URLSearchParams({ resource_id: resource.id, limit: '1000' })}`), resource);
}
