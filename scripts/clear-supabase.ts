import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load Environment Variables from .env.local if present
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
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log('================================================================');
  console.log('🧹 Clearing Old Terms & Kanji Data from Supabase PostgreSQL');
  console.log('================================================================');
  console.log(`🌐 Supabase Target: ${supabaseUrl}`);

  // 1. Delete terms table in sequence ranges (JMDict sequences start around 1,000,000)
  console.log('\n🗑️ Deleting all records from Supabase "terms" table...');
  const START_SEQ = 900000;
  const END_SEQ = 3000000;
  const STEP = 10000;
  let totalDeletedTerms = 0;

  for (let seq = START_SEQ; seq < END_SEQ; seq += STEP) {
    const { error, count } = await supabaseAdmin
      .from('terms')
      .delete({ count: 'exact' })
      .gte('sequence', seq)
      .lt('sequence', seq + STEP);

    if (error) {
      console.warn(`   ⚠️ Warning deleting range ${seq}-${seq + STEP}: ${error.message}`);
    } else if (count && count > 0) {
      totalDeletedTerms += count;
      console.log(`   [terms] Deleted ${count.toLocaleString()} rows (Seq ${seq.toLocaleString()} - ${(seq + STEP).toLocaleString()})`);
    }
  }

  // Also delete any remaining terms outside standard sequence range
  await supabaseAdmin.from('terms').delete().lt('sequence', START_SEQ);
  await supabaseAdmin.from('terms').delete().gte('sequence', END_SEQ);
  await supabaseAdmin.from('terms').delete().is('sequence', null);

  // Check remaining count
  const { count: remainingTerms } = await supabaseAdmin.from('terms').select('*', { count: 'exact', head: true });
  console.log(`📊 Remaining terms in Supabase: ${remainingTerms?.toLocaleString() ?? 0}`);

  // 2. Delete kanjis table
  console.log('\n🗑️ Deleting all records from Supabase "kanjis" table...');
  await supabaseAdmin.from('kanjis').delete().neq('literal', '__CLEARED__');

  const { count: remainingKanji } = await supabaseAdmin.from('kanjis').select('*', { count: 'exact', head: true });
  console.log(`📊 Remaining kanjis in Supabase: ${remainingKanji?.toLocaleString() ?? 0}`);

  console.log('\n================================================================');
  console.log(`🎉 Supabase Cleanup Completed Successfully! Total Deleted: ${totalDeletedTerms.toLocaleString()} terms.`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ Fatal error clearing Supabase:', err);
  process.exit(1);
});
