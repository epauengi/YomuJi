import { createClient, type Client } from '@libsql/client';
import type { TermRecord, KanjiRecord, DictionarySearchResult, KanjiDictionarySearchResult } from '@/types/dictionary';
import type { DictionaryRepository, SearchTermsInput, SearchTermsResult, SearchKanjiInput, SearchKanjiResult } from './types';

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return fallback;
}

function rowToTerm(row: any): TermRecord {
  return {
    id: String(row.id),
    sequence: Number(row.sequence || 0),
    surface: String(row.surface || ''),
    reading: String(row.reading || ''),
    romaji: String(row.romaji || ''),
    meaningsVi: parseJson<string[]>(row.meanings_vi, []),
    glossesRaw: parseJson<string[]>(row.glosses_raw, []),
    partOfSpeech: parseJson<string[]>(row.part_of_speech, []),
    tags: parseJson<string[]>(row.tags, []),
    score: Number(row.score || 0),
    isCommon: Boolean(row.is_common),
    kanji: parseJson<string[]>(row.kanji, []),
    kanjiReadings: parseJson<any[]>(row.kanji_readings, []),
    examples: [],
    related: [],
    searchAliases: parseJson<string[]>(row.search_aliases, []),
    source: { jmdict: true },
  };
}

function rowToKanji(row: any): KanjiRecord {
  return {
    literal: String(row.literal),
    onReadings: parseJson<string[]>(row.on_readings, []),
    kunReadings: parseJson<string[]>(row.kun_readings, []),
    hanViet: parseJson<string[]>(row.han_viet, []),
    meanings: parseJson<string[]>(row.meanings, []),
    meaningsRaw: parseJson<string[]>(row.meanings_raw, []),
    radical: row.radical ? String(row.radical) : undefined,
    penStrokes: row.pen_strokes ? String(row.pen_strokes) : undefined,
    strokeCount: row.stroke_count ? Number(row.stroke_count) : undefined,
    jlpt: row.jlpt ? (String(row.jlpt) as any) : undefined,
    grade: row.grade ? Number(row.grade) : undefined,
    frequency: row.frequency ? Number(row.frequency) : undefined,
    unicode: row.unicode ? String(row.unicode) : undefined,
    tags: parseJson<string[]>(row.tags, []),
    components: parseJson<string[]>(row.components, []),
    strokePaths: parseJson<any[]>(row.stroke_paths, []),
  };
}

const TERM_COLS = `id, sequence, surface, reading, romaji, meanings_vi, glosses_raw,
  part_of_speech, tags, score, is_common, kanji, kanji_readings, search_aliases`;

const KANJI_COLS = `literal, on_readings, kun_readings, han_viet, meanings, meanings_raw,
  radical, pen_strokes, stroke_count, jlpt, grade, frequency, unicode,
  tags, components, stroke_paths`;

export class TursoDictionaryRepository implements DictionaryRepository {
  private client: Client;

  constructor(customClient?: Client) {
    if (customClient) {
      this.client = customClient;
      return;
    }
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('TURSO_DATABASE_URL is not set.');
    this.client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }

  async searchTerms(input: SearchTermsInput): Promise<SearchTermsResult> {
    const q = input.query.trim();
    const limit = Math.min(input.limit || 50, 100);
    if (!q) return { terms: [] };

    const normalizedQ = q.toLowerCase();
    const res = await this.client.execute({
      sql: `
        SELECT ${TERM_COLS} FROM terms
        WHERE surface = ? OR reading = ? OR romaji = ?
           OR surface LIKE ? || '%' OR reading LIKE ? || '%' OR romaji LIKE ? || '%'
           OR meanings_vi LIKE '%' || ? || '%'
           OR search_aliases LIKE '%' || ? || '%'
        ORDER BY
          CASE
            WHEN surface = ? THEN 1 WHEN reading = ? THEN 2 WHEN romaji = ? THEN 3
            WHEN surface LIKE ? || '%' THEN 4 WHEN reading LIKE ? || '%' THEN 5
            ELSE 6
          END, score DESC
        LIMIT ?`,
      args: [q, q, normalizedQ, q, q, normalizedQ, normalizedQ, normalizedQ,
             q, q, normalizedQ, q, q, limit * 2],
    });

    const seen = new Set<string>();
    const results: DictionarySearchResult[] = [];

    for (const row of res.rows) {
      const term = rowToTerm(row);
      if (seen.has(term.id)) continue;
      seen.add(term.id);

      let matchType: DictionarySearchResult['matchType'] = 'partial';
      let bonus = 2000;
      if (term.surface === q)              { bonus = 20000; matchType = 'exact-surface'; }
      else if (term.reading === q)         { bonus = 15000; matchType = 'exact-reading'; }
      else if (term.romaji === normalizedQ) { bonus = 12000; matchType = 'exact-romaji'; }
      else if (term.surface.startsWith(q) || term.reading.startsWith(q))
                                           { bonus = 8000;  matchType = 'prefix'; }

      results.push({ term, score: term.score + bonus, matchType });
      if (results.length >= limit) break;
    }

    return { terms: results.sort((a, b) => b.score - a.score) };
  }

  async searchKanji(input: SearchKanjiInput): Promise<SearchKanjiResult> {
    const q = input.query.trim();
    const limit = Math.min(input.limit || 8, 50);
    if (!q) return { kanji: [] };

    const res = await this.client.execute({
      sql: `
        SELECT ${KANJI_COLS} FROM kanjis
        WHERE literal = ? OR han_viet LIKE '%' || ? || '%'
           OR on_readings LIKE '%' || ? || '%' OR kun_readings LIKE '%' || ? || '%'
        ORDER BY CASE WHEN literal = ? THEN 1 ELSE 2 END, frequency ASC
        LIMIT ?`,
      args: [q, q.toUpperCase(), q, q, q, limit],
    });

    return {
      kanji: res.rows.map((row) => ({
        kanji: rowToKanji(row),
        score: String(row.literal) === q ? 20000 : 10000,
        matchType: (String(row.literal) === q ? 'exact-kanji' : 'han-viet') as any,
      })),
    };
  }

  async getTermByIdOrSlug(slug: string): Promise<TermRecord | null> {
    const decoded = decodeURIComponent(slug).trim();
    if (!decoded) return null;

    const res = await this.client.execute({
      sql: `SELECT ${TERM_COLS} FROM terms WHERE id = ? OR surface = ? OR reading = ? LIMIT 1`,
      args: [decoded, decoded, decoded],
    });
    if (res.rows.length === 0) return null;

    const term = rowToTerm(res.rows[0]);
    const kanjiReadings = term.kanjiReadings || [];
    const hvParts = kanjiReadings.map((r: any) => r.hanViet?.[0]).filter(Boolean);
    if (hvParts.length === term.kanji.length && hvParts.length > 0) {
      term.hanVietStr = hvParts.join(' ').toUpperCase();
    }
    return term;
  }

  async getKanjiByLiteral(literal: string): Promise<KanjiRecord | null> {
    const decoded = decodeURIComponent(literal).trim();
    if (!decoded) return null;

    const res = await this.client.execute({
      sql: `SELECT ${KANJI_COLS} FROM kanjis WHERE literal = ? LIMIT 1`,
      args: [decoded],
    });
    return res.rows.length === 0 ? null : rowToKanji(res.rows[0]);
  }
}
