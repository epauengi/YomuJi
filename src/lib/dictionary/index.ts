import 'server-only';
import type { DictionaryRepository } from './types';
import { SupabaseDictionaryRepository } from './supabaseRepository';
import { TursoDictionaryRepository } from './tursoRepository';
import { CompareDictionaryRepository } from './compareRepository';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

let cachedRepository: DictionaryRepository | null = null;

export function isDictionaryBackendConfigured(): boolean {
  const backend = (process.env.DICTIONARY_BACKEND || 'supabase').toLowerCase().trim();
  if (backend === 'turso') {
    return Boolean(process.env.TURSO_DATABASE_URL);
  }
  if (backend === 'compare') {
    return isSupabaseConfigured && Boolean(process.env.TURSO_DATABASE_URL);
  }
  return isSupabaseConfigured;
}

export function getDictionaryRepository(): DictionaryRepository {
  if (cachedRepository) return cachedRepository;

  const backend = (process.env.DICTIONARY_BACKEND || 'supabase').toLowerCase().trim();

  if (backend === 'turso') {
    if (!process.env.TURSO_DATABASE_URL) {
      console.warn('[DictionaryFactory] DICTIONARY_BACKEND="turso" but TURSO_DATABASE_URL is missing. Falling back to Supabase.');
      cachedRepository = new SupabaseDictionaryRepository();
    } else {
      cachedRepository = new TursoDictionaryRepository();
    }
  } else if (backend === 'compare') {
    cachedRepository = new CompareDictionaryRepository();
  } else {
    cachedRepository = new SupabaseDictionaryRepository();
  }

  return cachedRepository;
}

export type { DictionaryRepository } from './types';
