export type AllowedLicense = 'CC BY 2.0 FR' | 'CC0 1.0';

export interface TatoebaExample {
  id: string;
  sentenceId: number;
  translationId: number;
  textJa: string;
  textVi: string;
  authorJa: string | null;
  authorVi: string | null;
  licenseJa: AllowedLicense | null;
  licenseVi: AllowedLicense | null;
  source: 'Tatoeba';
  url: string;
}

export interface TatoebaApiResponse {
  query: string;
  count: number;
  examples: TatoebaExample[];
}

interface RawTatoebaSentence {
  id?: number | string;
  text?: string;
  lang?: string;
  owner?: string | null;
  user?: { username?: string } | null;
  license?: string | null;
  translations?: unknown;
}

export const TATOEBA_API_URL = process.env.TATOEBA_API_URL || 'https://api.tatoeba.org/v1/sentences';
export const DEFAULT_TIMEOUT_MS = 6_000;
export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 20;
export const MAX_QUERY_LENGTH = 100;

const MANTICORE_OPERATORS = /[\\()|\-!@~"&/^$=<>*%]/g;

export function normalizeRawQuery(query: unknown): string {
  if (typeof query !== 'string') return '';
  return query.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

export function escapeManticore(query: string): string {
  return query.replace(MANTICORE_OPERATORS, (char) => `\\${char}`);
}

export function sanitizeQuery(query: unknown): string {
  return escapeManticore(normalizeRawQuery(query));
}

export function parseLimit(limitParam: string | null, defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT): number {
  if (!limitParam) return defaultLimit;
  const parsed = parseInt(limitParam, 10);
  if (Number.isNaN(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

export function parseLicense(raw: unknown): AllowedLicense | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === 'CC BY 2.0 FR') return 'CC BY 2.0 FR';
  if (trimmed === 'CC0 1.0') return 'CC0 1.0';
  return null;
}

function extractAuthor(item: RawTatoebaSentence): string | null {
  if (typeof item.owner === 'string') {
    const trimmed = item.owner.trim();
    if (trimmed.length > 0) return trimmed;
  }
  if (item.user && typeof item.user.username === 'string') {
    const trimmed = item.user.username.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

export function buildTatoebaUrl(query: string, limit = DEFAULT_LIMIT, baseUrl = TATOEBA_API_URL): string {
  const url = new URL(baseUrl);
  url.searchParams.set('q', sanitizeQuery(query));
  url.searchParams.set('lang', 'jpn');
  url.searchParams.set('trans:lang', 'vie');
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('showtrans', 'matching');
  url.searchParams.set('is_unapproved', 'no');
  url.searchParams.set('trans:is_unapproved', 'no');
  url.searchParams.set('limit', String(limit));
  return url.toString();
}

function extractTranslations(raw: unknown): RawTatoebaSentence[] {
  if (!Array.isArray(raw)) return [];
  const list: RawTatoebaSentence[] = [];
  for (const item of raw) {
    if (Array.isArray(item)) {
      for (const sub of item) {
        if (sub && typeof sub === 'object') list.push(sub as RawTatoebaSentence);
      }
    } else if (item && typeof item === 'object') {
      list.push(item as RawTatoebaSentence);
    }
  }
  return list;
}

export function parseTatoebaResponse(raw: unknown, limit = DEFAULT_LIMIT): TatoebaExample[] {
  if (!raw || typeof raw !== 'object') return [];
  const container = raw as { data?: unknown };
  const items = Array.isArray(container.data) ? container.data : (Array.isArray(raw) ? raw : []);
  const examples: TatoebaExample[] = [];

  for (const item of items as RawTatoebaSentence[]) {
    if (examples.length >= limit) break;
    const jaText = typeof item.text === 'string' ? item.text.trim() : '';
    const jaId = typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10);
    if (!jaText || Number.isNaN(jaId)) continue;

    const translations = extractTranslations(item.translations);
    const vie = translations.find((t) =>
      (t.lang === 'vie' || t.lang === 'vi') && typeof t.text === 'string' && t.text.trim().length > 0
    );
    if (!vie || typeof vie.text !== 'string') continue;

    const viId = typeof vie.id === 'number' ? vie.id : parseInt(String(vie.id), 10);
    if (Number.isNaN(viId)) continue;

    examples.push({
      id: `tatoeba-${jaId}-${viId}`,
      sentenceId: jaId,
      translationId: viId,
      textJa: jaText,
      textVi: vie.text.trim(),
      authorJa: extractAuthor(item),
      authorVi: extractAuthor(vie),
      licenseJa: parseLicense(item.license),
      licenseVi: parseLicense(vie.license),
      source: 'Tatoeba',
      url: `https://tatoeba.org/sentences/show/${jaId}`,
    });
  }

  // ponytail: first matching translation picked per Japanese sentence; upgrade if UI supports multi-variant selection
  return examples;
}

export async function fetchTatoebaExamples(
  query: string,
  options: { limit?: number; timeoutMs?: number; baseUrl?: string } = {}
): Promise<TatoebaExample[]> {
  const normalized = normalizeRawQuery(query);
  if (!normalized || normalized.length > MAX_QUERY_LENGTH) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = buildTatoebaUrl(normalized, limit, options.baseUrl);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'YomuJi/1.0 (Japanese-Vietnamese Learning App)',
    },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Tatoeba API responded with status ${response.status}`);
  }

  const json: unknown = await response.json();
  return parseTatoebaResponse(json, limit);
}
