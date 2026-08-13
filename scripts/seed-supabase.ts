import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { TermRecord, KanjiRecord, DictionaryManifest, DictionaryShardPayload } from '../src/types/dictionary';

// Load Environment Variables manually from .env.local if present
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local!');
  console.error('Please create .env.local with your Supabase credentials before seeding.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const DICT_DIR = path.join(process.cwd(), 'public', 'dict');
const BATCH_SIZE_TERMS = 500;
const BATCH_SIZE_KANJI = 250;

async function main() {
  console.log('🚀 Starting YomuJi Supabase PostgreSQL Data Seeding...');
  console.log(`🌐 Supabase Target: ${supabaseUrl}`);

  const manifestPath = path.join(DICT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Manifest file not found! Please run `npm run build:dict` first.');
    process.exit(1);
  }

  const manifest: DictionaryManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const termShards = manifest.shards.filter((s) => s.type === 'terms');
  const kanjiShards = manifest.shards.filter((s) => s.type === 'kanji');

  // ==========================================
  // 1. Seed Kanji Records
  // ==========================================
  console.log('\n漢 Seeding Kanji records to Supabase PostgreSQL...');
  let totalKanjiInserted = 0;

  for (const shard of kanjiShards) {
    const shardFilePath = path.join(DICT_DIR, shard.url.replace('/dict/', ''));
    if (!fs.existsSync(shardFilePath)) continue;

    const payload: DictionaryShardPayload<KanjiRecord> = JSON.parse(fs.readFileSync(shardFilePath, 'utf-8'));
    const records = payload.records;

    for (let i = 0; i < records.length; i += BATCH_SIZE_KANJI) {
      const chunk = records.slice(i, i + BATCH_SIZE_KANJI).map((k) => ({
        literal: k.literal,
        on_readings: k.onReadings || [],
        kun_readings: k.kunReadings || [],
        han_viet: k.hanViet || [],
        meanings: k.meanings || [],
        meanings_raw: k.meaningsRaw || [],
        radical: k.radical || null,
        pen_strokes: k.penStrokes || null,
        stroke_count: k.strokeCount || null,
        jlpt: k.jlpt || null,
        grade: k.grade || null,
        frequency: k.frequency || null,
        unicode: k.unicode || null,
        tags: k.tags || [],
        components: k.components || [],
        stroke_paths: k.strokePaths || [],
      }));

      const { error } = await supabaseAdmin.from('kanjis').upsert(chunk, { onConflict: 'literal' });
      if (error) {
        console.error(`❌ Error inserting kanji chunk at ${i}:`, error.message);
      } else {
        totalKanjiInserted += chunk.length;
      }
    }
  }
  console.log(`✅ Successfully seeded ${totalKanjiInserted.toLocaleString()} Kanji records into Supabase.`);

  // ==========================================
  // 2. Seed Term Records
  // ==========================================
  console.log('\n📖 Seeding Term records to Supabase PostgreSQL...');
  let totalTermsInserted = 0;

  for (let sIdx = 0; sIdx < termShards.length; sIdx++) {
    const shard = termShards[sIdx];
    const shardFilePath = path.join(DICT_DIR, shard.url.replace('/dict/', ''));
    if (!fs.existsSync(shardFilePath)) continue;

    const payload: DictionaryShardPayload<TermRecord> = JSON.parse(fs.readFileSync(shardFilePath, 'utf-8'));
    const records = payload.records;

    for (let i = 0; i < records.length; i += BATCH_SIZE_TERMS) {
      const chunk = records.slice(i, i + BATCH_SIZE_TERMS).map((t) => ({
        id: t.id,
        sequence: t.sequence || 0,
        surface: t.surface,
        reading: t.reading,
        romaji: t.romaji,
        meanings_vi: t.meaningsVi || [],
        glosses_raw: t.glossesRaw || [],
        part_of_speech: t.partOfSpeech || [],
        tags: t.tags || [],
        score: t.score || 0,
        is_common: Boolean(t.isCommon),
        kanji: t.kanji || [],
        kanji_readings: t.kanjiReadings || [],
        search_aliases: t.searchAliases || [t.surface, t.reading, t.romaji],
      }));

      const { error } = await supabaseAdmin.from('terms').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`❌ Error inserting terms chunk at shard ${sIdx + 1}, index ${i}:`, error.message);
      } else {
        totalTermsInserted += chunk.length;
      }
    }

    if ((sIdx + 1) % 10 === 0 || sIdx === termShards.length - 1) {
      console.log(`   [Shard ${sIdx + 1}/${termShards.length}] Seeded ${totalTermsInserted.toLocaleString()} terms...`);
    }
  }

  console.log(`\n🎉 Supabase Database Seeding Completed Successfully!`);
  console.log(`📊 Total Kanji Seeded: ${totalKanjiInserted.toLocaleString()}`);
  console.log(`📊 Total Terms Seeded: ${totalTermsInserted.toLocaleString()}`);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
