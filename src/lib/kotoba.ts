import {
  type ConjugationData,
  type KotobaMode,
  isConjugationQuery,
} from '@/types/kotoba';

export {
  type ConjugationData,
  type ConjugationEntry,
  type ConjugationForm,
  type ConjugationSection,
  type KotobaMode,
  isConjugationQuery,
} from '@/types/kotoba';

const KOTOBA_BASE_URL = 'https://kotoba.lt';
const REQUEST_TIMEOUT_MS = 4000;
const TTL_SUCCESS_MS = 24 * 60 * 60 * 1000; // 24h
const TTL_NEGATIVE_OR_ERROR_MS = 30 * 1000; // 30s
const MAX_CACHE_SIZE = 1000;
const MAX_CONCURRENT_OUTBOUND = 8;
const MAX_QUEUE_SIZE = 16;

export class KotobaError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'KotobaError';
    this.status = status;
  }
}

export class KotobaTimeoutError extends KotobaError {
  constructor(message = 'Gateway Timeout') {
    super(message, 504);
    this.name = 'KotobaTimeoutError';
  }
}

type CacheEntry =
  | { type: 'success'; data: ConjugationData; expiresAt: number }
  | { type: 'error'; error: KotobaError; expiresAt: number };

// In-process bounded LRU cache
const cache = new Map<string, CacheEntry>();
// In-flight request deduplication map
const inFlight = new Map<string, Promise<ConjugationData>>();

// Concurrency queue to bound in-flight amplification
let activeOutboundCount = 0;
const waitQueue: Array<() => void> = [];

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeOutboundCount >= MAX_CONCURRENT_OUTBOUND) {
    if (waitQueue.length >= MAX_QUEUE_SIZE) {
      throw new KotobaError('Kotoba gateway busy', 503);
    }
    await new Promise<void>((resolve) => waitQueue.push(resolve));
  } else {
    activeOutboundCount++;
  }

  try {
    return await fn();
  } finally {
    if (waitQueue.length > 0) {
      const next = waitQueue.shift();
      if (next) next();
    } else {
      activeOutboundCount--;
    }
  }
}

function setBoundedCache(key: string, entry: CacheEntry): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, entry);
}

function getFromCache(key: string): ConjugationData | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  // Refresh LRU order
  cache.delete(key);
  cache.set(key, entry);

  if (entry.type === 'error') {
    throw entry.error;
  }

  return entry.data;
}

function parseSearchResponse(query: string, json: unknown): ConjugationData {
  if (typeof json !== 'object' || json === null) {
    throw new KotobaError('Malformed search response from Kotoba', 502);
  }
  const raw = json as Record<string, unknown>;
  if (!Array.isArray(raw.results)) {
    throw new KotobaError('Malformed search results array from Kotoba', 502);
  }

  const entries: ConjugationData['entries'] = [];
  for (const item of raw.results) {
    if (typeof item === 'object' && item !== null) {
      const r = item as Record<string, unknown>;
      if (typeof r.seq === 'number' && typeof r.headword === 'string' && typeof r.reading === 'string') {
        entries.push({
          sequence: r.seq,
          surface: r.headword,
          reading: r.reading,
        });
      }
    }
  }

  let baseForm: string | undefined;
  const rules: string[] = [];

  if (typeof raw.deinflected === 'object' && raw.deinflected !== null) {
    const d = raw.deinflected as Record<string, unknown>;
    if (typeof d.form === 'string') {
      baseForm = d.form;
    }
    if (Array.isArray(d.rules)) {
      for (const r of d.rules) {
        if (typeof r === 'string') {
          rules.push(r);
        }
      }
    }
  }

  return {
    query: typeof raw.query === 'string' ? raw.query : query,
    baseForm,
    rules,
    entries,
    sections: [],
  };
}

function parseFormsResponse(query: string, json: unknown): ConjugationData {
  if (typeof json !== 'object' || json === null) {
    throw new KotobaError('Malformed forms response from Kotoba', 502);
  }
  const raw = json as Record<string, unknown>;

  // No guesses: if entry is missing, dictionary lacks word -> return valid empty
  const rawEntry = raw.entry;
  if (!rawEntry || typeof rawEntry !== 'object') {
    return {
      query: typeof raw.query === 'string' ? raw.query : query,
      rules: [],
      entries: [],
      sections: [],
    };
  }

  const entryObj = rawEntry as Record<string, unknown>;
  if (typeof entryObj.seq !== 'number' || typeof entryObj.headword !== 'string' || typeof entryObj.reading !== 'string') {
    throw new KotobaError('Malformed entry schema in forms response', 502);
  }

  const entries: ConjugationData['entries'] = [
    {
      sequence: entryObj.seq,
      surface: entryObj.headword,
      reading: entryObj.reading,
    },
  ];

  if (Array.isArray(raw.others)) {
    const seen = new Set<number>([entryObj.seq]);
    for (const item of raw.others) {
      if (typeof item === 'object' && item !== null) {
        const o = item as Record<string, unknown>;
        if (typeof o.seq === 'number' && typeof o.headword === 'string' && typeof o.reading === 'string') {
          if (!seen.has(o.seq)) {
            seen.add(o.seq);
            entries.push({
              sequence: o.seq,
              surface: o.headword,
              reading: o.reading,
            });
          }
        }
      }
    }
  }

  let baseForm: string | undefined;
  const rules: string[] = [];

  if (typeof raw.deinflected === 'object' && raw.deinflected !== null) {
    const d = raw.deinflected as Record<string, unknown>;
    if (typeof d.form === 'string') {
      baseForm = d.form;
    }
    if (Array.isArray(d.rules)) {
      for (const r of d.rules) {
        if (typeof r === 'string') {
          rules.push(r);
        }
      }
    }
  }
  if (!baseForm && typeof entryObj.headword === 'string') {
    baseForm = entryObj.headword;
  }

  let group: string | undefined;
  const sections: ConjugationData['sections'] = [];

  if (typeof raw.conjugation === 'object' && raw.conjugation !== null) {
    const conj = raw.conjugation as Record<string, unknown>;
    if (typeof conj.group === 'string') {
      group = conj.group;
    }
    if (Array.isArray(conj.sections)) {
      for (const secItem of conj.sections) {
        if (typeof secItem === 'object' && secItem !== null) {
          const sec = secItem as Record<string, unknown>;
          if (typeof sec.id === 'string' && Array.isArray(sec.forms)) {
            const forms: ConjugationData['sections'][number]['forms'] = [];
            for (const formItem of sec.forms) {
              if (typeof formItem === 'object' && formItem !== null) {
                const f = formItem as Record<string, unknown>;
                if (typeof f.id === 'string' && typeof f.form === 'string') {
                  forms.push({
                    id: f.id,
                    form: f.form,
                    ...(typeof f.reading === 'string' && f.reading.length > 0 ? { reading: f.reading } : {}),
                    ...(typeof f.alt === 'string' && f.alt.length > 0 ? { alternative: f.alt } : {}),
                    matched: Boolean(f.matches_query),
                  });
                }
              }
            }
            sections.push({
              id: sec.id,
              forms,
            });
          }
        }
      }
    }
  }

  return {
    query: typeof raw.query === 'string' ? raw.query : query,
    baseForm,
    rules,
    entries,
    sections,
    group,
  };
}

export async function fetchKotoba(
  mode: KotobaMode,
  query: string,
  sequence?: number,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<ConjugationData> {
  if (mode !== 'search' && mode !== 'forms') {
    throw new KotobaError('Invalid mode: must be search or forms', 400);
  }

  if (!isConjugationQuery(query)) {
    throw new KotobaError('Invalid query: must be a Japanese single word (<=80 chars) containing kana', 400);
  }

  if (sequence !== undefined) {
    if (mode !== 'forms' || !Number.isInteger(sequence) || sequence <= 0 || sequence > 999_999_999_999_999) {
      throw new KotobaError('Invalid sequence parameter', 400);
    }
  }

  const trimmedQ = query.trim();
  const cacheKey = `${mode}:${trimmedQ}:${sequence ?? ''}`;

  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const existingInFlight = inFlight.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const outboundPromise = (async () => {
    try {
      const data = await withConcurrencyLimit(async () => {
        const url =
          mode === 'search'
            ? `${KOTOBA_BASE_URL}/api/v1/jp/search?q=${encodeURIComponent(trimmedQ)}`
            : `${KOTOBA_BASE_URL}/api/v1/jp/forms?q=${encodeURIComponent(trimmedQ)}${
                sequence !== undefined ? `&seq=${sequence}` : ''
              }`;

        let res: Response;
        try {
          res = await fetchFn(url, {
            method: 'GET',
            redirect: 'error',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            headers: { Accept: 'application/json' },
          });
        } catch (err: unknown) {
          const e = err as { name?: string; message?: string };
          if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
            throw new KotobaTimeoutError('Kotoba gateway timed out');
          }
          throw new KotobaError(`Kotoba request failed: ${e?.message ?? 'network error'}`, 502);
        }

        // 404 forms treated valid empty
        if (res.status === 404) {
          return {
            query: trimmedQ,
            rules: [],
            entries: [],
            sections: [],
          };
        }

        if (!res.ok) {
          throw new KotobaError(`Kotoba returned HTTP ${res.status}`, 502);
        }

        let json: unknown;
        try {
          json = await res.json();
        } catch {
          throw new KotobaError('Invalid JSON from Kotoba', 502);
        }

        return mode === 'search'
          ? parseSearchResponse(trimmedQ, json)
          : parseFormsResponse(trimmedQ, json);
      });

      const isNegative = data.entries.length === 0 && data.sections.length === 0;
      const ttl = isNegative ? TTL_NEGATIVE_OR_ERROR_MS : TTL_SUCCESS_MS;
      setBoundedCache(cacheKey, { type: 'success', data, expiresAt: Date.now() + ttl });
      return data;
    } catch (err: unknown) {
      const errorToCache =
        err instanceof KotobaError ? err : new KotobaError('Kotoba gateway error', 502);

      // Only cache cooldown for upstream errors (502/504), not validation errors (400) or local queue overload (503)
      if (errorToCache.status >= 500 && errorToCache.status !== 503) {
        setBoundedCache(cacheKey, {
          type: 'error',
          error: errorToCache,
          expiresAt: Date.now() + TTL_NEGATIVE_OR_ERROR_MS,
        });
      }
      throw errorToCache;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, outboundPromise);
  return outboundPromise;
}

// Test / maintenance helpers
// ponytail: explicit reset avoids persistent leak across test runs without complex state manager
export function _resetKotobaCacheForTesting(): void {
  cache.clear();
  inFlight.clear();
  activeOutboundCount = 0;
  waitQueue.length = 0;
}

export function _getKotobaCacheSizeForTesting(): number {
  return cache.size;
}
