import { fetchOfficial, readBounded, mapLimit, SourceError, describeError } from './sources.js';
import { STATS_NZ_SERIES } from './stats-nz-series.js';

export function parseCsv(text) {
  const records = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); if (row.some(Boolean)) records.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw new SourceError('Incomplete quoted CSV record');
  if (cell || row.length) { row.push(cell.trim()); records.push(row); }
  return records;
}

export function statNzFromCsv(text, series, now = new Date()) {
  const records = parseCsv(text);
  const headerAt = records.findIndex(row => row.includes('OBS_VALUE'));
  if (headerAt < 0) throw new SourceError('Stats NZ observation header missing');
  const header = records[headerAt];
  const valueAt = header.indexOf('OBS_VALUE');
  const periodAt = series.period_column ? header.indexOf(series.period_column) : -1;
  if (series.period_column && periodAt < 0) throw new SourceError('Stats NZ reference period column missing');
  for (const column of Object.keys(series.dimensions)) {
    if (!header.includes(column)) throw new SourceError('Stats NZ selected dimension missing');
  }
  const maxYear = String(now.getUTCFullYear());
  const maxMonth = maxYear + String(now.getUTCMonth() + 1).padStart(2, '0');
  const candidates = records.slice(headerAt + 1).filter(row => {
    if (row.length !== header.length) throw new SourceError('Incomplete Stats NZ CSV row');
    if (!Object.entries(series.dimensions).every(([column, selected]) => row[header.indexOf(column)] === selected.code)) {
      throw new SourceError('Stats NZ returned a different series than requested');
    }
    const period = periodAt >= 0 ? row[periodAt] : series.reference_period;
    if (!/^\d{4}(?:\d{2})?$/.test(period || '')) throw new SourceError('Unrecognised Stats NZ period');
    if (series.kind === 'projection') return series.projection_period === 'next_available' ? period >= maxYear : period === maxYear;
    return period <= (period.length === 6 ? maxMonth : maxYear);
  });
  candidates.sort((a,b) => (periodAt >= 0 ? (series.projection_period === 'next_available' ? a[periodAt].localeCompare(b[periodAt]) : b[periodAt].localeCompare(a[periodAt])) : 0));
  if (!candidates.length) throw new SourceError('No observation for the selected series and period');
  const row = candidates[0], period = periodAt >= 0 ? row[periodAt] : series.reference_period;
  if (candidates.length > 1 && (periodAt < 0 || candidates[1][periodAt] === period)) throw new SourceError('Ambiguous Stats NZ observations for the selected period');
  const raw = row[valueAt];
  if (raw === '' || !Number.isFinite(Number(raw))) throw new SourceError('Latest Stats NZ observation is missing or suppressed');
  const attributes = Object.fromEntries(header.map((col,i) => [col,row[i]]).filter(([col]) => col !== 'OBS_VALUE' && col !== 'DATAFLOW' && col !== 'STRUCTURE' && col !== series.period_column && !series.dimensions[col]));
  return { period, period_label: series.period_labels?.[period] || period, value: Number(raw), attributes };
}

export async function readStatsNz(env, catalogue = []) {
  if (!env?.STATSNZ_KEY) return { present: false, status: 'error', error: 'STATSNZ_KEY binding missing', rows: [] };
  const rows = await mapLimit(STATS_NZ_SERIES, 4, async series => {
    const source_url = `https://api.data.stats.govt.nz/rest/data/STATSNZ,${series.id},1.0/${series.key}?dimensionAtObservation=AllDimensions&format=csv`;
    const base = { id: series.id, name: series.name, source: 'Stats NZ', source_url, licence: 'Creative Commons Attribution 4.0', geography: series.geography, unit: series.unit, kind: series.kind, selection: series.kind === 'projection' ? (series.projection_period || 'current_calendar_year') : 'latest_available_in_selected_series', dimensions: series.dimensions, ...Object.fromEntries(['population_group','period_convention','limitations','publication_status','index_reference'].filter(key=>series[key]).map(key=>[key,series[key]])), fetched_at: new Date().toISOString() };
    try {
      const response = await fetchOfficial(source_url, { headers: { 'Ocp-Apim-Subscription-Key': env.STATSNZ_KEY, accept: 'text/csv' } });
      return { ...base, status: 'ok', ...statNzFromCsv(await readBounded(response), series) };
    } catch (error) {
      const detail = describeError(error);
      console.warn(JSON.stringify({ event: 'source_failure', source: 'Stats NZ', table: series.id, ...detail }));
      return { ...base, status: 'error', period: null, value: null, ...detail };
    }
  });
  return { present: true, status: rows.every(row => row.status === 'ok') ? 'ok' : 'degraded', rows, licence: 'Creative Commons Attribution 4.0. Credit Stats NZ.', catalogue, catalogue_count: catalogue.length, census_tables_not_copied: 705, not_in_this_api: 'Consumers price index, the labour force survey, retail trade, and building consents are not in this catalogue. Projections are labelled separately from observations.' };
}
