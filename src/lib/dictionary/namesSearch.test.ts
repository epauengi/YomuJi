import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import initSqlJs, { type Database } from 'sql.js';
import type { Client } from '@libsql/client';
import { TursoDictionaryRepository } from './tursoRepository';
import { SupabaseDictionaryRepository } from './supabaseRepository';

const root = path.resolve(__dirname, '../../..');
const schema = fs.readFileSync(path.join(root, 'turso/schema.sql'), 'utf8');
const namesDdl = schema.match(/CREATE TABLE IF NOT EXISTS names\s*\([\s\S]*?\);/i)?.[0];
const namesNormSurfaceIdxDdl = schema.match(/CREATE INDEX IF NOT EXISTS idx_names_norm_surface\s+ON\s+names\s*\([^;]+;/i)?.[0];
const namesNormReadingIdxDdl = schema.match(/CREATE INDEX IF NOT EXISTS idx_names_norm_reading\s+ON\s+names\s*\([^;]+;/i)?.[0];
assert(namesDdl && namesNormSurfaceIdxDdl && namesNormReadingIdxDdl, 'Turso names DDL/indexes missing');

function fixtureClient(db: Database) {
  const queries: Array<{ sql: string; args: unknown[] }> = [];
  return {
    queries,
    async execute(input: string | { sql: string; args?: unknown[] }) {
      const sql = typeof input === 'string' ? input : input.sql;
      const args = typeof input === 'string' ? [] : input.args ?? [];
      queries.push({ sql, args });
      const statement = db.prepare(sql);
      statement.bind(args as any[]);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      statement.free();
      return { rows };
    },
  };
}

function addName(
  db: Database,
  surface: string,
  reading: string,
  normSurface: string,
  normReading: string,
  mask: number,
) {
  db.run(
    'INSERT INTO names (surface, reading, norm_surface, norm_reading, mask, data_version) VALUES (?, ?, ?, ?, ?, ?)',
    [surface, reading, normSurface, normReading, mask, 'test'],
  );
}

test('Turso searchNames handles missing names table gracefully without overquerying', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const fixture = fixtureClient(db);
  const repository = new TursoDictionaryRepository(fixture as unknown as Client);

  const first = await repository.searchNames({ query: '東京', limit: 10 });
  assert.deepEqual(first, { names: [], supported: false });
  assert.equal(fixture.queries.length, 1);

  const second = await repository.searchNames({ query: '佐藤', limit: 10 });
  assert.deepEqual(second, { names: [], supported: false });
  assert.equal(fixture.queries.length, 1, 'should cache missing table state and avoid re-querying');
  db.close();
});

test('Turso searchNames validates Japanese query before hitting names table', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(namesDdl);
  db.run(namesNormSurfaceIdxDdl);
  db.run(namesNormReadingIdxDdl);
  const fixture = fixtureClient(db);
  const repository = new TursoDictionaryRepository(fixture as unknown as Client);

  for (const query of ['', '   ', 'tokyo', 'hà nội', '12345', '・　']) {
    const res = await repository.searchNames({ query, limit: 10 });
    assert.deepEqual(res, { names: [], supported: true });
  }
  assert.equal(fixture.queries.length, 0, 'non-Japanese queries must not hit names');
  db.close();
});

test('Turso searchNames matches normalized exact/prefix surface & reading and decodes all category bits', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(namesDdl);
  db.run(namesNormSurfaceIdxDdl);
  db.run(namesNormReadingIdxDdl);

  addName(db, '山田太郎', 'やまだたろう', '山田太郎', 'やまだたろう', 16); // person
  addName(db, 'サトウ', 'さとう', 'さとう', 'さとう', 1); // surname
  addName(db, 'さとう', 'さとう', 'さとう', 'さとう', 1); // surname
  addName(db, '佐藤', 'さとう', '佐藤', 'さとう', 1); // surname
  addName(db, '佐藤栄作', 'さとうえいさく', '佐藤栄作', 'さとうえいさく', 16); // person
  addName(db, '新宿', 'しんじゅく', '新宿', 'しんじゅく', 32); // place
  addName(db, '新宿駅', 'しんじゅくえき', '新宿駅', 'しんじゅくえき', 64); // station
  addName(db, '春', 'はる', '春', 'はる', 2 | 4 | 8); // given, fem, masc
  addName(db, 'あ', 'あ', 'あ', 'あ', 2); // given
  addName(db, 'あい', 'あい', 'あい', 'あい', 4); // fem

  const fixture = fixtureClient(db);
  const repository = new TursoDictionaryRepository(fixture as unknown as Client);

  // Normalized space/middle-dot exact surface
  const yamada = await repository.searchNames({ query: '山田 太郎', limit: 10 });
  assert.equal(yamada.supported, true);
  assert.deepEqual(yamada.names, [
    {
      surface: '山田太郎',
      reading: 'やまだたろう',
      categories: ['person'],
      categoryLabels: ['Họ tên'],
      matchType: 'exact-surface',
    },
  ]);

  // Katakana query normalizes to hiragana and ranks exact-surface -> norm exact-surface -> exact-reading -> prefix-reading
  const sato = await repository.searchNames({ query: 'サトウ', limit: 10 });
  assert.equal(sato.supported, true);
  assert.deepEqual(
    sato.names.map((n) => [n.surface, n.matchType]),
    [
      ['サトウ', 'exact-surface'],
      ['さとう', 'exact-surface'],
      ['佐藤', 'exact-reading'],
      ['佐藤栄作', 'prefix-reading'],
    ],
  );

  // Exact shape check (no /word link fields)
  assert.deepEqual(Object.keys(sato.names[0]).sort(), [
    'categories',
    'categoryLabels',
    'matchType',
    'reading',
    'surface',
  ]);

  // Exact place before prefix station + limit respected
  const shinjuku = await repository.searchNames({ query: '新宿', limit: 1 });
  assert.equal(shinjuku.names.length, 1);
  assert.equal(shinjuku.names[0].surface, '新宿');
  assert.deepEqual(shinjuku.names[0].categories, ['place']);
  assert.deepEqual(shinjuku.names[0].categoryLabels, ['Địa danh']);

  const shinjukuAll = await repository.searchNames({ query: '新宿', limit: 10 });
  assert.deepEqual(
    shinjukuAll.names.map((n) => [n.surface, n.categories, n.categoryLabels, n.matchType]),
    [
      ['新宿', ['place'], ['Địa danh'], 'exact-surface'],
      ['新宿駅', ['station'], ['Nhà ga'], 'prefix-surface'],
    ],
  );

  // 1-char kanji allows prefix
  const kanjiPrefix = await repository.searchNames({ query: '新', limit: 10 });
  assert.deepEqual(kanjiPrefix.names.map((n) => n.surface), ['新宿', '新宿駅']);

  // 1-char kana only allows exact, not prefix
  const kanaSingle = await repository.searchNames({ query: 'あ', limit: 10 });
  assert.deepEqual(kanaSingle.names.map((n) => n.surface), ['あ']);

  // Multi-bit mask decoding
  const haru = await repository.searchNames({ query: '春', limit: 10 });
  assert.deepEqual(haru.names[0].categories, ['given', 'fem', 'masc']);
  assert.deepEqual(haru.names[0].categoryLabels, ['Tên', 'Tên nữ', 'Tên nam']);

  db.close();
});

test('Supabase searchNames indicates unsupported false', async () => {
  const repository = new SupabaseDictionaryRepository();
  const res = await repository.searchNames({ query: '東京', limit: 10 });
  assert.deepEqual(res, { names: [], supported: false });
});
