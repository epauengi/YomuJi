// Apply the additive schema, then sync Omoha sense sidecars without replacing term/search rows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const args = process.argv.slice(2);
assert(args.every((arg) => arg === '--dry-run'), 'Usage: node --env-file=.env.local scripts/sync-turso-senses.cjs [--dry-run]');
const dryRun = args.includes('--dry-run');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/dict/manifest.json'), 'utf8'));
const version = '1.1.0';
assert.equal(manifest.dataVersion, version, 'Dictionary manifest version mismatch');
const senseDir = path.resolve(__dirname, `../public/dict/senses/${version}`);
const buckets = new Map();
for (const file of fs.readdirSync(senseDir).filter((name) => name.endsWith('.json'))) {
  const bucket = Number(path.basename(file, '.json'));
  assert(Number.isSafeInteger(bucket) && bucket >= 0, `Invalid bucket file: ${file}`);
  const payload = JSON.parse(fs.readFileSync(path.join(senseDir, file), 'utf8'));
  assert.equal(payload.schemaVersion, 1, `Invalid schema: ${file}`);
  assert.equal(payload.dataVersion, version, `Invalid version: ${file}`);
  assert(payload.records && typeof payload.records === 'object' && !Array.isArray(payload.records), `Invalid records: ${file}`);
  for (const [sequenceText, record] of Object.entries(payload.records)) {
    const sequence = Number(sequenceText);
    assert(Number.isSafeInteger(sequence) && sequence > 0, `Invalid sequence: ${sequenceText}`);
    assert.equal(Math.floor(sequence / 10000), bucket, `Wrong bucket: ${sequence}`);
    assert.equal(typeof record.id, 'string');
    assert.equal(record.id.slice(record.id.lastIndexOf('-') + 1), sequenceText, `ID/sequence mismatch: ${record.id}`);
    assert(Array.isArray(record.senses) && record.senses.length > 0, `Missing senses: ${record.id}`);
    buckets.set(sequence, { sequence, id: record.id, writtenForms: record.writtenForms ?? [], readingForms: record.readingForms ?? [], senses: record.senses });
  }
}
assert.equal(buckets.size, manifest.totals.terms, 'Sidecar term total mismatch');

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
}
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
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

(async () => {
  try {
    const schema = fs.readFileSync(path.resolve(__dirname, '../turso/schema.sql'), 'utf8');
    const statement = schema.match(/CREATE TABLE IF NOT EXISTS term_senses\s*\([\s\S]*?\);/i)?.[0];
    assert(statement, 'Additive term_senses DDL missing from turso/schema.sql');
    if (!dryRun) await retry(() => client.execute(statement));

    const tableInfo = dryRun
      ? await client.execute('PRAGMA table_info(term_senses)').catch(() => ({ rows: [] }))
      : await client.execute('PRAGMA table_info(term_senses)');
    const columns = new Set(tableInfo.rows.map((row) => row.name));
    if (!dryRun || columns.size > 0) {
      for (const column of ['term_id', 'sequence', 'data_version', 'written_forms', 'reading_forms', 'senses']) {
        assert(columns.has(column), `Missing term_senses.${column}`);
      }
    }

    const currentTerms = await client.execute('SELECT id, sequence FROM terms');
    assert.equal(currentTerms.rows.length, manifest.totals.terms, 'Turso term count differs from manifest; refusing sync');
    const termSequences = new Map(currentTerms.rows.map((row) => [String(row.id), Number(row.sequence)]));
    for (const record of buckets.values()) {
      assert.equal(termSequences.get(record.id), record.sequence, `Missing or mismatched Turso term: ${record.id}; refusing sync`);
    }
    for (const [table, expected] of [['kanjis', manifest.totals.kanji], ['terms_fts', manifest.totals.terms], ['kanjis_fts', manifest.totals.kanji]]) {
      const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      assert.equal(Number(result.rows[0].count), expected, `${table} count differs from manifest; refusing sync`);
    }

    let inserted = 0;
    const records = Array.from(buckets.values());
    for (let start = 0; start < records.length; start += 100) {
      const chunk = records.slice(start, start + 100);
      const statements = chunk.map((record) => ({
        sql: `INSERT INTO term_senses (term_id, sequence, data_version, written_forms, reading_forms, senses)
          SELECT id, ?, ?, ?, ?, ? FROM terms WHERE id = ?
          ON CONFLICT(term_id) DO UPDATE SET sequence = excluded.sequence, data_version = excluded.data_version,
            written_forms = excluded.written_forms, reading_forms = excluded.reading_forms, senses = excluded.senses`,
        args: [record.sequence, version, JSON.stringify(record.writtenForms), JSON.stringify(record.readingForms), JSON.stringify(record.senses), record.id],
      }));
      if (!dryRun) await retry(() => client.batch(statements, 'write'));
      inserted += chunk.length;
    }

    if (!dryRun) {
      const totals = await client.execute('SELECT COUNT(*) AS count, SUM(CASE WHEN data_version = ? THEN 1 ELSE 0 END) AS current FROM term_senses', [version]);
      assert.equal(Number(totals.rows[0].count), manifest.totals.terms, 'Sense row total mismatch');
      assert.equal(Number(totals.rows[0].current), manifest.totals.terms, 'Sense version mismatch');
      for (const sequence of [1408810, 1578850, 1580400]) {
        const expected = buckets.get(sequence);
        const result = await client.execute({ sql: 'SELECT term_id, sequence, data_version, senses FROM term_senses WHERE sequence = ?', args: [sequence] });
        assert.equal(result.rows.length, 1, `Missing sense row ${sequence}`);
        assert.equal(result.rows[0].term_id, expected.id);
        assert.equal(Number(result.rows[0].sequence), sequence);
        assert.equal(result.rows[0].data_version, version);
        assert.deepEqual(JSON.parse(result.rows[0].senses), expected.senses);
      }
      for (const table of ['terms', 'terms_fts', 'kanjis', 'kanjis_fts']) {
        const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
        const expected = table.startsWith('term') ? manifest.totals.terms : manifest.totals.kanji;
        assert.equal(Number(result.rows[0].count), expected, `${table} row count changed`);
      }
    }
    console.log(`${dryRun ? 'DRY RUN' : 'PASS'}: ${inserted} sense rows ${dryRun ? 'validated; no writes made' : `synced and verified at version ${version}`}.`);
  } finally {
    await client.close();
  }
})().catch((error) => {
  console.error('Turso sense sync failed:', error);
  process.exitCode = 1;
});
