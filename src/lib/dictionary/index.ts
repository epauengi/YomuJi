import 'server-only';
import type { DictionaryRepository } from './types';
import { SupabaseDictionaryRepository } from './supabaseRepository';
import { TursoDictionaryRepository } from './tursoRepository';
import { CompareDictionaryRepository } from './compareRepository';

let cachedRepository: DictionaryRepository | null = null;

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
