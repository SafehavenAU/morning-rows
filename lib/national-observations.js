import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchOfficial, readBounded, SourceError } from './sources.js';
import { parseCsv } from './stats-nz.js';

const OGL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
export const NRS_URL = 'https://data.gov.scot/dataset/weekly_deaths/resource/1d00a289-328f-4878-b6c9-23a5b467a1cf/download';
export const DMO_URL = 'https://www.dmo.gov.uk/data/XmlDataReport?reportCode=D1A';
export const FLU_METRIC = 'influenza_testing_positivityByWeek';
export const FLU_URL = `https://api.ukhsa-dashboard.data.gov.uk/themes/infectious_disease/sub_themes/respiratory/topics/Influenza/geography_types/Nation/geographies/England/metrics/${FLU_METRIC}`;
const NI_URL = 'https://data.niassembly.gov.uk/plenary.asmx/GetVotesOnDivision_JSON';
function requireValue(condition, message) { if (!condition) throw new SourceError(message); }
function isoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
const licence = { licence: 'Open Government Licence v3.0', licence_url: OGL };

export function isoWeekDates(period) {
  requireValue(/^\d{4}-W\d{2}$/.test(period), 'Invalid NRS ISO week');
  const year = Number(period.slice(0, 4)), week = Number(period.slice(6));
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(+jan4 - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (week - 1) * 604800000);
  const thursday = new Date(+monday + 3 * 86400000);
  requireValue(week >= 1 && week <= 53 && thursday.getUTCFullYear() === year, 'Invalid NRS ISO week');
  return { start: monday.toISOString().slice(0, 10), end: new Date(+monday + 6 * 86400000).toISOString().slice(0, 10) };
}
export function weeklyDeaths(csv, now = new Date()) {
  const [header, ...data] = parseCsv(csv);
  const expected = ['GeographyCode', 'GeographyName', 'GeographyType', 'DateCode', 'Measurement', 'Units', 'Value', 'Cause Of Death'];
  requireValue(header?.length === expected.length && expected.every((v, i) => header[i] === v) && data.length > 0, 'Unexpected NRS CSV columns');
  const causes = ['All causes', 'COVID-19', 'COVID-19 mentions', 'Flu', 'Flu mentions'];
  const seen = new Set();
  const records = data.map(row => {
    requireValue(row.length === header.length, 'Incomplete NRS row');
    const r = Object.fromEntries(header.map((k, i) => [k, row[i]]));
    requireValue(r.GeographyCode === 'S92000003' && r.GeographyName === 'Scotland' && r.GeographyType === 'Country' && r.Measurement === 'Count' && r.Units === 'Deaths' && causes.includes(r['Cause Of Death']), 'Unexpected NRS geography or measure');
    const dates = isoWeekDates(r.DateCode);
    requireValue(dates.end <= now.toISOString().slice(0, 10), 'NRS week is not complete');
    const id = `${r.DateCode}:${r['Cause Of Death']}`;
    requireValue(!seen.has(id), 'Duplicate NRS observation'); seen.add(id);
    return r;
  });
  const period = records.map(r => r.DateCode).sort().at(-1);
  const rows = causes.map(cause => {
    const r = records.find(r => r.DateCode === period && r['Cause Of Death'] === cause);
    requireValue(r && /^(0|[1-9]\d*)$/.test(r.Value) && Number.isSafeInteger(Number(r.Value)), 'Latest NRS week is incomplete or unavailable');
    return { cause, value: Number(r.Value), unit: 'registered deaths', geography: 'Scotland', period };
  });
  requireValue(rows[1].value <= rows[2].value && rows[3].value <= rows[4].value && rows.slice(1).every(r => r.value <= rows[0].value), 'Inconsistent NRS cause counts');
  return { source: 'National Records of Scotland', source_url: NRS_URL, ...licence, geography: 'Scotland', period, dates: isoWeekDates(period), rows,
    note: 'Deaths registered in the ISO Monday–Sunday week, not dates of death. Latest-year data are provisional and may be revised. COVID-19 and Flu are underlying causes; mentions include contributory causes. These categories overlap; do not add them. ISO weeks differ from ONS/NISRA week boundaries.' };
}
export async function readWeeklyDeaths() { return weeklyDeaths(await readBounded(await fetchOfficial(NRS_URL), 524288)); }

export function giltsInIssue(xml, now = new Date()) {
  requireValue(!/<!DOCTYPE/i.test(xml) && XMLValidator.validate(xml) === true, 'Invalid DMO XML');
  const body = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false, isArray: name => name === 'View_GILTS_IN_ISSUE' }).parse(xml);
  const rows = body.Data?.View_GILTS_IN_ISSUE;
  requireValue(Array.isArray(rows) && rows.length > 0, 'DMO instruments missing');
  const types = ['Conventional', 'Index-linked 3 months', 'Index-linked 8 months'];
  const seen = new Set(), dates = new Set(), counts = new Map(types.map(t => [t, 0]));
  for (const r of rows) {
    const type = r.INSTRUMENT_TYPE?.trim(), date = r.CLOSE_OF_BUSINESS_DATE;
    requireValue(types.includes(type) && /^GB[A-Z0-9]{10}$/.test(r.ISIN_CODE || '') && !seen.has(r.ISIN_CODE), 'Unexpected or duplicate DMO instrument');
    requireValue(/^\d{4}-\d{2}-\d{2}T00:00:00$/.test(date || '') && isoDate(date.slice(0, 10)) && date.slice(0, 10) <= now.toISOString().slice(0, 10), 'Invalid DMO reporting date');
    seen.add(r.ISIN_CODE); dates.add(date.slice(0, 10)); counts.set(type, counts.get(type) + 1);
  }
  requireValue(dates.size === 1 && [...counts.values()].every(n => n > 0), 'Mixed dates or missing DMO instrument classes');
  return { source: 'UK Debt Management Office', source_url: DMO_URL, ...licence, geography: 'United Kingdom', period: [...dates][0], value: rows.length, unit: 'distinct gilt instruments in the published file',
    by_type: [...counts].map(([type, value]) => ({ type, value })),
    note: 'Close-of-business count of distinct ISINs in the Gilts in Issue report. Includes government-held stock; not a monetary debt total, market value, yield or investment recommendation.' };
}
export async function readGiltsInIssue() { return giltsInIssue(await readBounded(await fetchOfficial(DMO_URL), 524288)); }

export function previousMonth(now = new Date()) {
  // Parliamentary calendar dates use Europe/London, including month boundaries.
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  const start = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 2, 1));
  const end = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, 0));
  return { period: start.toISOString().slice(0, 7), start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function assemblyDivisions(body, month) {
  requireValue(body && Object.hasOwn(body, 'DivisionList'), 'NI Assembly response missing');
  // The documented service returns a null list for a genuine empty interval.
  const raw = body.DivisionList === null ? [] : body.DivisionList.Division;
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : null;
  requireValue(rows !== null, 'NI Assembly divisions missing');
  const seen = new Set(), dates = new Set();
  for (const r of rows) {
    requireValue(/^\d+$/.test(r.EventID || '') && !seen.has(r.EventID) && /^\d+$/.test(r.DocumentID || ''), 'Missing or duplicate NI Assembly division');
    requireValue(typeof r.DivisionDate === 'string' && /T.*[+-]\d{2}:\d{2}$/.test(r.DivisionDate) && Number.isFinite(Date.parse(r.DivisionDate)), 'Invalid NI Assembly date');
    const date = r.DivisionDate.slice(0, 10);
    requireValue(isoDate(date) && date >= month.start && date <= month.end, 'NI Assembly division outside requested month');
    seen.add(r.EventID); dates.add(date);
  }
  return { source: 'Northern Ireland Assembly', source_url: `${NI_URL}?startDate=${month.start}&endDate=${month.end}T23:59:59`, ...licence,
    attribution: 'Contains Parliamentary information licensed under the Open Government Licence v3.0.', geography: 'Northern Ireland Assembly', period: month.period,
    value: rows.length, unit: 'recorded divisions', sitting_dates_with_divisions: dates.size,
    note: 'Previous complete calendar month in Europe/London. Counts recorded divisions, not every vote, motion, sitting or enacted law. Recess months can have zero divisions. Subjects, member names and individual votes are not copied.' };
}
export async function readAssemblyDivisions() {
  const month = previousMonth();
  const url = `${NI_URL}?startDate=${month.start}&endDate=${month.end}T23:59:59`;
  return assemblyDivisions(JSON.parse(await readBounded(await fetchOfficial(url), 1048576)), month);
}

export function influenzaPositivity(pages, years, now = new Date()) {
  requireValue(pages.length === years.length && pages.length === 2, 'Incomplete UKHSA year selection');
  const seen = new Set(), rows = [];
  pages.forEach((page, i) => {
    requireValue(Array.isArray(page.results) && page.count === page.results.length && page.next === null && page.previous === null, 'Incomplete UKHSA page');
    for (const r of page.results) {
      requireValue(r.theme === 'infectious_disease' && r.sub_theme === 'respiratory' && r.topic === 'Influenza' && r.metric === FLU_METRIC && r.geography_type === 'Nation' && r.geography === 'England' && r.geography_code === 'E92000001' && r.age === 'all' && r.sex === 'all' && r.stratum === 'default', 'UKHSA dimension or geography mismatch');
      requireValue(isoDate(r.date) && r.year === years[i] && Number(r.date.slice(0, 4)) === years[i] && r.date <= now.toISOString().slice(0, 10) && !seen.has(r.date), 'Invalid or duplicate UKHSA period');
      requireValue(typeof r.in_reporting_delay_period === 'boolean', 'UKHSA reporting-delay flag missing');
      seen.add(r.date); rows.push(r);
    }
  });
  const latest = rows.sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  requireValue(latest && typeof latest.metric_value === 'number' && Number.isFinite(latest.metric_value) && latest.metric_value >= 0 && latest.metric_value <= 100, 'Latest UKHSA positivity unavailable; no earlier value substituted');
  const ageDays = Math.floor((now - new Date(latest.date)) / 86400000), delayed = ageDays > 28;
  return { source: 'UK Health Security Agency', source_url: FLU_URL, ...licence, geography: 'England', geography_code: 'E92000001', period: latest.date,
    period_kind: 'publisher date label for a seven-day specimen period', value: latest.metric_value, unit: 'percent of influenza PCR tests positive', age: 'all', sex: 'all',
    in_reporting_delay_period: latest.in_reporting_delay_period, status: delayed ? 'degraded' : 'ok', observation_age_days: ageDays,
    freshness: delayed ? 'Latest available weekly observation is more than 28 days old' : 'Latest available publisher observation',
    methodology_url: 'https://ukhsa-dashboard.data.gov.uk/metrics-documentation/influenza-testing-positivity-by-week',
    note: 'Percentage of tested specimens, not population prevalence. Weekly in influenza season and fortnightly in summer; values may be revised. Exact publisher date retained without inventing a week-ending date.' };
}
export async function readInfluenzaPositivity() {
  const now = new Date(), years = [now.getUTCFullYear() - 1, now.getUTCFullYear()];
  const pages = await Promise.all(years.map(async year => JSON.parse(await readBounded(await fetchOfficial(`${FLU_URL}?format=json&age=all&sex=all&stratum=default&page_size=365&year=${year}`), 524288))));
  return influenzaPositivity(pages, years, now);
}
