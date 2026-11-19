// Backfill alternate spellings from the committed static term shards.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const ROOT = path.resolve(__dirname, '..');

function readWrittenForms(root = ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/dict/manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1, 'Invalid dictionary manifest schema');
  assert(Array.isArray(manifest.shards), 'Dictionary manifest has no shards');

  const termShards = manifest.shards.filter((shard) => shard.type === 'terms');
  assert.equal(termShards.length, manifest.totals.termShards, 'Term shard count differs from manifest');
  const termIds = new Set();
  const rows = [];

  for (const shard of termShards) {
    const filename = path.basename(shard.url || '');
    assert(/^shard-\d{4}\.json$/.test(filename), `Invalid term shard path: ${shard.url}`);
    const file = path.join(root, 'public/dict/terms', filename);
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(payload.schemaVersion, 1, `Invalid schema: ${filename}`);
    assert.equal(payload.dataVersion, manifest.dataVersion, `Dictionary version mismatch: ${filename}`);
    assert(Array.isArray(payload.records), `Invalid records: ${filename}`);
    assert.equal(payload.records.length, shard.recordCount, `Record count mismatch: ${filename}`);

    for (const record of payload.records) {
      assert(typeof record.id === 'string' && record.id.length > 0, `Invalid term ID in ${filename}`);
      assert(!termIds.has(record.id), `Duplicate term ID: ${record.id}`);
      termIds.add(record.id);
      const forms = record.writtenForms ?? [];
      assert(Array.isArray(forms) && forms.every((form) => typeof form === 'string'), `Invalid written forms: ${record.id}`);
      const writtenKeys = new Set();
      for (const writtenForm of forms.map((form) => form.trim()).filter((form) => form && form !== record.surface)) {
        const searchKey = writtenForm.normalize('NFKC');
        if (writtenKeys.has(searchKey)) continue;
        writtenKeys.add(searchKey);
        rows.push({ termId: record.id, writtenForm, searchKey });
      }
    }
  }

  assert.equal(termIds.size, manifest.totals.terms, 'Term record total differs from manifest');
  return { manifest, termIds, rows };
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 1 && ['--dry-run', '--apply'].includes(args[0])),
    'Usage: node scripts/sync-turso-written-forms.cjs [--dry-run|--apply]');
  const apply = args[0] === '--apply';
  const { manifest, termIds, rows } = readWrittenForms();

  if (!apply) {
    console.log(`DRY RUN: validated ${termIds.size} terms and ${rows.length} alternate forms; no database access or writes.`);
    return;
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('TURSO_DATABASE_URL is required for --apply');

  const schema = fs.readFileSync(path.join(ROOT, 'turso/schema.sql'), 'utf8');
  const tableDdl = schema.match(/CREATE TABLE IF NOT EXISTS term_written_forms\s*\([\s\S]*?\);/i)?.[0];
  const indexDdl = schema.match(/CREATE INDEX IF NOT EXISTS idx_term_written_forms_form\s+ON\s+term_written_forms\s*\([^;]+;/i)?.[0];
  assert(tableDdl && indexDdl, 'Written-form table and index DDL missing from turso/schema.sql');

  const client = createClient({ url, ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}) });
  try {
    await client.execute(tableDdl);
    await client.execute(indexDdl);
    const existing = await client.execute('SELECT id FROM terms');
    assert.equal(existing.rows.length, manifest.totals.terms, 'Turso term count differs from manifest');
    const existingIds = new Set(existing.rows.map((row) => String(row.id)));
    assert([...termIds].every((termId) => existingIds.has(termId)), 'Turso term IDs differ from static shards');

    for (let start = 0; start < rows.length; start += 100) {
      const statements = rows.slice(start, start + 100).map(({ termId, writtenForm, searchKey }) => ({
        sql: 'INSERT OR IGNORE INTO term_written_forms (term_id, written_form, search_key) VALUES (?, ?, ?)',
        args: [termId, writtenForm, searchKey],
      }));
      await client.batch(statements, 'write');
    }
    console.log(`Applied ${rows.length} alternate forms from dictionary version ${manifest.dataVersion}.`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error('Turso written-form sync failed. Details suppressed to avoid exposing database credentials or errors.');
    process.exitCode = 1;
  });
}

module.exports = { readWrittenForms };
