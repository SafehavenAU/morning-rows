// Verification-only probe of two already advertised public daily bundles.
// No monthly-CSV retry, dynamic discovery, production activation or fallback.
const urls = [
  'https://nemweb.com.au/Reports/CURRENT/Public_Prices/PUBLIC_PRICES_202610180000_20261019040502.zip',
  'https://nemweb.com.au/Reports/CURRENT/Public_Prices/PUBLIC_PRICES_202610190000_20261020040503.zip',
];
const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
export default {
  async fetch() {
    const records = [];
    for (const url of urls) {
      const started_at = new Date().toISOString();
      try {
        const response = await fetch(url, {headers: {accept: 'application/zip'}, redirect: 'manual', signal: AbortSignal.timeout(20000)});
        const chunks = [];
        let size = 0;
        const reader = response.body?.getReader();
        if (reader) {
          try {
            for (;;) {
              const {done, value} = await reader.read();
              if (done) break;
              size += value.length;
              if (size > 524288) throw Error('Bundle exceeds 524,288-byte probe limit');
              chunks.push(value);
            }
          } finally { await reader.cancel(); }
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        records.push({url, started_at, completed_at: new Date().toISOString(), status: response.status,
          content_type: response.headers.get('content-type'), bytes: size, sha256: await sha(bytes),
          zip_signature: size >= 4 && bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4,
          followed_redirects: false});
      } catch (error) {
        records.push({url, started_at, completed_at: new Date().toISOString(), acquired: false,
          error: error instanceof Error ? error.message : 'Acquisition failed'});
      }
    }
    return Response.json({kind: 'Fixed-specimen alternate-route access only; no reader acceptance', records});
  }
};
