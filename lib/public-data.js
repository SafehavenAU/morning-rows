import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchOfficial, readBounded, SourceError } from './sources.js';
import { parseCsv } from './stats-nz.js';

const AIHW_BASE = 'https://myhospitalsapi.aihw.gov.au/api/v1/flat-data-extract/MYH-ED-WAITS';
const STATES = ['NSW', 'Vic', 'Qld', 'WA', 'SA', 'Tas', 'ACT', 'NT'];
const TRIAGE_CODES = { 'MYH-RM0035': 'Resuscitation', 'MYH-RM0036': 'Emergency', 'MYH-RM0037': 'Urgent', 'MYH-RM0038': 'Semi-urgent', 'MYH-RM0039': 'Non-urgent' };
export function hospitalFromApi(body) {
  const records = body.result?.data, pagination = body.result?.pagination;
  if (!Array.isArray(records) || !records.length || pagination?.total_results_available !== records.length || pagination?.starting_result_index !== 1) throw new SourceError('Incomplete AIHW extract');
  for (const r of records) {
    if (r.measure_code !== 'MYH0010' || r.reporting_unit_type_code !== 'S' || !STATES.includes(r.reporting_unit_code) || !TRIAGE_CODES[r.reported_measure_code] || r.units_name !== 'percent' || !/^\d{4}-07-01$/.test(r.reporting_start_date) || !/^\d{4}-06-30$/.test(r.reporting_end_date) || Number(r.reporting_end_date.slice(0,4)) !== Number(r.reporting_start_date.slice(0,4)) + 1) throw new SourceError('Unexpected AIHW measure, period or geography');
  }
  const end = records.map(r => r.reporting_end_date).sort().at(-1);
  const latest = records.filter(r => r.reporting_end_date === end);
  const states = STATES.map(code => {
    const selected = latest.filter(r => r.reporting_unit_code === code);
    if (selected.length !== 5 || new Set(selected.map(r => r.reported_measure_code)).size !== 5) throw new SourceError('Latest AIHW period has missing or duplicate triage rows');
    const row = { code, name: selected[0].reporting_unit_name, notes: [], value_status: {} };
    for (const item of selected) {
      const triage = TRIAGE_CODES[item.reported_measure_code];
      const explicitSuppression = Boolean(item.suppression || item.suppression_codes);
      const suppressed = item.value == null || explicitSuppression;
      if (!suppressed && (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0 || item.value > 100)) throw new SourceError('Invalid AIHW percentage');
      row[triage] = suppressed ? null : item.value;
      row.value_status[triage] = explicitSuppression ? 'suppressed' : item.value == null ? 'unavailable' : 'observed';
      if (suppressed) { row.status = 'degraded'; row.error = 'One or more AIHW triage values are suppressed or unavailable'; }
      if (item.caveat_footnotes || item.data_set_caveat_footnotes) row.notes.push({ triage, caveat: item.caveat_footnotes, dataset_caveat: item.data_set_caveat_footnotes });
    }
    return row;
  });
  const start = latest[0].reporting_start_date;
  return { year: `${start.slice(0,4)}-${end.slice(2,4)}`, period: { start, end }, uploaded: body.version_information?.date_uploaded || null,
    source: 'Australian Institute of Health and Welfare', source_url: AIHW_BASE, measure_code: 'MYH0010',
    licence: 'CC BY 4.0', licence_url: 'https://www.aihw.gov.au/copyright', attribution: 'Source: Australian Institute of Health and Welfare, MyHospitals API.',
    geography: 'Australian states and territories', unit: 'percent of emergency department patients commencing treatment within the recommended triage time',
    selection: 'latest published financial year in the recent three-year extract; all five triage categories and all eight jurisdictions required', states };
}
export async function readHospital() {
  const year = new Date().getUTCFullYear();
  const url = `${AIHW_BASE}?skip=0&top=1000&measure_code=MYH0010&reporting_unit_type_code=S&start_date=${year - 3}&end_date=${year}`;
  const response = await fetchOfficial(url, { headers: { accept: 'application/json' }, cf: { cacheTtl: 3600, cacheEverything: true } });
  return { ...hospitalFromApi(JSON.parse(await readBounded(response, 2097152))), source_url: url };
}

export const WALES_URL = 'https://api.stats.gov.wales/v2/20b6276b-92f7-48fd-806e-69c35b54d9e0/data?format=csv';
export function walesProjection(csv, year = new Date().getUTCFullYear()) {
  const [header, ...rows] = parseCsv(csv);
  const names = ['Data values', 'Data description', 'Year', 'Area', 'Age', 'Sex'];
  if (!names.every(name => header?.includes(name))) throw new SourceError('StatsWales projection columns missing');
  const selected = [];
  for (const row of rows) {
    if (row.length !== header.length) throw new SourceError('Incomplete StatsWales CSV record');
    const r = Object.fromEntries(header.map((name, i) => [name, row[i]]));
    if (r.Area === 'Wales' && r.Age === 'All Ages' && r.Sex === 'Persons' && r.Year === `Mid-year ${year}` && r['Data description'] === 'Population projections') selected.push(r);
  }
  if (selected.length !== 1) throw new SourceError('Expected one Wales all-ages, all-persons projection for the current calendar year');
  const r = selected[0];
  if (!/^\d+$/.test(r['Data values'])) throw new SourceError('Wales projection is missing or suppressed');
  return { source: 'StatsWales / Welsh Government; ONS national population projections', source_url: WALES_URL,
    licence: 'Open Government Licence v3.0', licence_url: 'https://www.gov.wales/copyright', geography: 'Wales', area: 'Wales',
    period: r.Year, value: Number(r['Data values']), unit: 'people', kind: 'projection', base_year: 2024,
    meaning: '2024-based national population projection, all ages, persons; not an observed population estimate', notes: r.Notes || null };
}
export async function readWalesProjection() {
  return walesProjection(await readBounded(await fetchOfficial(WALES_URL, { cf: { cacheTtl: 3600, cacheEverything: true } }), 2097152));
}

export const NISRA_URL = 'https://ws-data.nisra.gov.uk/public/api.restful/PxStat.Data.Cube_API.ReadDataset/CHILDBMILGD/JSON-stat/2.0/en';
function orderedCodes(category) {
  if (Array.isArray(category?.index)) return category.index;
  if (category?.index && typeof category.index === 'object') {
    const entries = Object.entries(category.index).sort((a,b) => a[1] - b[1]);
    if (entries.every(([,index], i) => index === i)) return entries.map(([code]) => code);
  }
  throw new SourceError('Invalid JSON-stat dimension index');
}
export function niChildhoodBmi(body) {
  const dimensions = ['STATISTIC', 'TLIST(A1)', 'SEX', 'LGD2014'];
  if (body.class !== 'dataset' || body.extension?.matrix !== 'CHILDBMILGD' || !body.extension?.official || body.id?.length !== 4 || !dimensions.every(id => body.id.includes(id))) throw new SourceError('Unexpected NISRA dataset');
  const codes = Object.fromEntries(body.id.map((id, i) => {
    const values = orderedCodes(body.dimension[id]?.category);
    if (values.length !== body.size[i] || new Set(values).size !== values.length) throw new SourceError('Invalid JSON-stat dimension size');
    return [id, values];
  }));
  const total = body.size.reduce((a,b) => a*b,1);
  if (!Array.isArray(body.value) || body.value.length !== total) throw new SourceError('Incomplete NISRA values');
  const periods = codes['TLIST(A1)'];
  if (!periods.every(p => /^\d{4}\/\d{2}$/.test(p))) throw new SourceError('Unexpected academic-year labels');
  const period = [...periods].sort().at(-1);
  const selected = { 'TLIST(A1)': period, SEX: 'All', LGD2014: 'N92000002' };
  const rows = ['P1BMIOb','P1BMIOwOb','Y8BMIOb','Y8BMIOwOb'].map(statistic => {
    let index = 0;
    for (const id of body.id) {
      const coordinate = codes[id].indexOf(id === 'STATISTIC' ? statistic : selected[id]);
      if (coordinate < 0) throw new SourceError('NISRA aggregate dimension not found');
      index = index * codes[id].length + coordinate;
    }
    const value = body.value[index];
    const unit = body.dimension.STATISTIC.category.unit?.[statistic]?.label;
    if (unit !== '%' || (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100))) throw new SourceError('Unexpected NISRA measure or unit');
    const status = Array.isArray(body.status) ? body.status[index] : body.status?.[index];
    return { id: statistic, name: body.dimension.STATISTIC.category.label[statistic], period, value,
      unit: 'percent', geography: 'Northern Ireland', sex: 'All Persons', ...(status ? { observation_status: status } : {}),
      ...(value == null ? { status: 'error', error: 'Latest academic-year observation is unavailable; no earlier value substituted' } : { status: 'ok' }) };
  });
  return { source: 'Department of Health (Northern Ireland), published by NISRA', source_url: NISRA_URL,
    licence: 'Open Government Licence v3.0', licence_url: 'https://www.nisra.gov.uk/crown-copyright', attribution: 'Source: NISRA. Website: https://www.nisra.gov.uk',
    geography: 'Northern Ireland', period, updated: body.updated, rows,
    note: 'Aggregate measurements of Primary 1 and Year 8 pupils, classified using International Obesity Task Force growth charts. P1 pupils were aged 4 years 2 months to 6 years 2 months; Year 8 pupils 11 years 2 months to 13 years 2 months. Pandemic-related missing years and incomplete trust coverage limit historical comparisons. See the publisher methodology before comparing years or areas.',
    methodology_url: 'https://www.health-ni.gov.uk/articles/health-inequalities-statistics' };
}
export async function readNiChildhoodBmi() {
  return niChildhoodBmi(JSON.parse(await readBounded(await fetchOfficial(NISRA_URL, { cf: { cacheTtl: 3600, cacheEverything: true } }), 262144)));
}

const LAWS_URL = 'https://www.legislation.gov.uk/new/ukpga/data.feed';
export function ukActs(xml) {
  if (/<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) throw new SourceError('Invalid legislation Atom feed');
  const feed = new XMLParser({ removeNSPrefix: true, parseTagValue: false, isArray: name => name === 'entry' }).parse(xml)?.feed;
  if (!feed || !feed.updated) throw new SourceError('Legislation feed metadata missing');
  const entries = (feed.entry || []).slice(0,8).map(entry => {
    if (!/^https?:\/\/www\.legislation\.gov\.uk\/id\/ukpga\/\d{4}\/\d+$/.test(entry.id || '') || typeof entry.title !== 'string') throw new SourceError('Unexpected legislation type or identifier');
    return { title: entry.title, url: entry.id.replace(/^http:/, 'https:'), updated: entry.updated || null };
  });
  return { source: 'The National Archives, legislation.gov.uk', source_url: LAWS_URL, licence: 'Open Government Licence v3.0', licence_url: 'https://www.legislation.gov.uk/information/re-use',
    geography: 'United Kingdom Parliament; territorial extent varies by Act', period: feed.updated,
    note: 'UK Public General Acts in the publisher feed, not all new legislation across the four nations. Updated is a feed timestamp, not necessarily an enactment date.',
    rows: entries.map(e => e.title), entries };
}
export async function readUkActs() { return ukActs(await readBounded(await fetchOfficial(LAWS_URL, { headers: { accept: 'application/atom+xml' } }), 524288)); }
