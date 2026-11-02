// Run with: node --env-file=.env.local scripts/sync-turso-kanji-meanings.cjs [--dry-run]
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const args = process.argv.slice(2);
assert(args.every((arg) => arg === '--dry-run'), 'Usage: node scripts/sync-turso-kanji-meanings.cjs [--dry-run]');
const dryRun = args.includes('--dry-run');
const expectedVersion = '1.1.0';
const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
assert(databaseUrl && authToken, 'TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');

const dictionaryDir = path.resolve(__dirname, '../public/dict');
const manifest = JSON.parse(fs.readFileSync(path.join(dictionaryDir, 'manifest.json'), 'utf8'));
assert.equal(manifest.dataVersion, expectedVersion, 'Build and publish the current dictionary version before syncing Turso');
const records = new Map();
for (const shard of manifest.shards.filter((item) => item.type === 'kanji')) {
  assert(/^\/dict\/kanji\/[\w-]+\.json$/.test(shard.url), 'Invalid Kanji shard URL');
  const file = path.join(dictionaryDir, 'kanji', path.basename(shard.url));
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(payload.records.length, shard.recordCount, 'Unexpected shard size: ' + shard.id);
  for (const record of payload.records) {
    assert.equal(typeof record.literal, 'string');
    assert(Array.isArray(record.meanings), 'Invalid meanings for ' + record.literal);
    assert(!records.has(record.literal), 'Duplicate static Kanji: ' + record.literal);
    records.set(record.literal, record);
  }
}
assert.equal(records.size, manifest.totals.kanji, 'Incomplete Kanji shard set');

const checksum = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const client = createClient({ url: databaseUrl, authToken });

(async () => {
  const result = await client.execute('SELECT literal, meanings FROM kanjis ORDER BY literal');
  assert.equal(result.rows.length, records.size, 'Turso row count differs from static Kanji count; refusing sync');

  const updates = [];
  for (const row of result.rows) {
    const source = records.get(row.literal);
    assert(source, 'No static Kanji record for ' + row.literal);
    const current = JSON.parse(row.meanings);
    assert(Array.isArray(current), 'Invalid Turso meanings for ' + row.literal);
    if (checksum(current) !== checksum(source.meanings)) {
      updates.push({
        sql: 'UPDATE kanjis SET meanings = ? WHERE literal = ?',
        args: [JSON.stringify(source.meanings), row.literal],
      });
    }
  }

  console.log((dryRun ? 'DRY RUN' : 'Sync') + ': ' + updates.length + ' of ' + result.rows.length + ' rows need updated meanings.');
  if (dryRun || updates.length === 0) return;

  for (let index = 0; index < updates.length; index += 100) {
    await client.batch(updates.slice(index, index + 100), 'write');
  }

  const verification = await client.execute('SELECT literal, meanings FROM kanjis ORDER BY literal');
  assert.equal(verification.rows.length, records.size, 'Turso row count changed during sync');
  for (const row of verification.rows) {
    const source = records.get(row.literal);
    assert(source, 'Unexpected Turso Kanji: ' + row.literal);
    assert.equal(checksum(JSON.parse(row.meanings)), checksum(source.meanings), 'Meanings mismatch after sync: ' + row.literal);
  }
  console.log('Verified all ' + verification.rows.length + ' Turso Kanji meanings against static dictionary.');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
