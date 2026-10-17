export class SourceError extends Error {
  constructor(message, status) { super(message); this.name = 'SourceError'; this.status = status; }
}

export function describeError(error) {
  if (error instanceof SourceError) return { error: error.message, ...(error.status ? { http_status: error.status } : {}) };
  return { error: error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'Source request timed out' : 'Source response could not be read or parsed' };
}

export async function fetchOfficial(url, options = {}) {
  const { allowStatuses = [], ...requestOptions } = options;
  const response = await fetch(url, { redirect: 'follow', ...requestOptions, signal: options.signal ?? AbortSignal.timeout(20000) });
  if (!response.ok && !allowStatuses.includes(response.status)) {
    await response.body?.cancel();
    throw new SourceError(`${new URL(url).hostname} returned HTTP ${response.status}`, response.status);
  }
  return response;
}

export async function mapLimit(items, limit, read) {
  const result = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; result[index] = await read(items[index], index); }
  }));
  return result;
}

export function hasFailures(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.error || value.status === 'error' || value.status === 'degraded') return true;
  return Object.values(value).some(hasFailures);
}

// Each task includes parsing as well as fetching, so a malformed response cannot
// discard successful, unrelated sources. State is local to this request.
export async function readSections(tasks, metadata = {}) {
  const entries = await mapLimit(Object.entries(tasks), 4, async ([name, read]) => {
    const fetched_at = new Date().toISOString();
    try {
      const value = await read();
      if (value == null || value?.error) throw new SourceError(value?.error || 'Source returned no observation');
      return [name, value, { ...metadata[name], status: hasFailures(value) ? 'degraded' : 'ok', fetched_at }];
    } catch (error) {
      const detail = { status: 'error', fetched_at, ...metadata[name], ...describeError(error) };
      console.warn(JSON.stringify({ event: 'source_failure', source: name, ...detail }));
      return [name, null, detail];
    }
  });
  return { ...Object.fromEntries(entries.map(([name, value]) => [name, value])), sources: Object.fromEntries(entries.map(([name, , health]) => [name, health])) };
}

export async function readBounded(response, max = 262144) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > max) throw new SourceError('Source response exceeded the bounded read; no partial value published');
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel(); }
}
