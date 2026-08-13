import fs from 'fs';
import path from 'path';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createTursoClient, type Client as TursoClient } from '@libsql/client';

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
const isResume = args.some((a) => a === '--resume');
const limitArg = args.find((a) => a.startsWith('--limit='));
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));

const maxLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 500;

const CHECKPOINT_FILE = path.join(process.cwd(), '.turso-checkpoint.json');

interface MigrationCheckpoint {
  lastTermId: string;
  lastKanjiLiteral: string;
  totalTermsProcessed: number;
  totalKanjiProcessed: number;
  timestamp: string;
}

function loadCheckpoint(): MigrationCheckpoint {
  if (isResume && fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      console.log(`🔄 Resuming migration from checkpoint: lastTermId="${data.lastTermId}", lastKanji="${data.lastKanjiLiteral}"`);
      return data;
    } catch {
      console.warn('⚠️ Failed to load checkpoint file. Starting fresh.');
    }
  }
  return {
    lastTermId: '',
    lastKanjiLiteral: '',
    totalTermsProcessed: 0,
    totalKanjiProcessed: 0,
    timestamp: new Date().toISOString(),
  };
}

function saveCheckpoint(checkpoint: MigrationCheckpoint) {
  checkpoint.timestamp = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remSec}s` : `${remSec}s`;
}

async function retryOp<T>(fn: () => PromiseLike<T>, retries = 3, delayMs = 2000): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const res = await fn();
      return res;
    } catch (err: any) {
      attempt++;
      if (attempt >= retries) throw err;
      console.warn(`   ⚠️ Warning: Operation failed (Attempt ${attempt}/${retries}): ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
  throw new Error('Operation retries exhausted');
}

async function main() {
  console.log('================================================================');
  console.log('🚀 YomuJi Dictionary Data Migration (Supabase → Turso libSQL)');
  console.log('================================================================');
  console.log(`📋 Mode: ${isDryRun ? 'DRY-RUN (Validation only)' : 'PRODUCTION IMPORT'}`);
  console.log(`📦 Batch Size: ${batchSize}`);
  console.log(`🛑 Max Limit: ${maxLimit === Infinity ? 'UNLIMITED (All rows)' : maxLimit.toLocaleString()}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    process.exit(1);
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  let turso: TursoClient | null = null;

  if (!isDryRun) {
    if (!tursoUrl) {
      console.error('❌ Error: TURSO_DATABASE_URL is missing! Pass credentials or run with --dry-run.');
      process.exit(1);
    }
    turso = createTursoClient({ url: tursoUrl, authToken: tursoAuthToken });
  }

  const checkpoint = loadCheckpoint();
  const startTime = Date.now();

  // Step 1: Initialize Turso Schema DDL if Turso client is active
  if (turso) {
    console.log('\n🛠️ Initializing Turso DDL schema...');
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

  // Step 2: Migrate Kanji Records
  console.log('\n漢 Step 1/2: Migrating Kanji records...');
  let currentKanjiLiteral = checkpoint.lastKanjiLiteral;
  let kanjiCount = checkpoint.totalKanjiProcessed;

  while (kanjiCount < maxLimit) {
    const currentBatchLimit = Math.min(batchSize, maxLimit - kanjiCount);
    let query = supabase
      .from('kanjis')
      .select('*')
      .order('literal', { ascending: true })
      .limit(currentBatchLimit);

    if (currentKanjiLiteral) {
      query = query.gt('literal', currentKanjiLiteral);
    }

    const { data, error } = await retryOp(() => query);
    const rows: any[] = data || [];

    if (error) {
      console.error('❌ Error fetching kanji batch from Supabase:', error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log('✅ All Kanji records processed.');
      break;
    }

    if (turso) {
      const batchStatements = rows.map((k: any) => ({
        sql: `
          INSERT INTO kanjis (
            literal, on_readings, kun_readings, han_viet, meanings, meanings_raw,
            radical, pen_strokes, stroke_count, jlpt, grade, frequency, unicode,
            tags, components, stroke_paths
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(literal) DO UPDATE SET
            on_readings = excluded.on_readings,
            kun_readings = excluded.kun_readings,
            han_viet = excluded.han_viet,
            meanings = excluded.meanings,
            meanings_raw = excluded.meanings_raw,
            radical = excluded.radical,
            pen_strokes = excluded.pen_strokes,
            stroke_count = excluded.stroke_count,
            jlpt = excluded.jlpt,
            grade = excluded.grade,
            frequency = excluded.frequency,
            unicode = excluded.unicode,
            tags = excluded.tags,
            components = excluded.components,
            stroke_paths = excluded.stroke_paths
        `,
        args: [
          k.literal,
          JSON.stringify(k.on_readings || []),
          JSON.stringify(k.kun_readings || []),
          JSON.stringify(k.han_viet || []),
          JSON.stringify(k.meanings || []),
          JSON.stringify(k.meanings_raw || []),
          k.radical || null,
          k.pen_strokes || null,
          k.stroke_count || null,
          k.jlpt || null,
          k.grade || null,
          k.frequency || null,
          k.unicode || null,
          JSON.stringify(k.tags || []),
          JSON.stringify(k.components || []),
          JSON.stringify(k.stroke_paths || []),
        ],
      }));

      await retryOp(() => turso!.batch(batchStatements, 'write'));
    }

    kanjiCount += rows.length;
    currentKanjiLiteral = rows[rows.length - 1].literal;
    checkpoint.lastKanjiLiteral = currentKanjiLiteral;
    checkpoint.totalKanjiProcessed = kanjiCount;
    saveCheckpoint(checkpoint);

    console.log(`   [Kanji] Processed ${kanjiCount.toLocaleString()} kanji...`);
  }

  // Step 3: Migrate Terms Records (Keyset Pagination on `id`)
  console.log('\n📖 Step 2/2: Migrating Term records...');
  let currentTermId = checkpoint.lastTermId;
  let termsCount = checkpoint.totalTermsProcessed;

  // Get total count estimate from Supabase
  const { count: totalTermCount } = await supabase.from('terms').select('*', { count: 'exact', head: true });
  const targetTotal = totalTermCount ? Math.min(totalTermCount, maxLimit) : maxLimit;

  while (termsCount < maxLimit) {
    const currentBatchLimit = Math.min(batchSize, maxLimit - termsCount);
    let query = supabase
      .from('terms')
      .select('*')
      .order('id', { ascending: true })
      .limit(currentBatchLimit);

    if (currentTermId) {
      query = query.gt('id', currentTermId);
    }

    const { data, error } = await retryOp(() => query);
    const rows: any[] = data || [];

    if (error) {
      console.error('❌ Error fetching terms batch from Supabase:', error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log('✅ All Term records processed.');
      break;
    }

    if (turso) {
      const batchStatements = rows.map((t: any) => ({
        sql: `
          INSERT INTO terms (
            id, sequence, surface, reading, romaji, meanings_vi, glosses_raw,
            part_of_speech, tags, score, is_common, kanji, kanji_readings, search_aliases
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            sequence = excluded.sequence,
            surface = excluded.surface,
            reading = excluded.reading,
            romaji = excluded.romaji,
            meanings_vi = excluded.meanings_vi,
            glosses_raw = excluded.glosses_raw,
            part_of_speech = excluded.part_of_speech,
            tags = excluded.tags,
            score = excluded.score,
            is_common = excluded.is_common,
            kanji = excluded.kanji,
            kanji_readings = excluded.kanji_readings,
            search_aliases = excluded.search_aliases
        `,
        args: [
          t.id,
          t.sequence || 0,
          t.surface,
          t.reading,
          t.romaji,
          JSON.stringify(t.meanings_vi || []),
          JSON.stringify(t.glosses_raw || []),
          JSON.stringify(t.part_of_speech || []),
          JSON.stringify(t.tags || []),
          t.score || 0,
          t.is_common ? 1 : 0,
          JSON.stringify(t.kanji || []),
          JSON.stringify(t.kanji_readings || []),
          JSON.stringify(t.search_aliases || [t.surface, t.reading, t.romaji]),
        ],
      }));

      await retryOp(() => turso!.batch(batchStatements, 'write'));
    }

    termsCount += rows.length;
    currentTermId = rows[rows.length - 1].id;
    checkpoint.lastTermId = currentTermId;
    checkpoint.totalTermsProcessed = termsCount;
    saveCheckpoint(checkpoint);

    const elapsed = Date.now() - startTime;
    const rate = Math.round((termsCount / (elapsed / 1000)));
    const percentStr = targetTotal !== Infinity ? ` (${((termsCount / targetTotal) * 100).toFixed(1)}%)` : '';

    console.log(`   [Terms] Processed ${termsCount.toLocaleString()}${percentStr} terms. Speed: ${rate.toLocaleString()} items/s. Elapsed: ${formatDuration(elapsed)}`);
  }

  const totalTime = formatDuration(Date.now() - startTime);
  console.log('\n================================================================');
  console.log(`🎉 Migration Completed Successfully in ${totalTime}!`);
  console.log(`📊 Summary:`);
  console.log(`   - Kanji Processed: ${kanjiCount.toLocaleString()}`);
  console.log(`   - Terms Processed: ${termsCount.toLocaleString()}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ Fatal Migration Error:', err);
  process.exit(1);
});
