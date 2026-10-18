// Verification-only protected remote-dev entrypoint; never deploy to production.
import { PRICE_DIRECTORY, PRICE_NODES, priceRelease, nzPrices } from '../../lib/nz-prices.js';
import { fetchOfficial, readBounded, mapLimit } from '../../lib/sources.js';
const sha = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(x => x.toString(16).padStart(2, '0')).join('');
export default { async fetch(request) {
  if (new URL(request.url).pathname === '/access.json') {
    // One request per report, no redirect loops or hidden subrequest fan-out.
    // Fixed date is the release independently selected in this investigation.
    const reports = await mapLimit(PRICE_NODES, 2, async ([code]) => {
      const url = `https://www.emi.ea.govt.nz/Wholesale/Reports/CLA3WR?DateFrom=20261017&DateTo=20261017&POC=${code}`;
      const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(20000)});
      const status = response.status;
      const location = response.headers.get('location');
      const html = status === 200 ? await readBounded(response, 1048576) : '';
      if (status !== 200) await response.body?.cancel();
      return {code, url, status, redirect_path: location ? new URL(location, url).pathname : null,
        tables: [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(m => m[0])};
    });
    const production = await mapLimit(['morningrows.com', 'www.morningrows.com'], 2, async host => {
      const url = `https://${host}/new-zealand.json?source=prices`;
      try {
        const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(30000)});
        const body = await readBounded(response, 1048576);
        return {url, status: response.status, retrieved_at: new Date().toISOString(), body};
      } catch { return {url, error: 'Production response unavailable to protected preview'}; }
    });
    return Response.json({checked_at: new Date().toISOString(), reports, production});
  }
  const at = new Date();
  const listing = await readBounded(await fetchOfficial(PRICE_DIRECTORY), 1048576);
  const release = priceRelease(listing, at);
  const csv = await readBounded(await fetchOfficial(release.source_url), 1048576);
  const lines = csv.split(/\r?\n/), codes = PRICE_NODES.map(([code]) => code);
  const selected = [lines[0], ...lines.slice(1).filter(line => codes.some(code => line.includes(code)))].join('\n');
  const reports = await mapLimit(codes, 2, async code => {
    const day = release.date.replaceAll('-', '');
    const url = `https://www.emi.ea.govt.nz/Wholesale/Reports/CLA3WR?DateFrom=${day}&DateTo=${day}&POC=${code}`;
    try {
      const html = await readBounded(await fetchOfficial(url, {redirect: 'manual'}), 1048576);
      return {code, url, sha256: await sha(html), tables: [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(m => m[0]), status: 200};
    } catch(e) { return {code, url, status: e.status || null, error: e.message}; }
  });
  return Response.json({retrieved_at: at.toISOString(), completed_at: new Date().toISOString(), release,
    directory_sha256: await sha(listing), source_sha256: await sha(csv), selected_csv: selected,
    reader_result: nzPrices(csv, release), reports,
    licence: 'CC BY 4.0', attribution: 'www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)',
    method: 'Original aggregate CSV lines and official report table elements retained without numeric transformation. reader_result is the actual production parser; independent Python comparison is separate.'});
}};
