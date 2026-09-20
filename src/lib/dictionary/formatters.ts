import type {
  DictionarySearchResult,
  KanjiRecord,
  SearchMatchType,
  TermRecord,
} from '@/types/dictionary';

export type TermMatch = {
  matchType: DictionarySearchResult['matchType'];
  bonus: number;
};

const POS_LABELS: Record<string, string> = {
  adj: 'Tính từ',
  'adj-f': 'Tính từ',
  'adj-i': 'Tính từ i',
  'adj-ix': 'Tính từ i',
  'adj-na': 'Tính từ na',
  'adj-nari': 'Tính từ na',
  'adj-no': 'Tính từ bổ nghĩa danh từ',
  'adj-pn': 'Tính từ bổ nghĩa đại từ',
  'adj-t': 'Tính từ',
  adv: 'Trạng từ',
  'adv-to': 'Trạng từ',
  aux: 'Trợ từ',
  'aux-adj': 'Trợ động từ tính từ',
  'aux-v': 'Trợ động từ',
  conj: 'Liên từ',
  cop: 'Động từ liên kết',
  ctr: 'Từ chỉ đơn vị',
  exp: 'Cụm từ',
  int: 'Thán từ',
  n: 'Danh từ',
  'n-adv': 'Danh từ/trạng từ',
  'n-pr': 'Danh từ riêng',
  'n-pref': 'Tiền tố danh từ',
  'n-suf': 'Hậu tố danh từ',
  'n-t': 'Danh từ chỉ thời gian',
  num: 'Số từ',
  pn: 'Đại từ',
  pref: 'Tiền tố',
  prt: 'Trợ từ',
  suf: 'Hậu tố',
  v: 'Động từ',
  v1: 'Động từ ichidan',
  'v1-s': 'Động từ ichidan',
  v2: 'Động từ nhóm 2',
  v4: 'Động từ nhóm 4',
  v5: 'Động từ godan',
  v5aru: 'Động từ godan',
  v5b: 'Động từ godan',
  v5g: 'Động từ godan',
  v5k: 'Động từ godan',
  'v5k-s': 'Động từ godan',
  v5m: 'Động từ godan',
  v5n: 'Động từ godan',
  v5r: 'Động từ godan',
  'v5r-i': 'Động từ godan',
  v5s: 'Động từ godan',
  v5t: 'Động từ godan',
  v5u: 'Động từ godan',
  'v5u-s': 'Động từ godan',
  vk: 'Động từ kuru',
  vn: 'Động từ đặc biệt',
  vs: 'Động từ suru',
  'vs-c': 'Động từ suru',
  'vs-i': 'Động từ suru',
  'vs-s': 'Động từ suru',
  vsd: 'Động từ suru',
  vi: 'Nội động từ',
  vti: 'Ngoại động từ',
};

const MATCH_LABELS: Record<SearchMatchType, string> = {
  'exact-surface': 'Khớp chính xác',
  'exact-reading': 'Khớp cách đọc',
  'exact-romaji': 'Khớp romaji',
  'exact-meaning': 'Khớp nghĩa',
  prefix: 'Bắt đầu bằng',
  partial: 'Kết quả liên quan',
};

export function normalizeQuery(value: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .replace(/[\s\-_.,!?]/g, '');
}

function hasUnmatchedClosingDelimiter(value: string) {
  return (value.match(/\)/g)?.length || 0) > (value.match(/\(/g)?.length || 0)
    || (value.match(/\]/g)?.length || 0) > (value.match(/\[/g)?.length || 0)
    || (value.match(/}/g)?.length || 0) > (value.match(/{/g)?.length || 0);
}

export function normalizeDisplayString(value: unknown): string {
  if (typeof value !== 'string') return '';
  let normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized === '[object Object]') return '';

  while (hasUnmatchedClosingDelimiter(normalized) && /[)\]}]$/.test(normalized)) {
    normalized = normalized.slice(0, -1).trim();
  }
  return normalized;
}

export function normalizeDisplayList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(normalizeDisplayString).filter(Boolean)));
}

function normalizeRomaji(value: unknown): string {
  const normalized = normalizeDisplayString(value);
  return /[぀-ヿ㐀-鿿]/.test(normalized) ? '' : normalized;
}

export function normalizeTermRecord(term: TermRecord): TermRecord {
  return {
    ...term,
    id: normalizeDisplayString(term.id),
    surface: normalizeDisplayString(term.surface),
    reading: normalizeDisplayString(term.reading),
    romaji: normalizeRomaji(term.romaji),
    hanVietStr: normalizeDisplayString(term.hanVietStr) || undefined,
    meaningsVi: normalizeDisplayList(term.meaningsVi),
    glossesRaw: normalizeDisplayList(term.glossesRaw),
    partOfSpeech: normalizeDisplayList(term.partOfSpeech),
    tags: normalizeDisplayList(term.tags),
    kanji: normalizeDisplayList(term.kanji),
    searchAliases: normalizeDisplayList(term.searchAliases),
    kanjiReadings: Array.isArray(term.kanjiReadings)
      ? term.kanjiReadings
        .map((reading) => ({
          literal: normalizeDisplayString(reading.literal),
          hanViet: normalizeDisplayList(reading.hanViet),
        }))
        .filter((reading) => reading.literal)
      : [],
    examples: Array.isArray(term.examples)
      ? term.examples.map((example) => ({
        ...example,
        textJa: normalizeDisplayString(example.textJa),
        textVi: normalizeDisplayString(example.textVi),
        highlight: normalizeDisplayString(example.highlight) || undefined,
      }))
      : [],
    related: Array.isArray(term.related)
      ? term.related
        .map((related) => ({ ...related, label: normalizeDisplayString(related.label) }))
        .filter((related) => related.label)
      : [],
  };
}

export function normalizeKanjiRecord(kanji: KanjiRecord): KanjiRecord {
  return {
    ...kanji,
    literal: normalizeDisplayString(kanji.literal),
    onReadings: normalizeDisplayList(kanji.onReadings),
    kunReadings: normalizeDisplayList(kanji.kunReadings),
    hanViet: normalizeDisplayList(kanji.hanViet),
    meanings: normalizeDisplayList(kanji.meanings),
    meaningsRaw: normalizeDisplayList(kanji.meaningsRaw),
    radical: normalizeDisplayString(kanji.radical) || undefined,
    penStrokes: normalizeDisplayString(kanji.penStrokes) || undefined,
    tags: normalizeDisplayList(kanji.tags),
    components: normalizeDisplayList(kanji.components),
  };
}

export function formatPartOfSpeech(code: string): string {
  const normalized = normalizeDisplayString(code).toLowerCase();
  if (!normalized) return '';
  if (POS_LABELS[normalized]) return POS_LABELS[normalized];
  if (/^v5/.test(normalized)) return 'Động từ godan';
  if (/^v[1-4]/.test(normalized)) return 'Động từ';
  if (normalized.startsWith('adj')) return 'Tính từ';
  if (normalized.startsWith('n-') || normalized === 'n') return 'Danh từ';
  return 'Khác';
}

export function formatMatchType(matchType: DictionarySearchResult['matchType']): string {
  return MATCH_LABELS[matchType] || MATCH_LABELS.partial;
}

export function classifyTermMatch(
  term: {
    surface: string;
    reading: string;
    romaji: string;
    meaningsVi?: string[];
    meaningsPreview?: string[];
    searchAliases?: string[];
    tokens?: string[];
  },
  query: string,
): TermMatch {
  const normalized = normalizeQuery(query);
  const surface = normalizeQuery(term.surface);
  const reading = normalizeQuery(term.reading);
  const romaji = normalizeQuery(term.romaji);
  const rawMeanings = term.meaningsVi || term.meaningsPreview || [];
  const meanings = normalizeDisplayList(rawMeanings).map(normalizeQuery);
  const rawAliases = [...(term.searchAliases || []), ...(term.tokens || [])];
  const aliases = normalizeDisplayList(rawAliases).map(normalizeQuery);

  if (!normalized) return { matchType: 'partial', bonus: 0 };
  if (surface === normalized) return { matchType: 'exact-surface', bonus: 20000 };
  if (reading === normalized) return { matchType: 'exact-reading', bonus: 15000 };
  if (romaji === normalized) return { matchType: 'exact-romaji', bonus: 12000 };
  if (meanings.some((meaning) => meaning === normalized)) return { matchType: 'exact-meaning', bonus: 10000 };
  if (surface.startsWith(normalized) || reading.startsWith(normalized) || romaji.startsWith(normalized)) {
    return { matchType: 'prefix', bonus: 8000 };
  }
  if (meanings.some((meaning) => meaning.includes(normalized)) || aliases.some((alias) => alias.includes(normalized))) {
    return { matchType: 'partial', bonus: 2000 };
  }
  return { matchType: 'partial', bonus: 0 };
}

export function formatKanjiMatchType(matchType: string): string {
  if (matchType === 'exact-kanji') return 'Khớp chính xác';
  if (matchType === 'han-viet') return 'Khớp Hán Việt';
  return formatMatchType(matchType as DictionarySearchResult['matchType']);
}

export function normalizeSearchResult(result: DictionarySearchResult): DictionarySearchResult {
  return { ...result, term: normalizeTermRecord(result.term) };
}

export function normalizeKanjiSearchResult<T extends { kanji: KanjiRecord; score: number; matchType: any }>(result: T): T {
  return { ...result, kanji: normalizeKanjiRecord(result.kanji) };
}

export { POS_LABELS };

// Keep the classifier's return type useful to callers that need to exclude non-matches.
export function isTermMatch(match: TermMatch): boolean {
  return match.bonus > 0;
}
