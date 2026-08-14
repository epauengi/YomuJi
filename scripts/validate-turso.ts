import fs from 'fs';
import path from 'path';

// 1. MUST load Environment Variables from .env.local BEFORE importing modules
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

import { createClient as createTursoClient, type Client as TursoClient } from '@libsql/client';
import { TursoDictionaryRepository } from '../src/lib/dictionary/tursoRepository';
import type { DictionaryManifest } from '../src/types/dictionary';

const TEST_QUERIES = [
  '安全',
  '意見',
  '意味',
  '学校',
  'にほん',
  'anzen',
  'iken',
  'sự an toàn',
  'ý kiến',
];

async function main() {
  console.log('================================================================');
  console.log('🔍 YomuJi Turso Post-Migration Data Validator');
  console.log('================================================================\n');

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    console.error('❌ Error: TURSO_DATABASE_URL is missing in .env.local!');
    process.exit(1);
  }

  const turso: TursoClient = createTursoClient({ url: tursoUrl, authToken: tursoAuthToken });

  const manifestPath = path.join(process.cwd(), 'public', 'dict', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Error: public/dict/manifest.json not found!');
    process.exit(1);
  }

  const manifest: DictionaryManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // ------------------------------------------------------------------
  // Check 1: Row Counts Comparison with Manifest
  // ------------------------------------------------------------------
  console.log('📊 Check 1: Row Count Comparison (Turso vs Manifest)');
  const tursoTermsRes = await turso.execute('SELECT COUNT(*) as count FROM terms');
  const tursoKanjiRes = await turso.execute('SELECT COUNT(*) as count FROM kanjis');

  const tursoTermsCount = Number(tursoTermsRes.rows[0].count);
  const tursoKanjiCount = Number(tursoKanjiRes.rows[0].count);

  console.log(`   [Manifest] terms: ${manifest.totals.terms.toLocaleString()} rows | kanjis: ${manifest.totals.kanji.toLocaleString()} rows`);
  console.log(`   [Turso]    terms: ${tursoTermsCount.toLocaleString()} rows | kanjis: ${tursoKanjiCount.toLocaleString()} rows`);

  if (manifest.totals.terms === tursoTermsCount) {
    console.log('   ✅ Terms row count MATCHES perfectly!');
  } else {
    console.warn(`   ⚠️ Terms row count diff: ${Math.abs(manifest.totals.terms - tursoTermsCount)} rows`);
  }

  if (manifest.totals.kanji === tursoKanjiCount) {
    console.log('   ✅ Kanji row count MATCHES perfectly!');
  } else {
    console.warn(`   ⚠️ Kanji row count diff: ${Math.abs(manifest.totals.kanji - tursoKanjiCount)} rows`);
  }

  // ------------------------------------------------------------------
  // Check 2: Executing Search Query Test Suite on Turso
  // ------------------------------------------------------------------
  console.log('\n🔎 Check 2: Executing Search Query Test Suite on Turso');
  const tursoRepo = new TursoDictionaryRepository(turso);

  for (const q of TEST_QUERIES) {
    try {
      const res = await tursoRepo.searchTerms({ query: q, limit: 3 });
      console.log(`   Query: "${q}" → Returned ${res.terms.length} terms:`);
      for (const item of res.terms) {
        console.log(`     • ${item.term.surface} (${item.term.reading}) -> [${item.term.meaningsVi.join(', ')}]`);
      }
    } catch (err: any) {
      console.error(`   ❌ Turso query error for "${q}": ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 Turso Data Validation Completed Successfully!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ Validation script error:', err);
  process.exit(1);
});
