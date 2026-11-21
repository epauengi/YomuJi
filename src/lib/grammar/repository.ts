import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import {
  GRAMMAR_LEVELS,
  type GrammarExample,
  type GrammarLevel,
  type GrammarListResponse,
  type GrammarPoint,
} from '@/types/grammar';

export interface ListGrammarInput {
  q?: string;
  level?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

const GRAMMAR_COLS = `id, slug, pattern, reading, romaji, level, meaning_vi, meaning_en,
  formation, nuance_vi, tags, examples, match_patterns, sort_order`;

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function isGrammarLevel(value: string): value is GrammarLevel {
  return (GRAMMAR_LEVELS as readonly string[]).includes(value);
}

function rowToGrammarPoint(row: Record<string, unknown>): GrammarPoint {
  const rawLevel = String(row.level || 'N5').toUpperCase();
  return {
    id: String(row.id),
    slug: String(row.slug || row.id),
    pattern: String(row.pattern || ''),
    reading: String(row.reading || ''),
    romaji: String(row.romaji || ''),
    level: isGrammarLevel(rawLevel) ? rawLevel : 'N5',
    meaningVi: String(row.meaning_vi || ''),
    meaningEn: String(row.meaning_en || ''),
    formation: String(row.formation || ''),
    nuanceVi: String(row.nuance_vi || ''),
    tags: parseJson<string[]>(row.tags, []),
    examples: parseJson<GrammarExample[]>(row.examples, []),
    matchPatterns: parseJson<string[]>(row.match_patterns, []),
    order: Number(row.sort_order || 0),
  };
}

function isMissingGrammarTable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /no such table:\s*(?:main\.)?grammar_points(?:_fts)?\b/i.test(msg);
}

function emptyCounts(): Record<GrammarLevel, number> {
  return { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
}

function normalizeSearchText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function buildFtsQuery(input: string): string | null {
  const tokens = input
    .trim()
    .replace(/[đĐ]/g, 'd')
    .split(/\s+/)
    .map((t) => t.replace(/["'*^()[\]{}:;-]+/g, '').trim())
    .filter((t) => t.length >= 2 && /[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(t));
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

let cachedStaticGrammar: GrammarPoint[] | null = null;
let cachedTursoClient: Client | null | undefined;
let cachedAllGrammarForMatcher: GrammarPoint[] | null = null;

export function loadStaticGrammarPoints(): GrammarPoint[] {
  if (cachedStaticGrammar) return cachedStaticGrammar;
  const filePath = path.join(process.cwd(), 'public', 'dict', 'meta', 'grammar-points.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GrammarPoint[];
    cachedStaticGrammar = Array.isArray(raw) ? raw : [];
    return cachedStaticGrammar;
  } catch {
    return [];
  }
}

function getTursoClient(): Client | null {
  if (cachedTursoClient !== undefined) return cachedTursoClient;
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    cachedTursoClient = null;
    return null;
  }
  cachedTursoClient = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
  });
  return cachedTursoClient;
}

function filterStaticGrammar(all: GrammarPoint[], input: ListGrammarInput): GrammarListResponse {
  const qRaw = (input.q || '').trim();
  const qNorm = normalizeSearchText(qRaw);
  const levelFilter = input.level ? input.level.toUpperCase() : '';
  const tagFilter = (input.tag || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(input.limit ?? 100, 600));
  const offset = Math.max(0, input.offset ?? 0);

  const byQueryAndTag = all.filter((g) => {
    if (tagFilter && !g.tags.some((t) => t.toLowerCase() === tagFilter)) return false;
    if (!qRaw) return true;
    const jpHit =
      g.pattern.includes(qRaw) ||
      g.reading.includes(qRaw) ||
      g.formation.includes(qRaw) ||
      g.matchPatterns.some((m) => m.includes(qRaw));
    if (jpHit) return true;
    return (
      normalizeSearchText(g.romaji).includes(qNorm) ||
      normalizeSearchText(g.meaningVi).includes(qNorm) ||
      normalizeSearchText(g.meaningEn).includes(qNorm) ||
      normalizeSearchText(g.nuanceVi).includes(qNorm)
    );
  });

  const countsByLevel = emptyCounts();
  for (const item of byQueryAndTag) {
    countsByLevel[item.level]++;
  }

  const filtered =
    levelFilter && isGrammarLevel(levelFilter)
      ? byQueryAndTag.filter((g) => g.level === levelFilter)
      : byQueryAndTag;

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    countsByLevel,
  };
}

export class GrammarRepository {
  private grammarTableAvailable = true;

  constructor(private readonly client: Client | null = getTursoClient()) {}

  async list(input: ListGrammarInput = {}): Promise<GrammarListResponse> {
    if (!this.client || !this.grammarTableAvailable) {
      return filterStaticGrammar(loadStaticGrammarPoints(), input);
    }

    const q = (input.q || '').trim();
    const level = input.level ? input.level.toUpperCase() : '';
    const validLevel = isGrammarLevel(level) ? level : '';
    const tag = (input.tag || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(input.limit ?? 100, 600));
    const offset = Math.max(0, input.offset ?? 0);

    try {
      const conditions: string[] = [];
      const args: (string | number)[] = [];

      if (q) {
        const fts = buildFtsQuery(q);
        if (fts) {
          conditions.push(
            `(pattern LIKE '%' || ? || '%' OR reading LIKE '%' || ? || '%' OR romaji LIKE '%' || ? || '%' OR meaning_vi LIKE '%' || ? || '%' OR meaning_en LIKE '%' || ? || '%' OR nuance_vi LIKE '%' || ? || '%' OR id IN (SELECT id FROM grammar_points_fts WHERE grammar_points_fts MATCH ?))`
          );
          args.push(q, q, q, q, q, q, fts);
        } else {
          conditions.push(
            `(pattern LIKE '%' || ? || '%' OR reading LIKE '%' || ? || '%' OR romaji LIKE '%' || ? || '%' OR meaning_vi LIKE '%' || ? || '%' OR meaning_en LIKE '%' || ? || '%' OR nuance_vi LIKE '%' || ? || '%')`
          );
          args.push(q, q, q, q, q, q);
        }
      }

      if (tag) {
        conditions.push(`LOWER(tags) LIKE '%' || ? || '%'`);
        args.push(`"${tag}"`);
      }

      const baseWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await this.client.execute({
        sql: `SELECT level, COUNT(*) AS cnt FROM grammar_points ${baseWhere} GROUP BY level`,
        args,
      });

      const countsByLevel = emptyCounts();
      let totalAll = 0;
      for (const row of countRes.rows) {
        const lvl = String(row.level || '').toUpperCase();
        const cnt = Number(row.cnt || 0);
        if (isGrammarLevel(lvl)) {
          countsByLevel[lvl] = cnt;
          totalAll += cnt;
        }
      }

      const pageConditions = [...conditions];
      const pageArgs = [...args];
      if (validLevel) {
        pageConditions.push('level = ?');
        pageArgs.push(validLevel);
      }
      const pageWhere = pageConditions.length ? `WHERE ${pageConditions.join(' AND ')}` : '';

      const rowsRes = await this.client.execute({
        sql: `SELECT ${GRAMMAR_COLS} FROM grammar_points ${pageWhere} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
        args: [...pageArgs, limit, offset],
      });

      const total = validLevel ? countsByLevel[validLevel] : totalAll;
      return {
        items: rowsRes.rows.map((r) => rowToGrammarPoint(r as Record<string, unknown>)),
        total,
        countsByLevel,
      };
    } catch (error) {
      if (isMissingGrammarTable(error)) {
        this.grammarTableAvailable = false;
        return filterStaticGrammar(loadStaticGrammarPoints(), input);
      }
      // Graceful fallback to local static dataset on transient DB error
      return filterStaticGrammar(loadStaticGrammarPoints(), input);
    }
  }

  async getById(idOrSlug: string): Promise<GrammarPoint | null> {
    const clean = idOrSlug.trim();
    if (!clean) return null;

    if (!this.client || !this.grammarTableAvailable) {
      return loadStaticGrammarPoints().find((g) => g.id === clean || g.slug === clean) ?? null;
    }

    try {
      const res = await this.client.execute({
        sql: `SELECT ${GRAMMAR_COLS} FROM grammar_points WHERE id = ? OR slug = ? LIMIT 1`,
        args: [clean, clean],
      });
      if (res.rows.length === 0) return null;
      return rowToGrammarPoint(res.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (isMissingGrammarTable(error)) {
        this.grammarTableAvailable = false;
      }
      return loadStaticGrammarPoints().find((g) => g.id === clean || g.slug === clean) ?? null;
    }
  }

  async getAllForMatching(): Promise<GrammarPoint[]> {
    if (cachedAllGrammarForMatcher && cachedAllGrammarForMatcher.length > 0) {
      return cachedAllGrammarForMatcher;
    }
    const staticData = loadStaticGrammarPoints();
    if (staticData.length > 0) {
      cachedAllGrammarForMatcher = staticData;
      return staticData;
    }
    const { items } = await this.list({ limit: 600 });
    if (items.length > 0) {
      cachedAllGrammarForMatcher = items;
    }
    return items;
  }
}

let singletonRepo: GrammarRepository | null = null;

export function getGrammarRepository(): GrammarRepository {
  if (!singletonRepo) {
    singletonRepo = new GrammarRepository();
  }
  return singletonRepo;
}
