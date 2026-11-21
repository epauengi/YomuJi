#!/usr/bin/env node
/**
 * Additive Turso sync for grammar_points + grammar_points_fts.
 * Does not touch terms or kanjis tables.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-turso-grammar.cjs --dry-run
 *   node --env-file=.env.local scripts/sync-turso-grammar.cjs --apply
 */

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const DATA_PATH = path.resolve(process.cwd(), 'public/dict/meta/grammar-points.json');
const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 100;

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Missing ${DATA_PATH}. Run scripts/build-grammar-data.cjs first.`);
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  if (!Array.isArray(items) || items.length === 0) {
    console.error('grammar-points.json is empty or invalid.');
    process.exit(1);
  }

  const byLevel = items.reduce((acc, item) => {
    acc[item.level] = (acc[item.level] || 0) + 1;
    return acc;
  }, {});
  console.log(`Validated ${items.length} grammar points:`, byLevel);

  if (!APPLY) {
    console.log('DRY RUN complete. Pass --apply to sync into Turso.');
    return;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error('TURSO_DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS grammar_points (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      pattern TEXT NOT NULL,
      reading TEXT NOT NULL DEFAULT '',
      romaji TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL,
      meaning_vi TEXT NOT NULL,
      meaning_en TEXT NOT NULL DEFAULT '',
      formation TEXT NOT NULL DEFAULT '',
      nuance_vi TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      examples TEXT NOT NULL DEFAULT '[]',
      match_patterns TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await client.execute(
    'CREATE INDEX IF NOT EXISTS idx_grammar_points_level ON grammar_points(level, sort_order)'
  );
  await client.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS grammar_points_fts USING fts5(
      id UNINDEXED,
      pattern,
      reading,
      romaji,
      meaning_vi,
      meaning_en,
      formation,
      nuance_vi,
      tags,
      tokenize='unicode61 remove_diacritics 2'
    )
  `);

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    await client.batch(
      chunk.map((g, idx) => ({
        sql: `INSERT OR REPLACE INTO grammar_points (
          id, slug, pattern, reading, romaji, level,
          meaning_vi, meaning_en, formation, nuance_vi,
          tags, examples, match_patterns, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          g.id,
          g.slug || g.id,
          g.pattern,
          g.reading || '',
          g.romaji || '',
          g.level,
          g.meaningVi || g.meaningEn || '',
          g.meaningEn || '',
          g.formation || '',
          g.nuanceVi || '',
          JSON.stringify(g.tags || []),
          JSON.stringify(g.examples || []),
          JSON.stringify(g.matchPatterns || []),
          Number(g.order || i + idx + 1),
        ],
      })),
      'write'
    );
    console.log(`Synced ${Math.min(i + chunk.length, items.length)}/${items.length} grammar_points...`);
  }

  // Rebuild FTS index cleanly from grammar_points (fold Vietnamese đ/Đ -> d/D for accentless FTS queries)
  await client.execute('DELETE FROM grammar_points_fts');
  await client.execute(`
    INSERT INTO grammar_points_fts (id, pattern, reading, romaji, meaning_vi, meaning_en, formation, nuance_vi, tags)
    SELECT
      id,
      pattern,
      reading,
      romaji,
      REPLACE(REPLACE(meaning_vi, 'đ', 'd'), 'Đ', 'D'),
      meaning_en,
      formation,
      REPLACE(REPLACE(nuance_vi, 'đ', 'd'), 'Đ', 'D'),
      tags
    FROM grammar_points
  `);

  const countRes = await client.execute('SELECT COUNT(*) AS count FROM grammar_points');
  const ftsRes = await client.execute('SELECT COUNT(*) AS count FROM grammar_points_fts');
  console.log(
    `PASS: grammar_points has ${countRes.rows[0]?.count} rows; grammar_points_fts has ${ftsRes.rows[0]?.count} rows.`
  );
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
