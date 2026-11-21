// Apply additive term_pitch_accents table and backfill from public/dict/meta/pitch-accents.json.
// Usage: node --env-file=.env.local scripts/sync-turso-pitch-accents.cjs [--dry-run|--apply]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const ROOT = path.resolve(__dirname, '..');
const PITCH_FILE = path.join(ROOT, 'public/dict/meta/pitch-accents.json');

function readPitchAccentRows(root = ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/dict/manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1, 'Invalid dictionary manifest schema');
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'public/dict/meta/pitch-accents.json'), 'utf8'));
  assert(raw && typeof raw === 'object' && !Array.isArray(raw), 'Invalid pitch-accents.json');

  const rows = [];
  for (const [termId, pitches] of Object.entries(raw)) {
    assert(typeof termId === 'string' && termId.length > 0, `Invalid termId: ${termId}`);
    assert(
      Array.isArray(pitches) && pitches.length > 0 && pitches.every((n) => Number.isInteger(n) && n >= 0),
      `Invalid pitch array for ${termId}`
    );
    rows.push({ termId, pitches: JSON.stringify(pitches) });
  }
  return { manifest, rows };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function retry(fn, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); }
    catch (error) {
      if (attempt >= retries) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  assert(
    args.length === 0 || (args.length === 1 && ['--dry-run', '--apply'].includes(args[0])),
    'Usage: node --env-file=.env.local scripts/sync-turso-pitch-accents.cjs [--dry-run|--apply]'
  );
  const apply = args[0] === '--apply';
  const { manifest, rows } = readPitchAccentRows();

  if (!apply) {
    console.log(`DRY RUN: validated ${rows.length} pitch-accent rows for dictionary version ${manifest.dataVersion}; no database writes.`);
    return;
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('TURSO_DATABASE_URL is required for --apply');

  const schema = fs.readFileSync(path.join(ROOT, 'turso/schema.sql'), 'utf8');
  const tableDdl = schema.match(/CREATE TABLE IF NOT EXISTS term_pitch_accents\s*\([\s\S]*?\);/i)?.[0];
  assert(tableDdl, 'term_pitch_accents DDL missing from turso/schema.sql');

  const client = createClient({
    url,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  });

  try {
    await retry(() => client.execute(tableDdl));
    const BATCH_SIZE = 400;
    let applied = 0;
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const chunk = rows.slice(start, start + BATCH_SIZE);
      const statements = chunk.map(({ termId, pitches }) => ({
        sql: `INSERT INTO term_pitch_accents (term_id, pitches)
              SELECT id, ? FROM terms WHERE id = ?
              ON CONFLICT(term_id) DO UPDATE SET pitches = excluded.pitches`,
        args: [pitches, termId],
      }));
      await retry(() => client.batch(statements, 'write'));
      applied += chunk.length;
      if (applied % 20000 === 0 || applied === rows.length) {
        console.log(`Synced ${applied}/${rows.length} pitch-accent rows...`);
      }
    }

    const totalRes = await client.execute('SELECT COUNT(*) AS count FROM term_pitch_accents');
    console.log(`PASS: term_pitch_accents has ${totalRes.rows[0]?.count} rows in Turso.`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Turso pitch-accent sync failed:', err?.message || 'unknown error');
    process.exitCode = 1;
  });
}

module.exports = { readPitchAccentRows };
