import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchOfficial, readBounded, SourceError } from './sources.js';

const FSA_URL = 'https://api.ratings.food.gov.uk/Authorities';
const ENGLAND_REGIONS = new Set(['East Counties', 'East Midlands', 'London', 'North East', 'North West', 'South East', 'South West', 'West Midlands', 'Yorkshire and Humberside']);
const NATIONS = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland']);

export function foodAuthorities(body, geography) {
  if (!NATIONS.has(geography) && geography !== 'United Kingdom') throw new SourceError('Unknown food authority geography');
  const all = body.authorities;
  if (!Array.isArray(all) || !all.length || all.length !== body.meta?.totalCount || body.meta?.totalPages !== 1 || !body.meta?.extractDate) {
    throw new SourceError('Incomplete food authority snapshot');
  }
  const seen = new Set();
  const rows = all.map(row => {
    const nation = ENGLAND_REGIONS.has(row.RegionName) ? 'England' : row.RegionName;
    if (!NATIONS.has(nation) || !Number.isSafeInteger(row.EstablishmentCount) || row.EstablishmentCount < 0 || !row.Name || !row.LastPublishedDate || seen.has(row.LocalAuthorityId)) {
      throw new SourceError('Invalid or unrecognised food authority record');
    }
    seen.add(row.LocalAuthorityId);
    return { authority: row.Name, geography: nation, establishments: row.EstablishmentCount, published_at: row.LastPublishedDate };
  }).filter(row => geography === 'United Kingdom' || row.geography === geography);
  if (!rows.length) throw new SourceError('No food authorities for selected geography');
  const dates = rows.map(row => row.published_at).sort();
  return {
    source: 'Food Standards Agency; local authority FHRS/FHIS submissions', source_url: FSA_URL,
    licence: 'Open Government Licence v3.0', licence_url: 'https://ratings.food.gov.uk/terms-and-conditions',
    attribution: 'Contains Food Standards Agency information licensed under the Open Government Licence v3.0.',
    geography, period: body.meta.extractDate, unit: 'establishments listed in the food hygiene data service',
    count: rows.reduce((sum, row) => sum + row.establishments, 0), authority_count: rows.length,
    publication_range: { oldest: dates[0], newest: dates.at(-1) }, rows,
    note: 'A snapshot of listed establishments, not inspection outcomes or a count of all food businesses. Authority publication times vary; publisher timestamps are retained without assigning a timezone.',
  };
}

export async function readFoodAuthorities(geography) {
  const response = await fetchOfficial(FSA_URL, { headers: { 'x-api-version': '2', accept: 'application/json' }, cf: { cacheTtl: 900, cacheEverything: true } });
  return foodAuthorities(JSON.parse(await readBounded(response, 1048576)), geography);
}

export function scottishBillStages(bills, stages, types, today = new Date().toISOString().slice(0, 10)) {
  if (![bills, stages, types].every(Array.isArray)) throw new SourceError('Invalid Scottish Parliament response');
  const titles = new Map(bills.map(row => [row.ID, row.FullName || row.ShortName]));
  const labels = new Map(types.map(row => [row.ID, row.Name]));
  const rows = stages.filter(row => row.StageDate && row.StageDate.slice(0, 10) <= today)
    .sort((a, b) => b.StageDate.localeCompare(a.StageDate) || b.ID - a.ID).slice(0, 8).map(row => {
      if (!titles.get(row.BillID) || !labels.get(row.BillStageTypeID) || !/^\d{4}-\d{2}-\d{2}/.test(row.StageDate)) throw new SourceError('Unmatched Scottish bill stage');
      return { bill_id: row.BillID, title: titles.get(row.BillID), stage: labels.get(row.BillStageTypeID), date: row.StageDate.slice(0, 10) };
    });
  if (!rows.length) throw new SourceError('No dated Scottish bill stages returned');
  return { source: 'Scottish Parliament', source_url: 'https://data.parliament.scot/', geography: 'Scotland',
    licence: 'Scottish Parliament Copyright Licence', licence_url: 'https://www.parliament.scot/about/copyright',
    attribution: 'Contains information licensed under the Scottish Parliament Copyright Licence',
    period: rows[0].date, unit: 'bill stage events', rows, note: 'Most recent eight dated stage records on or before today; not a count of enacted laws.' };
}

export async function readScottishBills() {
  const data = await Promise.all(['bills', 'billstages', 'billstagetypes'].map(async resource => {
    const response = await fetchOfficial(`https://data.parliament.scot/api/${resource}`, { cf: { cacheTtl: 900, cacheEverything: true } });
    return JSON.parse(await readBounded(response, 2097152));
  }));
  return scottishBillStages(...data);
}

const RECALLS_URL = 'https://recalls-rappels.canada.ca/en/feed/consumer-products-alerts-recalls';
export function canadianRecalls(xml) {
  if (/<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) throw new SourceError('Invalid recall RSS document');
  const channel = new XMLParser({ parseTagValue: false, isArray: name => name === 'item' }).parse(xml)?.rss?.channel;
  if (!channel || channel.description !== 'Consumer product') throw new SourceError('Unexpected recall feed');
  const rows = (channel.item || []).slice(0, 8).map(row => {
    if (typeof row.title !== 'string' || !row.title || typeof row.pubDate !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(row.pubDate)) throw new SourceError('Incomplete recall notice');
    const url = new URL(row.link);
    if (url.origin !== 'https://recalls-rappels.canada.ca' || !url.pathname.startsWith('/en/alert-recall/')) throw new SourceError('Unexpected recall link');
    return { title: row.title, url: url.href, published_at: row.pubDate };
  });
  return { source: 'Health Canada', source_url: RECALLS_URL, geography: 'Canada',
    licence: 'Open Government Licence - Canada', licence_url: 'https://open.canada.ca/en/open-government-licence-canada',
    attribution: 'Contains information licensed under the Open Government Licence – Canada.',
    fetched_at: new Date().toISOString(), unit: 'consumer product recall notices', rows,
    note: 'Up to eight notices from the current RSS feed, not an exhaustive recall history. Publication timestamps are preserved as supplied; the feed does not specify a timezone.' };
}

export async function readCanadianRecalls() {
  return canadianRecalls(await readBounded(await fetchOfficial(RECALLS_URL), 1048576));
}
