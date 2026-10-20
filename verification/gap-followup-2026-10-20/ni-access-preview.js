// Verification-only read of a newly identified official public article.
// It never requests the already-refused datavis route or another publisher.
const url = 'https://www.economy-ni.gov.uk/articles/electricity-consumption-and-renewable-generation-statistics';
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
export default {
  async fetch() {
    const started_at = new Date().toISOString();
    try {
      const response = await fetch(url, {headers: {accept: 'text/html'}, redirect: 'manual', signal: AbortSignal.timeout(20000)});
      const reader = response.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) {
        try {
          for (;;) {
            const {done, value} = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 65536) throw Error('Response exceeded 65,536-byte diagnostic limit');
            chunks.push(value);
          }
        } finally { await reader.cancel(); }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const html = new TextDecoder().decode(bytes);
      const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const start = text.indexOf('Latest results');
      const end = start < 0 ? -1 : text.indexOf('Previous publications', start);
      // Selected statistical excerpt only; no contacts or authentication data.
      let excerpt = start < 0 ? null : text.slice(start, end > start ? end : start + 2200);
      if (excerpt && /@|tel:|telephone|contact us/i.test(excerpt)) excerpt = excerpt.split(/Contact|Telephone|Email|E-mail/i)[0];
      return Response.json({
        url, started_at, completed_at: new Date().toISOString(),
        status: response.status, content_type: response.headers.get('content-type'),
        bytes: size, sha256: await hash(bytes), followed_redirects: false,
        article_heading_present: html.includes('Electricity Consumption and Renewable Generation Statistics'),
        request_rejected: /Request Rejected|Access Denied|error\s*1010/i.test(text),
        excerpt
      });
    } catch (error) {
      return Response.json({url, started_at, completed_at: new Date().toISOString(), acquired: false, error: error instanceof Error ? error.message : 'Diagnostic failed'});
    }
  }
};
