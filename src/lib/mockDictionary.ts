'use client';

import type {
  DictionarySearchResult,
  KanjiDictionarySearchResult,
  KanjiRecord,
  TermRecord,
  JLPTLevel,
} from '@/types/dictionary';

// ── Mock Term Records (matching TermRecord shape) ──────────────────────────

const mockTerms: TermRecord[] = [
  {
    id: 'nihon',
    sequence: 1,
    surface: '日本',
    reading: 'にほん',
    romaji: 'nihon',
    kanjiReadings: [
      { literal: '日', hanViet: ['Nhật'] },
      { literal: '本', hanViet: ['Bản'] },
    ],
    meaningsVi: ['Nhật Bản', 'nước Nhật'],
    glossesRaw: ['Japan'],
    partOfSpeech: ['n'],
    tags: ['place'],
    score: 900,
    isCommon: true,
    kanji: ['日', '本'],
    examples: [
      { id: 'ex-1', termSequence: 1, textJa: '日本は美しい国です。', textVi: 'Nhật Bản là một đất nước xinh đẹp.' },
    ],
    related: [{ label: '日本語 (にほんご) - tiếng Nhật' }, { label: '日本人 (にほんじん) - người Nhật' }],
    searchAliases: ['nihon', 'にほん', 'Nhật Bản'],
    source: { jmdict: true },
  },
  {
    id: 'taberu',
    sequence: 2,
    surface: '食べる',
    reading: 'たべる',
    romaji: 'taberu',
    kanjiReadings: [{ literal: '食', hanViet: ['Thực'] }],
    meaningsVi: ['ăn', 'dùng bữa'],
    glossesRaw: ['to eat'],
    partOfSpeech: ['v1'],
    tags: [],
    score: 850,
    isCommon: true,
    kanji: ['食'],
    examples: [
      { id: 'ex-2', termSequence: 2, textJa: '朝ごはんを食べます。', textVi: 'Tôi ăn sáng.' },
    ],
    related: [{ label: '飲む (のむ) - uống' }],
    searchAliases: ['taberu', 'たべる', 'ăn'],
    source: { jmdict: true },
  },
  {
    id: 'omoshiroi',
    sequence: 3,
    surface: '面白い',
    reading: 'おもしろい',
    romaji: 'omoshiroi',
    kanjiReadings: [
      { literal: '面', hanViet: ['Diện'] },
      { literal: '白', hanViet: ['Bạch'] },
    ],
    meaningsVi: ['thú vị', 'hài hước', 'hay'],
    glossesRaw: ['interesting', 'funny'],
    partOfSpeech: ['adj-i'],
    tags: [],
    score: 800,
    isCommon: true,
    kanji: ['面', '白'],
    examples: [
      { id: 'ex-3', termSequence: 3, textJa: 'この映画は面白いです。', textVi: 'Bộ phim này thú vị.' },
    ],
    related: [{ label: 'つまらない - nhàm chán' }],
    searchAliases: ['omoshiroi', 'おもしろい', 'thú vị'],
    source: { jmdict: true },
  },
  {
    id: 'manabu',
    sequence: 4,
    surface: '学ぶ',
    reading: 'まなぶ',
    romaji: 'manabu',
    kanjiReadings: [{ literal: '学', hanViet: ['Học'] }],
    meaningsVi: ['học', 'tiếp thu', 'noi theo'],
    glossesRaw: ['to learn', 'to study'],
    partOfSpeech: ['v5b'],
    tags: [],
    score: 750,
    isCommon: true,
    kanji: ['学'],
    examples: [
      { id: 'ex-4', termSequence: 4, textJa: '日本語を学ぶ。', textVi: 'Học tiếng Nhật.' },
    ],
    related: [{ label: '勉強する (べんきょうする) - học tập' }],
    searchAliases: ['manabu', 'まなぶ', 'học'],
    source: { jmdict: true },
  },
  {
    id: 'benkyou',
    sequence: 5,
    surface: '勉強',
    reading: 'べんきょう',
    romaji: 'benkyou',
    kanjiReadings: [
      { literal: '勉', hanViet: ['Miễn'] },
      { literal: '強', hanViet: ['Cường'] },
    ],
    meaningsVi: ['học tập', 'nghiên cứu'],
    glossesRaw: ['study'],
    partOfSpeech: ['n', 'vs'],
    tags: [],
    score: 820,
    isCommon: true,
    kanji: ['勉', '強'],
    examples: [
      { id: 'ex-5', termSequence: 5, textJa: '毎日勉強しています。', textVi: 'Tôi học tập mỗi ngày.' },
    ],
    related: [{ label: '学ぶ (まなぶ) - học' }],
    searchAliases: ['benkyou', 'べんきょう', 'học tập'],
    source: { jmdict: true },
  },
  {
    id: 'nomu',
    sequence: 6,
    surface: '飲む',
    reading: 'のむ',
    romaji: 'nomu',
    kanjiReadings: [{ literal: '飲', hanViet: ['Ẩm'] }],
    meaningsVi: ['uống'],
    glossesRaw: ['to drink'],
    partOfSpeech: ['v5m'],
    tags: [],
    score: 840,
    isCommon: true,
    kanji: ['飲'],
    examples: [
      { id: 'ex-6', termSequence: 6, textJa: '水を飲みます。', textVi: 'Tôi uống nước.' },
    ],
    related: [{ label: '食べる (たべる) - ăn' }],
    searchAliases: ['nomu', 'のむ', 'uống'],
    source: { jmdict: true },
  },
  {
    id: 'kanji-word',
    sequence: 7,
    surface: '漢字',
    reading: 'かんじ',
    romaji: 'kanji',
    kanjiReadings: [
      { literal: '漢', hanViet: ['Hán'] },
      { literal: '字', hanViet: ['Tự'] },
    ],
    meaningsVi: ['chữ Hán', 'chữ Kanji'],
    glossesRaw: ['Chinese character', 'kanji'],
    partOfSpeech: ['n'],
    tags: [],
    score: 780,
    isCommon: true,
    kanji: ['漢', '字'],
    examples: [
      { id: 'ex-7', termSequence: 7, textJa: '漢字を勉強しています。', textVi: 'Tôi đang học chữ Hán.' },
    ],
    related: [{ label: 'ひらがな - hiragana' }, { label: 'カタカナ - katakana' }],
    searchAliases: ['kanji', 'かんじ', 'chữ Hán'],
    source: { jmdict: true },
  },
  {
    id: 'gakkou',
    sequence: 8,
    surface: '学校',
    reading: 'がっこう',
    romaji: 'gakkou',
    kanjiReadings: [
      { literal: '学', hanViet: ['Học'] },
      { literal: '校', hanViet: ['Hiệu'] },
    ],
    meaningsVi: ['trường học'],
    glossesRaw: ['school'],
    partOfSpeech: ['n'],
    tags: [],
    score: 810,
    isCommon: true,
    kanji: ['学', '校'],
    examples: [
      { id: 'ex-8', termSequence: 8, textJa: '学校に行きます。', textVi: 'Tôi đi học.' },
    ],
    related: [{ label: '先生 (せんせい) - giáo viên' }],
    searchAliases: ['gakkou', 'がっこう', 'trường học'],
    source: { jmdict: true },
  },
];

// ── Mock Kanji Records ─────────────────────────────────────────────────────

const mockKanjiRecords: KanjiRecord[] = [
  {
    literal: '食',
    onReadings: ['ショク', 'ジキ'],
    kunReadings: ['た.べる', 'く.う'],
    hanViet: ['Thực'],
    meanings: ['ăn', 'thức ăn', 'bữa ăn'],
    strokeCount: 9,
    jlpt: 'N4',
    grade: 2,
    frequency: 84,
    unicode: '98DF',
    tags: ['grade2'],
    components: ['人', '良'],
    strokePaths: [
      { id: 1, d: 'M 34.5 11.25 C 34.75 12.38 35.09 14.28 34.75 15.75 C 31.42 30.37 21.26 47.37 3.5 58' },
      { id: 2, d: 'M 40 12.25 C 44.73 15.38 56.51 25.69 60.5 28.75' },
      { id: 3, d: 'M 20 34.5 C 20.12 35.62 20.38 37.88 20 39.5 C 17.87 48.61 12.73 61.11 1.5 72.5' },
      { id: 4, d: 'M 21.75 34.5 C 33.44 35.88 58 36.25 74.75 35' },
    ],
  },
  {
    literal: '本',
    onReadings: ['ホン'],
    kunReadings: ['もと'],
    hanViet: ['Bản'],
    meanings: ['sách', 'gốc', 'nguồn'],
    strokeCount: 5,
    jlpt: 'N5',
    grade: 1,
    frequency: 5,
    unicode: '672C',
    tags: ['grade1'],
    components: ['木'],
    strokePaths: [
      { id: 1, d: 'M 17.5 28 C 17.75 29.12 18.09 31.02 17.75 32.5 C 14.42 47.12 4.26 64.12 -13.5 74.75' },
      { id: 2, d: 'M 18.5 28.75 C 23.23 31.88 35.01 42.19 39 45.25' },
      { id: 3, d: 'M 6.5 52.5 C 19.94 53.38 44.5 53.5 55.5 52.5' },
    ],
  },
  {
    literal: '学',
    onReadings: ['ガク'],
    kunReadings: ['まな.ぶ'],
    hanViet: ['Học'],
    meanings: ['học', 'nghiên cứu', 'khoa học'],
    strokeCount: 8,
    jlpt: 'N5',
    grade: 1,
    frequency: 63,
    unicode: '5B66',
    tags: ['grade1'],
    components: ['子'],
    strokePaths: [],
  },
  {
    literal: '日',
    onReadings: ['ニチ', 'ジツ'],
    kunReadings: ['ひ', 'か'],
    hanViet: ['Nhật'],
    meanings: ['ngày', 'mặt trời', 'Nhật Bản'],
    strokeCount: 4,
    jlpt: 'N5',
    grade: 1,
    frequency: 1,
    unicode: '65E5',
    tags: ['grade1'],
    components: [],
    strokePaths: [],
  },
  {
    literal: '漢',
    onReadings: ['カン'],
    kunReadings: [],
    hanViet: ['Hán'],
    meanings: ['Trung Quốc', 'Hán', 'nam giới'],
    strokeCount: 14,
    jlpt: 'N3',
    grade: 3,
    frequency: 156,
    unicode: '6F22',
    tags: ['grade3'],
    components: ['水', '口'],
    strokePaths: [],
  },
];

// ── Normalize helper (replaces dictionary/normalize.ts) ────────────────────

export function stripDiacritics(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeQuery(text: string) {
  return stripDiacritics(text.toLowerCase())
    .replace(/[^\w\s\u3040-\u30ff\u3400-\u9fff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

// ── useDictionary hook (always ready in FE-only mode) ──────────────────────

export function useDictionary() {
  return {
    isReady: true,
    isOfflineCapable: false,
    progress: {
      status: 'ready' as const,
      message: 'Dữ liệu demo đã sẵn sàng',
      downloadedBytes: 0,
      totalBytes: 0,
      downloadedShards: 0,
      totalShards: 0,
    },
    manifest: {
      schemaVersion: 1,
      dataVersion: 'demo-1.0',
      generatedAt: new Date().toISOString(),
      totals: {
        terms: mockTerms.length,
        kanji: mockKanjiRecords.length,
        examples: 8,
        termShards: 1,
        searchShards: 1,
        kanjiShards: 1,
      },
      shards: [],
      attribution: [],
    },
    retry: () => {},
  };
}

// ── Search functions ───────────────────────────────────────────────────────

export async function searchDictionary(query: string, limit = 50): Promise<DictionarySearchResult[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) return getPopularTerms(limit);

  const results: DictionarySearchResult[] = [];

  for (const term of mockTerms) {
    const searchable = [
      normalizeQuery(term.surface),
      normalizeQuery(term.reading),
      normalizeQuery(term.romaji),
      ...term.meaningsVi.map(normalizeQuery),
      ...term.searchAliases.map(normalizeQuery),
    ];

    const exactMatch = searchable.some((s) => s === normalized);
    const prefixMatch = searchable.some((s) => s.startsWith(normalized));
    const partialMatch = searchable.some((s) => s.includes(normalized));

    if (exactMatch) {
      results.push({ term, score: 10000 + term.score, matchType: 'exact-surface' });
    } else if (prefixMatch) {
      results.push({ term, score: 5000 + term.score, matchType: 'prefix' });
    } else if (partialMatch) {
      results.push({ term, score: 1000 + term.score, matchType: 'partial' });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getPopularTerms(limit = 12): Promise<DictionarySearchResult[]> {
  return mockTerms
    .filter((t) => t.isCommon)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((term) => ({ term, score: term.score, matchType: 'partial' as const }));
}

export async function findTerm(id: string): Promise<TermRecord | undefined> {
  return mockTerms.find((t) => t.id === id);
}

export async function findKanji(literal: string): Promise<KanjiRecord | undefined> {
  return mockKanjiRecords.find((k) => k.literal === literal);
}

export async function searchKanjiDictionary(query: string, limit = 8): Promise<KanjiDictionarySearchResult[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const results: KanjiDictionarySearchResult[] = [];

  for (const kanji of mockKanjiRecords) {
    const searchable = [
      normalizeQuery(kanji.literal),
      ...kanji.hanViet.map(normalizeQuery),
      ...kanji.onReadings.map(normalizeQuery),
      ...kanji.kunReadings.map(normalizeQuery),
      ...kanji.meanings.map(normalizeQuery),
    ];

    const exactMatch = searchable.some((s) => s === normalized);
    const partialMatch = searchable.some((s) => s.includes(normalized));

    if (exactMatch) {
      results.push({ kanji, score: 10000, matchType: 'exact-kanji' });
    } else if (partialMatch) {
      results.push({ kanji, score: 1000, matchType: 'partial' });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getKanjiByLevel(level?: JLPTLevel): Promise<KanjiRecord[]> {
  if (!level) return mockKanjiRecords;
  return mockKanjiRecords.filter((k) => k.jlpt === level);
}

export async function getCompoundsForKanji(literal: string, limit = 12): Promise<TermRecord[]> {
  return mockTerms.filter((t) => t.kanji.includes(literal)).slice(0, limit);
}
