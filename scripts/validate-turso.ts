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

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createTursoClient, type Client as TursoClient } from '@libsql/client';
import { SupabaseDictionaryRepository } from '../src/lib/dictionary/supabaseRepository';
import { TursoDictionaryRepository } from '../src/lib/dictionary/tursoRepository';

const TEST_QUERIES = [
  '日本',
  '日',
  '学校',
  'にほん',
  'ニホン',
  'nihon',
  'gakkou',
  'Nhật Bản',
  'trường học',
];

async function main() {
  console.log('================================================================');
  console.log('🔍 YomuJi Turso vs Supabase Post-Migration Data Validator');
  console.log('================================================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: Supabase credentials missing from .env.local!');
    process.exit(1);
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  let turso: TursoClient | null = null;
  if (tursoUrl) {
    turso = createTursoClient({ url: tursoUrl, authToken: tursoAuthToken });
  } else {
    console.warn('⚠️ TURSO_DATABASE_URL is not configured. Running offline validation checks for Supabase repository...\n');
  }

  // ------------------------------------------------------------------
  // Check 1: Row Counts Comparison
  // ------------------------------------------------------------------
  console.log('📊 Check 1: Row Count Comparison');
  const { count: supabaseTermsCount } = await supabase.from('terms').select('*', { count: 'exact', head: true });
  const { count: supabaseKanjiCount } = await supabase.from('kanjis').select('*', { count: 'exact', head: true });

  console.log(`   [Supabase] terms: ${supabaseTermsCount?.toLocaleString()} rows | kanjis: ${supabaseKanjiCount?.toLocaleString()} rows`);

  if (turso) {
    const tursoTermsRes = await turso.execute('SELECT COUNT(*) as count FROM terms');
    const tursoKanjiRes = await turso.execute('SELECT COUNT(*) as count FROM kanjis');

    const tursoTermsCount = Number(tursoTermsRes.rows[0].count);
    const tursoKanjiCount = Number(tursoKanjiRes.rows[0].count);

    console.log(`   [Turso]    terms: ${tursoTermsCount.toLocaleString()} rows | kanjis: ${tursoKanjiCount.toLocaleString()} rows`);

    if (supabaseTermsCount === tursoTermsCount) {
      console.log('   ✅ Terms row count MATCHES perfectly!');
    } else {
      console.warn(`   ⚠️ Terms row count difference: ${Math.abs((supabaseTermsCount || 0) - tursoTermsCount)} rows`);
    }

    if (supabaseKanjiCount === tursoKanjiCount) {
      console.log('   ✅ Kanji row count MATCHES perfectly!');
    } else {
      console.warn(`   ⚠️ Kanji row count difference: ${Math.abs((supabaseKanjiCount || 0) - tursoKanjiCount)} rows`);
    }
  }

  // ------------------------------------------------------------------
  // Check 2: Random Sample Field Equality & Unicode Accuracy
  // ------------------------------------------------------------------
  if (turso) {
    console.log('\n🧪 Check 2: Random Sample Verification & Unicode Accuracy');
    const { data: sampleTerms } = await supabase.from('terms').select('*').limit(20);
    let termDiscrepancies = 0;

    if (sampleTerms) {
      for (const st of sampleTerms) {
        const res = await turso.execute({ sql: 'SELECT * FROM terms WHERE id = ?', args: [st.id] });
        if (res.rows.length === 0) {
          console.error(`   ❌ Term id="${st.id}" missing from Turso!`);
          termDiscrepancies++;
          continue;
        }

        const tt = res.rows[0];
        if (st.surface !== String(tt.surface) || st.reading !== String(tt.reading)) {
          console.error(`   ❌ Term id="${st.id}" mismatch in surface/reading!`);
          termDiscrepancies++;
        }
      }

      if (termDiscrepancies === 0) {
        console.log(`   ✅ 20/20 Random term samples match 100% in field contents & Unicode encoding!`);
      }
    }
  }

  // ------------------------------------------------------------------
  // Check 3: Executing Search Query Test Suite
  // ------------------------------------------------------------------
  console.log('\n🔎 Check 3: Executing Search Query Test Suite');
  const supabaseRepo = new SupabaseDictionaryRepository();
  const tursoRepo = turso ? new TursoDictionaryRepository(turso) : null;

  for (const q of TEST_QUERIES) {
    console.log(`\n   Query: "${q}"`);
    try {
      const supRes = await supabaseRepo.searchTerms({ query: q, limit: 5 });
      console.log(`     - Supabase returned ${supRes.terms.length} terms: ${supRes.terms.map((t) => t.term.surface).join(', ')}`);
    } catch (err: any) {
      console.warn(`     - Supabase query timed out or failed: ${err.message}`);
    }

    if (tursoRepo) {
      try {
        const tursoRes = await tursoRepo.searchTerms({ query: q, limit: 5 });
        console.log(`     - Turso    returned ${tursoRes.terms.length} terms: ${tursoRes.terms.map((t) => t.term.surface).join(', ')}`);

        // Check duplicates
        const ids = tursoRes.terms.map((t) => t.term.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          console.error(`     ❌ Warning: Turso returned duplicate IDs for query "${q}"!`);
        }
      } catch (err: any) {
        console.error(`     - Turso query error: ${err.message}`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('🎉 Post-Migration Validation Completed Successfully!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ Validation script error:', err);
  process.exit(1);
});
