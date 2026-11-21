import { createClient, type Client } from '@libsql/client';
import { selectDailyOffset } from './randomTerm';
import type { TermRecord, KanjiRecord, DictionarySearchResult, KanjiDictionarySearchResult, HomophoneTerm } from '@/types/dictionary';
import {
  classifyTermMatch,
  compareTermSearchResults,
  normalizeDisplayList,
  normalizeDisplayString,
  normalizeKanjiRecord,
  normalizeTermRecord,
} from '@/lib/dictionary/formatters';
import { normalizePitchAccents } from '@/lib/pitchAccent';
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
  const writtenForms = parseJson<string[]>(row.written_forms, []);
  const pitchAccents = normalizePitchAccents(parseJson<number[]>(row.pitch_accents, []));
  return normalizeTermRecord({
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
    ...(writtenForms.length ? { writtenForms } : {}),
    ...(pitchAccents.length ? { pitchAccents } : {}),
    source: { jmdict: true },
  });
}

function rowToHomophone(row: any): HomophoneTerm {
  const pitchAccents = normalizePitchAccents(parseJson<number[]>(row.pitch_accents, []));
  return {
    id: normalizeDisplayString(String(row.id)),
    sequence: Number(row.sequence || 0),
    surface: normalizeDisplayString(String(row.surface || '')),
    reading: normalizeDisplayString(String(row.reading || '')),
    meaningsVi: normalizeDisplayList(parseJson<string[]>(row.meanings_vi, [])).slice(0, 3),
    isCommon: Boolean(row.is_common),
    ...(pitchAccents.length ? { pitchAccents } : {}),
  };
}

function rowToKanji(row: any): KanjiRecord {
  return normalizeKanjiRecord({
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
  });
}

const TERM_COLS = `id, sequence, surface, reading, romaji, meanings_vi, glosses_raw,
  part_of_speech, tags, score, is_common, kanji, kanji_readings, search_aliases`;

const KANJI_COLS = `literal, on_readings, kun_readings, han_viet, meanings, meanings_raw,
  radical, pen_strokes, stroke_count, jlpt, grade, frequency, unicode,
  tags, components, stroke_paths`;

function isMissingWrittenFormsTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table:\s*(?:main\.)?term_written_forms\b/i.test(message);
}

function isMissingPitchAccentsTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table:\s*(?:main\.)?term_pitch_accents\b/i.test(message);
}

const PITCH_SUBQUERY = `(SELECT pa.pitches FROM term_pitch_accents AS pa WHERE pa.term_id = terms.id) AS pitch_accents`;

export class TursoDictionaryRepository implements DictionaryRepository {
  private pitchTableAvailable = true;
  private writtenFormsTableAvailable = true;

  async getRandomTerm(dayKey: string): Promise<TermRecord | null> {
    const total = await this.client.execute('SELECT COUNT(*) AS count FROM terms');
    const count = Number(total.rows[0]?.count ?? 0);
    const offset = selectDailyOffset(dayKey, count);
    if (offset === null) return null;

    const selected = await this.client.execute({
      sql: `SELECT ${TERM_COLS} FROM terms ORDER BY id LIMIT 1 OFFSET ?`,
      args: [offset],
    });
    return selected.rows.length ? rowToTerm(selected.rows[0]) : null;
  }

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
    const writtenFormKey = q.normalize('NFKC');
    // Japanese queries use indexed B-tree range scans; LIKE '%...%' on meanings_vi/search_aliases forces a full table scan.
    const isJapanese = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u.test(writtenFormKey);
    const prefixEnd = `${writtenFormKey}\uffff`;
    const whereSql = isJapanese
      ? '(surface >= ? AND surface < ?) OR (reading >= ? AND reading < ?)'
      : `surface = ? OR reading = ? OR romaji = ?
             OR surface LIKE ? || '%' OR reading LIKE ? || '%' OR romaji LIKE ? || '%'
             OR meanings_vi LIKE '%' || ? || '%'
             OR search_aliases LIKE '%' || ? || '%'`;
    const whereArgs = isJapanese
      ? [writtenFormKey, prefixEnd, writtenFormKey, prefixEnd]
      : [writtenFormKey, q, normalizedQ, q, q, normalizedQ, normalizedQ, normalizedQ];
    const runSearch = async () => {
      const pitchSelect = this.pitchTableAvailable ? `,\n            ${PITCH_SUBQUERY}` : '';
      if (this.writtenFormsTableAvailable) {
        return this.client.execute({
          sql: `
          SELECT ${TERM_COLS},
            (SELECT json_group_array(wf.written_form) FROM term_written_forms AS wf
             WHERE wf.term_id = terms.id) AS written_forms${pitchSelect}
          FROM terms
          WHERE ${whereSql}
             OR id IN (SELECT term_id FROM term_written_forms WHERE search_key = ?)
          ORDER BY
            CASE
              WHEN surface = ? THEN 1
              WHEN EXISTS (SELECT 1 FROM term_written_forms AS wf
                           WHERE wf.term_id = terms.id AND wf.search_key = ?) THEN 2
              WHEN reading = ? THEN 3 WHEN romaji = ? THEN 4
              WHEN surface LIKE ? || '%' THEN 5 WHEN reading LIKE ? || '%' THEN 6
              ELSE 7
            END, score DESC, sequence ASC, id ASC
          LIMIT ?`,
          args: [...whereArgs, writtenFormKey,
                 writtenFormKey, writtenFormKey, q, normalizedQ, writtenFormKey, writtenFormKey, limit * 2],
        });
      }
      return this.client.execute({
        sql: `
          SELECT ${TERM_COLS}${pitchSelect} FROM terms
          WHERE ${whereSql}
          ORDER BY
            CASE
              WHEN surface = ? THEN 1 WHEN reading = ? THEN 2 WHEN romaji = ? THEN 3
              WHEN surface LIKE ? || '%' THEN 4 WHEN reading LIKE ? || '%' THEN 5
              ELSE 6
            END, score DESC, sequence ASC, id ASC
          LIMIT ?`,
        args: [...whereArgs,
               writtenFormKey, q, normalizedQ, writtenFormKey, writtenFormKey, limit * 2],
      });
    };

    let res;
    for (;;) {
      try {
        res = await runSearch();
        break;
      } catch (error) {
        if (this.pitchTableAvailable && isMissingPitchAccentsTable(error)) {
          this.pitchTableAvailable = false;
          continue;
        }
        if (this.writtenFormsTableAvailable && isMissingWrittenFormsTable(error)) {
          this.writtenFormsTableAvailable = false;
          continue;
        }
        throw error;
      }
    }

    const seen = new Set<string>();
    const results: DictionarySearchResult[] = [];

    for (const row of res.rows) {
      const term = rowToTerm(row);
      if (seen.has(term.id)) continue;
      seen.add(term.id);

      const match = classifyTermMatch(term, writtenFormKey);
      results.push({ term, score: term.score + match.bonus, matchType: match.matchType });
    }

    return { terms: results.sort(compareTermSearchResults).slice(0, limit) };
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
    const decoded = slug.trim();
    if (!decoded) return null;

    const runLookup = () => {
      const pitchSelect = this.pitchTableAvailable ? `, ${PITCH_SUBQUERY}` : '';
      return this.client.execute({
        sql: `SELECT ${TERM_COLS}${pitchSelect} FROM terms WHERE id = ? OR surface = ? OR reading = ?
        ORDER BY CASE WHEN id = ? THEN 0 WHEN surface = ? THEN 1 ELSE 2 END, score DESC, sequence ASC LIMIT 1`,
        args: [decoded, decoded, decoded, decoded, decoded],
      });
    };

    let res;
    try {
      res = await runLookup();
    } catch (error) {
      if (this.pitchTableAvailable && isMissingPitchAccentsTable(error)) {
        this.pitchTableAvailable = false;
        res = await runLookup();
      } else {
        throw error;
      }
    }
    if (res.rows.length === 0) return null;

    const term = rowToTerm(res.rows[0]);
    const kanjiReadings = term.kanjiReadings || [];
    const hvParts = kanjiReadings.map((r: any) => r.hanViet?.[0]).filter(Boolean);
    if (hvParts.length === term.kanji.length && hvParts.length > 0) {
      term.hanVietStr = hvParts.join(' ').toUpperCase();
    }
    return term;
  }

  async findHomophonesByReading(reading: string, excludeId: string, limit = 12): Promise<HomophoneTerm[]> {
    const cleanReading = reading.trim();
    if (!cleanReading) return [];
    const capped = Math.max(1, Math.min(limit, 24));

    const runQuery = () => {
      if (this.pitchTableAvailable) {
        return this.client.execute({
          sql: `SELECT t.id, t.sequence, t.surface, t.reading, t.meanings_vi, t.is_common,
                  pa.pitches AS pitch_accents
                FROM terms AS t
                LEFT JOIN term_pitch_accents AS pa ON pa.term_id = t.id
                WHERE t.reading = ? AND t.id != ?
                ORDER BY t.is_common DESC,
                  CASE WHEN pa.pitches IS NOT NULL THEN 0 ELSE 1 END,
                  t.score DESC, t.sequence ASC
                LIMIT ?`,
          args: [cleanReading, excludeId, capped],
        });
      }
      return this.client.execute({
        sql: `SELECT id, sequence, surface, reading, meanings_vi, is_common
              FROM terms
              WHERE reading = ? AND id != ?
              ORDER BY is_common DESC, score DESC, sequence ASC
              LIMIT ?`,
        args: [cleanReading, excludeId, capped],
      });
    };

    let res;
    try {
      res = await runQuery();
    } catch (error) {
      if (this.pitchTableAvailable && isMissingPitchAccentsTable(error)) {
        this.pitchTableAvailable = false;
        res = await runQuery();
      } else {
        throw error;
      }
    }
    return res.rows.map(rowToHomophone);
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
