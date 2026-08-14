import fs from 'fs';
import path from 'path';
import { createClient as createTursoClient, type Client as TursoClient } from '@libsql/client';
import type { TermRecord, KanjiRecord, DictionaryManifest, DictionaryShardPayload } from '../src/types/dictionary';

// 1. Load Environment Variables from .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      process.env[key.trim()] = vals.join('=').trim();
    }
  }
}

// 2. Parse CLI Options
const args = process.argv.slice(2);
const isDryRun = args.some((a) => a === '--dry-run');
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 100;

const DICT_DIR = path.join(process.cwd(), 'public', 'dict');

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remSec}s` : `${remSec}s`;
}

async function retryOp<T>(fn: () => PromiseLike<T>, retries = 3, delayMs = 1500): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= retries) throw err;
      console.warn(`   ⚠️ Warning (Attempt ${attempt}/${retries}): ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
  throw new Error('Operation retries exhausted');
}

async function main() {
  console.log('================================================================');
  console.log('🚀 YomuJi Turso libSQL Seeding (Direct from public/dict/ JSON)');
  console.log('================================================================');
  console.log(`📋 Mode: ${isDryRun ? 'DRY-RUN (Validation only)' : 'PRODUCTION IMPORT'}`);
  console.log(`📦 Batch Size: ${batchSize}`);

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  let turso: TursoClient | null = null;

  if (!isDryRun) {
    if (!tursoUrl) {
      console.error('❌ Error: TURSO_DATABASE_URL is missing in .env.local!');
      process.exit(1);
    }
    turso = createTursoClient({ url: tursoUrl, authToken: tursoAuthToken });
  }

  const manifestPath = path.join(DICT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Manifest file not found at public/dict/manifest.json! Please run `npm run build:dict` first.');
    process.exit(1);
  }

  const manifest: DictionaryManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const kanjiShards = manifest.shards.filter((s) => s.type === 'kanji');
  const termShards = manifest.shards.filter((s) => s.type === 'terms');

  const startTime = Date.now();

  if (turso) {
    // Step 0: Fast Reset via DROP TABLE
    console.log('\n🧹 Clearing old tables in Turso (DROP TABLE)...');
    await turso.execute('DROP TABLE IF EXISTS terms_fts');
    await turso.execute('DROP TABLE IF EXISTS kanjis_fts');
    await turso.execute('DROP TABLE IF EXISTS terms');
    await turso.execute('DROP TABLE IF EXISTS kanjis');
    await turso.execute('DROP TABLE IF EXISTS migration_checkpoints');
    console.log('✅ Old tables dropped.');

    console.log('🛠️ Re-creating DDL Schema from turso/schema.sql...');
    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'turso', 'schema.sql'), 'utf-8');
    const statements = schemaSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await turso.execute(stmt);
    }
    console.log('✅ Schema initialization completed.');
  }

  // Step 1: Migrate Kanji Records
  console.log('\n漢 Step 1/2: Seeding Kanji Records into Turso...');
  let totalKanjiInserted = 0;

  for (const shard of kanjiShards) {
    const shardFilePath = path.join(DICT_DIR, shard.url.replace('/dict/', ''));
    if (!fs.existsSync(shardFilePath)) continue;

    const payload: DictionaryShardPayload<KanjiRecord> = JSON.parse(fs.readFileSync(shardFilePath, 'utf-8'));
    const records = payload.records;

    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);

      if (turso) {
        const batchStatements: any[] = [];
        for (const k of chunk) {
          batchStatements.push({
            sql: `
              INSERT OR REPLACE INTO kanjis (
                literal, on_readings, kun_readings, han_viet, meanings, meanings_raw,
                radical, pen_strokes, stroke_count, jlpt, grade, frequency, unicode,
                tags, components, stroke_paths
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              k.literal,
              JSON.stringify(k.onReadings || []),
              JSON.stringify(k.kunReadings || []),
              JSON.stringify(k.hanViet || []),
              JSON.stringify(k.meanings || []),
              JSON.stringify(k.meaningsRaw || []),
              k.radical || null,
              k.penStrokes || null,
              k.strokeCount || null,
              k.jlpt || null,
              k.grade || null,
              k.frequency || null,
              k.unicode || null,
              JSON.stringify(k.tags || []),
              JSON.stringify(k.components || []),
              JSON.stringify(k.strokePaths || []),
            ],
          });

          // FTS
          batchStatements.push({
            sql: `
              INSERT INTO kanjis_fts (literal, literal_text, han_viet, on_readings, kun_readings, meanings)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [
              k.literal,
              k.literal,
              (k.hanViet || []).join(' '),
              (k.onReadings || []).join(' '),
              (k.kunReadings || []).join(' '),
              (k.meanings || []).join(' '),
            ],
          });
        }

        await retryOp(() => turso!.batch(batchStatements, 'write'));
      }

      totalKanjiInserted += chunk.length;
    }
    console.log(`   [Kanji] Processed ${totalKanjiInserted.toLocaleString()} / ${manifest.totals.kanji.toLocaleString()} kanji...`);
  }
  console.log(`✅ Completed Kanji seeding: ${totalKanjiInserted.toLocaleString()} kanji records in Turso.`);

  // Step 2: Migrate Term Records
  console.log('\n📖 Step 2/2: Seeding Term Records into Turso...');
  let totalTermsInserted = 0;
  const totalTermsTarget = manifest.totals.terms;

  for (const shard of termShards) {
    const shardFilePath = path.join(DICT_DIR, shard.url.replace('/dict/', ''));
    if (!fs.existsSync(shardFilePath)) continue;

    const payload: DictionaryShardPayload<TermRecord> = JSON.parse(fs.readFileSync(shardFilePath, 'utf-8'));
    const records = payload.records;

    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);

      if (turso) {
        const batchStatements: any[] = [];
        for (const t of chunk) {
          const searchAliases = Array.from(new Set([t.surface, t.reading, t.romaji, ...(t.hanVietStr ? [t.hanVietStr] : [])]));

          batchStatements.push({
            sql: `
              INSERT OR REPLACE INTO terms (
                id, sequence, surface, reading, romaji, meanings_vi, glosses_raw,
                part_of_speech, tags, score, is_common, kanji, kanji_readings, search_aliases
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              t.id,
              t.sequence || 0,
              t.surface,
              t.reading,
              t.romaji,
              JSON.stringify(t.meaningsVi || []),
              JSON.stringify(t.glossesRaw || []),
              JSON.stringify(t.partOfSpeech || []),
              JSON.stringify(t.tags || []),
              t.score || 0,
              t.isCommon ? 1 : 0,
              JSON.stringify(t.kanji || []),
              JSON.stringify(t.kanjiReadings || []),
              JSON.stringify(searchAliases),
            ],
          });

          // FTS
          batchStatements.push({
            sql: `
              INSERT INTO terms_fts (id, surface, reading, romaji, meanings_vi, search_aliases)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [
              t.id,
              t.surface,
              t.reading,
              t.romaji,
              (t.meaningsVi || []).join(' '),
              searchAliases.join(' '),
            ],
          });
        }

        await retryOp(() => turso!.batch(batchStatements, 'write'));
      }

      totalTermsInserted += chunk.length;
    }

    const elapsed = Date.now() - startTime;
    const rate = Math.round(totalTermsInserted / (elapsed / 1000));
    const percentStr = `(${((totalTermsInserted / totalTermsTarget) * 100).toFixed(1)}%)`;
    console.log(`   [Terms] Processed ${totalTermsInserted.toLocaleString()} / ${totalTermsTarget.toLocaleString()} ${percentStr}. Speed: ${rate.toLocaleString()} items/s. Elapsed: ${formatDuration(elapsed)}`);
  }

  const totalTime = formatDuration(Date.now() - startTime);
  console.log('\n================================================================');
  console.log(`🎉 Turso Database Seeding Completed Successfully in ${totalTime}!`);
  console.log(`📊 Summary:`);
  console.log(`   - Kanji Seeded: ${totalKanjiInserted.toLocaleString()}`);
  console.log(`   - Terms Seeded: ${totalTermsInserted.toLocaleString()}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ Fatal Turso Migration Error:', err);
  process.exit(1);
});
