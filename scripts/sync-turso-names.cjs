'use strict';

// Additive Turso sync for JMnedict proper names from public/names/r-*.tsv.gz.
// Defaults to --dry-run; requires explicit --apply before any database access or writes.
// Usage:
//   node scripts/sync-turso-names.cjs [--dry-run] [--batch-size=500]
//   node scripts/sync-turso-names.cjs --apply [--batch-size=500] [--force]

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { createClient } = require('@libsql/client');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BATCH_SIZE = 500;
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 1000;
const MAX_ROWS_PER_INSERT = 100; // 6 cols * 100 = 600 bind params (under SQLite 999 legacy limit)
const DELETE_CHUNK_SIZE = 1000;
const ALLOWED_PROTOCOLS = new Set(['libsql:', 'https:', 'http:', 'ws:', 'wss:', 'file:']);

const USAGE =
  'Usage: node scripts/sync-turso-names.cjs [--dry-run | --apply] [--batch-size=500] [--force]';

function normalizeNameKey(value) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s・･]+/g, '')
    .replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseArgs(argv) {
  let dryRunFlag = false;
  let applyFlag = false;
  let force = false;
  let batchSize = DEFAULT_BATCH_SIZE;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRunFlag = true;
    } else if (arg === '--apply') {
      applyFlag = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--batch-size' && argv[i + 1]) {
      batchSize = Number(argv[++i]);
    } else if (arg.startsWith('--batch-size=')) {
      batchSize = Number(arg.slice('--batch-size='.length));
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}. ${USAGE}`);
    }
  }

  if (dryRunFlag && applyFlag) {
    throw new Error(`Cannot combine --dry-run and --apply. ${USAGE}`);
  }
  if (!Number.isInteger(batchSize) || batchSize < MIN_BATCH_SIZE || batchSize > MAX_BATCH_SIZE) {
    throw new Error(
      `Invalid --batch-size (${batchSize}); expected integer in [${MIN_BATCH_SIZE}, ${MAX_BATCH_SIZE}].`,
    );
  }

  return { apply: applyFlag, force, batchSize };
}

function readNameShards(root = ROOT) {
  const namesDir = path.join(root, 'public', 'names');
  const manifestPath = path.join(namesDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), `Missing manifest: ${manifestPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.schemaVersion, 1, 'Unsupported public/names manifest schemaVersion');
  assert(
    typeof manifest.dataVersion === 'string' && manifest.dataVersion.length > 0,
    'Missing public/names manifest dataVersion',
  );
  assert(Number.isInteger(manifest.shardCount) && manifest.shardCount > 0, 'Invalid shardCount');
  assert(Number.isInteger(manifest.totalEntries) && manifest.totalEntries > 0, 'Invalid totalEntries');
  assert(Array.isArray(manifest.shards), 'Manifest shards must be an array');

  const rShards = manifest.shards
    .filter((shard) => shard && shard.kind === 'r')
    .sort((a, b) => a.bucket - b.bucket);
  assert.equal(rShards.length, manifest.shardCount, 'r-* shard count differs from manifest.shardCount');

  const seenBuckets = new Set();
  const seenPairs = new Set();
  const rows = [];

  for (const shard of rShards) {
    assert(typeof shard.id === 'string' && /^r-\d{2}$/.test(shard.id), `Invalid shard id: ${shard.id}`);
    assert(Number.isInteger(shard.bucket) && shard.bucket >= 0 && shard.bucket < manifest.shardCount);
    assert(!seenBuckets.has(shard.bucket), `Duplicate r-shard bucket: ${shard.bucket}`);
    seenBuckets.add(shard.bucket);

    assert(
      typeof shard.url === 'string' && /^\/names\/shards\/r-\d{2}\.tsv\.gz$/.test(shard.url),
      `Invalid r-shard URL: ${shard.url}`,
    );

    const filePath = path.join(root, 'public', shard.url.replace(/^\//, ''));
    assert(fs.existsSync(filePath), `Missing shard file: ${filePath}`);
    const gzBuf = fs.readFileSync(filePath);
    assert.equal(gzBuf.length, shard.bytes, `Byte size mismatch for ${shard.id}`);
    assert.equal(sha256Hex(gzBuf), shard.sha256, `SHA-256 mismatch for ${shard.id}`);

    const tsv = zlib.gunzipSync(gzBuf).toString('utf8');
    const lines = tsv.length > 0 ? tsv.split('\n') : [];
    assert.equal(lines.length, shard.entries, `Entry count mismatch in ${shard.id}`);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      assert(line.length > 0, `Empty line in ${shard.id}:${lineIdx + 1}`);
      const parts = line.split('\t');
      assert.equal(parts.length, 3, `Malformed TSV row in ${shard.id}:${lineIdx + 1}`);

      const surface = parts[0];
      const reading = parts[1] || surface;
      const mask = Number(parts[2]);

      assert(surface.length > 0 && reading.length > 0, `Empty surface/reading in ${shard.id}:${lineIdx + 1}`);
      assert(Number.isInteger(mask) && mask >= 1 && mask <= 127, `Invalid mask in ${shard.id}:${lineIdx + 1}`);

      const normSurface = normalizeNameKey(surface);
      const normReading = normalizeNameKey(reading);
      assert(normSurface.length > 0 && normReading.length > 0, `Empty normalized key in ${shard.id}:${lineIdx + 1}`);

      const pairKey = `${surface}\t${reading}`;
      assert(!seenPairs.has(pairKey), `Duplicate (surface, reading) pair in ${shard.id}: ${pairKey}`);
      seenPairs.add(pairKey);

      rows.push({ surface, reading, normSurface, normReading, mask });
    }
  }

  assert.equal(rows.length, manifest.totalEntries, 'Ingested r-* row total differs from manifest.totalEntries');
  assert.equal(seenPairs.size, manifest.totalEntries, 'Unique pair count differs from manifest.totalEntries');

  return { manifest, rShardsCount: rShards.length, rows };
}

function loadEnvLocalIfMissing(root = ROOT) {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) return;
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    if (key !== 'TURSO_DATABASE_URL' && key !== 'TURSO_AUTH_TOKEN') continue;
    if (process.env[key]) continue;
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function validateTursoCredentials(env = process.env) {
  const url = typeof env.TURSO_DATABASE_URL === 'string' ? env.TURSO_DATABASE_URL.trim() : '';
  const authToken = typeof env.TURSO_AUTH_TOKEN === 'string' ? env.TURSO_AUTH_TOKEN.trim() : '';

  if (!url) {
    throw new Error('TURSO_DATABASE_URL is required for --apply');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TURSO_DATABASE_URL is not a valid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Unsupported TURSO_DATABASE_URL protocol: ${parsed.protocol}`);
  }
  if (parsed.protocol !== 'file:' && !authToken) {
    throw new Error('TURSO_AUTH_TOKEN is required for remote TURSO_DATABASE_URL');
  }

  return { url, ...(authToken ? { authToken } : {}) };
}

function extractNamesSchemaStatements(root = ROOT) {
  const schemaPath = path.join(root, 'turso', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const namesTable = schema.match(/CREATE TABLE IF NOT EXISTS names\s*\([\s\S]*?\);/i)?.[0];
  const metadataTable = schema.match(/CREATE TABLE IF NOT EXISTS dictionary_metadata\s*\([\s\S]*?\);/i)?.[0];
  const normSurfaceIdx = schema.match(/CREATE INDEX IF NOT EXISTS idx_names_norm_surface\s+ON\s+names\s*\([^;]+\);/i)?.[0];
  const normReadingIdx = schema.match(/CREATE INDEX IF NOT EXISTS idx_names_norm_reading\s+ON\s+names\s*\([^;]+\);/i)?.[0];
  const dataVersionIdx = schema.match(/CREATE INDEX IF NOT EXISTS idx_names_data_version\s+ON\s+names\s*\([^;]+\);/i)?.[0];

  assert(namesTable, 'names table DDL missing from turso/schema.sql');
  assert(metadataTable, 'dictionary_metadata table DDL missing from turso/schema.sql');
  assert(normSurfaceIdx && normReadingIdx && dataVersionIdx, 'names index DDL missing from turso/schema.sql');

  return {
    namesTable,
    metadataTable,
    indexes: [normSurfaceIdx, normReadingIdx, dataVersionIdx],
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(fn, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

async function ensureNamesSchema(client, root = ROOT) {
  const ddl = extractNamesSchemaStatements(root);
  await retry(() => client.execute(ddl.namesTable));
  await retry(() => client.execute(ddl.metadataTable));

  const tableInfo = await retry(() => client.execute('PRAGMA table_info(names)'));
  const colNames = new Set(tableInfo.rows.map((row) => String(row.name)));

  for (const requiredCol of ['surface', 'reading', 'mask']) {
    assert(colNames.has(requiredCol), `Existing names table missing required column: ${requiredCol}`);
  }

  const pkCols = tableInfo.rows
    .filter((row) => Number(row.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((row) => String(row.name));
  assert.deepEqual(pkCols, ['surface', 'reading'], 'Existing names table primary key must be (surface, reading)');

  for (const additiveCol of ['norm_surface', 'norm_reading', 'data_version']) {
    if (!colNames.has(additiveCol)) {
      await retry(() => client.execute(`ALTER TABLE names ADD COLUMN ${additiveCol} TEXT NOT NULL DEFAULT ''`));
    }
  }

  for (const indexSql of ddl.indexes) {
    await retry(() => client.execute(indexSql));
  }
}

function buildUpsertStatements(batch, dataVersion) {
  const stmts = [];
  for (let start = 0; start < batch.length; start += MAX_ROWS_PER_INSERT) {
    const sub = batch.slice(start, start + MAX_ROWS_PER_INSERT);
    const placeholders = sub.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const args = [];
    for (const row of sub) {
      args.push(row.surface, row.reading, row.normSurface, row.normReading, row.mask, dataVersion);
    }
    stmts.push({
      sql: `INSERT INTO names (surface, reading, norm_surface, norm_reading, mask, data_version)
            VALUES ${placeholders}
            ON CONFLICT(surface, reading) DO UPDATE SET
              norm_surface = excluded.norm_surface,
              norm_reading = excluded.norm_reading,
              mask = excluded.mask,
              data_version = excluded.data_version`,
      args,
    });
  }
  return stmts;
}

function redactSecrets(message, creds) {
  let out = String(message || 'Unknown error');
  if (creds?.url) out = out.split(creds.url).join('[REDACTED_URL]');
  if (creds?.authToken) out = out.split(creds.authToken).join('[REDACTED_TOKEN]');
  return out;
}

async function applyToTurso({ manifest, rows, batchSize, force }) {
  loadEnvLocalIfMissing();
  const creds = validateTursoCredentials();
  const client = createClient(creds);

  try {
    await ensureNamesSchema(client);

    const metaRes = await retry(() =>
      client.execute({
        sql: 'SELECT value FROM dictionary_metadata WHERE key = ?',
        args: ['names_data_version'],
      }),
    );
    const existingVersion = metaRes.rows[0]?.value ? String(metaRes.rows[0].value) : null;

    const preCountsRes = await retry(() =>
      client.execute({
        sql: 'SELECT COUNT(*) AS total, SUM(CASE WHEN data_version = ? THEN 1 ELSE 0 END) AS current FROM names',
        args: [manifest.dataVersion],
      }),
    );
    const preTotal = Number(preCountsRes.rows[0]?.total || 0);
    const preCurrent = Number(preCountsRes.rows[0]?.current || 0);

    if (!force && existingVersion === manifest.dataVersion && preTotal === rows.length && preCurrent === rows.length) {
      console.log(`UP-TO-DATE: names already synced at version ${manifest.dataVersion} (${rows.length} rows).`);
      return;
    }

    let upserted = 0;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      const stmts = buildUpsertStatements(batch, manifest.dataVersion);
      await retry(() => client.batch(stmts, 'write'));
      upserted += batch.length;
      if (upserted % 50000 === 0 || upserted === rows.length) {
        console.log(`Upserted ${upserted}/${rows.length} name rows...`);
      }
    }

    let deletedStale = 0;
    while (true) {
      const res = await retry(() =>
        client.batch(
          [
            {
              sql: `DELETE FROM names
                    WHERE (surface, reading) IN (
                      SELECT surface, reading FROM names WHERE data_version != ? LIMIT ?
                    )`,
              args: [manifest.dataVersion, DELETE_CHUNK_SIZE],
            },
          ],
          'write',
        ),
      );
      const affected = Number(res[0]?.rowsAffected || 0);
      deletedStale += affected;
      if (affected < DELETE_CHUNK_SIZE) break;
    }

    const postCountsRes = await retry(() =>
      client.execute({
        sql: 'SELECT COUNT(*) AS total, SUM(CASE WHEN data_version = ? THEN 1 ELSE 0 END) AS current FROM names',
        args: [manifest.dataVersion],
      }),
    );
    const postTotal = Number(postCountsRes.rows[0]?.total || 0);
    const postCurrent = Number(postCountsRes.rows[0]?.current || 0);
    assert.equal(postTotal, rows.length, `Post-reconciliation total mismatch (${postTotal} !== ${rows.length})`);
    assert.equal(postCurrent, rows.length, `Post-reconciliation current version mismatch (${postCurrent} !== ${rows.length})`);

    await retry(() =>
      client.batch(
        [
          {
            sql: `INSERT INTO dictionary_metadata (key, value, updated_at)
                  VALUES (?, ?, datetime('now'))
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
            args: ['names_data_version', manifest.dataVersion],
          },
          {
            sql: `INSERT INTO dictionary_metadata (key, value, updated_at)
                  VALUES (?, ?, datetime('now'))
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
            args: ['names_total_entries', String(manifest.totalEntries)],
          },
          {
            sql: `INSERT INTO dictionary_metadata (key, value, updated_at)
                  VALUES (?, ?, datetime('now'))
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
            args: ['names_source_date', String(manifest.sourceDate || '')],
          },
        ],
        'write',
      ),
    );

    console.log(
      `PASS: synced ${upserted} name rows, deleted ${deletedStale} stale rows, verified version ${manifest.dataVersion}.`,
    );
  } catch (err) {
    throw new Error(redactSecrets(err?.message || 'Turso names sync failed', creds));
  } finally {
    await client.close();
  }
}

async function main() {
  const { apply, force, batchSize } = parseArgs(process.argv);
  const { manifest, rShardsCount, rows } = readNameShards(ROOT);

  if (!apply) {
    const batchCount = Math.ceil(rows.length / batchSize);
    extractNamesSchemaStatements(ROOT);
    console.log(
      `DRY RUN: validated ${rows.length} unique name rows across ${rShardsCount} r-*.tsv.gz shards (version ${manifest.dataVersion}, ${batchCount} batches @ ${batchSize} rows); no database access or writes.`,
    );
    return;
  }

  await applyToTurso({ manifest, rows, batchSize, force });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Turso names sync failed: ${err?.message || 'unknown error'}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  MIN_BATCH_SIZE,
  MAX_BATCH_SIZE,
  normalizeNameKey,
  parseArgs,
  readNameShards,
  validateTursoCredentials,
  extractNamesSchemaStatements,
  buildUpsertStatements,
};
