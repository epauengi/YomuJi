import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import initSqlJs, { type Database } from 'sql.js';
import type { Client } from '@libsql/client';
import { TursoDictionaryRepository } from './tursoRepository';

const root = path.resolve(__dirname, '../../..');
const schema = fs.readFileSync(path.join(root, 'turso/schema.sql'), 'utf8');
const termsDdl = schema.match(/CREATE TABLE IF NOT EXISTS terms\s*\([\s\S]*?\);/i)?.[0];
const formsDdl = schema.match(/CREATE TABLE IF NOT EXISTS term_written_forms\s*\([\s\S]*?\);/i)?.[0];
const formsIndexDdl = schema.match(/CREATE INDEX IF NOT EXISTS idx_term_written_forms_form\s+ON\s+term_written_forms\s*\([^;]+;/i)?.[0];
const pitchDdl = schema.match(/CREATE TABLE IF NOT EXISTS term_pitch_accents\s*\([\s\S]*?\);/i)?.[0];
assert(termsDdl && formsDdl && formsIndexDdl && pitchDdl, 'Turso term/form/pitch DDL missing');

function fixtureClient(db: Database) {
  const queries: Array<{ sql: string; args: unknown[] }> = [];
  return {
    queries,
    async execute(input: string | { sql: string; args?: unknown[] }) {
      const sql = typeof input === 'string' ? input : input.sql;
      const args = typeof input === 'string' ? [] : input.args ?? [];
      queries.push({ sql, args });
      try {
        const statement = db.prepare(sql);
        statement.bind(args as any[]);
        const rows = [];
        while (statement.step()) rows.push(statement.getAsObject());
        statement.free();
        return { rows };
      } catch (error) {
        if (error instanceof Error && /no such table: term_written_forms/i.test(error.message)) {
          error.message = 'no such table: term_written_forms';
        }
        throw error;
      }
    },
  };
}

function addTerm(db: Database, id: string, surface: string, reading = '', score = 0) {
  db.run('INSERT INTO terms (id, surface, reading, romaji, score) VALUES (?, ?, ?, ?, ?)', [id, surface, reading, '', score]);
}

test('normal term search works before the alternate-form migration', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(termsDdl);
  addTerm(db, 'normal', '造る', 'つくる');
  const fixture = fixtureClient(db);
  const repository = new TursoDictionaryRepository(fixture as unknown as Client);
  const result = await repository.searchTerms({ query: '造る', limit: 1 });
  assert.deepEqual(result.terms.map(({ term }) => term.id), ['normal']);
  assert.match(fixture.queries.at(-1)!.sql, /LIMIT\s+\?\s*$/i);
  assert.equal(fixture.queries.at(-1)!.args.at(-1), 2);
  db.close();
});

test('alternate forms normalize, rank, deduplicate, and remain SQL-limited', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(termsDdl);
  db.run(formsDdl);
  db.run(formsIndexDdl);
  addTerm(db, 'canonical', '神', '', -10);
  addTerm(db, 'variant', 'かみ', '', 0);
  addTerm(db, 'loose', '神社', '', 100);
  db.run('INSERT INTO term_written_forms (term_id, written_form, search_key) VALUES (?, ?, ?)', ['variant', '神', '神']);
  db.run('INSERT INTO term_written_forms (term_id, written_form, search_key) VALUES (?, ?, ?)', ['variant', 'カミ', 'カミ']);

  const fixture = fixtureClient(db);
  const repository = new TursoDictionaryRepository(fixture as unknown as Client);
  const result = await repository.searchTerms({ query: '神', limit: 2 });
  assert.deepEqual(result.terms.map(({ term }) => term.id), ['canonical', 'variant']);
  assert.equal(result.terms[1].matchType, 'exact-written-form');
  assert.deepEqual(new Set(result.terms[1].term.writtenForms), new Set(['神', 'カミ']));

  assert.equal(new Set(result.terms.map(({ term }) => term.id)).size, result.terms.length);
  assert.match(fixture.queries.at(-1)!.sql, /ORDER BY[\s\S]*score DESC, sequence ASC, id ASC\s+LIMIT\s+\?/i);
  assert.equal(fixture.queries.at(-1)!.args.at(-1), 4);

  const bySurface = await repository.searchTerms({ query: 'かみ', limit: 1 });
  assert.deepEqual(new Set(bySurface.terms[0].term.writtenForms), new Set(['神', 'カミ']));
  assert.equal(bySurface.terms[0].term.surface, 'かみ');

  const normalizedForm = await repository.searchTerms({ query: '神', limit: 2 });
  assert.deepEqual(normalizedForm.terms.map(({ term }) => term.id), ['canonical', 'variant']);
  assert.equal(normalizedForm.terms[1].matchType, 'exact-written-form');

  const limited = await repository.searchTerms({ query: '神', limit: 1 });
  assert.deepEqual(limited.terms.map(({ term }) => term.id), ['canonical']);
  assert.equal(fixture.queries.at(-1)!.args.at(-1), 2);
  db.close();
});

test('pitch accents and homophones attach cleanly and rank common entries first', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(termsDdl);
  db.run(formsDdl);
  db.run(formsIndexDdl);
  db.run(pitchDdl);

  db.run(
    'INSERT INTO terms (id, sequence, surface, reading, romaji, meanings_vi, is_common, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['term-bridge', 1, '橋', 'はし', 'hashi', '["cây cầu"]', 1, 900]
  );
  db.run(
    'INSERT INTO terms (id, sequence, surface, reading, romaji, meanings_vi, is_common, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['term-chopsticks', 2, '箸', 'はし', 'hashi', '["đôi đũa"]', 1, 800]
  );
  db.run(
    'INSERT INTO terms (id, sequence, surface, reading, romaji, meanings_vi, is_common, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['term-edge', 3, '端', 'はし', 'hashi', '["mép, rìa"]', 1, 700]
  );
  db.run(
    'INSERT INTO terms (id, sequence, surface, reading, romaji, meanings_vi, is_common, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['term-rare', 4, '嘴', 'はし', 'hashi', '["mỏ chim"]', 0, 100]
  );
  db.run('INSERT INTO term_pitch_accents (term_id, pitches) VALUES (?, ?)', ['term-bridge', '[2]']);
  db.run('INSERT INTO term_pitch_accents (term_id, pitches) VALUES (?, ?)', ['term-chopsticks', '[1]']);
  db.run('INSERT INTO term_pitch_accents (term_id, pitches) VALUES (?, ?)', ['term-edge', '[0]']);

  const fixture = fixtureClient(db);
  const repository = new TursoDictionaryRepository(fixture as unknown as Client);

  const searchRes = await repository.searchTerms({ query: 'はし', limit: 10 });
  const bridgeFromSearch = searchRes.terms.find(({ term }) => term.id === 'term-bridge');
  assert.deepEqual(bridgeFromSearch?.term.pitchAccents, [2]);

  const detail = await repository.getTermByIdOrSlug('橋');
  assert.deepEqual(detail?.pitchAccents, [2]);

  const homophones = await repository.findHomophonesByReading('はし', 'term-bridge', 10);
  assert.deepEqual(homophones.map((h) => h.id), ['term-chopsticks', 'term-edge', 'term-rare']);
  assert.deepEqual(homophones[0].pitchAccents, [1]);
  assert.deepEqual(homophones[1].pitchAccents, [0]);
  assert.equal(homophones[2].pitchAccents, undefined);
  db.close();
});

test('findHomophonesByReading works gracefully before term_pitch_accents migration', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(termsDdl);
  addTerm(db, 'term-a', '雨', 'あめ', 900);
  addTerm(db, 'term-b', '飴', 'あめ', 800);

  const fixture = fixtureClient(db);
  const repository = new TursoDictionaryRepository(fixture as unknown as Client);
  const homophones = await repository.findHomophonesByReading('あめ', 'term-a', 5);
  assert.deepEqual(homophones.map((h) => h.id), ['term-b']);
  assert.equal(homophones[0].pitchAccents, undefined);
  db.close();
});
